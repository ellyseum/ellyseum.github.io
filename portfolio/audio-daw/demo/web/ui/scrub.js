/**
 * Scrubbing controls for values a spinner cannot practically edit.
 *
 * Loop points live in the millions of frames. A number input's up/down arrows move by
 * 1, so reaching a useful position takes thousands of clicks, and typing means knowing
 * the answer in advance — which is the thing you are trying to find. These give
 * continuous control at several magnitudes without leaving the mouse.
 */

/**
 * Make a number input drag-scrubbable (Blender/After-Effects style): press and drag
 * horizontally to change the value, modifiers to change the rate, wheel to nudge.
 *
 * @param {HTMLInputElement} input
 * @param {{step?:number, min?:number, max?:number, onInput?:Function, onDone?:Function}} o
 */
export function scrubNumber(input, o = {}) {
  const step = o.step ?? 1;
  const clamp = v => Math.round(Math.max(o.min ?? -Infinity, Math.min(o.max ?? Infinity, v)));
  // one drag should cross a musically useful distance without losing single-frame
  // reach: shift = fine, ctrl = coarse
  const rate = e => step * (e.shiftKey ? 1 : e.ctrlKey || e.metaKey ? 1000 : 50);

  let dragging = false, lastX = 0, acc = 0;

  input.style.cursor = 'ew-resize';
  input.title = 'drag to scrub · shift = fine (1) · ctrl = coarse (1000) · wheel · arrows';

  input.addEventListener('mousedown', e => {
    dragging = true; lastX = e.clientX; acc = Number(input.value) || 0;
    e.preventDefault();                 // don't put a caret in the field mid-drag
    document.body.style.userSelect = 'none';
  });
  window.addEventListener('mousemove', e => {
    if (!dragging) return;
    acc += (e.clientX - lastX) * rate(e);
    lastX = e.clientX;
    input.value = String(clamp(acc));
    o.onInput?.(clamp(acc));
  });
  window.addEventListener('mouseup', () => {
    if (!dragging) return;
    dragging = false;
    document.body.style.userSelect = '';
    o.onDone?.(clamp(Number(input.value) || 0));
  });

  input.addEventListener('wheel', e => {
    e.preventDefault();
    const v = clamp((Number(input.value) || 0) + (e.deltaY < 0 ? 1 : -1) * rate(e));
    input.value = String(v);
    o.onInput?.(v); o.onDone?.(v);
  }, { passive: false });

  input.addEventListener('keydown', e => {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
    e.preventDefault();
    const v = clamp((Number(input.value) || 0) + (e.key === 'ArrowUp' ? 1 : -1) * rate(e));
    input.value = String(v);
    o.onInput?.(v); o.onDone?.(v);
  });

  input.addEventListener('change', () => o.onDone?.(clamp(Number(input.value) || 0)));
}

/**
 * Make a seam window draggable. The window already shows only ~800 frames across
 * ~380px, so one pixel is ~2 frames — this is the fine-adjust surface, and it is the
 * one place you can watch the waveform on both sides of the boundary while moving it.
 *
 * @param {HTMLCanvasElement} cv
 * @param {() => number} getHalfWidth  frames shown either side of centre
 * @param {(deltaFrames:number, live:boolean) => void} onDelta
 */
export function scrubCanvas(cv, getHalfWidth, onDelta) {
  let dragging = false, lastX = 0;
  cv.style.cursor = 'ew-resize';
  cv.title = 'drag to move this loop point (fine)';

  cv.addEventListener('mousedown', e => {
    dragging = true; lastX = e.clientX; e.preventDefault();
    document.body.style.userSelect = 'none';
  });
  window.addEventListener('mousemove', e => {
    if (!dragging) return;
    const framesPerPx = (getHalfWidth() * 2) / cv.width;
    const dx = e.clientX - lastX;
    lastX = e.clientX;
    // drag right = move the point later, matching the waveform's direction
    onDelta(Math.round(dx * framesPerPx), true);
  });
  window.addEventListener('mouseup', () => {
    if (!dragging) return;
    dragging = false;
    document.body.style.userSelect = '';
    onDelta(0, false);                  // settled
  });
}
