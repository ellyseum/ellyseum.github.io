/**
 * MUSIC mode — author intro-then-loop BGM.
 *
 * The structure this exists to produce:
 *
 *   |<---- intro (plays once) ---->|<------ loop body (forever) ------>|
 *   0                          loopStart                           loopEnd
 *                                  ^                                   |
 *                                  +-----------------------------------+
 *
 * FWLB could not author this at all before: the old encoder wrote a bare 44-byte
 * WAV header, so every track was a whole-file loop and an intro would replay on
 * every repeat.
 *
 * The success criterion is one number — the discontinuity at the seam — so the whole
 * screen is built around seeing and hearing it: a dual-zoom window showing both sides
 * of the boundary, a numeric verdict, zero-crossing snap, and seam audition.
 */
import { state, set, pushUndo, commit, undo as undoEdit } from '../state.js';
import * as ops from '../audio/buffer-ops.js';
import { encodeWav } from '../audio/wav-codec.js';
import { Waveform, drawSeamWindow } from '../ui/waveform.js';
import { scrubNumber, scrubCanvas } from '../ui/scrub.js';
import { toAudioBuffer } from '../audio/engine.js';
import { toast, setStatus, showSaved, esc } from '../ui/chrome.js';

let wf = null, seamA = null, seamB = null;

/**
 * Filename for an export. Strips any existing "(loop)"/"(mix)" tag before re-tagging,
 * or re-exporting an export yields "track (loop) (loop) (loop).wav".
 * Exported so a test can exercise the real rule rather than a copy of it.
 */
export function exportName(sourcePath, hasLoop) {
  const base = (sourcePath || 'bgm').split('/').pop()
    .replace(/\.[^.]+$/, '')
    .replace(/\s*\((loop|mix)\)\s*$/i, '')
    .trim();
  return `${base}${hasLoop ? ' (loop)' : ''}.wav`;
}

