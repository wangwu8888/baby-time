// Supabase REST 客户端 — 纯 fetch，无 CDN 依赖
var SUPABASE = {
  URL: 'https://dunadheorduiyxmfzlfu.supabase.co',
  KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR1bmFkaGVvcmR1aXl4bWZ6bGZ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE4OTQ0ODksImV4cCI6MjA5NzQ3MDQ4OX0.s8a5FLcmYmHv-1IaidLnu_5VRxJf6JEvsl8u20MpZcA',

  _headers: function() {
    return {
      'apikey': this.KEY,
      'Authorization': 'Bearer ' + this.KEY,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    };
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

  _req: function(method, url, body, cb, retry) {
    retry = retry || 0;
    var self = this;
    var x = new XMLHttpRequest();
    x.open(method, url, true);
    var h = this._headers();
    Object.keys(h).forEach(function(k) { x.setRequestHeader(k, h[k]); });
    x.timeout = 8000;
    var done = false;
    x.onload = function() {
      if (done) return; done = true;
      var ok = method === 'DELETE' ? (x.status === 200 || x.status === 204) :
               method === 'POST' ? (x.status === 201) :
               (x.status === 200 || x.status === 204);
      if (ok) {
        try { cb(x.responseText ? JSON.parse(x.responseText) : null); } catch(e) { cb(null); }
      } else if (retry < 2) {
        setTimeout(function() { self._req(method, url, body, cb, retry + 1); }, 1500);
      } else {
        cb(null);
      }
    };
    x.onerror = function() {
      if (done) return; done = true;
      if (retry < 2) { setTimeout(function() { self._req(method, url, body, cb, retry + 1); }, 1500); }
      else { cb(null); }
    };
    x.ontimeout = function() {
      if (done) return; done = true;
      if (retry < 2) { setTimeout(function() { self._req(method, url, body, cb, retry + 1); }, 1500); }
      else { cb(null); }
    };
    x.send(body);
  }
};
