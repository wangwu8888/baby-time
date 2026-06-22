// 智能关怀服务
import { getHour } from '../utils/date.js';
import { sendSystemMessage } from './message-service.js';
import { getPairingStatus } from './pairing-service.js';
import { getCached, setCached } from '../data/cache.js';

// 每日问候
export function getDailyGreeting() {
  var h = getHour();
  if (h >= 6 && h < 12) return '早安 ☀️，今天想和TA分享什么？';
  if (h >= 12 && h < 18) return '下午好 🌤️，此刻的心情是？';
  return '晚上好 🌙，今天过得怎么样？';
}

// 被动关怀
export async function checkPassiveCare() {
  var pairing = getPairingStatus();
  var h = getHour();

  // 深夜关怀
  if (h >= 0 && h < 5) {
    var shown = getCached('care:late_night');
    if (!shown) {
      setCached('care:late_night', true, 86400000);
      return { type: 'care', text: '这么晚还没睡？🌙 记得照顾好自己' };
    }
  }

  // 长时间未打开
  if (pairing.paired) {
    var lastOpen = getCached('care:last_open');
    if (lastOpen) {
      var days = Math.floor((Date.now() - lastOpen) / 86400000);
      if (days > 3) {
        return { type: 'care', text: '小窝落灰了，TA可能在想你 🏠' };
      }
    }
    setCached('care:last_open', Date.now(), 86400000 * 30);
  }

  return null;
}

// 最近心情趋势（检查连续低落）
export function checkMoodTrend(moods) {
  if (!moods || moods.length < 3) return null;
  var last3 = moods.slice(-3);
  var low = last3.every(function(m) { return m === 'rainy' || m === 'storm'; });
  if (low) {
    return '你最近好像有点累，TA也在关心你 💞';
  }
  return null;
}
