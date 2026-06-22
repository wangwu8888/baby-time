// 心情气象台 v3.0 — 入口
import { AppShell } from './ui/app-shell.js';
import { migrateIfNeeded } from '../migration/migrate-from-v2.js';

document.addEventListener('DOMContentLoaded', async function() {
  // 先尝试迁移旧数据
  try {
    var result = await migrateIfNeeded();
    if (result.migrated) {
      console.log('v2 → v3 迁移完成，' + (result.messageCount || 0) + ' 条消息已迁移');
    }
  } catch (e) {
    console.error('迁移检查失败:', e);
  }

  // 启动应用
  AppShell.start();
});
