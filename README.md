# Ellyseum Blog Template

A GPU-accelerated personal blog that pushes what's possible in a browser. Custom WebGL shaders, SPA navigation with flying word animations, on-device AI chat, and a typewriter that makes realistic typos. Because static sites don't have to be boring.

![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat&logo=typescript&logoColor=white)
![WebGL](https://img.shields.io/badge/WebGL-990000?style=flat&logo=webgl&logoColor=white)
![Jekyll](https://img.shields.io/badge/Jekyll-CC0000?style=flat&logo=jekyll&logoColor=white)

---

## Quick Start

### Option 1: Single Repository (Simple)

Everything in one repo. Good for getting started.

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

# Add your blog posts to _posts/
# Format: YYYY-MM-DD-title-slug.md

# Build and preview
make prod
# Then: https _site 4000
```

### Option 2: Split Repositories (Recommended)

Separate your content from the template. Keeps the template updatable and your content private.

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

1. Create your content repo with `site.yml` (copy from `_data/site.yml.example`)

2. Add secrets to your template fork:
   - `CONTENT_PAT`: Personal access token with read access to content repo
   - `SYSTEM_PROMPT`: Contents of your system-prompt.md (optional)
   - `CONTEXT_CHUNKS`: Contents of your context-chunks.json (optional)

3. Add repository variable:
   - `CONTENT_REPO`: `username/content-repo-name`

4. For local development, clone your content repo into `content/`:
   ```bash
   git clone git@github.com:you/your-content.git content
   ```

5. Build:
   ```bash
   make prod
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

### WebGL Visual Effects

- **Cosmic Background**: Real-time Perlin noise nebula, mouse-reactive, tilt-responsive on mobile
- **Flying Icons**: GPU-instanced Bézier path animation with trails
- **3D Cards**: CSS 3D transforms with mouse tracking and hover elevation

### SPA Navigation

Zero page reloads. Click a link, content animates out, new content flies in.

- Cards fly out in random directions
- Words fly in individually from screen edges
- Web Worker prefetches and parses HTML off main thread
- Prerender for instant page swaps

### Typewriter Effect

Tagline types itself with human-like imperfection:
- Variable typing speed (25-65ms)
- Realistic typos (key repeats, adjacent keys, dyslexia swaps)
- QWERTY adjacency map for believable finger slips
- Pauses before noticing and correcting mistakes

### On-Device AI Chat

Talk to an AI that knows your content. Runs entirely in the browser.

- **WebLLM** for local inference (no server, no API keys)
- **RAG retrieval** with embedding search + BM25 fallback
- Token-by-token streaming
- Optional cloud fallback (requires Cloudflare Worker - see `worker/`)

### Performance

- **FPS Monitor**: Real-time tier classification, draggable overlay
- **Potato Mode**: Auto-degrades when FPS drops below 27
- **Adaptive Loading**: Three-phase init, respects `prefers-reduced-motion`

### Search & Filter

- Full-text search across posts
- Tag and date filtering
- Shareable query params
- Animated results with stagger

---

## Commands

| Command | Description |
|---------|-------------|
| `make prod` | Full production build (Vite + Jekyll) |
| `make content` | Process content from content/ directory |
| `make serve` | Serve _site (after build) |
| `make new-post TITLE="..."` | Create new post |
| `make draft TITLE="..."` | Create draft in content/drafts/ |
| `npm run clean` | Remove all generated files |

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
│   ├── chat-widget/             # AI chat components
│   └── ...
├── workers/
│   ├── nav-worker.ts            # Prefetch parser
│   └── llm-worker.ts            # AI inference
├── styles/                      # CSS (split into components)
└── data/                        # Generated at build time
```

---

## Cloud Chat (Optional)

For devices without WebGPU, you can deploy a Cloudflare Worker as a fallback:

```bash
cd worker
npm install
cp wrangler.toml.example wrangler.toml
# Edit wrangler.toml with your settings

# Set your Groq API key
wrangler secret put GROQ_API_KEY

# Deploy
npm run deploy
```

Then set `VITE_GROQ_PROXY_URL` in your environment to enable cloud fallback.

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
