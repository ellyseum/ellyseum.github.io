import type { EllysPlugin, TerminalCommand } from '@/core/plugin-types';

const KONAMI = [
  'ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown',
  'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight',
  'KeyB', 'KeyA',
];

const konamiTerminal: EllysPlugin = {
  name: 'konami-terminal',
  description: 'Hidden terminal activated by Konami code',
  loadStrategy: 'lazy',
  trigger: {
    type: 'custom',
    when: () => new Promise<void>(resolve => {
      let done = false;
      const fire = () => { if (!done) { done = true; resolve(); } };

      // Debug param
      if (new URLSearchParams(window.location.search).has('terminal')) {
        fire();
        return;
      }

      // Check if previously unlocked (backtick shortcut enabled)
      let unlocked = false;
      try { unlocked = !!sessionStorage.getItem('ellyseum_terminal_unlocked'); } catch {}

      let idx = 0;

      const onKey = (e: KeyboardEvent) => {
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

        // Backtick shortcut (if previously unlocked in this session)
        if (unlocked && e.key === '`') {
          e.preventDefault();
          document.removeEventListener('keydown', onKey);
          fire();
          return;
        }

        // Konami code sequence
        if (e.code === KONAMI[idx]) {
          idx++;
          if (idx === KONAMI.length) {
            document.removeEventListener('keydown', onKey);
            fire();
          }
        } else {
          idx = 0;
        }
      };

      document.addEventListener('keydown', onKey);
    }),
  },

  async init(ctx) {
    const { Terminal } = await import('@/terminal/terminal');
    const { registerPluginCommand } = await import('@/terminal/commands');
    const terminal = new Terminal();
    terminal.open();

    try { sessionStorage.setItem('ellyseum_terminal_unlocked', '1'); } catch {}

    // Drain pending commands registered before terminal loaded
    const pending = ctx.consume<Map<string, TerminalCommand>>('pendingCommands');
    if (pending) {
      for (const [name, cmd] of pending) {
        registerPluginCommand(name, cmd);
      }
      pending.clear();
    }

    // Subscribe to commands registered after terminal loads
    const unsubCommands = ctx.on('command:registered', (data) => {
      const { name, command } = data as { name: string; command: TerminalCommand };
      registerPluginCommand(name, command);
    });

    // Backtick toggle
    const onBacktick = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === '`') {
        e.preventDefault();
        if (terminal.isOpen) terminal.close();
        else terminal.open();
      }
    };
    document.addEventListener('keydown', onBacktick);

    ctx.provide('terminal', terminal);

    return () => {
      document.removeEventListener('keydown', onBacktick);
      unsubCommands();
    };
  },
};

export default konamiTerminal;
