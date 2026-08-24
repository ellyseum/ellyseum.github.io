---
layout: portfolio-item
title: "This site's own architecture"
subtitle: "A platform that costs nothing to run"
status: live
repo: "ellyseum/ellyseum.github.io"
permalink: /portfolio/zero-cost-platform/
---

**You are looking at the thing this page describes.**

This site, as a portfolio piece: a Jekyll blog template with a WebGL background, an **LLM RAG
chat agent that runs in the browser via WebGPU** with no API key and no server, a Cloudflare
Worker proxying Groq's free tier as a fallback for devices without WebGPU, and a hidden
in-browser editor — reachable through a Konami-code terminal — that authenticates with a GitHub
personal access token, commits directly through the GitHub Contents API, and (in the default
single-repository setup) retriggers the site's own redeploy on that commit. All of it served on
GitHub Pages, at **no hosting cost**.
