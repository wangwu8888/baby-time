// Supabase Polling Sync v7 - safe polling lock + no photo
var Sync = {
  myId: null, roomCode: null, rowId: null,
  myMood: null, partnerMood: null, partnerMessages: [],
  onChange: null, timer: null, _polling: 0,

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

  joinRoom: function(code, myName) {
    var self = this;
    this.roomCode = code;
    var q = 'room_code=eq.' + encodeURIComponent(code);
    var tries = 0;

    function go() {
      tries++;
      self._get(q, function(rows) {
        if (rows && rows.length) {
          var d = rows[0]; self.rowId = d.id;
          if (!d.user2_name || !d.user2_mood || !d.user2_mood.status) {
            self.myId = 2;
            self._patch(d.id, { user2_name: myName, user2_mood: { status: 'sunny', updatedAt: new Date().toISOString() } }, function() { self._finish(code); });
          } else {
            self.myId = d.user1_name === myName ? 1 : 2;
            self._finish(code);
          }
        } else {
          if (tries < 2) { setTimeout(go, 800); return; }
          self.myId = 1;
          self._post({
            room_code: code, user1_name: myName,
            user1_mood: { status: 'sunny', updatedAt: new Date().toISOString() },
            user2_name: '', user2_mood: { status: 'sunny', updatedAt: null }, messages: []
          }, function(r) {
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
    this._startPolling();
    if (this.onChange) this.onChange('ready');
  },

  // --- reconnect ---

  reconnect: function(cb) {
    var c = localStorage.getItem('sync_roomCode'), i = localStorage.getItem('sync_myId');
    if (!c || !i) return false;
    this.roomCode = c; this.myId = parseInt(i); this.onChange = cb;
    this._startPolling();
    return true;
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
      for (var i = 0; i < d.messages.length; i++) {
        var m = d.messages[i];
        if (m.sender === pi) {
          var seen = false;
          for (var j = 0; j < this.partnerMessages.length; j++) {
            if (this.partnerMessages[j].createdAt === m.createdAt) { seen = true; break; }
          }
          if (!seen) { this.partnerMessages.unshift(m); nc++; }
        }
      }
      if (nc > 0) {
        this.partnerMessages.sort(function(a, b) { return new Date(b.createdAt) - new Date(a.createdAt); });
        if (this.partnerMessages.length > 50) this.partnerMessages.length = 50;
        changed = true;
      }
    }

    if (changed && this.onChange) {
      this.onChange('data');
    }
  },

  // --- actions ---

  updateMood: function(st) {
    var self = this;
    if (!this.roomCode) return;
    var q = 'room_code=eq.' + encodeURIComponent(this.roomCode);
    this._get(q, function(rows) {
      if (!rows || !rows.length) return;
      var d = rows[0]; self.rowId = d.id;
      var mk = 'user' + self.myId + '_mood';
      var mood = { status: st, updatedAt: new Date().toISOString() };
      // Preserve existing photo field if any (leftover from v6, harmless)
      if (d[mk] && d[mk].photo) mood.photo = d[mk].photo;
      var up = {}; up[mk] = mood;
      self._patch(d.id, up, function() { self._poll(); });
    });
  },

  sendMessage: function(t, dd, mo) {
    var self = this;
    return new Promise(function(resolve) {
      if (!self.roomCode) { resolve({ error: '未连接' }); return; }
      var q = 'room_code=eq.' + encodeURIComponent(self.roomCode);
      self._get(q, function(rows) {
        if (!rows || !rows.length) { resolve({ error: '房间不存在' }); return; }
        var d = rows[0];
        if (!d.messages) d.messages = [];
        d.messages.push({
          sender: self.myId, text: t || '', doodleDataUrl: dd || null,
          mood: mo || 'sunny', createdAt: new Date().toISOString()
        });
        if (d.messages.length > 40) d.messages = d.messages.slice(-40);
        self._patch(d.id, { messages: d.messages }, function() { self._poll(); resolve({ success: true }); });
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
