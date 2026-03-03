# Architecture

Deep technical documentation for the Ellyseum blog template.

---

## Plugin System

The plugin system is the core architectural pattern. Everything beyond the base blog (theme manager, search, sticky nav, code copy, back-to-top) is a plugin.

### PluginManager Lifecycle

`src/core/plugin-manager.ts` (309 lines) orchestrates all plugin loading:

1. **Module resolution** - All plugin loaders execute in parallel via `Promise.allSettled`. Failed imports are logged but don't block other plugins.
2. **Strategy grouping** - Resolved plugins are sorted into eager, idle, and lazy buckets.
3. **Eager init** - Topologically sorted, then initialized sequentially. Blocks the main thread until complete.
4. **Idle init** - Topologically sorted, then initialized inside `requestIdleCallback` (falls back to `setTimeout(200)` if unavailable).
5. **Lazy trigger setup** - Each lazy plugin's trigger is registered but not initialized.

### Load Strategies

| Strategy | When | Use For |
|----------|------|---------|
| **eager** | Immediately on page load | Core experience (SPA router, WebGL background) |
| **idle** | `requestIdleCallback` | Non-critical features (theme command, games, CMS setup) |
| **lazy** | On-demand via trigger | Heavy features loaded only when needed (terminal, AI chat) |

### Trigger Types (Lazy Plugins)

| Type | Activation | Example |
|------|-----------|---------|
| `konami` | Konami code sequence detected | Terminal |
| `hover` | User hovers over a CSS selector target | - |
| `auth` | `auth:success` event emitted on the EventBus | - |
| `theme` | Current theme matches `trigger.target` | - |
| `custom` | Arbitrary async condition via `when: () => Promise<void>` | Terminal (backtick/URL param), AI chat (mobile/hover) |

When a lazy plugin loads, the PluginManager also checks for other unloaded lazy plugins that depend on it and share the same trigger type, initializing them automatically.

### Dependency Resolution

Dependencies are declared as `dependencies: string[]` on the plugin definition. The PluginManager uses **Kahn's topological sort** to determine init order:

1. Build an in-degree map from dependency declarations
2. Start with plugins that have zero in-degree (no dependencies)
3. Process the queue, decrementing dependents' in-degree as each plugin completes
4. If the sorted result is shorter than the input, a circular dependency exists - log a warning and append the remaining plugins in insertion order

During `initPlugin()`, if a dependency hasn't loaded yet, it's initialized recursively before the dependent plugin.

### PluginContext

Each plugin receives a `PluginContext` object providing access to core services:

```typescript
interface PluginContext {
  theme: { current: ThemeId; isClassic: boolean }  // Live theme state
  onThemeChange(cb): () => void     // Subscribe to theme changes
  onFrame(cb): () => void           // Register rAF callback
  injectCSS(css): () => void        // Add scoped <style> to <head>
  emit(event, data?): void          // Publish to EventBus
  on(event, cb): () => void         // Subscribe to EventBus
  log(...args): void                // Namespaced console.log ("[plugin-name]")
  provide(key, value): void         // Register a service
  consume<T>(key): T | undefined    // Look up a service
  registerCommand(name, cmd): void  // Register a terminal command
}
```

All subscription methods return an unsubscribe function. CSS injection returns a removal function. Services are stored in a shared `Map<string, unknown>`.

### EventBus

`src/core/event-bus.ts` (23 lines) - Simple pub/sub with error boundaries around each handler.

Standard events:

| Event | Emitted By | Data |
|-------|-----------|------|
| `navigate` | spa-router | None |
| `pointer` | webgl-galaxy | `{ x, y, nx, ny }` |
| `potato-mode` | galaxy-extras | `{ enabled: boolean }` |
| `auth:success` | github-cms | None |
| `command:registered` | PluginManager | `{ name, command }` |

### Service Registry

Plugins expose capabilities to other plugins via `provide(key, value)` / `consume<T>(key)`:

| Key | Provider | Consumers |
|-----|----------|-----------|
| `canvas` | webgl-galaxy | galaxy-extras |
| `background` | webgl-galaxy | galaxy-extras |
| `terminal` | konami-terminal | terminal-games, terminal-theme, github-cms |
| `themeManager` | PluginManager (core) | terminal-theme |
| `pendingCommands` | PluginManager (core) | konami-terminal |

---

## Progressive Disclosure

Four discovery layers, each a code-split boundary:

### Layer 0 - DevTools Console (0 KB)

ASCII art logo + hint message printed via `console.log()` in `main.ts`. The message reads "What a CONTRArian" - CONTRA is the game where the Konami code originated. Cost: a string literal in the main bundle.

### Layer 1 - Konami Code (lazy, ~339 KB)