const fmtT = (f, sr) => {
  const s = f / sr;
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}.${String(Math.floor(s * 1000) % 1000).padStart(3, '0')}`;
};

export function renderMusic(host, engine) {
  const has = !!state.pcm;
  host.innerHTML = `
    <h2>MUSIC <span class="sub">${esc(state.sourcePath ? state.sourcePath.split('/').pop() : 'intro-then-loop authoring')}</span></h2>
    ${has ? '' : '<div class="info">Pick a track from the bank (▸ music) or a cue to author its loop.</div>'}
    <div id="wfhost"></div>

    <div class="bar2">
      <button id="mPlay" class="go">▶ Play</button>
      <button id="mStop">■</button>
      <span class="sep"></span>
      <!-- one button per BOUNDARY: the three joins are the only places an
           intro/loop/outro track can go wrong, and each needs its own audition -->
      <button id="mFromStart" title="Home — play from frame 0 so you hear the intro run into the body">⏮ Intro</button>
      <button id="mSeam" title="Jump to just before loop end and play across the wrap">↻ Seam</button>
      <button id="mOutro" title="Play from just before loop end with the loop RELEASED — what the game does on Music.release_loop()">⏭ Outro</button>
      <span class="sep"></span>
      <label class="dim">pre-roll</label>
      <input id="mPre" type="number" value="2" step="0.5" style="width:48px"><span class="dim">s</span>
      <span class="sep"></span>
      <button id="mZin">＋</button><button id="mZout">－</button><button id="mFit">⤢ Fit</button>
    </div>

    <div class="bar2">
      <b class="q">Loop</b>
      <button id="mFromSel">= selection</button>
      <button id="mWhole">= whole file</button>
      <button id="mClear">clear</button>
      <span class="sep"></span>
      <button id="mSnap" title="Move both loop points to the nearest zero crossing">⤓ snap to zero-crossings</button>
      <span class="sep"></span>
      <b class="q">Intro</b>
      <button id="mIntroHere">set = loop start</button>
      <button id="mIntroClear">none</button>
    </div>

    <div class="readout bar2">
      <label>loop start</label><input id="mStart" type="number" step="1" class="mono">
      <label>loop end</label><input id="mEnd" type="number" step="1" class="mono">
      <label>length</label><span id="mLen" class="mono dim"></span>
    </div>
    <div class="info">Drag the number to scrub · shift = 1 frame · ctrl = 1000 · wheel and arrows work too.
      You can also drag the yellow markers on the waveform, or drag inside the seam views below for fine control.</div>

    <div id="mVerdict"></div>

    <div class="bar2">
      <b class="q">Seam</b>
      <label class="dim">zoom</label>
      <select id="mSeamZoom">
        <option value="100">±100 frames (~2ms)</option>
        <option value="400" selected>±400 frames (~8ms)</option>
        <option value="2000">±2000 frames (~40ms)</option>
        <option value="10000">±10000 frames (~200ms)</option>
      </select>
      <button id="mHunt" title="Search nearby for the loop point with the smallest discontinuity">⌕ find quietest seam</button>
    </div>

    <div class="seamgrid">
      <figure><figcaption>before loop end (tail) — drag to move loop END</figcaption>
        <canvas id="seamA" width="380" height="90" class="wrap"></canvas></figure>
      <figure><figcaption>at loop start (head) — drag to move loop START</figcaption>
        <canvas id="seamB" width="380" height="90" class="wrap"></canvas></figure>
    </div>

    <div class="bar2">
      <b class="q">Smooth seam</b>
      <select id="mSmoothMode">
        <option value="xfade">crossfade tail with the lead-in</option>
        <option value="wrap">wrap the real decay over the start</option>
        <option value="fade">fade the tail out</option>
      </select>
      <input id="mSmoothMs" type="number" value="800" step="100" style="width:64px"><span class="dim">ms</span>
      <button id="mSmooth" class="go">apply</button>
      <button id="mSmoothUndo">↶ undo</button>
      <span class="info">keeps your loop points and the file length — fixes an instrument
        that stops dead on the wrap</span>
    </div>
    <div id="mSmoothReport" class="info mono"></div>

    <div class="bar2">
      <button id="mXfade">Bake whole-file loop</button>
      <input id="mXms" type="number" value="80" step="10" style="width:60px"><span class="dim">ms</span>
      <span class="info">different tool: folds tail over head and SHORTENS the file to one
        whole-file loop. Discards intro and outro — only when points cannot meet at all.</span>
    </div>

    <div class="bar2">
      <b class="q">Export</b>
      <button id="mWav" class="go">⬇ WAV + smpl</button>
      <button id="mOgg" class="go">⬇ OGG + LOOPSTART</button>
      <select id="mDir">
        <option value="music">→ music/ (live in game)</option>
        <option value="music-final">→ music-final/ (workspace)</option>
      </select>
    </div>
    <div class="info">WAV carries loop points in the smpl chunk, which Godot reads natively.
      OGG is ~17× smaller but Godot ignores its tags, so music.gd parses them itself.</div>
  `;

  if (!has) return;

  wf = new Waveform(document.getElementById('wfhost'), {
    height: 160,
    onSeek: f => engine.play(f),
    // dragging a marker updates continuously; the full refresh (seam redraw + verdict)
    // only runs on release, so a drag stays smooth on a 150 MB buffer
    onLoop: (l, live) => {
      state.loop = { start: Math.round(l.start), end: Math.round(l.end) };
      if (live) quickReadout(); else refresh();
    },
  });
  wf.setPcm(state.pcm);
  wf.setLoop(state.loop);
  wf.setIntro(state.intro);
  window.__wf = wf;          // e2e needs marker pixel positions to drive real drags
  seamA = document.getElementById('seamA');
  seamB = document.getElementById('seamB');

  const sr = state.pcm.sampleRate;
  const $ = id => document.getElementById(id);

  const seamHalf = () => Number($('mSeamZoom')?.value || 400);

  // cheap half of refresh(): numbers + seam views only, no verdict recompute.
  // seamDelta walks every channel, so running it per mousemove would stutter.
  function quickReadout() {
    if (!state.loop) return;
    $('mStart').value = Math.round(state.loop.start);
    $('mEnd').value = Math.round(state.loop.end);
    $('mLen').textContent =
      `${Math.round(state.loop.end - state.loop.start)} frames · ${fmtT(state.loop.end - state.loop.start, sr)}`;
    drawSeamWindow(seamA, state.pcm, state.loop.end, seamHalf());
    drawSeamWindow(seamB, state.pcm, state.loop.start, seamHalf());
    const d = ops.seamDelta(state.pcm, state.loop.start, state.loop.end);
    const el = $('mLiveDelta');
    if (el) { el.textContent = `Δ ${d.toFixed(4)}`; el.style.color = d < 0.02 ? '#9e6' : d < 0.08 ? '#eb6' : '#f99'; }
  }

  const refresh = () => {
    wf.setLoop(state.loop); wf.setIntro(state.intro);
    $('mStart').value = state.loop ? Math.round(state.loop.start) : '';
    $('mEnd').value = state.loop ? Math.round(state.loop.end) : '';
    $('mLen').textContent = state.loop
      ? `${Math.round(state.loop.end - state.loop.start)} frames · ${fmtT(state.loop.end - state.loop.start, sr)}`
      : '—';
    engine.setLoop(state.loop);

    if (state.loop) {
      drawSeamWindow(seamA, state.pcm, state.loop.end, seamHalf());
      drawSeamWindow(seamB, state.pcm, state.loop.start, seamHalf());
      // the verdict: quantify the click BEFORE it reaches the engine
      const d = ops.seamDelta(state.pcm, state.loop.start, state.loop.end);
      const dc = Math.max(...ops.dcOffset(state.pcm).map(Math.abs));
      const cls = d < 0.02 ? 'ok' : d < 0.08 ? 'warn' : 'bad';
      const msg = d < 0.02 ? 'seam is clean — no audible click expected'
        : d < 0.08 ? 'small step at the seam — try snapping to zero crossings'
        : 'large step at the seam — snap to zero crossings, or bake a crossfade';
      $('mVerdict').innerHTML =
        `<div class="verdict ${cls}">seam <span id="mLiveDelta" class="mono">Δ ${d.toFixed(4)}</span> — ${msg}`
        + (dc > 0.01 ? `<br>DC offset ${dc.toFixed(3)} detected — that alone guarantees a click; remove it first.` : '')
        + `</div>`;
    } else {
      $('mVerdict').innerHTML = '';
      drawSeamWindow(seamA, null, 0); drawSeamWindow(seamB, null, 0);
    }
  };

  const preRoll = () => Math.max(0, Number($('mPre')?.value) || 2);

  $('mPlay').onclick = () => engine.play(wf.playhead);
  $('mStop').onclick = () => engine.stop();

  // Play from the very beginning. Verified: an AudioBufferSourceNode with loop=true
  // started at offset 0 DOES play the region before loopStart, then wraps at loopEnd
  // — so this is genuinely "intro, then the loop takes over", not a seek into the body.
  const fromStart = () => {
    wf.setPlayhead(0);
    engine.setLoop(state.loop);
    engine.play(0);
    toast(state.intro
      ? `playing the intro (0–${(state.intro / sr).toFixed(2)}s), then the loop takes over`
      : 'playing from the start');
  };
  $('mFromStart').onclick = fromStart;

  $('mSeam').onclick = () => {
    if (!state.loop) return toast('set a loop first', 'bad');
    engine.setLoop(state.loop);
    engine.auditionSeam(preRoll());
  };

  // The outro is unreachable while looping — a smpl chunk holds two points, so the
  // engine cycles the body forever. This previews what Music.release_loop() does at
  // runtime: drop the loop and let playback run past loop_end to the end of the file.
  $('mOutro').onclick = () => {
    if (!state.loop) return toast('set a loop first', 'bad');
    const n = ops.frames(state.pcm);
    const tail = n - state.loop.end;
    if (tail < sr * 0.2) return toast('there is no outro after the loop end', 'bad');
    const from = Math.max(0, state.loop.end - preRoll() * sr);
    wf.setPlayhead(from);
    engine.play(from, { once: true });      // once = ignore the loop for this playback
    toast(`playing into the outro (${(tail / sr).toFixed(2)}s after loop end)`);
  };
  $('mZin').onclick = () => wf.zoom(1.6);
  $('mZout').onclick = () => wf.zoom(1 / 1.6);
  $('mFit').onclick = () => { wf.fit(); wf.draw(); };

  $('mFromSel').onclick = () => {
    if (!wf.range) return toast('drag a selection on the waveform first', 'bad');
    set({ loop: { start: Math.round(wf.range.start), end: Math.round(wf.range.end) } }, 'loop');
    refresh();
  };
  $('mWhole').onclick = () => { set({ loop: { start: 0, end: ops.frames(state.pcm) } }, 'loop'); refresh(); };
  $('mClear').onclick = () => { set({ loop: null }, 'loop'); refresh(); };

  $('mSnap').onclick = () => {
    if (!state.loop) return toast('set a loop first', 'bad');
    set({ loop: {
      start: ops.nearestZeroCrossing(state.pcm, state.loop.start),
      end: ops.nearestZeroCrossing(state.pcm, state.loop.end),
    } }, 'loop');
    refresh();
    toast('snapped to zero crossings');
  };

  $('mIntroHere').onclick = () => {
    if (!state.loop) return toast('set a loop first — the intro is everything before it', 'bad');
    set({ intro: state.loop.start }, 'intro');
    refresh();
    toast(`intro = 0..${Math.round(state.loop.start)} frames (plays once)`);
  };
  $('mIntroClear').onclick = () => { set({ intro: null }, 'intro'); refresh(); };

  // --- scrubbing: the number fields, the seam windows, and the waveform markers
  // are three grips on the same two values, coarse to fine.
  const setPoint = (key, v, live) => {
    if (!state.loop) return;
    const n = ops.frames(state.pcm);
    let val = Math.max(0, Math.min(n, Math.round(v)));
    if (key === 'start') val = Math.min(val, state.loop.end - 1);
    else val = Math.max(val, state.loop.start + 1);
    state.loop = { ...state.loop, [key]: val };
    wf.setLoop(state.loop);
    live ? quickReadout() : refresh();
  };

  for (const [id, key] of [['mStart', 'start'], ['mEnd', 'end']]) {
    scrubNumber($(id), {
      step: 1, min: 0, max: ops.frames(state.pcm),
      onInput: v => setPoint(key, v, true),
      onDone: v => setPoint(key, v, false),
    });
  }

  // dragging inside a seam view is the fine grip: it already shows only ~800 frames
  // across ~380px, so roughly 2 frames per pixel
  scrubCanvas(seamA, seamHalf, (d, live) =>
    d === 0 && !live ? refresh() : setPoint('end', state.loop.end + d, true));
  scrubCanvas(seamB, seamHalf, (d, live) =>
    d === 0 && !live ? refresh() : setPoint('start', state.loop.start + d, true));

  $('mSeamZoom').onchange = refresh;

  // Hunt for the nearby point pair with the smallest discontinuity. Zero-crossing
  // snapping only guarantees both ends are near zero; it says nothing about matching
  // SLOPE, which is why a snapped loop can still click. This scores actual seam delta.
  $('mHunt').onclick = () => {
    if (!state.loop) return toast('set a loop first', 'bad');
    const span = seamHalf();
    let best = null;
    for (let de = -span; de <= span; de += Math.max(1, Math.floor(span / 60))) {
      for (let ds = -span; ds <= span; ds += Math.max(1, Math.floor(span / 60))) {
        const s = state.loop.start + ds, e = state.loop.end + de;
        if (s < 0 || e <= s + 1 || e > ops.frames(state.pcm)) continue;
        const d = ops.seamDelta(state.pcm, s, e);
        if (!best || d < best.d) best = { s, e, d };
      }
    }
    if (!best) return toast('no better seam nearby', 'bad');
    const before = ops.seamDelta(state.pcm, state.loop.start, state.loop.end);
    set({ loop: { start: best.s, end: best.e } }, 'loop');
    refresh();
    toast(`seam Δ ${before.toFixed(4)} → ${best.d.toFixed(4)}`);
  };

  // Smooth the seam in place. Reports BOTH metrics before and after, because they
  // disagree and the disagreement is the whole point: a fade-out can improve the
  // sample step while wrecking the energy match, which is what you actually hear.
  $('mSmooth').onclick = () => {
    if (!state.loop) return toast('set a loop first', 'bad');
    const mode = $('mSmoothMode').value;
    const L = Math.floor((Number($('mSmoothMs').value) || 800) / 1000 * sr);
    const win = Math.floor(sr * 0.05);

    const beforeStep = ops.seamDelta(state.pcm, state.loop.start, state.loop.end);
    const beforeE = ops.seamEnergy(state.pcm, state.loop, win);

    let next;
    if (mode === 'xfade') next = ops.crossfadeSeam(state.pcm, state.loop, L);
    else if (mode === 'wrap') next = ops.wrapTail(state.pcm, state.loop, L);
    else next = ops.fade(state.pcm, Math.max(state.loop.start, state.loop.end - L),
      state.loop.end, 'out');

    pushUndo();
    commit(next, 'smooth');

    const afterStep = ops.seamDelta(state.pcm, state.loop.start, state.loop.end);
    const afterE = ops.seamEnergy(state.pcm, state.loop, win);
    const warn = Math.abs(afterE.db) > Math.abs(beforeE.db) + 1;

    $('mSmoothReport').innerHTML =
      `step ${beforeStep.toFixed(4)} → ${afterStep.toFixed(4)} · `
      + `energy across seam ${beforeE.db >= 0 ? '+' : ''}${beforeE.db.toFixed(1)}dB → `
      + `<b style="color:${warn ? '#f99' : '#9e6'}">${afterE.db >= 0 ? '+' : ''}${afterE.db.toFixed(1)}dB</b>`
      + (warn ? ' — that is WORSE; a fade to silence pulses every repeat, try crossfade'
              : ' — closer to continuous is better');

    wf.setPcm(state.pcm, { fit: false });
    engine.setBuffer(toAudioBuffer(state.pcm, engine.ctx));
    refresh();
    toast(`${mode} applied over ${(L / sr).toFixed(2)}s — audition the seam`);
  };

  $('mSmoothUndo').onclick = () => {
    if (!undoEdit()) return toast('nothing to undo', 'bad');
    wf.setPcm(state.pcm, { fit: false });
    engine.setBuffer(toAudioBuffer(state.pcm, engine.ctx));
    $('mSmoothReport').textContent = '';
    refresh();
    toast('reverted');
  };

  $('mXfade').onclick = () => {
    const ms = Number($('mXms').value) || 80;
    const len = Math.floor(ms / 1000 * sr);
    const body = state.loop ? ops.trim(state.pcm, state.loop.start, state.loop.end) : state.pcm;
    const baked = ops.seamlessLoop(body, len);
    set({ pcm: baked, loop: { start: 0, end: ops.frames(baked) }, intro: null }, 'bake');
    wf.setPcm(baked); refresh();
    toast(`crossfaded ${ms}ms — the file now loops whole`);
  };

  const doExport = async fmt => {
    const dir = $('mDir').value;
    const name = exportName(state.sourcePath, !!state.loop);
    setStatus(`rendering ${fmt}…`);
    try {
      // WAV always carries smpl; the server transcodes to OGG when asked and writes
      // the same points as Vorbis comments.
      const wav = encodeWav(state.pcm, state.loop ? { loop: state.loop } : {});
      let bin = ''; const u = new Uint8Array(wav), CK = 0x8000;
      for (let i = 0; i < u.length; i += CK) bin += String.fromCharCode.apply(null, u.subarray(i, i + CK));
      const body = { name, b64: btoa(bin), fmt, dir };
      if (state.loop) body.loop = { start: Math.round(state.loop.start), end: Math.round(state.loop.end) };

      const r = await fetch('/save', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error(await r.text());
      const j = await r.json();
      showSaved(j.path);
      toast(`saved ${j.path}${j.loop ? ` (loop via ${j.loop})` : ''}`);
      setStatus('ready');
    } catch (e) {
      toast('export failed: ' + e.message, 'bad');
      setStatus('export failed');
    }
  };
  $('mWav').onclick = () => doExport('wav');
  $('mOgg').onclick = () => doExport('ogg');

  refresh();
  engine.setBuffer(toAudioBuffer(state.pcm, engine.ctx));
}

export function tickMusic(engine) {
  if (wf && engine.playing) wf.setPlayhead(engine.position());
}
