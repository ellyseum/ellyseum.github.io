/**
 * Destructive waveform edits as PURE functions.
 *
 * Every op takes a PCM struct and returns a NEW one; nothing mutates its input, so
 * undo is just keeping the previous value and there is no Web Audio dependency to
 * stub. This is the "CUT" substrate the SFX and MUSIC workspaces both sit on.
 *
 *     PCM = { sampleRate: number, channels: Float32Array[] }
 *
 * Ranges are [start, end) in SAMPLE FRAMES. Deliberately distinct verbs, because
 * the difference matters for loops:
 *   cut()     removes the range and CLOSES the gap  -> length shrinks
 *   silence() zeroes the range and KEEPS the timing -> length preserved
 *   trim()    keeps only the range
 */

const map = (pcm, fn) => ({
  sampleRate: pcm.sampleRate,
  channels: pcm.channels.map((d, c) => fn(d, c)),
});

export const frames = pcm => (pcm.channels[0] ? pcm.channels[0].length : 0);
export const duration = pcm => frames(pcm) / pcm.sampleRate;

/** Clamp a range to the buffer and normalise order. */
export function clampRange(pcm, start, end) {
  const n = frames(pcm);
  let s = Math.max(0, Math.min(n, Math.floor(start ?? 0)));
  let e = Math.max(0, Math.min(n, Math.floor(end ?? n)));
  if (e < s) [s, e] = [e, s];
  return [s, e];
}

export function trim(pcm, start, end) {
  const [s, e] = clampRange(pcm, start, end);
  return map(pcm, d => d.slice(s, e));
}

export function cut(pcm, start, end) {
  const [s, e] = clampRange(pcm, start, end);
  return map(pcm, d => {
    const out = new Float32Array(d.length - (e - s));
    out.set(d.subarray(0, s), 0);
    out.set(d.subarray(e), s);
    return out;
  });
}

export function silence(pcm, start, end) {
  const [s, e] = clampRange(pcm, start, end);
  return map(pcm, d => { const o = d.slice(); o.fill(0, s, e); return o; });
}

export function insert(pcm, at, clip) {
  const n = frames(pcm);
  const pos = Math.max(0, Math.min(n, Math.floor(at)));
  return map(pcm, (d, c) => {
    const ins = clip.channels[Math.min(c, clip.channels.length - 1)];
    const out = new Float32Array(d.length + ins.length);
    out.set(d.subarray(0, pos), 0);
    out.set(ins, pos);
    out.set(d.subarray(pos), pos + ins.length);
    return out;
  });
}

export function reverse(pcm, start, end) {
  const [s, e] = clampRange(pcm, start, end);
  return map(pcm, d => { const o = d.slice(); o.set(o.slice(s, e).reverse(), s); return o; });
}

export function fade(pcm, start, end, dir = 'in') {
  const [s, e] = clampRange(pcm, start, end);
  const len = Math.max(1, e - s);
  return map(pcm, d => {
    const o = d.slice();
    for (let i = s; i < e; i++) {
      const t = (i - s) / len;
      o[i] *= dir === 'in' ? t : 1 - t;
    }
    return o;
  });
}

export function gain(pcm, db, start, end) {
  const [s, e] = clampRange(pcm, start, end);
  const g = Math.pow(10, db / 20);
  return map(pcm, d => {
    const o = d.slice();
    for (let i = s; i < e; i++) o[i] = Math.max(-1, Math.min(1, o[i] * g));
    return o;
  });
}

export function peak(pcm) {
  let pk = 0;
  for (const d of pcm.channels) for (let i = 0; i < d.length; i++) {
    const a = Math.abs(d[i]); if (a > pk) pk = a;
  }
  return pk;
}

export function normalize(pcm, target = 0.97) {
  const pk = peak(pcm);
  if (pk === 0) return map(pcm, d => d.slice());
  const g = target / pk;
  return map(pcm, d => { const o = d.slice(); for (let i = 0; i < o.length; i++) o[i] *= g; return o; });
}

/** Mean sample value per channel — a nonzero result guarantees a click at a loop seam. */
export function dcOffset(pcm) {
  return pcm.channels.map(d => {
    let sum = 0; for (let i = 0; i < d.length; i++) sum += d[i];
    return d.length ? sum / d.length : 0;
  });
}

export function removeDc(pcm) {
  const offs = dcOffset(pcm);
  return map(pcm, (d, c) => {
    const o = d.slice(), k = offs[c];
    for (let i = 0; i < o.length; i++) o[i] -= k;
    return o;
  });
}

/**
 * Crossfade the tail over the head so the file loops cleanly end->start.
 * Constant-power (not linear): a linear fade dips ~3 dB through the middle of the
 * crossfade, which is audible as a dip every loop. Shortens the buffer by `len`.
 */
export function seamlessLoop(pcm, len) {
  const n = frames(pcm);
  const L = Math.min(Math.floor(len), Math.floor(n / 2));
  if (L < 2) return map(pcm, d => d.slice());
  const out = n - L;
  return map(pcm, d => {
    const o = new Float32Array(out);
    o.set(d.subarray(0, out), 0);
    for (let i = 0; i < L; i++) {
      const t = i / L;
      const a = Math.cos((1 - t) * Math.PI / 2);   // head rising
      const b = Math.cos(t * Math.PI / 2);         // tail falling
      o[i] = d[i] * a + d[out + i] * b;
    }
    return o;
  });
}

