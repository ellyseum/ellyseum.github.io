/**
 * Static-hosting shim for the FWLB DAW.
 *
 * The tool is written against tools/serve_daw.py, which answers GET /tracks and
 * accepts POST /save, /cue and /import. A plain file server has none of those
 * routes, so this shim answers them before the application code sees a 404:
 *
 *   GET  /tracks  -> the pre-generated tracks.json beside this file
 *   POST /save    -> WAV encodes in the browser and downloads; OGG needs the
 *                    server-side transcode and is refused with the reason
 *   POST /cue     -> refused: keeper flags write back to sfx_data.json
 *   POST /import  -> refused: copying a disk path into the workspace is server work
 *
 * Decoding, waveform drawing, loop-point authoring, crossfade baking, playback and
 * drag-and-drop of a local file already run entirely in the browser and are
 * unaffected. All paths stay relative so the build serves from any subdirectory.
 */
(function () {
  const NATIVE = window.fetch.bind(window);
  const HERE = new URL('.', document.currentScript.src).href;
  const REFUSED = {
    '/cue': 'Keeper flags are read-only in this static build. The live tool marks a take with a star and writes the flag back into sfx_data.json through the authoring server; there is no writable copy of that file here.',
    '/import': 'Path import is disabled in this static build. The live tool copies a file from anywhere on disk into the workspace, which is server work. Dragging a file onto this window still works - that route decodes in the browser.',
  };

  const json = (obj, status) => new Response(JSON.stringify(obj), {
    status: status || 200, headers: { 'Content-Type': 'application/json' },
  });

  function download(name, bytes) {
    const url = URL.createObjectURL(new Blob([bytes], { type: 'audio/wav' }));
    const a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }

  window.fetch = function (input, init) {
    const url = typeof input === 'string' ? input : (input && input.url) || '';
    const route = url.split('?')[0].replace(/\/+$/, '');

    if (route === '/tracks') return NATIVE(HERE + 'tracks.json');

    if (route === '/save') {
      let body = {};
      try { body = JSON.parse((init && init.body) || '{}'); } catch (e) { /* handled below */ }
      if (body.fmt !== 'wav') {
        return Promise.resolve(new Response(
          'OGG export is disabled in this static build. The live tool transcodes to Vorbis server-side and writes the loop as LOOPSTART/LOOPLENGTH comments. WAV export works here: it encodes in the browser, carries the same loop points in the smpl chunk, and downloads.',
          { status: 501 }));
      }
      const bin = atob(body.b64 || '');
      const u8 = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
      let name = body.name || 'export';
      if (!/\.wav$/i.test(name)) name += '.wav';
      download(name, u8);
      return Promise.resolve(json({ path: name + ' (downloaded to your browser)', loop: body.loop ? 'smpl' : null }));
    }

    if (REFUSED[route]) return Promise.resolve(new Response(REFUSED[route], { status: 501 }));

    return NATIVE(input, init);
  };

  /* Label the degraded surfaces, so a disabled control reads as deliberate. The views
     repaint on every mode change, so re-apply rather than marking once at boot. */
  const MARKS = [
    ['#mOgg', 'Static build: OGG export needs the authoring server for the Vorbis transcode. WAV export encodes in the browser and downloads, loop points included.'],
    ['#impPath', 'Static build: copying a file from a disk path into the workspace is server work. Drag a file onto the window instead - that route decodes in the browser.'],
    ['#impDir', 'Static build: path import needs the authoring server.'],
  ];
  function mark() {
    for (const [sel, why] of MARKS) {
      const el = document.querySelector(sel);
      if (!el || el.dataset.staticMarked) continue;
      el.dataset.staticMarked = '1';
      el.disabled = true;
      el.title = why;
      el.classList.add('static-disabled');
      if (el.tagName === 'INPUT') el.placeholder = 'disabled in static build';
    }
  }
  setInterval(mark, 400);
  if (document.readyState !== 'loading') mark();
  else document.addEventListener('DOMContentLoaded', mark);
})();
