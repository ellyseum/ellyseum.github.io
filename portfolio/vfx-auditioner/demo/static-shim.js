/**
 * Static-hosting shim for the FWLB VFX audition gallery.
 *
 * The gallery reads vfx_audition.json, which ships whole: all 117 candidates with their
 * blurbs, wave, backdrop, verdict, note and the full per-pass history. That record is
 * the point of this page - it is four review passes of judgments with their reasoning
 * kept, not a reel of finished effects.
 *
 * Writing goes to tools/serve_vfx_audition.py. Those routes are intercepted here and
 * refused with the reason, and the SSE live-reload channel is stubbed so it does not
 * retry a connection that cannot exist. All paths are relative, so the build serves
 * from any subdirectory.
 */
(function () {
  const NATIVE = window.fetch.bind(window);
  const WHY = {
    '/verdict': 'Verdicts are read-only in this static build. The live gallery writes a keep / tweak / kill and its note back into vfx_audition.json, which advances the pass and wakes the orchestrator agent to act on the note. The verdicts recorded here are the real output of four such passes.',
    '/request': 'Requesting a new candidate is read-only in this static build. The live gallery queues the request, a worker authors the effect as a data recipe, renders it headless, and the gallery live-reloads when the clip lands.',
  };

  const BUNDLED = new Set(window.__BUNDLED || []);
  const key = u => String(u).split('?')[0].replace(/^.*?(out\/)/, '$1');

  window.fetch = function (input, init) {
    const url = typeof input === 'string' ? input : (input && input.url) || '';
    const route = url.split('?')[0].replace(/\/+$/, '');
    if (route.charAt(0) === '/' && WHY[route]) {
      explain(WHY[route]);
      return Promise.resolve(new Response(WHY[route], { status: 501 }));
    }
    if (route === '/events') return Promise.resolve(new Response('', { status: 501 }));
    if (/\.states\.jsonl$/.test(route) && !BUNDLED.has(key(route))) {
      return Promise.resolve(new Response('', { status: 200 }));
    }
    return NATIVE(input, init);
  };

  window.EventSource = function StaticEventSource(url) {
    this.url = url; this.readyState = 0;
    this.close = function () { this.readyState = 2; };
    this.addEventListener = function () {};
    this.removeEventListener = function () {};
  };

  /* Never request a clip that was not bundled: the page's own onerror produces the
     placeholder that gets relabelled below, without a 404 per candidate. */
  const proto = HTMLMediaElement.prototype;
  const desc = Object.getOwnPropertyDescriptor(proto, 'src');
  Object.defineProperty(proto, 'src', {
    configurable: true, enumerable: desc.enumerable,
    get() { return desc.get.call(this); },
    set(v) {
      if (/\.mp4/.test(v) && !BUNDLED.has(key(v))) {
        const el = this;
        setTimeout(() => el.onerror && el.onerror(new Event('error')), 0);
        return;
      }
      desc.set.call(this, v);
    },
  });

  function relabel() {
    for (const el of document.querySelectorAll('.missing')) {
      if (el.dataset.staticMarked) continue;
      const path = (el.textContent.split('—')[1] || '').trim();
      el.dataset.staticMarked = '1';
      el.textContent = '';
      const h = document.createElement('div');
      h.style.cssText = 'font-weight:600;margin-bottom:4px';
      h.textContent = 'clip not bundled';
      const p = document.createElement('div');
      p.style.cssText = 'opacity:.75;line-height:1.4';
      p.textContent = 'This build ships 24 of the 120 rendered clips, chosen to span the range of '
        + 'judgments rather than the best-looking results; the full set is 763 MB. The verdict, '
        + 'note and pass history on this candidate are the recorded ones.';
      const c = document.createElement('code');
      c.style.cssText = 'display:block;margin-top:6px;opacity:.55;font-size:10px;word-break:break-all';
      c.textContent = path;
      el.append(h, p, c);
    }
  }

  const WRITE_LABEL = /^(KEEP|TWEAK|KILL|PIN|\+ ?FEEDBACK|SUBMIT.*)$/i;
  function markWrites() {
    for (const b of document.querySelectorAll('button')) {
      if (b.dataset.staticMarked) continue;
      if (!WRITE_LABEL.test((b.textContent || '').trim())) continue;
      b.dataset.staticMarked = '1';
      b.style.borderStyle = 'dashed';
      b.style.opacity = '0.62';
      b.title = 'Read-only in this static build. The live gallery writes this back through the '
        + 'authoring server; click to see what it would have done.';
    }
  }
  setInterval(() => { relabel(); markWrites(); }, 500);

  function explain(text) {
    let box = document.getElementById('staticexplain');
    if (!box) {
      box = document.createElement('div');
      box.id = 'staticexplain';
      box.style.cssText = 'position:fixed;right:16px;bottom:16px;max-width:430px;z-index:9999;'
        + 'background:#1b2230;border:1px solid #4a5a78;border-left:3px solid #ffd479;'
        + 'border-radius:5px;padding:12px 14px;font:12px/1.55 system-ui,sans-serif;'
        + 'color:#c7d3e4;box-shadow:0 8px 28px #0009';
      document.body.appendChild(box);
    }
    box.textContent = '';
    const h = document.createElement('div');
    h.style.cssText = 'color:#ffd479;font-weight:600;margin-bottom:5px';
    h.textContent = 'read-only in this static build';
    const p = document.createElement('div');
    p.textContent = text;
    const x = document.createElement('button');
    x.textContent = 'dismiss';
    x.style.cssText = 'margin-top:9px;background:#28324a;color:#c7d3e4;border:1px solid #4a5a78;'
      + 'border-radius:3px;padding:3px 10px;cursor:pointer;font-size:11px';
    x.onclick = () => box.remove();
    box.append(h, p, x);
  }
})();
