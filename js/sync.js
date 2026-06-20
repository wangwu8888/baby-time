// Supabase Realtime Sync v2
var Sync = {
  myId: null, roomCode: null, rowId: null,
  myMood: null, partnerMood: null, partnerMessages: [],
  onChange: null, ws: null, channel: null,

  BASE: 'https://dunadheorduiyxmfzlfu.supabase.co/rest/v1/sync_data',
  KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR1bmFkaGVvcmR1aXl4bWZ6bGZ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE4OTQ0ODksImV4cCI6MjA5NzQ3MDQ4OX0.s8a5FLcmYmHv-1IaidLnu_5VRxJf6JEvsl8u20MpZcA',
  WS_URL: 'wss://dunadheorduiyxmfzlfu.supabase.co/realtime/v1/websocket',

  init: function(cb) { this.onChange = cb; },

  // Headers helper
  _h: function() { return {
    'apikey': this.KEY,
    'Authorization': 'Bearer ' + this.KEY,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
  }},

  // Generate a nice room code (easy to type)
  _genCode: function() { return Math.floor(1000 + Math.random() * 9000).toString(); },

  joinRoom: function(code, myName) {
    var self = this;
    if (!code) code = this._genCode();
    this.roomCode = code;

    var url = this.BASE + '?room_code=eq.' + encodeURIComponent(code) + '&limit=1';
    this._fetch('GET', url, null, function(rows) {
      if (rows && rows.length > 0) {
        var d = rows[0];
        self.rowId = d.id;
        if (!d.user2_name || !d.user2_mood || !d.user2_mood.status) {
          self.myId = 2;
          var up = { user2_name: myName, user2_mood: { status: 'sunny', updatedAt: new Date().toISOString() } };
          self._fetch('PATCH', self.BASE + '?id=eq.' + d.id, up, function() {
            self._finishJoin(code);
          });
        } else {
          self.myId = 1;
          self._finishJoin(code);
        }
      } else {
        self.myId = 1;
        var row = { room_code: code, user1_name: myName,
          user1_mood: { status: 'sunny', updatedAt: new Date().toISOString() },
          user2_name: '', user2_mood: { status: 'sunny', updatedAt: null }, messages: [] };
        self._fetch('POST', self.BASE, row, function(r) {
          if (r && r.length) self.rowId = r[0].id;
          self._finishJoin(code);
        });
      }
    });
  },

  _finishJoin: function(code) {
    localStorage.setItem('sync_roomCode', code);
    localStorage.setItem('sync_myId', String(this.myId));
    this._loadNow();
    this._listenRealtime();
    if (this.onChange) this.onChange('ready');
  },

  reconnect: function(cb) {
    var c = localStorage.getItem('sync_roomCode'), i = localStorage.getItem('sync_myId');
    if (!c || !i) return false;
    this.roomCode = c; this.myId = parseInt(i); this.onChange = cb;
    this._loadNow();
    this._listenRealtime();
    return true;
  },

  // Real-time via WebSocket
  _listenRealtime: function() {
    var self = this;
    if (this.ws) { this.ws.close(); this.ws = null; }

    try {
      this.ws = new WebSocket(this.WS_URL + '?apikey=' + this.KEY);
      var ch = 'sync_data:room_code=eq.' + this.roomCode;

      this.ws.onopen = function() {
        self.ws.send(JSON.stringify({
          type: 'phx_join', topic: 'realtime:' + ch,
          payload: { config: { postgres_changes: ['*'] } }, ref: '1'
        }));
        self.ws.send(JSON.stringify({ type: 'phx_join', topic: 'phoenix', payload: {}, ref: '2' }));
      };

      this.ws.onmessage = function(ev) {
        try {
          var msg = JSON.parse(ev.data);
          if (msg.event === 'phx_reply' && msg.payload && msg.payload.status === 'ok') {
            self.ws.send(JSON.stringify({
              type: 'phx_join', topic: 'realtime:' + ch,
              payload: {
                access_token: self.KEY,
                config: { broadcast: { self: true }, postgres_changes: [
                  { event: '*', schema: 'public', table: 'sync_data', filter: 'room_code=eq.' + self.roomCode }
                ]}
              }, ref: '3'
            }));
          }
          if (msg.payload && msg.payload.data && msg.payload.data.record) {
            self._process(msg.payload.data.record);
          }
        } catch(e) {}
      };

      this.ws.onerror = function() { self._fallbackPolling(); };
      this.ws.onclose = function() { self._fallbackPolling(); };
    } catch(e) {
      this._fallbackPolling();
    }
  },

  _fallbackPolling: function() {
    var self = this;
    setInterval(function() { self._loadNow(); }, 2000);
  },

  _loadNow: function() {
    var self = this;
    var url = this.BASE + '?room_code=eq.' + encodeURIComponent(this.roomCode) + '&limit=1';
    this._fetch('GET', url, null, function(rows) {
      if (rows && rows.length) { self._process(rows[0]); self.rowId = rows[0].id; }
    });
  },

  _process: function(d) {
    var changed = false, pi = this.myId === 1 ? 2 : 1, mk = 'user' + this.myId + '_', pk = 'user' + pi + '_';

    if (d[mk + 'mood'] && d[mk + 'mood'].status) this.myMood = d[mk + 'mood'];
    if (d[pk + 'mood'] && d[pk + 'mood'].status) {
      var pm = d[pk + 'mood'];
      if (!this.partnerMood || this.partnerMood.updatedAt !== pm.updatedAt) { this.partnerMood = pm; changed = true; }
    }
    if (d[pk + 'name']) { localStorage.setItem('sync_partnerName', d[pk + 'name']); }
    if (d.messages && d.messages.length) {
      var nc = 0;
      for (var i = 0; i < d.messages.length; i++) {
        var m = d.messages[i];
        if (m.sender === pi) {
          var ex = this.partnerMessages.some(function(x) { return x.createdAt === m.createdAt; });
          if (!ex) { this.partnerMessages.unshift(m); nc++; }
        }
      }
      if (nc > 0) { this.partnerMessages.sort(function(a, b) { return new Date(b.createdAt) - new Date(a.createdAt); }); changed = true; }
    }
    if (changed && this.onChange) this.onChange('data');
  },

  updateMood: function(st) {
    var self = this;
    if (!this.roomCode) return;
    var mk = 'user' + this.myId + '_mood';
    var up = {}; up[mk] = { status: st, updatedAt: new Date().toISOString() };
    var url = this.BASE + '?room_code=eq.' + encodeURIComponent(this.roomCode);
    var d = JSON.stringify(up);
    var x = new XMLHttpRequest(); x.open('PATCH', url, true);
    x.setRequestHeader('apikey', this.KEY); x.setRequestHeader('Authorization', 'Bearer ' + this.KEY);
    x.setRequestHeader('Content-Type', 'application/json'); x.send(d);
  },

  sendMessage: function(t, dd, mo) {
    var self = this;
    return new Promise(function(r) {
      if (!self.roomCode || !self.rowId) { r({ error: '未连接' }); return; }
      var url = self.BASE + '?room_code=eq.' + encodeURIComponent(self.roomCode) + '&limit=1';
      self._fetch('GET', url, null, function(rows) {
        if (!rows || !rows.length) { r({ error: '房间不存在' }); return; }
        var d = rows[0];
        if (!d.messages) d.messages = [];
        d.messages.push({ sender: self.myId, text: t || '', doodleDataUrl: dd || null,
          mood: mo || 'sunny', createdAt: new Date().toISOString() });
        if (d.messages.length > 100) d.messages = d.messages.slice(-100);
        self._fetch('PATCH', self.BASE + '?id=eq.' + d.id, { messages: d.messages }, function() {
          r({ success: true });
        });
      });
    });
  },

  _fetch: function(method, url, body, cb) {
    var x = new XMLHttpRequest();
    x.open(method, url, true);
    var h = this._h(); Object.keys(h).forEach(function(k) { x.setRequestHeader(k, h[k]); });
    x.timeout = 8000;
    x.onload = function() { if (x.status >= 200 && x.status < 300) { try { cb(JSON.parse(x.responseText)); } catch(e) { cb(null); } } else { cb(null); } };
    x.onerror = function() { cb(null); };
    x.send(body ? JSON.stringify(body) : null);
  },

  leave: function() {
    if (this.ws) { this.ws.close(); this.ws = null; }
    localStorage.removeItem('sync_roomCode'); localStorage.removeItem('sync_myId');
    this.roomCode = null; this.myId = null;
  }
};
