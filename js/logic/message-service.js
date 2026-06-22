// 消息业务逻辑
import { sendMessage, getMessages, subscribeMessages, markRead } from '../data/message-repo.js';
import { getMyUserId } from './auth-service.js';
import { getCurrentRoomId } from './mood-service.js';
import { getRoomCode } from './pairing-service.js';
import { encrypt, decrypt } from './crypto-service.js';

var _onNewMessage = null;
var _channel = null;

// 发送文字消息
export async function sendTextMessage(text, replyToId) {
  var userId = getMyUserId();
  var roomId = getCurrentRoomId();
  var roomCode = getRoomCode();
  if (!userId || !roomId) return null;

  var cipherText = await encrypt(text, roomCode);
  return await sendMessage(roomId, userId, 'text', { text: cipherText, encrypted: true }, replyToId);
}

// 发送涂鸦消息
export async function sendDoodleMessage(dataUrl, replyToId) {
  var userId = getMyUserId();
  var roomId = getCurrentRoomId();
  if (!userId || !roomId) return null;
  return await sendMessage(roomId, userId, 'doodle', { doodleDataUrl: dataUrl }, replyToId);
}

// 发送心情变化消息
export async function sendMoodChangeMessage(mood) {
  var userId = getMyUserId();
  var roomId = getCurrentRoomId();
  if (!userId || !roomId) return null;
  return await sendMessage(roomId, userId, 'mood_change', { mood: mood });
}

// 发送系统消息（由 care-service/stats-service 调用）
export async function sendSystemMessage(text) {
  var userId = getMyUserId();
  var roomId = getCurrentRoomId();
  if (!userId || !roomId) return null;
  return await sendMessage(roomId, userId, 'system', { text: text });
}

// 加载历史消息
export async function loadMessages(limit, before) {
  var roomId = getCurrentRoomId();
  if (!roomId) return [];
  return await getMessages(roomId, limit, before);
}

// 解密消息内容
export async function decryptMessage(msg) {
  var roomCode = getRoomCode();
  if (msg.type === 'text' && msg.content && msg.content.encrypted && msg.content.text) {
    msg.content.text = await decrypt(msg.content.text, roomCode);
    msg.content.encrypted = false;
  }
  return msg;
}

// 订阅实时消息
export function startMessageSubscription(callback) {
  var roomId = getCurrentRoomId();
  if (!roomId) return;
  _onNewMessage = callback;
  _channel = subscribeMessages(roomId, async function(msg) {
    if (msg.sender_user_id !== getMyUserId()) {
      msg = await decryptMessage(msg);
      markRead(msg.id, getMyUserId());
    }
    if (_onNewMessage) _onNewMessage(msg);
  });
}

export function stopMessageSubscription() {
  if (_channel) { _channel.unsubscribe(); _channel = null; }
}
