/**
 * Terminal commands
 * Lazy loaded with terminal module
 *
 * Core Layer 2 commands live here.
 * Auth/CMS commands provided by github-cms plugin.
 * Games provided by terminal-games plugin.
 */

import type { Terminal as XTerm } from '@xterm/xterm';
import type { TerminalCommand } from '../core/plugin-types';

export interface TerminalContext {
  cwd: string;
  authenticated: boolean;
  pat: string | null;
  write: (text: string) => void;
  writeLine: (text: string) => void;
  clear: () => void;
  close: () => void;
  getXTerm: () => XTerm | null;
}

type CommandHandler = (args: string[], ctx: TerminalContext) => Promise<void> | void;

interface Command {
  description: string;
  usage?: string;
  handler: CommandHandler;
  requiresAuth?: boolean;
  hidden?: boolean;
}

// Track which commands were registered by plugins
const pluginCommandNames = new Set<string>();

/** Register a command from a plugin. Adapts TerminalCommand to internal Command type. */
export function registerPluginCommand(name: string, cmd: TerminalCommand): void {
  const adapted: Command = {
    description: cmd.description,
    usage: cmd.usage,
    hidden: cmd.hidden,
    requiresAuth: cmd.requiresAuth,
    handler: (args, ctx) => cmd.handler(args, ctx),
  };
  commands[name] = adapted;
  pluginCommandNames.add(name);
}

/** Remove a plugin-registered command. */
export function unregisterCommand(name: string): void {
  if (pluginCommandNames.has(name)) {
    delete commands[name];
    pluginCommandNames.delete(name);
  }
}

/** Check for saved auth and restore session state. */
export async function tryAutoAuth(ctx: TerminalContext): Promise<boolean> {
  try {
    const savedToken = localStorage.getItem('_ep');
    if (!savedToken) return false;

    const { GitHubClient } = await import('./github');
    const client = new GitHubClient(savedToken);
    const valid = await client.validateToken();

    if (valid) {
      ctx.authenticated = true;
      ctx.pat = savedToken;
      (window as unknown as Record<string, unknown>).__githubClient = client;
      return true;
    } else {
      localStorage.removeItem('_ep');
      return false;
    }
  } catch {
    return false;
  }
}

