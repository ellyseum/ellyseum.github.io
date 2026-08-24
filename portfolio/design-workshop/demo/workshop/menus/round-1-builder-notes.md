# Round 1 — the builder's distillation (slow_burn title-flow clip)

Critique: critique-1.md (qwen, the gamedev charter). Clip: 75s, full path title->menu->
commit->saves->naming. My strip read + the critique, cross-calibrated:

## ACCEPTED (round-2 actions)
1. HELD-STATE too dead at this exposure (critic: "static, inert"; the drift + shaft read
   as nothing at 360p): ember interrupt cadence 26s -> 14s, embers 2px -> 4px x5, smoulder
   prompt amplitude up. The drift itself may need +30% speed as an audition knob.
2. THE SLOW BURN's grade is too subtle (critic: "dark purple, not parchment" - the
   treatment SPECIFICALLY exists to bring the burnt-parchment character and it does not
   read): vignette 0.55 -> 0.75, tint warmer, consider the accepted parchment backdrop
   behind the menu panel itself.
3. DRIVE: attract hold 28 -> 14 sim s (the dead air is partly my script, not the game);
   name the vessel (type + ENTER) so the scrawl lands on film.

## REJECTED (critic noise, filtered)
- "add a shovel icon / progress bar" - loading-screen framing, wrong genre read.
- "ELLYSEUM vermillion stamp" - hallucinated branding.
- "replace PRESS ANY KEY with ENTER TO CONTINUE" - no.
- "cut the title to 2 seconds" - window-myopia: it judged an 8s SLICE as the screen's
  whole lifetime.

## CHARTER FIXES (critic.py v2)
- Feed the chapter map + state that each window is a SLICE of a longer flow.
- Clarify the style split: the WORLD is the dusk vista; the LEDGER register is the UI
  layer riding it. Judge the UI against the ledger, the world against mood.

---

# Round 2 — the critic's ceiling, measured (2026-07-26)

critique-2.md ran clean (no OOM) on the improved slow_burn clip, WITH the v2 charter
(slice context + world-vs-ledger split). Verdict on the CRITIC, not the clip:

