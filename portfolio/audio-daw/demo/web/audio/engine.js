/**
 * Playback engine — the ONLY thing in this app that makes sound.
 *
 * THE CONSTRAINT THIS FILE EXISTS TO ENFORCE:
 * wavesurfer v7 dropped the Web Audio backend and plays through an HTML
 * MediaElement, which CANNOT loop gaplessly — its "loop" is a seek back to the
 * start on the `region-out` event, leaving an audible seam every repeat. That is
 * fatal for BGM, which is the entire point of this tool.
 *
 * So the split is deliberate and must not be blurred:
 *     wavesurfer  ->  DRAWING and DRAGGING loop regions (visual editor only)
 *     this file   ->  ALL audible playback, via AudioBufferSourceNode
 *
 * AudioBufferSourceNode.loop/loopStart/loopEnd loops inside the audio thread with
 * sample accuracy and no gap. If you ever hear a click at the loop point, the first
 * question is whether something started playing through wavesurfer.
 */

export class Engine {
  constructor(ctx) {
    this.ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
    this.gain = this.ctx.createGain();
    this.gain.connect(this.ctx.destination);
    this.src = null;
    this.buffer = null;
    this._startedAt = 0;
    this._offset = 0;
    this.loop = null;          // {start,end} in SAMPLE FRAMES
    this.onended = null;
  }

  get sampleRate() { return this.ctx.sampleRate; }
  get playing() { return !!this.src; }

  setBuffer(audioBuffer) {
    this.stop();
    this.buffer = audioBuffer;
    this._offset = 0;
  }

  /** Loop points in SAMPLE FRAMES (null clears). Applies live mid-playback. */
  setLoop(loop) {
    this.loop = loop ? { start: loop.start, end: loop.end } : null;
    if (this.src) this._applyLoop(this.src);
  }

  _applyLoop(src) {
    if (this.loop && this.loop.end > this.loop.start) {
      const sr = this.buffer.sampleRate;
      src.loop = true;
      src.loopStart = this.loop.start / sr;
      src.loopEnd = this.loop.end / sr;
    } else {
      src.loop = false;
    }
  }

  /**
   * @param {number} [fromSample] start offset in frames
   * @param {{once?:boolean}} [opts] once = ignore the loop for this playback
   */
  play(fromSample, opts = {}) {
    if (!this.buffer) return;
    this.stop();
    if (this.ctx.state === 'suspended') this.ctx.resume();

    const sr = this.buffer.sampleRate;
    const src = this.ctx.createBufferSource();
    src.buffer = this.buffer;
    if (!opts.once) this._applyLoop(src);
    src.connect(this.gain);

    const off = Math.max(0, (fromSample ?? this._offset) / sr);
    src.onended = () => {
      if (this.src === src) { this.src = null; this._offset = 0; }
      if (this.onended) this.onended();
    };
    src.start(0, off);

    this.src = src;
    this._startedAt = this.ctx.currentTime;
    this._offset = off * sr;
  }

  /**
   * Jump to shortly BEFORE the loop end and play across the seam, so the transition
   * can be auditioned repeatedly without sitting through the whole track. This is
   * the single most useful affordance when authoring a loop — the seam is the only
   * part that matters and it is otherwise the least accessible.
   */
  auditionSeam(preRollSeconds = 2) {
    if (!this.buffer || !this.loop) return;
    const sr = this.buffer.sampleRate;
    const from = Math.max(this.loop.start, this.loop.end - preRollSeconds * sr);
    this.play(from);
  }

  stop() {
    if (this.src) {
      try { this.src.onended = null; this.src.stop(); } catch { /* already stopped */ }
      this.src.disconnect();
      this.src = null;
    }
  }

  /** Current playhead in SAMPLE FRAMES, loop-aware. */
  position() {
    if (!this.buffer) return 0;
    if (!this.src) return this._offset;
    const sr = this.buffer.sampleRate;
    const elapsed = (this.ctx.currentTime - this._startedAt) * sr;
    let pos = this._offset + elapsed;
    if (this.loop && this.src.loop) {
      const len = this.loop.end - this.loop.start;
      if (len > 0 && pos > this.loop.end) {
        pos = this.loop.start + ((pos - this.loop.start) % len);
      }
    }
    return Math.min(pos, this.buffer.length);
  }

  setVolume(v) { this.gain.gain.value = Math.max(0, Math.min(1, v)); }
}

/* ---------- AudioBuffer <-> the pure PCM struct buffer-ops uses ---------- */

export function toPcm(audioBuffer) {
  return {
    sampleRate: audioBuffer.sampleRate,
    channels: Array.from({ length: audioBuffer.numberOfChannels },
      (_, c) => audioBuffer.getChannelData(c).slice()),
  };
}

export function toAudioBuffer(pcm, ctx) {
  const b = ctx.createBuffer(pcm.channels.length, pcm.channels[0].length, pcm.sampleRate);
  pcm.channels.forEach((d, c) => b.copyToChannel(d, c));
  return b;
}

/**
 * Decode a URL into both an AudioBuffer (for playback) and a PCM struct (for edits).
 *
 * Also returns the RAW bytes, because decodeAudioData throws away every RIFF chunk
 * except the samples — including `smpl`. Without the raw copy a wav that already
 * carries loop points would open with none, and authoring could not round-trip:
 * you would export a loop, reload the file, and find your points gone.
 */
export async function loadPcm(url, ctx) {
  const ab = await fetch(url).then(r => {
    if (!r.ok) throw new Error(`${r.status} ${url}`);
    return r.arrayBuffer();
  });
  const audio = await ctx.decodeAudioData(ab.slice(0));
  return { audio, pcm: toPcm(audio), raw: ab };
}
