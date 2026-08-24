/**
 * The bank tree — the persistent spine, and the bridge between modes (author a cue
 * in SFX, cut it in CUT, place it in ARRANGE).
 *
 * It exists because the v2 schema finally gave it something to stand on: before the
 * merge there was no category, no type, and no way to browse BGM at all.
 */
import { state, set } from '../state.js';

const esc = s => String(s).replace(/[&<>"']/g,
  c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const collapsed = new Set();

export function renderBank() {
  const host = document.getElementById('tree');
  if (!host) return;
  const q = (document.getElementById('filter')?.value || '').toLowerCase();
  const groupBy = document.getElementById('bankGroup')?.value || 'category';

  const cues = state.cues.filter(c =>
    !q || c.name.toLowerCase().includes(q) || c.id.toLowerCase().includes(q)
       || (c.category || '').includes(q));
  const tracks = state.tracks.filter(t => !q || t.name.toLowerCase().includes(q));

  const groups = new Map();
  const push = (k, item) => { if (!groups.has(k)) groups.set(k, []); groups.get(k).push(item); };

  // BGM first: it is the smallest group and the one that had no home before
  for (const t of tracks) push('▸ music', { kind: 'track', t });
  for (const c of cues) {
    const k = groupBy === 'flat' ? 'cues'
      : groupBy === 'type' ? c.type.toLowerCase()
      : (c.category || 'misc');
    push(k, { kind: 'cue', c });
  }

  let html = '';
  for (const [name, items] of groups) {
    const isOpen = !collapsed.has(name);
    html += `<div class="grp-h" data-grp="${esc(name)}">${isOpen ? '▾' : '▸'} ${esc(name)} <span class="tag">${items.length}</span></div>`;
    if (!isOpen) continue;
    for (const it of items) {
      if (it.kind === 'track') {
        const sel = state.sel?.kind === 'track' && state.sel.path === it.t.path;
        const mb = (it.t.bytes / 1048576).toFixed(1);
        html += `<div class="row ${sel ? 'sel' : ''}" data-track="${esc(it.t.path)}">`
             + `${esc(it.t.name)} <span class="tag">${mb}MB</span></div>`;
      } else {
        const c = it.c;
        const sel = state.sel?.kind === 'cue' && state.sel.id === c.id;
        const takes = c.takes?.length || 0;
        const kept = c.takes?.some(t => t.keep);
        html += `<div class="row ${sel ? 'sel' : ''}" data-cue="${esc(c.id)}">`
             + `<span class="id">${esc(c.id)}</span> ${esc(c.name)}`
             + (takes ? ` <span class="tag">[${takes}]</span>` : '')
             + (kept ? ' <span class="star">★</span>' : '')
             + (c.type === 'Loop' ? ' <span class="tag">↻</span>' : '')
             + `</div>`;
      }
    }
  }
  host.innerHTML = html || '<div class="info" style="padding:10px">no matches</div>';

  host.querySelectorAll('[data-grp]').forEach(el => el.onclick = () => {
    const k = el.dataset.grp;
    collapsed.has(k) ? collapsed.delete(k) : collapsed.add(k);
    renderBank();
  });
  host.querySelectorAll('[data-cue]').forEach(el => el.onclick = () =>
    set({ sel: { kind: 'cue', id: el.dataset.cue } }, 'select'));
  host.querySelectorAll('[data-track]').forEach(el => el.onclick = () =>
    set({ sel: { kind: 'track', path: el.dataset.track } }, 'select'));
}

export function wireBank() {
  document.getElementById('filter')?.addEventListener('input', renderBank);
  document.getElementById('bankGroup')?.addEventListener('change', renderBank);
  document.getElementById('bankToggle')?.addEventListener('click', () =>
    document.getElementById('app').classList.toggle('nobank'));
}
