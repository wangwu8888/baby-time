// anniversaries 表操作
import { client } from './supabase-client.js';

export async function createAnniversary(roomId, name, emoji, date, createdBy) {
  var { data, error } = await client()
    .from('anniversaries')
    .insert({ room_id: roomId, name: name, emoji: emoji, date: date, created_by: createdBy })
    .select().single();
  if (error) { console.error('createAnniversary:', error); return null; }
  return data;
}

export async function getAnniversaries(roomId) {
  var { data, error } = await client()
    .from('anniversaries')
    .select('*')
    .eq('room_id', roomId)
    .order('date', { ascending: true });
  if (error) return [];
  return data || [];
}

export async function deleteAnniversary(id) {
  var { error } = await client().from('anniversaries').delete().eq('id', id);
  return !error;
}
