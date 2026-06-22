// Sync v8 — new tables (users, rooms, messages, moods)
var Sync = {
  userId: null, roomId: null, roomCode: null,
  myId: 1,  // compatibility: truthy for old doJoin() check
  partnerId: null, partnerName: null,
  myMood: null, partnerMood: null, partnerMessages: [],
  onChange: null, timer: null, _polling: 0,

  init: function(cb) { this.onChange = cb; },

  // ========== User Identity ==========

  _initUser: function(cb) {
    var self = this;
    var uid = localStorage.getItem('user_id');
    if (uid) {
      this.userId = uid;
      SUPABASE.get('users', 'user_id=eq.' + encodeURIComponent(uid) + '&limit=1', function(rows) {
        if (!rows || !rows.length) {
          var nick = localStorage.getItem('sync_partnerName') || '我';
          SUPABASE.post('users', { user_id: uid, nickname: nick }, function() {});
        }
        cb();
      });
    } else {
      uid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      });
      this.userId = uid;
      localStorage.setItem('user_id', uid);
      SUPABASE.post('users', { user_id: uid, nickname: '' }, function() { cb(); });
    }
  },

  // ========== Room / Pairing ==========

  joinRoom: function(code, myCode, partnerCode) {
    var self = this;
    this.roomCode = code;
    this._initUser(function() {
      SUPABASE.get('rooms', 'room_code=eq.' + encodeURIComponent(code) + '&limit=1', function(rows) {
        if (rows && rows.length) {
          var room = rows[0];
          self.roomId = room.id;
          // Join as member
          SUPABASE.post('room_members', { room_id: room.id, user_id: self.userId }, function() {
            SUPABASE.patch('rooms', 'id=eq.' + room.id, { member_count: 2 }, function() {});
            self._loadPartner(function() { self._finish(code); });
          });
        } else {
          var pwdHash = self._hashCode(code);
          SUPABASE.post('rooms', {
            room_code: code, password_hash: pwdHash,
            creator_user_id: self.userId, member_count: 1
          }, function(newRoom) {
            if (newRoom && newRoom.length) {
              self.roomId = newRoom[0].id;
              SUPABASE.post('room_members', { room_id: self.roomId, user_id: self.userId }, function() {
                self._finish(code);
              });
            } else { self._finish(code); }
          });
        }
      });
    });
  },

  _loadPartner: function(cb) {
    var self = this;
    if (!this.roomId) { cb(); return; }
    SUPABASE.get('room_members', 'room_id=eq.' + encodeURIComponent(this.roomId), function(members) {
      if (members) {
        for (var i = 0; i < members.length; i++) {
          if (members[i].user_id !== self.userId) {
            self.partnerId = members[i].user_id;
            SUPABASE.get('users', 'user_id=eq.' + encodeURIComponent(self.partnerId) + '&limit=1', function(users) {
              if (users && users.length) {
                self.partnerName = users[0].nickname || 'TA';
              }
              localStorage.setItem('sync_partnerId', self.partnerId);
              localStorage.setItem('sync_partnerName', self.partnerName || 'TA');
              cb();
            });
            return;
          }
        }
      }
      cb();
    });
  },

  _hashCode: function(str) {
    var h = 0;
    for (var i = 0; i < str.length; i++) { h = ((h << 5) - h) + str.charCodeAt(i); h |= 0; }
    return 'pwd_' + Math.abs(h).toString(16);
  },

  _finish: function(code) {
    localStorage.setItem('sync_roomCode', code);
    localStorage.setItem('sync_roomId', this.roomId);
    localStorage.setItem('sync_userId', this.userId);
    this._startPolling();
    if (this.onChange) this.onChange('ready');
  },

  // ========== Reconnect ==========

  reconnect: function(cb) {
    var code = localStorage.getItem('sync_roomCode');
    var rid = localStorage.getItem('sync_roomId');
    var uid = localStorage.getItem('sync_userId');
    if (!code || !uid) return false;

    this.roomCode = code;
    this.roomId = rid;
    this.userId = uid;
    this.partnerId = localStorage.getItem('sync_partnerId') || null;
    this.partnerName = localStorage.getItem('sync_partnerName') || 'TA';
    this.onChange = cb;

    var self = this;
    SUPABASE.get('users', 'user_id=eq.' + encodeURIComponent(uid) + '&limit=1', function(rows) {
      if (!rows || !rows.length) {
        SUPABASE.post('users', { user_id: uid, nickname: self.partnerName || '我' }, function() {});
      }
      if (self.roomId) {
        self._loadPartner(function() { self._startPolling(); });
      } else {
        self._startPolling();
      }
    });
    return true;
  },

  // ========== Polling ==========

  _startPolling: function() {
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
    this.partnerMessages = [];
    var self = this;
    self._poll();
    this.timer = setInterval(function() { self._poll(); }, 2500);
    document.addEventListener('visibilitychange', function() {
      if (!document.hidden && self.roomCode) self._poll();
    });
  },

  _poll: function() {
    var self = this;
    if (!this.roomCode) return;
    if (this._polling && (new Date() - this._polling < 15000)) return;
    this._polling = new Date();

    var done = 0, changed = false;
    function check() { done++; if (done >= 2) { self._polling = 0; if (changed && self.onChange) self.onChange('data'); } }

    // Poll partner mood
    if (this.partnerId) {
      SUPABASE.get('moods', 'user_id=eq.' + encodeURIComponent(this.partnerId) + '&limit=1', function(rows) {
        if (rows && rows.length) {
          var pm = { status: rows[0].status, updatedAt: rows[0].updated_at };
          if (!self.partnerMood || self.partnerMood.updatedAt !== rows[0].updated_at) {
            self.partnerMood = pm; changed = true;
          }
        }
        check();
      });
    } else { check(); }

    // Poll messages
    if (this.roomId) {
      SUPABASE.get('messages', 'room_id=eq.' + encodeURIComponent(this.roomId) + '&order=created_at.desc&limit=30', function(rows) {
        if (rows && rows.length) {
          var nc = 0;
          for (var i = rows.length - 1; i >= 0; i--) {
            var m = rows[i];
            if (m.sender_user_id !== self.userId) {
              var seen = false;
              for (var j = 0; j < self.partnerMessages.length; j++) {
                if (self.partnerMessages[j].id === m.id) { seen = true; break; }
              }
              if (!seen) {
                var c = m.content;
                if (typeof c === 'string') { try { c = JSON.parse(c); } catch(e) { c = {}; } }
                var msgObj = {
                  id: m.id, sender: 2,
                  text: c.text || '', doodleDataUrl: m.type === 'doodle' ? (c.doodleDataUrl || c.text) : null,
                  mood: c.mood || 'sunny', type: m.type, createdAt: m.created_at
                };
                self.partnerMessages.push(msgObj);
                // Decrypt if needed
                if (c.encrypted && typeof Crypto !== 'undefined' && Crypto._ready) {
                  Crypto.decrypt(c.text).then(function(plain) { msgObj.text = plain; });
                }
                nc++;
              }
            }
          }
          if (nc > 0) {
            self.partnerMessages.sort(function(a, b) { return new Date(b.createdAt) - new Date(a.createdAt); });
            if (self.partnerMessages.length > 100) self.partnerMessages.length = 100;
            changed = true;
          }
        }
        check();
      });
    } else { check(); }
  },

  // ========== Actions ==========

  updateMood: function(st) {
    var self = this;
    if (!this.userId) return;
    var body = { user_id: this.userId, room_id: this.roomId || null, status: st, updated_at: new Date().toISOString() };
    SUPABASE.get('moods', 'user_id=eq.' + encodeURIComponent(this.userId) + '&limit=1', function(rows) {
      if (rows && rows.length) {
        SUPABASE.patch('moods', 'user_id=eq.' + encodeURIComponent(self.userId), body, function() {
          self.myMood = { status: st, updatedAt: body.updated_at };
        });
      } else {
        SUPABASE.post('moods', body, function() {
          self.myMood = { status: st, updatedAt: body.updated_at };
        });
      }
    });
    // Mood change message
    if (this.roomId) {
      SUPABASE.post('messages', {
        room_id: this.roomId, sender_user_id: this.userId,
        type: 'mood_change', content: { mood: st }, created_at: new Date().toISOString()
      }, function() {});
    }
  },

  sendMessage: function(t, dd, mo) {
    var self = this;
    return new Promise(function(resolve) {
      if (!self.roomId || !self.userId) { resolve({ error: '未连接' }); return; }
      // Encrypt text if crypto available
      var textPromise = (typeof Crypto !== 'undefined' && Crypto._ready)
        ? Crypto.encrypt(t || '') : Promise.resolve(t || '');
      textPromise.then(function(encText) {
        var msg = {
          room_id: self.roomId, sender_user_id: self.userId,
          type: dd ? 'doodle' : 'text',
          content: { text: encText, doodleDataUrl: dd || null, mood: mo || 'sunny', encrypted: typeof Crypto !== 'undefined' && Crypto._ready },
          created_at: new Date().toISOString()
        };
        SUPABASE.post('messages', msg, function(result) {
          resolve({ success: true, id: result && result.length ? result[0].id : null });
        });
      });
    });
  },

  leave: function() {
    if (this.timer) clearInterval(this.timer);
    if (this.roomId && this.userId) {
      SUPABASE.delete('room_members', 'room_id=eq.' + encodeURIComponent(this.roomId) + '&user_id=eq.' + encodeURIComponent(this.userId), function() {});
    }
    localStorage.removeItem('sync_roomCode');
    localStorage.removeItem('sync_roomId');
    localStorage.removeItem('sync_userId');
    localStorage.removeItem('sync_partnerId');
    this.roomCode = null; this.roomId = null; this.partnerId = null;
  }
};
