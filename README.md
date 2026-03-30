# Ellyseum Blog Template

A $0 inference stack pretending to be a blog. RAG runs in the browser via WebGPU — Qwen/Phi for chat, snowflake-arctic-embed-m for embeddings, no API key, no server, no spend. Devices without WebGPU fall back to a Cloudflare Worker proxying Groq's free tier.

The flex on top of that: a Jekyll blog template wrapped in a TypeScript plugin system, a WebGL cosmic background, SPA navigation with flying-word transitions, and a Konami-code terminal with Snake, Matrix rain, and a roguelike. Every feature is a plugin — comment out a line in `src/ellyseum.config.ts` to disable it, or drop in your own.

![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat&logo=typescript&logoColor=white)
![WebGL](https://img.shields.io/badge/WebGL-990000?style=flat&logo=webgl&logoColor=white)
![Jekyll](https://img.shields.io/badge/Jekyll-CC0000?style=flat&logo=jekyll&logoColor=white)

---

## Prerequisites

Install these before running setup:

| Tool | Version | When you need it |
|------|---------|------------------|
| Node.js | 20+ | Always (Vite, build scripts) |
| Ruby + bundler | 3.2+ | Always (Jekyll) |
| Python | 3.11+ | Only for `make embeddings` (RAG generation) |
| `gh` CLI (authenticated) | latest | Only for `make sync-*` and `make rebuild` |
| `wrangler` CLI | latest | Only for deploying the optional Cloudflare Worker |

Versions are what CI pins. Older may work but is unsupported.

If you don't need the AI chat / RAG / worker features, you can skip Python, `gh`, and `wrangler` entirely — Node and Ruby are the minimum.

---

## Quick Start

### Option 1: Single Repository (local preview / fork-and-edit only)

> **Heads up:** Option 1 is for local preview and tinkering. The user-source files
> it tells you to create (`_data/site.yml`, `_posts/*.md`, `system-prompt.md`,
> `context-chunks.json`) are gitignored, so they won't be tracked or deployed by
> CI. To deploy, switch to Option 2.

```bash
# Clone the template
git clone https://github.com/ellyseum/ellyseum.github.io.git my-blog
cd my-blog

# Install dependencies
npm install
bundle install

# Copy and customize config files
cp _data/site.yml.example _data/site.yml
cp system-prompt.md.example system-prompt.md
cp context-chunks.json.example context-chunks.json

# Edit _data/site.yml with your info
# Edit system-prompt.md with your AI assistant prompt
# Edit context-chunks.json with your RAG context

# Write a post — content/ is the canonical source, copied to _posts/ at build time.
# (Both `make new-post TITLE="..."` and writing files directly to content/ work.)
# Format: YYYY-MM-DD-title-slug.md
make new-post TITLE="My First Post"

# Build and preview
make prod
# Then: npx serve _site -l 4000
```

### Option 2: Split Repositories (recommended for deploy)

Separate your content from the template. Keeps the template updatable and your content private — and works correctly with CI/CD.

**Template Repo** (this one, public):
- Fork or clone this repo
- Contains all code, styling, and build tooling
- Can pull template updates without merge conflicts

**Content Repo** (yours, can be private):
```
your-content-repo/
├── site.yml              # Site configuration
├── system-prompt.md      # AI chat system prompt (optional)
├── context-chunks.json   # RAG context for AI chat (optional)
├── YYYY-MM-DD-post.md    # Blog posts
└── drafts/               # Draft posts (optional)
    └── draft-post.md
```

**Setup:**

1. Create your content repo with `site.yml` (copy from `_data/site.yml.example`).

2. Clone the template fork and your content repo, then install dependencies:
   ```bash
   git clone https://github.com/<you>/<your-fork>.git my-blog
   cd my-blog
   git clone git@github.com:<you>/<your-content>.git content
   npm install
   bundle install
   ```

3. Add secrets to your template fork (Settings → Secrets and variables → Actions):
   - `CONTENT_PAT`: Personal access token with read access to your content repo
   - `SYSTEM_PROMPT`: Contents of your `system-prompt.md` (optional — see note below)
   - `CONTEXT_CHUNKS`: Contents of your `context-chunks.json` (optional — see note below)

   The system prompt and context chunks can also live as files in your
   content repo (`content/system-prompt.md`, `content/context-chunks.json`)
   instead of as GitHub secrets. Either way works; pick whichever fits your
   workflow. The build resolves env vars first, then `content/`, then
   the template fork's root.

4. Add a repository variable:
   - `CONTENT_REPO`: `<you>/<your-content-repo>`

5. Build:
   ```bash
   make prod
   ```

6. Preview locally with any static server (we use `npx serve` in examples,
   but `python -m http.server`, `caddy file-server`, etc. all work):
   ```bash
   npx serve _site -l 4000
   ```

---

## Configuration

### site.yml

All site configuration lives in one file:

```yaml
site:
  title: "Your Blog Title"
  tagline: "Your tagline here"
  description: "SEO description for your blog"
  author: "Your Name"
  url: "https://yourdomain.com"
  domain: "yourdomain.com"
  repository: "username/repo-name"
  image: "/assets/og-image.png"  # OpenGraph card image (jekyll-seo-tag)

taglines:
  - "First rotating tagline"
  - "Second rotating tagline"
  - "Third rotating tagline"

about:
  intro: |
    Your introduction paragraph. Markdown supported.
  work: |
    Description of your work.
  site_description: |
    What this site is about.

skills:
  - "Skill 1"
  - "Skill 2"
  - "Skill 3"

contact:
  email: "you@example.com"
  github: "https://github.com/username"
  linkedin: "https://linkedin.com/in/username"
  portfolio: "https://yourportfolio.com"

# Optional: in-browser CMS configuration. Leave any field blank to fall
# back to `site.repository` above.
cms:
  content_repo: ""         # e.g. "your-content-repo-name"
  github_owner: ""         # e.g. "yourusername"
  content_posts_path: ""   # "" for repo root
  content_drafts_path: ""  # default "drafts"

chat:
  greeting_local: |
    Hi! I'm a local AI assistant running in your browser.
  greeting_cloud: |
    Hi! I'm an AI assistant powered by cloud inference.
```

### system-prompt.md

The system prompt for your AI chat assistant. Describes who you are and how the AI should respond. See `system-prompt.md.example` for a template.

### context-chunks.json

RAG (Retrieval Augmented Generation) context for the AI chat. Structured chunks of information the AI can retrieve to answer questions accurately. See `context-chunks.json.example` for the format.

---

## Features

### Plugin Architecture

Everything beyond the core blog is a plugin. Eight plugins ship by default, each with its own loading strategy (eager, idle, or lazy). Disable any plugin by commenting out one line in `ellyseum.config.ts`. See [docs/PLUGINS.md](docs/PLUGINS.md) for the full catalog and API reference.

### WebGL Visual Effects

- **Cosmic Background**: 5-octave FBM simplex noise nebula, 4-density star field with diffraction spikes, mouse-reactive parallax, tilt-responsive on mobile
- **Flying Icons**: GPU-instanced cubic Bezier path animation with additive-blended trails
- **3D Cards**: CSS 3D transforms with per-card random rotation, mouse tracking, hover elevation

### SPA Navigation

Zero page reloads. Click a link, content animates out, new content flies in.

- Cards fly out in random directions with rotation
- Words fly in individually from screen edges with staggered timing
- Web Worker prefetches and parses HTML off main thread
- Prerender for instant page swaps

### Themes

Three themes with instant switching:

- **Galaxy** (default) - WebGL cosmic background with all GPU effects
- **Classic Dark** - Clean dark theme, no WebGL
- **Classic Light** - Clean light theme, no WebGL

Switch via the theme picker in the header, or via the `theme` command in the hidden terminal.

### Hidden Terminal

Enter the Konami code anywhere on the site to reveal a full terminal emulator. Features:

- `ls`, `cat`, `cd`, `pwd`, `whoami`, `clear`, `exit` - file system navigation
- `snake` - playable Snake game rendered to the terminal canvas
- `matrix` - Matrix rain screensaver
- `roguelike` - procedural dungeon exploration
- `theme` - switch site themes
- `auth` - unlock the hidden CMS (see Progressive Disclosure below)
- Easter eggs: `sudo make me a sandwich`, `rm -rf /`

### Progressive Disclosure

Four discovery layers, each lazy-loaded on demand:

1. **DevTools console** - ASCII art logo + cryptic hint (0 KB cost)
2. **Konami code** - Full xterm.js terminal drops in (~339 KB lazy)
3. **Terminal commands** - Games, navigation, easter eggs (~9 KB lazy)
4. **`auth <github_pat>`** - Unlocks full headless CMS with CodeMirror editor (~108 KB lazy)

### On-Device AI Chat

Two-tier zero-dollar AI infrastructure:

- **Tier 1 - Local**: WebGPU inference in your browser (Qwen/Phi models on your GPU, no API key, no server)
- **Tier 2 - Cloud**: Groq free tier (1M tokens/day, LLaMA 70B/Mixtral 8x7B)
- RAG retrieval with embedding search + BM25 fallback
- Token-by-token streaming via Web Worker (main thread never blocks)

### Performance

- **FPS Monitor**: Real-time 6-tier classification (SuperUltra/Ultra/High/Medium/Low/Potato), draggable overlay with canvas graph
- **Potato Mode**: Auto-degrades when FPS drops below 27 (destroys flying icons, halves background resolution)
- **Adaptive Loading**: Three-phase init, respects `prefers-reduced-motion`

### Search & Filter

- Full-text search across posts with smart syntax (`"exact phrase" from:2024-01 tag:ai`)
- Tag and date filtering with FLIP-animated chips
- Shareable query params
- Staggered result animations

---

## Plugin System

All features beyond the core blog are plugins registered in `src/ellyseum.config.ts`:

```typescript
const config: EllysConfig = {
  plugins: [
    () => import('./plugins/spa-router'),
    () => import('./plugins/webgl-galaxy'),
    () => import('./plugins/galaxy-extras'),
    () => import('./plugins/konami-terminal'),
    () => import('./plugins/terminal-theme'),
    () => import('./plugins/terminal-games'),
    () => import('./plugins/github-cms'),
    () => import('./plugins/ai-chat'),
  ],
};
```

**Comment out a line to disable a plugin**, then run `npm run build` (or restart `vite dev`). The plugin registry is statically resolved by Vite at build time, so changes require a rebuild.

Plugins load in three strategies: **eager** (immediate), **idle** (`requestIdleCallback`), and **lazy** (on-demand via trigger). Dependencies are resolved via topological sort.

For the full plugin catalog, API reference, and how to create your own, see [docs/PLUGINS.md](docs/PLUGINS.md). For architecture deep-dive, see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

---

## Commands

| Command | Description |
|---------|-------------|
| `make prod` | Full production build (content + Vite + Jekyll) |
| `make content` | Process content from content/ directory |
| `make serve` | Start Jekyll dev server with live reload |
| `make build` | Jekyll build only (use `make prod` for full build) |
| `make clean` | Remove generated files |
| `make new-post TITLE="..."` | Create new post |
| `make draft TITLE="..."` | Create draft in content/drafts/ |
| `make sync-prompt` | Sync system-prompt.md to GitHub secret |
| `make sync-chunks` | Sync context-chunks.json to GitHub secret |
| `make sync-all` | Sync all secrets to GitHub |
| `make rebuild` | Trigger GitHub Actions rebuild without pushing |
| `make embeddings` | Regenerate embeddings (requires conda env) |
| `npm run build` | Vite build only (inject + typecheck + bundle) |
| `npm run clean` | Remove all generated data files |

---

## Architecture

```
src/
├── main.ts                          # Entry point: theme, plugins, core components
├── ellyseum.config.ts               # Plugin registry (comment out = disable)
│
├── core/                            # Infrastructure
│   ├── plugin-manager.ts            # Lifecycle, dependency sort, triggers
│   ├── plugin-types.ts              # EllysPlugin, PluginContext, TerminalCommand
│   ├── event-bus.ts                 # Pub/sub for inter-plugin communication
│   ├── theme-manager.ts             # Theme state and switching
│   └── cosmic-background.ts         # WebGL renderer (FBM nebula + star field)
│
├── plugins/                         # Feature plugins
│   ├── spa-router/                  # SPA navigation + view transitions
│   │   ├── index.ts                 # Plugin entry (eager)
│   │   ├── view-transitions.ts      # Card zoom, flying words, prefetch
│   │   └── nav-worker.ts            # Web Worker for HTML parsing
│   ├── webgl-galaxy/                # WebGL cosmic background (eager)
│   ├── galaxy-extras/               # Cards 3D, flying icons, FPS, typewriter (idle)
│   ├── konami-terminal/             # Hidden terminal via Konami code (lazy)
│   ├── terminal-theme/              # Theme switching command (idle)
│   ├── terminal-games/              # Snake, Matrix, Roguelike commands (idle)
│   ├── github-cms/                  # Auth, editor, publish pipeline (idle)
│   └── ai-chat/                     # Two-tier AI chatbot (lazy)
│
├── components/                      # Shared UI components
│   ├── cards-3d.ts                  # 3D card tilt with mouse tracking
│   ├── flying-icons-gpu.ts          # GPU-instanced Bezier path animation
│   ├── fps-monitor.ts               # 6-tier adaptive FPS monitoring
│   ├── typewriter.ts                # Tagline with realistic typos
│   ├── search-filter.ts             # Full-text search with date/tag filtering
│   ├── target-reticle.ts            # Animated [[ ]] brackets
│   ├── constellation-text-gpu.ts    # GPU particle text (disabled)
│   ├── theme-switcher.ts            # Theme selector UI
│   ├── post-nav-sticky.ts           # Sticky navigation on post pages
│   ├── back-to-top.ts              # Scroll-to-top button
│   ├── code-copy.ts                # Copy buttons for code blocks
│   └── chat-widget/                # AI chat UI components
│       ├── chat-widget.ts
│       ├── chat-ui.ts
│       ├── chat-types.ts
│       ├── chat-styles.ts
│       └── index.ts
│
├── terminal/                        # Terminal shell implementation
│   ├── terminal.ts                  # xterm.js wrapper with line editing
│   ├── commands.ts                  # Command registry + builtins
│   ├── editor.ts                    # CodeMirror markdown editor
│   ├── github.ts                    # GitHub API client
│   └── games/
│       ├── snake.ts                 # Snake game
│       ├── matrix.ts                # Matrix rain
│       └── roguelike.ts             # Procedural dungeon
│
├── shaders/                         # GLSL shader modules
│   ├── cosmic.ts                    # FBM nebula + star field
│   ├── flying-icons.ts              # Icon path rendering
│   └── constellation.ts            # Text-to-particle
│
├── workers/                         # Web Workers
│   └── llm-worker.ts               # WebGPU LLM inference
│
├── styles/                          # CSS (~4,000 lines)
│   ├── core.css                     # Entry point (imports all)
│   ├── variables.css                # Design tokens
│   ├── themes.css                   # Galaxy / Classic Dark / Classic Light
│   ├── base.css                     # Base styles
│   ├── components/                  # Component-scoped stylesheets
│   ├── pages/                       # Page-specific styles
│   └── utilities/                   # Animations, accessibility, reduced-motion
│
├── data/                            # Generated at build time
│   ├── site-config.ts               # Injected from _data/site.yml
│   ├── taglines.ts                  # Injected from _data/site.yml
│   ├── context-chunks.ts            # Injected RAG context
│   └── jocelyn-context.ts           # Personal context for AI
│
├── edit-button.ts                   # Floating edit button (authenticated pages)
├── utils/performance.ts             # Performance tracking
└── vite-env.d.ts                    # Vite type declarations
```

---

## Cloud Chat (Optional)

For devices without WebGPU, you can deploy a Cloudflare Worker as a fallback. Prerequisites: a Cloudflare account, the `wrangler` CLI installed and logged in (`wrangler login`), and a Groq API key.

```bash
cd worker
npm install

# Configure the worker
cp wrangler.toml.example wrangler.toml
# Edit wrangler.toml: set `name`, fill in `account_id` (or run
# `wrangler whoami` to find it), and update ALLOWED_ORIGINS to
# include your blog's domain(s).

# The worker injects its system prompt at build time. `npm run deploy`
# (and `npm run dev`) automatically runs scripts/inject-prompt.js, which
# reads in this priority order:
#   1. SYSTEM_PROMPT env var
#   2. ../content/system-prompt.md (split-repo content folder)
#   3. ../system-prompt.md (template-fork root)
# If none of those exist the worker still compiles with an empty prompt.

# Set your Groq API key as a worker secret
wrangler secret put GROQ_API_KEY

# Deploy
npm run deploy
```

Then set `VITE_GROQ_PROXY_URL` in your template fork's environment (and as a CI secret) to enable cloud fallback. The blog will use WebGPU when available and fall back to the proxy when the device can't run a local model.

---

## Browser Support

| Browser | Version | Notes |
|---------|---------|-------|
| Chrome | 90+ | Full support |
| Firefox | 88+ | Full support |
| Safari | 14+ | Full support |
| Edge | 90+ | Full support |

Gracefully degrades without WebGL. Respects `prefers-reduced-motion`.

---

## Performance Tiers

| Tier | FPS | Experience |
|------|-----|------------|
| **SuperUltra** | 480+ | All effects, maximum quality |
| **Ultra** | 240+ | All effects |
| **High** | 120+ | All effects |
| **Medium** | 60+ | All effects |
| **Low** | 30+ | All effects (monitoring) |
| **Potato** | <27 | Reduced effects, lower resolution |
| **Static** | No WebGL / reduced motion | CSS only, no GPU effects |

---

## License

MIT
