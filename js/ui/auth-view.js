// 认证/配对流程视图
import { createRoom, joinRoom } from '../logic/pairing-service.js';
import { AppShell } from './app-shell.js';
import { showToast } from '../utils/dom.js';

export var AuthView = {
  // 取名界面
  showNameSetup: function(onDone) {
    var shell = document.getElementById('app-shell');
    shell.innerHTML = `
      <div id="screen-auth" style="position:fixed;inset:0;z-index:500;background:var(--bg);display:flex;align-items:center;justify-content:center">
        <div class="auth-container" style="width:90%;max-width:360px;text-align:center">
          <div class="auth-icon" style="font-size:64px;margin-bottom:12px">🏠</div>
          <h2 style="font-size:24px;font-weight:600;margin-bottom:8px">欢迎来到你的小窝</h2>
          <p style="font-size:14px;color:var(--text-dim);margin-bottom:24px;line-height:1.6">给你的小窝取个名字吧</p>
          <input type="text" id="auth-nickname" class="input" placeholder="你的昵称" maxlength="12" style="margin-bottom:12px">
          <button class="btn-primary btn-full" id="btn-nickname-done">进入小窝</button>
        </div>
      </div>
    `;

    document.getElementById('btn-nickname-done').addEventListener('click', async function() {
      var name = document.getElementById('auth-nickname').value.trim();
      if (!name) { showToast('请输入昵称'); return; }
      await onDone(name);
    });

    document.getElementById('auth-nickname').addEventListener('keydown', function(e) {
      if (e.key === 'Enter') document.getElementById('btn-nickname-done').click();
    });
  },

  // 房间选择界面
  showRoomChoice: async function() {
    var shell = document.getElementById('app-shell');
    shell.innerHTML = `
      <div id="screen-auth" style="position:fixed;inset:0;z-index:500;background:var(--bg);display:flex;align-items:center;justify-content:center">
        <div class="auth-container" style="width:90%;max-width:360px;text-align:center">
          <div class="auth-icon" style="font-size:64px;margin-bottom:12px">💞</div>
          <h2 style="font-size:24px;font-weight:600;margin-bottom:8px">小窝准备好了</h2>
          <p style="font-size:14px;color:var(--text-dim);margin-bottom:24px;line-height:1.6">一个人也能好好记录情绪<br>也可以邀请 TA 一起</p>
          <button class="btn-primary btn-full" id="btn-create-room" style="margin-bottom:8px">🏗️ 创建房间</button>
          <button class="btn-secondary btn-full" id="btn-join-room" style="margin-bottom:8px">🔑 加入房间</button>
          <button class="btn-text" id="btn-skip-pair" style="margin-top:8px">先自己用 →</button>
        </div>
      </div>
      <div id="auth-create" class="hidden" style="position:fixed;inset:0;z-index:510;background:var(--bg);display:none;align-items:center;justify-content:center;flex-direction:column"></div>
      <div id="auth-join" class="hidden" style="position:fixed;inset:0;z-index:510;background:var(--bg);display:none;align-items:center;justify-content:center;flex-direction:column"></div>
    `;

    var self = this;
    document.getElementById('btn-create-room').addEventListener('click', function() { self._showCreate(); });
    document.getElementById('btn-join-room').addEventListener('click', function() { self._showJoin(); });
    document.getElementById('btn-skip-pair').addEventListener('click', function() { AppShell._render(false); });
  },

  _showCreate: function() {
    var el = document.getElementById('auth-create');
    el.style.display = 'flex';
    el.innerHTML = `
      <div style="width:90%;max-width:360px;text-align:center">
        <div style="font-size:56px;margin-bottom:16px">🏗️</div>
        <h2 style="font-size:22px;font-weight:600;margin-bottom:8px">创建房间</h2>
        <p style="font-size:14px;color:var(--text-dim);margin-bottom:20px">设置一个房间密码，TA 用它加入</p>
        <input type="text" id="create-pwd" class="input" placeholder="房间密码（4位以上）" maxlength="20" style="margin-bottom:12px">
        <p class="auth-error" id="create-error" style="font-size:13px;color:var(--danger);min-height:20px;margin-bottom:8px"></p>
        <button class="btn-primary btn-full" id="btn-create-go" style="margin-bottom:8px">创建</button>
        <button class="btn-text" id="btn-create-back">← 返回</button>
      </div>
      <div id="create-waiting" class="hidden" style="text-align:center">
        <div class="auth-waiting-icon" style="font-size:56px;animation:float 2s ease-in-out infinite">💫</div>
        <p style="font-size:14px;color:var(--text-dim);margin-bottom:16px">等待TA加入…</p>
        <div class="my-code-box" style="background:var(--bg);border-radius:var(--radius);padding:14px;margin-bottom:16px">
          <span style="font-size:12px;color:var(--text-dim)">房间号</span>
          <strong id="room-code-display" style="font-size:28px;letter-spacing:4px;color:var(--primary)"></strong>
        </div>
        <button class="btn-secondary btn-full" id="btn-create-cancel">取消</button>
      </div>
    `;

    var self = this;
    document.getElementById('btn-create-go').addEventListener('click', async function() {
      var pwd = document.getElementById('create-pwd').value.trim();
      if (pwd.length < 4) { document.getElementById('create-error').textContent = '密码至少4位'; return; }
      var result = await createRoom(pwd);
      if (result.error) { document.getElementById('create-error').textContent = result.error; return; }
      // 显示等待界面
      document.getElementById('create-waiting').classList.remove('hidden');
      document.getElementById('room-code-display').textContent = result.roomCode;
    });

    document.getElementById('btn-create-back').addEventListener('click', function() { el.style.display = 'none'; });
    document.getElementById('btn-create-cancel').addEventListener('click', function() { el.style.display = 'none'; });
  },

  _showJoin: function() {
    var el = document.getElementById('auth-join');
    el.style.display = 'flex';
    el.innerHTML = `
      <div style="width:90%;max-width:360px;text-align:center">
        <div style="font-size:56px;margin-bottom:16px">🔑</div>
        <h2 style="font-size:22px;font-weight:600;margin-bottom:8px">加入房间</h2>
        <p style="font-size:14px;color:var(--text-dim);margin-bottom:20px">输入 TA 分享的房间号和密码</p>
        <input type="text" id="join-code" class="input" placeholder="房间号" maxlength="10" style="margin-bottom:8px;text-transform:uppercase">
        <input type="text" id="join-pwd" class="input" placeholder="房间密码" maxlength="20" style="margin-bottom:8px">
        <p class="auth-error" id="join-error" style="font-size:13px;color:var(--danger);min-height:20px;margin-bottom:8px"></p>
        <button class="btn-primary btn-full" id="btn-join-go" style="margin-bottom:8px">加入</button>
        <button class="btn-text" id="btn-join-back">← 返回</button>
      </div>
      <div id="join-success" class="hidden" style="text-align:center">
        <div style="font-size:64px;margin-bottom:16px">🏠</div>
        <h2 style="font-size:24px;font-weight:600;margin-bottom:8px">你们的小窝搭建好了</h2>
        <p style="font-size:16px;color:var(--text-dim);margin-bottom:24px">从现在开始，这里只属于你们</p>
        <button class="btn-primary btn-full" id="btn-join-enter">进入小窝 💞</button>
      </div>
    `;

    document.getElementById('btn-join-go').addEventListener('click', async function() {
      var code = document.getElementById('join-code').value.trim().toUpperCase();
      var pwd = document.getElementById('join-pwd').value.trim();
      if (!code) { document.getElementById('join-error').textContent = '请输入房间号'; return; }
      if (!pwd) { document.getElementById('join-error').textContent = '请输入密码'; return; }
      var result = await joinRoom(code, pwd);
      if (result.error) { document.getElementById('join-error').textContent = result.error; return; }
      document.getElementById('join-success').classList.remove('hidden');
    });

    document.getElementById('btn-join-back').addEventListener('click', function() { el.style.display = 'none'; });
    document.getElementById('btn-join-enter').addEventListener('click', function() {
      AppShell.onPairingChanged(true);
    });
  }
};
