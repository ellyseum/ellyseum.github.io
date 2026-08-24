/**
 * One place that answers "does this file carry loop points?", whatever the container.
 *
 * There are two conventions and they are NOT interchangeable:
 *   WAV  a `smpl` chunk  — Godot's wav loader reads this natively
 *   OGG  Vorbis comments — Godot IGNORES these, so music.gd parses them itself
 *
 * Both store SAMPLE FRAMES at the FILE's own rate, which is the detail that bites:
 * decodeAudioData resamples to the AudioContext's rate, so the frame numbering of the
 * decoded buffer no longer matches the file's. Everything here returns points already
 * rescaled to the buffer, so callers cannot forget.
 */
import { readLoop, scaleLoop } from './wav-codec.js';
import { readOggLoop } from './ogg-codec.js';

/**
 * @param {ArrayBuffer} raw     the file's bytes, before decoding
 * @param {AudioBuffer} audio   the decoded buffer (for its rate)
 * @param {string} name         filename or path, used only to pick a reader
 * @returns {{loop:?{start:number,end:number}, intro:?number, via:?string}}
 */
export function readLoopMeta(raw, audio, name = '') {
  const none = { loop: null, intro: null, via: null };
  if (!raw || !audio) return none;

  const wav = /\.wav$/i.test(name);
  const ogg = /\.ogg$/i.test(name);

  let found = null, via = null;
  try {
    if (wav) { found = readLoop(raw); via = 'smpl'; }
    else if (ogg) { found = readOggLoop(raw); via = 'LOOPSTART'; }
    else {
      // Unknown or missing extension (a dropped file, say). Try both rather than
      // giving up: sniffing costs nothing and a mislabelled file still works.
      found = readLoop(raw); via = 'smpl';
      if (!found) { found = readOggLoop(raw); via = 'LOOPSTART'; }
    }
  } catch {
    return none;   // a malformed header means no loop, not a crash
  }

  if (!found || !(found.end > found.start)) return none;

  // If the container did not tell us its rate, assume it matches the context — for a
  // same-rate file that is exact, and it is the only sane fallback.
  const fileRate = found.sampleRate || audio.sampleRate;
  const s = scaleLoop(found, fileRate, audio.sampleRate);

  return {
    loop: { start: s.start, end: s.end },
    // a loop that does not start at 0 means everything before it is an intro
    intro: s.start > 0 ? s.start : null,
    via,
  };
}
