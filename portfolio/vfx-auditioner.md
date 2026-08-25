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

**The same pipeline shape reaches past effects.** For the game's title screen, a vision model
watched twelve title-screen references and narrated their beats — what moves, what holds, what
the first keypress does — and a builder–critic loop coded **five complete Godot title flows**
from those narrations, judged blind A/B against each other. One control mattered enough to
name: **the judging seat sees the candidates in swapped order across rounds**, which caught it
favoring whichever flow it saw first — so describing was split from judging, and the positions
rotate. The reel below plays all five flows end to end, studio card to save-slot screen.

<video src="{{ '/portfolio/vfx-auditioner/title-beat-pair.mp4' | relative_url }}"
       autoplay muted loop playsinline
       style="width:100%;display:block;border-radius:0.5rem;"
       title="Two title-flow candidates at the same beat, side by side — the judging seat's actual input"></video>
<p class="pf-cap">What the judging seat actually sees: two candidates at the same beat,
labelled only LEFT and RIGHT — and shown again with the positions swapped before any
verdict counts.</p>

**The style studies that came first.** Before the title flows, the same look-dev loop surveyed
the UI languages of seven games — **Final Fantasy Tactics, Metaphor: ReFantazio, Persona 5,
Into the Breach, Disgaea, Shin Megami Tensei V, Slay the Spire** — and rebuilt each as a named
FWLB house style: original characters, systems and numbers throughout, the studied game's
visual grammar credited. The eighth tour walks the game's own menu system, opening on a
classic-JRPG study. Each study ran research → plan → build → QA before its tour was recorded.

<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:0.6rem;margin:1rem 0 0.5rem;">
  <figure style="margin:0"><video src="{{ '/portfolio/vfx-auditioner/ui-tours/fft.mp4' | relative_url }}" poster="{{ '/portfolio/vfx-auditioner/ui-tours/fft.jpg' | relative_url }}" controls preload="none" playsinline style="width:100%;display:block;border-radius:0.5rem;"></video><figcaption class="pf-cap">after <strong>Final Fantasy Tactics</strong></figcaption></figure>
  <figure style="margin:0"><video src="{{ '/portfolio/vfx-auditioner/ui-tours/mp.mp4' | relative_url }}" poster="{{ '/portfolio/vfx-auditioner/ui-tours/mp.jpg' | relative_url }}" controls preload="none" playsinline style="width:100%;display:block;border-radius:0.5rem;"></video><figcaption class="pf-cap">after <strong>Metaphor: ReFantazio</strong> — the Crimson Codex study</figcaption></figure>
  <figure style="margin:0"><video src="{{ '/portfolio/vfx-auditioner/ui-tours/p5.mp4' | relative_url }}" poster="{{ '/portfolio/vfx-auditioner/ui-tours/p5.jpg' | relative_url }}" controls preload="none" playsinline style="width:100%;display:block;border-radius:0.5rem;"></video><figcaption class="pf-cap">after <strong>Persona 5</strong> — the Phantom Crimson study</figcaption></figure>
  <figure style="margin:0"><video src="{{ '/portfolio/vfx-auditioner/ui-tours/itb.mp4' | relative_url }}" poster="{{ '/portfolio/vfx-auditioner/ui-tours/itb.jpg' | relative_url }}" controls preload="none" playsinline style="width:100%;display:block;border-radius:0.5rem;"></video><figcaption class="pf-cap">after <strong>Into the Breach</strong> — the Wardline study</figcaption></figure>
  <figure style="margin:0"><video src="{{ '/portfolio/vfx-auditioner/ui-tours/dg.mp4' | relative_url }}" poster="{{ '/portfolio/vfx-auditioner/ui-tours/dg.jpg' | relative_url }}" controls preload="none" playsinline style="width:100%;display:block;border-radius:0.5rem;"></video><figcaption class="pf-cap">after <strong>Disgaea</strong> — the Nethergloom study</figcaption></figure>
  <figure style="margin:0"><video src="{{ '/portfolio/vfx-auditioner/ui-tours/smt.mp4' | relative_url }}" poster="{{ '/portfolio/vfx-auditioner/ui-tours/smt.jpg' | relative_url }}" controls preload="none" playsinline style="width:100%;display:block;border-radius:0.5rem;"></video><figcaption class="pf-cap">after <strong>Shin Megami Tensei V</strong> — the Leyline study</figcaption></figure>
  <figure style="margin:0"><video src="{{ '/portfolio/vfx-auditioner/ui-tours/sts.mp4' | relative_url }}" poster="{{ '/portfolio/vfx-auditioner/ui-tours/sts.jpg' | relative_url }}" controls preload="none" playsinline style="width:100%;display:block;border-radius:0.5rem;"></video><figcaption class="pf-cap">after <strong>Slay the Spire</strong> — the Ashen Deck study</figcaption></figure>
  <figure style="margin:0"><video src="{{ '/portfolio/vfx-auditioner/ui-tours/menu.mp4' | relative_url }}" poster="{{ '/portfolio/vfx-auditioner/ui-tours/menu.jpg' | relative_url }}" controls preload="none" playsinline style="width:100%;display:block;border-radius:0.5rem;"></video><figcaption class="pf-cap">the game's <strong>own menu system</strong>, toured</figcaption></figure>
</div>

<div class="pf-frame">
<video src="{{ '/portfolio/vfx-auditioner/title-flow-reel.mp4' | relative_url }}"
       controls preload="metadata" playsinline
       style="width:100%;display:block;"
       title="Five generated title flows for For What Lies Beneath, played end to end"></video>
</div>
<p class="pf-cap">Five candidate title flows, one reel — the audition pattern applied to a
whole interactive sequence rather than a single effect.</p>

<div class="pf-frame">
<iframe src="{{ '/portfolio/vfx-auditioner/demo/' | relative_url }}"
        style="width:100%;aspect-ratio:16/10;min-height:560px;border:0;display:block;"
        loading="lazy" allow="fullscreen; autoplay" allowfullscreen title="VFX audition gallery — 117 candidates with per-pass verdict history">
</iframe>
</div>

<p><a class="pf-btn" href="{{ '/portfolio/vfx-auditioner/demo/' | relative_url }}">Run it full-page →</a></p>

<small>Verdicts are read-only here — in the live gallery a verdict and its note write into the
manifest and wake an orchestrator agent, which dispatches a worker to act on the note; a request
for a new candidate makes a worker render one in Godot; live reload's server-sent-events channel
is stubbed. Record and reel both ship whole: **every candidate's clip is bundled and plays**,
the original 763 MB render set re-encoded for the web to 87 MB with the pixel art intact.</small>

The authoring engine behind the candidates:
[the instruments]({{ '/portfolio/sfx-vfx-instruments/' | relative_url }}); the lane this gallery
reports into: [workshop]({{ '/portfolio/workshop/' | relative_url }}). Part of a private
personal-project repository.
