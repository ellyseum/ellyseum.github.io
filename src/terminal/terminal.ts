/**
 * Terminal UI using xterm.js
 * Lazy loaded when Konami code is entered
 */

import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';
import { SITE_CONFIG } from '../data/site-config';
import type { TerminalContext } from './commands';

export type { TerminalContext };

// Commands module - lazy loaded with terminal
let commandsModule: typeof import('./commands') | null = null;

async function getCommands() {
  if (!commandsModule) {
    commandsModule = await import('./commands');
  }
  return commandsModule;
}

async function tryAutoAuth(ctx: TerminalContext): Promise<boolean> {
  const cmds = await getCommands();
  return cmds.tryAutoAuth(ctx);
}

function getWelcomeMessage(): string {
  // Pull from site.yml config if available
  const terminalWelcome = (SITE_CONFIG as Record<string, unknown>).terminal_welcome as string | undefined;

  if (terminalWelcome) {
    return `\n\x1b[35m${terminalWelcome}\x1b[0m\n`;
  }

  // Default welcome with box (xterm needs \r\n)
  return [
    '',
    '\x1b[35m+-------------------------------------------+',
    '|                                           |',
    '|    \x1b[1mEllyseum.me Secret Terminal\x1b[0m\x1b[35m            |',
    '|    Type \x1b[33mhelp\x1b[35m for available commands       |',
    '|                                           |',
    '+-------------------------------------------+\x1b[0m',
    '',
  ].join('\r\n');
}

export class Terminal {
  private container: HTMLDivElement | null = null;
  private xterm: XTerm | null = null;
  private fitAddon: FitAddon | null = null;
  private currentLine = '';
  private commandHistory: string[] = [];
  private historyIndex = -1;
  private cursorPosition = 0;
  private lastRenderedRows = 1;
  private cachedPrompt = '';
  private cachedPromptVisible = 0;
  public isOpen = false;

  private context: TerminalContext = {
    cwd: '/',
    authenticated: false,
    pat: null,
    write: (text: string) => this.write(text),
    writeLine: (text: string) => this.writeLine(text),
    clear: () => this.xterm?.clear(),
    close: () => this.close(),
    getXTerm: () => this.xterm,
  };

  open(): void {
    if (this.isOpen) return;
    this.isOpen = true;
    this.createContainer();
    this.initXTerm();
  }

  close(): void {
    if (!this.isOpen) return;
    this.isOpen = false;

    if (this.xterm) {
      this.xterm.dispose();
      this.xterm = null;
    }

    if (this.container) {
      this.container.remove();
      this.container = null;
    }

    this.fitAddon = null;
  }

