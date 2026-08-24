/**
 * Static-hosting shim for the BALANCE lab page.
 *
 * The lab reads model.json, sweep.json, sweep_pvp.json, sweep_knobbed.json, verify.json
 * and knobs.json from beside itself, so the whole screened build space and every staged
 * verification result in here is the real committed data.
 *
 * Saving a knob overlay posts to /balance/knobs on tools/serve_workshop.py. That route is
 * intercepted here and refused with the reason: a knob change is only meaningful when the
 * sweep is re-run against it, which is a Python job, not a browser one.
 */
(function () {
  const NATIVE = window.fetch.bind(window);
  const WHY = 'Knob overrides are read-only in this static build. The live lab writes the '
    + 'overlay into knobs.json and you then re-run tools/balance/sweep.py against it, which '
    + 're-screens the build space. The sweep and verification results shown here are the '
    + 'committed output of that pipeline.';

  window.fetch = function (input, init) {
    const url = typeof input === 'string' ? input : (input && input.url) || '';
    if (url.split('?')[0].replace(/\/+$/, '') === '/balance/knobs') {
      return Promise.resolve(new Response(WHY, { status: 501 }));
    }
    return NATIVE(input, init);
  };

  function mark() {
    for (const b of document.querySelectorAll('button')) {
      if (b.dataset.staticMarked) continue;
      if (!/save/i.test((b.textContent || '').trim())) continue;
      b.dataset.staticMarked = '1';
      b.style.borderStyle = 'dashed';
      b.style.opacity = '0.62';
      b.title = WHY;
    }
  }
  setInterval(mark, 600);

  document.addEventListener('DOMContentLoaded', function () {
    const n = document.createElement('div');
    n.style.cssText = 'font:12px/1.5 system-ui,sans-serif;background:#191f2b;color:#c3cede;'
      + 'border-bottom:1px solid #33405a;padding:9px 16px';
    n.innerHTML = '<strong style="color:#ffd479">Static build - read-only.</strong> '
      + 'The model, the screened sweep, the PvP sweep and the staged verification results are the '
      + 'committed data. Saving a knob overlay needs the authoring server, because a changed knob '
      + 'only means anything once the Python sweep is re-run against it.';
    document.body.insertBefore(n, document.body.firstChild);
  });
})();
