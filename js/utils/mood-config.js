// 心情配置（从 config.js 重新导出，方便使用）
import { MOODS, getMoodColor } from '../config.js';
export { MOODS, getMoodColor };

// 所有心情 key 列表
export const MOOD_KEYS = Object.keys(MOODS);

// 获取心情图标+标签
export function getMoodInfo(status) {
  return MOODS[status] || MOODS.sunny;
}
