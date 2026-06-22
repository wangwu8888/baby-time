// 小窝视图
import { getCurrentMood, loadMyMood } from '../logic/mood-service.js';
import { getPairingStatus, getPartnerName } from '../logic/pairing-service.js';
import { MoodPicker, renderMoodIcon, renderMoodLabel } from './mood-picker.js';
import { showToast } from '../utils/dom.js';
import { AppShell } from './app-shell.js';

export var WeatherView = {
  render: async function(container, paired) {
    var mood = getCurrentMood();
    if (!mood) { mood = await loadMyMood(); }
    var icon = mood ? mood.icon : '☀️';
    var label = mood ? mood.label : '晴朗';

    if (paired) {
      this._renderPaired(container, icon, label);
    } else {
      this._renderUnpaired(container, icon, label);
    }
  },

  _renderUnpaired: function(container, icon, label) {
    var pairStatus = getPairingStatus();
    container.innerHTML = `
      <header class="page-header"><h1>我的小窝</h1></header>
      <div class="card" style="text-align:center">
        <div class="mood-display" style="padding:24px 0">
          <div style="font-size:72px" id="my-mood-icon">${icon}</div>
          <div style="font-size:24px;font-weight:600;margin-top:8px" id="my-mood-label">${label}</div>
        </div>
        <div id="mood-picker-container"></div>
      </div>
      <div class="card" style="text-align:center">
        <p style="font-size:15px;color:var(--text-dim);padding:16px 0">一个人也可以好好记录情绪 ☀️</p>
        <button class="btn-primary btn-full" id="btn-invite">邀请TA加入 →</button>
      </div>
    `;

    // 心情选择器
    var pickerContainer = container.querySelector('#mood-picker-container');
    MoodPicker(pickerContainer, function(m) {
      var iconEl = container.querySelector('#my-mood-icon');
      var labelEl = container.querySelector('#my-mood-label');
      if (iconEl) iconEl.textContent = m.icon;
      if (labelEl) labelEl.textContent = m.label;
    });

    // 邀请按钮
    container.querySelector('#btn-invite').addEventListener('click', function() {
      AppShell._render(true); // 触发配对流程 — 这里简化处理
      // TODO: show pairing UI
    });
  },

  _renderPaired: function(container, myIcon, myLabel) {
    var partner = getPartnerName();
    container.innerHTML = `
      <header class="page-header"><h1>我们的小窝</h1><span style="font-size:13px;color:var(--text-dim)">已连接</span></header>
      <div class="card">
        <div style="display:flex;justify-content:space-around;align-items:center;padding:16px 0">
          <div style="text-align:center">
            <div style="font-size:48px" id="my-mood-icon">${myIcon}</div>
            <div style="font-size:14px;font-weight:600;margin-top:4px" id="my-mood-label">${myLabel}</div>
            <div style="font-size:12px;color:var(--text-dim)">我</div>
          </div>
          <div style="font-size:28px;color:var(--primary-dim)">💞</div>
          <div style="text-align:center">
            <div style="font-size:48px" id="partner-mood-icon">☀️</div>
            <div style="font-size:14px;font-weight:600;margin-top:4px" id="partner-mood-label">晴朗</div>
            <div style="font-size:12px;color:var(--text-dim)">${partner}</div>
          </div>
        </div>
        <div id="mood-picker-container"></div>
      </div>
      <div id="dialogue-container"></div>
      <div id="input-bar" style="position:sticky;bottom:0;background:var(--bg);padding:8px 0"></div>
    `;

    var pickerContainer = container.querySelector('#mood-picker-container');
    MoodPicker(pickerContainer, function(m) {
      var iconEl = container.querySelector('#my-mood-icon');
      var labelEl = container.querySelector('#my-mood-label');
      if (iconEl) iconEl.textContent = m.icon;
      if (labelEl) labelEl.textContent = m.label;
    });
  },

  refresh: async function(paired) {
    var container = document.getElementById('page-weather');
    if (!container || !container.classList.contains('active')) return;
    var mood = await loadMyMood();
    var icon = mood ? mood.icon : '☀️';
    var label = mood ? mood.label : '晴朗';
    if (paired) {
      // 更新心情图标
      var myIcon = container.querySelector('#my-mood-icon');
      var myLabel = container.querySelector('#my-mood-label');
      if (myIcon) myIcon.textContent = icon;
      if (myLabel) myLabel.textContent = label;
    }
  }
};
