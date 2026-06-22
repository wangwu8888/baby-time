// users 表操作
import { client } from './supabase-client.js';
import { getCached, setCached } from './cache.js';

export async function createUser(userId, nickname) {
  var { data, error } = await client()
    .from('users')
    .insert({ user_id: userId, nickname: nickname });
  if (error) { console.error('createUser:', error); return null; }
  return data;
}

export async function getUser(userId) {
  var cached = getCached('user:' + userId);
  if (cached) return cached;

  var { data, error } = await client()
    .from('users')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error || !data) return null;
  setCached('user:' + userId, data);
  return data;
}

export async function userExists(userId) {
  var { count, error } = await client()
    .from('users')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);
  return count > 0;
}

export async function updateNickname(userId, nickname) {
  var { error } = await client()
    .from('users')
    .update({ nickname: nickname })
    .eq('user_id', userId);
  if (!error) setCached('user:' + userId, null);
  return !error;
}

export async function updateLastActive(userId) {
  await client()
    .from('users')
    .update({ last_active_at: new Date().toISOString() })
    .eq('user_id', userId);
}
