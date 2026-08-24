---
layout: portfolio-item
title: "Governed agentic delivery, on stock tooling"
subtitle: "A provenance-linked, review-gated delivery process built from GitHub primitives"
status: live
permalink: /portfolio/agentic-delivery-governance/
---

The governance layer of a production delivery process, built entirely from stock GitHub
features rather than a bespoke tool: provenance traceable end-to-end from a work item through
the code that resolved it, blind multi-model review panels, and mutation-proven test guards —
apply the exact regression, confirm the guard catches it, then restore, rather than trust that
a test is load-bearing by inspection.

The access-control property is enforced by pipeline topology, not policy: a six-environment
deployment architecture with environment-scoped credentials means unreviewed code cannot
structurally reach a production credential. A CI claims-guard rebuilds every figure the
project's own documentation quotes from committed JSON, so the docs can't drift from what the
data actually says.

Git-log-verified authorship split on this specific layer: 37:3 on agent-configuration commits
and 42:1 on CI-workflow commits in one production repository, against a collaborator who
authored the majority of feature commits and adopted this governance standard rather than the
reverse. Presented to the wider organization at a manager's request.

Enterprise platform work; the organization and specific repository are not named here.
