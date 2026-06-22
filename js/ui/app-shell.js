// 应用根组件
import { initIdentity, getMyUserId, getMyNickname, setNickname } from '../logic/auth-service.js';
import { loadMyMood, getCurrentMood } from '../logic/mood-service.js';
import { getPairingStatus } from '../logic/pairing-service.js';
import { AuthView } from './auth-view.js';
import { WeatherView } from './weather-view.js';
import { TreeholeView } from './treehole-view.js';
import { SettingsView } from './settings-view.js';
import { StatusIndicator } from './status-indicator.js';

var _currentTab = 'weather';
var _paired = false;

export var AppShell = {
  start: async function() {
    var shell = document.getElementById('app-shell');
    if (!shell) return;

    // 初始化用户身份
    var identity = await initIdentity();
    if (identity.isNew || !getMyNickname()) {
      // 新用户或无昵称：显示取名界面
      await this._showAuth();
      return;
    }

    // 加载用户心情
    await loadMyMood();

    // 检查配对状态
    var status = getPairingStatus();
    _paired = status && status.paired;

    // 渲染主界面
    this._render(_paired);
  },

  _showAuth: async function() {
    var shell = document.getElementById('app-shell');
    shell.innerHTML = '';
    await AuthView.showNameSetup(async function(name) {
      await setNickname(name);
      await AuthView.showRoomChoice();
    });
  },

  _render: function(paired) {
    _paired = paired;
    var shell = document.getElementById('app-shell');
    shell.innerHTML = '';

    // 状态指示器（已配对时显示）
    if (paired) {
      var statusEl = StatusIndicator.render();
      shell.appendChild(statusEl);
    }

    // 页面容器
    shell.innerHTML += `
      <div class="page active" id="page-weather"></div>
      <div class="page" id="page-treehole"></div>
      <div class="page" id="page-settings"></div>
      <nav class="tab-bar">
        <button class="tab-btn active" data-tab="weather"><span class="tab-icon">🏠</span><span class="tab-label">小窝</span></button>
        <button class="tab-btn" data-tab="treehole"><span class="tab-icon">🌳</span><span class="tab-label">树洞</span></button>
        <button class="tab-btn" data-tab="settings"><span class="tab-icon">⚙️</span><span class="tab-label">设置</span></button>
      </nav>
    `;

    // 渲染各视图
    WeatherView.render(document.getElementById('page-weather'), paired);
    TreeholeView.render(document.getElementById('page-treehole'), paired);
    SettingsView.render(document.getElementById('page-settings'), paired);

    // 标签切换
    var self = this;
    shell.querySelectorAll('.tab-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        self._switchTab(this.dataset.tab);
      });
    });

    // 应用心情背景色
    var mood = getCurrentMood();
    if (mood) document.body.style.background = mood.color;
  },

  _switchTab: function(tab) {
    if (_currentTab === tab) return;
    _currentTab = tab;

    document.querySelectorAll('.page').forEach(function(p) { p.classList.remove('active'); });
    var page = document.getElementById('page-' + tab);
    if (page) page.classList.add('active');

    document.querySelectorAll('.tab-btn').forEach(function(b) {
      b.classList.toggle('active', b.dataset.tab === tab);
    });

    // 刷新视图
    if (tab === 'weather') WeatherView.refresh(_paired);
    if (tab === 'treehole') TreeholeView.refresh(_paired);
    if (tab === 'settings') SettingsView.refresh(_paired);

    if (page) page.scrollTop = 0;
  },

  // 配对状态变化时重新渲染
  onPairingChanged: function(paired) {
    if (paired !== _paired) {
      this._render(paired);
    }
  },

  isPaired: function() { return _paired; }
};
