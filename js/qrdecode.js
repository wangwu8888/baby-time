// ===== v114: 二维码识别（自研，无第三方依赖）=====
// 只做 QR Code Model 2 的读取：定位三个 finder pattern → 估算版本/尺寸 →
// 透视采样成模块网格 → 读格式信息 → 去掩码 → 还原字节流。
// 目标是认出自己生成的邀请链接，不追求识别破损/倾斜严重的码。
var QRDecode = {
  _binarize: function(imageData) {
    var w = imageData.width, h = imageData.height, d = imageData.data;
    var gray = new Uint8Array(w * h);
    var sum = 0;
    for (var i = 0, p = 0; i < d.length; i += 4, p++) {
      var g = (d[i] * 299 + d[i+1] * 587 + d[i+2] * 114) / 1000;
      gray[p] = g; sum += g;
    }
    var avg = sum / (w * h);
    var th = avg * 0.82;            // 经验阈值，比全局均值略低，浅色码也认得出
    if (th < 40) th = 40;
    var bin = new Uint8Array(w * h);
    for (var j = 0; j < gray.length; j++) bin[j] = gray[j] < th ? 1 : 0;
    return { bin: bin, w: w, h: h };
  },

  // 找 finder pattern：1:1:3:1:1 的黑白横向游程
  // 做法：先把整行压成 run-length（[颜色, 长度] 序列），再在序列上滑窗取 5 段
  // 判定比例。比逐像素状态机直观得多，也不会漏掉同行第二个 finder。
  _findFinders: function(b, w, h) {
    var found = [];
    for (var y = 0; y < h; y++) {
      // 1) 压 run-length
      var runs = [], prev = b[y * w], len = 1;
      for (var x = 1; x < w; x++) {
        var v = b[y * w + x];
        if (v === prev) { len++; }
        else { runs.push([prev, len, x - len]); prev = v; len = 1; }
      }
      runs.push([prev, len, w - len]);

      // 2) 滑窗找 5 段：finder 的游程是 B(1)W(1)B(3)W(1)B(1)。
      // 注意 binarize 里约定 1=黑、0=白，所以起点段必须是 1。
      for (var i = 0; i + 4 < runs.length; i++) {
        if (runs[i][0] !== 1 || runs[i + 1][0] !== 0 || runs[i + 2][0] !== 1 ||
            runs[i + 3][0] !== 0 || runs[i + 4][0] !== 1) continue;
        var c = [runs[i][1], runs[i+1][1], runs[i+2][1], runs[i+3][1], runs[i+4][1]];
        if (!this._checkRatio(c)) continue;
        // 中心 x：第 3 段（黑 3 模块）的中点
        var centerX = runs[i+2][2] + runs[i+2][1] / 2;
        var v = this._crossCheckV(b, w, h, centerX, y);
        if (v) found.push(v);
      }
    }
    return found;
  },

  _checkRatio: function(c) {
    var t = c[0]+c[1]+c[2]+c[3]+c[4];
    if (t < 7) return false;
    var m = t / 7;
    var tol = m * 0.9;
    return Math.abs(m - c[0]) < tol && Math.abs(m - c[1]) < tol &&
           Math.abs(3*m - c[2]) < 3*m*0.7 && Math.abs(m - c[3]) < tol &&
           Math.abs(m - c[4]) < tol;
  },

  // 纵向复核：在 cx 这一列上，围绕 cy 找完整的 1:1:3:1:1 五段结构。
  // 与横向一样压 run-length，但要求五段窗口必须完整（前后都有明确的段边界），
  // 并且中心段（3 模块宽的黑段）要被 cy 覆盖——这样能滤掉数据区里的假命中。
  _crossCheckV: function(b, w, h, cx, cy) {
    cx = Math.round(cx);
    if (cx < 0 || cx >= w) return null;
    var runs = [], prev = b[cx], len = 1, start = 0;
    for (var y = 1; y < h; y++) {
      var v = b[y * w + cx];
      if (v === prev) { len++; }
      else { runs.push([prev, len, start]); start = y; prev = v; len = 1; }
    }
    runs.push([prev, len, start]);
    // 找包含 cy 的段
    var cyRun = -1;
    for (var i = 0; i < runs.length; i++) {
      if (cy >= runs[i][2] && cy < runs[i][2] + runs[i][1]) { cyRun = i; break; }
    }
    if (cyRun < 0) return null;
    for (var off = -4; off <= 0; off++) {
      var i0 = cyRun + off;
      if (i0 < 0 || i0 + 4 >= runs.length) continue;
      // 五段必须是 B,W,B,W,B（bin 里 1=黑、0=白）
      var ok = true;
      for (var k = 0; k < 5; k++) if (runs[i0 + k][0] !== (k % 2 === 0 ? 1 : 0)) { ok = false; break; }
      if (!ok) continue;
      // 中心段（第 3 段）必须覆盖 cy
      var mid = runs[i0 + 2];
      if (!(cy >= mid[2] && cy < mid[2] + mid[1])) continue;
      var c = [runs[i0][1], runs[i0+1][1], runs[i0+2][1], runs[i0+3][1], runs[i0+4][1]];
      if (!this._checkRatio(c)) continue;
      return { x: cx, y: mid[2] + mid[1] / 2, mod: (c[0]+c[1]+c[2]+c[3]+c[4]) / 7 };
    }
    return null;
  },

  _mod: function(v) { return ((v % 256) + 256) % 256; },

  // 读单个模块（0/1），坐标是浮点，双线性取邻近
  _sample: function(bin, w, h, x, y) {
    var px = Math.round(x), py = Math.round(y);
    if (px < 0 || py < 0 || px >= w || py >= h) return 0;
    return bin[py * w + px];
  },

  _readFormat: function(getBit) {
    var fmt = 0;
    for (var i = 0; i < 15; i++) fmt = (fmt << 1) | getBit(i);
    var best = -1, bestDist = 99;
    for (var e = 0; e < 4; e++) {
      for (var m = 0; m < 8; m++) {
        var cand = _formatBits(e, m);
        var dist = 0, a = fmt, c2 = cand;
        for (var k = 0; k < 15; k++) { if ((a & 1) !== (c2 & 1)) dist++; a >>= 1; c2 >>= 1; }
        if (dist < bestDist) { bestDist = dist; best = { ec: e, mask: m }; }
      }
    }
    return bestDist <= 3 ? best : null;
  },

  _maskFn: function(m, r, c) {
    switch (m) {
      case 0: return (r + c) % 2 === 0;
      case 1: return r % 2 === 0;
      case 2: return c % 3 === 0;
      case 3: return (r + c) % 3 === 0;
      case 4: return (Math.floor(r/2) + Math.floor(c/3)) % 2 === 0;
      case 5: return ((r*c) % 2) + ((r*c) % 3) === 0;
      case 6: return (((r*c) % 2) + ((r*c) % 3)) % 2 === 0;
      case 7: return (((r+c) % 2) + ((r*c) % 3)) % 2 === 0;
    }
    return false;
  },

  _alignmentCenters: function(size, ver) {
    // 版本 2-6 只在右下角有一个 alignment pattern（中心 size-7）
    if (ver < 2) return [];
    var a = size - 7;
    return [[a, a]];
  },

  // 功能模块判定（决定哪些位置不承载数据）。必须与编码端 _buildMatrix 严格一致，
  // 否则数据位数对不上、码字会错位。
  _isFunc: function(r, c, size, ver) {
    // 左上 finder + 分隔符 + 格式信息：行/列 0..8
    if (r <= 8 && c <= 8) return true;
    // 右上 finder + 分隔符：行 0..8，列 size-8..size-1
    if (r <= 8 && c >= size - 8) return true;
    // 左下 finder + 分隔符：行 size-8..size-1，列 0..8
    if (r >= size - 8 && c <= 8) return true;
    // 时序图案
    if (r === 6 || c === 6) return true;
    // 右下角格式信息（行 8 / 列 8 的延伸段，已含在上面两条之外的部分）
    if (r === 8 && c >= size - 8) return true;
    if (c === 8 && r >= size - 8) return true;
    // alignment pattern（版本 2+，中心 size-7，5x5）
    var centers = this._alignmentCenters(size, ver);
    for (var i = 0; i < centers.length; i++) {
      if (Math.abs(r - centers[i][0]) <= 2 && Math.abs(c - centers[i][1]) <= 2) return true;
    }
    return false;
  },

  // 按 zigzag 顺序把数据区模块读成位流。
  // bits 是 size*size 的扁平网格，索引必须是 row*size+col；
  // 之前误用了一个"数据槽计数器"当索引，导致只读到几十位且内容错乱。
  _decodeBits: function(bits, size, ver) {
    var out = [], dir = -1, col = size - 1;
    while (col > 0) {
      if (col === 6) { col--; }          // 跳过竖直时序列
      for (var i = 0; i < size; i++) {
        var row = dir < 0 ? size - 1 - i : i;
        for (var k = 0; k < 2; k++) {
          var c = col - k;
          if (c < 0) continue;
          if (this._isFunc(row, c, size, ver)) continue;
          out.push(bits[row * size + c] ? 1 : 0);
        }
      }
      dir = -dir; col -= 2;
    }
    return out;
  },

  // 把数据区的位流按「码字交织」还原成字节。
  // 编码端交织规则：把数据码字按块切成各块，再按列优先逐码字交织（不是逐位）。
  // 所以这里必须先在**码字**层面反交织，再拼字节。
  _readCodewords: function(dataBits, size, ver) {
    // 与 _QR_SPEC 同源： [数据码字数, 每块 EC 码字数, 块数]
    var SPEC = {
      1:  [19,  7,  1],   2:  [34,  10, 1],   3:  [55,  15, 1],   4:  [80,  20, 1],   5:  [108, 26, 1],
      6:  [136, 18, 2],   7:  [156, 20, 2],   8:  [194, 24, 2],   9:  [232, 30, 2],   10: [274, 18, 2]
    };
    var sp = SPEC[ver];
    if (!sp) return [];
    var dataCw = sp[0], blocks = sp[2];
    // 1) 位流 → 码字流（数据区共 dataCw 个数据码字，后面跟 EC 码字，我们只看前面）
    var cw = [];
    for (var i = 0; i + 7 < dataBits.length; i += 8) {
      var v = 0;
      for (var b = 0; b < 8; b++) v = (v << 1) | dataBits[i + b];
      cw.push(v);
    }
    // 2) 码字层反交织：按列优先回填各块
    var per = Math.floor(dataCw / blocks), extra = dataCw % blocks;
    var sizes = [];
    for (var k = 0; k < blocks; k++) sizes.push(per + (k >= blocks - extra ? 1 : 0));
    var maxD = per + (extra > 0 ? 1 : 0);
    var blockData = [];
    for (var z = 0; z < blocks; z++) blockData.push([]);
    var idx = 0;
    for (var x = 0; x < maxD; x++) {
      for (var y = 0; y < blocks; y++) {
        // 只有"较长"的块才拥有第 x 个码字；较短块跳过对应列
        var hasCol = (x < per) || (x === per && y < extra);
        if (!hasCol) continue;
        if (idx < cw.length) { blockData[y].push(cw[idx]); idx++; }
      }
    }
    // 3) 各块（长块在前）顺序拼接成原始数据码字
    var out = [];
    for (var q = 0; q < blocks; q++) {
      for (var r2 = 0; r2 < blockData[q].length; r2++) out.push(blockData[q][r2]);
    }
    return out;
  },

  // 解析码字流：模式指示(4bit) + 长度 + 内容。只处理 byte mode（我们生成的码只用它）。
  _parseBytes: function(bytes) {
    if (!bytes || !bytes.length) return '';
    // 转成位流
    var bits = [];
    for (var i = 0; i < bytes.length; i++) {
      for (var b = 7; b >= 0; b--) bits.push((bytes[i] >> b) & 1);
    }
    var pos = 0;
    function take(n) { var v = 0; for (var k = 0; k < n; k++) v = (v << 1) | (bits[pos++] || 0); return v; }
    var mode = take(4);
    if (mode !== 4) return '';          // 只支持 byte mode
    var len = take(8);
    if (len <= 0 || len > bytes.length - 2) return '';
    var chars = [];
    for (var c = 0; c < len; c++) chars.push(take(8));
    // UTF-8 解码
    var out = '';
    for (var ci = 0; ci < chars.length; ci++) {
      var ch = chars[ci];
      if (ch < 0x80) { out += String.fromCharCode(ch); }
      else if (ch >= 0xC0 && ch < 0xE0 && ci + 1 < chars.length) {
        out += String.fromCharCode(((ch & 0x1F) << 6) | (chars[++ci] & 0x3F));
      } else if (ch >= 0xE0 && ci + 2 < chars.length) {
        out += String.fromCharCode(((ch & 0x0F) << 12) | ((chars[++ci] & 0x3F) << 6) | (chars[++ci] & 0x3F));
      }
    }
    return out;
  },

  decode: function(canvas, ctx) {
    var w = canvas.width, h = canvas.height;
    if (w < 30 || h < 30) return '';
    var imageData;
    try { imageData = ctx.getImageData(0, 0, w, h); } catch (e) { return ''; }
    var b = this._binarize(imageData);
    var finders = this._findFinders(b.bin, w, h);
    if (!finders.length) return '';
    // 聚类：同一 finder 会扫出多行命中，取平均中心。
    var pts = [];
    for (var i = 0; i < finders.length; i++) {
      var f = finders[i], m = false;
      for (var j = 0; j < pts.length; j++) {
        var tol = Math.max(2, Math.max(f.mod, pts[j].mod) * 1.2);
        if (Math.abs(pts[j].x - f.x) <= tol && Math.abs(pts[j].y - f.y) <= tol) {
          pts[j].sx += f.x; pts[j].sy += f.y; pts[j].n++; m = true; break;
        }
      }
      if (!m) pts.push({ sx: f.x, sy: f.y, n: 1, mod: f.mod, x: f.x, y: f.y });
    }
    var centers = [];
    for (var k = 0; k < pts.length; k++) {
      pts[k].x = pts[k].sx / pts[k].n;
      pts[k].y = pts[k].sy / pts[k].n;
      // 真 finder 会被扫出多行命中，命中太少的直接丢
      if (pts[k].n < 3) continue;
      centers.push(pts[k]);
    }
    if (centers.length < 3) return '';

    function dist(p, q) { return Math.hypot(p.x - q.x, p.y - q.y); }

    // 枚举所有三点组合，按几何合理性打分排序，然后逐个尝试真正解码。
    // 关键：数据区里会出现"看起来像 finder"的伪命中（模块大小常是真值的 2~3 倍），
    // 只靠打分容易被骗，所以最终以「能否成功解出内容」为准。
    var cands = [];
    for (var a1 = 0; a1 < centers.length; a1++)
    for (var a2 = a1 + 1; a2 < centers.length; a2++)
    for (var a3 = a2 + 1; a3 < centers.length; a3++) {
      var A = centers[a1], B = centers[a2], C = centers[a3];
      var sides = [dist(A, B), dist(B, C), dist(C, A)].sort(function(p, q) { return p - q; });
      if (sides[0] < 1) continue;
      var modAvg = (A.mod + B.mod + C.mod) / 3;
      if (modAvg < 1) continue;
      // 直角边应约为 (size-7) 模块，至少 9 模块
      if (sides[1] / modAvg < 9) continue;
      var hypotenuseRatio = sides[2] / sides[1];
      var legRatio = sides[0] / sides[1];
      var modSpread = (Math.max(A.mod, B.mod, C.mod) - Math.min(A.mod, B.mod, C.mod)) / modAvg;
      // 三个 finder 的模块大小应当高度一致 → modSpread 越小越好
      var score = -Math.abs(hypotenuseRatio - 1.4142) * 100
                  - Math.abs(legRatio - 1) * 100
                  - modSpread * 200
                  - modAvg * 0.5;   // 同等条件下偏好小模块（伪命中通常偏大）
      cands.push({ score: score, pts: [A, B, C] });
    }
    if (!cands.length) return '';
    cands.sort(function(p, q) { return q.score - p.score; });

    for (var ci = 0; ci < cands.length && ci < 12; ci++) {
      var got = this._decodeWithTriple(b, w, h, cands[ci].pts);
      if (got) return got;
    }
    return '';
  },

  // 给定三个 finder 中心，定出 TL/TR/BL 并尝试各候选版本解码
  _decodeWithTriple: function(b, w, h, triple) {
    function dist(p, q) { return Math.hypot(p.x - q.x, p.y - q.y); }
    var P = triple[0], Q = triple[1], R = triple[2];
    var dPQ = dist(P, Q), dQR = dist(Q, R), dRP = dist(R, P);
    var tl, tr, bl;
    // 直角顶点 = 斜边对面的点 = top-left
    if (dPQ >= dQR && dPQ >= dRP) { tl = R; tr = P; bl = Q; }
    else if (dQR >= dRP) { tl = P; tr = Q; bl = R; }
    else { tl = Q; tr = R; bl = P; }
    // 叉积判定方向（保证 tr 在右手侧、bl 在下侧）
    var cross = (tr.x - tl.x) * (bl.y - tl.y) - (tr.y - tl.y) * (bl.x - tl.x);
    if (cross < 0) { var tmp = tr; tr = bl; bl = tmp; }

    var topLen = dist(tl, tr), leftLen = dist(tl, bl);
    var mod = (tl.mod + tr.mod + bl.mod) / 3;
    if (mod < 1) return '';
    var dimEst = Math.round(((topLen + leftLen) / 2) / mod) + 7;
    var ver = Math.round((dimEst - 17) / 4);
    // 版本 ±1 容错，再加上估算值优先
    var tryVers = [ver, ver - 1, ver + 1, ver + 2, ver - 2];
    var seen = {};
    for (var i = 0; i < tryVers.length; i++) {
      var v = tryVers[i];
      if (v < 0 || v > 9 || seen[v]) continue;
      seen[v] = 1;
      var got = this._sampleAndDecode(b, w, h, tl, tr, bl, 17 + v * 4, v);
      if (got) return got;
    }
    return '';
  },

  // 仿射采样成模块网格 → 读格式 → 去掩码 → 纠错反交织 → 解析字节
  // tl/tr/bl 是三个 finder 的**中心**像素坐标。finder 占 7 个模块（0..6），
  // 中心落在模块坐标 3.5 处；两个中心相距 (size-7) 个模块。
  //   P(col,row) = tl + ((col+0.5-3.5)/(size-7)) * (tr-tl)
  //                 + ((row+0.5-3.5)/(size-7)) * (bl-tl)
  // b 可以是 {bin,w,h} 对象，也可以直接是 Uint8Array（两者都兼容）
  _sampleAndDecode: function(b, w, h, tl, tr, bl, size, ver) {
    var bin = b && b.bin ? b.bin : b;
    var span = size - 7;
    var bits = new Array(size * size);
    for (var row = 0; row < size; row++) {
      for (var col = 0; col < size; col++) {
        var u = (col + 0.5 - 3.5) / span, v = (row + 0.5 - 3.5) / span;
        var x = tl.x + u * (tr.x - tl.x) + v * (bl.x - tl.x);
        var y = tl.y + u * (tr.y - tl.y) + v * (bl.y - tl.y);
        // 在模块中心附近取 3x3 多数投票，抗噪声
        var votes = 0;
        for (var ox = -1; ox <= 1; ox++) for (var oy = -1; oy <= 1; oy++) {
          votes += this._sample(bin, w, h, x + ox, y + oy);
        }
        bits[row * size + col] = votes >= 5 ? 1 : 0;
      }
    }
    // 格式信息两处冗余，任一能读出即可
    var fpos1 = [[8,0],[8,1],[8,2],[8,3],[8,4],[8,5],[8,7],[8,8],[7,8],[5,8],[4,8],[3,8],[2,8],[1,8],[0,8]];
    var fpos2 = [[size-1,8],[size-2,8],[size-3,8],[size-4,8],[size-5,8],[size-6,8],[size-7,8],[8,size-8],[8,size-7],[8,size-6],[8,size-5],[8,size-4],[8,size-3],[8,size-2],[8,size-1]];
    var seq1 = [], seq2 = [];
    for (var i = 0; i < 15; i++) {
      seq1.push(bits[fpos1[i][0] * size + fpos1[i][1]]);
      seq2.push(bits[fpos2[i][0] * size + fpos2[i][1]]);
    }
    var fmt = this._readFormat(function(i2) { return seq1[i2]; }) || this._readFormat(function(i3) { return seq2[i3]; });

    var masks = [];
    if (fmt) masks.push(fmt.mask);
    for (var mk = 0; mk < 8; mk++) if (masks.indexOf(mk) === -1) masks.push(mk);

    for (var mi = 0; mi < masks.length; mi++) {
      var mask = masks[mi];
      var raw = new Array(bits.length);
      for (var r = 0; r < size; r++) for (var c = 0; c < size; c++) {
        var val = bits[r * size + c];
        if (!this._isFunc(r, c, size, ver) && this._maskFn(mask, r, c)) val ^= 1;
        raw[r * size + c] = val;
      }
      var dataBits = this._decodeBits(raw, size, ver);
      var txt = this._parseBytes(this._readCodewords(dataBits, size, ver));
      if (txt) return txt;
    }
    return '';
  }
};

function _decodeQRFromCanvas(canvas, ctx) {
  try {
    if (typeof QRDecode === 'undefined') return '';
    var res = QRDecode.decode(canvas, ctx);
    return res || '';
  } catch (e) { return ''; }
}
