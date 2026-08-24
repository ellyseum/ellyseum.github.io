---
layout: portfolio-item
title: "The VFX audition gallery"
subtitle: "117 candidates, four review passes, and the verdicts behind them"
status: live
permalink: /portfolio/vfx-auditioner/
---

Visual effects for *For What Lies Beneath* are authored as data records against a fixed engine
rather than as one script per effect, and reviewed through this gallery: it batch-generates
candidates, renders each one, and keeps a verdict per candidate across passes.

The record is the artifact. All 117 candidates ship here with their blurb, wave, backdrop,
verdict, note and complete per-pass history across four passes dated 2026-07-19. Counting each
candidate's current verdict as captured for this build: 68 accepted, 4 killed, 45 still in
review, and 8 changed verdict between passes. That last group is
what a finished effects reel cannot show: `witness_thread` reads tweak on pass 1 and kill on passes
2 and 3; `impact_frame` was kept carrying the note "the sparkle effect kills it, needs more work
but i like as a starter", which is a critique passed forward rather than a rejection.

**What a reviewer can do here.** Move between the ACTIVE and HISTORY tabs, play the bundled clips,
and read any candidate's pass table against the note that produced its verdict.

**What this build does differently.**

- **Verdicts are read-only here.** In the live gallery a verdict and its note write into the
  manifest and wake an orchestrator agent, which dispatches a worker to act on the note. The
  verdicts shown are that mechanism's output.
- **A request for a new candidate** makes a worker render one in Godot, which nothing in a browser
  can do. The requests already recorded are visible.
- **Live reload** normally arrives over a server-sent-events channel the authoring server pushes to
  when a manifest or a clip changes. That channel is stubbed, so the page does not retry a
  connection that cannot exist.
- **Clips are sampled, metadata is not.** The full render set is 763 MB across 120 files; 24 clips
  ship here, chosen to span the range of judgments rather than to show the best takes. A candidate
  whose clip is absent shows a labelled box saying so, with its verdict, note and history intact
  below it.

<p><a href="{{ '/portfolio/vfx-auditioner/demo/' | relative_url }}">Run it →</a></p>

<iframe src="{{ '/portfolio/vfx-auditioner/demo/' | relative_url }}"
        style="width:100%;aspect-ratio:16/10;min-height:560px;border:1px solid var(--surface, #333);border-radius:0.5rem;"
        loading="lazy" title="VFX audition gallery — 117 candidates with per-pass verdict history">
</iframe>

The authoring engine behind the candidates is described on
[the instruments]({{ '/portfolio/sfx-vfx-instruments/' | relative_url }}); the lane this gallery
reports into is part of [workshop]({{ '/portfolio/workshop/' | relative_url }}). Part of a private
personal-project repository.
