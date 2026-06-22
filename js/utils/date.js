// 日期工具
export function formatDate(s) {
  var d = new Date(s), n = new Date();
  var today = new Date(n.getFullYear(), n.getMonth(), n.getDate());
  var thatDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  var diff = Math.floor((today - thatDay) / 86400000);
  if (diff === 0) return '今天';
  if (diff === 1) return '昨天';
  if (diff === 2) return '前天';
  if (diff < 7) return diff + '天前';
  return d.getFullYear() + '/' + (d.getMonth() + 1) + '/' + d.getDate();
}

export function formatTime(s) {
  var d = new Date(s);
  return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}

export function formatFull(s) {
  var d = new Date(s);
  return (d.getMonth() + 1) + '月' + d.getDate() + '日 ' + formatTime(s);
}

export function formatMonthDay(s) {
  var d = new Date(s);
  return (d.getMonth() + 1) + '月' + d.getDate() + '日';
}

// 按日期分组
export function groupByDate(arr, key) {
  key = key || 'created_at';
  var g = {};
  arr.forEach(function(e) {
    var k = formatDate(e[key]);
    if (!g[k]) g[k] = [];
    g[k].push(e);
  });
  return g;
}

// 天数差
export function dayDiff(dateStr) {
  var d = new Date(dateStr), n = new Date();
  var today = new Date(n.getFullYear(), n.getMonth(), n.getDate());
  var thatDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.floor((today - thatDay) / 86400000);
}

// 小时
export function getHour() { return new Date().getHours(); }

// 是否今天
export function isToday(s) { return formatDate(s) === '今天'; }

// 相对时间（刚刚/X分钟前/X小时前）
export function relativeTime(s) {
  var diff = (new Date() - new Date(s)) / 1000;
  if (diff < 60) return '刚刚';
  if (diff < 3600) return Math.floor(diff / 60) + '分钟前';
  if (diff < 86400) return Math.floor(diff / 3600) + '小时前';
  return formatDate(s);
}