const commands: Record<string, Command> = {
  help: {
    description: 'Show available commands',
    handler: (_args, ctx) => {
      ctx.writeLine('\n\x1b[1mAvailable commands:\x1b[0m\n');

      const publicCmds = Object.entries(commands)
        .filter(([_, cmd]) => !cmd.requiresAuth && !cmd.hidden)
        .sort(([a], [b]) => a.localeCompare(b));

      for (const [name, cmd] of publicCmds) {
        const usage = cmd.usage ? ` ${cmd.usage}` : '';
        ctx.writeLine(`  \x1b[33m${name}\x1b[0m${usage}`);
        ctx.writeLine(`      ${cmd.description}`);
      }

      if (ctx.authenticated) {
        ctx.writeLine('\n\x1b[1m\x1b[32mAuthenticated commands:\x1b[0m\n');
        const authCmds = Object.entries(commands)
          .filter(([_, cmd]) => cmd.requiresAuth)
          .sort(([a], [b]) => a.localeCompare(b));

        for (const [name, cmd] of authCmds) {
          const usage = cmd.usage ? ` ${cmd.usage}` : '';
          ctx.writeLine(`  \x1b[32m${name}\x1b[0m${usage}`);
          ctx.writeLine(`      ${cmd.description}`);
        }
      } else {
        ctx.writeLine('\n\x1b[90mHint: There may be more commands for those who are worthy...\x1b[0m');
      }

      ctx.writeLine('');
    },
  },

  clear: {
    description: 'Clear the terminal',
    handler: (_, ctx) => ctx.clear(),
  },

  exit: {
    description: 'Close the terminal',
    handler: (_, ctx) => ctx.close(),
  },

  whoami: {
    description: 'Who are you?',
    handler: (_, ctx) => {
      if (ctx.authenticated) {
        ctx.writeLine(`\x1b[32m✓ Authenticated\x1b[0m — you have the power`);
      } else {
        ctx.writeLine('Just another curious visitor... or are you?');
      }
    },
  },

  ls: {
    description: 'List posts',
    usage: '[path]',
    handler: async (_args, ctx) => {
      // Get posts from the page
      const posts = Array.from(document.querySelectorAll('article a, .post-list a, .posts a'))
        .map(a => ({
          href: (a as HTMLAnchorElement).href,
          title: a.textContent?.trim() || 'Untitled',
        }))
        .filter(p => p.href.includes('/posts/') || p.href.match(/\/\d{4}\//));

      if (posts.length === 0) {
        const path = window.location.pathname;
        ctx.writeLine(`\x1b[36m.\x1b[0m  ${path}`);
        return;
      }

      for (const post of posts.slice(0, 20)) {
        const slug = new URL(post.href).pathname;
        ctx.writeLine(`\x1b[36m${slug}\x1b[0m`);
        ctx.writeLine(`  ${post.title}`);
      }

      if (posts.length > 20) {
        ctx.writeLine(`\x1b[90m... and ${posts.length - 20} more\x1b[0m`);
      }
    },
  },

  cat: {
    description: 'Show current page source',
    usage: '[path]',
    handler: async (args, ctx) => {
      const path = args[0] || window.location.pathname;

      // If authenticated, fetch from GitHub (client set by github-cms plugin)
      const ghClient = (window as unknown as Record<string, unknown>).__githubClient as
        import('./github').GitHubClient | undefined;
      if (ctx.authenticated && ghClient) {
        try {
          const content = await ghClient.getFileContent(path);
          if (content) {
            ctx.writeLine('');
            ctx.writeLine(content);
            return;
          }
        } catch {
          // Fall through to page content
        }
      }

      // Show page content
      const article = document.querySelector('article, main, .post-content');
      if (article) {
        ctx.writeLine('');
        ctx.writeLine(article.textContent?.trim() || 'No content found');
      } else {
        ctx.writeLine('No content found on this page');
      }
    },
  },

  cd: {
    description: 'Navigate to a post',
    usage: '<path>',
    handler: (args, ctx) => {
      if (!args[0]) {
        ctx.writeLine('Usage: cd <path>');
        return;
      }

      let path = args[0];

      // Handle relative paths
      if (!path.startsWith('/')) {
        path = '/' + path;
      }

      ctx.writeLine(`Navigating to ${path}...`);
      window.location.href = path;
    },
  },

  pwd: {
    description: 'Print current path',
    handler: (_, ctx) => {
      ctx.writeLine(window.location.pathname);
    },
  },

  // Fun commands
  sudo: {
    description: 'Nice try',
    handler: (_, ctx) => {
      ctx.writeLine('\x1b[31mNice try.\x1b[0m');
    },
  },

};

// Hidden easter egg commands
const easterEggs: Record<string, CommandHandler> = {
  'rm -rf /': async (_, ctx) => {
    ctx.writeLine('\x1b[31m');
    ctx.writeLine('Initiating total destruction...');
    await sleep(400);
    ctx.writeLine('Deleting node_modules... (this might take a while)');
    await sleep(600);
    ctx.writeLine('Deleting .git history...');
    await sleep(400);
    ctx.writeLine('Deleting your browser history...');
    await sleep(400);
    ctx.writeLine('Deleting your search history...');
    await sleep(300);
    ctx.writeLine('Deleting your memories...');
    await sleep(500);
    ctx.writeLine('\x1b[0m');
    ctx.writeLine('...just kidding. I would never. 💜');
  },

  'make me a sandwich': (_, ctx) => {
    ctx.writeLine('What? Make it yourself.');
  },

  'sudo make me a sandwich': (_, ctx) => {
    ctx.writeLine('🥪 Okay.');
  },

  hello: (_, ctx) => {
    ctx.writeLine('Hey there! 👋');
  },

  hi: (_, ctx) => {
    ctx.writeLine('Hello! 👋');
  },

  ping: (_, ctx) => {
    ctx.writeLine('pong 🏓');
  },

  lol: (_, ctx) => {
    ctx.writeLine('😂');
  },

  '': () => {
    // Do nothing for empty command
  },
};

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function getPrompt(ctx: TerminalContext): string {
  const authIndicator = ctx.authenticated ? '\x1b[32m✓\x1b[0m ' : '';
  return `${authIndicator}\x1b[35mellyseum\x1b[0m:\x1b[36m${ctx.cwd}\x1b[0m$ `;
}

export async function executeCommand(input: string, ctx: TerminalContext): Promise<void> {
  const trimmed = input.trim();

  // Check easter eggs first (exact match)
  if (easterEggs[trimmed]) {
    await easterEggs[trimmed]([], ctx);
    return;
  }

  // Parse command and args
  const parts = trimmed.match(/(?:[^\s"]+|"[^"]*")+/g) || [];
  const commandName = parts[0]?.toLowerCase() || '';
  const args = parts.slice(1).map(arg => arg.replace(/^"|"$/g, ''));

  // Check for rm -rf style commands
  if (commandName === 'rm' && args.some(a => a.includes('rf') || a.includes('-r'))) {
    await easterEggs['rm -rf /']!(args, ctx);
    return;
  }

  const command = commands[commandName];

  if (!command) {
    ctx.writeLine(`\x1b[31mCommand not found: ${commandName}\x1b[0m`);
    ctx.writeLine(`Type \x1b[33mhelp\x1b[0m for available commands`);
    return;
  }

  if (command.requiresAuth && !ctx.authenticated) {
    ctx.writeLine(`\x1b[31mAuthentication required\x1b[0m`);
    return;
  }

  try {
    await command.handler(args, ctx);
  } catch (e) {
    ctx.writeLine(`\x1b[31mError: ${e instanceof Error ? e.message : 'Unknown error'}\x1b[0m`);
  }
}
