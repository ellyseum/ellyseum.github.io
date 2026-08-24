---
layout: portfolio-item
title: "The VFX audition gallery"
subtitle: "117 candidates, four review passes, and the verdicts behind them"
status: live
permalink: /portfolio/vfx-auditioner/
---

<div style="display:flex;gap:0.5rem;margin:0 0 0.75rem;">
  <video src="{{ '/portfolio/vfx-auditioner/demo/out/audition/witness_thread.mp4' | relative_url }}" autoplay muted loop playsinline style="width:33.3%;min-width:0;border-radius:0.5rem;" title="The X-Cancel"></video>
  <video src="{{ '/portfolio/vfx-auditioner/demo/out/audition/boss_intro_slam.mp4' | relative_url }}" autoplay muted loop playsinline style="width:33.3%;min-width:0;border-radius:0.5rem;" title="Boss Transition"></video>
  <video src="{{ '/portfolio/vfx-auditioner/demo/out/audition/victory_fireworks.mp4' | relative_url }}" autoplay muted loop playsinline style="width:33.3%;min-width:0;border-radius:0.5rem;" title="Muster Fireworks"></video>
</div>
<p class="pf-cap">Three of the 117, playing as rendered: <strong>The X-Cancel</strong>, <strong>Boss Transition</strong>, <strong>Muster Fireworks</strong>.</p>

Visual effects for *For What Lies Beneath*, auditioned the way casting works: **batch-generate
candidates, render each one, keep a verdict per candidate across passes**. What survives these
passes is what the game gets — the system generates at volume, and human judgment is the
selection function. All **117 candidates**
ship here with their blurb, wave, backdrop, verdict, note and complete per-pass history across
four passes dated 2026-07-19 — counting each candidate's current verdict as captured for this
build: **68 accepted, 4 killed, 45 still in review**, and 8 changed verdict between passes.

Read the candidates as **ideation-pipeline outputs**: the pipeline's job is to propose at
volume, and the gallery closes the loop — every proposal enters an **accept / tweak / kill**
cycle, where an acceptance ships, a tweak note becomes the work order for the next pass, and a
kill is a recorded decision rather than a silent deletion.

That last group is what a finished effects reel cannot show: `witness_thread` reads tweak on
pass 1 and kill on passes 2 and 3; `impact_frame` was kept carrying the note *"the sparkle
effect kills it, needs more work but i like as a starter"* — a critique passed forward rather
than a rejection.

<div class="pf-frame">
<iframe src="{{ '/portfolio/vfx-auditioner/demo/' | relative_url }}"
        style="width:100%;aspect-ratio:16/10;min-height:560px;border:0;display:block;"
        loading="lazy" title="VFX audition gallery — 117 candidates with per-pass verdict history">
</iframe>
</div>

<p><a class="pf-btn" href="{{ '/portfolio/vfx-auditioner/demo/' | relative_url }}">Run it full-page →</a></p>

<small>Verdicts are read-only here — in the live gallery a verdict and its note write into the
manifest and wake an orchestrator agent, which dispatches a worker to act on the note; a request
for a new candidate makes a worker render one in Godot; live reload's server-sent-events channel
is stubbed. Clips are sampled, metadata is not: the full render set is 763 MB across 120 files,
24 clips ship here spanning the range of judgments, and a candidate whose clip is absent shows a
labelled box with its verdict, note and history intact.</small>

The authoring engine behind the candidates:
[the instruments]({{ '/portfolio/sfx-vfx-instruments/' | relative_url }}); the lane this gallery
reports into: [workshop]({{ '/portfolio/workshop/' | relative_url }}). Part of a private
personal-project repository.
