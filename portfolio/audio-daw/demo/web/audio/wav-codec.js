/**
 * WAV encode/decode including the `smpl` (sampler) chunk — the loop-point carrier.
 *
 * WHY smpl MATTERS HERE (verified against Godot 4.6.3, not assumed):
 *   - Godot's AudioStreamWAV.load_from_file() DOES parse `smpl`; a probe returned
 *     loop_mode=FORWARD, loop_begin/loop_end exactly as written.
 *   - game/music.gd already PRESERVES those points: it only forces a whole-file loop
 *     when loop_mode == LOOP_DISABLED, so a wav carrying smpl keeps its own points.
 *   - The old encoder wrote a bare 44-byte header and could not emit smpl at all,
 *     which is the single reason FWLB could not author intro-then-loop BGM.
 *   - By contrast Godot IGNORES OGG LOOPSTART tags (probe: loop=false, offset=0.0),
 *     so for wav the points ride in the file; for ogg music.gd must parse them.
 *
 * Everything here is PURE and free of Web Audio, so it unit-tests under node.
 * Audio is exchanged as a plain PCM struct:
 *
 *     { sampleRate: number, channels: Float32Array[] }   // samples in [-1, 1]
 *
 * Loop points are in SAMPLE FRAMES (never seconds) — that is the whole point of
 * smpl over a float `loop_offset`: no millisecond rounding, no drift.
 */

const SMPL_BODY_FIXED = 36;   // manufacturer..samplerData
const SMPL_PER_LOOP = 24;     // cuePointId, type, start, end, fraction, playCount

export const LOOP_FORWARD = 0;
export const LOOP_PINGPONG = 1;
export const LOOP_BACKWARD = 2;

const clamp = v => (v < -1 ? -1 : v > 1 ? 1 : v);

// Float <-> int16 conversion. Two details that matter for round-trip fidelity:
//   * ROUND, don't truncate — DataView.setInt16 truncates a float, which doubles the
//     quantisation error for free.
//   * Use the SAME scale both ways. Encoding at 32767 but decoding at 32768 adds a
//     systematic ~1 LSB skew on top of the quantisation error.
// Together these keep a round trip inside half an LSB. (Giving up the -32768 extreme
// costs nothing audible and buys symmetry.)
const SCALE = 0x7fff;
const toInt16 = s => Math.round(clamp(s) * SCALE);
const fromInt16 = i => clamp(i / SCALE);

/**
 * Encode a PCM struct to a 16-bit WAV ArrayBuffer.
 * @param {{sampleRate:number, channels:Float32Array[]}} pcm
 * @param {{loop?:{start:number,end:number,type?:number}}} [opts]
 *        loop.start/end are SAMPLE FRAMES; omit for no smpl chunk.
 */
export function encodeWav(pcm, opts = {}) {
  const { sampleRate, channels } = pcm;
  const ch = channels.length;
  const frames = channels[0].length;
  const loop = opts.loop || null;

  const dataBytes = frames * ch * 2;
  const smplBytes = loop ? 8 + SMPL_BODY_FIXED + SMPL_PER_LOOP : 0;
  const buf = new ArrayBuffer(44 + dataBytes + smplBytes);
  const v = new DataView(buf);

  const str = (off, s) => { for (let i = 0; i < s.length; i++) v.setUint8(off + i, s.charCodeAt(i)); };

  // RIFF size = everything after the first 8 bytes
  str(0, 'RIFF'); v.setUint32(4, 36 + dataBytes + smplBytes, true); str(8, 'WAVE');
  str(12, 'fmt '); v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);                    // PCM
  v.setUint16(22, ch, true);
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * ch * 2, true);  // byte rate
  v.setUint16(32, ch * 2, true);               // block align
  v.setUint16(34, 16, true);                   // bits
  str(36, 'data'); v.setUint32(40, dataBytes, true);

  let o = 44;
  for (let i = 0; i < frames; i++) {
    for (let c = 0; c < ch; c++) {
      v.setInt16(o, toInt16(channels[c][i]), true);
      o += 2;
    }
  }

  if (loop) {
    str(o, 'smpl'); v.setUint32(o + 4, SMPL_BODY_FIXED + SMPL_PER_LOOP, true);
    const b = o + 8;
    v.setUint32(b, 0, true);                                   // manufacturer
    v.setUint32(b + 4, 0, true);                               // product
    v.setUint32(b + 8, Math.round(1e9 / sampleRate), true);    // sample period (ns)
    v.setUint32(b + 12, 60, true);                             // MIDI unity note
    v.setUint32(b + 16, 0, true);                              // pitch fraction
    v.setUint32(b + 20, 0, true);                              // SMPTE format
    v.setUint32(b + 24, 0, true);                              // SMPTE offset
    v.setUint32(b + 28, 1, true);                              // loop count
    v.setUint32(b + 32, 0, true);                              // sampler data size
    const l = b + SMPL_BODY_FIXED;
    v.setUint32(l, 0, true);                                   // cue point id
    v.setUint32(l + 4, loop.type ?? LOOP_FORWARD, true);
    v.setUint32(l + 8, Math.round(loop.start), true);
    v.setUint32(l + 12, Math.round(loop.end), true);
    v.setUint32(l + 16, 0, true);                              // fraction
    v.setUint32(l + 20, 0, true);                              // play count (0 = ∞)
  }

  return buf;
}

