---
layout: portfolio-item
title: "The instruments"
subtitle: "A loop-authoring workstation and a persisted-verdict auditioner, built for SFX and VFX craft"
status: live
permalink: /portfolio/sfx-vfx-instruments/
---

Two home-grown tools, built because general-purpose ones didn't fit the actual problem — the
instruments behind one game's sound and effects, and each instrument's output ships in it. All
four faces of them run in the browser:

- **[The audio DAW]({{ '/portfolio/audio-daw/' | relative_url }})** — 167 cues, 7 tracks, loop
  authoring, and a WAV export that carries its loop points.
- **[The SFX take composer]({{ '/portfolio/sfx-composer/' | relative_url }})** — the
  take-audition half: A/B generated takes against references through an effects rack.
- **[The VFX audition gallery]({{ '/portfolio/vfx-auditioner/' | relative_url }})** — 117 effect
  candidates with the verdict, note and per-pass history behind each.
- **[The VFX build-out report]({{ '/portfolio/vfx-report/' | relative_url }})** — a six-wave
  build narrated with its renders embedded.

**The SFX side** exists because Godot reads WAV loop points from the `smpl` chunk but ignores
OGG `LOOPSTART`/`LOOPLENGTH` tags entirely — so the DAW authors both, with its own WAV encoder
written to emit `smpl`. Underneath, **every sound effect is synthesized from primitives** —
square, pulse, triangle, sine, noise, the noise generator reproducing the real NES
noise-channel clock timing — with a three-tier override chain that lets a recorded or generated
sound replace the synth version at any of roughly 140 call sites with zero caller-code changes.

**The VFX side** authors effects as **data records against a fixed engine** (18 shapes, 21
flipbook animations) rather than one script per effect, reviewed through the gallery. Across
four dated review passes: 117 candidates, 154 review-history entries, verdicts of 93 kept /
57 tweak / 4 killed. The review system's own validator deliberately constructs a broken test
case and requires itself to catch it before it will validate anything real.

**[Cast the effects yourself]({{ '/portfolio/game/demo/?boot=fx_lab' | relative_url }})** — the
game build boots straight into its FX Lab: `←`/`→` picks a spell, `Space` casts it at the
terrain, and `Tab` flips to the liquid studio, where a right-click pours water.

Both are part of a private personal-project repository.
