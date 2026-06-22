// diaries 表操作
import { client } from './supabase-client.js';
import { getCached, setCached } from './cache.js';

export async function createEntry(userId, mood, text, doodleDataUrl) {
  var { data, error } = await client()
    .from('diaries')
    .insert({
      user_id: userId,
      mood: mood || 'sunny',
      text: text || '',
      doodle_data_url: doodleDataUrl || null
    })
    .select()
    .single();
  if (error) { console.error('createEntry:', error); return null; }
  // 清除缓存
  removeCached('diaries:' + userId);
  return data;
}

export async function getEntries(userId, limit, offset) {
  limit = limit || 50;
  offset = offset || 0;
  var cached = getCached('diaries:' + userId);
  if (cached && offset === 0 && limit <= 50) return cached;

  var { data, error } = await client()
    .from('diaries')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) { console.error('getEntries:', error); return []; }
  if (offset === 0) setCached('diaries:' + userId, data);
  return data || [];
}

export async function updateEntry(entryId, updates) {
  var { error } = await client()
    .from('diaries')
    .update(updates)
    .eq('id', entryId);
  return !error;
}

export async function deleteEntry(entryId) {
  var { error } = await client()
    .from('diaries')
    .delete()
    .eq('id', entryId);
  return !error;
}
