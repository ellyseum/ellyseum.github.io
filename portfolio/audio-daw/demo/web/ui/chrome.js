/** Shared chrome: toast, status bar, saved-path link, and HTML escaping. */

/** Escape before any innerHTML interpolation. Cue names and prompts originate in
 *  sfx_bank.csv and file paths come off disk — external text either way. */
export const esc = s => String(s ?? '').replace(/[&<>"']/g,
  c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

let toastTimer = null;

export function toast(msg, kind = '') {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.className = kind;
  el.style.opacity = '1';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.style.opacity = '0'; }, 2600);
}

export function setStatus(msg) {
  const el = document.getElementById('status');
  if (el) el.textContent = msg;
}

export function showSaved(path) {
  const el = document.getElementById('saved');
  if (!el) return;
  el.innerHTML = `📄 saved → <a title="click to copy the path">${esc(path)}</a>`;
  el.querySelector('a').onclick = () => {
    navigator.clipboard?.writeText(path).catch(() => {});
    toast('path copied');
  };
}
