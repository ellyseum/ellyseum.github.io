# Plugins

Ellyseum uses a plugin architecture where everything beyond the core blog is a loadable module. This document covers the plugin catalog, API reference, and how to create your own.

---

## Plugin Catalog

| # | Plugin | Strategy | Trigger | Dependencies | Description |
|---|--------|----------|---------|--------------|-------------|
| 1 | `spa-router` | eager | - | - | SPA navigation with view transitions and prefetching |
| 2 | `webgl-galaxy` | eager | - | - | WebGL cosmic background with nebula and star field |
| 3 | `galaxy-extras` | idle | - | `webgl-galaxy` | Decorative effects: cards 3D, flying icons, FPS monitor, typewriter |
| 4 | `konami-terminal` | lazy | custom | - | Hidden terminal activated by Konami code |
| 5 | `terminal-theme` | idle | - | - | Theme switching via terminal command |
| 6 | `terminal-games` | idle | - | - | Snake, Matrix, and Roguelike terminal games |
| 7 | `github-cms` | idle | - | - | GitHub-backed headless CMS with editor and publish pipeline |
| 8 | `ai-chat` | lazy | custom | - | Two-tier AI chatbot (WebGPU local + Groq cloud) |

---

## Plugin Details

### 1. spa-router

**Strategy:** eager | **Files:** `src/plugins/spa-router/` (3 files)

SPA navigation engine. Intercepts link clicks, animates the current page out (card zoom + word fly), fetches the target page via a Web Worker, and swaps content without a full reload. Emits `navigate` on the EventBus and dispatches an `ellyseum:navigate` CustomEvent for non-plugin listeners.

Key implementation: `view-transitions.ts` (1,097 lines) handles 4 animation modes depending on navigation type (Home->Post, Post->Post, Post->Home, Search/Archive). `nav-worker.ts` runs in a Web Worker to parse prefetched HTML off the main thread.

### 2. webgl-galaxy

**Strategy:** eager | **Files:** `src/plugins/webgl-galaxy/index.ts`

Sets up the WebGL cosmic background and registers it in the frame loop. Handles mouse/touch tracking with parallax, device orientation on iOS 13+ (with permission prompt), and potato mode detection. Provides `canvas` and `background` services for dependent plugins. Skips initialization entirely on classic themes or when `prefers-reduced-motion` is active.

### 3. galaxy-extras

**Strategy:** idle | **Depends on:** `webgl-galaxy` | **Files:** `src/plugins/galaxy-extras/index.ts`

Initializes decorative galaxy-theme effects: Cards3D (CSS 3D transforms with mouse tracking), FlyingIconsGPU (GPU-instanced Bezier path animation), FPSMonitor (6-tier adaptive quality), TargetReticle (animated brackets), and typewriter (rotating taglines with realistic typos). Reinitializes after SPA navigation. Cleans up when theme switches away from galaxy. Emits `potato-mode` when FPS drops below threshold.

### 4. konami-terminal

**Strategy:** lazy | **Trigger:** custom | **Files:** `src/plugins/konami-terminal/index.ts`