Enter `Up Up Down Down Left Right Left Right B A` anywhere on the site. The `konami-terminal` plugin loads xterm.js, creates a full terminal shell with line editing, command history, and ANSI escape sequence rendering. After first unlock, backtick (`` ` ``) becomes a quick-toggle (persisted in `sessionStorage`). Also accepts `?terminal` URL parameter for testing.

### Layer 2 - Terminal Commands (idle, ~9 KB)

Registered via `registerCommand()` from idle plugins (terminal-games, terminal-theme, github-cms). Commands are queued in `pendingCommands` until the terminal loads, then drained. Includes `snake`, `matrix`, `roguelike`, `theme`, plus builtins (`ls`, `cat`, `cd`, `pwd`, `whoami`, `clear`, `exit`). The `auth` command is hidden - not shown in `help`.

### Layer 3 - GitHub CMS (lazy on auth, ~108 KB)

`auth <github_pat>` validates the token against GitHub's API, checks push permissions to the content repo, then unlocks: `edit` (CodeMirror markdown editor with AI rewrite panel), `new` (draft creation with frontmatter template), `publish` (moves drafts to posts with redirect handling), `rm` (delete posts). Also injects a floating edit button on post pages and a pending edits indicator. Token stored in `localStorage._ep`. Secret shortcut: `window._a("pat")` in DevTools bypasses the terminal entirely.

---

## Build Pipeline

### Local Build Flow

```
make prod
  └── make content                     # Fetch from content/ repo
      └── scripts/fetch-content.sh     # Copy posts, site.yml, secrets
  └── npm run build
      ├── npm run inject-all           # Generate src/data/*.ts from configs
      │   ├── generate-site-config     # _data/site.yml -> site-config.ts
      │   ├── generate-taglines        # _data/site.yml -> taglines.ts
      │   ├── inject-context           # system-prompt.md -> jocelyn-context.ts
      │   └── inject-chunks            # context-chunks.json -> context-chunks.ts
      ├── npm run typecheck            # tsc --noEmit
      └── vite build                   # Bundle to assets/js/dist/
          └── copies manifest.json to _data/vite-manifest.json
  └── JEKYLL_ENV=production jekyll build  # Build to _site/
```

### Vite Configuration

- **Input**: `src/main.ts` + `src/styles/core.css`
- **Output**: `assets/js/dist/` with content-hashed filenames
- **Manifest mode**: Generates `manifest.json` for Jekyll asset references
- **Path alias**: `@` maps to `src/`
- **Code splitting**: Dynamic imports in plugins create separate chunks. 13+ bundles total.

### Jekyll Integration

Jekyll serves as the static site generator. Vite's manifest is copied to `_data/vite-manifest.json` so Jekyll templates can reference hashed bundle paths. Content is processed from the `content/` directory (or `_posts/` directly in single-repo mode).

### GitHub Actions

The CI workflow:
1. Checks out template repo
2. Fetches content from the content repo via `CONTENT_PAT`
3. Injects secrets (`SYSTEM_PROMPT`, `CONTEXT_CHUNKS`)
4. Runs `npm run build` (Vite)
5. Runs `jekyll build`
6. Deploys `_site/` to GitHub Pages

---

## WebGL Pipeline

### Cosmic Background

`src/core/cosmic-background.ts` + `src/shaders/cosmic.ts`

- WebGL context: `powerPreference: 'high-performance'`, no antialias/depth/stencil
- Runs at 50% internal resolution (simplex noise blur hides the downscaling)
- **Nebula**: 5-octave fractional Brownian motion (FBM) using 3D simplex noise. 3 independent noise passes at scales 1.5x, 2.0x, 3.0x blending purple, cyan, and pink
- **Star field**: 4 density layers (35, 70, 140, 220 stars/unit) with hash-based per-star RNG. Bright stars get 4-point diffraction spikes plus 2 diagonal spikes at 45 degrees, rendered with smoothstep
- **Twinkle**: 3-phase sine-driven animation per star with independent phase
- **Parallax**: Mouse position offsets noise coordinates
- **Potato mode**: Halves resolution further when FPS < 27

### Flying Icons

`src/components/flying-icons-gpu.ts` + `src/shaders/flying-icons.ts`

- Cubic Bezier path animation evaluated entirely in the vertex shader (4 control points per axis)
- 6 icons x 4 trail copies = 24 instances via per-vertex attributes (WebGL 1.0 compatible, no instancing extension)
- Additive blending (`SRC_ALPHA, ONE`) for glow accumulation
- Trail effect: color-shifted + decreasing alpha per trail index
- Path regeneration with smooth restart (new random control points, endpoints kept offscreen)

### Constellation Text (Disabled)

`src/components/constellation-text-gpu.ts` + `src/shaders/constellation.ts`

- 2 shader programs: point stars + connecting lines
- Text-to-particle conversion: render to temporary canvas, sample alpha channel every 6 pixels
- Word cycling with 5 words, 5s per word, 600ms fade transitions

### FPS Monitoring

`src/components/fps-monitor.ts`

6-tier system with hysteresis:

| Tier | FPS Threshold |
|------|---------------|
| SuperUltra | 480+ |
| Ultra | 240+ |
| High | 120+ |
| Medium | 60+ |
| Low | 30+ |
| Potato | <27 |

- 1-second rAF-based refresh rate detection on startup
- Hysteresis: requires 2 stable samples (1 second) before tier change, 3-second warmup delay
- Potato mode: destroys flying icons, halves WebGL resolution, auto-recovers when FPS improves
- Draggable expanded panel with canvas-based real-time FPS graph, color-coded by tier

---

## CSS Architecture

~4,000 lines across structured directories:

```
src/styles/
├── core.css              # Entry point (imports all)
├── variables.css         # Design tokens (36 CSS custom properties)
├── themes.css            # Galaxy / Classic Dark / Classic Light
├── base.css              # Base element styles
├── components/           # Component-scoped stylesheets
│   ├── back-to-top.css
│   ├── fallback.css      # No-WebGL / reduced-motion fallback
│   ├── footer.css
│   ├── fps-monitor.css
│   ├── header.css
│   ├── nav-loading.css
│   ├── post-nav.css
│   ├── post-page.css
│   ├── posts-list.css
│   ├── syntax-highlighting.css
│   └── theme-switcher.css
├── pages/                # Page-specific styles
│   ├── about.css
│   ├── archive.css
│   ├── home.css
│   ├── layout.css
│   └── search.css
└── utilities/
    ├── accessibility.css
    ├── animations.css    # Keyframes and easing library
    └── reduced-motion.css
```

Key patterns:
- **Design tokens** via CSS custom properties (`--primary`, `--secondary`, `--glow`, etc.)
- **Three themes** defined in `themes.css` with class-scoped overrides
- **Gradient text** via `-webkit-background-clip: text`
- **Reduced motion**: `prefers-reduced-motion` disables all WebGL and animations
- **GPU promotion** via `will-change` used sparingly (only on cards and brackets)

---

## Terminal System

`src/terminal/terminal.ts` (~400 lines) + `src/terminal/commands.ts`

### Shell Implementation

- Full xterm.js wrapper with `@xterm/xterm`, FitAddon, WebLinksAddon
- Line editing: backspace, arrow keys (left/right cursor, up/down history), Ctrl+C (copy/cancel), Ctrl+L (clear)
- Command history with index-based navigation
- Paste support via multi-character onData handler
- Atomic cursor updates via ANSI escape sequences (single `write()` call prevents flicker)
- Dynamic prompt: `[checkmark] ellyseum:/ $` (green check if authenticated)

### Command Registration

Plugins register commands via `ctx.registerCommand(name, command)`:

```typescript
interface TerminalCommand {
  description: string;
  usage?: string;
  hidden?: boolean;        // Hidden from `help` output
  requiresAuth?: boolean;  // Requires GitHub auth
  handler(args: string[], terminal: unknown): Promise<void> | void;
}
```

Commands registered before the terminal loads are queued in `pendingCommands` (a shared service). When `konami-terminal` initializes, it drains the queue and subscribes to future `command:registered` events.

---

## AI Chat

`src/plugins/ai-chat/` + `src/components/chat-widget/` + `src/workers/llm-worker.ts`

### Two-Tier Architecture

**Tier 1 - Self-hosted (WebGPU)**:
- Downloads and runs real LLMs locally via WebLLM: Qwen2.5-1.5B, Qwen2-7B, or Phi-3.5
- Inference runs in a Web Worker (`llm-worker.ts`) - main thread never blocks
- No API key, no server, no network requests after model download
- Requires WebGPU (dedicated VRAM or Mac unified memory)

**Tier 2 - Cloud (Groq)**:
- Uses site owner's Groq API key with free-tier allocation (1M tokens/day)
- Access to larger models: LLaMA 3.1 70B, Mixtral 8x7B
- Fast time-to-first-token on Groq's custom LPU hardware
- Visitors get cloud-grade inference without needing their own API key

### RAG Pipeline

- **Embedding search**: Pre-computed embeddings shipped with the site. Cosine similarity with top-3 retrieval (>0.3 threshold)
- **BM25 fallback**: Full-text search with k1=1.5 and b=0.75 length normalization when embedding results are insufficient
- **Response**: 512-token max, token-by-token streaming to DOM

### Loading Strategy

- **Mobile**: Eagerly loads chat widget (no hover detection)
- **Desktop**: Shows a placeholder button, loads full widget on hover

---

## Code Splitting

13+ bundles with trigger-based lazy loading:

| Bundle | Approx Size | Trigger |
|--------|-------------|---------|
| main | ~87 KB | Always |
| terminal (xterm.js) | ~339 KB | Konami code / backtick / URL param |
| commands | ~9 KB | Konami code |
| editor (CodeMirror) | ~104 KB | `auth` command |
| github | ~4.2 KB | `auth` command |
| chat-widget | ~53 KB | Hover (desktop) / immediate (mobile) |
| edit-button | ~3.6 KB | If authenticated |
| snake | ~1.8 KB | `snake` command |
| matrix | ~1.6 KB | `matrix` command |
| roguelike | ~2 KB | `roguelike` command |
| llm-worker | ~5.2 MB | Chat model load |
| nav-worker | small | SPA navigation |

Vite handles all code splitting via dynamic `import()`. Filenames are content-hashed for cache busting. The manifest is consumed by Jekyll for template references.
