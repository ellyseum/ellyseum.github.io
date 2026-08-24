/**
 * SFX mode — the cue BANK, not a single-clip editor.
 *
 * SFX is a many-small-files workflow: you rip through dozens of cues auditioning
 * takes and picking keepers. That is a different job from editing one waveform, which
 * is why it gets its own mode with a triage list rather than living inside CUT.
 *
 * Folds in what sfx_review.html did as a standalone page (★ keeper toggles, filters)
 * — except the keeper flag is persisted into the cue record via /cue instead of into
 * a browser localStorage island that only that page could see.
 */
import { state, set } from '../state.js';
import { toast, esc } from '../ui/chrome.js';

let filterMode = 'all';

export function renderSfx(host, engine, load) {
  const cues = state.cues.filter(c =>
    filterMode === 'all' ? true
    : filterMode === 'takes' ? (c.takes?.length > 0)
    : c.takes?.some(t => t.keep));

  host.innerHTML = `
    <h2>SFX <span class="sub">cue bank · ${cues.length} of ${state.cues.length}</span></h2>
    <div class="bar2">
      <button data-f="all"     class="${filterMode === 'all' ? 'on' : ''}">All</button>
      <button data-f="takes"   class="${filterMode === 'takes' ? 'on' : ''}">Has takes</button>
      <button data-f="keepers" class="${filterMode === 'keepers' ? 'on' : ''}">★ Keepers</button>
      <span class="sep"></span>
      <span class="info">Click a source to audition · ★ marks the take to ship</span>
    </div>
    <div id="cueList"></div>
  `;

  host.querySelectorAll('[data-f]').forEach(b => b.onclick = () => {
    filterMode = b.dataset.f;
    renderSfx(host, engine, load);
  });

  const list = document.getElementById('cueList');
  list.innerHTML = cues.map(c => {
    const srcs = [{ label: 'OG', path: c.og, keep: false, i: -1 }]
      .concat((c.takes || []).map((t, i) => ({ label: `take ${i + 1}`, path: t.path, keep: t.keep, i })));
    return `<div class="wrap" style="padding:8px;margin:6px 0">
      <div><span class="id q">${esc(c.id)}</span> <b>${esc(c.name)}</b>
        <span class="tag dim">${esc(c.type)} · ${esc(c.category)}</span></div>
      <div class="info" style="font-size:11px">${esc(c.prompt)}</div>
      <div>${srcs.map(s => `<span class="src" data-path="${esc(s.path)}" data-cue="${esc(c.id)}" data-take="${s.i}">
        ${esc(s.label)}${s.keep ? ' ★' : ''}</span>`).join('')}</div>
    </div>`;
  }).join('') || '<div class="info">no cues match this filter</div>';

  list.querySelectorAll('.src').forEach(el => {
    el.onclick = () => load(el.dataset.path);
    el.oncontextmenu = ev => {          // right-click toggles the keeper flag
      ev.preventDefault();
      const i = Number(el.dataset.take);
      if (i < 0) return toast('the OG reference cannot be a keeper', 'bad');
      toggleKeep(el.dataset.cue, i, host, engine, load);
    };
  });
}

async function toggleKeep(cueId, takeIndex, host, engine, load) {
  const cue = state.cues.find(c => c.id === cueId);
  const take = cue?.takes?.[takeIndex];
  if (!take) return;
  take.keep = !take.keep;
  try {
    const r = await fetch('/cue', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: cueId, takes: cue.takes }),
    });
    if (!r.ok) throw new Error(await r.text());
    toast(`${cue.id} take ${takeIndex + 1} ${take.keep ? 'marked ★ keeper' : 'unmarked'}`);
  } catch (e) {
    take.keep = !take.keep;   // roll back the optimistic flip
    toast('could not save keeper flag: ' + e.message, 'bad');
  }
  renderSfx(host, engine, load);
}
