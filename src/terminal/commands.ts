/**
 * Terminal commands
 * Lazy loaded with terminal module
 *
 * Layer 2 (terminal) commands are here
 * Layer 3 (editor/github) lazy loaded on auth
 */

import type { Terminal as XTerm } from '@xterm/xterm';

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

// Layer 3 modules - lazy loaded on auth
let githubModule: typeof import('./github') | null = null;
let editorModule: typeof import('./editor') | null = null;
let githubClient: import('./github').GitHubClient | null = null;

async function loadAuthModules() {
  if (!githubModule) {
    githubModule = await import('./github');
  }
  if (!editorModule) {
    editorModule = await import('./editor');
  }
  return { githubModule, editorModule };
}

// Check for saved auth and restore it
export async function tryAutoAuth(ctx: TerminalContext): Promise<boolean> {
  try {
    const savedToken = localStorage.getItem('_ep');
    if (!savedToken) return false;

    const { githubModule: gh } = await loadAuthModules();
    githubClient = new gh.GitHubClient(savedToken);
    const valid = await githubClient.validateToken();

    if (valid) {
      ctx.authenticated = true;
      ctx.pat = savedToken;
      return true;
    } else {
      // Token expired or revoked, clear it
      localStorage.removeItem('_ep');
      githubClient = null;
      return false;
    }
  } catch {
    return false;
  }
}

// Games - lazy loaded on demand
async function loadSnake() {
  const { startSnake } = await import('./games/snake');
  return startSnake;
}

