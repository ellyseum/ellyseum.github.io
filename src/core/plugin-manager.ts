import type { EllysPlugin, PluginLoader, PluginContext, PluginCleanup, TerminalCommand } from './plugin-types';
import type { ThemeId, ThemeManager } from './theme-manager';
import { EventBus } from './event-bus';

interface LoadedPlugin {
  plugin: EllysPlugin;
  cleanup?: PluginCleanup;
  cssElements: HTMLStyleElement[];
}

export class PluginManager {
  private loaded = new Map<string, LoadedPlugin>();
  private services = new Map<string, unknown>();
  private eventBus = new EventBus();
  private frameCallbacks = new Set<() => void>();
  private themeCallbacks = new Set<(theme: ThemeId) => void>();
  private allPlugins = new Map<string, EllysPlugin>();
  private pendingCommands = new Map<string, TerminalCommand>();
  private konamiActive = false;
  private konamiCallbacks: Array<() => void> = [];

  constructor(private themeManager: ThemeManager) {}

  async loadAll(loaders: PluginLoader[]): Promise<void> {
    if (loaders.length === 0) return;

    // Expose core services for plugins
    this.services.set('pendingCommands', this.pendingCommands);
    this.services.set('themeManager', this.themeManager);

    // Resolve all plugin modules in parallel
    const modules = await Promise.allSettled(loaders.map(l => l()));
    const plugins: EllysPlugin[] = [];

    for (let i = 0; i < modules.length; i++) {
      const result = modules[i];
      if (result.status === 'fulfilled') {
        const plugin = result.value.default;
        plugins.push(plugin);
        this.allPlugins.set(plugin.name, plugin);
      } else {
        console.warn('[plugins] Failed to load module:', result.reason);
      }
    }

    const eager = plugins.filter(p => p.loadStrategy === 'eager');
    const idle = plugins.filter(p => p.loadStrategy === 'idle');
    const lazy = plugins.filter(p => p.loadStrategy === 'lazy');

    // Eager: init in dependency order now
    for (const plugin of this.topoSort(eager)) {
      await this.initPlugin(plugin);
    }

    // Idle: init when browser is idle
    if (idle.length > 0) {
      const sorted = this.topoSort(idle);
      const loadIdle = async () => {
        for (const plugin of sorted) await this.initPlugin(plugin);
      };
      if ('requestIdleCallback' in window) {
        requestIdleCallback(() => { loadIdle(); });
      } else {
        setTimeout(loadIdle, 200);
      }
    }

    // Lazy: register triggers
    for (const plugin of lazy) {
      this.setupTrigger(plugin);
    }
  }

  private async initPlugin(plugin: EllysPlugin): Promise<void> {
    if (this.loaded.has(plugin.name)) return;

    // Init dependencies first
    for (const dep of plugin.dependencies ?? []) {
      if (!this.loaded.has(dep)) {
        const depPlugin = this.allPlugins.get(dep);
        if (depPlugin) {
          await this.initPlugin(depPlugin);
        } else {
          console.warn(`[plugins] "${plugin.name}" requires "${dep}" (not registered)`);
        }
      }
    }

    const cssElements: HTMLStyleElement[] = [];
    const ctx = this.createContext(plugin.name, cssElements);

    try {
      const cleanup = await plugin.init(ctx);
      this.loaded.set(plugin.name, {
        plugin,
        cleanup: cleanup ?? undefined,
        cssElements,
      });
    } catch (e) {
      console.error(`[plugins] Failed to init "${plugin.name}":`, e);
    }
  }

  private createContext(name: string, cssElements: HTMLStyleElement[]): PluginContext {
    const tm = this.themeManager;
    const fc = this.frameCallbacks;
    const tc = this.themeCallbacks;
    const eb = this.eventBus;
    const svc = this.services;
    const cmds = this.pendingCommands;

    return {
      get theme() {
        return { current: tm.getTheme(), isClassic: tm.isClassic() };
      },

      onThemeChange: (cb) => { tc.add(cb); return () => { tc.delete(cb); }; },
      onFrame: (cb) => { fc.add(cb); return () => { fc.delete(cb); }; },

      injectCSS: (css) => {
        const el = document.createElement('style');
        el.setAttribute('data-plugin', name);
        el.textContent = css;
        document.head.appendChild(el);
        cssElements.push(el);
        return () => { el.remove(); };
      },

      emit: (event, data) => eb.emit(event, data),
      on: (event, cb) => eb.on(event, cb),
      log: (...args) => console.log(`[${name}]`, ...args),
      provide: (key, value) => { svc.set(key, value); },
      consume: <T = unknown>(key: string) => svc.get(key) as T | undefined,
      registerCommand: (cmdName, command) => {
        cmds.set(cmdName, command);
        eb.emit('command:registered', { name: cmdName, command });
      },
    };
  }

