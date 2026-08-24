/**
 * Getting audio in from outside the repo.
 *
 * The page can only fetch what the server serves, so a file sitting in Downloads is
 * invisible to it. Two routes, because they answer different questions:
 *
 *   DROP / PICK  decode it in the browser immediately. Nothing is copied, so it is
 *                instant and leaves no trace — right for "does this even loop?".
 *   PATH         POST to /import, which copies it into the workspace. Slower, but the
 *                file then lives in the bank and is still there tomorrow.
 *
 * Both land in the same place: the shared working buffer, with any smpl loop points
 * restored, so everything downstream behaves identically regardless of origin.
 */
import { state, set } from '../state.js';
import { toPcm } from '../audio/engine.js';
import { readLoopMeta } from '../audio/loop-meta.js';
import { toast, setStatus } from './chrome.js';

/** Decode an in-memory File/Blob straight into the working buffer. */
export async function loadFile(file, engine, paint) {
  setStatus(`decoding ${file.name}…`);
  try {
    const raw = await file.arrayBuffer();
    const audio = await engine.ctx.decodeAudioData(raw.slice(0));
    const { loop, intro, via } = readLoopMeta(raw, audio, file.name);

    set({
      pcm: toPcm(audio), audio, sourcePath: file.name,
      loop, intro, undo: [], redo: [],
    }, 'load');
    engine.setBuffer(audio);
    engine.setLoop(loop);

    const sr = audio.sampleRate;
    setStatus(`${file.name} · ${audio.duration.toFixed(2)}s · ${sr}Hz`
      + (loop ? ` · LOOP ${(loop.start / sr).toFixed(2)}–${(loop.end / sr).toFixed(2)}s` : '')
      + ' · not in the workspace (export to keep it)');
    toast(loop
      ? `loaded ${file.name} with its loop points (via ${via})`
      : `loaded ${file.name} — decoded in the browser, nothing copied`);
    paint();
  } catch (e) {
    setStatus('import failed');
    toast(`could not decode ${file.name}: ${e.message}`, 'bad');
  }
}

/** Copy a file from an arbitrary disk path into the workspace, then load it. */
export async function importPath(path, dir, load, refreshTracks) {
  setStatus(`importing ${path}…`);
  try {
    const r = await fetch('/import', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, dir }),
    });
    if (!r.ok) throw new Error((await r.text()).slice(0, 200));
    const j = await r.json();
    await refreshTracks();
    toast(`imported → ${j.path}`);
    await load(j.path);
    return j.path;
  } catch (e) {
    setStatus('import failed');
    toast(`import failed: ${e.message}`, 'bad');
    return null;
  }
}

export function wireImport(engine, paint, load, refreshTracks) {
  const $ = id => document.getElementById(id);

  $('impFile')?.addEventListener('change', async e => {
    for (const f of e.target.files) await loadFile(f, engine, paint);
    e.target.value = '';          // let the same file be picked again
  });

  const go = async () => {
    const p = $('impPath').value.trim();
    if (!p) return;
    const landed = await importPath(p, $('impDir').value, load, refreshTracks);
    if (landed) $('impPath').value = '';
  };
  $('impPath')?.addEventListener('keydown', e => { if (e.key === 'Enter') go(); });

  // Whole-window drop target. Every dragover must be prevented or the browser
  // navigates away to the file, losing all unsaved work.
  let depth = 0;
  window.addEventListener('dragover', e => { e.preventDefault(); });
  window.addEventListener('dragenter', e => {
    e.preventDefault();
    if (++depth === 1) document.body.classList.add('dropping');
  });
  window.addEventListener('dragleave', () => {
    if (--depth <= 0) { depth = 0; document.body.classList.remove('dropping'); }
  });
  window.addEventListener('drop', async e => {
    e.preventDefault();
    depth = 0; document.body.classList.remove('dropping');
    const files = [...(e.dataTransfer?.files || [])];
    if (!files.length) return;
    for (const f of files) await loadFile(f, engine, paint);
  });
}
