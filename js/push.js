// ==================== 消息推送（v118） ====================
// 能力边界（诚实说明）：
//   · 这是「本地通知」——App / 浏览器标签页开着的时候才会弹窗提醒（可以切到后台）。
//   · 完全关掉浏览器之后仍然收到，需要 Web Push + 推送服务器，目前没有做。
//   · iPhone 上 Safari 必须先「添加到主屏幕」，系统才允许网页发通知。
//   · 安卓 Chrome / 电脑浏览器 直接就能用。
var Push = {
  KEY_ENABLED: 'push_enabled',
  KEY_SOUND: 'push_sound',
  _ac: null,

  enabled: function() { return localStorage.getItem(this.KEY_ENABLED) === '1'; },
  soundOn: function() { return localStorage.getItem(this.KEY_SOUND) !== '0'; },
  supported: function() { return typeof Notification !== 'undefined'; },

  permission: function() {
    try { return this.supported() ? Notification.permission : 'unsupported'; } catch (e) { return 'unsupported'; }
  },

  // 状态文案（设置页用）
  statusText: function() {
    if (!this.supported()) return '这个浏览器不支持通知';
    if (!this.enabled()) return '已关闭';
    var p = this.permission();
    if (p === 'granted') return '已开启 · 收到新消息时提醒你';
    if (p === 'denied') return '被浏览器挡住了，点地址栏左边的锁图标可以改';
    return '等待浏览器授权';
  },

  // 请求权限：老 Safari 走回调，新浏览器走 Promise，两条路都兜住
  _ask: function(cb) {
    var done = false;
    function once(p) { if (done) return; done = true; cb(p || 'denied'); }
    try {
      var r = Notification.requestPermission(once);
      if (r && typeof r.then === 'function') r.then(once).catch(function() { once('denied'); });
    } catch (e) { once('denied'); }
  },

  // 由设置页按钮触发（必须是用户手势，否则浏览器直接拒绝）
  toggle: function() {
    var self = this;
    if (!this.supported()) { showToast('这个浏览器不支持通知，试试把网页添加到主屏幕', 2800); return; }
    if (this.enabled()) {
      localStorage.setItem(this.KEY_ENABLED, '0');
      this.refreshSetting(); showToast('已关闭新消息提醒');
      return;
    }
    this._ask(function(p) {
      if (p === 'granted') {
        localStorage.setItem(self.KEY_ENABLED, '1');
        self._unlockAudio();
        self.refreshSetting();
        showToast('通知已开启 🔔', 2000);
        self.notify('通知已开启 🔔', self._taName() + ' 发消息时，你就能收到提醒了', 'push-test');
      } else if (p === 'denied') {
        showToast('浏览器拒绝了通知权限，可在地址栏左边的锁图标里改', 3200);
        self.refreshSetting();
      } else {
        showToast('没有拿到通知权限', 2200);
        self.refreshSetting();
      }
    });
  },

  toggleSound: function() {
    localStorage.setItem(this.KEY_SOUND, this.soundOn() ? '0' : '1');
    this.refreshSetting();
    if (this.soundOn()) { this._unlockAudio(); this.beep(); }
    showToast(this.soundOn() ? '提示音已开启 🔊' : '提示音已关闭');
  },

  // 设置页那一行的文案刷新
  refreshSetting: function() {
    var el = document.getElementById('setting-push-desc');
    if (el) el.textContent = this.statusText();
    var b = document.getElementById('setting-push-btn');
    if (b) b.textContent = this.enabled() ? '关闭' : '开启';
    var s = document.getElementById('setting-push-sound');
    if (s) s.textContent = this.soundOn() ? '提示音 开 🔊' : '提示音 关 🔇';
  },

  // ============ 对外：提醒 ============

  // 新消息（文字 / 涂鸦）
  onNewMessage: function(msg) {
    if (!msg) return;
    var pn = this._taName();
    var body;
    if (msg.type === 'doodle') body = '🎨 发来一幅涂鸦';
    else {
      body = String(msg.text || '').replace(/\s+/g, ' ').slice(0, 40);
      if (!body) body = '发来一条消息';
    }
    this.notify(pn + ' 发来消息', body, 'msg-' + (msg.id || ''), false);
  },

  // TA 更新了心情
  onMood: function(status) {
    var c = (typeof MOOD_CONFIG !== 'undefined' && MOOD_CONFIG[status]) || null;
    this.notify(this._taName() + ' 的心情更新了 ' + (c ? c.icon + ' ' + c.label : ''), '点开看看 TA 今天怎么样', 'mood-' + (status || ''), false);
  },

  // TA 答了今天的每日一题
  onDaily: function() {
    this.notify(this._taName() + ' 答完了今天的题 💭', '看看 TA 怎么回答的', 'daily', false);
  },

  // 想你了（v122）：人不在页面上时收到信号 —— 标题固定，正文用 TA 的昵称
  // isReply=true 表示这是对方对我「想你了」的回应
  onPing: function(isReply) {
    var pn = this._taName();
    this.notify('你的专属提醒', isReply ? (pn + ' 也想你了') : (pn + ' 想你了'), 'ping-' + Date.now(), false);
  },

  // 时光胶囊相关
  onCapsule: function(text, body) {
    this.notify(text, body, 'capsule-' + Date.now(), false);
  },

  // ============ 底层 ============

  // ignoreVisible=true 表示即使是用户正在看着也弹（测试用）
  notify: function(title, body, tag, ignoreVisible) {
    if (!this.enabled()) return;
    if (!ignoreVisible && document.visibilityState === 'visible') return; // 正在看就不打扰
    if (this.permission() !== 'granted') return;
    this._show(title, body, tag, ignoreVisible);
    if (this.soundOn()) this.beep();
  },

  _show: function(title, body, tag, force) {
    if (!force && document.visibilityState === 'visible') return;
    try {
      var opt = { body: body || '', tag: tag || 'baby-time', renotify: false };
      var n = new Notification(title, opt);
      n.onclick = function() {
        try { window.focus(); } catch (e) {}
        try { n.close(); } catch (e) {}
        // v122：点开通知回到页面后，把刚才那次心跳补上（后台只发了通知，动画还没跳）
        setTimeout(function() { if (typeof Crane !== 'undefined') Crane.playPending(); }, 400);
      };
      setTimeout(function() { try { n.close(); } catch (e) {} }, 12000);
    } catch (e) { /* 部分浏览器必须用 ServiceWorkerRegistration.showNotification，静默跳过 */ }
  },

  _taName: function() {
    try { return localStorage.getItem('sync_partnerName') || 'TA'; } catch (e) { return 'TA'; }
  },

  // 提示音：用 WebAudio 现场合成，不依赖任何音频文件
  _unlockAudio: function() {
    try {
      if (!this._ac) {
        var AC = window.AudioContext || window.webkitAudioContext;
        if (AC) this._ac = new AC();
      }
      if (this._ac && this._ac.state === 'suspended') this._ac.resume();
    } catch (e) {}
  },

  beep: function() {
    if (!this.soundOn()) return;
    try {
      this._unlockAudio();
      var ac = this._ac; if (!ac) return;
      var now = ac.currentTime;
      // 两声轻快的「叮」，比单音更明显但不刺耳
      for (var i = 0; i < 2; i++) {
        var t0 = now + i * 0.13;
        var o = ac.createOscillator(), g = ac.createGain();
        o.type = 'sine';
        o.frequency.setValueAtTime(i === 0 ? 880 : 1174, t0);
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(0.12, t0 + 0.012);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.16);
        o.connect(g); g.connect(ac.destination);
        o.start(t0); o.stop(t0 + 0.18);
      }
    } catch (e) {}
  },

  init: function() {
    this.refreshSetting();
    // 首次交互时解锁音频上下文（浏览器要求音频必须由用户手势启动）
    var self = this;
    var once = function() {
      self._unlockAudio();
      document.removeEventListener('click', once);
      document.removeEventListener('touchstart', once);
    };
    document.addEventListener('click', once);
    document.addEventListener('touchstart', once);
  }
};
