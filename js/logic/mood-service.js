// 心情业务逻辑
import { setMood, getMyMood } from '../data/mood-repo.js';
import { getMyUserId } from './auth-service.js';
import { getMoodColor, MOODS } from '../utils/mood-config.js';

var _currentMood = null;

// 设置心情
export async function updateMood(status) {
  var userId = getMyUserId();
  if (!userId) return;
  var roomId = getCurrentRoomId();
  await setMood(userId, roomId, status);
  var info = MOODS[status] || MOODS.sunny;
  _currentMood = { status: status, icon: info.icon, label: info.label, color: info.color, updatedAt: new Date().toISOString() };
  // 更新背景色
  document.body.style.background = info.color;
  return _currentMood;
}

// 获取当前心情
export async function loadMyMood() {
  var userId = getMyUserId();
  if (!userId) return _currentMood;
  var data = await getMyMood(userId);
  if (data) {
    var info = MOODS[data.status] || MOODS.sunny;
    _currentMood = { status: data.status, icon: info.icon, label: info.label, color: info.color, updatedAt: data.updated_at };
  }
  return _currentMood;
}

export function getCurrentMood() { return _currentMood; }
export function getMoodBg(status) { return getMoodColor(status); }

// 房间 ID（由 pairing-service 设置）
var _roomId = null;
export function setRoomId(id) { _roomId = id; }
export function getCurrentRoomId() { return _roomId; }
