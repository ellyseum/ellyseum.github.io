---
layout: portfolio-item
title: "Live Engine Introspection"
subtitle: "Reading and rewriting state in a closed AAA engine through its own supported hooks, proven on Resident Evil Requiem"
status: live
permalink: /portfolio/re9-classic-horror/
---

A conversion mod for *Resident Evil Requiem* that turns the newest mainline Resident Evil back
into a **fixed-camera, tank-control classic-horror game** — engine introspection in service of
one creative outcome: a whole other way the game feels to play. Live, against the shipping RE
Engine, through Capcom's own supported modding hooks: input handling, per-frame render and
motion-update entry points, UI panel positioning, and **the dual-projection camera math that
makes the fixed-camera view work**.

The craft trick underneath: a small file-based bridge — the game-side script polls a file for a
code snippet, executes it, writes the result back; a local sidecar exposes that as HTTP. Every
probe becomes **a live read against the running game in seconds**, instead of the
edit/reset/reproduce/observe cycle a closed engine normally costs.

<small>First commit 2026-05-15, 122 commits over ten days. Built on a community-standard,
publicly documented, permissively licensed modding framework, targeting that framework's own
supported API; single-player scope; defeats no copy protection or anti-cheat — none is
mentioned anywhere in the project's own notes as present or bypassed. Stated as still
incomplete: no in-game menu entry point yet (a config/launch-time toggle only — the native menu
integration crashes on scene transitions); gamepad trigger-editing has incomplete parity for
non-sphere shapes; the interact-prompt relocation fix degrades when its anchor falls outside
the fixed camera's view frustum, since frustum culling isn't built yet.</small>

**Fan-work disclaimer.** *Resident Evil* and *Resident Evil Requiem* are the property of Capcom.
This is an unaffiliated, non-commercial fan project; it is not endorsed by or affiliated with
Capcom, and no game assets are distributed here.

Still to come: a before/after screenshot pair, moving video of the fixed-camera mode and the
live trigger editor, and the repository itself.
