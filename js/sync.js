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

  // Switch to a new room — clear old messages only if room actually changed
  _switchRoom: function(newRoomId) {
    if (this.roomId && this.roomId !== newRoomId) {
      this.partnerMessages = [];
      this.partnerMood = null;
    }
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
          self._switchRoom(self.roomId);
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
        self._switchRoom(self.roomId);
        SUPABASE.get('room_members', 'room_id=eq.' + encodeURIComponent(room.id) + '&user_id=eq.' + encodeURIComponent(self.userId), function(members) {
          if (members && members.length) {
            self._loadPartner(function() { self._finish(code); cb({ success: true }); });
          } else {
            // New identity — might be re-joining after data clear
            var isFreshIdentity = !localStorage.getItem('care_mood_history');
            // Clean up stale members before adding new one
            function doJoin() {
              SUPABASE.post('room_members', { room_id: room.id, user_id: self.userId }, function() {
                SUPABASE.patch('rooms', 'id=eq.' + room.id, { member_count: 2 }, function() {});
                self._loadPartner(function() {
                  self._finish(code);
                  if (isFreshIdentity) {
                    setTimeout(function(){showToast('检测到新设备或数据已清除，旧消息归属可能不准 📱',4000)},500);
                  }
                  cb({ success: true });
                });
              });
            }
            // Find the active partner by checking recent messages (avoid deleting partner)
            SUPABASE.get('messages', 'room_id=eq.' + encodeURIComponent(room.id) + '&order=created_at.desc&limit=5', function(msgs) {
              var counts = {};
              if (msgs) { for (var mi = 0; mi < msgs.length; mi++) { var sid = msgs[mi].sender_user_id; counts[sid] = (counts[sid]||0) + 1; } }
              var activeUser = null, maxCount = 0;
              for (var uid in counts) { if (counts[uid] > maxCount) { maxCount = counts[uid]; activeUser = uid; } }
              SUPABASE.get('room_members', 'room_id=eq.' + encodeURIComponent(room.id), function(allMembers) {
                if (allMembers && allMembers.length >= 2 && activeUser) {
                  for (var k = 0; k < allMembers.length; k++) {
                    // Keep the active sender (real partner), delete stale members
                    if (allMembers[k].user_id !== activeUser && allMembers[k].user_id !== self.userId) {
                      SUPABASE.delete('room_members', 'room_id=eq.' + encodeURIComponent(room.id) + '&user_id=eq.' + encodeURIComponent(allMembers[k].user_id), function(){});
                    }
                  }
                }
                doJoin();
              });
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
        // Filter out self, sort by joined_at (newest first) to pick the real partner
        var others = [];
        for (var i = 0; i < members.length; i++) {
          if (members[i].user_id !== self.userId) {
            others.push(members[i]);
          }
        }
        // Sort by joined_at descending (most recent first)
        others.sort(function(a, b) { return new Date(b.joined_at || 0) - new Date(a.joined_at || 0); });
        if (others.length > 0) {
          foundPartner = others[0].user_id;
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
    this.timer = setInterval(function() { self._poll(); }, 1500);
    document.addEventListener('visibilitychange', function() {
      if (!document.hidden && self.roomCode) self._poll();
    });
  },

  _poll: function() {
    var self = this;
    if (!this.roomCode) return;
    if (this._polling && (new Date() - this._polling < 15000)) return;
    this._polling = new Date();

    // Check partner status every 5s (detect join and leave)
    if (this.roomId && (!this._lastPartnerCheck || (new Date() - this._lastPartnerCheck > 5000))) {
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
                // Store partner's shared diaries in localStorage for treehole
                if (m.type === 'shared_diary' && msgObj.sender === 'partner') {
                  var sd = { id: m.id, text: c.text||'', doodleDataUrl: c.doodleDataUrl||null, mood: c.mood||'sunny', createdAt: m.created_at, read: false };
                  try {
                    var sds = JSON.parse(localStorage.getItem('shared_diaries') || '[]');
                    // Avoid duplicates
                    var dup = false;
                    for (var di = 0; di < sds.length; di++) { if (sds[di].id === m.id) { dup = true; break; } }
                    if (!dup) { sds.unshift(sd); if (sds.length > 50) sds.length = 50; localStorage.setItem('shared_diaries', JSON.stringify(sds)); }
                  } catch(e) {}
                }
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
              // Show unread badge on chat tab
              self._showBadge();
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
    if (typeof App !== 'undefined' && (App.currentView === 'weather' || App.currentView === 'chat')) return;
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

  // ========== Tab Badge (unread indicator) ==========
  _showBadge: function() {
    if (typeof App !== 'undefined' && App.currentView === 'chat') return; // Already looking
    var tab = document.querySelector('.tab-btn[data-view="chat"]');
    if (tab) tab.classList.add('has-badge');
  },
  clearBadge: function() {
    var tab = document.querySelector('.tab-btn[data-view="chat"]');
    if (tab) tab.classList.remove('has-badge');
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

  sendSharedDiary: function(t, dd, mo) {
    var self = this;
    if (!this.roomId || !this.userId) return;
    var msg = {
      room_id: self.roomId, sender_user_id: self.userId,
      type: 'shared_diary',
      content: { text: t || '', doodleDataUrl: dd || null, mood: mo || 'sunny' },
      created_at: new Date().toISOString()
    };
    SUPABASE.post('messages', msg, function(result) {
      var newId = result && result.length ? result[0].id : null;
      if (newId) {
        self.partnerMessages.push({id:newId,sender:'me',text:t||'',doodleDataUrl:dd||null,mood:mo||'sunny',type:'shared_diary',createdAt:msg.created_at});
      }
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
    localStorage.removeItem('sync_partnerName');
    localStorage.removeItem('sync_partnerName_custom');
    localStorage.removeItem('room_password');
    this.roomCode = null; this.roomId = null; this.partnerId = null; this.partnerName = null;
    this.partnerMood = null; this.myMood = null;
  }
};
