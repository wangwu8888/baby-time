// Weekly mood report — generated every Sunday
var Weekly = {
  init: function() {
    if (!Sync.partnerId) return; // only meaningful when paired
    this.renderEntry();
  },

  // Get mood data for the last 7 days
  _getWeekData: function() {
    var history = [];
    try { history = JSON.parse(localStorage.getItem('care_mood_history') || '[]'); } catch(e) {}
    var myMoods = {};
    var taMoods = {};
    var today = new Date();
    var days = [];
    for (var i = 6; i >= 0; i--) {
      var d = new Date(today);
      d.setDate(d.getDate() - i);
      var key = d.toDateString();
      days.push({ date: d, key: key, label: (d.getMonth()+1)+'/'+d.getDate() });
    }
    // Map mood data to days
    for (var j = 0; j < history.length; j++) {
      var h = history[j];
      if (!myMoods[h.date]) myMoods[h.date] = h.status;
    }
    // Partner moods from sync
    if (Sync.partnerMood) {
      var pm = Sync.partnerMood;
      var pd = new Date(pm.updatedAt).toDateString();
      taMoods[pd] = pm.status;
    }
    // Also check localStorage for partner mood history
    var taHistory = [];
    try { taHistory = JSON.parse(localStorage.getItem('care_ta_mood_history') || '[]'); } catch(e) {}
    for (var k = 0; k < taHistory.length; k++) {
      var th = taHistory[k];
      if (!taMoods[th.date]) taMoods[th.date] = th.status;
    }

    var data = { days: [], distribution: {} };
    var allStatuses = ['sunny','cloudy','rainy','storm','love','dnd'];
    for (var s = 0; s < allStatuses.length; s++) {
      data.distribution[allStatuses[s]] = { me: 0, ta: 0 };
    }

    for (var di = 0; di < days.length; di++) {
      var day = days[di];
      var meMood = myMoods[day.key] || null;
      var taMood = taMoods[day.key] || null;
      data.days.push({
        label: day.label,
        date: day.date,
        key: day.key,
        me: meMood,
        ta: taMood
      });
      if (meMood && data.distribution[meMood]) data.distribution[meMood].me++;
      if (taMood && data.distribution[taMood]) data.distribution[taMood].ta++;
    }
    return data;
  },

  renderEntry: function() {
    // Weekly report button is now inside the timeline card title (weather.js)
    // No separate UI needed — only show when paired via timeline rendering
  },

  _openReport: function() {
    var data = this._getWeekData();
    var self = this;
    var overlay = document.createElement('div');
    overlay.id = 'weekly-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:200;background:var(--bg-primary);display:flex;flex-direction:column;overflow-y:auto';

    var today = new Date();
    var dayOfWeek = today.getDay();
    // Week range: Mon to Sun
    var monday = new Date(today);
    monday.setDate(today.getDate() - ((dayOfWeek + 6) % 7));
    var sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    var weekLabel = (monday.getMonth()+1)+'/'+monday.getDate()+' - '+(sunday.getMonth()+1)+'/'+sunday.getDate();

    var html = '';
    html += '<div style="padding:12px 16px;display:flex;align-items:center;justify-content:space-between;background:var(--bg-card);border-bottom:1px solid var(--border)">';
    html += '<span style="font-size:18px;font-weight:600">📊 心情周报</span>';
    html += '<button style="background:none;border:none;font-size:24px;cursor:pointer;padding:8px" onclick="document.getElementById(\'weekly-overlay\').remove()">✕</button>';
    html += '</div>';

    html += '<div style="padding:16px;text-align:center">';
    html += '<div style="font-size:13px;color:var(--text-secondary);margin-bottom:4px">' + weekLabel + '</div>';
    html += '<div style="font-size:12px;color:var(--text-dim)">一周心情回顾</div>';
    html += '</div>';

    // ===== Emotion curve (7-day line) =====
    html += '<div class="card" style="margin:0 16px 12px">';
    html += '<div class="card-title">📈 情绪曲线</div>';
    html += '<div style="display:flex;justify-content:space-between;align-items:flex-end;padding:8px 0;min-height:100px">';

    var moodOrder = { sunny: 5, cloudy: 4, love: 4, rainy: 2, storm: 1, dnd: 3 };
    var moodEmoji = { sunny: '☀️', cloudy: '☁️', rainy: '🌧️', storm: '⛈️', love: '❤️', dnd: '🔕' };

    for (var i = 0; i < data.days.length; i++) {
      var day = data.days[i];
      var mePos = day.me ? (moodOrder[day.me] || 3) * 16 : 0;
      var taPos = day.ta ? (moodOrder[day.ta] || 3) * 16 : 0;

      html += '<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;min-width:36px">';
      // Partner dot (top)
      if (day.ta) {
        html += '<div style="width:10px;height:10px;border-radius:50%;background:var(--accent-blue);margin-bottom:2px" title="TA: '+MOOD_CONFIG[day.ta].label+'"></div>';
        html += '<span style="font-size:14px">' + moodEmoji[day.ta] + '</span>';
      } else {
        html += '<div style="width:10px;height:10px;border-radius:50%;background:transparent;margin-bottom:2px"></div>';
        html += '<span style="font-size:14px;opacity:0.3">·</span>';
      }
      // My dot (bottom)
      if (day.me) {
        html += '<span style="font-size:16px">' + moodEmoji[day.me] + '</span>';
        html += '<div style="width:8px;height:8px;border-radius:50%;background:var(--accent-warm);margin-top:2px" title="我: '+MOOD_CONFIG[day.me].label+'"></div>';
      } else {
        html += '<span style="font-size:16px;opacity:0.3">·</span>';
        html += '<div style="width:8px;height:8px;border-radius:50%;background:transparent;margin-top:2px"></div>';
      }
      html += '<span style="font-size:10px;color:var(--text-dim);margin-top:4px">' + day.label + '</span>';
      html += '</div>';
    }
    html += '</div>';
    html += '<div style="display:flex;justify-content:center;gap:16px;font-size:11px;color:var(--text-dim);margin-top:4px">';
    html += '<span><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--accent-warm);vertical-align:middle;margin-right:3px"></span>我</span>';
    html += '<span><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--accent-blue);vertical-align:middle;margin-right:3px"></span>TA</span>';
    html += '</div>';
    html += '</div>';

    // ===== Distribution bar chart =====
    html += '<div class="card" style="margin:0 16px 12px">';
    html += '<div class="card-title">📊 心情分布</div>';

    // Find max count for scaling
    var maxCount = 1;
    var statuses = ['sunny','cloudy','rainy','storm','love','dnd'];
    for (var s = 0; s < statuses.length; s++) {
      var st = statuses[s];
      var total = (data.distribution[st] ? data.distribution[st].me + data.distribution[st].ta : 0);
      if (total > maxCount) maxCount = total;
    }

    for (var b = 0; b < statuses.length; b++) {
      var st2 = statuses[b];
      var cfg = MOOD_CONFIG[st2];
      var dist = data.distribution[st2] || { me: 0, ta: 0 };
      var total2 = dist.me + dist.ta;
      var barW = maxCount > 0 ? Math.max(4, (total2 / maxCount) * 100) : 0;

      html += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">';
      html += '<span style="font-size:20px;width:28px;text-align:center">' + cfg.icon + '</span>';
      html += '<span style="font-size:11px;width:32px;color:var(--text-dim)">' + cfg.label + '</span>';
      html += '<div style="flex:1;height:22px;background:var(--bg-secondary);border-radius:6px;overflow:hidden;position:relative">';
      if (barW > 0 && total2 > 0) {
        var meW = maxCount > 0 ? (dist.me / maxCount) * 100 : 0;
        var taW = maxCount > 0 ? (dist.ta / maxCount) * 100 : 0;
        if (meW > 0) {
          html += '<div style="position:absolute;left:0;top:0;height:100%;background:' + cfg.accent + ';border-radius:6px 0 0 6px;width:' + meW + '%"></div>';
        }
        if (taW > 0) {
          html += '<div style="position:absolute;left:' + meW + '%;top:0;height:100%;background:var(--accent-blue);opacity:0.6;border-radius:0 6px 6px 0;width:' + taW + '%"></div>';
        }
      }
      html += '</div>';
      html += '<span style="font-size:12px;color:var(--text-dim);min-width:16px;text-align:right">' + total2 + '</span>';
      html += '</div>';
    }
    html += '<div style="display:flex;justify-content:center;gap:16px;font-size:11px;color:var(--text-dim);margin-top:8px">';
    html += '<span><span style="display:inline-block;width:10px;height:10px;background:var(--accent-warm);border-radius:3px;vertical-align:middle;margin-right:3px"></span>我</span>';
    html += '<span><span style="display:inline-block;width:10px;height:10px;background:var(--accent-blue);opacity:0.6;border-radius:3px;vertical-align:middle;margin-right:3px"></span>TA</span>';
    html += '</div>';
    html += '</div>';

    // ===== Weekly insight =====
    var insightText = '这周你们一起记录了心情的起伏。';
    var sunnyCount = (data.distribution.sunny ? data.distribution.sunny.me + data.distribution.sunny.ta : 0);
    var loveCount = (data.distribution.love ? data.distribution.love.me + data.distribution.love.ta : 0);
    var lowCount = (data.distribution.rainy ? data.distribution.rainy.me + data.distribution.rainy.ta : 0) + (data.distribution.storm ? data.distribution.storm.me + data.distribution.storm.ta : 0);

    if (sunnyCount >= 5) insightText = '☀️ 这周阳光满满！你们的心情都很明亮呢。';
    else if (loveCount >= 4) insightText = '❤️ 爱意满满的一周，甜蜜指数很高哦。';
    else if (lowCount >= 4) insightText = '🌧️ 这周有些阴雨，但彼此陪伴就是最好的晴天。';
    else if (sunnyCount + loveCount >= 6) insightText = '✨ 温暖的一周，有晴有爱刚刚好。';

    html += '<div class="card" style="margin:0 16px 12px;text-align:center">';
    html += '<div style="font-size:15px;color:var(--text-primary);line-height:1.6">' + insightText + '</div>';
    html += '</div>';

    html += '<div style="padding:16px;text-align:center">';
    html += '<button class="btn-secondary" onclick="document.getElementById(\'weekly-overlay\').remove()" style="width:100%">关闭</button>';
    html += '</div>';

    overlay.innerHTML = html;
    document.body.appendChild(overlay);
  },

  refresh: function() {
    // Timeline re-renders with the weekly link via weather.js
  }
};
