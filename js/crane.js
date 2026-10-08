// ==================== 想你了（v122：即时信号，不是计数器） ====================
// 旧版「思念瓶」是积累型设计：玻璃罐 + 一堆心 + 「我 0 · TA 1」的计数，具象又笨重。
// v122 推翻重做 —— 它是一句「我想你了」，不是账本：
//   我按下按钮 → TA 手机上 1~2 秒内浮出一颗缓慢跳动的心（+ 轻震一次 + 一行小字）。
//
// 通道仍是 messages 表 type='crane'（早就上了 RLS），不新增表、不用跑 SQL。
// 内容协议：{ action: 'ping' | 'reply', at: ISO }
//   ping  = 我想你了    → TA 看到心跳浮层 + 「我也想你了」按钮
//   reply = 我也想你了  → 我这边只再跳一次心（不再弹按钮，否则会无限来回）
//
// 关于「实时」：这个项目没有 WebSocket，用的是 1.5 秒一次的轮询，
// 所以信号会在 1~2 秒内到达，不是科技意义上的毫秒级，但用起来就是「立刻」。
var Crane = {
  HOLD_MS: 5200,      // 浮层停留时长（心跳 4 次 × 1.2s + 余量）
  FADE_MS: 600,       // 淡出时长
  COOLDOWN_MS: 900,   // 连点冷却
  STALE_MS: 4000,     // 早于「打开页面时间」这么多毫秒的旧信号只记账、不播放
  PENDING_MAX: 300000,// 后台攒下的信号最多保留 5 分钟

  _seen: {},
  _liveSince: 0,
  _sending: false,
  _hideTimer: null,
  _closeTimer: null,
  _fadeTimer: null,

  // 对方昵称：一律动态读，绝不写死「TA」
  _pn: function() {
    try { return localStorage.getItem('sync_partnerName') || 'TA'; } catch (e) { return 'TA'; }
  },

  init: function() {
    if (!this._liveSince) this._liveSince = Date.now();
    if (!this._visBound) { this._bindVisibility(); this._visBound = true; }
    this.render();
  },

  // 卡片：一张纯白圆角卡，中间一个描边胶囊按钮 + 一颗小心（v123 去掉了原先的实心大圆）
  render: function() {
    var el = document.getElementById('crane-jar-card');
    if (!el) return;
    if (typeof Sync === 'undefined' || !Sync.partnerId) { el.style.display = 'none'; return; }
    el.style.display = '';
    el.innerHTML =
      '<div class="cn-card">' +
        '<button class="cn-btn" id="cn-btn" onclick="Crane.send()">' +
          '<span class="cn-btn-ic">' + this._heart(15) + '</span><span>想你了</span>' +
        '</button>' +
        '<div class="cn-hint" id="cn-hint"></div>' +
        '<div class="cn-foot">点击，让 ' + escapeHtml(this._pn()) + ' 立刻知道</div>' +
      '</div>';
  },

  // 小心形图标：与浮层那颗心同一份 path，尺寸可传（用 currentColor 跟随文字颜色）
  _heart: function(size) {
    return '<svg viewBox="0 0 24 22.5" aria-hidden="true" focusable="false" style="width:' + size +
      'px;height:' + Math.round(size * 0.94) + 'px;display:block">' +
      '<path d="M12 20.35l-1.45-1.32C5.4 14.36 2 11.28 2 7.5 2 4.42 4.42 2 7.5 2c1.74 0 3.41.81 4.5 2.09C13.09 2.81 14.76 2 16.5 2 19.58 2 22 4.42 22 7.5c0 3.78-3.4 6.86-8.55 11.54L12 20.35z" fill="currentColor"/></svg>';
  },

  // ---------- 发送方 ----------
  send: function() {
    if (this._sending) return;
    if (typeof Sync === 'undefined' || !Sync.roomId || !Sync.partnerId) {
      showToast('先和 ' + this._pn() + ' 连接上再发吧');
      return;
    }
    this._sending = true;

    var ok = false;
    try { ok = Sync.sendCranePing('ping') !== false; } catch (e) { ok = false; }

    // 按钮：先缩到 0.9 再弹回 1.0（spring 缓动，见 .cn-tapped）
    var btn = document.getElementById('cn-btn');
    if (btn && btn.classList) {
      btn.classList.remove('cn-tapped');
      void btn.offsetWidth;                    // 强制重排，让动画能重复触发
      btn.classList.add('cn-tapped');
    }
    this._flashHint(ok ? '已送达' : '没发出去，再试一次');
    this._buzz(10);                            // 轻微震动一次，不连续
    var self = this;
    setTimeout(function() { self._sending = false; }, this.COOLDOWN_MS);
  },

  // 「已送达」浮现 → 2 秒后淡出
  _flashHint: function(txt) {
    var h = document.getElementById('cn-hint');
    if (!h) return;
    h.textContent = txt;
    if (h.classList) h.classList.add('show');
    clearTimeout(this._hideTimer);
    this._hideTimer = setTimeout(function() { if (h.classList) h.classList.remove('show'); }, 2000);
  },

  // iOS Safari 不支持 vibrate，静默跳过；安卓 Chrome 可以
  _buzz: function(ms) {
    try { if (navigator.vibrate) navigator.vibrate(ms || 10); } catch (e) {}
  },

  // ---------- 接收方：信号到达 ----------
  onTaPing: function(action, msgId, at) {
    if (action !== 'ping' && action !== 'reply') return;   // 旧版 add/clear 消息一律忽略
    if (msgId && this._seen[msgId]) return;
    if (msgId) { this._seen[msgId] = 1; this._trimSeen(); }

    // 刚打开页面时，200 条历史里的旧信号只记账不播放，否则一进页面就乱跳
    var t = at ? new Date(at).getTime() : 0;
    if (!t || t < this._liveSince - this.STALE_MS) return;

    if (document.hidden) {
      // 人不在页面上 → 系统通知；等回到页面（或点通知）再补播心跳
      try { localStorage.setItem('crane_pending_ping', String(Date.now())); } catch (e) {}
      if (typeof Push !== 'undefined') Push.onPing(action === 'reply');
      return;
    }
    this.showOverlay(action === 'reply');
  },

  // ---------- 前台心跳浮层 ----------
  showOverlay: function(isReply) {
    var ov = document.getElementById('ping-overlay');
    if (!ov) return;
    var self = this, pn = this._pn();

    var txt = document.getElementById('ping-text');
    if (txt) txt.textContent = isReply ? (pn + ' 也想你了') : (pn + ' 刚刚想你了');

    var btn = document.getElementById('ping-reply');
    if (btn) {
      btn.textContent = '我也想你了';
      if (btn.classList) btn.classList.remove('done');
      btn.style.display = isReply ? 'none' : '';   // 回应类信号不再给按钮，避免无限来回
    }

    if (ov.classList) {
      ov.classList.remove('hidden', 'cn-out', 'cn-play');
      void ov.offsetWidth;                          // 重置动画，让心跳从头跳
      ov.classList.add('cn-play');
    }
    this._buzz(10);                                 // 出现瞬间震一下，只一次

    clearTimeout(this._closeTimer);
    this._closeTimer = setTimeout(function() { self.hideOverlay(); }, this.HOLD_MS);
  },

  hideOverlay: function() {
    var ov = document.getElementById('ping-overlay');
    if (!ov || !ov.classList) return;
    clearTimeout(this._closeTimer);
    ov.classList.add('cn-out');
    clearTimeout(this._fadeTimer);
    this._fadeTimer = setTimeout(function() {
      ov.classList.add('hidden');
      ov.classList.remove('cn-play', 'cn-out');
    }, this.FADE_MS);
  },

  // 点「我也想你了」：按钮变「已回应」，并回一个心跳给发起方（双向共振）
  reply: function(ev) {
    if (ev && ev.stopPropagation) ev.stopPropagation();   // 别让点击穿透到浮层去关闭它
    var btn = document.getElementById('ping-reply');
    if (btn) {
      btn.textContent = '已回应';
      if (btn.classList) btn.classList.add('done');
    }
    try { if (typeof Sync !== 'undefined') Sync.sendCranePing('reply'); } catch (e) {}
    this._buzz(10);
  },

  // ---------- 后台攒下的信号：回到前台补播 ----------
  playPending: function() {
    var raw = null;
    try { raw = localStorage.getItem('crane_pending_ping'); } catch (e) {}
    if (!raw) return;
    var t = parseInt(raw, 10) || 0;
    try { localStorage.removeItem('crane_pending_ping'); } catch (e) {}
    if (!t || Date.now() - t > this.PENDING_MAX) return;
    if (document.hidden) return;
    this.showOverlay(false);
  },

  _bindVisibility: function() {
    var self = this;
    document.addEventListener('visibilitychange', function() {
      if (!document.hidden) self.playPending();
    });
  },

  _trimSeen: function() {
    var keys = Object.keys(this._seen);
    if (keys.length > 200) { for (var i = 0; i < 100; i++) delete this._seen[keys[i]]; }
  }
};