Listens for three activation methods: the Konami code sequence (Up Up Down Down Left Right Left Right B A), a `?terminal` URL parameter, or backtick (`` ` ``) if the terminal was previously unlocked in this session (tracked via `sessionStorage`). On activation, lazy-loads xterm.js and creates a full terminal shell. Drains all pending commands that were registered by other plugins before the terminal existed, then subscribes to future `command:registered` events. Provides the `terminal` service.

### 5. terminal-theme

**Strategy:** idle | **Files:** `src/plugins/terminal-theme/index.ts`

Registers a `theme` command that lists available themes, shows the current theme, and switches to a new one. Consumes the `themeManager` service to apply changes. Available themes: `galaxy`, `classic-dark`, `classic-light`.

### 6. terminal-games

**Strategy:** idle | **Files:** `src/plugins/terminal-games/index.ts`

Registers three game commands:
- **`snake`** - Snake game rendered directly to the xterm canvas. Arrow/WASD controls, wall + self collision, score tracking.
- **`matrix`** - Matrix rain effect with Katakana + ASCII characters, 4-tier color gradient, periodic character mutation. Any keypress exits.
- **`roguelike`** - Procedural dungeon exploration with room generation.

Each game is lazy-loaded via dynamic import only when the command is invoked.

### 7. github-cms

**Strategy:** idle | **Files:** `src/plugins/github-cms/index.ts`

The heaviest plugin by functionality. Registers five commands:
- **`auth <token>`** (hidden) - Validates GitHub PAT against the API, checks push permissions to the content repo. Stores token in `localStorage._ep`. Emits `auth:success` on the EventBus.
- **`logout`** - Clears the stored token.
- **`edit [path]`** - Opens a CodeMirror markdown editor with syntax highlighting, diff viewer, AI rewrite panel, and frontmatter editor. Fetches content from GitHub.
- **`new "Title"`** - Creates a new draft with frontmatter template.
- **`publish <slug>`** - Moves a draft from the configured drafts path to the configured posts path (see `cms.content_*_path` in site.yml), strips `draft: true` frontmatter, adds `redirect_from` entries, commits via GitHub API.
- **`rm <slug>`** - Deletes a post.

Also injects a floating edit button on post pages when authenticated, a pending edits indicator when unsaved changes exist, and re-injects both after SPA navigation. Secret shortcut: `window._a("pat")` in DevTools bypasses the terminal.

### 8. ai-chat

**Strategy:** lazy | **Trigger:** custom | **Files:** `src/plugins/ai-chat/index.ts`

Two loading paths: mobile devices load immediately, desktop shows a styled placeholder button and loads the full chat widget on hover. The widget supports two inference tiers: WebGPU local (Qwen/Phi models running on your GPU via WebLLM in a Web Worker) and Groq cloud (free tier, 1M tokens/day). RAG pipeline uses cosine similarity on pre-computed embeddings with BM25 full-text fallback.

---

## Creating a Plugin

### 1. Create the plugin directory

```
src/plugins/my-plugin/
└── index.ts
```

### 2. Implement the EllysPlugin interface

```typescript
import type { EllysPlugin } from '@/core/plugin-types';

const myPlugin: EllysPlugin = {
  name: 'my-plugin',
  description: 'What this plugin does',
  // dependencies: ['webgl-galaxy'],  // Optional: names of plugins that must init first
  loadStrategy: 'idle',               // 'eager' | 'idle' | 'lazy'
  // trigger: { type: 'konami' },     // Required if loadStrategy is 'lazy'

  async init(ctx) {
    ctx.log('Initializing...');

    // Use the PluginContext API (see below)
    ctx.on('navigate', () => {
      ctx.log('Page changed');
    });

    // Return a cleanup function (optional)
    return () => {
      ctx.log('Destroyed');
    };
  },
};

export default myPlugin;
```

### 3. Register in ellyseum.config.ts

```typescript
const config: EllysConfig = {
  plugins: [
    // ... existing plugins
    () => import('./plugins/my-plugin'),
  ],
};
```

That's it. The PluginManager handles loading, dependency resolution, and cleanup.

---

## Plugin API Reference

### PluginContext

Every plugin receives a `PluginContext` in its `init()` method:

#### Theme

```typescript
ctx.theme.current    // Current ThemeId ('galaxy' | 'classic-dark' | 'classic-light')
ctx.theme.isClassic  // true if current theme is classic-dark or classic-light

const unsub = ctx.onThemeChange((theme) => {
  // Called when theme changes
});
unsub(); // Stop listening
```

#### Frame Loop

```typescript
const unsub = ctx.onFrame(() => {
  // Called every requestAnimationFrame
  // Use for rendering, animations, polling
});
unsub(); // Remove from frame loop
```

#### CSS Injection

```typescript
const remove = ctx.injectCSS(`
  .my-plugin-widget {
    position: fixed;
    bottom: 24px;
  }
`);
// Creates a <style data-plugin="my-plugin"> element
remove(); // Remove the style element
```

#### EventBus

```typescript
// Publish
ctx.emit('my-event', { some: 'data' });

// Subscribe
const unsub = ctx.on('my-event', (data) => {
  console.log(data); // { some: 'data' }
});
unsub(); // Unsubscribe
```

#### Logging

```typescript
ctx.log('Hello');  // Console output: [my-plugin] Hello
```

#### Service Registry

```typescript
// Provider plugin
ctx.provide('myService', { doThing: () => 'done' });

// Consumer plugin (must declare provider in dependencies)
const svc = ctx.consume<{ doThing: () => string }>('myService');
svc?.doThing(); // 'done'
```

#### Terminal Commands

```typescript
ctx.registerCommand('greet', {
  description: 'Say hello',
  usage: '[name]',
  hidden: false,        // Set true to hide from `help`
  requiresAuth: false,  // Set true to require GitHub auth
  handler(args, terminal) {
    const term = terminal as { writeLine: (s: string) => void };
    const name = args[0] || 'world';
    term.writeLine(`Hello, ${name}!`);
  },
});
```

Commands registered before the terminal loads are queued automatically. They'll be available once the user activates the Konami code.

---

## Load Strategies

### When to use eager

The plugin must be active from the first frame. Only use for plugins that define the core visual experience or handle navigation. Currently: `spa-router` (intercepts clicks immediately) and `webgl-galaxy` (renders the background on first paint).

### When to use idle

The plugin enhances the experience but isn't needed immediately. The browser will initialize it when idle, typically within the first few hundred milliseconds. Good for: registering terminal commands, setting up event listeners, injecting UI that isn't above the fold. Most plugins should use idle.

### When to use lazy

The plugin is heavy and most users won't need it. Must include a `trigger` that defines when to load. Good for: xterm.js terminal (~339 KB), CodeMirror editor (~104 KB), AI chat with WebLLM. The trigger fires once - after that, the plugin stays loaded.

#### Custom Triggers

For complex activation logic, use `type: 'custom'` with a `when` function that returns a Promise. The Promise resolves when the plugin should load:

```typescript
trigger: {
  type: 'custom',
  when: () => new Promise<void>(resolve => {
    // Resolve when some condition is met
    someButton.addEventListener('click', () => resolve(), { once: true });
  }),
},
```

---

## Terminal Commands

### How registerCommand Works

`ctx.registerCommand(name, command)` adds the command to a shared `pendingCommands` map (a core service) and emits a `command:registered` event on the EventBus. The `konami-terminal` plugin:

1. On init, drains all entries from `pendingCommands` into the terminal's command registry
2. Subscribes to `command:registered` events for commands registered after the terminal loads

This means plugins can register commands at idle time without worrying about terminal load order.

### Command Interface

```typescript
interface TerminalCommand {
  description: string;           // Shown in `help` output
  usage?: string;                // Shown after command name in `help`
  hidden?: boolean;              // true = hidden from `help` (e.g., `auth`)
  requiresAuth?: boolean;        // true = requires GitHub PAT
  handler(
    args: string[],              // Parsed arguments (split by space)
    terminal: unknown            // Terminal instance (cast to use methods)
  ): Promise<void> | void;
}
```

The `terminal` parameter can be cast to access shell methods:

```typescript
const term = terminal as {
  writeLine: (s: string) => void;   // Write a line with newline
  getXTerm: () => Terminal | null;  // Get raw xterm.js Terminal instance
};
```

### Lazy-Loading Game Assets

Terminal games lazy-load their implementation only when invoked:

```typescript
ctx.registerCommand('snake', {
  description: 'Play Snake',
  handler: async (_args, terminal) => {
    const term = terminal as { getXTerm: () => unknown };
    const xterm = term.getXTerm();
    if (!xterm) return;
    const { startSnake } = await import('@/terminal/games/snake');
    startSnake(xterm as Terminal);
  },
});
```

This keeps the idle-loaded plugin tiny while deferring heavy game code until the user actually runs the command.

---

## Inter-Plugin Communication

### EventBus

The primary communication channel. Plugins publish events and subscribe to them without knowing about each other.

```typescript
// Plugin A (publisher)
ctx.emit('data-loaded', { items: 42 });

// Plugin B (subscriber)
ctx.on('data-loaded', (data) => {
  const { items } = data as { items: number };
});
```

Events are fire-and-forget. Handlers are called synchronously in subscription order. Errors in one handler don't affect others (caught and logged by the EventBus).

### Service Registry

For direct access to capabilities, plugins expose services via `provide`/`consume`. Unlike events (which are ephemeral), services are persistent references.

```typescript
// webgl-galaxy provides the canvas
ctx.provide('canvas', canvasElement);

// galaxy-extras consumes it (declares webgl-galaxy as a dependency)
const canvas = ctx.consume<HTMLCanvasElement>('canvas');
```

**Important:** Services are stored in a shared flat map. Use unique, descriptive keys. The consuming plugin should declare the provider in its `dependencies` array to ensure init order.

### Dependency Declaration

```typescript
const galaxyExtras: EllysPlugin = {
  name: 'galaxy-extras',
  dependencies: ['webgl-galaxy'],  // webgl-galaxy must init first
  loadStrategy: 'idle',
  // ...
};
```

Dependencies are resolved via topological sort. If a dependency hasn't loaded yet when `initPlugin()` runs, it's initialized recursively. Circular dependencies are detected and logged as a warning.
