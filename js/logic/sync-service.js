// 实时同步服务
import { client } from '../data/supabase-client.js';
import { getCurrentRoomId } from './mood-service.js';
import { getPartnerId } from './pairing-service.js';
import { StatusIndicator } from '../ui/status-indicator.js';
import { ReconnectionBanner } from '../ui/reconnection-banner.js';
import { TypingIndicator } from '../ui/typing-indicator.js';
import { startMessageSubscription, stopMessageSubscription } from './message-service.js';

var _presenceChannel = null;
var _broadcastChannel = null;

// 启动所有实时连接
export function connect(onMessage) {
  var roomId = getCurrentRoomId();
  if (!roomId) return;

  // 消息订阅
  startMessageSubscription(onMessage);

  // 在线状态（Presence）
  var userId = getMyUserId();
  _presenceChannel = client()
    .channel('presence-' + roomId)
    .on('presence', { event: 'sync' }, function() {
      var state = _presenceChannel.presenceState();
      var partnerId = getPartnerId();
      if (partnerId && state[partnerId] && state[partnerId].length > 0) {
        StatusIndicator.setOnline(state[partnerId][0].name);
        ReconnectionBanner.hide();
      } else {
        StatusIndicator.setOffline(state[partnerId] ? state[partnerId][0]?.name : 'TA', '稍早');
      }
    })
    .subscribe(function(status) {
      if (status === 'SUBSCRIBED') {
        _presenceChannel.track({ name: getMyNickname(), online: true });
      } else if (status === 'CHANNEL_ERROR') {
        ReconnectionBanner.show('连接中断，正在重连…');
        setTimeout(function() { connect(onMessage); }, 3000);
      }
    });

  // 广播频道（输入状态等）
  _broadcastChannel = client()
    .channel('broadcast-' + roomId)
    .on('broadcast', { event: 'typing' }, function(payload) {
      TypingIndicator.show(payload.payload.name);
    })
    .subscribe();
}

export function disconnect() {
  stopMessageSubscription();
  if (_presenceChannel) { _presenceChannel.unsubscribe(); _presenceChannel = null; }
  if (_broadcastChannel) { _broadcastChannel.unsubscribe(); _broadcastChannel = null; }
}

export function sendTyping() {
  if (_broadcastChannel) {
    _broadcastChannel.send({ type: 'broadcast', event: 'typing', payload: { name: getMyNickname() } });
  }
}

import { getMyNickname } from './auth-service.js';
