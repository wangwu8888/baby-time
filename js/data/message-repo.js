// messages 表操作
import { client } from './supabase-client.js';

export async function sendMessage(roomId, senderUserId, type, content, replyToId) {
  var { data, error } = await client()
    .from('messages')
    .insert({
      room_id: roomId,
      sender_user_id: senderUserId,
      type: type || 'text',
      content: content || {},
      reply_to_id: replyToId || null
    })
    .select()
    .single();
  if (error) { console.error('sendMessage:', error); return null; }
  return data;
}

export async function getMessages(roomId, limit, before) {
  limit = limit || 50;
  var query = client()
    .from('messages')
    .select('*')
    .eq('room_id', roomId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (before) query = query.lt('created_at', before);
  var { data, error } = await query;
  if (error) { console.error('getMessages:', error); return []; }
  return (data || []).reverse(); // 返回升序
}

export async function markRead(messageId, userId) {
  var { data: msg } = await client().from('messages').select('read_by').eq('id', messageId).single();
  if (!msg) return;
  var readBy = msg.read_by || [];
  if (!readBy.some(function(r) { return r.user_id === userId; })) {
    readBy.push({ user_id: userId, read_at: new Date().toISOString() });
    await client().from('messages').update({ read_by: readBy }).eq('id', messageId);
  }
}

// Realtime 订阅（根据 room_id 过滤）
export function subscribeMessages(roomId, onInsert) {
  return client()
    .channel('msgs-' + roomId)
    .on('postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'messages', filter: 'room_id=eq.' + roomId },
      function(payload) { onInsert(payload.new); }
    )
    .subscribe();
}
