// 房间配对管理
import { client } from '../data/supabase-client.js';
import { getLocal, setLocal, removeLocal } from '../data/cache.js';
import { getMyUserId, getMyNickname } from './auth-service.js';
import { setRoomId, getCurrentRoomId } from './mood-service.js';
import { CODE_CHARS, MIN_PASSWORD_LEN } from '../config.js';

var _roomCode = null;
var _partnerId = null;
var _partnerName = null;

// 生成 6 位房间号
function generateRoomCode() {
  var code = '';
  for (var i = 0; i < 6; i++) code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return code;
}

// 简单哈希密码（SHA-256 前 16 位 hex）
async function hashPassword(pwd) {
  var data = new TextEncoder().encode(pwd);
  var hash = await crypto.subtle.digest('SHA-256', data);
  var arr = new Uint8Array(hash);
  var hex = '';
  for (var i = 0; i < 16; i++) hex += arr[i].toString(16).padStart(2, '0');
  return hex;
}

// 创建房间
export async function createRoom(password) {
  var userId = getMyUserId();
  var roomCode = generateRoomCode();
  var pwdHash = await hashPassword(password);

  var { data, error } = await client()
    .from('rooms')
    .insert({
      room_code: roomCode,
      password_hash: pwdHash,
      creator_user_id: userId,
      member_count: 1
    })
    .select()
    .single();

  if (error || !data) return { error: '创建房间失败' };

  // 加入为成员
  await client().from('room_members').insert({ room_id: data.id, user_id: userId });

  _roomCode = roomCode;
  setRoomId(data.id);
  setLocal('room_code', roomCode);
  setLocal('room_id', data.id);

  return { success: true, roomCode: roomCode, roomId: data.id };
}

// 加入房间
export async function joinRoom(roomCode, password) {
  var userId = getMyUserId();

  // 查找房间
  var { data: rooms, error } = await client()
    .from('rooms')
    .select('*')
    .eq('room_code', roomCode.toUpperCase());

  if (error || !rooms || !rooms.length) return { error: '房间不存在' };

  var room = rooms[0];
  var pwdHash = await hashPassword(password);
  if (room.password_hash !== pwdHash) return { error: '密码错误' };

  if (room.member_count >= 2) {
    // 检查自己是否已是成员
    var { data: members } = await client()
      .from('room_members')
      .select('*')
      .eq('room_id', room.id)
      .eq('user_id', userId);
    if (members && members.length) {
      // 已是成员，允许重新加入
      _roomCode = roomCode;
      setRoomId(room.id);
      setLocal('room_code', roomCode);
      setLocal('room_id', room.id);
      await loadPartnerInfo(room.id);
      return { success: true, roomCode: roomCode, roomId: room.id, rejoined: true };
    }
    return { error: '房间已满' };
  }

  // 加入房间
  var { error: joinErr } = await client()
    .from('room_members')
    .insert({ room_id: room.id, user_id: userId });

  if (joinErr) return { error: '加入失败' };

  // 更新成员数
  await client().from('rooms').update({ member_count: 2 }).eq('id', room.id);

  _roomCode = roomCode;
  setRoomId(room.id);
  setLocal('room_code', roomCode);
  setLocal('room_id', room.id);
  await loadPartnerInfo(room.id);

  return { success: true, roomCode: roomCode, roomId: room.id };
}

// 获取对方信息
async function loadPartnerInfo(roomId) {
  var userId = getMyUserId();
  var { data: members } = await client()
    .from('room_members')
    .select('user_id')
    .eq('room_id', roomId);

  if (members) {
    for (var i = 0; i < members.length; i++) {
      if (members[i].user_id !== userId) {
        _partnerId = members[i].user_id;
        var { data: user } = await client()
          .from('users')
          .select('nickname')
          .eq('user_id', _partnerId)
          .single();
        _partnerName = user ? user.nickname : 'TA';
        setLocal('partner_id', _partnerId);
        setLocal('partner_name', _partnerName);
        return;
      }
    }
  }
}

// 获取配对状态
export function getPairingStatus() {
  var roomCode = _roomCode || getLocal('room_code');
  if (!roomCode) return { paired: false };
  return {
    paired: true,
    roomCode: roomCode,
    roomId: getCurrentRoomId() || getLocal('room_id'),
    partnerId: _partnerId || getLocal('partner_id'),
    partnerName: _partnerName || getLocal('partner_name') || 'TA'
  };
}

// 离开房间
export async function leaveRoom() {
  var userId = getMyUserId();
  var roomId = getCurrentRoomId() || getLocal('room_id');
  if (!roomId) return;

  await client().from('room_members').delete().eq('room_id', roomId).eq('user_id', userId);
  await client().from('rooms').update({ member_count: 1 }).eq('id', roomId);

  _roomCode = null;
  _partnerId = null;
  _partnerName = null;
  setRoomId(null);
  removeLocal('room_code');
  removeLocal('room_id');
  removeLocal('partner_id');
  removeLocal('partner_name');
}

export function getRoomCode() { return _roomCode || getLocal('room_code'); }
export function getPartnerId() { return _partnerId || getLocal('partner_id'); }
export function getPartnerName() { return _partnerName || getLocal('partner_name') || 'TA'; }
