---
layout: portfolio-item
title: "The SFX take composer"
subtitle: "167 reference cues, an effects rack, and a WAV render that downloads from the browser"
status: live
permalink: /portfolio/sfx-composer/
---

The take-audition half of the SFX pipeline from *For What Lies Beneath*. The
[audio DAW]({{ '/portfolio/audio-daw/' | relative_url }}) authors loops; this tool decides what a
cue should sound like in the first place: pick one of 167 reference cues, A/B it against a
generated take, shape the result through an effects rack, and render the keeper to a WAV.

The rack is the working surface: trim start and end, playback speed, fade in and out, a pitch
shift, low and high EQ shelves, reverb decay and wet, and output gain — every slider persisted
per cue, so returning to a cue restores where its shaping left off. The render is not a
recording of the preview: it re-synthesizes the chain offline and encodes the WAV itself.

**What a reviewer can do here.** Walk the cue bank, play any reference cue, and switch sources
on the two cues that carry alternate takes — two takes each, though one cue's source list shows
three entries because its first take ships in both MP3 and WAV. Move the rack's
sliders, preview the shaped result, A/B it against the original at any point, and hit Render &
Download: the file that lands is the offline render, named for its cue.

**What this build does differently.** One route is server work: the live tool saves a rendered
take back into the workspace, and here that save is a browser download of the same bytes —
the render itself (Tone.js offline synthesis plus the client-side WAV encoder) is unchanged.
The reference cues originate from *Final Fantasy Tactics* and ship under a stated fan-work
disclaimer: they are the targets an unaffiliated, non-commercial recreation project was built
to match, and the tool, its synthesis code, and all generated takes are original work.

<p><a href="{{ '/portfolio/sfx-composer/demo/' | relative_url }}">Run it →</a></p>

<iframe src="{{ '/portfolio/sfx-composer/demo/' | relative_url }}"
        style="width:100%;aspect-ratio:16/10;min-height:560px;border:1px solid var(--surface, #333);border-radius:0.5rem;"
        loading="lazy" title="SFX take composer — 167 reference cues, an effects rack, and offline WAV rendering">
</iframe>

The synthesis layer this tool auditions against is described on
[the instruments]({{ '/portfolio/sfx-vfx-instruments/' | relative_url }}). Part of a private
personal-project repository.
