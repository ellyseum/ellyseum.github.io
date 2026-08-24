---
layout: portfolio-item
title: "Pipeline nodes in-product, and a headless authoring plane"
subtitle: "Custom local-ML nodes plus a headless workflow API"
status: live
permalink: /portfolio/pipeline-nodes-headless-authoring/
---

Custom local-ML pipeline nodes for a visual workflow-builder platform, plus a headless
authoring and execution plane for the same platform: one published workflow serves unlimited
variants through runtime parameter overrides, instead of re-authoring a workflow per variant.

One shipped node is versioned v1.2.2 and in production use today. The headless plane's schema-
drift gate — a CI check comparing a published workflow's expected parameters against the
platform's live schema — caught a real, unannounced parameter rename on the platform side
before it could break anything downstream.

Enterprise platform work; the underlying repository, the platform, and the organization it was
built for are not named here.
