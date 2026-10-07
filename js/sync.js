// Sync v8 — new tables (users, rooms, messages, moods)
// Encryption: AES-GCM for message text, key derived from room code.
// v113: re-enabled — old plaintext messages are handled per-message via content.encrypted flag.
var ENCRYPTION_ENABLED = true;
var Sync = {
  userId: null, roomId: null, roomCode: null, _partnerSince: null,
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
      // 阶段2：把客户端身份挂到匿名登录的 auth.uid()（幂等，RLS 靠它认人）
      SUPABASE.AUTH.link(uid, function() {});
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
      // 阶段2：新身份也要挂到映射表（此时匿名 token 已由请求闸门确保就绪）
      SUPABASE.AUTH.link(uid, function() {});
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
  // v115: 走 create_room RPC（服务端建房间 + 写成员 + 记 member_count）。
  // 匿名登录不可用（legacy）时退回旧直连路径。
  createRoom: function(password, cb) {
    var self = this;
    this._initUser(function() {
      // Switching to a brand-new room: fully leave the old one (removes old membership)
      if (self.roomId) self.leave(false);

      if (SUPABASE.AUTH.isLegacy()) { self._createRoomLegacy(password, cb); return; }
      var attempts = 0;
      function tryOnce() {
        attempts++;
        var code = self._generateRoomCode();
        var pwdHash = self._hashCode(code + password);
        self.roomCode = code;
        SUPABASE.rpc('create_room', { p_code: code, p_pwd_hash: pwdHash }, function(room, err) {
          if (room && room.id) {
            self.roomId = room.id;
            self._switchRoom(self.roomId);
            self._finish(code);
            self._startPolling();
            cb({ roomCode: code });
          } else if (err && err.indexOf('CODE_TAKEN') !== -1 && attempts < 3) {
            tryOnce(); // 房间号撞了，换个号重来
          } else {
            cb({ error: '创建失败，请重试' });
          }
        });
      }
      tryOnce();
    });
  },

  // 旧直连路径（仅 legacy 模式 / RLS 开启前可用）
  _createRoomLegacy: function(password, cb) {
    var self = this;
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
  },

  // Join existing room
  // v115: 走 join_room RPC（服务端验密码 + 补成员 + 原子加 member_count）。
  joinRoom: function(code, password, cb) {
    var self = this;
    code = code.toUpperCase();
    this.roomCode = code;
    this._initUser(function() {
      if (SUPABASE.AUTH.isLegacy()) { self._joinRoomLegacy(code, password, cb); return; }
      SUPABASE.rpc('join_room', { p_code: code, p_pwd_hash: self._hashCode(code + password) }, function(room, err) {
        if (room && room.id) {
          self.roomId = room.id;
          self._switchRoom(self.roomId);
          self._loadPartner(function() { self._finish(code); cb({ success: true }); });
        } else if (err) {
          if (err.indexOf('ROOM_NOT_FOUND') !== -1) cb({ error: '房间不存在' });
          else if (err.indexOf('BAD_PASSWORD') !== -1) cb({ error: '密码错误' });
          else cb({ error: '加入失败，请检查网络后重试' });
        } else {
          cb({ error: '加入失败，请检查网络后重试' });
        }
      });
    });
  },

  // 旧直连路径（仅 legacy 模式 / RLS 开启前可用）
  _joinRoomLegacy: function(code, password, cb) {
    var self = this;
    SUPABASE.get('rooms', 'room_code=eq.' + encodeURIComponent(code) + '&limit=1', function(rows) {
      if (!rows || !rows.length) { cb({ error: '房间不存在' }); return; }
      var room = rows[0];
      var pwdHash = self._hashCode(code + password);
      if (room.password_hash !== pwdHash) { cb({ error: '密码错误' }); return; }
      self.roomId = room.id;
      self._switchRoom(self.roomId);
      SUPABASE.get('room_members', 'room_id=eq.' + encodeURIComponent(room.id) + '&user_id=eq.' + encodeURIComponent(self.userId), function(members) {
        if (members && members.length) {
          // Already a member (normal rejoin) — just re-pair, never touch other members
          self._loadPartner(function() { self._finish(code); cb({ success: true }); });
        } else {
          // Not a member yet (first join, or membership lost) — add self QUIETLY.
          SUPABASE.post('room_members', { room_id: room.id, user_id: self.userId }, function(added) {
            if (!added || !added.length) { cb({ error: '加入失败，请检查网络后重试' }); return; }
            SUPABASE.get('rooms', 'id=eq.' + encodeURIComponent(room.id) + '&select=member_count&limit=1', function(rr) {
              var mc = (rr && rr.length && parseInt(rr[0].member_count)) || 0;
              if (mc < 1) mc = 1;
              SUPABASE.patch('rooms', 'id=eq.' + encodeURIComponent(room.id), { member_count: mc + 1 }, function() {});
              self._loadPartner(function() {
                self._finish(code);
                cb({ success: true });
              });
            });
          });
        }
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
        // Prefer previously known partner from localStorage
        var knownId = localStorage.getItem('sync_partnerId');
        if (knownId) {
          for (var i = 0; i < members.length; i++) {
            if (members[i].user_id === knownId) { foundPartner = knownId; break; }
          }
        }
        // Fallback: pick last non-self member
        if (!foundPartner) {
          for (var j = members.length - 1; j >= 0; j--) {
            if (members[j].user_id !== self.userId) { foundPartner = members[j].user_id; break; }
          }
        }
        // Clean up if more than 2 members (stale accounts)
        if (members && members.length > 2) {
          for (var i = 0; i < members.length; i++) {
            if (members[i].user_id !== self.userId && members[i].user_id !== foundPartner) {
              SUPABASE.delete('room_members', 'room_id=eq.' + encodeURIComponent(self.roomId) + '&user_id=eq.' + encodeURIComponent(members[i].user_id), function(){});
            }
          }
        }
      }
      self._finishLoadPartner(foundPartner, hadPartner, cb);
    });
  },

  _finishLoadPartner: function(foundPartner, hadPartner, cb) {
    var self = this;
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
          if (isNew && self.onChange) { self._partnerSince = new Date(); self.onChange('paired'); }
          cb();
        });
      } else {
        // No partner found — but don't clear if just paired (race condition protection)
        if (hadPartner) {
          var recentlyPaired = self._partnerSince && (new Date() - self._partnerSince < 15000);
          if (!recentlyPaired && self.onChange) self.onChange('partner_left');
          if (recentlyPaired) { cb(); return; } // Keep existing partner, ignore transient failure
        }
        self.partnerId = null;
        self.partnerName = null;
        self.partnerMood = null;
        self.partnerMessages = [];
        localStorage.removeItem('sync_partnerId');
        localStorage.removeItem('sync_partnerName');
        localStorage.removeItem('sync_partnerName_custom');
        cb();
      }
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
    function check() { done++; if (done >= 3) { self._polling = 0; if (changed && self.onChange) self.onChange('data'); } }

    // Poll partner mood
    if (this.partnerId) {
      SUPABASE.get('moods', 'user_id=eq.' + encodeURIComponent(this.partnerId) + '&limit=1', function(rows) {
        if (rows && rows.length) {
          var pm = { status: rows[0].status, updatedAt: rows[0].updated_at };
          if (!self.partnerMood || self.partnerMood.updatedAt !== rows[0].updated_at) {
            self.partnerMood = pm; changed = true;
          }
          // v113: record partner mood on every successful poll (not only on change),
          // so the weekly report has data for every day. Care.recordTaMood dedupes
          // per-day internally and skips redundant writes.
          if (typeof Care !== 'undefined') Care.recordTaMood(pm.status);
        }
        check();
      });
    } else { check(); }

    // Poll messages
    if (this.roomId) {
      SUPABASE.get('messages', 'room_id=eq.' + encodeURIComponent(this.roomId) + '&type=neq.crane&order=created_at.desc&limit=500', function(rows) {
        // Chat messages (excluding crane)
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
                  mood: c.mood || 'sunny', type: m.type, createdAt: m.created_at, batchCount: c.count || 1
                };
                self.partnerMessages.push(msgObj);// Handle diary read receipts
                if (m.type === 'diary_read' && msgObj.sender === 'partner') {
                  var did = c.diaryId;
                  if (did) {
                    var es = getEntries('me');
                    for (var ei = 0; ei < es.length; ei++) {
                      if (es[ei].id === did) { updateEntry(did, {shared:true, read:true}, 'me'); break; }
                    }
                  }
                }
                // Sync partner mood from mood_change messages (fallback for weather tab)
                if (m.type === 'mood_change' && msgObj.sender === 'partner') {
                  self.partnerMood = { status: c.mood || 'sunny', updatedAt: m.created_at };
                  changed = true;
                }
                // Handle crane messages
                if (m.type === 'crane' && msgObj.sender === 'partner') {
                  var act = c.action || 'add';
                  if (act === 'clear') { if (typeof Crane !== 'undefined') Crane.onTaClear(m.id); }
                  else { if (typeof Crane !== 'undefined') Crane.onTaCrane(c.count || 1, m.id); }
                }
                // Shared wish list — apply partner's add/toggle/del to our copy (v114)
                if (m.type === 'wish' && msgObj.sender === 'partner') {
                  if (typeof TreeHole !== 'undefined') TreeHole.applyRemoteWish(c, m.sender_user_id);
                }
                // Shared anniversaries — apply partner's add/del (v114)
                if (m.type === 'anniversary' && msgObj.sender === 'partner') {
                  if (typeof TreeHole !== 'undefined') TreeHole.applyRemoteAnniversary(c, m.sender_user_id);
                }
                // Store partner's shared diaries in localStorage for treehole.
                // v113: capture per-iteration values in a closure (var-loop bug) and
                // decrypt BEFORE storing, so encrypted diaries don't land as ciphertext.
                if (m.type === 'shared_diary' && msgObj.sender === 'partner') {
                  (function(mm, cc) {
                    var sd = { id: mm.id, diaryId: cc.diaryId || null, text: cc.text||'', doodleDataUrl: cc.doodleDataUrl||null, mood: cc.mood||'sunny', createdAt: mm.created_at, read: false };
                    var storeSd = function(plain) {
                      if (typeof plain === 'string') sd.text = plain;
                      try {
                        var sds = JSON.parse(localStorage.getItem('shared_diaries') || '[]');
                        var dup = false;
                        for (var di = 0; di < sds.length; di++) { if (sds[di].id === mm.id) { dup = true; break; } }
                        if (!dup) { sds.unshift(sd); if (sds.length > 50) sds.length = 50; localStorage.setItem('shared_diaries', JSON.stringify(sds)); }
                      } catch(e) {}
                    };
                    if (cc.encrypted && typeof Crypto !== 'undefined' && Crypto._ready) {
                      Crypto.decrypt(cc.text).then(storeSd).catch(function(){ storeSd(null); });
                    } else {
                      storeSd(null);
                    }
                  })(m, c);
                }
                // Decrypt if needed — wait for all decrypts before notifying UI.
                // v113: capture c/msgObj per-iteration; a shared var across the loop
                // made multiple encrypted messages in one batch overwrite each other.
                if (c.encrypted && typeof Crypto !== 'undefined' && Crypto._ready) {
                  (function(cc, mObj) {
                    decryptPromises.push(
                      Crypto.decrypt(cc.text).then(function(plain) { mObj.text = plain; })
                    );
                  })(c, msgObj);
                }
                nc++;
              }
            }
          if (nc > 0) {
            self.partnerMessages.sort(function(a, b) { return new Date(b.createdAt) - new Date(a.createdAt); });
            if (self.partnerMessages.length > 500) self.partnerMessages.length = 500;
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

    // Separate poll for crane sync (keep crane messages out of chat)
    if (this.roomId && this.partnerId) {
      var selfCrane = this;
      SUPABASE.get('messages', 'room_id=eq.' + encodeURIComponent(this.roomId) + '&type=eq.crane&order=created_at.desc&limit=200', function(rows) {
        if (rows && rows.length) {
          for (var ci = rows.length - 1; ci >= 0; ci--) {
            var cm = rows[ci];
            if (cm.sender_user_id !== selfCrane.userId) {
              var cc = cm.content;
              if (typeof cc === 'string') { try { cc = JSON.parse(cc); } catch(e) { cc = {}; } }
              if (cc.action === 'clear') { if (typeof Crane !== 'undefined') Crane.onTaClear(cm.id); }
              else { if (typeof Crane !== 'undefined') Crane.onTaCrane(cc.count || 1, cm.id); }
            }
          }
        }
        check();
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
  _loadingMore: false,
  loadMoreMessages: function(cb) {
    var self = this;
    if (!this.roomId || this._loadingMore) return;
    this._loadingMore = true;
    // Find the oldest message date
    var oldest = null;
    for (var i = 0; i < this.partnerMessages.length; i++) {
      var d = this.partnerMessages[i].createdAt;
      if (!oldest || d < oldest) oldest = d;
    }
    var query = 'room_id=eq.' + encodeURIComponent(this.roomId) + '&type=neq.crane&order=created_at.desc&limit=50';
    if (oldest) query += '&created_at=lt.' + encodeURIComponent(oldest);
    SUPABASE.get('messages', query, function(rows) {
      self._loadingMore = false;
      if (rows && rows.length) {
        var added = 0;
        for (var i = rows.length - 1; i >= 0; i--) {
          var m = rows[i];
          var seen = false;
          for (var j = 0; j < self.partnerMessages.length; j++) {
            if (self.partnerMessages[j].id === m.id) { seen = true; break; }
          }
          if (!seen) {
            var c = m.content;
            if (typeof c === 'string') { try { c = JSON.parse(c); } catch(e) { c = {}; } }
            self.partnerMessages.push({
              id: m.id, sender: m.sender_user_id === self.userId ? 'me' : 'partner',
              text: c.text || '', doodleDataUrl: m.type === 'doodle' ? (c.doodleDataUrl || c.text) : null,
              mood: c.mood || 'sunny', type: m.type, createdAt: m.created_at
            });
            added++;
          }
        }
        if (added > 0) {
          self.partnerMessages.sort(function(a, b) { return new Date(a.createdAt) - new Date(b.createdAt); });
          if (self.partnerMessages.length > 500) self.partnerMessages.length = 500;
        }
      }
      if (cb) cb(rows ? rows.length : 0);
    });
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
          if (!newId) { resolve({ error: '发送失败，请检查网络后重试' }); return; }
          self.partnerMessages.push({id:newId,sender:'me',text:t||'',doodleDataUrl:dd||null,mood:mo||'sunny',type:dd?'doodle':'text',createdAt:msg.created_at});
          resolve({ success: true, id: newId });
        });
      });
    });
  },

  sendSharedDiary: function(t, dd, mo, diaryId) {
    var self = this;
    if (!this.roomId || !this.userId) return;
    var useEncryption = ENCRYPTION_ENABLED && typeof Crypto !== 'undefined' && Crypto._ready;
    var textPromise = useEncryption ? Crypto.encrypt(t || '') : Promise.resolve(t || '');
    var self2 = this;
    textPromise.then(function(encText) {
      var msg = {
        room_id: self2.roomId, sender_user_id: self2.userId,
        type: 'shared_diary',
        content: { text: encText, doodleDataUrl: dd || null, mood: mo || 'sunny', diaryId: diaryId || null, encrypted: useEncryption },
        created_at: new Date().toISOString()
      };
      SUPABASE.post('messages', msg, function(result) {
        var newId = result && result.length ? result[0].id : null;
        if (newId) {
          self2.partnerMessages.push({id:newId,sender:'me',text:t||'',doodleDataUrl:dd||null,mood:mo||'sunny',type:'shared_diary',createdAt:msg.created_at});
        }
      });
    });
  },

  sendCraneBatch: function(count) {
    var self = this;
    if (!this.roomId || !this.userId || !count) return;
    SUPABASE.post('messages', {
      room_id: this.roomId, sender_user_id: this.userId,
      type: 'crane', content: { action: 'add', count: count },
      created_at: new Date().toISOString()
    }, function() {});
  },

  sendDiaryRead: function(diaryId) {
    if (!this.roomId || !this.userId) return;
    SUPABASE.post('messages', {
      room_id: this.roomId, sender_user_id: this.userId,
      type: 'diary_read', content: { diaryId: diaryId },
      created_at: new Date().toISOString()
    }, function() {});
  },

  clearCranes: function() {
    var self = this;
    if (!this.roomId || !this.userId) return;
    SUPABASE.post('messages', {
      room_id: this.roomId, sender_user_id: this.userId,
      type: 'crane', content: { action: 'clear' },
      created_at: new Date().toISOString()
    }, function() {});
  },

  // ========== Shared wish list (v114) ==========
  // One shared list both people read/write. Every entry carries a stable id
  // generated by whoever created it, so both sides operate on the SAME record
  // and a checkbox ticked by one shows up ticked for the other.
  // action: 'add' | 'toggle' | 'del'
  sendWish: function(action, id, text, done) {
    if (!this.roomId || !this.userId) return;
    var c = { action: action, wid: id };
    if (action === 'add') { c.text = text || ''; c.done = !!done; }
    if (action === 'toggle') { c.done = !!done; }
    SUPABASE.post('messages', {
      room_id: this.roomId, sender_user_id: this.userId,
      type: 'wish', content: c,
      created_at: new Date().toISOString()
    }, function() {});
  },

  // ========== Shared anniversaries (v114) ==========
  // action: 'add' | 'del'
  sendAnniversary: function(action, id, name, emoji, date) {
    if (!this.roomId || !this.userId) return;
    var c = { action: action, aid: id };
    if (action === 'add') { c.name = name || ''; c.emoji = emoji || '💗'; c.date = date || ''; }
    SUPABASE.post('messages', {
      room_id: this.roomId, sender_user_id: this.userId,
      type: 'anniversary', content: c,
      created_at: new Date().toISOString()
    }, function() {});
  },

  // leave(keepMembership)
  //  - keepMembership=true (default): exit only clears LOCAL state. The room and your
  //    membership stay intact, so "退出房间 → 重新加入" just works and your partner
  //    is never disturbed. This is the normal path for the exit button.
  //  - keepMembership=false: also remove your membership row (used when switching to
  //    a brand-new room via createRoom).
  // v113 fix: the old version deleted your member row on every exit, which made the
  // next join look like a "new identity" and (in v112) nuked the whole room.
  // It also deleted the entire room when localStorage had a stale 'my_invite_code' —
  // that dead code path is gone now.
  leave: function(keepMembership) {
    if (keepMembership === undefined) keepMembership = true;
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
    var rid = this.roomId;
    var uid = this.userId;
    if (rid && uid && !keepMembership) {
      SUPABASE.delete('room_members', 'room_id=eq.' + encodeURIComponent(rid) + '&user_id=eq.' + encodeURIComponent(uid), function() {});
    }
    localStorage.removeItem('sync_roomCode');
    localStorage.removeItem('sync_roomId');
    localStorage.removeItem('sync_partnerId');
    localStorage.removeItem('room_password');
    // Keep sync_partnerName / sync_partnerName_custom — the nickname you set for TA
    // should survive an exit, otherwise every rejoin resets it to 'TA'.
    this.roomCode = null; this.roomId = null; this.partnerId = null; this.partnerName = null;
    this.partnerMood = null; this.myMood = null;
  }
};
