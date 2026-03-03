import type { EllysPlugin } from '@/core/plugin-types';

const terminalGames: EllysPlugin = {
  name: 'terminal-games',
  description: 'Snake, Matrix, and Roguelike terminal games',
  loadStrategy: 'idle',

  async init(ctx) {
    ctx.registerCommand('snake', {
      description: 'Play Snake',
      handler: async (_args, terminal) => {
        const term = terminal as { getXTerm: () => unknown; writeLine: (s: string) => void };
        const xterm = term.getXTerm();
        if (!xterm) return;
        term.writeLine('\x1b[33mLoading Snake...\x1b[0m');
        const { startSnake } = await import('@/terminal/games/snake');
        startSnake(xterm as import('@xterm/xterm').Terminal);
      },
    });

    ctx.registerCommand('matrix', {
      description: 'Enter the Matrix',
      handler: async (_args, terminal) => {
        const term = terminal as { getXTerm: () => unknown; writeLine: (s: string) => void };
        const xterm = term.getXTerm();
        if (!xterm) return;
        term.writeLine('\x1b[32mInitializing Matrix...\x1b[0m');
        const { startMatrix } = await import('@/terminal/games/matrix');
        startMatrix(xterm as import('@xterm/xterm').Terminal);
      },
    });

    ctx.registerCommand('roguelike', {
      description: 'Explore a dungeon',
      handler: async (_args, terminal) => {
        const term = terminal as { getXTerm: () => unknown; writeLine: (s: string) => void };
        const xterm = term.getXTerm();
        if (!xterm) return;
        term.writeLine('\x1b[35mGenerating dungeon...\x1b[0m');
        const { startRoguelike } = await import('@/terminal/games/roguelike');
        startRoguelike(xterm as import('@xterm/xterm').Terminal);
      },
    });
  },
};

export default terminalGames;