  // --- Trigger setup ---

  private setupTrigger(plugin: EllysPlugin): void {
    const trigger = plugin.trigger;
    if (!trigger) return;

    const load = async () => {
      await this.initPlugin(plugin);
      // Also init lazy dependents sharing this trigger type
      for (const [, p] of this.allPlugins) {
        if (
          p.loadStrategy === 'lazy' &&
          p.dependencies?.includes(plugin.name) &&
          p.trigger?.type === trigger.type &&
          !this.loaded.has(p.name)
        ) {
          await this.initPlugin(p);
        }
      }
    };

    switch (trigger.type) {
      case 'konami':
        this.addKonamiCallback(load);
        break;
      case 'hover':
        if (trigger.target) {
          const el = document.querySelector(trigger.target);
          if (el) el.addEventListener('mouseenter', () => { load(); }, { once: true });
        }
        break;
      case 'theme':
        if (trigger.target) {
          const target = trigger.target as ThemeId;
          if (this.themeManager.getTheme() === target) {
            load();
          } else {
            const unsub = this.addThemeCallback((theme) => {
              if (theme === target) { unsub(); load(); }
            });
          }
        }
        break;
      case 'auth':
        eb_on_once(this.eventBus, 'auth:success', () => { load(); });
        break;
      case 'custom':
        if (trigger.when) trigger.when().then(load);
        break;
    }
  }

  private addThemeCallback(cb: (theme: ThemeId) => void): () => void {
    this.themeCallbacks.add(cb);
    return () => { this.themeCallbacks.delete(cb); };
  }

  private addKonamiCallback(cb: () => void): void {
    this.konamiCallbacks.push(cb);
    if (this.konamiActive) return;
    this.konamiActive = true;

    const KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown',
      'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
    let idx = 0;

    document.addEventListener('keydown', (e) => {
      if (e.key === KONAMI[idx]) {
        idx++;
        if (idx === KONAMI.length) {
          idx = 0;
          const cbs = [...this.konamiCallbacks];
          this.konamiCallbacks = [];
          for (const fn of cbs) fn();
        }
      } else {
        idx = e.key === KONAMI[0] ? 1 : 0;
      }
    });
  }

  // --- Kahn's algorithm topological sort ---

  private topoSort(plugins: EllysPlugin[]): EllysPlugin[] {
    const names = new Set(plugins.map(p => p.name));
    const byName = new Map(plugins.map(p => [p.name, p]));
    const inDeg = new Map<string, number>();
    const deps = new Map<string, string[]>();

    for (const p of plugins) {
      inDeg.set(p.name, 0);
      deps.set(p.name, []);
    }

    for (const p of plugins) {
      for (const d of p.dependencies ?? []) {
        if (names.has(d)) {
          deps.get(d)!.push(p.name);
          inDeg.set(p.name, inDeg.get(p.name)! + 1);
        }
      }
    }

    const queue: string[] = [];
    for (const [name, deg] of inDeg) {
      if (deg === 0) queue.push(name);
    }

    const sorted: EllysPlugin[] = [];
    while (queue.length > 0) {
      const name = queue.shift()!;
      sorted.push(byName.get(name)!);
      for (const dep of deps.get(name)!) {
        const d = inDeg.get(dep)! - 1;
        inDeg.set(dep, d);
        if (d === 0) queue.push(dep);
      }
    }

    if (sorted.length < plugins.length) {
      const cycle = plugins.filter(p => !sorted.some(s => s.name === p.name));
      console.warn('[plugins] Circular dependency:', cycle.map(p => p.name).join(' -> '));
      sorted.push(...cycle);
    }

    return sorted;
  }

  // --- Public API ---

  tick(): void {
    for (const cb of this.frameCallbacks) cb();
  }

  notifyThemeChange(theme: ThemeId): void {
    for (const cb of this.themeCallbacks) cb(theme);
  }

  getPendingCommands(): Map<string, TerminalCommand> {
    return this.pendingCommands;
  }

  isLoaded(name: string): boolean {
    return this.loaded.has(name);
  }

  destroyAll(): void {
    for (const [name, { cleanup, cssElements }] of this.loaded) {
      try {
        cleanup?.();
        for (const el of cssElements) el.remove();
      } catch (e) {
        console.error(`[plugins] Error destroying "${name}":`, e);
      }
    }
    this.loaded.clear();
    this.frameCallbacks.clear();
    this.themeCallbacks.clear();
    this.services.clear();
    this.pendingCommands.clear();
    this.eventBus.clear();
  }
}

/** Subscribe to an event once then auto-unsubscribe */
function eb_on_once(bus: EventBus, event: string, cb: () => void): void {
  const unsub = bus.on(event, () => { unsub(); cb(); });
}
