// 断连横幅
export var ReconnectionBanner = {
  show: function(msg) {
    var el = document.getElementById('reconnect-banner');
    if (!el) {
      el = document.createElement('div');
      el.id = 'reconnect-banner';
      el.className = 'banner banner-warning';
      document.getElementById('app-shell').prepend(el);
    }
    el.textContent = msg || '连接中断，正在重连…';
    el.style.display = '';
  },

  hide: function() {
    var el = document.getElementById('reconnect-banner');
    if (el) el.style.display = 'none';
  }
};
