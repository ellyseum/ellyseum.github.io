/**
 * The single project model. Replaces the pile of global mutable vars that daw.js and
 * arrange.js shared implicitly (arrange.js reached into daw.js's `work`, `cue`, `AC`
 * via load order and a comment).
 *
 * The Ableton rule this enables: a mode switch is a change of LENS, not of state.
 * Modes read from here and never own the data, so switching never disturbs playback
 * or loses an edit.
 */

const listeners = new Set();

export const state = {
  mode: 'music',
  cues: [],            // schema v2 records
  tracks: [],          // BGM from GET /tracks
  sel: null,           // {kind:'cue'|'track', id|path}
  pcm: null,           // the working PCM struct (pure; see audio/buffer-ops.js)
  audio: null,         // the matching AudioBuffer for playback
  sourcePath: null,
  loop: null,          // {start,end} SAMPLE FRAMES
  intro: null,         // frames before the loop body; null = no intro
  range: null,         // editing selection {start,end}
  undo: [],
  redo: [],
  dirty: false,
};

export function on(fn) { listeners.add(fn); return () => listeners.delete(fn); }
export function emit(reason = '') { for (const fn of listeners) fn(state, reason); }

export function set(patch, reason = '') {
  Object.assign(state, patch);
  emit(reason);
}

/** Push the current buffer onto the undo stack before a destructive edit. */
export function pushUndo() {
  if (!state.pcm) return;
  state.undo.push(state.pcm);
  if (state.undo.length > 40) state.undo.shift();
  state.redo.length = 0;
}

export function commit(pcm, reason = 'edit') {
  state.pcm = pcm;
  state.dirty = true;
  state.range = null;
  emit(reason);
}

export function undo() {
  if (!state.undo.length) return false;
  state.redo.push(state.pcm);
  state.pcm = state.undo.pop();
  state.range = null;
  emit('undo');
  return true;
}

export function redo() {
  if (!state.redo.length) return false;
  state.undo.push(state.pcm);
  state.pcm = state.redo.pop();
  state.range = null;
  emit('redo');
  return true;
}

export const selectedCue = () =>
  state.sel?.kind === 'cue' ? state.cues.find(c => c.id === state.sel.id) : null;
export const selectedTrack = () =>
  state.sel?.kind === 'track' ? state.tracks.find(t => t.path === state.sel.path) : null;
