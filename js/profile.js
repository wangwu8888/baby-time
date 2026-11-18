// Profile v128 —— 账号个人资料：自己的昵称 + 头像（对方可见）
// 昵称存 users.nickname，头像存 users.avatar；本地缓存加速显示。
// 头像支持：预设 emoji（默认，离线可用）或相册上传（canvas 压缩后存云端）。
var Profile = {
  EMOJIS: ['🐱', '🐶', '🐰', '🐻', '🐼', '🦊', '🌸', '🌙', '⭐', '🍀', '🌈', '🍓'],

  // ---------- 本地读写 ----------
  getName: function() {
    try { return localStorage.getItem('my_nickname') || ''; } catch (e) { return ''; }
  },
  getAvatar: function() {
    try { return localStorage.getItem('my_avatar') || ''; } catch (e) { return ''; }
  },
  getPartnerName: function() {
    try { return localStorage.getItem('sync_partnerName') || 'TA'; } catch (e) { return 'TA'; }
  },
  getPartnerAvatar: function() {
    try { return localStorage.getItem('sync_partnerAvatar') || ''; } catch (e) { return ''; }
  },
  _defaultEmoji: function(seed) {
    var h = 0, s = String(seed || Profile.getPartnerName() || 'TA');
    for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return Profile.EMOJIS[h % Profile.EMOJIS.length];
  },

  // 生成圆形头像 HTML。avatar 为空时按 name 取一个稳定的 emoji。
  // online: true=绿点 / false=灰点 / null|undefined=不显示状态点。
  avatarHTML: function(avatar, name, cls, online) {
    cls = cls || '';
    var a = avatar || Profile._defaultEmoji(name);
    var isImg = /^data:image\//.test(a);
    var inner = isImg
      ? '<img src="' + a + '" alt="">'
      : '<span class="pf-emoji">' + String(a).replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</span>';
    var av = '<span class="pf-avatar ' + cls + '">' + inner + '</span>';
    // 状态点放在外层 wrapper：pf-avatar 有 overflow:hidden（裁圆形），
    // 绿点必须是它的兄弟节点才不会被裁掉。
    if (online === true || online === false) {
      return '<span class="pf-wrap">' + av +
        '<span class="pf-online' + (online ? ' on' : '') + '" title="' + (online ? '在线' : '离线') + '"></span></span>';
    }
    return av;
  },

  // ---------- 云端同步 ----------
  // 先查 users 行：没有就创建（带上昵称头像），有就分别 PATCH。
  // 分开 PATCH 的好处：即使 avatar 列还没建（用户没跑 SQL），昵称也能先存下来。
  sync: function(cb) {
    var uid = (typeof Sync !== 'undefined' && Sync.userId) || localStorage.getItem('sync_userId');
    if (!uid || typeof SUPABASE === 'undefined') { cb && cb(false); return; }
    var name = Profile.getName();
    var avatar = Profile.getAvatar();

    SUPABASE.get('users', 'user_id=eq.' + encodeURIComponent(uid) + '&select=user_id&limit=1',
      function(rows) {
        if (!rows || !rows.length) {
          // 新账号：users 行还不存在，整行创建
          SUPABASE.post('users', { user_id: uid, nickname: name || '我', avatar: avatar || '' },
            function(data, err) { cb && cb(!err); });
          return;
        }
        // 已有行：逐字段更新
        var sent = 0, total = 0, okAll = true;
        function done() { if (++sent === total) { cb && cb(okAll); } }
        if (name) {
          total++;
          SUPABASE.patch('users', 'user_id=eq.' + encodeURIComponent(uid),
            { nickname: name }, function(data, err) { if (err) okAll = false; done(); });
        }
        if (avatar) {
          total++;
          SUPABASE.patch('users', 'user_id=eq.' + encodeURIComponent(uid),
            { avatar: avatar }, function(data, err) { if (err) okAll = false; done(); });
        }
        if (!total) { cb && cb(true); }
      });
  },

  // 从 users 表读对方的头像（昵称已在 sync.js 的轮询里读）
  loadPartnerAvatar: function(partnerId, cb) {
    if (!partnerId || typeof SUPABASE === 'undefined') { cb && cb(''); return; }
    SUPABASE.get('users', 'user_id=eq.' + encodeURIComponent(partnerId) + '&select=avatar&limit=1',
      function(rows) {
        var av = (rows && rows.length && rows[0].avatar) || '';
        try { localStorage.setItem('sync_partnerAvatar', av); } catch (e) {}
        cb && cb(av);
      });
  },

  // ---------- 保存资料 ----------
  save: function(name, avatar, cb) {
    name = (name || '').trim().slice(0, 16);
    if (!name) { showToast('给我起个昵称吧', 1500); cb && cb(false); return; }
    try {
      localStorage.setItem('my_nickname', name);
      localStorage.setItem('my_avatar', avatar || '');
      localStorage.removeItem('profile_skipped');
    } catch (e) {}
    // 本地即时生效：所有用到昵称的地方重画
    if (typeof Sync !== 'undefined') Sync.partnerName = Sync.partnerName; // no-op，保持引用
    Profile.refreshUI();
    Profile.sync(function() {
      showToast('资料已保存', 1800);
      cb && cb(true);
    });
  },

  refreshUI: function() {
    Profile.renderCard();
    if (typeof App !== 'undefined' && App._loadMembers) App._loadMembers();
    if (typeof Weather !== 'undefined') {
      if (Weather.refresh) Weather.refresh();
      // v128: 聊天时间线也要重画，否则改完头像聊天气泡旁还是旧的
      if (Weather.renderTimeline) Weather.renderTimeline();
    }
    if (typeof TreeHole !== 'undefined' && TreeHole.refresh) TreeHole.refresh();
  },

  // ---------- 设置页"我的资料"卡片 ----------
  renderCard: function() {
    var el = document.getElementById('profile-section');
    if (!el) return;
    var name = Profile.getName();
    var email = (function() { try { return localStorage.getItem('account_email') || ''; } catch (e) { return ''; } })();
    var avatar = Profile.getAvatar();
    el.innerHTML =
      '<div class="card profile-card">' +
        '<div class="profile-card-main">' +
          Profile.avatarHTML(avatar, name || '我', 'pf-lg') +
          '<div class="profile-card-info">' +
            '<div class="profile-card-name">' + (name ? String(name).replace(/</g, '&lt;') : '还没起昵称') + '</div>' +
            '<div class="profile-card-mail">' + String(email).replace(/</g, '&lt;') + '</div>' +
          '</div>' +
          '<button class="btn-text" onclick="Profile.openEditor()">编辑</button>' +
        '</div>' +
      '</div>';
  },

  // ---------- 编辑弹窗 ----------
  _editingAvatar: '',

  openEditor: function(onboarding) {
    var self = this;
    this._editingAvatar = this.getAvatar();
    var box = document.getElementById('profile-overlay');
    if (!box) return;
    var isOnboard = !!onboarding;
    var name = this.getName();
    box.classList.remove('hidden');
    box.innerHTML =
      '<div class="pf-sheet">' +
        '<div class="pf-sheet-head">' +
          '<button class="btn-icon" onclick="Profile.closeEditor()">✕</button>' +
          '<span class="pf-sheet-title">' + (isOnboard ? '完善资料' : '编辑资料') + '</span>' +
          '<span style="width:40px"></span>' +
        '</div>' +
        '<div class="pf-sheet-body">' +
          '<p class="pf-tip">' + (isOnboard ? '给自己起个昵称、挑个头像，TA 就能认出你' : '昵称和头像 TA 都能看到') + '</p>' +
          '<div class="pf-avatar-pick">' +
            '<span id="pf-avatar-preview">' + Profile.avatarHTML(self._editingAvatar, name || '我', 'pf-xl') + '</span>' +
            '<label class="pf-upload-btn">从相册选图<input type="file" id="pf-file" accept="image/*" onchange="Profile.onFile(this)" style="display:none"></label>' +
          '</div>' +
          '<div class="pf-pick-label">或选一个头像</div>' +
          '<div class="pf-emoji-grid" id="pf-emoji-grid">' +
            Profile.EMOJIS.map(function(e) {
              return '<button class="pf-emoji-opt' + (e === self._editingAvatar ? ' active' : '') + '" data-emoji="' + e + '" onclick="Profile.pickEmoji(\'' + e + '\')">' + e + '</button>';
            }).join('') +
          '</div>' +
          '<input type="text" id="pf-name" class="auth-input" maxlength="16" placeholder="你的昵称" value="' + String(name).replace(/"/g, '&quot;').replace(/</g, '&lt;') + '">' +
          '<p class="auth-error" id="pf-error"></p>' +
          '<button class="btn-primary btn-full" onclick="Profile.submit()">' + (isOnboard ? '保存并进入' : '保存') + '</button>' +
          (isOnboard ? '<button class="pf-skip" onclick="Profile.skip()">以后再说</button>' : '') +
        '</div>' +
      '</div>';
    var inp = document.getElementById('pf-name');
    if (inp) {
      setTimeout(function() { try { inp.focus(); } catch (e) {} }, 120);
      inp.addEventListener('keydown', function(e) { if (e.key === 'Enter') Profile.submit(); });
    }
  },

  closeEditor: function() {
    var box = document.getElementById('profile-overlay');
    if (box) { box.classList.add('hidden'); box.innerHTML = ''; }
  },

  pickEmoji: function(emoji) {
    this._editingAvatar = emoji;
    var nameEl = document.getElementById('pf-name');
    var preview = document.getElementById('pf-avatar-preview');
    if (preview) preview.innerHTML = Profile.avatarHTML(emoji, (nameEl && nameEl.value) || '我', 'pf-xl');
    var grid = document.getElementById('pf-emoji-grid');
    if (grid) {
      var opts = grid.querySelectorAll('.pf-emoji-opt');
      for (var i = 0; i < opts.length; i++) opts[i].classList.toggle('active', opts[i].getAttribute('data-emoji') === emoji);
    }
  },

  // 相册选图 → canvas 压缩到 160px JPEG → dataURL
  onFile: function(input) {
    var file = input.files && input.files[0];
    if (!file) return;
    if (!/^image\//.test(file.type)) { showToast('请选择图片', 1500); return; }
    var reader = new FileReader();
    reader.onload = function(e) {
      var img = new Image();
      img.onload = function() {
        var MAX = 160, w = img.width, h = img.height;
        if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
        else { w = Math.round(w * MAX / h); h = MAX; }
        var cv = document.createElement('canvas');
        cv.width = w; cv.height = h;
        cv.getContext('2d').drawImage(img, 0, 0, w, h);
        var data;
        try { data = cv.toDataURL('image/jpeg', 0.72); } catch (err) { showToast('图片处理失败', 1500); return; }
        Profile._editingAvatar = data;
        var nameEl = document.getElementById('pf-name');
        var preview = document.getElementById('pf-avatar-preview');
        if (preview) preview.innerHTML = Profile.avatarHTML(data, (nameEl && nameEl.value) || '我', 'pf-xl');
        var grid = document.getElementById('pf-emoji-grid');
        if (grid) {
          var opts = grid.querySelectorAll('.pf-emoji-opt');
          for (var i = 0; i < opts.length; i++) opts[i].classList.remove('active');
        }
      };
      img.onerror = function() { showToast('图片读取失败', 1500); };
      img.src = e.target.result;
    };
    reader.onerror = function() { showToast('图片读取失败', 1500); };
    reader.readAsDataURL(file);
  },

  submit: function() {
    var inp = document.getElementById('pf-name');
    var err = document.getElementById('pf-error');
    var name = (inp && inp.value || '').trim();
    if (!name) { if (err) err.textContent = '给我起个昵称吧'; return; }
    if (err) err.textContent = '';
    Profile.save(name, this._editingAvatar, function(ok) {
      if (ok) Profile.closeEditor();
    });
  },

  skip: function() {
    try { localStorage.setItem('profile_skipped', '1'); } catch (e) {}
    Profile.closeEditor();
  },

  // 首次进入引导：没昵称、且没跳过过时弹一次
  maybeOnboard: function() {
    try {
      if (Profile.getName()) return;
      if (localStorage.getItem('profile_skipped') === '1') return;
    } catch (e) {}
    setTimeout(function() { Profile.openEditor(true); }, 700);
  }
};
