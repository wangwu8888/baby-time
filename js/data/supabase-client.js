// Supabase 客户端
import { SUPABASE_URL, SUPABASE_KEY } from '../config.js';

var _client = null;

export function client() {
  if (_client) return _client;

  // 尝试从 CDN 全局变量获取
  if (window.supabase && typeof window.supabase.createClient === 'function') {
    _client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
      realtime: { params: { eventsPerSecond: 10 } }
    });
    console.log('Supabase connected via CDN');
    return _client;
  }

  // CDN 未加载，返回降级客户端（使用 fetch 直接调用 REST API）
  console.warn('Supabase CDN not loaded, using fallback REST client');
  _client = createFallbackClient();
  return _client;
}

// 降级客户端：不依赖 CDN，直接用 fetch
function createFallbackClient() {
  var KEY = SUPABASE_KEY;
  var BASE = SUPABASE_URL + '/rest/v1';

  function headers() {
    return {
      'apikey': KEY,
      'Authorization': 'Bearer ' + KEY,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    };
  }

  function from(table) {
    return {
      select: function(cols) {
        return buildQuery('GET', table, cols);
      },
      insert: function(data) {
        return buildQuery('POST', table, null, data);
      },
      update: function(data) {
        return buildQuery('PATCH', table, null, data);
      },
      upsert: function(data, opts) {
        return buildQuery('POST', table, null, data, { on_conflict: (opts && opts.onConflict) || 'user_id' });
      },
      delete: function() {
        return buildQuery('DELETE', table);
      }
    };
  }

  function buildQuery(method, table, select, body, extra) {
    var url = BASE + '/' + table;
    var queryParts = [];

    var chain = {
      _url: url,
      _method: method,
      _body: body,
      _headers: headers(),
      _queryParts: queryParts,
      _select: select,

      eq: function(col, val) { queryParts.push(col + '=eq.' + encodeURIComponent(val)); return this; },
      order: function(col, opts) { queryParts.push('order=' + col + '.' + (opts && opts.ascending === false ? 'desc' : 'asc')); return this; },
      limit: function(n) { queryParts.push('limit=' + n); return this; },
      range: function(a, b) { queryParts.push('offset=' + a); queryParts.push('limit=' + (b - a + 1)); return this; },
      lt: function(col, val) { queryParts.push(col + '=lt.' + encodeURIComponent(val)); return this; },
      single: function() { queryParts.push('limit=1'); return this.then(function(r) { return r && r.length ? r[0] : null; }); },

      then: function(resolve, reject) {
        var u = this._url;
        if (this._select) queryParts.push('select=' + this._select);
        if (queryParts.length) u += '?' + queryParts.join('&');
        var h = this._headers;
        var b = this._body ? JSON.stringify(this._body) : null;
        return fetch(u, { method: this._method, headers: h, body: b })
          .then(function(r) {
            if (r.status === 204 || r.status === 201 || r.status === 200) {
              return r.json().catch(function() { return null; });
            }
            return r.json().then(function(err) { throw err; });
          })
          .then(resolve, reject);
      }
    };
    return chain;
  }

  // 模拟 channel/subscribe（轮询降级）
  function channel(name) {
    var handlers = {};
    var pollingTimer = null;
    var lastCheck = null;

    var ch = {
      on: function(event, filter, callback) {
        if (event === 'postgres_changes') {
          handlers[filter.table] = { filter: filter, callback: callback };
        }
        if (event === 'presence') {
          handlers.presence = { callback: callback };
        }
        if (event === 'broadcast') {
          handlers.broadcast = { callback: callback };
        }
        return ch;
      },
      subscribe: function(cb) {
        // 简单轮询：每 3 秒检查新消息
        if (handlers.messages) {
          var handler = handlers.messages;
          pollingTimer = setInterval(async function() {
            try {
              var now = new Date().toISOString();
              var u = BASE + '/messages?room_id=eq.' + encodeURIComponent(handler.filter.filter.split('=eq.')[1]) + '&order=created_at.desc&limit=5';
              var r = await fetch(u, { headers: headers() });
              if (r.ok) {
                var data = await r.json();
                if (data && data.length) {
                  for (var i = data.length - 1; i >= 0; i--) {
                    var msg = data[i];
                    if (!lastCheck || msg.created_at > lastCheck) {
                      handler.callback({ new: msg, eventType: 'INSERT' });
                    }
                  }
                  lastCheck = data[0].created_at;
                }
              }
            } catch(e) {}
          }, 3000);
        }
        if (typeof cb === 'function') cb('SUBSCRIBED');
        return ch;
      },
      unsubscribe: function() {
        if (pollingTimer) clearInterval(pollingTimer);
        return ch;
      },
      track: function() { return ch; },
      send: function() { return ch; }
    };
    return ch;
  }

  return {
    from: from,
    channel: channel
  };
}
