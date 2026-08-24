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

Inter-session control lands in commit `7e11b02`, 2026-02-14T10:15:51Z UTC (2026-02-14
05:15:51 -05:00 local), whose commit body reads "MCP server: 6 tools for inter-Claude session
control." First-party equivalent — cross-session `SendMessage` with `ListAgents` discovery —
shipped in Claude Code 2.1.224, 2026-08-07 (Windows support 2.1.239, 2026-08-21). Roughly six
months apart. The repository's first commit is two days earlier, 2026-02-12, and does not yet
contain this capability.

The reverse also happened, on a different feature: claudio's own daemon mode was added
2026-02-15, about two months after Claude Code's first-party background-agent support shipped
(2.0.60, 2025-12-05). Both are stated here because they answer the same question about
timing honestly in both directions — one feature arrived first here, the other arrived first
on the platform, and neither claims precedence over the other's whole capability set.

18 commits, 2026-02-12 through 2026-04-18. Public repo.
