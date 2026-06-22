// 纪念墙业务逻辑
import { createAnniversary, getAnniversaries, deleteAnniversary } from '../data/anniversary-repo.js';
import { createWish, getWishes, toggleWish, deleteWish } from '../data/wish-repo.js';
import { getCurrentRoomId } from './mood-service.js';
import { getMyUserId } from './auth-service.js';

export async function addAnniversary(name, emoji, date) {
  var roomId = getCurrentRoomId();
  var userId = getMyUserId();
  if (!roomId) return null;
  return await createAnniversary(roomId, name, emoji, date, userId);
}

export async function loadAnniversaries() {
  var roomId = getCurrentRoomId();
  if (!roomId) return [];
  return await getAnniversaries(roomId);
}

export async function removeAnniversary(id) { return await deleteAnniversary(id); }

export async function addWish(text) {
  var roomId = getCurrentRoomId();
  var userId = getMyUserId();
  if (!roomId) return null;
  return await createWish(roomId, text, userId);
}

export async function loadWishes() {
  var roomId = getCurrentRoomId();
  if (!roomId) return [];
  return await getWishes(roomId);
}

export async function checkWish(id, done) {
  var userId = getMyUserId();
  return await toggleWish(id, done, userId);
}

export async function removeWish(id) { return await deleteWish(id); }
