// 心情选择器
import { MOODS, MOOD_KEYS } from '../utils/mood-config.js';
import { updateMood } from '../logic/mood-service.js';
import { showToast } from '../utils/dom.js';

export function MoodPicker(container, onMoodChanged) {
  var html = '<div class="mood-picker-grid">';
  MOOD_KEYS.forEach(function(key) {
    var m = MOODS[key];
    html += '<div class="mood-pick-item" data-mood="' + key + '" style="border:2px solid var(--border);border-radius:var(--radius);padding:14px 8px;text-align:center;cursor:pointer;transition:all 0.15s;background:var(--card)"><span style="font-size:30px;display:block">' + m.icon + '</span><span style="font-size:12px;display:block;margin-top:4px">' + m.label + '</span></div>';
  }
  html += '</div>';
  container.innerHTML = html;

  container.querySelectorAll('.mood-pick-item').forEach(function(item) {
    item.addEventListener('click', async function() {
      var mood = this.dataset.mood;
      var result = await updateMood(mood);
      if (result) {
        // 选中样式
        container.querySelectorAll('.mood-pick-item').forEach(function(i) {
          i.style.borderColor = 'var(--border)';
          i.style.background = 'var(--card)';
        });
        this.style.borderColor = result.color;
        this.style.background = result.color;
        if (navigator.vibrate) navigator.vibrate(8);
        showToast(result.icon + ' ' + result.label, 1500);
        if (onMoodChanged) onMoodChanged(result);
      }
    });
  });
}

export function renderMoodIcon(status, size) {
  size = size || '40px';
  var m = MOODS[status] || MOODS.sunny;
  return '<span style="font-size:' + size + '">' + m.icon + '</span>';
}

export function renderMoodLabel(status) {
  var m = MOODS[status] || MOODS.sunny;
  return m.label;
}
