// 用户身份管理
import { createUser, getUser, userExists, updateLastActive } from '../data/user-repo.js';
import { getLocal, setLocal } from '../data/cache.js';
import { generateId } from '../utils/dom.js';

var _userId = null;
var _nickname = '';

// 初始化用户身份
export async function initIdentity() {
  // 1. 检查 localStorage 是否有 user_id
  var stored = getLocal('user_id');
  if (stored) {
    _userId = stored;
    // 验证用户是否在数据库中存在
    var user = await getUser(_userId);
    if (user) {
      _nickname = user.nickname || '';
      // 更新活跃时间
      updateLastActive(_userId);
      return { userId: _userId, nickname: _nickname, isNew: false };
    }
    // 用户不在数据库（可能被清除），创建新记录
  }

  // 2. 新用户：生成 UUID
  _userId = generateId();
  setLocal('user_id', _userId);
  return { userId: _userId, nickname: '', isNew: true };
}

// 设置昵称
export async function setNickname(name) {
  _nickname = name;
  // 如果用户已存在则更新，否则创建
  var exists = await userExists(_userId);
  if (exists) {
    await updateNickname(_userId, name);
  } else {
    await createUser(_userId, name);
  }
  setLocal('nickname', name);
  return name;
}

export function getMyUserId() { return _userId; }
export function getMyNickname() { return _nickname || getLocal('nickname') || ''; }

// 心跳
export function heartbeat() {
  if (_userId) updateLastActive(_userId);
}

setInterval(heartbeat, 60000); // 每分钟更新活跃时间
