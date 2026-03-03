import type { ThemeId } from './theme-manager';

export type PluginCleanup = () => void;
export type PluginLoadStrategy = 'eager' | 'idle' | 'lazy';

export interface PluginTrigger {
  type: 'konami' | 'hover' | 'auth' | 'theme' | 'custom';
  /** CSS selector (hover) or theme ID (theme) */
  target?: string;
  /** Custom trigger - resolves when plugin should load */
  when?: () => Promise<void>;
}

export interface TerminalCommand {
  description: string;
  usage?: string;
  hidden?: boolean;
  requiresAuth?: boolean;
  handler(args: string[], terminal: unknown): Promise<void> | void;
}

export interface EllysPlugin {
  name: string;
  description?: string;
  dependencies?: string[];
  loadStrategy: PluginLoadStrategy;
  trigger?: PluginTrigger;
  init(ctx: PluginContext): Promise<PluginCleanup | void>;
}

export interface PluginContext {
  /** Current theme state (live reads from ThemeManager) */
  readonly theme: { readonly current: ThemeId; readonly isClassic: boolean };
  /** Subscribe to theme changes, returns unsubscribe */
  onThemeChange(cb: (theme: ThemeId) => void): () => void;
  /** Register a frame callback (called every rAF), returns unsubscribe */
  onFrame(cb: () => void): () => void;
  /** Inject CSS into document head, returns removal function */
  injectCSS(css: string): () => void;
  /** Emit event on shared bus */
  emit(event: string, data?: unknown): void;
  /** Subscribe to event, returns unsubscribe */
  on(event: string, cb: (data?: unknown) => void): () => void;
  /** Namespaced console.log */
  log(...args: unknown[]): void;
  /** Provide a service for dependent plugins */
  provide(key: string, value: unknown): void;
  /** Consume a service from a dependency */
  consume<T = unknown>(key: string): T | undefined;
  /** Register a terminal command (queued until konami-terminal loads) */
  registerCommand(name: string, command: TerminalCommand): void;
}

export type PluginLoader = () => Promise<{ default: EllysPlugin }>;

export interface EllysConfig {
  plugins: PluginLoader[];
}
