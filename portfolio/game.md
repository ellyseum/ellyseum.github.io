---
layout: portfolio-item
title: "For What Lies Beneath, playable"
subtitle: "The Godot web export, running on a plain static host"
status: live
permalink: /portfolio/game/
---

The game itself — a from-scratch tactics game built in Godot — exported to the web and served as
files. Click the canvas first, then `Enter` confirms, `WASD` or the arrow keys move the cursor, and
`Esc` backs out. The path through it is faction select, then the branching march map, then a battle
on the destructible terrain with the action menu and unit stats live.

**It needs no cross-origin isolation, and none is configured.** The common expectation is that
Godot Web requires `SharedArrayBuffer`, therefore COOP and COEP response headers, therefore a
service-worker shim on a static host. Measured on a server sending no cross-origin headers at all,
`crossOriginIsolated` is `false` and `SharedArrayBuffer` is `undefined`, and the export boots and
plays anyway: it is a single-threaded Emscripten build with no GDExtension, so it never asks. The
references in the loader are feature detection, not requirements.

**Two properties of this particular export**, both stated in the build's own footer:

- **It is dated 2026-06-12**, about ten weeks behind the project's current tip. Anything added
  since is absent from it.
- **It runs silent.** The music directory was not packed into the export, and the engine log says
  so: `WARNING: [music] no tracks in res://music`.

Measured at 32 fps at 1280×800 during a battle — one three-second sample in one browser on one
machine, not a benchmark. Godot 4.6.3, 63 MB total, the largest single file being a 37.7 MB
`index.wasm`.

<p><a href="{{ '/portfolio/game/demo/' | relative_url }}">Run it →</a></p>

<iframe src="{{ '/portfolio/game/demo/' | relative_url }}"
        style="width:100%;aspect-ratio:16/9;min-height:520px;border:1px solid var(--surface, #333);border-radius:0.5rem;"
        loading="lazy" allow="fullscreen; autoplay" title="For What Lies Beneath — Godot web export, click the canvas then press Enter">
</iframe>

The instrumentation used to drive and inspect it from outside is described on
[the devtools protocol]({{ '/portfolio/game-devtools-protocol/' | relative_url }}). The source is a
private personal-project repository.
