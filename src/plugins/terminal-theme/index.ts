import type { EllysPlugin } from '@/core/plugin-types';
import { THEMES } from '@/core/theme-manager';
import type { ThemeId, ThemeManager } from '@/core/theme-manager';

const validThemes = THEMES.map(t => t.id);

const terminalTheme: EllysPlugin = {
  name: 'terminal-theme',
  description: 'Switch themes from the terminal',
  loadStrategy: 'idle',

  async init(ctx) {
    ctx.registerCommand('theme', {
      description: 'Switch site theme',
      usage: `<${validThemes.join('|')}>`,
      handler(args, terminal) {
        const term = terminal as { writeLine: (s: string) => void };

        if (!args[0]) {
          term.writeLine(`Current theme: \x1b[35m${ctx.theme.current}\x1b[0m`);
          term.writeLine(`Available: ${validThemes.join(', ')}`);
          return;
        }

        const target = args[0].toLowerCase() as ThemeId;
        if (!validThemes.includes(target)) {
          term.writeLine(`\x1b[31mUnknown theme: ${args[0]}\x1b[0m`);
          term.writeLine(`Available: ${validThemes.join(', ')}`);
          return;
        }

        if (target === ctx.theme.current) {
          term.writeLine(`Already using \x1b[35m${target}\x1b[0m`);
          return;
        }

        const tm = ctx.consume<ThemeManager>('themeManager');
        if (!tm) {
          term.writeLine('\x1b[31mTheme manager not available\x1b[0m');
          return;
        }

        term.writeLine(`Switching to \x1b[35m${target}\x1b[0m...`);
        tm.setTheme(target);
      },
    });
  },
};

export default terminalTheme;
