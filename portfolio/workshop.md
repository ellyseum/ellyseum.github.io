---
layout: portfolio-item
title: "workshop"
subtitle: "A multi-lane render, judge, and dispatch system"
status: live
permalink: /portfolio/workshop/
---

The machinery behind [the Design Workshop board]({{ '/portfolio/design-workshop/' | relative_url }}) —
**run the board there**; this page is the engine note.

An event-driven, multi-lane design-review system: **seven lanes** (balance, battle feel, flow,
mechanics, menus, playthrough, VFX), state kept as plain JSON/JSONL in the repository, served by
a local Python service. Writes are locked per file path, not behind one global lock, so one
lane's write can't stall another's; a delta-notification command prints only the difference
against a stored snapshot, and an agent's own writes are tagged by source so they never
re-trigger the monitor that reads them.

Its flow-mapping tool cross-checks **three independently-produced views of the game's
screen-flow graph** — a static parse, a hand-authored intended map, and a runtime trace from
live play. The runtime trace caught the static parser wrongly classifying reachable game states
as dead code; every disagreement gets filed automatically as a de-duplicated work item. A
separate autonomous-review mode grades five safety dimensions green/yellow/red from two
independently recorded trace trails against ground truth — logged across six dated audit
rounds, one of which found two regressions its own previous round had introduced.

<!-- DEMO SLOT: drop a <video> tag or embed (YouTube unlisted, etc.) directly below this
     comment when the capture is ready. No layout change needed — this is a plain content
     block inside .portfolio-item-content. -->

Private personal-project repository; the manifests and review data are the legible artifact
here, in addition to whatever video capture follows.
