---
layout: portfolio-item
title: "ellymud"
subtitle: "A headless-testable MUD, built as a testbed for agent play"
status: live
repo: "ellyseum/ellymud"
permalink: /portfolio/ellymud/
---

A TypeScript MUD (Telnet and WebSocket, with a React admin panel) built as a research question:
**can an LLM build a MUD, and can other LLMs play it**. First commit 2025-03-17; 440 commits
over roughly 13.5 months; public, dual-licensed AGPL-3.0 with a separate commercial license.

The answer's machinery is an MCP server (`src/mcp/mcpServer.ts`, 2,400+ lines) whose
`virtual_session_*` tools ride **the same `VirtualConnection` abstraction real Telnet and
WebSocket clients use** — not a mocked API standing in for the game — plus deterministic-testing
tools (snapshot load/save, tick control, stat/NPC injection) so an agent can drive and inspect
a session the same way a human plays it. Test suite: **3,573 test cases across 167 files**
(grep-counted directly against the repo), a sampled file checked for substantive assertions
rather than tautological ones.
