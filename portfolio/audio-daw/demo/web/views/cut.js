/**
 * CUT mode — the destructive waveform surface.
 *
 * This is the substrate SFX and MUSIC both sit on, which is exactly why it is its own
 * mode rather than a toolbar bolted onto the SFX editor (its previous form). Every
 * verb here is a pure function from audio/buffer-ops.js, so undo is just keeping the
 * previous buffer and nothing needs a live AudioContext to be correct.
 *
 * Delete / Silence / Trim are deliberately separate: silence PRESERVES length, cut
 * closes the gap. On a loop that difference is the whole ballgame.
 */
import { state, set, pushUndo, commit, undo, redo } from '../state.js';
import * as ops from '../audio/buffer-ops.js';
import { Waveform } from '../ui/waveform.js';
import { toAudioBuffer } from '../audio/engine.js';
import { toast, esc } from '../ui/chrome.js';

let wf = null;

export function renderCut(host, engine) {
  const has = !!state.pcm;
  host.innerHTML = `
    <h2>CUT <span class="sub">${esc(state.sourcePath ? state.sourcePath.split('/').pop() : 'waveform editing')}</span></h2>
    ${has ? '' : '<div class="info">Pick anything from the bank to edit it.</div>'}
    <div id="wfhost"></div>

    <div class="bar2">
      <button id="cPlay" class="go">▶</button><button id="cStop">■</button>
      <button id="cLoop">↻ loop selection</button>
      <span class="sep"></span>
      <button id="cZin">＋</button><button id="cZout">－</button>
      <button id="cFit">⤢ Fit</button><button id="cAll">Select all</button>
    </div>

    <div class="bar2">
      <button id="cTrim" title="Ctrl+T">Trim</button>
      <button id="cCut" title="Ctrl+X — removes and closes the gap">Cut</button>
      <button id="cSil" title="Ctrl+L — zeroes but keeps the timing">Silence</button>
      <button id="cRev">Reverse</button>
      <button id="cFin">Fade in</button><button id="cFout">Fade out</button>
      <span class="sep"></span>
      <button id="cAmp">Gain</button>
      <input id="cDb" type="number" value="3" step="1" style="width:52px"><span class="dim">dB</span>
      <button id="cNorm">Normalize</button>
      <button id="cDc" title="A DC bias guarantees a click at a loop seam">Remove DC</button>
    </div>

    <div class="bar2">
      <button id="cUndo" title="Ctrl+Z">↶ Undo</button>
      <button id="cRedo" title="Ctrl+Y">↷ Redo</button>
      <span class="sep"></span>
      <span id="cInfo" class="info mono"></span>
    </div>
  `;
  if (!has) return;

  const sr = state.pcm.sampleRate;
  const $ = id => document.getElementById(id);

  wf = new Waveform(document.getElementById('wfhost'), {
    height: 170,
    onSeek: f => engine.play(f, { once: true }),
    onRange: () => info(),
  });
  wf.setPcm(state.pcm);

  function info() {
    const n = ops.frames(state.pcm);
    const r = wf.range;
    $('cInfo').textContent =
      `${(n / sr).toFixed(3)}s @${sr}Hz · ${n} frames`
      + (r ? ` | sel ${Math.round(r.end - r.start)} frames (${((r.end - r.start) / sr).toFixed(3)}s)` : '')
      + ` | undo ${state.undo.length}`;
  }

  const range = () => wf.range ? [wf.range.start, wf.range.end] : [0, ops.frames(state.pcm)];
  const needSel = () => {
    if (!wf.range) { toast('select a region first', 'bad'); return false; }
    return true;
  };
  const apply = fn => {
    pushUndo();
    const next = fn(...range());
    commit(next);
    wf.setPcm(next, { fit: false });
    engine.setBuffer(toAudioBuffer(next, engine.ctx));
    info();
  };

  $('cPlay').onclick = () => engine.play(wf.range ? wf.range.start : wf.playhead, { once: true });
  $('cStop').onclick = () => engine.stop();
  $('cLoop').onclick = () => {
    if (!needSel()) return;
    engine.setLoop({ start: wf.range.start, end: wf.range.end });
    engine.play(wf.range.start);
  };
  $('cZin').onclick = () => wf.zoom(1.6);
  $('cZout').onclick = () => wf.zoom(1 / 1.6);
  $('cFit').onclick = () => { wf.fit(); wf.draw(); };
  $('cAll').onclick = () => { wf.range = { start: 0, end: ops.frames(state.pcm) }; wf.draw(); info(); };

  $('cTrim').onclick = () => needSel() && apply((s, e) => ops.trim(state.pcm, s, e));
  $('cCut').onclick = () => needSel() && apply((s, e) => ops.cut(state.pcm, s, e));
  $('cSil').onclick = () => needSel() && apply((s, e) => ops.silence(state.pcm, s, e));
  $('cRev').onclick = () => apply((s, e) => ops.reverse(state.pcm, s, e));
  $('cFin').onclick = () => apply((s, e) => ops.fade(state.pcm, s, e, 'in'));
  $('cFout').onclick = () => apply((s, e) => ops.fade(state.pcm, s, e, 'out'));
  $('cAmp').onclick = () => apply((s, e) => ops.gain(state.pcm, Number($('cDb').value) || 0, s, e));
  $('cNorm').onclick = () => apply(() => ops.normalize(state.pcm));
  $('cDc').onclick = () => apply(() => ops.removeDc(state.pcm));

  const after = ok => {
    if (!ok) return toast('nothing to do', 'bad');
    wf.setPcm(state.pcm, { fit: false });
    engine.setBuffer(toAudioBuffer(state.pcm, engine.ctx));
    info();
  };
  $('cUndo').onclick = () => after(undo());
  $('cRedo').onclick = () => after(redo());

  info();
  engine.setBuffer(toAudioBuffer(state.pcm, engine.ctx));
}

export function cutKey(e, engine) {
  if (!wf || !state.pcm) return false;
  const k = e.key.toLowerCase(), c = e.ctrlKey || e.metaKey;
  const doo = fn => { e.preventDefault(); fn(); return true; };
  if (c && k === 't') return doo(() => document.getElementById('cTrim')?.click());
  if (c && k === 'l') return doo(() => document.getElementById('cSil')?.click());
  if (c && k === 'x') return doo(() => document.getElementById('cCut')?.click());
  if (c && k === 'a') return doo(() => document.getElementById('cAll')?.click());
  if (k === 'delete' || k === 'backspace') return doo(() => document.getElementById('cCut')?.click());
  if (k === 'escape') return doo(() => { wf.range = null; wf.draw(); });
  return false;
}

export function tickCut(engine) {
  if (wf && engine.playing) wf.setPlayhead(engine.position());
}
