// 输入中指示器
var _timer = null;

export var TypingIndicator = {
  show: function(name) {
    var el = document.getElementById('typing-indicator');
    if (!el) {
      el = document.createElement('div');
      el.id = 'typing-indicator';
      el.style.cssText = 'font-size:12px;color:var(--text-dim);padding:4px 0;font-style:italic';
      var timeline = document.getElementById('dialogue-container');
      if (timeline) timeline.appendChild(el);
    }
    el.textContent = (name || 'TA') + '正在输入…';
    el.style.display = '';
    clearTimeout(_timer);
    _timer = setTimeout(this.hide, 3000);
  },

  hide: function() {
    var el = document.getElementById('typing-indicator');
    if (el) el.style.display = 'none';
  }
};
