// 心情气象台 v3.0 — 入口
import { AppShell } from './ui/app-shell.js';

document.addEventListener('DOMContentLoaded', async function() {
  var shell = document.getElementById('app-shell');
  if (!shell) return;

  try {
    await AppShell.start();
  } catch (e) {
    console.error('App error:', e);
    shell.innerHTML = '<div style="padding:40px;text-align:center;font-family:sans-serif"><h2 style="color:#F97316">加载失败</h2><p style="color:#999;margin:12px 0">' + e.message + '</p><button onclick="location.reload()" style="background:#F97316;color:white;border:none;padding:12px 24px;border-radius:12px;font-size:16px;cursor:pointer">重新加载</button></div>';
  }
});
