// 设置视图
import { getMyNickname, setNickname } from '../logic/auth-service.js';
import { getPairingStatus, getRoomCode, leaveRoom } from '../logic/pairing-service.js';
import { showToast, showConfirm } from '../utils/dom.js';
import { AppShell } from './app-shell.js';

export var SettingsView = {
  render: function(container, paired) {
    var pairing = getPairingStatus();
    var nickname = getMyNickname() || '未设置';
    var roomCode = getRoomCode() || '';

    container.innerHTML = `
      <header class="page-header"><h1>设置</h1></header>
      <div class="card setting-item" style="display:flex;align-items:center;justify-content:space-between">
        <div>
          <div style="font-size:15px;font-weight:500">我的昵称</div>
          <div style="font-size:12px;color:var(--text-dim)">${nickname}</div>
        </div>
        <button class="btn-text" id="btn-edit-nickname">修改</button>
      </div>
      ${paired ? `
      <div class="card setting-item" style="display:flex;align-items:center;justify-content:space-between">
        <div>
          <div style="font-size:15px;font-weight:500">房间号</div>
          <div style="font-size:12px;color:var(--text-dim)">${roomCode}</div>
        </div>
        <button class="btn-text" id="btn-copy-roomcode" style="color:var(--success)">复制</button>
      </div>
      <div class="card setting-item" style="display:flex;align-items:center;justify-content:space-between">
        <div>
          <div style="font-size:15px;font-weight:500">导出数据</div>
          <div style="font-size:12px;color:var(--text-dim)">下载所有数据为 JSON 文件</div>
        </div>
        <button class="btn-text" id="btn-export-data">导出</button>
      </div>
      <div class="card setting-item" style="display:flex;align-items:center;justify-content:space-between">
        <div>
          <div style="font-size:15px;font-weight:500">离开房间</div>
          <div style="font-size:12px;color:var(--text-dim)">解除配对，回到个人模式</div>
        </div>
        <button class="btn-text btn-danger" id="btn-leave-room">离开</button>
      </div>
      ` : `
      <div class="card" style="text-align:center">
        <p style="font-size:14px;color:var(--text-dim);padding:16px 0">你还没有和 TA 配对</p>
        <button class="btn-primary btn-full" id="btn-go-pair">去配对 💞</button>
      </div>
      `}
      <div class="card setting-item" style="display:flex;align-items:center;justify-content:space-between">
        <div>
          <div style="font-size:15px;font-weight:500">关于</div>
          <div style="font-size:12px;color:var(--text-dim)">心情气象台 · 给你们的小空间 · v3.0</div>
        </div>
      </div>
    `;

    this._bind(container, paired);
  },

  _bind: function(container, paired) {
    // 修改昵称
    var self = this;
    container.querySelector('#btn-edit-nickname').addEventListener('click', function() {
      var name = prompt('输入新昵称：', getMyNickname());
      if (name && name.trim()) {
        setNickname(name.trim()).then(function() {
          showToast('昵称已更新');
          self.render(container, paired);
        });
      }
    });

    if (paired) {
      // 复制房间号
      container.querySelector('#btn-copy-roomcode').addEventListener('click', function() {
        var code = getRoomCode();
        if (navigator.clipboard) {
          navigator.clipboard.writeText(code).then(function() { showToast('已复制'); });
        } else {
          prompt('长按复制：', code);
        }
      });

      // 导出数据
      container.querySelector('#btn-export-data').addEventListener('click', function() {
        showToast('导出功能开发中…');
      });

      // 离开房间
      container.querySelector('#btn-leave-room').addEventListener('click', async function() {
        var ok = await showConfirm('离开房间', '确定要离开房间吗？你的数据不会丢失，但将回到个人模式。');
        if (ok) {
          await leaveRoom();
          showToast('已离开房间');
          AppShell.onPairingChanged(false);
        }
      });
    } else {
      container.querySelector('#btn-go-pair').addEventListener('click', function() {
        AppShell._render(true);
      });
    }
  },

  refresh: function(paired) {
    var container = document.getElementById('page-settings');
    if (!container || !container.classList.contains('active')) return;
    this.render(container, paired);
  }
};
