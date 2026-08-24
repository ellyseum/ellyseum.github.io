---
layout: portfolio-item
title: "RE9 Classic Horror"
subtitle: "Fixed-camera survival horror, rebuilt in Resident Evil Requiem on Capcom's RE Engine"
status: live
permalink: /portfolio/re9-classic-horror/
---

A conversion mod for *Resident Evil Requiem*, the newest mainline entry in Capcom's Resident
Evil series, built on Capcom's RE Engine. It reads and rewrites live state out of the running
game through the engine's own supported modding hooks — input handling, per-frame render and
motion-update entry points, and UI panel positioning — to reconstruct a fixed-camera,
tank-control classic-horror perspective, including the dual-projection camera math that makes
the fixed-camera view work.

Live inspection runs through a small file-based bridge: the game-side script polls a file for
a written code snippet, executes it, and writes the result to another file; a local sidecar
exposes that file exchange as an HTTP endpoint. That turns each probe into a live read against
the running process — seconds, instead of the usual edit/reset/reproduce/observe cycle a
change to a closed engine normally costs.

First commit 2026-05-15, 122 commits over ten days. Uses a community-standard, publicly
documented, permissively licensed modding framework, targets that framework's own supported
API, is single-player scope, and defeats no copy protection or anti-cheat — none is mentioned
anywhere in the project's own notes as present or bypassed.

Stated as still incomplete, not finished and unmentioned: no in-game menu entry point yet (a
config/launch-time toggle only — the native menu integration crashes on scene transitions);
gamepad trigger-editing has incomplete parity for non-sphere shapes; the interact-prompt
relocation fix degrades when its anchor falls outside the fixed camera's view frustum, since
frustum culling isn't built yet.

**Fan-work disclaimer.** *Resident Evil* and *Resident Evil Requiem* are the property of Capcom.
This is an unaffiliated, non-commercial fan project; it is not endorsed by or affiliated with
Capcom, and no game assets are distributed here.

Still to come: a before/after screenshot pair, moving video of the fixed-camera mode and the
live trigger editor, and the repository itself.
