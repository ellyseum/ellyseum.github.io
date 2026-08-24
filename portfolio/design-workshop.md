---
layout: portfolio-item
title: "The Design Workshop board"
subtitle: "Six review lanes, four passes, and the balance lab"
status: live
permalink: /portfolio/design-workshop/
---

<div style="display:flex;gap:0.5rem;margin:0 0 0.75rem;">
  <video src="{{ '/portfolio/design-workshop/demo/out/workshop/battle_feel/feel_baseline.mp4' | relative_url }}" autoplay muted loop playsinline style="width:33.3%;min-width:0;border-radius:0.5rem;" title="battle feel — baseline"></video>
  <video src="{{ '/portfolio/design-workshop/demo/out/workshop/battle_feel/feel_punchy.mp4' | relative_url }}" autoplay muted loop playsinline style="width:33.3%;min-width:0;border-radius:0.5rem;" title="battle feel — punchy"></video>
  <video src="{{ '/portfolio/design-workshop/demo/out/workshop/battle_feel/feel_cinematic.mp4' | relative_url }}" autoplay muted loop playsinline style="width:33.3%;min-width:0;border-radius:0.5rem;" title="battle feel — cinematic"></video>
</div>
<p class="pf-cap">Three takes on battle feel from the board's battle-feel lane: <strong>baseline</strong>, <strong>punchy</strong>, <strong>cinematic</strong> — the kind of side-by-side call the board exists to make.</p>

The review surface the design work on *For What Lies Beneath* runs through — this board is
where the game's design calls get made. **Six lanes — VFX,
battle feel, mechanics, playthrough, flow and balance** — each with its own candidates, verdicts
and notes, plus a work-card queue, a milestone list, and a scene-flow view that diffs the
intended screen graph against a trace captured from live play.

<div class="pf-frame">
<iframe src="{{ '/portfolio/design-workshop/demo/' | relative_url }}"
        style="width:100%;aspect-ratio:16/10;min-height:560px;border:0;display:block;"
        loading="lazy" title="Design Workshop board — six review lanes, four passes, and the balance lab">
</iframe>
</div>

<p><a class="pf-btn" href="{{ '/portfolio/design-workshop/demo/' | relative_url }}">Run it full-page →</a></p>

Open every lane and tab, play the clips, read a verdict next to the note that produced it and
the pass history behind both. The balance lab, off the board's BALANCE lane button: three tables
over a committed sweep of **386,640 scored builds** carrying **40 flags**, plus the PvP sweep
and staged verification results.

<small>Every route that writes is answered with a sentence naming what the live board does with
it, so nothing silently no-ops: verdicts and notes write into the lane's manifest and wake an
orchestrator agent that dispatches a worker; a re-render request makes a worker render a new
clip in Godot; work-cards, answers, milestones and flow edits are writes into the same JSON
state; balance knobs are read-only until the Python sweep re-runs; the live-reload SSE channel
is stubbed. Clips are sampled, metadata is not — 28 clips ship out of a 763 MB render set,
including all four battle-feel clips, that lane's entire content; a candidate without its clip
shows a labelled box with verdict, note and history intact. The BALANCE lane's button routes
straight to its page, and the balance lab is served with a doctype and explicit
<code>&lt;meta charset&gt;</code> prepended, since a plain file inherits no content-type
header.</small>

The service, locking model and delta-notification design behind the board:
[workshop]({{ '/portfolio/workshop/' | relative_url }}). Part of a private personal-project
repository.
