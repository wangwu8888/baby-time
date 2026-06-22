// AES-GCM 端到端加密
var _key = null;
var _roomCode = null;

// 从 room_code 派生 AES 密钥
export async function initCrypto(roomCode) {
  if (!roomCode || roomCode === _roomCode) return;
  _roomCode = roomCode;
  var enc = new TextEncoder();
  var data = enc.encode(roomCode);
  var hash = await crypto.subtle.digest('SHA-256', data);
  _key = await crypto.subtle.importKey('raw', hash.slice(0, 16), { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

// 临时：从明文加密（不依赖 initCrypto，用于聊天消息）
export async function encrypt(plaintext, roomCode) {
  if (!roomCode) return plaintext;
  await initCrypto(roomCode);
  return _encryptRaw(plaintext);
}

export async function decrypt(cipherText, roomCode) {
  if (!roomCode) return cipherText;
  await initCrypto(roomCode);
  return _decryptRaw(cipherText);
}

// 内部加密（确保已初始化）
async function _encryptRaw(plaintext) {
  if (!_key || !plaintext) return plaintext;
  try {
    var iv = crypto.getRandomValues(new Uint8Array(12));
    var data = new TextEncoder().encode(plaintext);
    var buf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, _key, data);
    return JSON.stringify({
      e: 1,
      i: bufToB64(iv),
      d: bufToB64(new Uint8Array(buf))
    });
  } catch (e) {
    return plaintext;
  }
}

async function _decryptRaw(cipherText) {
  if (!_key || !cipherText) return cipherText;
  try {
    var obj = JSON.parse(cipherText);
    if (!obj || obj.e !== 1) return cipherText;
    var iv = new Uint8Array(b64ToBuf(obj.i));
    var data = new Uint8Array(b64ToBuf(obj.d));
    var buf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv }, _key, data);
    return new TextDecoder().decode(buf);
  } catch (e) {
    return '[解密失败]';
  }
}

function bufToB64(buf) {
  var s = '';
  for (var i = 0; i < buf.length; i++) s += String.fromCharCode(buf[i]);
  return btoa(s);
}

function b64ToBuf(b64) {
  var s = atob(b64), arr = new Array(s.length);
  for (var i = 0; i < s.length; i++) arr[i] = s.charCodeAt(i);
  return arr;
}
