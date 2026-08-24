/**
 * App entry: mode routing, shared transport, keyboard map.
 *
 * The Ableton principle this implements: switching mode changes the LENS, never the
 * state. Audio keeps playing across a switch, the loaded buffer stays loaded, and the
 * bank selection persists — so the four workspaces are four views of one project
 * rather than four tools that each own a copy.
 */
import { state, set, on, undo, redo } from './state.js';
import { Engine, loadPcm, toAudioBuffer } from './audio/engine.js';
import { readLoopMeta } from './audio/loop-meta.js';
import { renderBank, wireBank } from './ui/bank.js';
import { wireImport, loadFile } from './ui/import.js';
import { toast, setStatus, esc } from './ui/chrome.js';
import { renderMusic, tickMusic } from './views/music.js';
import { renderCut, cutKey, tickCut } from './views/cut.js';
import { renderSfx } from './views/sfx.js';
import { renderArrange } from './views/arrange.js';

const engine = new Engine();
const centre = document.getElementById('centre');
window.__engine = engine;          // e2e reads real audio state through this
window.__state = state;

const MODES = ['sfx', 'cut', 'music', 'arrange'];

function paint() {
  document.querySelectorAll('#modes button').forEach(b =>
    b.classList.toggle('on', b.dataset.mode === state.mode));

  if (state.mode === 'music') renderMusic(centre, engine);
  else if (state.mode === 'cut') renderCut(centre, engine);
  else if (state.mode === 'sfx') renderSfx(centre, engine, load);
  else renderArrange(centre, engine, () => go('music'));
}

function go(mode) {
  if (!MODES.includes(mode) || mode === state.mode) return;
  // deliberately does NOT stop playback — the lens changes, the audio does not
  set({ mode }, 'mode');
  paint();
}

/** Load a source into the shared working buffer, restoring any authored loop points. */
async function load(path) {
  setStatus(`loading ${path}…`);
  try {
    const { audio, pcm, raw } = await loadPcm(path, engine.ctx);

    // The file may already carry loop points — a wav's smpl chunk, or an ogg's
    // LOOPSTART Vorbis comments. decodeAudioData discards both, so read them off the
    // raw bytes; otherwise reopening your own export shows no loop and silently
    // invites you to author it again from scratch.
    const { loop, intro, via } = readLoopMeta(raw, audio, path);

    set({ pcm, audio, sourcePath: path, loop, intro, undo: [], redo: [] }, 'load');
    engine.setBuffer(audio);
    engine.setLoop(loop);

    const sr = audio.sampleRate;
    setStatus(`${path} · ${audio.duration.toFixed(2)}s · ${sr}Hz`
      + (loop ? ` · LOOP ${(loop.start / sr).toFixed(2)}–${(loop.end / sr).toFixed(2)}s`
              + (intro ? ` · intro ${(intro / sr).toFixed(2)}s` : '') : ''));
    if (loop) toast(`loaded existing loop points via ${via} (${loop.start}–${loop.end} frames)`);
    paint();
  } catch (e) {
    setStatus('load failed');
    toast(`could not load ${path}: ${e.message}`, 'bad');
  }
}
window.__load = load;

/** Re-read the track listing so a newly imported file shows up in the bank. */
async function refreshTracks() {
  const j = await fetch('/tracks').then(r => r.json()).catch(() => ({ tracks: [] }));
  set({ tracks: j.tracks || [] }, 'tracks');
  renderBank();
}
window.__refreshTracks = refreshTracks;

/* ---------------- boot ---------------- */
(async function boot() {
  wireBank();
  wireImport(engine, paint, load, refreshTracks);

  const [cueJson, trackJson] = await Promise.all([
    fetch('sfx_data.json').then(r => r.json()).catch(() => ({ cues: [] })),
    fetch('/tracks').then(r => r.json()).catch(() => ({ tracks: [] })),
  ]);
  set({
    cues: Array.isArray(cueJson) ? cueJson : (cueJson.cues || []),
    tracks: trackJson.tracks || [],
  }, 'boot');

  renderBank();
  paint();
  setStatus(`${state.cues.length} cues · ${state.tracks.length} tracks`);
})();

/* selection in the bank loads the audio for whichever mode is showing */
on((s, reason) => {
  if (reason !== 'select') return;
  renderBank();
  const cue = s.sel?.kind === 'cue' ? s.cues.find(c => c.id === s.sel.id) : null;
  const track = s.sel?.kind === 'track' ? s.tracks.find(t => t.path === s.sel.path) : null;
  const path = cue?.og || track?.path;
  if (!path) return;
  // a Loop-type cue or a BGM track is loop work; jump to MUSIC so the right tools
  // are in front of you rather than making you find the mode yourself
  if ((track || cue?.type === 'Loop') && state.mode === 'sfx') set({ mode: 'music' }, 'mode');
  load(path);
});

/* ---------------- transport + keys ---------------- */
document.getElementById('play').onclick = () => engine.play();
document.getElementById('stop').onclick = () => engine.stop();
document.getElementById('vol').oninput = e => engine.setVolume(Number(e.target.value));

document.querySelectorAll('#modes button').forEach(b =>
  b.onclick = () => go(b.dataset.mode));

window.addEventListener('keydown', e => {
  if (/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
  const k = e.key.toLowerCase(), c = e.ctrlKey || e.metaKey;

  // number keys jump straight to a mode; Tab toggles the pair you flip between most
  if (!c && '1234'.includes(e.key)) { e.preventDefault(); return go(MODES[+e.key - 1]); }
  if (e.key === 'Tab') {
    e.preventDefault();
    return go(e.shiftKey
      ? (state.mode === 'sfx' ? 'arrange' : 'sfx')
      : (state.mode === 'cut' ? 'music' : 'cut'));
  }
  if (k === ' ') { e.preventDefault(); return engine.playing ? engine.stop() : engine.play(); }
  // Home rewinds to the very beginning. Without it a looping track has no route back
  // to its intro: Play resumes from wherever the playhead stopped, and after
  // auditioning the seam that is deep inside the body.
  if (e.key === 'Home') {
    e.preventDefault();
    const was = engine.playing;
    engine.stop();
    if (was) engine.play(0); else engine._offset = 0;
    return;
  }
  if (c && k === 'z') { e.preventDefault(); return void (e.shiftKey ? redo() : undo(), paint()); }
  if (c && k === 'y') { e.preventDefault(); return void (redo(), paint()); }

  if (state.mode === 'cut' && cutKey(e, engine)) return;
});

/* one animation loop drives whichever view is showing */
(function tick() {
  const clock = document.getElementById('clock');
  if (clock && state.pcm) {
    const f = engine.position(), sr = state.pcm.sampleRate;
    const s = f / sr;
    clock.textContent =
      `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}.${String(Math.floor(s * 1000) % 1000).padStart(3, '0')}`;
  }
  if (state.mode === 'music') tickMusic(engine);
  else if (state.mode === 'cut') tickCut(engine);
  requestAnimationFrame(tick);
})();
