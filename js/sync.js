// Supabase Polling Sync v7 - safe polling lock + no photo
var Sync = {
  myId: null, roomCode: null, rowId: null,
  myMood: null, partnerMood: null, partnerMessages: [],
  onChange: null, timer: null, _polling: 0,

  BASE: 'https://dunadheorduiyxmfzlfu.supabase.co/rest/v1/sync_data',
  KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR1bmFkaGVvcmR1aXl4bWZ6bGZ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE4OTQ0ODksImV4cCI6MjA5NzQ3MDQ4OX0.s8a5FLcmYmHv-1IaidLnu_5VRxJf6JEvsl8u20MpZcA',

  init: function(cb) {
    this.onChange = cb;
    var self = this;
    document.addEventListener('visibilitychange', function() {
      if (!document.hidden) self._onVisible();
    });
    window.addEventListener('pageshow', function() {
      if (self.roomCode) self._startPolling();
    });
  },

  _h: function() {
    return {
      'apikey': this.KEY,
      'Authorization': 'Bearer ' + this.KEY,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    };
  },

  _ajax: function(method, url, body, cb, retry) {
    retry = retry || 0;
    var self = this;
    var x = new XMLHttpRequest();
    x.open(method, url, true);
    var h = this._h(); for (var k in h) { x.setRequestHeader(k, h[k]); }
    x.timeout = 8000;
    var fired = false;
    function done() { if (!fired) { fired = true; return true; } return false; }
    x.onload = function() {
      if (!done()) return;
      if (method === 'GET' && x.status === 200) {
        try { cb(JSON.parse(x.responseText)); } catch(e) { cb(null); }
      } else if ((method === 'PATCH' && (x.status === 200 || x.status === 204)) || (method === 'POST' && x.status === 201)) {
        try { var r = x.status === 204 ? null : JSON.parse(x.responseText); cb(r); } catch(e) { cb(null); }
      } else if (retry < 2) {
        setTimeout(function() { self._ajax(method, url, body, cb, retry + 1); }, 1500);
      } else {
        cb(null);
      }
    };
    x.onerror = function() {
      if (!done()) return;
      if (retry < 2) { setTimeout(function() { self._ajax(method, url, body, cb, retry + 1); }, 1500); }
      else { cb(null); }
    };
    x.ontimeout = function() {
      if (!done()) return;
      if (retry < 2) { setTimeout(function() { self._ajax(method, url, body, cb, retry + 1); }, 1500); }
      else { cb(null); }
    };
    x.send(body || null);
  },

  _get: function(q, cb) { this._ajax('GET', this.BASE + '?' + q + '&limit=1', null, cb); },
  _post: function(data, cb) { this._ajax('POST', this.BASE, JSON.stringify(data), cb); },
  _patch: function(id, data, cb) { this._ajax('PATCH', this.BASE + '?id=eq.' + id, JSON.stringify(data), cb); },

  // --- pairing ---

  joinRoom: function(code, myCode, partnerCode) {
    var self = this;
    this.roomCode = code;
    // Deterministic slot: alphabetically smaller code = user1
    var sorted = [myCode, partnerCode].sort();
    this._mySlot = sorted[0] === myCode ? 1 : 2;
    var q = 'room_code=eq.' + encodeURIComponent(code);
    var tries = 0;

    function go() {
      tries++;
      self._get(q, function(rows) {
        if (rows && rows.length) {
          var d = rows[0]; self.rowId = d.id;
          // Check if my pair code already stored in a slot
          if (d.user1_name === myCode) { self.myId = 1; self._finish(code); return; }
          if (d.user2_name === myCode) { self.myId = 2; self._finish(code); return; }
          // Migration: old rooms used '我' as name — update the correct slot
          if (d.user1_name === '我' && self._mySlot === 1) {
            self.myId = 1;
            self._patch(d.id, { user1_name: myCode }, function() { self._finish(code); });
            return;
          }
          if (d.user2_name === '我' && self._mySlot === 2) {
            self.myId = 2;
            self._patch(d.id, { user2_name: myCode }, function() { self._finish(code); });
            return;
          }
          // Take the deterministic slot
          var slotData = {};
          if (self._mySlot === 1) {
            self.myId = 1;
            slotData.user1_name = myCode;
          } else {
            self.myId = 2;
            slotData.user2_name = myCode;
            slotData.user2_mood = { status: 'sunny', updatedAt: new Date().toISOString() };
          }
          self._patch(d.id, slotData, function() { self._finish(code); });
        } else {
          if (tries < 2) { setTimeout(go, 800); return; }
          self.myId = self._mySlot;
          var row = {
            room_code: code,
            user1_name: self._mySlot === 1 ? myCode : partnerCode,
            user1_mood: { status: 'sunny', updatedAt: new Date().toISOString() },
            user2_name: self._mySlot === 2 ? myCode : partnerCode,
            user2_mood: { status: 'sunny', updatedAt: new Date().toISOString() },
            messages: []
          };
          self._post(row, function(r) {
            if (r && r.id) self.rowId = r.id;
            self._finish(code);
          });
        }
      });
    }
    go();
  },

  _finish: function(code) {
    localStorage.setItem('sync_roomCode', code);
    localStorage.setItem('sync_myId', String(this.myId));
    if (typeof Crypto !== 'undefined') Crypto.init(code);
    this._startPolling();
    if (this.onChange) this.onChange('ready');
  },

  // --- reconnect ---

  reconnect: function(cb) {
    var c = localStorage.getItem('sync_roomCode'), i = localStorage.getItem('sync_myId');
    if (!c || !i) return false;
    this.roomCode = c; this.myId = parseInt(i); this.onChange = cb;
    if (typeof Crypto !== 'undefined') Crypto.init(c);
    this._startPolling();
    return true;
  },

  // --- visibility handling (mobile browser kills timers in background) ---

  _lastPollOk: 0,  // timestamp of last successful poll

  _onVisible: function() {
    var self = this;
    if (!this.roomCode) return;
    // If page was hidden > 3s, restart polling fresh
    var gap = new Date() - this._lastPollOk;
    if (gap > 3000) {
      this._startPolling();
    }
  },

  // --- polling with safe lock ---

  _startPolling: function() {
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
    var self = this;
    self._poll();
    this.timer = setInterval(function() { self._poll(); }, 2500);
  },

  _poll: function() {
    var self = this;
    if (!this.roomCode) return;
    // safe lock: skip if another poll is in-flight (max 15s timeout to prevent deadlock)
    if (this._polling && (new Date() - this._polling < 15000)) return;
    this._polling = new Date();
    var q = 'room_code=eq.' + encodeURIComponent(this.roomCode);
    this._get(q, function(rows) {
      if (rows && rows.length) {
        self.rowId = rows[0].id;
        self._lastPollOk = new Date();
        try { self._process(rows[0]); } catch(e) {}
      }
      self._polling = 0;
    });
  },

  _process: function(d) {
    var changed = false;
    var pi = this.myId === 1 ? 2 : 1;
    var mk = 'user' + this.myId + '_';
    var pk = 'user' + pi + '_';

    if (d[mk + 'mood'] && d[mk + 'mood'].status) {
      this.myMood = d[mk + 'mood'];
    }

    if (d[pk + 'mood'] && d[pk + 'mood'].status) {
      var pm = d[pk + 'mood'];
      if (!this.partnerMood || this.partnerMood.updatedAt !== pm.updatedAt) {
        this.partnerMood = pm;
        changed = true;
      }
    }

    if (d.messages && d.messages.length) {
      var nc = 0;
      var fresh = [];
      for (var i = 0; i < d.messages.length; i++) {
        var m = d.messages[i];
        if (m.sender === pi) {
          var seen = false;
          for (var j = 0; j < this.partnerMessages.length; j++) {
            if (this.partnerMessages[j].createdAt === m.createdAt) { seen = true; break; }
          }
          if (!seen) {
            var clone = { sender: m.sender, text: m.text, doodleDataUrl: m.doodleDataUrl, mood: m.mood, createdAt: m.createdAt, hasPhoto: m.hasPhoto };
            this.partnerMessages.unshift(clone); fresh.push(clone); nc++;
          }
        }
      }
      if (nc > 0) {
        this.partnerMessages.sort(function(a, b) { return new Date(b.createdAt) - new Date(a.createdAt); });
        if (this.partnerMessages.length > 100) this.partnerMessages.length = 100;
        changed = true;
        // async decrypt — fires onChange again when done
        this._decryptMessages(fresh);
      }
    }

    if (changed && this.onChange) {
      this.onChange('data');
    }
  },

  _decryptMessages: function(msgs) {
    var self = this;
    if (typeof Crypto === 'undefined' || !Crypto._ready) return;
    if (!msgs.length) return;
    var tasks = [];
    for (var i = 0; i < msgs.length; i++) {
      (function(m) {
        tasks.push(Crypto.decrypt(m.text).then(function(plain) { m.text = plain; }));
      })(msgs[i]);
    }
    Promise.all(tasks).then(function() {
      if (self.onChange) self.onChange('data');
    });
  },

  // --- actions ---

  updateMood: function(st, retry) {
    retry = retry || 0;
    var self = this;
    if (!this.roomCode) return;
    var q = 'room_code=eq.' + encodeURIComponent(this.roomCode);
    this._get(q, function(rows) {
      if (!rows || !rows.length) {
        if (retry < 3) { setTimeout(function() { self.updateMood(st, retry + 1); }, 1500); }
        return;
      }
      var d = rows[0]; self.rowId = d.id;
      var mk = 'user' + self.myId + '_mood';
      var mood = { status: st, updatedAt: new Date().toISOString() };
      if (d[mk] && d[mk].photo) mood.photo = d[mk].photo;
      var up = {}; up[mk] = mood;
      self._patch(d.id, up, function() { self._poll(); });
    });
  },

  sendMessage: function(t, dd, mo, retry) {
    retry = retry || 0;
    var self = this;
    // Encrypt text if crypto available
    var encryptPromise = (typeof Crypto !== 'undefined' && Crypto._ready)
      ? Crypto.encrypt(t || '') : Promise.resolve(t || '');
    return encryptPromise.then(function(encText) {
      return new Promise(function(resolve) {
        if (!self.roomCode) { resolve({ error: '未连接' }); return; }
        var q = 'room_code=eq.' + encodeURIComponent(self.roomCode);
        self._get(q, function(rows) {
          if (!rows || !rows.length) {
            if (retry < 3) {
              setTimeout(function() { self.sendMessage(t, dd, mo, retry + 1).then(resolve); }, 1500);
            } else {
              resolve({ error: '房间不存在' });
            }
            return;
          }
          var d = rows[0];
          if (!d.messages) d.messages = [];
          d.messages.push({
            sender: self.myId, text: encText, doodleDataUrl: dd || null,
            mood: mo || 'sunny', createdAt: new Date().toISOString()
          });
          if (d.messages.length > 100) d.messages = d.messages.slice(-100);
          self._patch(d.id, { messages: d.messages }, function() { self._poll(); resolve({ success: true }); });
        });
      });
    });
  },

  leave: function() {
    if (this.timer) clearInterval(this.timer);
    localStorage.removeItem('sync_roomCode');
    localStorage.removeItem('sync_myId');
    this.roomCode = null; this.myId = null;
  }
};
