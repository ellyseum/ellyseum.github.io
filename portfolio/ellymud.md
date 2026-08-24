---
layout: portfolio-item
title: "ellymud"
subtitle: "A headless-testable MUD, built as a testbed for agent play"
status: live
repo: "ellyseum/ellymud"
permalink: /portfolio/ellymud/
---

A TypeScript MUD (Telnet and WebSocket, with a React admin panel) built as a research
question: can an LLM build a MUD, and can other LLMs play it. First commit 2025-03-17;
440 commits over roughly 13.5 months; public, dual-licensed AGPL-3.0 with a separate
commercial license.

The part built specifically to answer that question is an MCP server (`src/mcp/mcpServer.ts`,
2,400+ lines) exposing `virtual_session_create` / `command` / `info` / `close` / `list` tools
backed by the same `VirtualConnection` abstraction real Telnet and WebSocket clients use — not
a mocked API standing in for the game. Alongside it: deterministic-testing tools for snapshot
load/save, tick control, and stat/NPC injection, so a game session can be driven and inspected
headlessly by an agent the same way a human plays it over Telnet.

The test suite: 3,573 test cases across 167 files (grep-counted directly against the repo), a
sampled file checked for substantive assertions rather than tautological ones.
