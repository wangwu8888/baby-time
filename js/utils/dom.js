// DOM 工具
export function $(sel, parent) { return (parent || document).querySelector(sel); }
export function $$(sel, parent) { return Array.from((parent || document).querySelectorAll(sel)); }

export function escapeHtml(text) {
  var d = document.createElement('div');
  d.textContent = text;
  return d.innerHTML;
}

// 生成 UUID
export function generateId() {
  return crypto.randomUUID ? crypto.randomUUID() :
    'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
}

// Toast
var _toastTimer = null;
export function showToast(msg, duration) {
  duration = duration || 2000;
  var t = $('#toast');
  if (!t) { t = createToast(); }
  t.textContent = msg;
  t.classList.remove('hidden');
  requestAnimationFrame(function() { t.classList.add('show'); });
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(function() {
    t.classList.remove('show');
    setTimeout(function() { t.classList.add('hidden'); }, 300);
  }, duration);
}

function createToast() {
  var t = document.createElement('div');
  t.id = 'toast';
  t.className = 'toast hidden';
  document.body.appendChild(t);
  return t;
}

// 弹窗
export function showModal(title, bodyHtml, onClose) {
  var existing = $('#modal-generic');
  if (existing) existing.remove();
  var m = document.createElement('div');
  m.id = 'modal-generic';
  m.className = 'modal';
  m.innerHTML = '<div class="modal-backdrop"></div><div class="modal-card"><h3>' + escapeHtml(title) + '</h3><div class="modal-body">' + bodyHtml + '</div><button class="btn-secondary btn-full modal-close-btn">关闭</button></div>';
  m.querySelector('.modal-backdrop').addEventListener('click', function() { m.remove(); if (onClose) onClose(); });
  m.querySelector('.modal-close-btn').addEventListener('click', function() { m.remove(); if (onClose) onClose(); });
  document.body.appendChild(m);
}

// 确认框
export function showConfirm(title, msg) {
  return new Promise(function(resolve) {
    showModal(title, '<p style="text-align:center;color:var(--text-dim)">' + escapeHtml(msg) + '</p><div style="display:flex;gap:8px;margin-top:12px"><button class="btn-danger btn-full" id="confirm-yes">确认</button><button class="btn-secondary btn-full modal-close-btn">取消</button></div>');
    setTimeout(function() {
      var yes = $('#confirm-yes');
      if (yes) yes.addEventListener('click', function() {
        var m = $('#modal-generic'); if (m) m.remove();
        resolve(true);
      });
    }, 50);
  });
}
