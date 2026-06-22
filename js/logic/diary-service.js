// 日记业务逻辑
import { createEntry, getEntries, updateEntry, deleteEntry } from '../data/diary-repo.js';
import { getMyUserId } from './auth-service.js';

export async function addDiaryEntry(mood, text, doodleDataUrl) {
  var userId = getMyUserId();
  if (!userId) return null;
  return await createEntry(userId, mood, text, doodleDataUrl);
}

export async function loadDiaryEntries(limit, offset) {
  var userId = getMyUserId();
  if (!userId) return [];
  return await getEntries(userId, limit, offset);
}

export async function editDiaryEntry(entryId, updates) {
  return await updateEntry(entryId, updates);
}

export async function removeDiaryEntry(entryId) {
  return await deleteEntry(entryId);
}
