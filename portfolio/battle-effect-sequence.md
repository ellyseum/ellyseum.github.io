---
layout: portfolio-item
title: "A battle-effect sequence, rebuilt and measured"
subtitle: "A WebGL + Canvas2D recreation, validated against a rubric"
status: live
permalink: /portfolio/battle-effect-sequence/
---

<div class="pf-frame">
<iframe src="{{ '/portfolio/battle-effect-sequence/demo/' | relative_url }}"
        style="width:100%;aspect-ratio:16/9;border:0;display:block;"
        loading="lazy" allow="fullscreen; autoplay" allowfullscreen title="Battle-effect sequence demo — click the replay button in the corner">
</iframe>
</div>

<p><a class="pf-btn" href="{{ '/portfolio/battle-effect-sequence/demo/' | relative_url }}">Run it full-page →</a>
<small>(replay button in the corner)</small></p>

A clean-room recreation of *Persona 5*'s "AMBUSH!" battle-start flourish — **cyan light-beams, a
scattered wordmark, a jagged ink-banner, a red eruption, timed to about 2.3 seconds**. The beams
and rings are real WebGL (three.js, a custom shader for the dark-stroke/gradient/splat); the
wordmark and ink backdrop are Canvas2D, composited as a **stacked-canvas hybrid** — the same
2D-over-3D approach the source itself uses.

<small>The sequence above is the output of an agentic, rubric-scored validation loop — render,
capture frames headlessly, compare against the reference, score each subsystem with a
multi-agent panel, rebuild, repeat — the system that converged it toward the source.</small>

**Fan-work disclaimer.** *Persona 5* and the "AMBUSH!" battle-start sequence are the property
of ATLUS / SEGA. This is an unaffiliated, non-commercial, clean-room recreation built for
educational and research purposes; it is not endorsed by or affiliated with either company,
and no original game assets are included or distributed. The page vendors two open-licensed
dependencies: three.js (MIT) and the Anton typeface (SIL Open Font License 1.1).
