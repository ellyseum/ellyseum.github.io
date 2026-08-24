---
layout: portfolio-item
title: "claudio"
subtitle: "Supervision and messaging between sessions"
status: live
repo: "ellyseum/claudio"
permalink: /portfolio/claudio/
---

A PTY wrapper around Claude Code sessions, adding session-to-session messaging and
supervision, hooks, profiles, plugin management, and identity-filtered memory across sessions
it supervises.

Session-to-session messaging: first committed `dc349b3`, 2026-02-13T01:00:05Z UTC
(2026-02-12 20:00:05 local). First-party equivalent — cross-session `SendMessage` with
`ListAgents` discovery — shipped in Claude Code 2.1.224, 2026-08-07 (Windows support
2.1.239, 2026-08-21). Roughly six months apart.

The reverse also happened, on a different feature: claudio's own daemon mode was added
2026-02-15, about two months after Claude Code's first-party background-agent support shipped
(2.0.60, 2025-12-05). Both are stated here because they answer the same question about
timing honestly in both directions — one feature arrived first here, the other arrived first
on the platform, and neither claims precedence over the other's whole capability set.

18 commits, 2026-02-12 through 2026-04-18. Public repo.
