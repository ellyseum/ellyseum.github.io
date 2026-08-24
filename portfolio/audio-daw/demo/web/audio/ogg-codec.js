/**
 * Read LOOPSTART / LOOPLENGTH / LOOPEND out of an OGG's Vorbis comments.
 *
 * WHY THIS EXISTS
 * The DAW exports OGG with these tags, and music.gd parses them at runtime (Godot's
 * own ogg loader ignores them entirely). But loading such a file back into the DAW
 * showed NO loop, because the load path only understood the WAV `smpl` chunk — so a
 * track you had already authored reopened looking un-authored, exactly the round-trip
 * failure the smpl reader was added to prevent.
 *
 * The convention (LOOPSTART in SAMPLE FRAMES, plus either LOOPLENGTH or LOOPEND) is
 * the de-facto one from RPG Maker and Japanese game audio. It is a plain ASCII
 * key=value inside the comment header.
 *
 * Deliberately a byte scan of the file's head rather than a full Ogg page parser: the
 * comment header sits in the second packet, a wrong answer costs only the loop offset,
 * and a container parser is a lot of code to carry for that.
 *
 * MUST scan BYTES, not a decoded string — Ogg headers are full of nulls, and every
 * naive `String` conversion truncates at the first one, silently reporting "no loop".
 * (music.gd hit exactly this; the same trap applies here.)
 */

const HEAD = 262144;   // headers live at the very start; no need to walk a 30 MB file

const ascii = s => Array.from(s, c => c.charCodeAt(0));

/** Index of `needle` (byte array) in `buf`, or -1. */
function indexOfBytes(buf, needle, from = 0) {
  const n = needle.length, end = buf.length - n;
  outer: for (let i = from; i <= end; i++) {
    for (let k = 0; k < n; k++) if (buf[i + k] !== needle[k]) continue outer;
    return i;
  }
  return -1;
}

/** Read the ASCII integer that follows `key=`, or null. */
function tagValue(buf, key) {
  const i = indexOfBytes(buf, ascii(key));
  if (i < 0) return null;
  let v = 0, digits = 0;
  for (let k = i + key.length; k < Math.min(i + key.length + 12, buf.length); k++) {
    const b = buf[k];
    if (b < 0x30 || b > 0x39) break;
    v = v * 10 + (b - 0x30);
    digits++;
  }
  return digits ? v : null;
}

/**
 * Sample rate from the Vorbis identification header: byte 0x01 then "vorbis", then
 * version(4) channels(1) rate(4, little-endian).
 */
export function vorbisRate(arrayBuffer) {
  const buf = new Uint8Array(arrayBuffer, 0, Math.min(HEAD, arrayBuffer.byteLength));
  const i = indexOfBytes(buf, [0x01, ...ascii('vorbis')]);
  if (i < 0) return 0;
  const o = i + 7 + 4 + 1;                     // skip version(4) + channels(1)
  if (o + 3 >= buf.length) return 0;
  return buf[o] | (buf[o + 1] << 8) | (buf[o + 2] << 16) | (buf[o + 3] << 24);
}

/**
 * @returns {?{start:number,end:number,sampleRate:number}} frames at the FILE's rate,
 * or null when the file carries no usable loop tags.
 */
export function readOggLoop(arrayBuffer) {
  const buf = new Uint8Array(arrayBuffer, 0, Math.min(HEAD, arrayBuffer.byteLength));

  const start = tagValue(buf, 'LOOPSTART=');
  if (start === null) return null;

  // LOOPEND is explicit; LOOPLENGTH is the older form. Accept either.
  const end = tagValue(buf, 'LOOPEND=');
  const len = tagValue(buf, 'LOOPLENGTH=');
  const resolved = end !== null ? end : (len !== null ? start + len : null);
  if (resolved === null || resolved <= start) return null;

  return { start, end: resolved, sampleRate: vorbisRate(arrayBuffer) };
}
