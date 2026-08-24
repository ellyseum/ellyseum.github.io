---
layout: portfolio-item
title: "The audio DAW"
subtitle: "Cue bank, waveform cutting and loop authoring, served as plain files"
status: live
permalink: /portfolio/audio-daw/
---

The audio tool from *For What Lies Beneath*, live in this page with no server behind it —
**167 synthesized cues, 7 music tracks, waveform cutting, loop authoring**. This system is why
the game's music can loop seamlessly in-engine: it authors the exact loop data Godot reads.

<div class="pf-frame">
<iframe src="{{ '/portfolio/audio-daw/demo/' | relative_url }}"
        style="width:100%;aspect-ratio:16/10;min-height:560px;border:0;display:block;"
        loading="lazy" allow="fullscreen; autoplay" allowfullscreen title="Audio DAW — 167 SFX cues, 7 music tracks, loop authoring and WAV export">
</iframe>
</div>

<p><a class="pf-btn" href="{{ '/portfolio/audio-daw/demo/' | relative_url }}">Run it full-page →</a></p>

Two of the game's tracks, straight off the shelf the tool serves:

<div style="display:grid;gap:0.6rem;margin:0.5rem 0 1.25rem;">
  <div>
    <audio controls preload="none" src="{{ '/portfolio/audio-daw/demo/music/town_sadness.mp3' | relative_url }}" style="width:100%;" title="town_sadness"></audio>
    <small><strong>town_sadness</strong> — its loop version sits on the same shelf with loop points written into its OGG comments; load it in the tool and drag them.</small>
  </div>
  <div>
    <audio controls preload="none" src="{{ '/portfolio/audio-daw/demo/music/come%20and%20sit.mp3' | relative_url }}" style="width:100%;" title="come and sit"></audio>
    <small><strong>come and sit</strong> — another of the 7 tracks the arrangement mode works over.</small>
  </div>
</div>

**Try the round trip:** load a track, drag its loop points, snap them to zero crossings, bake a
crossfade, export — the WAV that downloads carries the loop points in its `smpl` chunk, which is
the chunk Godot actually reads (it ignores OGG loop tags, so this tool authors both, with a WAV
encoder written to emit `smpl`). Dragging any audio file from your desktop onto the window loads
it, decoded in the browser.

<small>Three routes are server work — OGG export, keeper flags, path import — and each control
says so on hover rather than failing. The SFX bank's reference cues originate from *Final Fantasy
Tactics* and ship under a stated fan-work disclaimer: they are the targets an unaffiliated,
non-commercial recreation project was built to match, and the tool, its synthesis code, and all
generated takes are original work.</small>

The synthesis layer and override chain behind it:
[the instruments]({{ '/portfolio/sfx-vfx-instruments/' | relative_url }}). Part of a private
personal-project repository.
