/**
 * ARRANGE mode — layer clips and mix down.
 *
 * Scope note: this is the multitrack lane view carried onto the new engine and state
 * model. The fully non-destructive clip model (clips referencing sources, edge-trim
 * and fade handles, round-trip into CUT) is deliberately still ahead — this keeps the
 * capability working in the four-mode shell without pretending to be finished.
 *
 * Mixdown renders through OfflineAudioContext, then hands the result to MUSIC, which
 * is where loop authoring lives. That hand-off is the point of splitting the modes:
 * arranging produces material, MUSIC decides how it repeats.
 */
import { state, set } from '../state.js';
import { toPcm } from '../audio/engine.js';
import { toast, esc } from '../ui/chrome.js';

const lanes = [];   // {name, buf, start(frames), gain, mute}

export function renderArrange(host, engine, goMusic) {
  host.innerHTML = `
    <h2>ARRANGE <span class="sub">layer clips · mix down</span></h2>
    <div class="bar2">
      <label class="src">＋ Import<input id="aImp" type="file" accept="audio/*" multiple hidden></label>
      <button id="aAdd">＋ add current buffer</button>
      <button id="aClear">clear all</button>
      <span class="sep"></span>
      <button id="aPlay" class="go">▶ Play mix</button>
      <button id="aStop">■</button>
      <span class="sep"></span>
      <button id="aMix" class="go">⬇ Mix down → MUSIC</button>
    </div>
    <div class="info">Mixdown hands the result to MUSIC mode, where loop points are authored.</div>
    <div id="aLanes"></div>
  `;
  const $ = id => document.getElementById(id);

  const paint = () => {
    $('aLanes').innerHTML = lanes.length ? lanes.map((l, i) => `
      <div class="wrap" style="padding:7px;margin:6px 0;display:flex;gap:9px;align-items:center">
        <b class="q" style="min-width:130px">${esc(l.name)}</b>
        <span class="dim mono">${(l.buf.duration).toFixed(2)}s</span>
        <label class="dim">at</label>
        <input type="number" data-start="${i}" value="${(l.start / l.buf.sampleRate).toFixed(2)}" step="0.1" style="width:70px">
        <label class="dim">gain</label>
        <input type="range" data-gain="${i}" min="0" max="1.5" step="0.01" value="${l.gain}">
        <button data-mute="${i}" class="${l.mute ? 'on' : ''}">M</button>
        <button data-del="${i}">✕</button>
      </div>`).join('') : '<div class="info">no clips — import audio, or add the buffer you are editing</div>';

    $('aLanes').querySelectorAll('[data-start]').forEach(el => el.onchange = () => {
      const l = lanes[+el.dataset.start];
      l.start = Math.max(0, Number(el.value) || 0) * l.buf.sampleRate;
    });
    $('aLanes').querySelectorAll('[data-gain]').forEach(el => el.oninput = () => {
      lanes[+el.dataset.gain].gain = Number(el.value);
    });
    $('aLanes').querySelectorAll('[data-mute]').forEach(el => el.onclick = () => {
      const l = lanes[+el.dataset.mute]; l.mute = !l.mute; paint();
    });
    $('aLanes').querySelectorAll('[data-del]').forEach(el => el.onclick = () => {
      lanes.splice(+el.dataset.del, 1); paint();
    });
  };

  $('aImp').onchange = async e => {
    for (const f of e.target.files) {
      try {
        const buf = await engine.ctx.decodeAudioData(await f.arrayBuffer());
        lanes.push({ name: f.name.slice(0, 22), buf, start: 0, gain: 1, mute: false });
      } catch { toast(`could not decode ${f.name}`, 'bad'); }
    }
    paint();
  };
  $('aAdd').onclick = () => {
    if (!engine.buffer) return toast('nothing loaded', 'bad');
    lanes.push({
      name: (state.sourcePath || 'clip').split('/').pop().slice(0, 22),
      buf: engine.buffer, start: 0, gain: 1, mute: false,
    });
    paint();
  };
  $('aClear').onclick = () => { lanes.length = 0; paint(); };

  const span = () => Math.max(1, ...lanes.map(l => l.start + l.buf.length));

  async function render() {
    if (!lanes.length) { toast('nothing to mix', 'bad'); return null; }
    const sr = lanes[0].buf.sampleRate;
    const oac = new OfflineAudioContext(2, Math.ceil(span() + sr * 0.05), sr);
    for (const l of lanes) {
      if (l.mute) continue;
      const s = oac.createBufferSource(); s.buffer = l.buf;
      const g = oac.createGain(); g.gain.value = l.gain;
      s.connect(g).connect(oac.destination);
      s.start(l.start / sr);
    }
    return oac.startRendering();
  }

  $('aPlay').onclick = async () => {
    const b = await render(); if (!b) return;
    engine.setBuffer(b); engine.setLoop(null); engine.play(0);
  };
  $('aStop').onclick = () => engine.stop();

  $('aMix').onclick = async () => {
    const b = await render(); if (!b) return;
    set({ pcm: toPcm(b), sourcePath: 'arrange/mixdown.wav', loop: null, intro: null }, 'mix');
    toast('mixed down — switching to MUSIC to author the loop');
    goMusic();
  };

  paint();
}
