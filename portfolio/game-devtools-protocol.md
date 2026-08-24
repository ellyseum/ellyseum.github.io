---
layout: portfolio-item
title: "The game itself"
subtitle: "Godot, and a devtools protocol for it"
status: live
permalink: /portfolio/game-devtools-protocol/
---

An HTTP server running inside a live Godot process, gated to debug builds only and bound to
localhost by default. Endpoints cover reading the live scene tree and game state, taking a
screenshot bundled with the state dictionary at that instant (removing an eval-then-screenshot
timing race), and driving it: `/eval` runs a real GDScript expression against the running
scene and returns real JSON, and `/input` synthesizes events through Godot's actual input
pipeline — InputMap, GUI input routing, viewport coordinate remapping — so a synthetic click
exercises the same path a human click does, not a faked callback.

An env var lets the bridge bind `0.0.0.0` instead of localhost specifically for WSL2, whose
NAT only forwards services bound that way through to the Windows host; another lets multiple
headless instances coexist on different ports.

First committed 2026-06-14. The project it drives (a from-scratch personal game) is a private
repository.
