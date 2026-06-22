// Sync v8 — new tables (users, rooms, messages, moods)
// Encryption: disabled for stability. Set to true to re-enable.
var ENCRYPTION_ENABLED = false;
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
      localStorage.setItem('sync_userId', uid);
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
      localStorage.setItem('sync_userId', uid);
      SUPABASE.post('users', { user_id: uid, nickname: '' }, function() { cb(); });
    }
  },

  // ========== Room / Pairing ==========

  // Generate random room code (fresh each time, like 网易云一起听)
  _generateRoomCode: function() {
    var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', code = '';
    for (var i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return code;
  },

  // Create a new room (always fresh random code)
  createRoom: function(password, cb) {
    var self = this;
    this._initUser(function() {
      // Leave any existing room first
      if (self.roomId) self.leave();

      var code = self._generateRoomCode();
      var pwdHash = self._hashCode(code + password);
      self.roomCode = code;
      SUPABASE.post('rooms', {
        room_code: code, password_hash: pwdHash,
        creator_user_id: self.userId, member_count: 1
      }, function(newRoom) {
        if (newRoom && newRoom.length) {
          self.roomId = newRoom[0].id;
          SUPABASE.post('room_members', { room_id: self.roomId, user_id: self.userId }, function() {
            self._finish(code);
            self._startPolling();
            cb({ roomCode: code });
          });
        } else {
          cb({ error: '创建失败，请重试' });
        }
      });
    });
  },

  // Join existing room
  joinRoom: function(code, password, cb) {
    var self = this;
    code = code.toUpperCase();
    this.roomCode = code;
    this._initUser(function() {
      SUPABASE.get('rooms', 'room_code=eq.' + encodeURIComponent(code) + '&limit=1', function(rows) {
        if (!rows || !rows.length) { cb({ error: '房间不存在' }); return; }
        var room = rows[0];
        var pwdHash = self._hashCode(code + password);
        if (room.password_hash !== pwdHash) { cb({ error: '密码错误' }); return; }
        self.roomId = room.id;
        SUPABASE.get('room_members', 'room_id=eq.' + encodeURIComponent(room.id) + '&user_id=eq.' + encodeURIComponent(self.userId), function(members) {
          if (members && members.length) {
            self._loadPartner(function() { self._finish(code); cb({ success: true }); });
          } else {
            SUPABASE.post('room_members', { room_id: room.id, user_id: self.userId }, function() {
              SUPABASE.patch('rooms', 'id=eq.' + room.id, { member_count: 2 }, function() {});
              self._loadPartner(function() { self._finish(code); cb({ success: true }); });
            });
          }
        });
      });
    });
  },

  _loadPartner: function(cb) {
    var self = this;
    if (!this.roomId) { cb(); return; }
    var hadPartner = this.partnerId;
    SUPABASE.get('room_members', 'room_id=eq.' + encodeURIComponent(this.roomId), function(members) {
      var foundPartner = null;
      if (members) {
        for (var i = 0; i < members.length; i++) {
          if (members[i].user_id !== self.userId) {
            foundPartner = members[i].user_id;
            break;
          }
        }
      }
      if (foundPartner) {
        var isNew = !hadPartner;
        self.partnerId = foundPartner;
        SUPABASE.get('users', 'user_id=eq.' + encodeURIComponent(foundPartner) + '&limit=1', function(users) {
          if (users && users.length) {
            self.partnerName = users[0].nickname || 'TA';
          }
          localStorage.setItem('sync_partnerId', self.partnerId);
          if (!localStorage.getItem('sync_partnerName_custom')) {
            localStorage.setItem('sync_partnerName', self.partnerName || 'TA');
          }
          if (isNew && self.onChange) self.onChange('paired');
          cb();
        });
      } else {
        // No partner found
        if (hadPartner && self.onChange) self.onChange('partner_left');
        self.partnerId = null;
        self.partnerName = null;
        self.partnerMood = null;
        self.partnerMessages = [];
        localStorage.removeItem('sync_partnerId');
        localStorage.removeItem('sync_partnerName');
        localStorage.removeItem('sync_partnerName_custom');
        cb();
      }
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
    localStorage.setItem('user_id', this.userId);
    var self = this;
    function doStart() { self._startPolling(); if (self.onChange) self.onChange('ready'); }
    // Always init Crypto for decrypting old messages, even if new ones aren't encrypted
    if (typeof Crypto !== 'undefined') {
      Crypto.init(code).then(doStart).catch(doStart);
    } else {
      doStart();
    }
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
    this.partnerId = null; // Will be discovered by _loadPartner
    this.partnerName = localStorage.getItem('sync_partnerName') || 'TA';
    this.onChange = cb;

    var self = this;
    // Ensure encryption key is ready before starting poll
    function doConnect() {
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
    }
    // Always init Crypto for decrypting old messages
    if (typeof Crypto !== 'undefined') {
      Crypto.init(code).then(doConnect).catch(doConnect);
    } else {
      doConnect();
    }
    return true;
  },

  // ========== Polling ==========

  _startPolling: function() {
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
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

    // Check partner status every 10s (detect join and leave)
    if (this.roomId && (!this._lastPartnerCheck || (new Date() - this._lastPartnerCheck > 10000))) {
      this._lastPartnerCheck = new Date();
      this._loadPartner(function(){});
    }

    var done = 0, changed = false;
    function check() { done++; if (done >= 2) { self._polling = 0; if (changed && self.onChange) self.onChange('data'); } }

    // Poll partner mood
    if (this.partnerId) {
      SUPABASE.get('moods', 'user_id=eq.' + encodeURIComponent(this.partnerId) + '&limit=1', function(rows) {
        if (rows && rows.length) {
          var pm = { status: rows[0].status, updatedAt: rows[0].updated_at };
          if (!self.partnerMood || self.partnerMood.updatedAt !== rows[0].updated_at) {
            self.partnerMood = pm; changed = true;
            // Record partner mood for weekly report
            if (typeof Care !== 'undefined') Care.recordTaMood(pm.status);
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
          var decryptPromises = [];
          for (var i = rows.length - 1; i >= 0; i--) {
            var m = rows[i];
var seen = false;
              for (var j = 0; j < self.partnerMessages.length; j++) {
                if (self.partnerMessages[j].id === m.id) { seen = true; break; }
              }
              if (!seen) {
                var c = m.content;
                if (typeof c === 'string') { try { c = JSON.parse(c); } catch(e) { c = {}; } }
                var msgObj = {
                  id: m.id, sender: m.sender_user_id === self.userId ? 'me' : 'partner',
                  text: c.text || '', doodleDataUrl: m.type === 'doodle' ? (c.doodleDataUrl || c.text) : null,
                  mood: c.mood || 'sunny', type: m.type, createdAt: m.created_at
                };
                self.partnerMessages.push(msgObj);
                // Decrypt if needed — wait for all decrypts before notifying UI
                if (c.encrypted && typeof Crypto !== 'undefined' && Crypto._ready) {
                  decryptPromises.push(
                    Crypto.decrypt(c.text).then(function(plain) { msgObj.text = plain; })
                  );
                }
                nc++;
              }
            }
          if (nc > 0) {
            self.partnerMessages.sort(function(a, b) { return new Date(b.createdAt) - new Date(a.createdAt); });
            if (self.partnerMessages.length > 100) self.partnerMessages.length = 100;
            changed = true;
            // Flash title for new partner messages when not on weather view
            var hasNewFromPartner = false;
            for (var k = self.partnerMessages.length - nc; k < self.partnerMessages.length; k++) {
              if (k >= 0 && self.partnerMessages[k] && self.partnerMessages[k].sender === 'partner') {
                hasNewFromPartner = true; break;
              }
            }
            if (hasNewFromPartner) {
              self._flashTitle();
              // After decrypt, show notification with message preview
              Promise.all(decryptPromises).then(function() {
                var lastPartnerMsg = '';
                for (var p = self.partnerMessages.length - 1; p >= 0; p--) {
                  if (self.partnerMessages[p].sender === 'partner') {
                    lastPartnerMsg = self.partnerMessages[p].text || '给你发了一条消息';
                    break;
                  }
                }
                var pn = localStorage.getItem('sync_partnerName') || 'TA';
                self._notify('💬 ' + pn + '的消息', lastPartnerMsg);
              });
            }
          }
        }
        // Wait for all decryptions to finish before notifying UI
        Promise.all(decryptPromises).then(function() { check(); });
      });
    } else { check(); }
  },

  // ========== Title Flash ==========
  _flashTimer: null,
  _originalTitle: null,
  _flashTitle: function() {
    // Don't flash if user is already looking at the weather view
    if (typeof App !== 'undefined' && App.currentView === 'weather') return;
    if (this._flashTimer) return; // Already flashing
    var self = this;
    this._originalTitle = document.title;
    var on = true;
    this._flashTimer = setInterval(function() {
      document.title = on ? '💬 新消息' : self._originalTitle;
      on = !on;
    }, 1200);
    // Auto-stop after 60 seconds
    setTimeout(function() { self._stopFlash(); }, 60000);
  },
  _stopFlash: function() {
    if (this._flashTimer) {
      clearInterval(this._flashTimer);
      this._flashTimer = null;
    }
    if (this._originalTitle) {
      document.title = this._originalTitle;
      this._originalTitle = null;
    }
  },

  // ========== Browser Notification ==========
  _notifyEnabled: false,
  requestNotify: function() {
    var self = this;
    if (!('Notification' in window)) return;
    if (Notification.permission === 'granted') {
      self._notifyEnabled = true;
    } else if (Notification.permission !== 'denied') {
      Notification.requestPermission().then(function(p) {
        if (p === 'granted') self._notifyEnabled = true;
      });
    }
  },
  _notify: function(title, body) {
    if (!this._notifyEnabled || !('Notification' in window)) return;
    if (typeof App !== 'undefined' && App.currentView === 'weather') return; // Don't notify if already looking
    try {
      var opts = { body: body || '', icon: '/baby-time/icon-192.png', tag: 'mood-msg', renotify: true };
      // Use Service Worker if available, otherwise direct
      if (navigator.serviceWorker && navigator.serviceWorker.controller) {
        navigator.serviceWorker.ready.then(function(reg) {
          reg.showNotification(title, opts);
        });
      } else {
        var n = new Notification(title, opts);
        setTimeout(function() { n.close(); }, 5000);
      }
    } catch(e) {} // Silently fail if not supported
  },

  // ========== Actions ==========

  updateMood: function(st) {
    var self = this;
    if (!this.userId) return;
    var body = { user_id: this.userId, room_id: this.roomId || null, status: st, updated_at: new Date().toISOString() };
    self.myMood = { status: st, updatedAt: body.updated_at };
    // Use upsert: PATCH first, POST as fallback
    SUPABASE.patch('moods', 'user_id=eq.' + encodeURIComponent(this.userId), body, function() {
      // PATCH done (may update 0 rows for new user, that's ok — try POST)
      SUPABASE.post('moods', body, function() {
        // POST either creates new or silently conflicts (both OK)
      });
      if (self.roomId) {
        SUPABASE.post('messages', {
          room_id: self.roomId, sender_user_id: self.userId,
          type: 'mood_change', content: { mood: st }, created_at: new Date().toISOString()
        }, function() {});
      }
    });
  },

  sendMessage: function(t, dd, mo) {
    var self = this;
    return new Promise(function(resolve) {
      if (!self.roomId || !self.userId) { resolve({ error: '未连接' }); return; }
      // Encryption: only use if enabled AND Crypto is ready
      var useEncryption = ENCRYPTION_ENABLED && typeof Crypto !== 'undefined' && Crypto._ready;
      var textPromise = useEncryption ? Crypto.encrypt(t || '') : Promise.resolve(t || '');
      textPromise.then(function(encText) {
        var msg = {
          room_id: self.roomId, sender_user_id: self.userId,
          type: dd ? 'doodle' : 'text',
          content: { text: encText, doodleDataUrl: dd || null, mood: mo || 'sunny', encrypted: useEncryption },
          created_at: new Date().toISOString()
        };
        SUPABASE.post('messages', msg, function(result) {
          var newId = result && result.length ? result[0].id : null;
          if (newId) {
            self.partnerMessages.push({id:newId,sender:'me',text:t||'',doodleDataUrl:dd||null,mood:mo||'sunny',type:dd?'doodle':'text',createdAt:msg.created_at});
          }
          resolve({ success: true, id: newId });
        });
      });
    });
  },

  leave: function() {
    if (this.timer) clearInterval(this.timer);
    var rid = this.roomId;
    var uid = this.userId;
    if (rid && uid) {
      // Remove self from members
      SUPABASE.delete('room_members', 'room_id=eq.' + encodeURIComponent(rid) + '&user_id=eq.' + encodeURIComponent(uid), function() {
        // If I'm the creator (room_code = my invite_code), delete the room entirely
        var myCode = localStorage.getItem('my_invite_code');
        if (myCode) {
          SUPABASE.delete('rooms', 'room_code=eq.' + encodeURIComponent(myCode), function() {});
        } else {
          // Just decrement member count
          SUPABASE.patch('rooms', 'id=eq.' + rid, { member_count: 1 }, function() {});
        }
      });
    }
    localStorage.removeItem('sync_roomCode');
    localStorage.removeItem('sync_roomId');
    localStorage.removeItem('sync_partnerId');
    localStorage.removeItem('room_password');
    this.roomCode = null; this.roomId = null; this.partnerId = null; this.partnerName = null;
  }
};
