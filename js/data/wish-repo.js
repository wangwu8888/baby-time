// wishes 表操作
import { client } from './supabase-client.js';

export async function createWish(roomId, text, createdBy) {
  var { data, error } = await client()
    .from('wishes')
    .insert({ room_id: roomId, text: text, created_by: createdBy, is_done: false })
    .select().single();
  if (error) { console.error('createWish:', error); return null; }
  return data;
}

export async function getWishes(roomId) {
  var { data, error } = await client()
    .from('wishes')
    .select('*')
    .eq('room_id', roomId)
    .order('created_at', { ascending: true });
  if (error) return [];
  return data || [];
}

export async function toggleWish(id, isDone, doneBy) {
  var { error } = await client()
    .from('wishes')
    .update({ is_done: isDone, done_by: doneBy, done_at: isDone ? new Date().toISOString() : null })
    .eq('id', id);
  return !error;
}

export async function deleteWish(id) {
  var { error } = await client().from('wishes').delete().eq('id', id);
  return !error;
}
