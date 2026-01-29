# Ellyseum Dreams

A GPU-accelerated personal blog that pushes what's possible in a browser. Custom WebGL shaders, SPA navigation with flying word animations, on-device AI chat, and a typewriter that makes realistic typos. Because static sites don't have to be boring.

![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat&logo=typescript&logoColor=white)
![WebGL](https://img.shields.io/badge/WebGL-990000?style=flat&logo=webgl&logoColor=white)
![Jekyll](https://img.shields.io/badge/Jekyll-CC0000?style=flat&logo=jekyll&logoColor=white)

---

## The Stack

- **Jekyll** for static site generation
- **TypeScript** with Vite for build tooling
- **WebGL** with custom GLSL shaders for GPU effects
- **Web Workers** for non-blocking prefetch and AI inference
- **WebLLM** for on-device chat (no server required)

---

## Features

### WebGL Visual Effects

**Cosmic Background**
- Real-time Perlin noise-based nebula effect
- Mouse-reactive animation (follows cursor)
- Device orientation support (tilt your phone/iPad)
- Dynamic resolution scaling for performance

**Flying Icons**
- GPU-instanced rendering of animated icons
- Cubic Bézier path animation with trail effects
- Additive blending for glow

**3D Card System**
- CSS 3D perspective transforms with mouse tracking
- Per-card random rotation for visual variety
- Hover elevation with smooth interpolation
- Disabled on mobile (no cursor to track)

### SPA Navigation

Zero page reloads. Click a link, content animates out, new content flies in.

**Transition Animations**
- **Cards fly out** in random directions with rotation and scale
- **Clicked card zooms** into viewport center while others scatter
- **Words fly in** individually from screen edges with stagger delay
- **Intro elements** cascade down (title → tagline → byline)

**Prefetch System**
- **Desktop:** Prefetch on hover/focus
- **Mobile:** Batch prefetch all visible links on page load
- **Web Worker** parses HTML off main thread
- Hidden prerender divs ready for instant swap

### Typewriter Effect

The tagline types itself with human-like imperfection.

- Rotating taglines, shuffled each session (no repeats until all shown)
- Variable typing speed (25-65ms per character)
- **4 typo types:**
  - Extra key repeats (40%)
  - Accidental whitespace (25%)
  - Dyslexia swaps (20%)
  - Fat finger adjacent keys (15%)
- QWERTY adjacency map for realistic finger slips
- Shift-held cascade (uppercase bleeds into next characters)
- Realistic pause before noticing mistakes
- Slower backspace for corrections

### On-Device AI Chat

Talk to an AI that knows the blog content. Runs entirely in your browser.

- **WebLLM** for inference (no server, no API keys)
- **RAG retrieval** with dual strategy:
  - Embedding-based semantic search
  - BM25 keyword fallback
- Token-by-token streaming responses
- Graceful fallback to cloud API if WebGPU unavailable
- Lazy-loaded on desktop, eager on mobile

### Performance

**FPS Monitor**
- Real-time frame counting with tier classification
- Auto-detects display refresh rate
- Draggable overlay panel

**Potato Mode**
- Triggers when FPS drops below 27
- Disables flying icons
- Reduces background resolution to 50%
- Recovers automatically when performance improves

**Adaptive Loading**
- Three-phase initialization (background → interactive → decorative)
- `prefers-reduced-motion` respected (disables all WebGL)
- Static fallback for browsers without WebGL

### Search & Filter

- Full-text search across posts
- Tag-based filtering with chip UI
- Date filtering
- Query params for shareable filtered views
- Debounced input (400ms)

### Post Features

- **Code copy button** on all code blocks
- **Sticky navigation** appears when header scrolls out
- **Back to top** button after 300px scroll
- **Previous/Next** post navigation
- **Reading time** estimates

---

## Architecture

```
src/
├── main.ts                      # Entry point
├── core/
│   ├── experience.ts            # WebGL orchestrator
│   └── cosmic-background.ts     # Perlin noise shader
├── components/
│   ├── cards-3d.ts              # 3D card interactions
│   ├── flying-icons-gpu.ts      # Bézier icon animation
│   ├── view-transitions.ts      # SPA navigation engine
│   ├── typewriter.ts            # Realistic typing effect
│   ├── search-filter.ts         # Search/filter UI
│   ├── fps-monitor.ts           # Performance overlay
│   ├── post-nav-sticky.ts       # Sticky navigation
│   ├── back-to-top.ts           # Scroll button
│   ├── code-copy.ts             # Code block copy
│   └── target-reticle.ts        # Click indicator
├── workers/
│   ├── nav-worker.ts            # Prefetch parser
│   └── llm-worker.ts            # AI inference
└── data/
    └── taglines.ts              # Generated from content repo
```

---

## Content Management

Blog content is stored in a separate private repository and fetched at build time. This keeps the main repo reusable as a template.

### Content Repository Structure

```
your-content-repo/
├── site.yml          # Site configuration
└── YYYY-MM-DD-*.md   # Blog posts in Jekyll format
```

### site.yml

All configurable content:

```yaml
site:
  title: "Your Blog Title"
  tagline: "Your tagline"
  description: "SEO description"
  author: "Your Name"
  url: "https://yourdomain.com"
  repository: "username/repo"

taglines:
  - "First rotating tagline"
  - "Second rotating tagline"

about:
  intro: "About page intro text..."
  work: "What I work on..."
  site_description: "About this site..."

skills:
  - "Skill 1"
  - "Skill 2"

contact:
  email: "you@example.com"
  github: "https://github.com/you"
  linkedin: "https://linkedin.com/in/you"
  portfolio: "https://yourportfolio.com"
```

### Setup

1. Fork this repo
2. Create a private content repo with `site.yml` and your posts
3. Add secrets to your fork:
   - `CONTENT_PAT`: Personal access token with read access to your content repo
4. Add variables to your fork:
   - `CONTENT_REPO`: `username/content-repo-name`
5. Push and deploy

For local development, clone your content repo into the `content/` folder (it's gitignored).

---

## Development

### Prerequisites

- Node.js 18+
- Ruby 2.7+ with Bundler

### Setup

```bash
bundle install
npm install

# Clone your content repo into content/ (optional for local dev)
git clone git@github.com:you/your-content.git content

make dev
```

Runs Vite (HMR) + Jekyll (live reload) in parallel.

### Commands

| Command | Description |
|---------|-------------|
| `make dev` | Start dev servers |
| `make prod` | Production build + local serve |
| `make content` | Process content from content/ |
| `make build` | Build for deployment |
| `make new-post TITLE="..."` | Scaffold new post |

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

| Tier | Trigger | Experience |
|------|---------|------------|
| **Full** | 60+ FPS | All effects |
| **Potato** | <27 FPS | Reduced effects, lower resolution |
| **Static** | No WebGL / reduced motion | CSS only |

---

## License

MIT
