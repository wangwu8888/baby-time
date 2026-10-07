// Supabase REST 客户端 — 纯 XHR，无 CDN 依赖
// v115: 加入匿名登录（阶段2）。所有 REST 请求会先等 AUTH.ensure() 完成：
//   1. 已有会话 → 直接用缓存的 access_token（临期自动刷新）
//   2. 有 refresh_token → 刷新
//   3. 都没有 → 匿名注册（需要 Supabase 后台开启 Anonymous sign-ins）
// 登录失败时自动降级为旧模式（Bearer=anon key），保证在 RLS 开启前 App 永远可用。
var SUPABASE = {
  URL: 'https://dunadheorduiyxmfzlfu.supabase.co',
  KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR1bmFkaGVvcmR1aXl4bWZ6bGZ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE4OTQ0ODksImV4cCI6MjA5NzQ3MDQ4OX0.s8a5FLcmYmHv-1IaidLnu_5VRxJf6JEvsl8u20MpZcA',

  // ================= 匿名登录（阶段2） =================
  AUTH: {
    _tk: null, _rt: null, _exp: 0, _uid: null,
    _ready: false, _legacy: false, _flow: null, _waiters: [], _warned: false,

    _load: function() {
      try {
        var s = JSON.parse(localStorage.getItem('sb_auth') || 'null');
        if (s && s.rt) { this._tk = s.tk; this._rt = s.rt; this._exp = s.exp || 0; this._uid = s.uid || null; }
      } catch (e) {}
    },
    _save: function() {
      try { localStorage.setItem('sb_auth', JSON.stringify({ tk: this._tk, rt: this._rt, exp: this._exp, uid: this._uid })); } catch (e) {}
    },
    _clear: function() {
      this._tk = null; this._rt = null; this._exp = 0; this._uid = null;
      try { localStorage.removeItem('sb_auth'); } catch (e) {}
    },

    _headers: function() {
      return { 'apikey': SUPABASE.KEY, 'Authorization': 'Bearer ' + SUPABASE.KEY, 'Content-Type': 'application/json' };
    },

    _rawReq: function(method, url, body, cb) {
      var self = this;
      var x = new XMLHttpRequest();
      x.open(method, url, true);
      x.timeout = 8000;
      var h = this._headers();
      Object.keys(h).forEach(function(k) { x.setRequestHeader(k, h[k]); });
      x.onload = function() {
        var data = null;
        try { data = x.responseText ? JSON.parse(x.responseText) : null; } catch (e) {}
        cb(x.status, data);
      };
      x.onerror = function() { cb(0, null); };
      x.ontimeout = function() { cb(0, null); };
      x.send(body || null);
    },

    // ensure(cb) — cb(err)：err 为 null 表示身份就绪（token 可用）；
    // err 非空表示进入 legacy 模式（无法匿名登录，例如后台未开启 Anonymous sign-ins）。
    ensure: function(cb) {
      var self = this;
      if (this._ready) { cb(this._legacy ? 'legacy' : null); return; }
      if (this._flow) { this._waiters.push(cb); return; }
      this._flow = true; this._waiters = [cb];
      var finish = function(err) {
        var ws = self._waiters; self._waiters = []; self._flow = null;
        self._ready = true; self._legacy = !!err;
        if (err && !self._warned) {
          self._warned = true;
          console.warn('[SUPABASE] 匿名登录不可用，已降级为旧模式：', err);
        }
        for (var i = 0; i < ws.length; i++) { try { ws[i](err || null); } catch (e) {} }
      };

      this._load();
      var self2 = this;

      function afterToken(status, data) {
        if (status === 200 && data && data.access_token && data.refresh_token) {
          self2._tk = data.access_token; self2._rt = data.refresh_token;
          self2._exp = Date.now() + (data.expires_in ? data.expires_in * 1000 : 3600000);
          self2._uid = (data.user && data.user.id) || self2._uid;
          self2._save();
          // 立刻把已有 user_id（老设备升级场景）挂到身份映射表
          var uid = null;
          try { uid = localStorage.getItem('user_id'); } catch (e) {}
          if (uid) self2.link(uid, function() {});
          finish(null);
        } else {
          finish('auth failed: ' + status + ' ' + JSON.stringify(data).slice(0, 120));
        }
      }

      if (this._rt) {
        // 有会话：token 还新鲜就直接用，否则刷新
        if (this._tk && this._exp - Date.now() > 60000) {
          var uid0 = null;
          try { uid0 = localStorage.getItem('user_id'); } catch (e) {}
          if (uid0) this.link(uid0, function() {});
          finish(null);
        } else {
          this.refresh(function(ok) { if (ok) finish(null); else self2._signup(afterToken); });
        }
      } else {
        this._signup(afterToken);
      }
    },

    _signup: function(cb) {
      // 匿名注册：POST /auth/v1/signup（不带 email/password 即为匿名）
      // 需要后台 Authentication → Providers → Anonymous sign-ins 开启
      this._rawReq('POST', SUPABASE.URL + '/auth/v1/signup',
        JSON.stringify({ data: { app: 'baby-time' } }), cb);
    },

    refresh: function(cb) {
      var self = this;
      if (!this._rt) { cb(false); return; }
      this._rawReq('POST', SUPABASE.URL + '/auth/v1/token?grant_type=refresh_token',
        JSON.stringify({ refresh_token: this._rt }), function(status, data) {
          if (status === 200 && data && data.access_token) {
            self._tk = data.access_token; self._rt = data.refresh_token;
            self._exp = Date.now() + (data.expires_in ? data.expires_in * 1000 : 3600000);
            self._uid = (data.user && data.user.id) || self._uid;
            self._save(); cb(true);
          } else {
            // refresh_token 失效 → 清掉重来（下次请求会重新匿名注册）
            self._clear(); cb(false);
          }
        });
    },

    // 把客户端 user_id（localStorage 里的老身份）挂到 auth.uid() 上。
    // RLS 的 current_client_uid() 靠这张表认人。幂等，可反复调用。
    link: function(clientUid, cb) {
      if (!this._uid || !clientUid) { cb && cb(false); return; }
      this._rawReq('POST', SUPABASE.URL + '/rest/v1/auth_links',
        JSON.stringify({ auth_id: this._uid, user_id: clientUid }), function(status) {
          // 200/201 = 新建；409 = 已存在（正常）；其他 = 失败但不阻塞
          cb && cb(status === 200 || status === 201 || status === 409);
        });
    },

    token: function() { return this._legacy ? SUPABASE.KEY : this._tk; },
    isLegacy: function() { return this._legacy; }
  },

  _headers: function() {
    return {
      'apikey': this.KEY,
      'Authorization': 'Bearer ' + this.AUTH.token(),
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    };
  },

  // 调用 PostgREST RPC（阶段2：create_room / join_room）
  rpc: function(name, args, cb) {
    var url = this.URL + '/rest/v1/rpc/' + name;
    this._req('POST', url, JSON.stringify(args || {}), function(data, err) { cb(data, err); }, 0, false, true);
  },

  // GET /rest/v1/table?query
  get: function(table, query, cb) {
    var url = this.URL + '/rest/v1/' + table + '?' + query;
    this._req('GET', url, null, cb, 0);
  },

  // POST /rest/v1/table
  post: function(table, body, cb) {
    var url = this.URL + '/rest/v1/' + table;
    this._req('POST', url, JSON.stringify(body), cb, 0);
  },

  // PATCH /rest/v1/table?query
  patch: function(table, query, body, cb) {
    var url = this.URL + '/rest/v1/' + table + '?' + query;
    this._req('PATCH', url, JSON.stringify(body), cb, 0);
  },

  // DELETE /rest/v1/table?query
  delete: function(table, query, cb) {
    var url = this.URL + '/rest/v1/' + table + '?' + query;
    this._req('DELETE', url, null, cb, 0);
  },

  // _req(method, url, body, cb, retry, authRetry, isRpc)
  // cb 统一为 cb(data, errMsg)。所有请求先过 AUTH.ensure 闸门。
  _req: function(method, url, body, cb, retry, authRetry, isRpc) {
    retry = retry || 0;
    var self = this;
    this.AUTH.ensure(function(authErr) {
      if (authErr && !self.AUTH.isLegacy()) { cb(null, 'auth'); return; }
      // legacy 模式：继续用 anon key 发请求（RLS 开启前 App 可用）
      var x = new XMLHttpRequest();
      x.open(method, url, true);
      var h = self._headers();
      Object.keys(h).forEach(function(k) { x.setRequestHeader(k, h[k]); });
      x.timeout = 8000;
      var done = false;
      x.onload = function() {
        if (done) return; done = true;
        var ok = method === 'DELETE' ? (x.status === 200 || x.status === 204) :
                 method === 'POST' ? (x.status === 201 || x.status === 200) :
                 (x.status === 200 || x.status === 204);
        // 401/403：token 过期或被拒 → 刷新后重试一次
        if (!ok && (x.status === 401 || x.status === 403) && !authRetry && self.AUTH._rt) {
          self.AUTH.refresh(function(good) {
            if (good) { self._req(method, url, body, cb, retry, true, isRpc); }
            else { cb(null, 'auth-expired ' + x.status); }
          });
          return;
        }
        if (ok) {
          var data = null;
          try { data = x.responseText ? JSON.parse(x.responseText) : null; } catch (e) { data = null; }
          cb(data, null);
        } else if (retry < 2) {
          setTimeout(function() { self._req(method, url, body, cb, retry + 1, authRetry, isRpc); }, 1500);
        } else {
          var msg = null;
          try { msg = JSON.parse(x.responseText).message || null; } catch (e) {}
          cb(null, msg || ('http ' + x.status));
        }
      };
      x.onerror = function() {
        if (done) return; done = true;
        if (retry < 2) { setTimeout(function() { self._req(method, url, body, cb, retry + 1, authRetry, isRpc); }, 1500); }
        else { cb(null, 'network'); }
      };
      x.ontimeout = function() {
        if (done) return; done = true;
        if (retry < 2) { setTimeout(function() { self._req(method, url, body, cb, retry + 1, authRetry, isRpc); }, 1500); }
        else { cb(null, 'timeout'); }
      };
      x.send(body);
    });
  }
};
SUPABASE.AUTH._load();
