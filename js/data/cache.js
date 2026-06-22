// localStorage 缓存层 —— 读缓存，写穿透
var PREFIX = 'cache:';

export function getCached(key) {
  try {
    var raw = localStorage.getItem(PREFIX + key);
    if (raw === null) return null;
    var item = JSON.parse(raw);
    // TTL 5 minutes
    if (item.exp && Date.now() > item.exp) {
      localStorage.removeItem(PREFIX + key);
      return null;
    }
    return item.data;
  } catch (e) {
    return null;
  }
}

export function setCached(key, data, ttl) {
  ttl = ttl || 300000; // 5 min default
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify({
      data: data,
      exp: Date.now() + ttl
    }));
  } catch (e) {
    // localStorage full — clear old caches
    clearAll();
  }
}

export function removeCached(key) {
  localStorage.removeItem(PREFIX + key);
}

export function clearAll() {
  var keys = [];
  for (var i = 0; i < localStorage.length; i++) {
    var k = localStorage.key(i);
    if (k && k.indexOf(PREFIX) === 0) keys.push(k);
  }
  keys.forEach(function(k) { localStorage.removeItem(k); });
}

// 非缓存 key 存储（持久化）
export function getLocal(key) {
  try {
    return JSON.parse(localStorage.getItem(key));
  } catch (e) {
    return null;
  }
}

export function setLocal(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {}
}

export function removeLocal(key) {
  localStorage.removeItem(key);
}
