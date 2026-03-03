/**
 * Ellyseum - Plugin-based blog with progressive enhancement
 */

import { ThemeManager } from '@/core/theme-manager';
import { PluginManager } from '@/core/plugin-manager';
import { initThemeSwitcher } from '@/components/theme-switcher';
import { initPostNavSticky } from '@/components/post-nav-sticky';
import { initBackToTop } from '@/components/back-to-top';
import { initCodeCopy } from '@/components/code-copy';
import { SearchFilter } from '@/components/search-filter';
import config from '@/ellyseum.config';

// Console easter egg (konami detection is in the konami-terminal plugin)
console.log(
  `%c___________.__  .__\n\\_   _____/|  | |  | ___.__. ______ ____  __ __  _____        _____   ____\n |    __)_ |  | |  |<   |  |/  ___// __ \\\\|  |  \\\\/     \\\\      /     \\\\_/ __ \\\\\n |        \\\\|  |_|  |_\\\\___  |\\\\___ \\\\\\\\  ___/|  |  /  Y Y  \\\\    |  Y Y  \\\\  ___/\n/_______  /|____/____/ ____/____  >\\\\___  >____/|__|_|  / /\\\\ |__|_|  /\\\\___  >\n        \\\\/           \\\\/         \\\\/     \\\\/            \\\\/  \\\\/       \\\\/     \\\\/\n%c=--=--==---=-==--=--=-=-==--=-=--==--=-=--=-==--=-=--==--=--==---=-==--=--==\n\n%c        Looking for secrets? What a CONTRArian.\n        Hint: This code is open source — check the header.`,
  'color: #a855f7; font-family: monospace; font-size: 10px; line-height: 1.1;',
  'color: #6b7280; font-family: monospace; font-size: 10px;',
  'color: #9ca3af; font-family: monospace; font-size: 11px;',
);

// Theme manager
let pluginManager: PluginManager | null = null;

const themeManager = new ThemeManager((theme) => {
  pluginManager?.notifyThemeChange(theme);
});

themeManager.applyTheme();
initThemeSwitcher(themeManager);

// Classic themes: mark loaded immediately (no WebGL to wait for)
if (themeManager.isClassic() || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  document.body.classList.add('loaded');
}

// Core components (work for all themes)
function initCoreComponents(): void {
  initPostNavSticky();
  initCodeCopy();
  if (document.querySelector('.site-content #posts-data')) {
    const sf = new SearchFilter();
    sf.init();
  }
}

initBackToTop();
initCoreComponents();

// Reinit core components after SPA navigation
window.addEventListener('ellyseum:navigate', () => {
  initCoreComponents();
});

// Plugin system + frame loop
pluginManager = new PluginManager(themeManager);
pluginManager.loadAll(config.plugins);

(function animate() {
  pluginManager!.tick();
  requestAnimationFrame(animate);
})();
