// 在线状态指示器
export var StatusIndicator = {
  render: function() {
    var el = document.createElement('div');
    el.className = 'banner banner-info';
    el.id = 'status-indicator';
    el.innerHTML = '<span style="display:inline-block;width:8px;height:8px;background:var(--online);border-radius:50%;margin-right:6px"></span>已连接 💞';
    return el;
  },

  setOnline: function(name) {
    var el = document.getElementById('status-indicator');
    if (el) el.innerHTML = '<span style="display:inline-block;width:8px;height:8px;background:var(--online);border-radius:50%;margin-right:6px"></span>' + (name || 'TA') + '已连接 💞';
  },

  setOffline: function(name, lastSeen) {
    var el = document.getElementById('status-indicator');
    if (el) {
      el.className = 'banner banner-warning';
      el.innerHTML = (name || 'TA') + '已离开 🌱 · ' + (lastSeen || '稍早');
    }
  },

  setReconnecting: function() {
    var el = document.getElementById('status-indicator');
    if (el) {
      el.className = 'banner banner-warning';
      el.innerHTML = '连接中断，正在重连…';
    }
  }
};
