// Passive care: gentle reminders and emotional awareness
var Care = {
  init: function() {
    this._trackOpen();
    this._checkLateNight();
    this._checkInactive();
  },

  // Record today's open
  _trackOpen: function() {
    var now = new Date().toISOString();
    localStorage.setItem('care_last_open', now);
  },

  // Late-night gentle reminder (0-5am)
  _checkLateNight: function() {
    var h = new Date().getHours();
    if (h >= 0 && h < 5) {
      var el = document.getElementById('care-banner');
      if (el) {
        el.innerHTML = '<div class="card" style="background:linear-gradient(135deg,#1a1a2e,#16213e);color:#e8d5b7;text-align:center;padding:14px 16px;border-radius:var(--radius);margin-bottom:10px;font-size:14px">🌙 这么晚了还没睡呀，记得照顾好自己</div>';
      }
      // Also show toast on first visit today
      var today = new Date().toDateString();
      var last = localStorage.getItem('care_night_toast_date');
      if (last !== today) {
        localStorage.setItem('care_night_toast_date', today);
        showToast('这么晚了，记得照顾好自己 🌙', 4000);
      }
    }
  },

  // Check if app hasn't been opened for 3+ days
  _checkInactive: function() {
    var lastOpen = localStorage.getItem('care_last_opened') || new Date().toISOString();
    // Update last_opened AFTER checking (this is for next time)
    var now = new Date();
    var last = new Date(lastOpen);
    var daysAway = Math.floor((now - last) / 86400000);

    localStorage.setItem('care_last_opened', now.toISOString());

    if (daysAway >= 3) {
      var el = document.getElementById('care-banner');
      if (el) {
        var existing = el.innerHTML || '';
        el.innerHTML = existing + '<div class="card" style="background:linear-gradient(135deg,#fff7ed,#ffedd5);text-align:center;padding:14px 16px;border-radius:var(--radius);margin-bottom:10px;font-size:14px;color:#c2410c">🏠 小窝好像落灰了，TA可能在想你<br><span style="font-size:12px">已经 '+daysAway+' 天没来了</span></div>';
      }
    }
  },

  // Mood history helpers — called from pickMood
  recordMood: function(status) {
    var history = this._getMoodHistory();
    var today = new Date().toDateString();
    // Replace today's entry if exists, otherwise add
    var found = false;
    for (var i = history.length - 1; i >= 0; i--) {
      if (history[i].date === today) {
        history[i].status = status;
        found = true;
        break;
      }
    }
    if (!found) {
      history.push({ status: status, date: today });
    }
    // Keep only last 30 days
    if (history.length > 30) history = history.slice(-30);
    try { localStorage.setItem('care_mood_history', JSON.stringify(history)); } catch(e) {}
  },

  // Record partner's mood for weekly report
  recordTaMood: function(status) {
    var history = this._getTaMoodHistory();
    var today = new Date().toDateString();
    for (var i = history.length - 1; i >= 0; i--) {
      if (history[i].date === today) { history[i].status = status; try { localStorage.setItem('care_ta_mood_history', JSON.stringify(history)); } catch(e) {} return; }
    }
    history.push({ status: status, date: today });
    if (history.length > 30) history = history.slice(-30);
    try { localStorage.setItem('care_ta_mood_history', JSON.stringify(history)); } catch(e) {}
  },

  _getMoodHistory: function() {
    try {
      return JSON.parse(localStorage.getItem('care_mood_history') || '[]');
    } catch(e) { return []; }
  },

  _getTaMoodHistory: function() {
    try {
      return JSON.parse(localStorage.getItem('care_ta_mood_history') || '[]');
    } catch(e) { return []; }
  },

  // Get unique days from mood history, sorted by date
  _getConsecutiveDays: function(history) {
    // Already sorted by date since we push in order
    var seen = {};
    var days = [];
    for (var i = history.length - 1; i >= 0; i--) {
      var d = history[i].date;
      if (!seen[d]) {
        seen[d] = true;
        days.unshift(history[i]);
      }
    }
    return days;
  }
};
