/**
 * Waveform canvas — peak rendering, selection, loop/intro markers, playhead.
 *
 * WHY THIS IS HAND-ROLLED RATHER THAN wavesurfer.js
 * The plan reached for wavesurfer + Regions, but v7 fights this app on two fronts:
 *   1. It insists on owning playback through an HTML MediaElement, which cannot loop
 *      gaplessly — the exact defect BGM authoring exists to avoid. We would have to
 *      keep its audio permanently muted and unused, i.e. carry a second decoded copy
 *      of every track purely to draw it.
 *   2. Regions gives draggable rectangles in SECONDS. Loop authoring here needs
 *      SAMPLE-frame precision, zero-crossing snapping, and a dual-zoom seam view —
 *      none of which Regions provides, so the interesting half would be custom anyway.
 *
 * Peak drawing is ~40 lines. Taking the dependency would buy less than it costs and
 * would put a second, muted audio pipeline in a tool whose whole point is that the
 * audio pipeline is correct. wavesurfer stays vendored in lib/ but unused.
 */

const BG = '#0c0c12', MID = '#2a3050', WAVE = '#5b6cff';

export class Waveform {
  /**
   * @param {HTMLElement} host
   * @param {{height?:number, onRange?:Function, onSeek?:Function}} opts
   */
  constructor(host, opts = {}) {
    this.host = host;
    this.h = opts.height || 150;
    this.opts = opts;
    this.pcm = null;
    this.pps = 200;              // pixels per second
    this.range = null;           // {start,end} frames — the edit selection
    this.loop = null;            // {start,end} frames
    this.intro = null;           // frames
    this.playhead = 0;
    this.peaks = null;           // cached min/max per pixel column

    this.wrap = document.createElement('div');
    this.wrap.className = 'wrap';
    this.cv = document.createElement('canvas');
    this.cv.height = this.h;
    this.wrap.appendChild(this.cv);
    host.appendChild(this.wrap);

    this._drag = null;
    this.cv.addEventListener('mousedown', e => this._down(e));
    this.cv.addEventListener('mousemove', e => this._move(e));
    window.addEventListener('mouseup', () => this._up());
    this.cv.addEventListener('wheel', e => this._wheel(e), { passive: false });
  }

  get frames() { return this.pcm ? this.pcm.channels[0].length : 0; }
  xToFrame(x) { return Math.max(0, Math.min(this.frames, (x / this.pps) * this.pcm.sampleRate)); }
  frameToX(f) { return (f / this.pcm.sampleRate) * this.pps; }

  setPcm(pcm, { fit = true } = {}) {
    this.pcm = pcm;
    this.range = null;
    if (fit) this.fit(); else this._bake();
    this.draw();
  }

  fit() {
    if (!this.pcm) return;
    const w = Math.max(200, this.host.clientWidth - 8);
    this.pps = Math.max(4, w / (this.frames / this.pcm.sampleRate));
    this._bake();
  }

  zoom(mult) {
    if (!this.pcm) return;
    const dur = this.frames / this.pcm.sampleRate;
    const min = Math.max(1, (this.host.clientWidth - 8) / dur / 8);
    this.pps = Math.max(min, Math.min(400000 / dur, this.pps * mult));
    this._bake(); this.draw();
  }

  /** Pre-compute one min/max pair per pixel column; redrawing then costs nothing. */
  _bake() {
    if (!this.pcm) return;
    const W = Math.max(1, Math.min(32000, Math.ceil(this.frames / this.pcm.sampleRate * this.pps)));
    this.cv.width = W; this.cv.style.width = W + 'px';

    const sr = this.pcm.sampleRate, data = this.pcm.channels;
    const mins = new Float32Array(W), maxs = new Float32Array(W);
    for (let x = 0; x < W; x++) {
      const s = Math.floor((x / this.pps) * sr);
      const e = Math.min(this.frames, Math.floor(((x + 1) / this.pps) * sr));
      let mn = 1, mx = -1;
      for (let i = s; i < e; i++) {
        for (let c = 0; c < data.length; c++) {
          const v = data[c][i];
          if (v < mn) mn = v;
          if (v > mx) mx = v;
        }
      }
      if (e <= s) { const v = data[0][Math.min(s, this.frames - 1)] || 0; mn = mx = v; }
      mins[x] = mn; maxs[x] = mx;
    }
    this.peaks = { mins, maxs, W };
  }

