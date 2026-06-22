// 心情气象台 v3.0 — 全局配置
export const SUPABASE_URL = 'https://dunadheorduiyxmfzlfu.supabase.co';
export const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR1bmFkaGVvcmR1aXl4bWZ6bGZ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE4OTQ0ODksImV4cCI6MjA5NzQ3MDQ4OX0.s8a5FLcmYmHv-1IaidLnu_5VRxJf6JEvsl8u20MpZcA';

// 心情类型定义
export const MOODS = {
  sunny:  { icon: '☀️', label: '晴朗', color: '#FFF8E1', accent: '#F59E0B' },
  cloudy: { icon: '☁️', label: '多云', color: '#F1F5F9', accent: '#64748B' },
  rainy:  { icon: '🌧️', label: '雨天', color: '#EFF6FF', accent: '#3B82F6' },
  storm:  { icon: '⛈️', label: '雷暴', color: '#F5F3FF', accent: '#8B5CF6' },
  love:   { icon: '❤️', label: '爱心', color: '#FFF1F2', accent: '#F43F5E' },
  dnd:    { icon: '🔕', label: '勿扰', color: '#FAFAF8', accent: '#9CA3AF' }
};

// 获取心情颜色（背景色）
export function getMoodColor(status) {
  return MOODS[status] ? MOODS[status].color : MOODS.sunny.color;
}

// 情感色
export const COLORS = {
  bg:         '#FFF7ED',
  card:       '#FFFFFF',
  primary:    '#F97316',
  primaryDim: '#FDBA74',
  text:       '#475569',
  textDim:    '#94A3B8',
  border:     '#FED7AA',
  success:    '#34D399',
  danger:     '#F87171',
  online:     '#22C55E',
  radius:     '20px',
  radiusSm:   '12px',
  shadow:     '0 2px 12px rgba(0,0,0,0.06)',
  font:       '"Segoe UI", system-ui, -apple-system, sans-serif'
};

// 配对码字符集（避开易混淆字符）
export const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

// 密码最小长度
export const MIN_PASSWORD_LEN = 4;

// 消息上限
export const MAX_MESSAGES = 200;