/**
 * Decode a WAV ArrayBuffer. Walks the RIFF chunk list rather than assuming a
 * 44-byte header, so files carrying LIST/fact/smpl in any order parse correctly.
 * @returns {{sampleRate:number, channels:Float32Array[], loop:?{start:number,end:number,type:number}}}
 */
export function decodeWav(arrayBuffer) {
  const v = new DataView(arrayBuffer);
  const tag = o => String.fromCharCode(v.getUint8(o), v.getUint8(o + 1), v.getUint8(o + 2), v.getUint8(o + 3));

  if (tag(0) !== 'RIFF' || tag(8) !== 'WAVE') throw new Error('not a RIFF/WAVE file');

  let fmt = null, dataOff = -1, dataLen = 0, loop = null;
  let p = 12;
  while (p + 8 <= arrayBuffer.byteLength) {
    const id = tag(p);
    const size = v.getUint32(p + 4, true);
    const body = p + 8;

    if (id === 'fmt ') {
      fmt = {
        format: v.getUint16(body, true),
        channels: v.getUint16(body + 2, true),
        sampleRate: v.getUint32(body + 4, true),
        bits: v.getUint16(body + 14, true),
      };
    } else if (id === 'data') {
      dataOff = body; dataLen = size;
    } else if (id === 'smpl') {
      const count = v.getUint32(body + 28, true);
      if (count > 0) {
        const l = body + SMPL_BODY_FIXED;
        loop = {
          type: v.getUint32(l + 4, true),
          start: v.getUint32(l + 8, true),
          end: v.getUint32(l + 12, true),
        };
      }
    }
    p = body + size + (size & 1);   // chunks are word-aligned; odd sizes get a pad byte
  }

  if (!fmt) throw new Error('no fmt chunk');
  if (dataOff < 0) throw new Error('no data chunk');
  if (fmt.format !== 1 || fmt.bits !== 16) {
    throw new Error(`unsupported: format=${fmt.format} bits=${fmt.bits} (want PCM 16)`);
  }

  const ch = fmt.channels;
  const frames = Math.floor(dataLen / (ch * 2));
  const channels = Array.from({ length: ch }, () => new Float32Array(frames));
  let o = dataOff;
  for (let i = 0; i < frames; i++) {
    for (let c = 0; c < ch; c++) {
      channels[c][i] = fromInt16(v.getInt16(o, true));
      o += 2;
    }
  }

  return { sampleRate: fmt.sampleRate, channels, loop };
}

/**
 * Read only the loop points, without decoding megabytes of PCM.
 *
 * Also returns the FILE's own sampleRate, which the caller almost always needs:
 * `decodeAudioData` RESAMPLES to the AudioContext's rate, so a 44.1 kHz file decoded
 * by a 48 kHz context yields a buffer whose frame numbering no longer matches the
 * smpl chunk. Dividing file frames by the context rate silently misplaces the loop
 * (0.75s reads as 0.689s at that ratio). Use `scaleLoop` to convert.
 *
 * @returns {?{type:number,start:number,end:number,sampleRate:number}}
 */
export function readLoop(arrayBuffer) {
  const v = new DataView(arrayBuffer);
  const tag = o => String.fromCharCode(v.getUint8(o), v.getUint8(o + 1), v.getUint8(o + 2), v.getUint8(o + 3));
  if (tag(0) !== 'RIFF' || tag(8) !== 'WAVE') return null;

  let rate = 0, loop = null, p = 12;
  while (p + 8 <= arrayBuffer.byteLength) {
    const id = tag(p), size = v.getUint32(p + 4, true), body = p + 8;
    if (id === 'fmt ') {
      rate = v.getUint32(body + 4, true);
    } else if (id === 'smpl' && v.getUint32(body + 28, true) > 0) {
      const l = body + SMPL_BODY_FIXED;
      loop = {
        type: v.getUint32(l + 4, true),
        start: v.getUint32(l + 8, true),
        end: v.getUint32(l + 12, true),
      };
    }
    p = body + size + (size & 1);
  }
  return loop ? { ...loop, sampleRate: rate } : null;
}

/**
 * Convert loop points from the file's frame numbering to a decoded buffer's.
 * A no-op when the rates match, which is the common case — but silently wrong
 * results when they don't are exactly why this is explicit rather than assumed.
 */
export function scaleLoop(loop, fromRate, toRate) {
  if (!loop || !fromRate || !toRate || fromRate === toRate) return loop;
  const k = toRate / fromRate;
  return { ...loop, start: Math.round(loop.start * k), end: Math.round(loop.end * k) };
}