  draw() {
    if (!this.pcm || !this.peaks) return;
    const g = this.cv.getContext('2d');
    const { W, mins, maxs } = this.peaks, H = this.h;

    g.fillStyle = BG; g.fillRect(0, 0, W, H);

    // intro region — everything before the loop body, played once
    if (this.intro != null && this.intro > 0) {
      g.fillStyle = 'rgba(120,220,160,.16)';
      g.fillRect(0, 0, this.frameToX(this.intro), H);
    }
    // loop region
    if (this.loop) {
      const x0 = this.frameToX(this.loop.start), x1 = this.frameToX(this.loop.end);
      g.fillStyle = 'rgba(253,212,68,.16)';
      g.fillRect(x0, 0, x1 - x0, H);
      g.strokeStyle = '#fd4'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(x0 + 1, 0); g.lineTo(x0 + 1, H);
      g.moveTo(x1 - 1, 0); g.lineTo(x1 - 1, H); g.stroke();
      g.lineWidth = 1;
    }

    g.strokeStyle = MID; g.beginPath(); g.moveTo(0, H / 2); g.lineTo(W, H / 2); g.stroke();
    g.strokeStyle = WAVE; g.beginPath();
    for (let x = 0; x < W; x++) {
      g.moveTo(x + 0.5, (1 - maxs[x]) * H / 2);
      g.lineTo(x + 0.5, (1 - mins[x]) * H / 2);
    }
    g.stroke();

    if (this.range) {
      const x0 = this.frameToX(this.range.start), x1 = this.frameToX(this.range.end);
      g.fillStyle = 'rgba(90,170,255,.22)'; g.fillRect(x0, 0, x1 - x0, H);
      g.strokeStyle = '#9ac'; g.strokeRect(x0 + .5, .5, x1 - x0, H - 1);
    }

    g.strokeStyle = '#fd4'; g.beginPath();
    const px = this.frameToX(this.playhead);
    g.moveTo(px + .5, 0); g.lineTo(px + .5, H); g.stroke();
  }

  setPlayhead(f) { this.playhead = f; this.draw(); }
  setLoop(l) { this.loop = l; this.draw(); }
  setIntro(i) { this.intro = i; this.draw(); }

  /** Which loop handle is within grab distance of x, if any. */
  _handleAt(x) {
    if (!this.loop) return null;
    const GRAB = 7;
    const ds = Math.abs(x - this.frameToX(this.loop.start));
    const de = Math.abs(x - this.frameToX(this.loop.end));
    if (ds <= GRAB && ds <= de) return 'start';
    if (de <= GRAB) return 'end';
    return null;
  }

  _down(e) {
    if (!this.pcm) return;
    // grabbing a loop marker beats starting a selection — dragging the boundary IS
    // the primary gesture in this view, and a spinner is no way to move 6.5M frames
    const h = this._handleAt(e.offsetX);
    if (h) { this._loopDrag = h; return; }
    this._drag = this.xToFrame(e.offsetX);
    this.range = { start: this._drag, end: this._drag };
    this.draw();
  }
  _move(e) {
    if (this._loopDrag) {
      const f = Math.round(this.xToFrame(e.offsetX));
      const l = { ...this.loop };
      if (this._loopDrag === 'start') l.start = Math.min(f, l.end - 1);
      else l.end = Math.max(f, l.start + 1);
      this.loop = l;
      this.draw();
      this.opts.onLoop?.(l, /* live */ true);
      return;
    }
    if (this._drag == null) {
      // hint that the boundary is grabbable, otherwise nobody discovers it
      this.cv.style.cursor = this._handleAt(e.offsetX) ? 'ew-resize' : 'text';
      return;
    }
    const f = this.xToFrame(e.offsetX);
    this.range = { start: Math.min(this._drag, f), end: Math.max(this._drag, f) };
    this.draw();
    this.opts.onRange?.(this.range);
  }
  _up() {
    if (this._loopDrag) {
      this._loopDrag = null;
      this.opts.onLoop?.(this.loop, false);   // settled: now worth re-running analysis
      return;
    }
    if (this._drag == null) return;
    const collapsed = this.range && (this.range.end - this.range.start) < this.pcm.sampleRate * 0.005;
    if (collapsed) {                       // a click, not a drag -> seek
      const at = this.range.start;
      this.range = null;
      this.setPlayhead(at);
      this.opts.onSeek?.(at);
    }
    this._drag = null;
    this.draw();
    this.opts.onRange?.(this.range);
  }
  _wheel(e) {
    e.preventDefault();
    const before = this.xToFrame(e.offsetX + this.wrap.scrollLeft);
    this.zoom(e.deltaY < 0 ? 1.2 : 1 / 1.2);
    this.wrap.scrollLeft = this.frameToX(before) - e.offsetX;
  }
}

/**
 * Draw a tight window around a single frame — used to show both sides of a loop seam
 * side by side, so a discontinuity is VISIBLE rather than only audible. This is the
 * affordance that makes sample-accurate loop authoring practical.
 */
export function drawSeamWindow(canvas, pcm, centreFrame, halfWidth = 400) {
  const g = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  g.fillStyle = BG; g.fillRect(0, 0, W, H);
  if (!pcm) return;

  const d = pcm.channels[0];
  const s = Math.max(0, Math.floor(centreFrame - halfWidth));
  const e = Math.min(d.length, Math.floor(centreFrame + halfWidth));

  g.strokeStyle = MID; g.beginPath(); g.moveTo(0, H / 2); g.lineTo(W, H / 2); g.stroke();

  g.strokeStyle = WAVE; g.beginPath();
  for (let x = 0; x < W; x++) {
    const i = s + Math.floor((x / W) * (e - s));
    const y = (1 - (d[i] || 0)) * H / 2;
    x === 0 ? g.moveTo(x, y) : g.lineTo(x, y);
  }
  g.stroke();

  // the boundary itself
  g.strokeStyle = '#fd4'; g.setLineDash([3, 3]);
  g.beginPath(); g.moveTo(W / 2, 0); g.lineTo(W / 2, H); g.stroke();
  g.setLineDash([]);
}