async function loadMatrix() {
  const { startMatrix } = await import('./games/matrix');
  return startMatrix;
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

      // If authenticated, fetch from GitHub
      if (ctx.authenticated && githubClient) {
        try {
          const content = await githubClient.getFileContent(path);
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

  // Games - lazy loaded
  snake: {
    description: 'Play Snake',
    handler: async (_, ctx) => {
      const xterm = ctx.getXTerm();
      if (xterm) {
        ctx.writeLine('\x1b[33mLoading Snake...\x1b[0m');
        const startSnake = await loadSnake();
        startSnake(xterm);
      }
    },
  },

  matrix: {
    description: 'Enter the Matrix',
    handler: async (_, ctx) => {
      const xterm = ctx.getXTerm();
      if (xterm) {
        ctx.writeLine('\x1b[32mInitializing Matrix...\x1b[0m');
        const startMatrix = await loadMatrix();
        startMatrix(xterm);
      }
    },
  },

  // Authentication - loads Layer 3
  auth: {
    description: 'Authenticate with GitHub PAT',
    usage: '<token>',
    hidden: true,
    handler: async (args, ctx) => {
      if (!args[0]) {
        ctx.writeLine('Usage: auth <github_pat>');
        ctx.writeLine('\x1b[90mToken will be saved for future sessions\x1b[0m');
        return;
      }

      const token = args[0];
      ctx.writeLine('Authenticating...');

      try {
        // Lazy load Layer 3 modules
        const { githubModule: gh } = await loadAuthModules();

        githubClient = new gh.GitHubClient(token);
        const valid = await githubClient.validateToken();

        if (valid) {
          ctx.authenticated = true;
          ctx.pat = token;
          // Store in localStorage for future sessions
          try {
            localStorage.setItem('_ep', token);
          } catch {
            // localStorage might be unavailable
          }
          ctx.writeLine('\x1b[32m✓ Authentication successful\x1b[0m');
          ctx.writeLine('\x1b[90mNew commands unlocked: edit, new, publish, rm\x1b[0m');
          ctx.writeLine('\x1b[90mType \x1b[33mhelp\x1b[90m to see all commands. Use \x1b[33mlogout\x1b[90m to clear saved token.\x1b[0m');
          // Inject edit button on post pages
          import('../edit-button').then(m => m.initEditButton()).catch(() => {});
        } else {
          githubClient = null;
          ctx.writeLine('\x1b[31m✗ Invalid token or insufficient permissions\x1b[0m');
        }
      } catch (e) {
        githubClient = null;
        ctx.writeLine(`\x1b[31m✗ Authentication failed: ${e instanceof Error ? e.message : 'Unknown error'}\x1b[0m`);
      }
    },
  },

  logout: {
    description: 'Clear saved authentication',
    hidden: true,
    handler: (_, ctx) => {
      ctx.authenticated = false;
      ctx.pat = null;
      githubClient = null;
      try {
        localStorage.removeItem('_ep');
      } catch {
        // localStorage might be unavailable
      }
      ctx.writeLine('\x1b[33m✓ Logged out. Token cleared from storage.\x1b[0m');
    },
  },

  // Authenticated commands (Layer 3)
  edit: {
    description: 'Edit current page',
    usage: '[path]',
    requiresAuth: true,
    handler: async (args, ctx) => {
      if (!githubClient) {
        ctx.writeLine('\x1b[31mNot authenticated. Use: auth <token>\x1b[0m');
        return;
      }

      const { editorModule: editor } = await loadAuthModules();
      const path = args[0] || window.location.pathname;
      ctx.writeLine(`Opening editor for ${path}...`);

      try {
        const content = await githubClient.getFileContent(path);
        if (content !== null) {
          editor.openEditor({
            path,
            content,
            github: githubClient,
            onSave: () => {
              ctx.writeLine(`\x1b[32m✓ Saved ${path}\x1b[0m`);
            },
          });
        } else {
          ctx.writeLine(`\x1b[31mCould not find source for ${path}\x1b[0m`);
        }
      } catch (e) {
        ctx.writeLine(`\x1b[31mError: ${e instanceof Error ? e.message : 'Unknown error'}\x1b[0m`);
      }
    },
  },

  new: {
    description: 'Create a new draft',
    usage: '<"Title">',
    requiresAuth: true,
    handler: async (args, ctx) => {
      if (!githubClient) {
        ctx.writeLine('\x1b[31mNot authenticated\x1b[0m');
        return;
      }

      const { editorModule: editor } = await loadAuthModules();

      const title = args.join(' ').replace(/^["']|["']$/g, '');
      if (!title) {
        ctx.writeLine('Usage: new "Post Title"');
        return;
      }

      const slug = title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');

      const date = new Date().toISOString().split('T')[0];
      const filename = `${date}-${slug}.md`;

      const template = `---
layout: post
title: "${title}"
subtitle: ""
date: ${date}
tags: []
draft: true
---

`;

      ctx.writeLine(`Creating draft: ${filename}...`);

      editor.openEditor({
        path: `/_drafts/${filename}`,
        content: template,
        github: githubClient,
        isNew: true,
        onSave: () => {
          ctx.writeLine(`\x1b[32m✓ Created draft ${filename}\x1b[0m`);
        },
      });
    },
  },

  publish: {
    description: 'Publish a draft',
    usage: '<slug>',
    requiresAuth: true,
    handler: async (args, ctx) => {
      if (!githubClient) {
        ctx.writeLine('\x1b[31mNot authenticated\x1b[0m');
        return;
      }

      if (!args[0]) {
        ctx.writeLine('Usage: publish <slug>');
        return;
      }

      const slug = args[0];
      ctx.writeLine(`Publishing ${slug}...`);

      try {
        await githubClient.publishDraft(slug);
        ctx.writeLine(`\x1b[32m✓ Published ${slug}\x1b[0m`);
      } catch (e) {
        ctx.writeLine(`\x1b[31mError: ${e instanceof Error ? e.message : 'Unknown error'}\x1b[0m`);
      }
    },
  },

  rm: {
    description: 'Remove a post',
    usage: '<slug>',
    requiresAuth: true,
    handler: async (args, ctx) => {
      if (!githubClient) {
        ctx.writeLine('\x1b[31mNot authenticated\x1b[0m');
        return;
      }

      if (!args[0]) {
        ctx.writeLine('Usage: rm <slug>');
        return;
      }

      const slug = args[0];
      ctx.writeLine(`\x1b[33mDeleting ${slug}...\x1b[0m`);

      try {
        await githubClient.deletePost(slug);
        ctx.writeLine(`\x1b[32m✓ Deleted ${slug}\x1b[0m`);
      } catch (e) {
        ctx.writeLine(`\x1b[31mError: ${e instanceof Error ? e.message : 'Unknown error'}\x1b[0m`);
      }
    },
  },

  save: {
    description: 'Quick save (use after edit)',
    requiresAuth: true,
    handler: (_, ctx) => {
      ctx.writeLine('\x1b[90mUse the Save button in the editor, or edit → make changes → save\x1b[0m');
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