/**
 * Smooth a loop seam WITHOUT moving the loop points or changing the buffer length.
 *
 * Distinct from seamlessLoop() above, and the distinction matters:
 *   seamlessLoop()   folds the tail over the head and SHORTENS the buffer, turning
 *                    the file into one whole-file loop. Destroys intro/outro structure.
 *   crossfadeSeam()  rewrites only the tail, preserving length, loop points, intro
 *                    and outro. This is the one for an intro/loop/outro track.
 *
 * Replaces [end-L, end) with a constant-power blend of itself and [start-L, start) —
 * the material that ORIGINALLY led into loop start. Approaching the seam you hear the
 * real lead-in, so the jump to loop start is continuous.
 *
 * Fixes an ENVELOPE discontinuity (an instrument stopping mid-note), which is a
 * different failure from a sample-level click: zero-crossing snapping does nothing
 * for it, and a plain fade-out to silence makes it worse by pulsing every repeat.
 */
export function crossfadeSeam(pcm, loop, len) {
  const n = frames(pcm);
  const s = Math.round(loop.start), e = Math.round(loop.end);
  const L = Math.min(Math.floor(len), e - s, s);   // needs L frames before loop start
  if (L < 2) return map(pcm, d => d.slice());
  return map(pcm, d => {
    const o = d.slice();
    for (let i = 0; i < L; i++) {
      const t = i / L;
      const out = Math.cos(t * Math.PI / 2);       // tail falling
      const inn = Math.sin(t * Math.PI / 2);       // lead-in rising
      o[e - L + i] = d[e - L + i] * out + d[s - L + i] * inn;
    }
    return o;
  });
}

/**
 * Mix the instrument's REAL decay from just after loop end into loop start, so it
 * keeps ringing across the wrap instead of vanishing.
 *
 * More musical than a crossfade when the file actually has tail after loop end, since
 * it uses the continuation the composer wrote. The cost is a faint phantom decay on
 * the FIRST pass through loop start, before any wrap has happened.
 */
export function wrapTail(pcm, loop, len) {
  const n = frames(pcm);
  const s = Math.round(loop.start), e = Math.round(loop.end);
  const L = Math.min(Math.floor(len), n - e, e - s);   // needs real audio AFTER loop end
  if (L < 2) return map(pcm, d => d.slice());
  return map(pcm, d => {
    const o = d.slice();
    for (let i = 0; i < L; i++) {
      const g = Math.cos((i / L) * Math.PI / 2);
      o[s + i] = Math.max(-1, Math.min(1, o[s + i] + d[e + i] * g));
    }
    return o;
  });
}

/**
 * Energy either side of the seam, in dB. Complements seamDelta: a step measures a
 * CLICK, this measures a perceived CUT — a note that stops dead can have a tiny
 * sample step and still sound broken.
 */
export function seamEnergy(pcm, loop, windowFrames) {
  const s = Math.round(loop.start), e = Math.round(loop.end);
  const w = Math.max(1, Math.floor(windowFrames));
  const rms = (from, to) => {
    let acc = 0, cnt = 0;
    for (const d of pcm.channels) {
      for (let i = Math.max(0, from); i < Math.min(d.length, to); i++) { acc += d[i] * d[i]; cnt++; }
    }
    return cnt ? Math.sqrt(acc / cnt) : 0;
  };
  const pre = rms(e - w, e), post = rms(s, s + w);
  return { pre, post, db: 20 * Math.log10(Math.max(post, 1e-6) / Math.max(pre, 1e-6)) };
}

/**
 * Nearest zero crossing to `at`, searched outward. Placing loop points on zero
 * crossings is the cheapest defence against a seam click.
 */
export function nearestZeroCrossing(pcm, at, maxDist = 4096, channel = 0) {
  const d = pcm.channels[channel];
  const n = d.length;
  const i0 = Math.max(0, Math.min(n - 1, Math.floor(at)));
  const crosses = i => i > 0 && i < n && ((d[i - 1] <= 0 && d[i] >= 0) || (d[i - 1] >= 0 && d[i] <= 0));
  if (crosses(i0)) return i0;
  for (let k = 1; k <= maxDist; k++) {
    if (crosses(i0 - k)) return i0 - k;
    if (crosses(i0 + k)) return i0 + k;
  }
  return i0;
}

/**
 * How badly a loop will click: the discontinuity between the last sample before
 * loop-end and the sample at loop-start, worst case across channels (0..2).
 * Lets an export be linted before it reaches the engine.
 */
export function seamDelta(pcm, start, end) {
  const [s, e] = clampRange(pcm, start, end);
  let worst = 0;
  for (const d of pcm.channels) {
    const before = d[Math.max(0, e - 1)] ?? 0;
    const after = d[s] ?? 0;
    worst = Math.max(worst, Math.abs(after - before));
  }
  return worst;
}
