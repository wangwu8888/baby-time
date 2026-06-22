// 通用弹窗
import { $ } from '../utils/dom.js';

export function showModal(title, bodyHtml) {
  var existing = $('#modal-generic');
  if (existing) existing.remove();
  var m = document.createElement('div');
  m.id = 'modal-generic';
  m.className = 'modal';
  m.innerHTML = '<div class="modal-backdrop"></div><div class="modal-card"><h3>' + title + '</h3><div class="modal-body">' + bodyHtml + '</div><button class="btn-secondary btn-full modal-close-btn">关闭</button></div>';
  m.querySelector('.modal-backdrop').addEventListener('click', function() { m.remove(); });
  m.querySelector('.modal-close-btn').addEventListener('click', function() { m.remove(); });
  document.body.appendChild(m);
  return m;
}

export function showImageFullscreen(src) {
  var d = document.createElement('div');
  d.className = 'fullscreen-viewer';
  d.innerHTML = '<img src="' + src + '" alt="查看">';
  d.addEventListener('click', function() { d.remove(); });
  document.body.appendChild(d);
}
