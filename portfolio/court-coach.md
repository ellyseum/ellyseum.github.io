---
layout: portfolio-item
title: "Court Coach"
subtitle: "A basketball training app's first run, in a phone, on this page"
status: live
permalink: /portfolio/court-coach/
---

<style>
.vc-stage{position:relative;display:flex;justify-content:center;padding:1.75rem 0 1.25rem;margin:0 0 0.5rem;}
.vc-stage::before{content:"";position:absolute;inset:0;pointer-events:none;
  background:radial-gradient(closest-side,rgba(247,148,29,0.20),transparent 72%);}
.vc-phone{position:relative;width:min(392px,88vw);padding:11px;border-radius:56px;
  background:linear-gradient(150deg,#8e8e93 0%,#3a3a3c 16%,#1c1c1e 42%,#48484a 66%,#2c2c2e 84%,#8e8e93 100%);
  box-shadow:0 2px 0 rgba(255,255,255,0.22) inset,0 -2px 0 rgba(0,0,0,0.55) inset,
    0 28px 60px -18px rgba(0,0,0,0.85),0 0 0 1px rgba(0,0,0,0.6);}
.vc-screen{position:relative;aspect-ratio:390/844;border-radius:46px;overflow:hidden;background:#000;
  box-shadow:0 0 0 2px #050505,0 0 22px rgba(0,0,0,0.9) inset;}
.vc-screen iframe{width:100%;height:100%;border:0;display:block;}
.vc-island{position:absolute;top:11px;left:50%;transform:translateX(-50%);
  width:31%;height:26px;border-radius:14px;background:#000;pointer-events:none;z-index:2;
  box-shadow:0 0 0 1px rgba(255,255,255,0.05);}
.vc-island::after{content:"";position:absolute;right:9px;top:50%;transform:translateY(-50%);
  width:7px;height:7px;border-radius:50%;background:#0b1a24;box-shadow:0 0 3px rgba(90,160,200,0.5) inset;}
.vc-home{position:absolute;bottom:7px;left:50%;transform:translateX(-50%);
  width:36%;height:4px;border-radius:2px;background:rgba(255,255,255,0.45);pointer-events:none;z-index:2;}
.vc-btn{position:absolute;background:linear-gradient(180deg,#6e6e73,#2c2c2e);border-radius:2px;}
.vc-btn.l{left:-2px;width:3px;}
.vc-btn.r{right:-2px;width:3px;}
.vc-b1{top:104px;height:26px;}
.vc-b2{top:150px;height:46px;}
.vc-b3{top:208px;height:46px;}
.vc-b4{top:168px;height:70px;}
@media (max-width:420px){
  .vc-phone{border-radius:46px;padding:8px;}
  .vc-screen{border-radius:38px;}
  .vc-island{height:22px;top:9px;}
}
</style>

<div class="vc-stage">
  <div class="vc-phone">
    <span class="vc-btn l vc-b1"></span>
    <span class="vc-btn l vc-b2"></span>
    <span class="vc-btn l vc-b3"></span>
    <span class="vc-btn r vc-b4"></span>
    <div class="vc-screen">
      <iframe src="{{ '/portfolio/court-coach/demo/' | relative_url }}"
              loading="lazy" allow="autoplay; fullscreen; accelerometer" allowfullscreen
              title="Court Coach — the app's first-run experience, running live"></iframe>
      <span class="vc-island"></span>
      <span class="vc-home"></span>
    </div>
  </div>
</div>

<p class="pf-cap" style="text-align:center;">Live, not a recording. Drag the
basketball to spin it, then swipe through. Sound is on the ball.</p>

<p style="text-align:center;"><a class="pf-btn" href="{{ '/portfolio/court-coach/demo/' | relative_url }}">Open it full-page →</a></p>

The first run of **Court Coach**, an AI basketball training app built for iOS and Android. An
eight-slide onboarding wizard hands off into **thirty screens of the working product** — assessment
results, a drill library, progress charts, world leaderboards, an AI coach that answers you,
subscription, settings, support. Every screen here is the app's own code, running client-side in
your browser.

**The basketball is one quad.** No mesh, no model file, no three.js — a fragment shader
reconstructs the sphere per pixel (`z = sqrt(1 - d²)`), rotates the normal by a matrix, maps it
spherically into a basketball texture, then derives a **bump normal from that texture's own
luminance gradient** so the pebbling and the seams catch a fixed light. Diffuse, a specular
highlight, and a Fresnel rim, on a discarded-outside-the-disc quad with a smoothstepped edge.
The light stays put in the scene, so the shading changes as the ball moves across the screen.

Underneath it: a **120 fps physics loop** — gravity, bounce, drag-to-spin with velocity decay,
capped spin, and a hit test against the logo. On a real phone, device tilt steers the gravity
vector. Every bounce sound is **synthesized at the moment of impact** — a shell tone with
harmonics, a rim ring, a click transient and a convolution reverb built from a generated impulse,
all scaled by impact velocity. There are no audio files in this app.

<p class="pf-cap">Verified on the build published here: the WebGL buffer reads back <strong>76.5%
opaque, 81.2% basketball-orange, 53 distinct shading buckets</strong> across a luminance range of
0–150 — it is shaded, textured and lit, not a flat disc. Dragging it changes the rendered pixels.
All 8 wizard slides, all 29 routes and 67 controls were exercised: zero console errors, zero failed
requests, and <strong>zero external network requests</strong> — the demo is entirely self-contained.</p>

**Why it runs with no backend.** It never had one. This is a demo build: thirty screens of
convincing product with the data written in, made to be handed to executives who needed to see the
thing rather than a deck. That is also why it hosts here as plain files — nothing to stub, nothing
disabled, no capability quietly missing. The routing is the one change: hash routing, so a reload
inside a static page lands where you were.

<small>The 30 first-run screens and the WebGL basketball are my work inside a larger team
codebase. The surrounding platform — API, database, infrastructure — is the team's and is not
shown here. The name and mark shown here are placeholders standing in for the client's own
branding, which is not shown.</small>

Same shape as the rest of this shelf: a **system** with a human judgment gate on top of it, not a
one-off screen. Neighbours worth a look — [the audio DAW]({{ '/portfolio/audio-daw/' | relative_url }})
and [the VFX audition gallery]({{ '/portfolio/vfx-auditioner/' | relative_url }}).
