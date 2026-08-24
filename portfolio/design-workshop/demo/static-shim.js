/**
 * Static-hosting shim for the FWLB Design Workshop board.
 *
 * The board reads its whole state from files that ship with this build - lanes.json,
 * each lane's manifest.json, workcards.json, milestones.json, vitals.json, asks.json
 * and the two flow graphs - so every recorded verdict, note, pass history, work-card
 * and milestone in here is the real data, unedited.
 *
 * What it writes goes to tools/serve_workshop.py, which is not present on a file
 * server. Those routes are intercepted here and refused with the reason, so the board
 * is a faithful read-only view rather than a page with dead buttons:
 *
 *   POST /verdict, /answer, /request, /milestone, /workcard, /flow/*  -> refused
 *   GET  /events (SSE live-reload)                                    -> stubbed
 *
 * Clips are sampled, not complete: the metadata for all candidates ships, a subset of
 * the rendered mp4s does. A candidate whose clip is not in the bundle is labelled.
 * All paths are relative, so the build serves from any subdirectory.
 */
(function () {
  const NATIVE = window.fetch.bind(window);

  const WHY = {
    '/verdict': 'Verdicts are read-only in this static build. The live board writes a keep / tweak / kill and its note back into the lane manifest through the authoring server, which then wakes the orchestrator agent. The verdicts already recorded in this build are the real ones and are shown in full.',
    '/answer': 'Answering an ask is read-only in this static build. The live board posts the answer into asks.json, which is how the agent gets a reply back from a review session.',
    '/request': 'Requesting a re-render is read-only in this static build. The live board queues the request on the lane, and a render worker picks it up and produces a new clip.',
    '/milestone': 'Milestones are read-only in this static build. The live board writes goals and snapshots into milestones.json.',
    '/workcard': 'Work-cards are read-only in this static build. The live board writes a frame-anchored card into workcards.json for a worker agent to pick up.',
    '/flow/aspirational': 'Editing the aspirational flow graph is read-only in this static build. The live board writes the graph back so the diff against the traced real graph can be recomputed.',
    '/flow/extract': 'Re-extracting the real flow graph is disabled in this static build. The live tool re-reads the scene sources and the runtime trace to rebuild the graph shown here.',
  };

  window.fetch = function (input, init) {
    const url = typeof input === 'string' ? input : (input && input.url) || '';
    const route = url.split('?')[0].replace(/\/+$/, '');
    if (route.charAt(0) === '/' && WHY[route]) {
      explain(WHY[route]);
      return Promise.resolve(new Response(WHY[route], { status: 501 }));
    }
    if (/\.states\.jsonl$/.test(route) && !BUNDLED.has(key(route))) {
      return Promise.resolve(new Response('', { status: 200 }));
    }
    if (route === '/events') {
      return Promise.resolve(new Response('', { status: 501 }));
    }
    return NATIVE(input, init);
  };

  /* The board opens an SSE channel for live reload. There is no server to push, and an
     un-stubbed EventSource retries the failed connection forever. */
  window.EventSource = function StaticEventSource(url) {
    this.url = url; this.readyState = 0;
    this.close = function () { this.readyState = 2; };
    this.addEventListener = function () {};
    this.removeEventListener = function () {};
  };

  /* Candidates whose clip is not in the sampled bundle. window.__BUNDLED is inlined by
     bundled-clips.js, which loads first, so the check is synchronous: an unbundled clip is
     never requested at all, and the board's own onerror path produces the placeholder that
     gets relabelled below. Without this the page would 404 once per unbundled candidate. */
  const BUNDLED = new Set(window.__BUNDLED || []);
  const key = u => String(u).split('?')[0].replace(/^.*?(out\/)/, '$1');

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
      p.textContent = 'This build samples the rendered clips to stay hostable; the full set is '
        + '763 MB across 120 files. Its verdict, notes and pass history below are the recorded ones.';
      const c = document.createElement('code');
      c.style.cssText = 'display:block;margin-top:6px;opacity:.55;font-size:10px;word-break:break-all';
      c.textContent = path;
      el.append(h, p, c);
    }
  }
  setInterval(relabel, 500);

  /* A write control still looks live, so a click has to say what would have happened
     rather than flashing a generic failure. The panel is driven off the intercepted
     route, so it covers every write path without enumerating buttons. */
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

  /* Mark the write controls so they read as deliberate before they are clicked. */
  /* Leading glyphs are stripped first: the board labels several of these with an icon
     (a re-extract arrow, an inbox tray), and matching on the bare word keeps the list
     readable and stops a relabelled icon from silently dropping a control. */
  const WRITE_LABEL = /^(KEEP|TWEAK|KILL|PIN|\+ ?FEEDBACK|CONNECT|RE-?EXTRACT|ADD GOAL|SUBMIT.*)$/i;
  const label = b => (b.textContent || '').replace(/^[^A-Za-z+]+/, '').trim();
  function markWrites() {
    for (const b of document.querySelectorAll('button')) {
      if (b.dataset.staticMarked) continue;
      if (!WRITE_LABEL.test(label(b))) continue;
      b.dataset.staticMarked = '1';
      b.style.borderStyle = 'dashed';
      b.style.opacity = '0.62';
      b.title = 'Read-only in this static build. The live board writes this back through the '
        + 'authoring server; click to see what it would have done.';
    }
  }
  setInterval(markWrites, 600);

  /* A lane declared as a standalone page (BALANCE) has no manifest, so the board's lane
     handler would fetch one and leave the previous lane on screen. Route it to the page
     the lane declares instead. */
  NATIVE('workshop/lanes.json').then(r => r.json()).then(j => {
    const pages = {};
    for (const l of (j.lanes || [])) if (l.page) pages[l.label] = 'workshop/' + l.page;
    if (!Object.keys(pages).length) return;
    setInterval(() => {
      for (const b of document.querySelectorAll('#lanes button')) {
        const href = pages[(b.textContent || '').trim()];
        if (!href || b.dataset.staticPage) continue;
        b.dataset.staticPage = '1';
        b.title = 'Opens the BALANCE lab in a new tab. It is a standalone page rather than a '
          + 'review lane, so it has no manifest for the board to load.';
        b.onclick = () => window.open(href, '_blank');
      }
    }, 600);
  }).catch(() => {});


})();
