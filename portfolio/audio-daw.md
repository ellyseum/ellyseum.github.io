---
layout: portfolio-item
title: "The audio DAW"
subtitle: "Cue bank, waveform cutting and loop authoring, served as plain files"
status: live
permalink: /portfolio/audio-daw/
---

The audio tool from *For What Lies Beneath*, running here with no server behind it. Four modes:
a bank of 167 synthesized SFX cues, waveform cutting, intro-then-loop authoring, and arrangement,
over the game's 7 music tracks.

It exists because Godot's loop behaviour does not match what a general DAW assumes: Godot reads
WAV loop points from the `smpl` chunk, and ignores OGG `LOOPSTART`/`LOOPLENGTH` tags entirely, so
the game's own music code parses those itself. This tool authors both, and its WAV encoder was
written specifically to emit the `smpl` chunk.

**What a reviewer can do here.** Play any of the 167 cues. Load a music track, read the loop
points already written into its OGG comments, drag them, snap them to zero crossings, run the seam
analysis, bake a crossfade, undo, and export a WAV — the download carries the loop points in its
`smpl` chunk, which is the round trip the tool exists for. Dragging any audio file from your
desktop onto the window loads it; that path decodes in the browser.

**What this build does differently.** Three routes are server work, and each control says so on
hover rather than failing:

- **OGG export** writes `LOOPSTART`/`LOOPLENGTH` Vorbis comments during a transcode the live
  server performs. WAV export is the browser-side path and works here.
- **A keeper flag** on a cue writes back into `sfx_data.json`. The flags already recorded are
  shown.
- **Path import** copies a file from anywhere on disk into the workspace. Drag-and-drop covers the
  same need for a file you already have.

The track list is served from a generated `tracks.json`; the live server enumerates the music
directory instead. The SFX bank's reference cues originate from *Final Fantasy Tactics* and ship
under a stated fan-work disclaimer: they are the targets an unaffiliated, non-commercial recreation
project was built to match, and the tool, its synthesis code, and all generated takes are original
work.

<p><a href="{{ '/portfolio/audio-daw/demo/' | relative_url }}">Run it →</a></p>

<iframe src="{{ '/portfolio/audio-daw/demo/' | relative_url }}"
        style="width:100%;aspect-ratio:16/10;min-height:560px;border:1px solid var(--surface, #333);border-radius:0.5rem;"
        loading="lazy" title="Audio DAW — 167 SFX cues, 7 music tracks, loop authoring and WAV export">
</iframe>

The engineering behind it, including the synthesis layer and the override chain, is described on
[the instruments]({{ '/portfolio/sfx-vfx-instruments/' | relative_url }}). Part of a private
personal-project repository.
