// Account v127 — 邮箱账号登录/注册 + 历史认领
// 职责：启动前把关——没登录显示登录页；登录后认领身份，再把控制权交回 App。
var Account = {
  _mode: 'login',   // 'login' | 'register'

  // boot(): 应用启动入口。由 app.js 调用，取代原来的直接 showApp。
  boot: function() {
    var self = this;
    var authed = false;
    try { authed = !!(localStorage.getItem('account_email')); } catch (e) {}
    if (authed && typeof SUPABASE !== 'undefined' && SUPABASE.AUTH.hasSession()) {
      // 已登录：确保 token 有效并重新绑定身份，然后进主界面
      SUPABASE.AUTH.ensure(function(err) {
        if (err && !SUPABASE.AUTH.isLegacy()) { self.show(); return; }
        SUPABASE.AUTH.bindIdentity(function() { self.enterApp(); });
      });
    } else {
      this.show();
    }
  },

  // show(): 显示登录/注册页
  show: function(mode) {
    if (mode) this._mode = mode;
    var el = document.getElementById('screen-auth');
    if (!el) return;
    el.style.display = 'flex';
    var isLogin = this._mode === 'login';
    el.innerHTML =
      '<div class="auth-container">' +
        '<div class="auth-icon">💞</div>' +
        '<h2>心情气象台</h2>' +
        '<p class="auth-desc">属于你们两个人的私密空间<br>登录后自动找回你的全部记录</p>' +
        '<input type="email" id="ac-email" class="auth-input" placeholder="邮箱" autocomplete="username" inputmode="email">' +
        '<input type="password" id="ac-pwd" class="auth-input" placeholder="密码（至少6位）" autocomplete="current-password">' +
        '<p class="auth-error" id="ac-error"></p>' +
        '<button class="btn-primary btn-full" id="ac-submit" onclick="Account.submit()">' + (isLogin ? '登录' : '注册') + '</button>' +
        '<p class="auth-hint" style="margin-top:18px">' +
          (isLogin
            ? '还没有账号？<span class="btn-text" onclick="Account.show(\'register\')">注册一个</span>'
            : '已有账号？<span class="btn-text" onclick="Account.show(\'login\')">去登录</span>') +
        '</p>' +
        (isLogin ? '' : '<p class="auth-hint" style="font-size:12px">⚠️ 老用户请在<b>原来那台设备</b>上注册，历史记录会自动认领；不要重新建房间。</p>') +
      '</div>';
    var self = this;
    // 回车提交
    ['ac-email', 'ac-pwd'].forEach(function(id) {
      var inp = document.getElementById(id);
      if (inp) inp.addEventListener('keydown', function(e) { if (e.key === 'Enter') self.submit(); });
    });
  },

  _err: function(msg) {
    var e = document.getElementById('ac-error');
    if (e) e.textContent = msg || '';
  },

  submit: function() {
    var self = this;
    var emailEl = document.getElementById('ac-email');
    var pwdEl = document.getElementById('ac-pwd');
    var email = (emailEl && emailEl.value || '').trim().toLowerCase();
    var pwd = pwdEl && pwdEl.value || '';
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { this._err('请输入有效的邮箱'); return; }
    if (pwd.length < 6) { this._err('密码至少 6 位'); return; }
    var btn = document.getElementById('ac-submit');
    if (btn) { btn.disabled = true; btn.textContent = '请稍候…'; }
    this._err('');

    var done = function(err) {
      if (btn) { btn.disabled = false; btn.textContent = self._mode === 'login' ? '登录' : '注册'; }
      if (err) {
        if (err === 'NEED_CONFIRM') { self._err('注册成功！请先去邮箱点确认链接，再回来登录'); return; }
        if (err === 'ALREADY_EXISTS') { self._err('这个邮箱已注册，请直接登录'); return; }
        self._err(err);
        return;
      }
      // 登录/注册成功：token 已在 AUTH 里。绑定身份（认领历史），再进主界面。
      try { localStorage.setItem('account_email', email); } catch (e) {}
      SUPABASE.AUTH.bindIdentity(function() { self.enterApp(); });
    };

    if (this._mode === 'login') SUPABASE.AUTH.signIn(email, pwd, done);
    else SUPABASE.AUTH.signUp(email, pwd, done);
  },

  // enterApp(): 隐藏登录页，把控制权交回 App
  enterApp: function() {
    var el = document.getElementById('screen-auth');
    if (el) el.style.display = 'none';
    if (typeof App !== 'undefined') App.start();
    // v128: 把本地资料补到云端，并在首次登录时引导补全昵称/头像
    if (typeof Profile !== 'undefined') {
      Profile.sync(function() {});
      Profile.maybeOnboard();
    }
    // 邀请链接（?join=CODE）在登录后才拉开配对弹窗
    if (typeof _handleInviteOnLoad === 'function') _handleInviteOnLoad();
  },

  // logout(): 退出登录（账号与云端数据保留，可重新登录恢复）
  logout: function() {
    if (!confirm('确定退出登录吗？\n你的账号和所有记录都会保留，下次登录还能找回。')) return;
    // 真退出房间（删成员行+重算计数），对方会看到你离开
    if (typeof Sync !== 'undefined' && Sync.roomId) {
      SUPABASE.rpc('leave_room', {}, function() { finish(); });
      setTimeout(finish, 3000);
    } else { finish(); }
    var finished = false;
    function finish() {
      if (finished) return; finished = true;
      SUPABASE.AUTH.logout();
      location.reload();
    }
  }
};
