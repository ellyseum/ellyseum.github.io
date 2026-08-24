---
layout: portfolio-item
title: "The SFX take composer"
subtitle: "167 reference cues, an effects rack, and a WAV render that downloads from the browser"
status: live
permalink: /portfolio/sfx-composer/
---

Where a cue's sound gets decided: **pick a cue, A/B a generated take against the reference,
shape it through an effects rack, render the keeper to a WAV** — live in this page. The keeper
takes chosen here are how the game gets its sound: generation supplies the candidates, and a
human ear makes the call.

<iframe src="{{ '/portfolio/sfx-composer/demo/' | relative_url }}"
        style="width:100%;aspect-ratio:16/10;min-height:560px;border:1px solid var(--surface, #333);border-radius:0.5rem;"
        loading="lazy" title="SFX take composer — 167 reference cues, an effects rack, and offline WAV rendering">
</iframe>

<p><a href="{{ '/portfolio/sfx-composer/demo/' | relative_url }}">Run it full-page →</a></p>

Two generated takes of one cue, exactly as the tool auditions them:

<div style="display:grid;gap:0.6rem;margin:0.5rem 0 1.25rem;">
  <div>
    <audio controls preload="none" src="{{ '/portfolio/sfx-composer/demo/sfx-raw/x0043%20Menu%20Confirmation%20Yes%20(take1).mp3' | relative_url }}" style="width:100%;" title="Menu Confirmation Yes — take 1"></audio>
    <small><strong>Menu Confirmation Yes — take 1</strong></small>
  </div>
  <div>
    <audio controls preload="none" src="{{ '/portfolio/sfx-composer/demo/sfx-raw/x0043%20Menu%20Confirmation%20Yes%20(take2).mp3' | relative_url }}" style="width:100%;" title="Menu Confirmation Yes — take 2"></audio>
    <small><strong>Menu Confirmation Yes — take 2</strong> — A/B either against the reference inside the tool.</small>
  </div>
</div>

The rack is the working surface — trim, speed, fades, pitch shift, low and high EQ shelves,
reverb decay and wet, output gain — **every slider persisted per cue**, so a cue reopens where
its shaping left off. Render & Download is not a recording of the preview: it **re-synthesizes
the chain offline** (Tone.js offline synthesis plus a client-side WAV encoder) and the file that
lands is named for its cue. Two of the 167 cues carry alternate takes — two each, though one
cue's source list shows three entries because its first take ships in both MP3 and WAV.

<small>One route is server work: the live tool saves a rendered take back into the workspace;
here that save is a browser download of the same bytes. The reference cues originate from
*Final Fantasy Tactics* and ship under a stated fan-work disclaimer: they are the targets an
unaffiliated, non-commercial recreation project was built to match, and the tool, its synthesis
code, and all generated takes are original work.</small>

The loop-authoring half of the pipeline:
[the audio DAW]({{ '/portfolio/audio-daw/' | relative_url }}). The synthesis layer it auditions
against: [the instruments]({{ '/portfolio/sfx-vfx-instruments/' | relative_url }}). Part of a
private personal-project repository.