  private createContainer(): void {
    this.container = document.createElement('div');
    this.container.id = 'secret-terminal';
    // Title pulls the site domain from SITE_CONFIG so forks see their
    // own domain in the chrome rather than the template's.
    const siteDomain = (SITE_CONFIG as Record<string, unknown>).domain as string | undefined;
    const title = siteDomain ? `~/${siteDomain}` : '~/blog';
    this.container.innerHTML = `
      <div class="terminal-backdrop"></div>
      <div class="terminal-window">
        <div class="terminal-header">
          <span class="terminal-title">${title}</span>
          <button class="terminal-close" aria-label="Close terminal">×</button>
        </div>
        <div class="terminal-body"></div>
      </div>
    `;

    // Add styles
    const style = document.createElement('style');
    style.textContent = `
      #secret-terminal {
        position: fixed;
        inset: 0;
        z-index: 10000;
        display: flex;
        align-items: center;
        justify-content: center;
        animation: terminalFadeIn 0.2s ease-out;
      }

      @keyframes terminalFadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }

      .terminal-backdrop {
        position: absolute;
        inset: 0;
        background: rgba(0, 0, 0, 0.85);
        backdrop-filter: blur(4px);
      }

      .terminal-window {
        position: relative;
        width: min(900px, 90vw);
        height: min(600px, 80vh);
        background: #0a0a0f;
        border: 1px solid #333;
        border-radius: 8px;
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.8);
        display: flex;
        flex-direction: column;
        animation: terminalSlideIn 0.3s ease-out;
      }

      @keyframes terminalSlideIn {
        from {
          opacity: 0;
          transform: scale(0.95) translateY(10px);
        }
        to {
          opacity: 1;
          transform: scale(1) translateY(0);
        }
      }

      .terminal-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 8px 12px;
        background: #1a1a24;
        border-bottom: 1px solid #333;
        border-radius: 8px 8px 0 0;
      }

      .terminal-title {
        font-family: monospace;
        font-size: 13px;
        color: #9ca3af;
      }

      .terminal-close {
        background: none;
        border: none;
        color: #9ca3af;
        font-size: 20px;
        cursor: pointer;
        padding: 0 4px;
        line-height: 1;
        transition: color 0.15s;
      }

      .terminal-close:hover {
        color: #ef4444;
      }

      .terminal-body {
        flex: 1;
        overflow: hidden;
        background: #0a0a0f;
      }

      .terminal-body .xterm {
        height: 100%;
        /* Extend xterm past container edges so canvas covers "padding" */
        margin-left: -16px;
        margin-right: -16px;
        padding-left: 16px;
        padding-right: 16px;
        width: calc(100% + 32px);
        box-sizing: border-box;
      }

      .terminal-body .xterm-viewport {
        overflow-y: auto !important;
      }
    `;
    this.container.appendChild(style);

    // Event handlers
    this.container.querySelector('.terminal-backdrop')?.addEventListener('click', () => this.close());
    this.container.querySelector('.terminal-close')?.addEventListener('click', () => this.close());

    // ESC to close
    const escHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && this.isOpen) {
        this.close();
        document.removeEventListener('keydown', escHandler);
      }
    };
    document.addEventListener('keydown', escHandler);

    document.body.appendChild(this.container);
  }

  private async initXTerm(): Promise<void> {
    const terminalBody = this.container?.querySelector('.terminal-body');
    if (!terminalBody) return;

    this.xterm = new XTerm({
      scrollback: 1000,
      theme: {
        background: '#0a0a0f',
        foreground: '#e5e7eb',
        cursor: '#a855f7',
        cursorAccent: '#0a0a0f',
        selectionBackground: '#a855f766',
        black: '#1f2937',
        red: '#ef4444',
        green: '#22c55e',
        yellow: '#eab308',
        blue: '#3b82f6',
        magenta: '#a855f7',
        cyan: '#06b6d4',
        white: '#e5e7eb',
        brightBlack: '#6b7280',
        brightRed: '#f87171',
        brightGreen: '#4ade80',
        brightYellow: '#facc15',
        brightBlue: '#60a5fa',
        brightMagenta: '#c084fc',
        brightCyan: '#22d3ee',
        brightWhite: '#f9fafb',
      },
      fontFamily: '"JetBrains Mono", "Fira Code", Consolas, monospace',
      fontSize: 14,
      lineHeight: 1.2,
      cursorBlink: true,
      cursorStyle: 'block',
      allowProposedApi: true,
    });

    this.fitAddon = new FitAddon();
    this.xterm.loadAddon(this.fitAddon);
    this.xterm.loadAddon(new WebLinksAddon());

    this.xterm.open(terminalBody as HTMLElement);
    this.fitAddon.fit();

    // Handle resize
    const resizeObserver = new ResizeObserver(() => {
      this.fitAddon?.fit();
    });
    resizeObserver.observe(terminalBody);

    // Welcome message
    this.xterm.write(getWelcomeMessage());

    // Try auto-auth from localStorage
    const wasAutoAuthed = await tryAutoAuth(this.context);
    if (wasAutoAuthed) {
      this.xterm?.write('\x1b[32m✓ Restored session\x1b[0m \x1b[90m(use \x1b[33mlogout\x1b[90m to clear)\x1b[0m\r\n');
    }

    await this.writePrompt();

    // Handle input - onData receives both typed keys and pasted text
    this.xterm.onData(this.handleInput.bind(this));

    // Let browser handle Ctrl+V natively - xterm picks up the paste and sends via onData
    this.xterm.attachCustomKeyEventHandler((e: KeyboardEvent) => {
      if (e.type === 'keydown' && e.ctrlKey && e.key === 'v') {
        return false; // Let browser paste, xterm sends it through onData
      }
      return true;
    });

    // Auto-copy selection to clipboard on mouse up
    this.xterm.onSelectionChange(() => {
      const selection = this.xterm?.getSelection();
      if (selection) {
        navigator.clipboard.writeText(selection).catch(() => {});
      }
    });

    // Click on padding area focuses xterm
    terminalBody.addEventListener('mousedown', (e) => {
      if (e.target === terminalBody) {
        this.xterm?.focus();
      }
    });

    this.xterm.focus();
  }

  private insertText(text: string): void {
    const cleaned = text.replace(/[\r\n]/g, '');
    if (cleaned) {
      this.currentLine =
        this.currentLine.slice(0, this.cursorPosition) +
        cleaned +
        this.currentLine.slice(this.cursorPosition);
      this.cursorPosition += cleaned.length;
      this.refreshLine();
    }
  }

  private handleInput(data: string): void {
    if (!this.xterm) return;

    // Multi-character input that isn't an escape sequence = paste via onData
    if (data.length > 1 && !data.startsWith('\x1b')) {
      this.insertText(data);
      return;
    }

    for (const char of data) {
      switch (char) {
        case '\r': // Enter
          this.xterm.write('\r\n');
          this.processCommand();
          break;

        case '\x7f': // Backspace
          if (this.cursorPosition > 0) {
            this.currentLine =
              this.currentLine.slice(0, this.cursorPosition - 1) +
              this.currentLine.slice(this.cursorPosition);
            this.cursorPosition--;
            this.refreshLine();
          }
          break;

        case '\x1b[A': // Up arrow
          if (this.historyIndex < this.commandHistory.length - 1) {
            this.historyIndex++;
            this.currentLine = this.commandHistory[this.commandHistory.length - 1 - this.historyIndex] || '';
            this.cursorPosition = this.currentLine.length;
            this.refreshLine();
          }
          break;

        case '\x1b[B': // Down arrow
          if (this.historyIndex > 0) {
            this.historyIndex--;
            this.currentLine = this.commandHistory[this.commandHistory.length - 1 - this.historyIndex] || '';
            this.cursorPosition = this.currentLine.length;
            this.refreshLine();
          } else if (this.historyIndex === 0) {
            this.historyIndex = -1;
            this.currentLine = '';
            this.cursorPosition = 0;
            this.refreshLine();
          }
          break;

        case '\x1b[C': // Right arrow
          if (this.cursorPosition < this.currentLine.length) {
            this.cursorPosition++;
            this.xterm.write('\x1b[C');
          }
          break;

        case '\x1b[D': // Left arrow
          if (this.cursorPosition > 0) {
            this.cursorPosition--;
            this.xterm.write('\x1b[D');
          }
          break;

        case '\x03': // Ctrl+C - copy if selection, else cancel line
          {
            const selection = this.xterm.getSelection();
            if (selection) {
              navigator.clipboard.writeText(selection).catch(() => {});
              this.xterm.clearSelection();
            } else {
              this.xterm.write('^C\r\n');
              this.currentLine = '';
              this.cursorPosition = 0;
              this.writePrompt();
            }
          }
          break;

        case '\x0c': // Ctrl+L
          this.xterm.clear();
          this.writePrompt();
          this.xterm.write(this.currentLine);
          break;

        default:
          // Handle escape sequences
          if (char.startsWith('\x1b')) {
            // Ignore unhandled escape sequences
            break;
          }
          // Regular character
          if (char >= ' ') {
            this.currentLine =
              this.currentLine.slice(0, this.cursorPosition) +
              char +
              this.currentLine.slice(this.cursorPosition);
            this.cursorPosition++;
            this.refreshLine();
          }
          break;
      }
    }
  }

  private refreshLine(): void {
    if (!this.xterm) return;
    const cols = this.xterm.cols;
    const totalLen = this.cachedPromptVisible + this.currentLine.length;
    const newRows = Math.max(1, Math.ceil(totalLen / cols));
    // Build entire update as a single string for atomic rendering
    let buf = '';
    // Move up to prompt start based on PREVIOUS row count
    const moveUp = this.lastRenderedRows - 1;
    if (moveUp > 0) {
      buf += `\x1b[${moveUp}A`;
    }
    // Clear from prompt start to end of screen, write fresh content
    buf += '\r\x1b[J' + this.cachedPrompt + this.currentLine;
    // Move cursor to correct position
    const moveBack = this.currentLine.length - this.cursorPosition;
    if (moveBack > 0) {
      buf += `\x1b[${moveBack}D`;
    }
    // Single atomic write - no flicker
    this.xterm.write(buf);
    this.lastRenderedRows = newRows;
  }

  private async processCommand(): Promise<void> {
    const command = this.currentLine.trim();
    this.currentLine = '';
    this.cursorPosition = 0;
    this.historyIndex = -1;
    this.lastRenderedRows = 1;

    if (command) {
      this.commandHistory.push(command);
      const cmds = await getCommands();
      await cmds.executeCommand(command, this.context);
    }

    if (this.isOpen) {
      await this.writePrompt();
    }
  }

  private async writePrompt(): Promise<void> {
    const cmds = await getCommands();
    this.cachedPrompt = cmds.getPrompt(this.context);
    this.cachedPromptVisible = this.cachedPrompt.replace(/\x1b\[[0-9;]*m/g, '').length;
    this.write(this.cachedPrompt);
  }

  write(text: string): void {
    this.xterm?.write(text);
  }

  writeLine(text: string): void {
    // Replace any \n with \r\n for xterm, then add final \r\n
    const normalized = text.replace(/\r?\n/g, '\r\n');
    this.xterm?.write(normalized + '\r\n');
  }
}
