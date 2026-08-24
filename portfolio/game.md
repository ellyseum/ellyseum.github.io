---
layout: portfolio-item
title: "For What Lies Beneath, playable"
subtitle: "The Godot web export, running on a plain static host"
status: live
permalink: /portfolio/game/
---

The game itself — **a from-scratch tactics game built in Godot**, exported to the web and served
as files. This is the creative result the rest of the portfolio's instruments exist to build:
the DAW's loops, the auditioned effects, and the workshop's verdicts all point here.
**Click the canvas, then `Enter` confirms, `WASD`/arrows move, `Esc` backs out.** The path
through it: faction select, the branching march map, then a battle on destructible terrain with
the action menu and unit stats live.

**Read it as what it is: an early preview of a game being attempted, not a finished one.** The
look is development graphics — deliberately programmatic — and many screens are simple dev
placeholders holding a slot for scenes that aren't built yet. What's further along is the
systems underneath them. And one production detail worth naming plainly: **some of the billboard
sprites are AI-generated retro pixel graphics, produced with Adobe Firefly Services** in the
character-art pipeline.

**The build ships its own workbenches.** The gear top-right (or `Ctrl+D`) opens a dev panel
that jumps straight into the studios the game is built with — **FX LAB** (the effects
workbench: cycle spells, dial an eight-lamp light studio, fog and terrain presets), SOUND LAB,
SPRITE LAB, UI LAB and the rest — all running right here in the browser.

<div class="pf-frame">
<iframe src="{{ '/portfolio/game/demo/' | relative_url }}"
        style="width:100%;aspect-ratio:16/9;min-height:520px;border:0;display:block;"
        loading="lazy" allow="fullscreen; autoplay" title="For What Lies Beneath — Godot web export, click the canvas then press Enter">
</iframe>
</div>

<p><a class="pf-btn" href="{{ '/portfolio/game/demo/' | relative_url }}">Run it full-page →</a></p>

<small>**It needs no cross-origin isolation, and none is configured.** The common expectation is
that Godot Web requires `SharedArrayBuffer`, therefore COOP/COEP headers, therefore a
service-worker shim on a static host. Measured on a server sending no cross-origin headers at
all, `crossOriginIsolated` is `false` and `SharedArrayBuffer` is `undefined`, and the export
boots and plays anyway: a single-threaded Emscripten build with no GDExtension never asks — the
loader's references are feature detection, not requirements.</small>

<small>This export is **dated 2026-06-12**, about ten weeks behind the project's current tip,
and **it runs silent** — the music directory was not packed, and the engine log says so:
`WARNING: [music] no tracks in res://music`. Measured at 32 fps at 1280×800 during a battle
(one three-second sample in one browser on one machine, not a benchmark). Godot 4.6.3, 63 MB
total, the largest single file a 37.7 MB `index.wasm`.</small>

The instrumentation used to drive and inspect it from outside:
[the devtools protocol]({{ '/portfolio/game-devtools-protocol/' | relative_url }}). The source
is a private personal-project repository.
