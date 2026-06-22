// 涂鸦画布组件
export var DoodleCanvas = {
  _canvas: null, _ctx: null, _drawing: false,
  _color: '#E57373', _size: 6, _bg: '#F5F0EB', _eraser: false,
  _lx: 0, _ly: 0, _mode: null, _cb: null,

  open: function(mode, callback) {
    this._mode = mode;
    this._cb = callback;
    this._show();
  },

  _show: function() {
    var existing = document.getElementById('doodle-overlay');
    if (existing) existing.remove();

    var el = document.createElement('div');
    el.id = 'doodle-overlay';
    el.style.cssText = 'position:fixed;inset:0;z-index:200;background:var(--bg);display:flex;flex-direction:column';
    el.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:var(--card);border-bottom:1px solid var(--border);flex-shrink:0">
        <button class="btn-icon" id="doodle-cancel">✕</button>
        <span style="font-size:16px;font-weight:600">情绪涂鸦</span>
        <button class="btn-primary" id="doodle-save" style="padding:6px 16px;font-size:14px">✓ 完成</button>
      </div>
      <div id="doodle-colors" style="display:flex;gap:6px;padding:10px 12px;justify-content:center;flex-shrink:0">
        ${['#E57373','#FFB74D','#FFF176','#81C784','#64B5F6','#9575CD','#424242','#FAFAFA'].map(function(c,i){ return '<button class="color-btn'+(i===0?' active':'')+'" data-color="'+c+'" style="width:28px;height:28px;border-radius:50%;border:2px solid transparent;background:'+c+(c==='#FAFAFA'?';border-color:#ddd':'')+'"></button>'; }).join('')}
      </div>
      <canvas id="doodle-canvas" style="flex:1;width:100%;touch-action:none;cursor:crosshair"></canvas>
      <div style="display:flex;align-items:center;gap:8px;padding:10px 12px;background:var(--card);border-top:1px solid var(--border);flex-shrink:0;justify-content:center;flex-wrap:wrap">
        ${[3,6,12].map(function(s,i){ return '<button class="size-btn'+(i===1?' active':'')+'" data-size="'+s+'" style="width:30px;height:30px;border-radius:50%;border:2px solid var(--border);background:var(--card)"><span style="display:inline-block;width:'+(s+4)+'px;height:'+(s+4)+'px;background:var(--text);border-radius:50%"></span></button>'; }).join('')}
        <button class="btn-secondary" id="doodle-eraser" style="font-size:13px;padding:6px 12px">🧹 橡皮</button>
        <button class="btn-secondary" id="doodle-clear" style="font-size:13px;padding:6px 12px">🗑️ 清空</button>
      </div>
    `;
    document.body.appendChild(el);

    this._init(el);
  },

  _init: function(el) {
    var self = this;
    this._canvas = el.querySelector('#doodle-canvas');
    this._ctx = this._canvas.getContext('2d');
    this._resize();

    // 颜色
    el.querySelectorAll('.color-btn').forEach(function(b) {
      b.addEventListener('click', function() {
        self._color = this.dataset.color; self._eraser = false;
        el.querySelectorAll('.color-btn').forEach(function(x) { x.style.borderColor = 'transparent'; });
        this.style.borderColor = 'var(--text)';
      });
    });
    // 笔刷大小
    el.querySelectorAll('.size-btn').forEach(function(b) {
      b.addEventListener('click', function() {
        self._size = parseInt(this.dataset.size);
        el.querySelectorAll('.size-btn').forEach(function(x) { x.style.borderColor = 'var(--border)'; });
        this.style.borderColor = 'var(--primary)';
      });
    });
    // 橡皮
    el.querySelector('#doodle-eraser').addEventListener('click', function() {
      self._eraser = !self._eraser; this.style.background = self._eraser ? 'var(--primary-dim)' : '';
    });
    // 清空
    el.querySelector('#doodle-clear').addEventListener('click', function() {
      if (confirm('确定清空？')) { self._ctx.fillStyle = self._bg; self._ctx.fillRect(0, 0, self._canvas.width, self._canvas.height); }
    });
    // 取消
    el.querySelector('#doodle-cancel').addEventListener('click', function() { el.remove(); });
    // 保存
    el.querySelector('#doodle-save').addEventListener('click', function() {
      var data = self._compress();
      el.remove();
      if (self._cb) self._cb(data);
    });

    // 触摸/鼠标事件
    var c = this._canvas;
    c.addEventListener('mousedown', function(e) { self._start(e); });
    c.addEventListener('mousemove', function(e) { self._move(e); });
    c.addEventListener('mouseup', function() { self._drawing = false; });
    c.addEventListener('mouseleave', function() { self._drawing = false; });
    c.addEventListener('touchstart', function(e) { e.preventDefault(); self._start(e.touches[0]); });
    c.addEventListener('touchmove', function(e) { e.preventDefault(); self._move(e.touches[0]); });
    c.addEventListener('touchend', function(e) { e.preventDefault(); self._drawing = false; });
  },

  _resize: function() {
    var r = this._canvas.parentElement.getBoundingClientRect();
    this._canvas.width = r.width;
    this._canvas.height = Math.max(r.height - 158, 200);
    this._ctx.fillStyle = this._bg;
    this._ctx.fillRect(0, 0, this._canvas.width, this._canvas.height);
    this._ctx.lineCap = 'round';
    this._ctx.lineJoin = 'round';
  },

  _pos: function(e) {
    var r = this._canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  },

  _start: function(e) {
    this._drawing = true;
    var p = this._pos(e);
    this._lx = p.x; this._ly = p.y;
    this._ctx.beginPath();
    this._ctx.strokeStyle = this._eraser ? this._bg : this._color;
    this._ctx.lineWidth = this._eraser ? this._size * 3 : this._size;
    this._ctx.moveTo(this._lx, this._ly);
    this._ctx.lineTo(this._lx + 0.1, this._ly + 0.1);
    this._ctx.stroke();
  },

  _move: function(e) {
    if (!this._drawing) return;
    var p = this._pos(e);
    this._ctx.beginPath();
    this._ctx.strokeStyle = this._eraser ? this._bg : this._color;
    this._ctx.lineWidth = this._eraser ? this._size * 3 : this._size;
    this._ctx.moveTo(this._lx, this._ly);
    this._ctx.lineTo(p.x, p.y);
    this._ctx.stroke();
    this._lx = p.x; this._ly = p.y;
  },

  _compress: function() {
    var cw = this._canvas.width, ch = this._canvas.height;
    var maxW = 400, w = cw, h = ch;
    if (w > maxW) { h = Math.round(h * maxW / w); w = maxW; }
    var tmp = document.createElement('canvas');
    tmp.width = w; tmp.height = h;
    var tc = tmp.getContext('2d');
    tc.drawImage(this._canvas, 0, 0, w, h);
    return tmp.toDataURL('image/jpeg', 0.65);
  }
};
