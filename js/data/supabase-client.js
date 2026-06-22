// Supabase 客户端包装 —— 从 CDN 全局变量获取
import { SUPABASE_URL, SUPABASE_KEY } from '../config.js';

// window.supabase 由 CDN 脚本设置
function getSupabase() {
  if (!window.supabase) {
    // CDN 加载了 @supabase/supabase-js，全局变量是 supabase
    var sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
      realtime: {
        params: { eventsPerSecond: 10 }
      }
    });
    window.supabase = sb;
  }
  return window.supabase;
}

// 懒加载单例
var _client = null;
export function client() {
  if (!_client) _client = getSupabase();
  return _client;
}

// 用于需要 supabase 实例的地方
export { _client as supabase };
