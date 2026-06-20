// Supabase Polling Sync v5 - concurrent-safe + photo support
var Sync = {
  myId: null, roomCode: null, rowId: null,
  myMood: null, partnerMood: null, partnerMessages: [],
  onChange: null, timer: null, _polling: false,

  BASE: 'https://dunadheorduiyxmfzlfu.supabase.co/rest/v1/sync_data',
  KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR1bmFkaGVvcmR1aXl4bWZ6bGZ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE4OTQ0ODksImV4cCI6MjA5NzQ3MDQ4OX0.s8a5FLcmYmHv-1IaidLnu_5VRxJf6JEvsl8u20MpZcA',

  init: function(cb) { this.onChange = cb; },

  _h: function() {
    return {
      'apikey': this.KEY,
      'Authorization': 'Bearer ' + this.KEY,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    };
  },

  _get: function(q, cb, retry) {
    retry = retry || 0;
    var self = this;
    var x = new XMLHttpRequest();
    x.open('GET', this.BASE + '?' + q + '&limit=1', true);
    var h = this._h(); Object.keys(h).forEach(function(k) { x.setRequestHeader(k, h[k]); });
    x.timeout = 8000;
    var done = false;
    x.onload = function() {
      if (done) return; done = true;
      if (x.status === 200) {
        try { cb(JSON.parse(x.responseText)); } catch(e) { cb(null); }
      } else if (retry < 2) {
        setTimeout(function() { self._get(q, cb, retry + 1); }, 1000);
      } else {
        cb(null);
      }
    };
    x.onerror = function() {
      if (done) return; done = true;
      if (retry < 2) {
        setTimeout(function() { self._get(q, cb, retry + 1); }, 1000);
      } else {
        cb(null);
      }
    };
    x.ontimeout = function() {
      if (done) return; done = true;
      if (retry < 2) {
        setTimeout(function() { self._get(q, cb, retry + 1); }, 1000);
      } else {
        cb(null);
      }
    };
    x.send();
  },

  _post: function(data, cb, retry) {
    retry = retry || 0;
    var self = this;
    var x = new XMLHttpRequest();
    x.open('POST', this.BASE, true);
    var h = this._h(); Object.keys(h).forEach(function(k) { x.setRequestHeader(k, h[k]); });
    x.timeout = 8000;
    var done = false;
    x.onload = function() {
      if (done) return; done = true;
      if (x.status === 201) {
        try { var r = JSON.parse(x.responseText); cb(r.length ? r[0] : data); } catch(e) { cb(data); }
      } else if (retry < 2) {
        setTimeout(function() { self._post(data, cb, retry + 1); }, 1000);
      } else {
        cb(data);
      }
    };
    x.onerror = function() {
      if (done) return; done = true;
      if (retry < 2) {
        setTimeout(function() { self._post(data, cb, retry + 1); }, 1000);
      } else {
        cb(data);
      }
    };
    x.ontimeout = function() {
      if (done) return; done = true;
      if (retry < 2) {
        setTimeout(function() { self._post(data, cb, retry + 1); }, 1000);
      } else {
        cb(data);
      }
    };
    x.send(JSON.stringify(data));
  },

  _patch: function(id, data, cb, retry) {
    retry = retry || 0;
    var self = this;
    var x = new XMLHttpRequest();
    x.open('PATCH', this.BASE + '?id=eq.' + id, true);
    var h = this._h(); Object.keys(h).forEach(function(k) { x.setRequestHeader(k, h[k]); });
    x.timeout = 8000;
    var done = false;
    x.onload = function() {
      if (done) return; done = true;
      if (x.status === 204 || x.status === 200) {
        if (cb) cb();
      } else if (retry < 2) {
        setTimeout(function() { self._patch(id, data, cb, retry + 1); }, 1000);
      } else {
        if (cb) cb();
      }
    };
    x.onerror = function() {
      if (done) return; done = true;
      if (retry < 2) {
        setTimeout(function() { self._patch(id, data, cb, retry + 1); }, 1000);
      } else {
        if (cb) cb();
      }
    };
    x.ontimeout = function() {
      if (done) return; done = true;
      if (retry < 2) {
        setTimeout(function() { self._patch(id, data, cb, retry + 1); }, 1000);
      } else {
        if (cb) cb();
      }
    };
    x.send(JSON.stringify(data));
  },

  joinRoom: function(code, myName) {
    var self = this;
    this.roomCode = code;
    var q = 'room_code=eq.' + encodeURIComponent(code);
    var attempts = 0;

    function tryJoin() {
      attempts++;
      self._get(q, function(rows) {
        if (rows && rows.length) {
          var d = rows[0];
          self.rowId = d.id;
          if (!d.user2_name || !d.user2_mood || !d.user2_mood.status) {
            self.myId = 2;
            self._patch(d.id, { user2_name: myName, user2_mood: { status: 'sunny', updatedAt: new Date().toISOString() } }, function() {
              self._finish(code);
            });
          } else {
            self.myId = d.user1_name === myName ? 1 : 2;
            self._finish(code);
          }
        } else {
          if (attempts < 2) {
            setTimeout(tryJoin, 800);
            return;
          }
          self.myId = 1;
          var row = {
            room_code: code,
            user1_name: myName,
            user1_mood: { status: 'sunny', updatedAt: new Date().toISOString() },
            user2_name: '',
            user2_mood: { status: 'sunny', updatedAt: null },
            messages: []
          };
          self._post(row, function(r) {
            if (r && r.id) self.rowId = r.id;
            self._finish(code);
          });
        }
      });
    }
    tryJoin();
  },

  _finish: function(code) {
    localStorage.setItem('sync_roomCode', code);
    localStorage.setItem('sync_myId', String(this.myId));
    this._startPolling();
    if (this.onChange) this.onChange('ready');
  },

  reconnect: function(cb) {
    var c = localStorage.getItem('sync_roomCode'), i = localStorage.getItem('sync_myId');
    if (!c || !i) return false;
    this.roomCode = c; this.myId = parseInt(i); this.onChange = cb;
    this._startPolling();
    return true;
  },

  _startPolling: function() {
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
    var self = this;
    self._poll();
    this.timer = setInterval(function() { self._poll(); }, 2000);
  },

  _poll: function() {
    var self = this;
    if (!this.roomCode) return;
    if (this._polling) return;  // prevent concurrent polls
    this._polling = true;
    var q = 'room_code=eq.' + encodeURIComponent(this.roomCode);
    this._get(q, function(rows) {
      if (rows && rows.length) {
        self.rowId = rows[0].id;
        self._process(rows[0]);
      }
      self._polling = false;
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

    // Messages from partner (text only, photos handled separately)
    if (d.messages && d.messages.length) {
      var nc = 0;
      for (var i = 0; i < d.messages.length; i++) {
        var m = d.messages[i];
        if (m.sender === pi) {
          var ex = this.partnerMessages.some(function(x) { return x.createdAt === m.createdAt; });
          if (!ex) { this.partnerMessages.unshift(m); nc++; }
        }
      }
      if (nc > 0) {
        this.partnerMessages.sort(function(a, b) { return new Date(b.createdAt) - new Date(a.createdAt); });
        changed = true;
      }
    }

    // Partner's latest photo (stored as separate column to keep messages small)
    var photoKey = pk + 'photo';
    if (d[photoKey]) {
      if (!this._partnerPhoto || this._partnerPhoto !== d[photoKey]) {
        this._partnerPhoto = d[photoKey];
        changed = true;
      }
    }

    if (changed && this.onChange) {
      this.onChange('data');
    }
  },

  _partnerPhoto: null,
  getPartnerPhoto: function() { return this._partnerPhoto || null; },

  updateMood: function(st) {
    var self = this;
    if (!this.roomCode) return;
    var q = 'room_code=eq.' + encodeURIComponent(this.roomCode);
    this._get(q, function(rows) {
      if (!rows || !rows.length) return;
      var d = rows[0]; self.rowId = d.id;
      var mk = 'user' + self.myId + '_mood';
      var up = {};
      up[mk] = { status: st, updatedAt: new Date().toISOString() };
      self._patch(d.id, up, function(){ self._poll(); });
    });
  },

  // Send text/doodle message (no photo - photos go via sharePhoto)
  sendMessage: function(t, dd, mo) {
    var self = this;
    return new Promise(function(r) {
      if (!self.roomCode) { r({ error: '未连接' }); return; }
      var q = 'room_code=eq.' + encodeURIComponent(self.roomCode);
      self._get(q, function(rows) {
        if (!rows || !rows.length) { r({ error: '房间不存在' }); return; }
        var d = rows[0];
        if (!d.messages) d.messages = [];
        d.messages.push({
          sender: self.myId,
          text: t || '',
          doodleDataUrl: dd || null,
          mood: mo || 'sunny',
          createdAt: new Date().toISOString()
        });
        // Keep messages lean
        if (d.messages.length > 40) d.messages = d.messages.slice(-40);
        self._patch(d.id, { messages: d.messages }, function() { self._poll(); r({ success: true }); });
      });
    });
  },

  // Share photo: stored as separate column so messages stay small
  sharePhoto: function(photoDataUrl) {
    var self = this;
    return new Promise(function(r) {
      if (!self.roomCode) { r({ error: '未连接' }); return; }
      var q = 'room_code=eq.' + encodeURIComponent(self.roomCode);
      self._get(q, function(rows) {
        if (!rows || !rows.length) { r({ error: '房间不存在' }); return; }
        var d = rows[0];
        var photoKey = 'user' + self.myId + '_photo';
        var up = {};
        up[photoKey] = photoDataUrl;
        // Also add a marker message so partner knows there's a new photo
        if (!d.messages) d.messages = [];
        d.messages.push({
          sender: self.myId,
          text: '',
          doodleDataUrl: null,
          mood: 'sunny',
          createdAt: new Date().toISOString(),
          hasPhoto: true
        });
        if (d.messages.length > 40) d.messages = d.messages.slice(-40);
        up.messages = d.messages;
        self._patch(d.id, up, function() { self._poll(); r({ success: true }); });
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
