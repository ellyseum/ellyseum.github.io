# ellyseum.me Plugin Architecture Plan

> Decided 2026-02-25. Ship the blog as a modular plugin system instead of a monolith.

## Core Concept

Ship the blog as a minimal Jekyll template (core) with everything else as plugins. The existing 13 code-split bundles already map to plugin boundaries. Separate content folder stays as-is.

## Core Template

- Jekyll blog with light and dark mode
- No AI features, no WebGL, no terminal
- Separate content repo pattern (private content repo + GitHub API)
- Ships as a usable blog on its own

## Plugin Types

### Theme Plugins (template + WebGL code)
- **webgl-galaxy** — cosmic simplex noise background, star fields, diffraction spikes
- **webgl-classic-dark** — non-WebGL dark theme fallback
- **webgl-classic-white** — non-WebGL light theme fallback

### Feature Plugins (standalone)
- **ai-chat** — two-tier zero-dollar AI (WebGPU in-browser LLM + Groq free tier), RAG pipeline
- **konami-code** — Konami code detector, backtick toggle after first unlock

### Terminal Plugins (require konami-code)
- **terminal** — xterm.js shell with line editing, command history, ANSI escape sequences (requires: konami-code)
- **snake** — Snake game in xterm canvas (requires: terminal)
- **matrix** — Matrix rain screensaver (requires: terminal)

### Editor Plugins (require terminal)
- **auth-editor** — `auth <github_pat>` command, CodeMirror editor, diff viewer, publish pipeline (requires: terminal)
- **ai-editor** — AI rewrite panel for editor via Groq (requires: auth-editor)

## Dependency Tree

```
core (Jekyll template)
├── webgl-galaxy (theme)
├── webgl-classic-dark (theme)
├── webgl-classic-white (theme)
├── ai-chat (standalone)
├── konami-code (standalone)
│   └── terminal (requires konami-code)
│       ├── snake (requires terminal)
│       ├── matrix (requires terminal)
│       └── auth-editor (requires terminal)
│           └── ai-editor (requires auth-editor)
```

## Open Design Questions

- Plugin API: how does a theme plugin hook into the render loop?
- Terminal command registration: how do child plugins (snake, matrix, auth) register commands?
- Plugin manifest format (reuse Claudio/Claude Code plugin.json pattern?)
- Distribution: npm packages? git submodules? Vite plugin system?
- How to handle the flying icons, FPS monitor, typewriter, search, view transitions — are these core or plugins?

## Why This Matters

- Makes the code shippable publicly — people can use pieces without the whole thing
- Better portfolio story: "plugin ecosystem" > "blog source code"
- More manageable development — each plugin is independent
- Same code, restructured along the boundaries that already exist in the lazy-loading architecture
