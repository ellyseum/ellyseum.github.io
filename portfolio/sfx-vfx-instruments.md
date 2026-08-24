---
layout: portfolio-item
title: "The instruments"
subtitle: "An SFX workstation and a VFX auditioner"
status: live
permalink: /portfolio/sfx-vfx-instruments/
---

Two home-grown tools, built because general-purpose ones didn't fit the actual problem.

**The SFX side** exists because Godot's audio-loop behavior doesn't match what a general DAW
assumes: Godot reads WAV loop points from the `smpl` chunk (sample-exact), but ignores OGG
`LOOPSTART`/`LOOPLENGTH` tags entirely, so the game's own music code parses those itself — and
a naive ASCII scan for `LOOPSTART=` silently failed, because Ogg headers are full of null
bytes that truncate a naive string read. A browser-based DAW (cue bank, waveform cutting, loop
authoring, and arrangement) was built around that reality, with its own WAV encoder written
specifically to emit the `smpl` chunk a prior encoder omitted. Underneath it, every sound
effect is synthesized from primitives — square, pulse, triangle, sine, noise — with the noise
generator reproducing the real NES noise-channel clock timing rather than approximating it, and
a three-tier override chain that lets a real recorded or generated sound replace the synth
version at any of roughly 140 call sites with zero caller-code changes.

**The VFX side** authors effects as data records against a fixed engine (18 shapes, 21
flipbook animations) rather than as one script per effect, reviewed through a gallery that
batch-generates candidates, renders them, and persists a verdict per candidate. Across three
dated review passes: 117 candidates, 154 review-history entries, verdicts of 93 kept / 57
tweak / 4 killed. The review system's own validator deliberately constructs a broken test case
and requires itself to catch it before it will validate anything real — a self-test wired into
the CI gate, not a one-off check.

Both are part of a private personal-project repository.
