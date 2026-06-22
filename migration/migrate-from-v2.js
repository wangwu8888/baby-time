// v2 → v3 一次性数据迁移
// 在 app.js 启动时调用，检查旧数据并迁移到新表结构
import { client } from '../js/data/supabase-client.js';
import { getLocal, setLocal, removeLocal } from '../js/data/cache.js';
import { generateId } from '../js/utils/dom.js';

var OLD_BASE = 'https://dunadheorduiyxmfzlfu.supabase.co/rest/v1/sync_data';
var OLD_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR1bmFkaGVvcmR1aXl4bWZ6bGZ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE4OTQ0ODksImV4cCI6MjA5NzQ3MDQ4OX0.s8a5FLcmYmHv-1IaidLnu_5VRxJf6JEvsl8u20MpZcA';

export async function migrateIfNeeded() {
  // 已经迁移过
  if (getLocal('migrated_v3')) return { migrated: false };

  // 检查是否有旧数据
  var oldRoomCode = getLocal('sync_roomCode');
  var oldMyId = getLocal('sync_myId');
  if (!oldRoomCode || !oldMyId) {
    // 没有旧数据，全新用户
    setLocal('migrated_v3', true);
    return { migrated: false };
  }

  console.log('检测到旧版本数据，开始迁移…');

  try {
    // 1. 获取旧行数据
    var oldRow = await _oldGet('room_code=eq.' + encodeURIComponent(oldRoomCode));
    if (!oldRow) {
      console.log('旧数据不存在，跳过迁移');
      setLocal('migrated_v3', true);
      return { migrated: false };
    }

    // 2. 确定用户身份
    var mySlot = parseInt(oldMyId);
    var partnerSlot = mySlot === 1 ? 2 : 1;
    var myCode = oldRow['user' + mySlot + '_name'] || getLocal('my_pair_code') || generateId();
    var partnerCode = oldRow['user' + partnerSlot + '_name'] || '';

    // 3. 创建/查找 user
    var userId = generateId();
    setLocal('user_id', userId);

    var nickname = getLocal('sync_partnerName') || '我';
    await _upsertUser(userId, nickname);
    if (partnerCode && partnerCode !== '我') {
      await _upsertUser(partnerCode, 'TA');
    } else if (partnerCode === '我') {
      // 旧版两个人都叫 '我'，生成新的 partner ID
      partnerCode = generateId();
      await _upsertUser(partnerCode, 'TA');
    }

    // 4. 创建房间
    var roomId = null;
    if (oldRoomCode) {
      var { data: rooms } = await client().from('rooms').select('*').eq('room_code', oldRoomCode);
      if (rooms && rooms.length) {
        roomId = rooms[0].id;
      } else {
        // 创建房间（用旧密码逻辑 — room_code 的 hash）
        var pwdData = new TextEncoder().encode(oldRoomCode);
        var pwdHash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', pwdData)).slice(0, 16))
          .map(function(b) { return b.toString(16).padStart(2, '0'); }).join('');

        var { data: newRoom } = await client().from('rooms').insert({
          room_code: oldRoomCode,
          password_hash: pwdHash,
          creator_user_id: mySlot === 1 ? userId : partnerCode,
          member_count: 2
        }).select().single();
        if (newRoom) roomId = newRoom.id;
      }
    }

    // 5. 加入房间成员
    if (roomId) {
      await client().from('room_members').upsert({ room_id: roomId, user_id: userId }, { onConflict: 'room_id,user_id' });
      if (partnerCode) {
        await client().from('room_members').upsert({ room_id: roomId, user_id: partnerCode }, { onConflict: 'room_id,user_id' });
      }
      setLocal('room_id', roomId);
      setLocal('room_code', oldRoomCode);
      setLocal('partner_id', partnerCode);
    }

    // 6. 迁移心情
    var myMood = oldRow['user' + mySlot + '_mood'];
    if (myMood && myMood.status) {
      await client().from('moods').upsert({
        user_id: userId,
        room_id: roomId,
        status: myMood.status,
        updated_at: myMood.updatedAt || new Date().toISOString()
      }, { onConflict: 'user_id' });
    }

    // 7. 迁移消息
    var messages = oldRow.messages || [];
    for (var i = 0; i < messages.length; i++) {
      var m = messages[i];
      var senderId = m.sender === mySlot ? userId : partnerCode;
      var type = m.doodleDataUrl ? 'doodle' : 'text';
      var content = {
        text: m.text || '',
        doodleDataUrl: m.doodleDataUrl || null,
        encrypted: true // 旧消息使用旧的加密方式
      };
      await client().from('messages').insert({
        room_id: roomId,
        sender_user_id: senderId,
        type: type,
        content: content,
        created_at: m.createdAt || new Date().toISOString()
      });
    }

    // 8. 清理旧 localStorage 键
    var oldKeys = ['sync_roomCode', 'sync_myId', 'sync_partnerName', 'my_pair_code',
      'moodState_me', 'moodState_ta', 'treeholeEntries_me', 'treeholeEntries_ta',
      'settings_me', 'settings_ta'];
    oldKeys.forEach(function(k) { removeLocal(k); });

    // 9. 标记迁移完成
    setLocal('migrated_v3', true);
    console.log('迁移完成！', messages.length, '条消息已迁移');
    return { migrated: true, messageCount: messages.length };

  } catch (e) {
    console.error('迁移失败:', e);
    return { migrated: false, error: e.message };
  }
}

// 旧版 GET 请求
function _oldGet(query) {
  return new Promise(function(resolve) {
    var x = new XMLHttpRequest();
    x.open('GET', OLD_BASE + '?' + query + '&limit=1', true);
    x.setRequestHeader('apikey', OLD_KEY);
    x.setRequestHeader('Authorization', 'Bearer ' + OLD_KEY);
    x.timeout = 10000;
    x.onload = function() {
      if (x.status === 200) {
        try { var r = JSON.parse(x.responseText); resolve(r.length ? r[0] : null); } catch(e) { resolve(null); }
      } else { resolve(null); }
    };
    x.onerror = function() { resolve(null); };
    x.send();
  });
}

async function _upsertUser(id, name) {
  var { error } = await client().from('users').upsert({ user_id: id, nickname: name }, { onConflict: 'user_id' });
  if (error) console.error('upsertUser:', error);
}
