---
layout: portfolio-item
title: "The Design Workshop board"
subtitle: "Six review lanes, four passes, and the balance lab"
status: live
permalink: /portfolio/design-workshop/
---

The review surface the design work on *For What Lies Beneath* runs through. Six lanes — VFX,
battle feel, mechanics, playthrough, flow and balance — ship in this build, each with its own
candidates, verdicts and notes, plus a work-card queue, a milestone list, and a scene-flow view that diffs the intended
screen graph against a trace captured from a live play session.

**What a reviewer can do here.** Open every lane and every tab. Play the bundled clips. Read a
verdict next to the note that produced it and the pass history behind both. Open the flow diff and
see where the three independently-produced views of the screen graph disagree. Open the balance
lab from the board's BALANCE lane button: three tables over a committed sweep of **386,640 scored
builds** carrying **40 flags**, plus the PvP sweep and the staged verification results.

**What this build does differently.** Every route that writes is answered with a sentence naming
what the live board does with it, so nothing silently no-ops:

- **A verdict** — keep, tweak or kill plus a note — writes into the lane's `manifest.json` and
  wakes an orchestrator agent, which dispatches a worker to act on the note. The verdicts here are
  that mechanism's output.
- **A re-render request** makes a worker render a new clip in Godot. Requests already recorded are
  visible; new ones are refused with that reason.
- **Work-cards, answers, milestones and flow edits** are writes into the same JSON state the board
  reads.
- **A balance knob** only means anything once the Python sweep is re-run against it, so the knobs
  tab is read-only and the committed sweep results stand.
- **Live reload** normally arrives over a server-sent-events channel; it is stubbed, so the page
  does not retry a connection that cannot exist.
- **Clips are sampled, metadata is not.** 28 clips ship here out of a 763 MB render set, including
  all four battle-feel clips, which are that lane's entire content. A candidate without its clip
  shows a labelled box, with its verdict, note and history intact.

Two things behave differently here by design rather than by degradation. The BALANCE lane declares
a page rather than a manifest, and this build routes its lane button straight to that page. The
balance lab itself is served with a doctype and an explicit `<meta charset>` prepended, because as
a plain file it has no server-set content-type header to inherit.

<p><a href="{{ '/portfolio/design-workshop/demo/' | relative_url }}">Run it →</a></p>

<iframe src="{{ '/portfolio/design-workshop/demo/' | relative_url }}"
        style="width:100%;aspect-ratio:16/10;min-height:560px;border:1px solid var(--surface, #333);border-radius:0.5rem;"
        loading="lazy" title="Design Workshop board — six review lanes, four passes, and the balance lab">
</iframe>

The service, locking model and delta-notification design behind the board are described on
[workshop]({{ '/portfolio/workshop/' | relative_url }}). Part of a private personal-project
repository.
