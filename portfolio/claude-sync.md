---
layout: portfolio-item
title: "claude-sync"
subtitle: "A multi-location convergence engine for coding-agent state"
status: live
permalink: /portfolio/claude-sync/
---

A generic multi-location convergence engine: keeps directories converged across machines
through a self-hosted git remote, with no special knowledge of any one directory. A local
Claude Code configuration is the motivating case, not the only supported one.

Confidentiality is a `.gitignore` boundary, not a cryptographic one, and the project states
that distinction about itself directly: confidentiality "must not depend on a third party's
account, billing, or policy state," and the ignore file "is the confidentiality boundary the
whole location depends on." Every network operation in the code path is a `git` subprocess
call against whatever remote a location configures — a grep across the source for outbound
HTTP calls returns exactly one hit, a static string with no network effect. Tailscale is a
documented reference transport, not a dependency.

First commit 2026-08-05, 36 commits as of this writing. Local project; not yet pushed to a
public remote.
