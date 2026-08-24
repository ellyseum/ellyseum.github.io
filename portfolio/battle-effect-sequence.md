---
layout: portfolio-item
title: "A battle-effect sequence, rebuilt and measured"
subtitle: "A WebGL + Canvas2D recreation, validated against a rubric"
status: live
permalink: /portfolio/battle-effect-sequence/
---

A clean-room recreation of *Persona 5*'s "AMBUSH!" battle-start flourish: cyan light-beams, a
scattered wordmark, a jagged ink-banner, a red eruption, timed to about 2.3 seconds. The light
beams and rings are real WebGL (three.js, a custom shader for the dark-stroke/gradient/splat);
the wordmark and ink backdrop are Canvas2D, composited as a stacked-canvas hybrid — the same
2D-over-3D approach the source itself uses.

It was converged toward the source with an agentic, rubric-scored validation loop: render,
capture frames headlessly, compare against the reference, score each subsystem against a
rubric with a multi-agent panel, synthesize the feedback, rebuild, repeat.

<p><a href="{{ '/portfolio/battle-effect-sequence/demo/' | relative_url }}">Run it →</a></p>

<iframe src="{{ '/portfolio/battle-effect-sequence/demo/' | relative_url }}"
        style="width:100%;aspect-ratio:16/9;border:1px solid var(--surface, #333);border-radius:0.5rem;"
        loading="lazy" title="Battle-effect sequence demo — click the replay button in the corner">
</iframe>

**Fan-work disclaimer.** *Persona 5* and the "AMBUSH!" battle-start sequence are the property
of ATLUS / SEGA. This is an unaffiliated, non-commercial, clean-room recreation built for
educational and research purposes; it is not endorsed by or affiliated with either company,
and no original game assets are included or distributed. The page vendors two open-licensed
dependencies: three.js (MIT) and the Anton typeface (SIL Open Font License 1.1).
