// 统计服务
import { getMessages } from '../data/message-repo.js';
import { getCurrentRoomId } from './mood-service.js';

// 在一起天数（从第一条消息算起）
export async function getTogetherDays() {
  var roomId = getCurrentRoomId();
  if (!roomId) return 0;
  var msgs = await getMessages(roomId, 1, null);
  if (!msgs.length) return 1;
  var firstDate = new Date(msgs[0].created_at);
  return Math.floor((Date.now() - firstDate) / 86400000) + 1;
}

// 心情周报数据（最近 7 天心情分布）
export async function getWeeklyMoodReport() {
  var roomId = getCurrentRoomId();
  if (!roomId) return null;
  var msgs = await getMessages(roomId, 200, null);
  var moodChanges = msgs.filter(function(m) { return m.type === 'mood_change'; });
  var today = new Date();
  var days = [];
  for (var i = 6; i >= 0; i--) {
    var d = new Date(today);
    d.setDate(d.getDate() - i);
    var key = d.toISOString().slice(0, 10);
    days.push({ date: key, label: (d.getMonth() + 1) + '/' + d.getDate(), moods: [] });
  }
  moodChanges.forEach(function(m) {
    var key = m.created_at.slice(0, 10);
    var day = days.find(function(d) { return d.date === key; });
    if (day && m.content && m.content.mood) day.moods.push(m.content.mood);
  });
  return days;
}

// 总消息数
export async function getTotalMessages() {
  var roomId = getCurrentRoomId();
  if (!roomId) return 0;
  var msgs = await getMessages(roomId, 1000, null);
  return msgs.length;
}
