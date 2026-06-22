// 通知服务
var _origTitle = document.title;
var _flashTimer = null;

export function flashTitle(text) {
  clearInterval(_flashTimer);
  var show = true;
  _flashTimer = setInterval(function() {
    document.title = show ? text : _origTitle;
    show = !show;
  }, 800);
  setTimeout(function() {
    clearInterval(_flashTimer);
    document.title = _origTitle;
  }, 4000);
}

export async function notify(title, body) {
  if (document.hidden) {
    flashTitle(title);
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, { body: body, icon: '/icons/icon-192.png' });
    }
  }
}

export async function requestPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    await Notification.requestPermission();
  }
}
