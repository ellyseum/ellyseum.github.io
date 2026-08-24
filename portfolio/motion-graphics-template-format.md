---
layout: portfolio-item
title: "A motion-graphics template format, authored by hand"
subtitle: "Cloud rendering measured against an export-based baseline"
status: live
permalink: /portfolio/motion-graphics-template-format/
---

A library that authors motion-graphics template controllers **byte-identically to the
originating desktop authoring tool itself**, with no instance of that tool and no scripting
runtime required at authoring time — a pure function: no network, no filesystem, no clock, no
randomness. The caller decides where the source bytes come from and where the output bytes go.

<small>Deterministic (same source and plan always produce the same output bytes, backed by a
dedicated test) and content-addressed per template rather than per export: a real corpus check
confirmed one template, a re-packed copy, and a re-authored copy with one control added via the
real desktop tool all resolve to the same content identity, while an unrelated template
resolves to a different one. It batches — one call authors every requested output from a single
parsed source, and a plan that fails partway throws before anything is written, never a partial
output. Stated scope limit, not a settled design choice: footage is bound by reference rather
than embedded; collecting and embedding footage is on the roadmap, not yet built.</small>

Enterprise platform work; the underlying repository, the platform, and the organization it was
built for are not named here.