**The charter fixes did not take.** It repeated "cut the title to 3 seconds" — the exact
window-myopia the context clause was written to prevent — then degenerated into echolalia:
the same three sentences ("the screen is not a beat — it's a placeholder", "add a 1-second
countdown") pasted verbatim across PACING, CLARITY, JUICE, COHERENCE, and STYLE SPLIT. It
also copied the charter's own words back as analysis ("the 3D dusk vista is a mood — it's a
visual metaphor"). Zero new observations vs round 1; nothing about the changes I made
(embers, grade, naming) — which is the one thing a round-2 pass exists to judge.

**The measurement:** a 4-bit 8B VLM at 8s/3fps windows is a competent DESCRIBER (round 1's
motion logs were genuinely useful) and a poor JUDGE of design intent. It cannot hold a
75-second flow in mind, so every window becomes "this screen is too long."

**The correction — comparative, not absolute** (the doctrine the bible already states for
this exact failure mode): stop asking "grade this screen." Ask "here are two takes of the
SAME beat; which is better and why." That is the prompt shape a VLM answers reliably, it
matches the A/B pairs the audition lane already produces, and it needs no long-horizon
memory. The five-treatment set is exactly the material for it.

**Interim:** my own strip reads carry the design judgment (they caught the dead attract,
the invisible grade, the selection bug, and the flat save-select — all confirmed on film);
the critic's role narrows to comparative A/B until the pairwise harness is built.

---

# The comparative pass — the correction WORKS, with a measured caveat (2026-07-26)

`tools/menus/compare.py --tournament --beat title`: 10 pairs, **10/10 decisive calls, zero
no-calls, zero echolalia** — against absolute grading's zero usable output on the same set.
Same model, same clips, same GPU: the failure was the QUESTION SHAPE, not the model.

Sample reasoning (verbatim): "The light beam's motion feels more alive and directional in
LEFT... RIGHT's brighter soil clashes"; "the vermillion stamp's glow subtly pulses,
committing the screen to the next phase". Comparative, specific, visually grounded — and
the LOSER'S ONE FIX field produced actionable inversions ("make the beam static and sharply
cut off, killing its atmospheric bleed").

**Tally (title beat):** casino_fanfare 3, archive 2, cold_ledger 2, slow_burn 2,
stamp_strike 1.

**The caveat, stated honestly:** the tally is NOT a ranking to act on. At the title beat the
five treatments differ mostly in grade wash and attract interrupt, so the model latched onto
LIGHT-BEAM and SOIL CONTRAST — the shaft and the vista, which are largely shared — rather
than the reveal choreography that actually distinguishes them. Two pairs also read as
near-inversions of each other, the signature of a coin-flip on a small visible delta.

**What that means for the loop:** comparative A/B is the right instrument and it is now
BUILT and PROVEN; its verdicts are trustworthy where the visible delta is LARGE (a confirm
gesture, a menu-in stagger) and noise where the delta is small (a grade tint at 360p). Run
it on the `confirm` and `menu` beats — where the treatments genuinely diverge — and treat
title-beat verdicts as tie-noise. Human eyes still own the final pick; the instrument
narrows the field and supplies the WHY language.

---

# The swap control's verdict on the CRITIC: 10/10 position flips (2026-07-26)

`compare.py --tournament --beat confirm` with both orderings judged:

**AGREED: 0 of 10 pairs. Position-flips: 10 of 10.** In every single pair the model chose
whichever clip sat on the LEFT — both times. The confident, specific-sounding prose
("sharper contrast", "more deliberate commitment", "the RIGHT feels sterile") was generated
*around* a choice already made by position.

That also retroactively condemns the title-beat tally (casino 3 / archive 2 / cold 2 /
burn 2 / stamp 1): it was mixed L/R only because a couple of passes broke the pattern, not
because the model saw anything. **Both tallies are void.** No treatment has been ranked by
the critic. The five clips remain unranked except by the builder's own eyes.

## What this measures (and what it does NOT)

- It does NOT mean qwen3-VL is useless: its DESCRIPTIVE narration in round 1 was accurate and
  useful (it correctly logged motion, contrast, and specific on-screen text).
- It DOES mean this model cannot make a preference judgment between two similar takes of a
  480p pixel-art game screen. Presented with a forced choice it answers positionally and
  then rationalizes fluently — the most dangerous failure shape, because the output reads
  like judgment.
- The three-strike record on this instrument today: absolute grading -> echolalia;
  comparative grading -> position bias; only DESCRIPTION survived scrutiny.

## The doctrine this earns (proposed for the bible)

**A local VLM in this loop is an INSTRUMENT OF DESCRIPTION, not of judgment.** Use it to
answer "what is on screen, what moved, what changed between these two takes" — questions with
a verifiable ground truth in the frames. Do not ask it "which is better"; that answer is
positional noise wearing critic vocabulary. The critic's chair in the builder<->critic loop
belongs to a model that can actually hold and weigh design intent (Fable/Opus reading frames
and clips), with the VLM feeding it accurate descriptions of what is there.

**The harness keeps its value**: side-by-side pair building, beat anchoring, verification
frames, GPU gating, and the swap control are all reusable — and the swap control is precisely
what turned a plausible ranking into a measured refutation. Keep it armed on any future
preference question, from any model.

---

# The two-stage judge: PARTIAL SUCCESS, measured (2026-07-26)

Her architecture — the VLM produces a factual "what is", a text LLM judges "which is
better" from the descriptions — run as judge.py stage 3 (qwen3.6:27b, blind A/B, both
orderings, agreement-only), through the GPU lease.

**Score: 3/10 pairs agreed across both orderings — the first swap-surviving verdicts any
instrument has produced** (the VLM's direct pixel comparison: 0/10). Survivors:
stamp_strike > archive, stamp_strike > slow_burn, cold_ledger > casino_fanfare. The other
7 flipped with position (slot A won) and are discarded as noise by construction.

**Where it worked is the finding:** the agreements sit exactly on the pairs stage 2 showed
discriminating hardest — a rich motion narrative (stamp's cursor walk + crack/shatter)
against a near-static description; a clean fade-then-cut story against "TRANSITION: None."
Model of the judge: POSITION BIAS IS ITS FALLBACK when the described facts don't separate;
strongly-separated facts override position. The chain works to the degree stage 1 grips.

**Standing confound:** casino lost partly because the VLM MISSED its coin fountain (the
stage-2 caveat) — the judge ranks DESCRIPTIONS, and a description under-sells a treatment
whose signature the VLM can't see. Upgrades that follow: multi-pass/richer describes;
a second judge family (deepseek-r1:14b) over surviving pairs only; thinking-mode budget
(~5 min/call — 20 calls ≈ 1h45 measured).

**Instrument ladder, final state:** absolute VLM grading (echolalia, 0 usable) <
pixel-comparative VLM (0/10, pure position) < describe-then-judge (3/10 real verdicts,
noise self-identifying) < the builder's eyes + her taste (the gate that stays).
