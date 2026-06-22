// 树洞视图
import { showToast, escapeHtml, generateId } from '../utils/dom.js';
import { formatDate, formatTime, groupByDate } from '../utils/date.js';
import { MOODS } from '../utils/mood-config.js';
import { addDiaryEntry, loadDiaryEntries } from '../logic/diary-service.js';
import { DoodleCanvas } from './doodle-canvas.js';
import { showImageFullscreen } from './modal.js';
import { getPairingStatus } from '../logic/pairing-service.js';

export var TreeholeView = {
  _pendingDoodle: null,

  render: async function(container, paired) {
    var entries = await loadDiaryEntries(50, 0);
    var pairing = getPairingStatus();

    var diaryHtml = this._renderDiarySection(entries || []);
    var memorialHtml = paired ? this._renderMemorialSection() : '';

    container.innerHTML = `
      <header class="page-header"><h1>树洞</h1><span class="subtitle">你的私密空间</span></header>
      ${diaryHtml}
      ${memorialHtml}
    `;

    // 日记表单事件
    this._bindDiaryForm(container);
    // 涂鸦按钮
    var btnDoodle = container.querySelector('#btn-diary-doodle');
    if (btnDoodle) {
      var self = this;
      btnDoodle.addEventListener('click', function() {
        DoodleCanvas.open('diary', function(dataUrl) {
          self._pendingDoodle = dataUrl;
          var btn = container.querySelector('#btn-diary-doodle');
          if (btn) { btn.style.background = 'var(--primary)'; btn.style.color = 'white'; btn.textContent = '🎨✓'; }
          showToast('涂鸦已就绪');
        });
      });
    }
  },

  _renderDiarySection: function(entries) {
    var html = '<div class="card"><div class="card-title">📖 我的日记</div>';
    html += '<textarea id="diary-text" class="input" placeholder="写点什么吧…" rows="3" style="resize:none;text-align:left;margin-bottom:8px"></textarea>';
    html += '<div class="entry-mood-select" id="diary-mood-select" style="display:flex;gap:6px;margin-bottom:10px">';
    Object.keys(MOODS).forEach(function(key) {
      var m = MOODS[key];
      html += '<div class="mood-stamp-btn' + (key === 'sunny' ? ' selected' : '') + '" data-mood="' + key + '" style="width:36px;height:36px;border-radius:50%;border:2px solid var(--border);background:var(--card);font-size:18px;cursor:pointer;display:flex;align-items:center;justify-content:center" title="' + m.label + '">' + m.icon + '</div>';
    });
    html += '</div>';
    html += '<div style="display:flex;gap:8px"><button class="btn-secondary" id="btn-diary-doodle">🎨 涂鸦</button><button class="btn-primary" id="btn-diary-save" style="flex:1">存入树洞</button></div>';
    html += '</div>';

    html += '<div class="entry-timeline" id="diary-timeline">';
    if (!entries.length) {
      html += '<p style="text-align:center;color:var(--text-dim);padding:20px 0">还没有记录，写下第一条吧</p>';
    } else {
      var groups = groupByDate(entries);
      Object.keys(groups).forEach(function(day) {
        html += '<div class="date-group"><div class="date-group-label" style="font-size:12px;color:var(--text-dim);padding:8px 0 4px;font-weight:500">' + day + '</div>';
        groups[day].forEach(function(e) {
          var m = MOODS[e.mood] || MOODS.sunny;
          html += '<div class="card" style="border-left:3px solid ' + m.accent + ';margin-bottom:8px">';
          html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px"><span style="font-size:18px">' + m.icon + '</span><span style="font-size:11px;color:var(--text-dim)">' + formatTime(e.created_at) + '</span></div>';
          if (e.text) html += '<div style="font-size:14px;line-height:1.5;white-space:pre-wrap">' + escapeHtml(e.text) + '</div>';
          if (e.doodle_data_url) html += '<div style="margin-top:8px"><img src="' + e.doodle_data_url + '" alt="涂鸦" style="max-width:120px;max-height:120px;border-radius:var(--radius-sm);cursor:pointer" onclick="event.target.closest(\'#page-treehole\')?.querySelector?.(\'img\')?.dispatchEvent(new CustomEvent(\'doodle-click\',{detail:\'' + e.doodle_data_url + '\'}))"></div>';
          html += '</div>';
        });
        html += '</div>';
      });
    }
    html += '</div>';
    return html;
  },

  _renderMemorialSection: function() {
    return `
      <div class="card">
        <div class="card-title">💝 我们的纪念墙</div>
        <p style="text-align:center;color:var(--text-dim);padding:20px 0">纪念墙即将上线 ✨</p>
      </div>
    `;
  },

  _bindDiaryForm: function(container) {
    var self = this;
    var diaryMood = 'sunny';

    // 心情选择
    container.querySelectorAll('#diary-mood-select .mood-stamp-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        diaryMood = this.dataset.mood;
        container.querySelectorAll('#diary-mood-select .mood-stamp-btn').forEach(function(b) {
          b.classList.remove('selected');
          b.style.borderColor = 'var(--border)';
          b.style.background = 'var(--card)';
        });
        this.classList.add('selected');
        this.style.borderColor = 'var(--primary)';
        this.style.background = 'var(--bg)';
      });
    });

    // 保存
    container.querySelector('#btn-diary-save').addEventListener('click', async function() {
      var text = container.querySelector('#diary-text').value.trim();
      var doodle = self._pendingDoodle || null;
      if (!text && !doodle) { showToast('至少写一句话或画一幅涂鸦吧'); return; }
      var entry = await addDiaryEntry(diaryMood, text, doodle);
      if (entry) {
        container.querySelector('#diary-text').value = '';
        self._pendingDoodle = null;
        var btn = container.querySelector('#btn-diary-doodle');
        if (btn) { btn.style.background = ''; btn.style.color = ''; btn.textContent = '🎨 涂鸦'; }
        showToast('已存入树洞');
        // 重新渲染
        self.render(container, AppShell.isPaired());
      } else {
        showToast('保存失败');
      }
    });
  },

  refresh: async function(paired) {
    var container = document.getElementById('page-treehole');
    if (!container || !container.classList.contains('active')) return;
    await this.render(container, paired);
  }
};
