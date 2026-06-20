// End-to-end encryption for shared messages
// Key derived from room code (known only to the two users)
// Uses Web Crypto API (AES-GCM), no external deps
var Crypto = {
  _key: null,
  _ready: false,

  // Derive AES key from room code
  init: function(roomCode) {
    var self = this;
    if (!roomCode) return Promise.resolve();
    var data = new TextEncoder().encode(roomCode);
    return crypto.subtle.digest('SHA-256', data).then(function(hash) {
      return crypto.subtle.importKey('raw', hash.slice(0, 16), { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
    }).then(function(key) {
      self._key = key;
      self._ready = true;
    }).catch(function() {
      self._key = null;
      self._ready = false;
    });
  },

  encrypt: function(plaintext) {
    if (!this._key) return Promise.resolve(plaintext);
    var iv = crypto.getRandomValues(new Uint8Array(12));
    var data = new TextEncoder().encode(plaintext);
    var self = this;
    return crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, this._key, data).then(function(buf) {
      return JSON.stringify({
        e: 1,
        i: self._bufToB64(iv),
        d: self._bufToB64(new Uint8Array(buf))
      });
    }).catch(function() { return plaintext; });
  },

  decrypt: function(text) {
    if (!this._key) return Promise.resolve(text);
    var obj;
    try { obj = JSON.parse(text); } catch(e) { return Promise.resolve(text); }
    if (!obj || obj.e !== 1) return Promise.resolve(text);
    try {
      var iv = new Uint8Array(self._b64ToBuf(obj.i));
      var data = new Uint8Array(self._b64ToBuf(obj.d));
      return crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv }, this._key, data).then(function(buf) {
        return new TextDecoder().decode(buf);
      }).catch(function() { return '[解密失败]'; });
    } catch(e) { return Promise.resolve('[解密失败]'); }
  },

  _bufToB64: function(buf) {
    var s = '';
    for (var i = 0; i < buf.length; i++) s += String.fromCharCode(buf[i]);
    return btoa(s);
  },

  _b64ToBuf: function(b64) {
    var s = atob(b64), buf = new Array(s.length);
    for (var i = 0; i < s.length; i++) buf[i] = s.charCodeAt(i);
    return buf;
  }
};
