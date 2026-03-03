import type { EllysConfig } from '@/core/plugin-types';

const config: EllysConfig = {
  plugins: [
    // Plugins will be added here as they're extracted from the monolith.
    // Comment out a line = disable a plugin. Fork and delete = minimal blog.
    //
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

export default config;
