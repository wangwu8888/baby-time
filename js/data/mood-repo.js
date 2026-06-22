// moods 表操作
import { client } from './supabase-client.js';
import { getCached, setCached } from './cache.js';

// Upsert 我的心情
export async function setMood(userId, roomId, status) {
  var { data, error } = await client()
    .from('moods')
    .upsert({
      user_id: userId,
      room_id: roomId || null,
      status: status,
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id' })
    .select()
    .single();

  if (error) { console.error('setMood:', error); return null; }
  return data;
}

// 获取我的心情
export async function getMyMood(userId) {
  var cached = getCached('mood:' + userId);
  if (cached) return cached;

  var { data, error } = await client()
    .from('moods')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error || !data) return null;
  setCached('mood:' + userId, data, 60000);
  return data;
}

// 获取对方心情
export async function getPartnerMood(partnerUserId) {
  return getMyMood(partnerUserId);
}

// 订阅心情变化
export function subscribeMood(userId, callback) {
  return client()
    .channel('mood-' + userId)
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'moods', filter: 'user_id=eq.' + userId },
      function(payload) { callback(payload.new || payload.old); }
    )
    .subscribe();
}
