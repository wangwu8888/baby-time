// ==================== 时光胶囊（v118） ====================
// 写一封信封存起来，到约定的那天才能打开。
// 复用 messages 表（type='capsule'），内容按房间密钥加密后存储——不在房间里的任何人都读不到。
//
// 说明：这是「两个人的温柔约定」，不是密码锁——解锁前界面不会展示原文，
// 但你和 TA 作为房间成员都能解开这段密文。想防的是「路过的人」和「数据库里的陌生人」。
var Capsule = {
  KEY: 'capsules',
  _open: false,          // 写信表单是否展开
  _notified: {},         // 本次会话内已提醒过的解锁

  // ---------- 工具 ----------
  _today: function() { return Daily._key(); },
  _days: function(openAt) {
    var t = new Date(this._today() + 'T00:00:00');
    var d = new Date(openAt + 'T00:00:00');
    return Math.round((d - t) / 86400000);
  },
  _addMonths: function(n) {
    var d = new Date();
    d.setMonth(d.getMonth() + n);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  },

  // ---------- 本地数据 ----------
  _all: function() {
    try { return JSON.parse(localStorage.getItem(this.KEY) || '[]') || []; } catch (e) { return []; }
  },
  _setAll: function(a) { try { localStorage.setItem(this.KEY, JSON.stringify(a)) } catch (e) {} },
  _find: function(cid) {
    var a = this._all();
    for (var i = 0; i < a.length; i++) { if (String(a[i].cid) === String(cid)) return a[i]; }
    return null;
  },

  // ---------- 封一个 ----------
  toggleForm: function() { this._open = !this._open; this.render(); },

  create: function(text, openAt) {
    text = (text || '').trim();
    if (!text) { showToast('给未来的 TA 写点什么吧'); return; }
    if (!openAt) { showToast('选一个解锁日期'); return; }
    if (this._days(openAt) <= 0) { showToast('解锁日期要选将来的日子'); return; }
    if (typeof Sync === 'undefined' || !Sync.roomId || !Sync.partnerId) { showToast('先和 TA 连接上再封存吧'); return; }
    var cid = generateId();
    var rec = { cid: cid, text: text, openAt: openAt, createdAt: new Date().toISOString(), author: 'me', opened: false, openedAt: null };
    var a = this._all(); a.unshift(rec); this._setAll(a);
    Sync.sendCapsuleAdd(cid, openAt, text);
    this._open = false;
    this.render();
    showToast('已封存 🔒 到 ' + openAt + ' 才能打开', 2600);
  },

  // ---------- 打开 ----------
  openIt: function(cid) {
    var c = this._find(cid); if (!c) return;
    if (this._days(c.openAt) > 0) { showToast('还没到打开的日子，再等等 🌙'); return; }
    if (c.opened) return;
    var self = this;
    var a = this._all();
    for (var i = 0; i < a.length; i++) {
      if (String(a[i].cid) === String(cid)) { a[i].opened = true; a[i].openedAt = new Date().toISOString(); }
    }
    self._setAll(a);
    if (typeof Sync !== 'undefined' && Sync.roomId && Sync.partnerId) Sync.sendCapsuleOpen(cid);
    showToast('打开了 💌', 1800);
    self._reveal(c.text, c.createdAt, c.openAt);
    self.render();
  },

  _reveal: function(text, createdAt, openAt) {
    var self = this;
    var d = document.createElement('div');
    d.className = 'modal';
    d.style.display = 'flex';
    d.innerHTML = '<div class="modal-backdrop" style="position:fixed"></div><div class="modal-card">' +
      '<h3>💌 来自过去的信</h3>' +
      '<div style="font-size:36px;text-align:center">📦</div>' +
      '<div style="font-size:12px;color:var(--text-dim);text-align:center">封于 ' + escapeHtml(formatDate(createdAt)) + ' · 今天开启</div>' +
      '<div class="capsule-letter">' + escapeHtml(text).replace(/\n/g, '<br>') + '</div>' +
      '<button class="btn-secondary btn-full" style="margin-top:12px">收好它</button></div>';
    document.body.appendChild(d);
    d.querySelector('button').addEventListener('click', function() { d.remove(); });
    d.querySelector('.modal-backdrop').addEventListener('click', function() { d.remove(); });
  },

  del: function(cid) {
    var c = this._find(cid); if (!c) return;
    if (c.author !== 'me') { showToast('只能删掉自己封的那个'); return; }
    if (!confirm('删除这个胶囊？双方都会看不到')) return;
    var a = this._all(), out = [];
    for (var i = 0; i < a.length; i++) { if (String(a[i].cid) !== String(cid)) out.push(a[i]); }
    this._setAll(out);
    if (typeof Sync !== 'undefined' && Sync.roomId && Sync.partnerId) Sync.sendCapsuleDel(cid);
    this.render();
    showToast('已删除');
  },

  // ---------- 收到 TA 的动作 ----------
  applyRemote: function(c, senderId) {
    if (!c || !c.cid) return;
    var a = this._all(), idx = -1;
    for (var i = 0; i < a.length; i++) { if (String(a[i].cid) === String(c.cid)) { idx = i; break; } }

    if (c.action === 'add') {
      if (idx >= 0) return;                        // 已存在，幂等
      a.unshift({ cid: c.cid, text: c.text || '', openAt: c.openAt, createdAt: c.at || new Date().toISOString(), author: 'ta', opened: false, openedAt: null });
      this._setAll(a); this.render();
      if (typeof Push !== 'undefined') Push.onCapsule('📦 TA 封了一个时光胶囊', '写着「到 ' + (c.openAt || '') + ' 才能打开」');
    } else if (c.action === 'del') {
      if (idx < 0) return;
      a.splice(idx, 1); this._setAll(a); this.render();
    } else if (c.action === 'open') {
      if (idx < 0) return;
      if (!a[idx].opened) { a[idx].opened = true; a[idx].openedAt = c.at || new Date().toISOString(); this._setAll(a); this.render(); }
    }
  },

  // ---------- 到点提醒 ----------
  checkUnlocks: function() {
    var a = this._all(), hit = 0;
    for (var i = 0; i < a.length; i++) {
      if (a[i].opened) continue;
      if (this._days(a[i].openAt) > 0) continue;
      if (this._notified[a[i].cid]) continue;
      this._notified[a[i].cid] = 1;
      hit++;
    }
    if (!hit) return;
    var who = '有一个时光胶囊可以打开了 🔓';
    if (hit > 1) who = '有 ' + hit + ' 个时光胶囊可以打开了 🔓';
    showToast(who + '，去树洞看看', 3200);
    if (typeof Push !== 'undefined') Push.onCapsule('🔓 时光胶囊到时间了', '去树洞把它打开吧');
    this.render();
  },

  // ---------- 界面 ----------
  render: function() {
    var el = document.getElementById('capsule-section');
    if (!el) return;
    var a = this._all();
    var paired = (typeof Sync !== 'undefined' && !!Sync.partnerId);
    var pn = localStorage.getItem('sync_partnerName') || 'TA';
    var self = this;

    var sealed = 0, ready = 0;
    for (var i = 0; i < a.length; i++) {
      if (a[i].opened) continue;
      if (this._days(a[i].openAt) > 0) sealed++; else ready++;
    }

    var html = '<div class="card">';
    html += '<div class="daily-head"><div class="card-title" style="margin:0">📦 时光胶囊' +
      (sealed ? ' <span class="daily-streak">封存中 ' + sealed + '</span>' : '') +
      (ready ? ' <span class="daily-streak ready">可打开 ' + ready + '</span>' : '') + '</div>' +
      '<button class="btn-text" onclick="Capsule.toggleForm()">' + (this._open ? '收起' : '+ 封一个') + '</button></div>';

    if (this._open) {
      html += '<div class="capsule-form">';
      html += '<textarea id="capsule-text" class="entry-textarea" rows="4" placeholder="写给未来的 ' + escapeHtml(pn) + '，或者写给未来的你们…"></textarea>';
      html += '<div class="capsule-presets">' +
        '<button class="chip" onclick="Capsule._preset(1)">1 个月后</button>' +
        '<button class="chip" onclick="Capsule._preset(3)">3 个月后</button>' +
        '<button class="chip" onclick="Capsule._preset(12)">1 年后</button>' +
        '<button class="chip" onclick="Capsule._preset(0)">自定义</button></div>';
      html += '<div class="capsule-date-row"><span>解锁日</span><input type="date" id="capsule-date" class="capsule-date" value="' + this._addMonths(12) + '"></div>';
      html += '<div style="text-align:right;margin-top:8px"><button class="btn-primary" onclick="Capsule.create(document.getElementById(\'capsule-text\').value, document.getElementById(\'capsule-date\').value)">封存 🔒</button></div>';
      html += '</div>';
    }

    if (!a.length) {
      html += '<p class="empty-hint">' + (paired ? '还没有胶囊，封一句给未来的话吧' : '和 TA 连接后就能一起封存胶囊') + '</p>';
    } else {
      a.sort(function(x, y) { return new Date(y.createdAt) - new Date(x.createdAt); });
      for (var j = 0; j < a.length; j++) {
        var c = a[j];
        var dleft = this._days(c.openAt);
        var who = c.author === 'me' ? '我' : escapeHtml(pn);
        var canOpen = dleft <= 0;
        html += '<div class="capsule-item' + (c.opened ? ' opened' : '') + (canOpen && !c.opened ? ' ready' : '') + '">';
        html += '<div class="capsule-item-head">';
        html += '<span class="capsule-ico">' + (c.opened ? '💌' : (canOpen ? '🔓' : '🔒')) + '</span>';
        html += '<div class="capsule-meta"><div class="capsule-title">' +
          (c.opened ? '已打开' : (canOpen ? '可以打开了' : '还有 ' + dleft + ' 天')) + '</div>' +
          '<div class="capsule-sub">' + who + '封于 ' + escapeHtml(formatDate(c.createdAt)) + ' · 解锁日 ' + escapeHtml(c.openAt) + '</div></div>';
        if (c.author === 'me' && !c.opened) html += '<button class="btn-text btn-danger capsule-del" onclick="Capsule.del(\'' + c.cid + '\')">删</button>';
        html += '</div>';
        if (c.opened) {
          html += '<div class="capsule-text-open">' + escapeHtml(c.text || '').replace(/\n/g, '<br>') + '</div>';
        } else if (canOpen) {
          html += '<button class="btn-primary capsule-open-btn" onclick="Capsule.openIt(\'' + c.cid + '\')">打开它 💌</button>';
        } else {
          html += '<div class="capsule-locked-hint">时间到了才会显示内容</div>';
        }
        html += '</div>';
      }
    }
    html += '<div class="capsule-foot">🔒 只有你们两个人能打开</div>';
    html += '</div>';
    el.innerHTML = html;
  },

  _preset: function(months) {
    var d = document.getElementById('capsule-date');
    if (!d) return;
    if (months === 0) { try { d.showPicker && d.showPicker(); } catch (e) { d.focus(); } return; }
    d.value = this._addMonths(months);
    showToast('解锁日已设为 ' + d.value, 1600);
  },

  init: function() { this.render(); var self = this; setTimeout(function() { self.checkUnlocks(); }, 1200); }
};
