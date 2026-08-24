---
layout: portfolio-item
title: "claudio"
subtitle: "Supervision and messaging between sessions"
status: live
repo: "ellyseum/claudio"
permalink: /portfolio/claudio/
---

A PTY wrapper around Claude Code sessions: session-to-session messaging and supervision, hooks,
profiles, plugin management, and identity-filtered memory across the sessions it supervises.
18 commits, 2026-02-12 through 2026-04-18. Public repo.

<small>Timing, stated honestly in both directions: inter-session control lands in commit
`7e11b02`, 2026-02-14T10:15:51Z UTC (2026-02-14 05:15:51 -05:00 local), whose commit body reads
"MCP server: 6 tools for inter-Claude session control" — the first-party equivalent
(cross-session `SendMessage` with `ListAgents` discovery) shipped in Claude Code 2.1.224,
2026-08-07 (Windows support 2.1.239, 2026-08-21), roughly six months later. The reverse also
happened: claudio's own daemon mode was added 2026-02-15, about two months after Claude Code's
first-party background-agent support (2.0.60, 2025-12-05). One feature arrived first here, the
other arrived first on the platform; neither claims precedence over the other's whole
capability set. The repository's first commit, 2026-02-12, does not yet contain the messaging
capability.</small>
