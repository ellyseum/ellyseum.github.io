---
layout: portfolio-item
title: "workshop"
subtitle: "A multi-lane render, judge, and dispatch system"
status: live
permalink: /portfolio/workshop/
---

An event-driven, multi-lane design-review system: seven lanes (balance, battle feel, flow,
mechanics, menus, playthrough, VFX), state kept as plain JSON/JSONL in the repository, served
by a local Python service and browsed as a web page.

A monitor polling for new work needs to see only what changed, and never re-trigger on its own
writes: a delta-notification command prints only the difference against a stored snapshot and
advances that snapshot atomically, while an agent's own writes are tagged by source so they
don't re-trigger the same monitor that reads them. Writes are locked per file path rather than
behind one global lock, specifically so one lane's write can't stall another's.

The flow-mapping tool inside it cross-checks three independently-produced views of the game's
screen-flow graph — a static parse, a hand-authored intended map, and a runtime trace captured
from a live play session — against each other. The runtime trace caught the static parser
wrongly classifying reachable game states as dead code, and every gap the three views disagree
on gets filed automatically as a de-duplicated work item in the review queue.

A separate autonomous-review mode scores five safety dimensions from two independently
recorded trace trails (client and server) against a ground-truth file, grades each dimension
green/yellow/red, and takes the worst dimension as the overall grade — logged across six dated
audit rounds, one of which found two regressions its own previous round had introduced.

<!-- DEMO SLOT: drop a <video> tag or embed (YouTube unlisted, etc.) directly below this
     comment when the capture is ready. No layout change needed — this is a plain content
     block inside .portfolio-item-content. -->

Private personal-project repository; the manifests and review data are the legible artifact
here, in addition to whatever video capture follows.
