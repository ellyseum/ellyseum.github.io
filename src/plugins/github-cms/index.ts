import type { EllysPlugin } from '@/core/plugin-types';
import type { TerminalContext } from '@/terminal/commands';
import type { GitHubClient } from '@/terminal/github';

const githubCms: EllysPlugin = {
  name: 'github-cms',
  description: 'GitHub-backed headless CMS (auth, editor, edit button, pending edits)',
  loadStrategy: 'idle',

  async init(ctx) {
    // Module state (owned by this plugin's closure)
    let githubClient: GitHubClient | null = null;

    async function getOrCreateClient(token: string): Promise<GitHubClient> {
      if (githubClient) return githubClient;
      const { GitHubClient: GH } = await import('@/terminal/github');
      githubClient = new GH(token);
      (window as unknown as Record<string, unknown>).__githubClient = githubClient;
      return githubClient;
    }

    function clearClient(): void {
      githubClient = null;
      delete (window as unknown as Record<string, unknown>).__githubClient;
    }

    // --- Pending edits indicator (no auth needed) ---
    try {
      const edits = JSON.parse(localStorage.getItem('ellyseum_pending_edits') || '{}');
      if (Object.keys(edits).length > 0) {
        import('@/terminal/editor').then(({ initPendingEditsIndicator, applyLocalEditsToPage }) => {
          initPendingEditsIndicator();
          applyLocalEditsToPage();
        });
      }
    } catch { /* ignore */ }

    // --- Edit button on post pages ---
    try {
      if (localStorage.getItem('_ep')) {
        if (/^\/\d{4}\/\d{2}\/\d{2}\/[^/]+\/?$/.test(window.location.pathname)) {
          import('@/edit-button').then(({ initEditButton }) => initEditButton());
        }
      }
    } catch { /* ignore */ }

    // --- Silent auth shortcut: window._a("pat") in DevTools ---
    (window as unknown as Record<string, unknown>)._a = (t: string) => {
      if (!t) return;
      import('@/terminal/github').then(async ({ GitHubClient: GH }) => {
        const g = new GH(t);
        if (!await g.validateToken()) return;
        githubClient = g;
        localStorage.setItem('_ep', t);
        try { sessionStorage.setItem('ellyseum_terminal_unlocked', '1'); } catch {}
        (window as unknown as Record<string, unknown>).__githubClient = g;
        import('@/edit-button').then(m => m.initEditButton()).catch(() => {});
      }).catch(() => {});
    };

    // --- SPA navigate: reinject edit button + pending edits ---
    const onNavigate = () => {
      try {
        if (localStorage.getItem('_ep')) {
          import('@/edit-button').then(({ initEditButton }) => initEditButton());
        }
      } catch { /* ignore */ }

      try {
        const edits = JSON.parse(localStorage.getItem('ellyseum_pending_edits') || '{}');
        if (Object.keys(edits).length > 0) {
          import('@/terminal/editor').then(({ applyLocalEditsToPage }) => applyLocalEditsToPage());
        }
      } catch { /* ignore */ }
    };
    window.addEventListener('ellyseum:navigate', onNavigate);

    // --- Terminal commands ---

    ctx.registerCommand('auth', {
      description: 'Authenticate with GitHub PAT',
      usage: '<token>',
      hidden: true,
      handler: async (args, terminal) => {
        const term = terminal as TerminalContext;
        if (!args[0]) {
          term.writeLine('Usage: auth <github_pat>');
          term.writeLine('\x1b[90mToken will be saved for future sessions\x1b[0m');
          return;
        }

        const token = args[0];
        term.writeLine('Authenticating...');

        try {
          const client = await getOrCreateClient(token);
          const valid = await client.validateToken();

          if (valid) {
            term.authenticated = true;
            term.pat = token;
            try { localStorage.setItem('_ep', token); } catch {}
            term.writeLine('\x1b[32m\u2713 Authentication successful\x1b[0m');
            term.writeLine('\x1b[90mNew commands unlocked: edit, new, publish, rm\x1b[0m');
            term.writeLine('\x1b[90mType \x1b[33mhelp\x1b[90m to see all commands. Use \x1b[33mlogout\x1b[90m to clear saved token.\x1b[0m');
            ctx.emit('auth:success');
            import('@/edit-button').then(m => m.initEditButton()).catch(() => {});
          } else {
            clearClient();
            term.writeLine('\x1b[31m\u2717 Invalid token or insufficient permissions\x1b[0m');
          }
        } catch (e) {
          clearClient();
          term.writeLine(`\x1b[31m\u2717 Authentication failed: ${e instanceof Error ? e.message : 'Unknown error'}\x1b[0m`);
        }
      },
    });

    ctx.registerCommand('logout', {
      description: 'Clear saved authentication',
      hidden: true,
      handler: (_args, terminal) => {
        const term = terminal as TerminalContext;
        term.authenticated = false;
        term.pat = null;
        clearClient();
        try { localStorage.removeItem('_ep'); } catch {}
        term.writeLine('\x1b[33m\u2713 Logged out. Token cleared from storage.\x1b[0m');
      },
    });

    ctx.registerCommand('edit', {
      description: 'Edit current page',
      usage: '[path]',
      requiresAuth: true,
      handler: async (args, terminal) => {
        const term = terminal as TerminalContext;
        const token = term.pat || localStorage.getItem('_ep');
        if (!token) {
          term.writeLine('\x1b[31mNot authenticated. Use: auth <token>\x1b[0m');
          return;
        }

        const client = await getOrCreateClient(token);
        const { openEditor } = await import('@/terminal/editor');
        const path = args[0] || window.location.pathname;
        term.writeLine(`Opening editor for ${path}...`);

        try {
          const content = await client.getFileContent(path);
          if (content !== null) {
            openEditor({
              path,
              content,
              github: client,
              onSave: () => { term.writeLine(`\x1b[32m\u2713 Saved ${path}\x1b[0m`); },
            });
          } else {
            term.writeLine(`\x1b[31mCould not find source for ${path}\x1b[0m`);
          }
        } catch (e) {
          term.writeLine(`\x1b[31mError: ${e instanceof Error ? e.message : 'Unknown error'}\x1b[0m`);
        }
      },
    });

    ctx.registerCommand('new', {
      description: 'Create a new draft',
      usage: '<"Title">',
      requiresAuth: true,
      handler: async (args, terminal) => {
        const term = terminal as TerminalContext;
        const token = term.pat || localStorage.getItem('_ep');
        if (!token) {
          term.writeLine('\x1b[31mNot authenticated\x1b[0m');
          return;
        }

        const client = await getOrCreateClient(token);
        const { openEditor } = await import('@/terminal/editor');

        const title = args.join(' ').replace(/^["']|["']$/g, '');
        if (!title) {
          term.writeLine('Usage: new "Post Title"');
          return;
        }

        const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
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

        term.writeLine(`Creating draft: ${filename}...`);

        openEditor({
          path: `/_drafts/${filename}`,
          content: template,
          github: client,
          isNew: true,
          onSave: () => { term.writeLine(`\x1b[32m\u2713 Created draft ${filename}\x1b[0m`); },
        });
      },
    });

    ctx.registerCommand('publish', {
      description: 'Publish a draft',
      usage: '<slug>',
      requiresAuth: true,
      handler: async (args, terminal) => {
        const term = terminal as TerminalContext;
        const token = term.pat || localStorage.getItem('_ep');
        if (!token) {
          term.writeLine('\x1b[31mNot authenticated\x1b[0m');
          return;
        }

        if (!args[0]) {
          term.writeLine('Usage: publish <slug>');
          return;
        }

        const client = await getOrCreateClient(token);
        const slug = args[0];
        term.writeLine(`Publishing ${slug}...`);

        try {
          await client.publishDraft(slug);
          term.writeLine(`\x1b[32m\u2713 Published ${slug}\x1b[0m`);
        } catch (e) {
          term.writeLine(`\x1b[31mError: ${e instanceof Error ? e.message : 'Unknown error'}\x1b[0m`);
        }
      },
    });

    ctx.registerCommand('rm', {
      description: 'Remove a post',
      usage: '<slug>',
      requiresAuth: true,
      handler: async (args, terminal) => {
        const term = terminal as TerminalContext;
        const token = term.pat || localStorage.getItem('_ep');
        if (!token) {
          term.writeLine('\x1b[31mNot authenticated\x1b[0m');
          return;
        }

        if (!args[0]) {
          term.writeLine('Usage: rm <slug>');
          return;
        }

        const client = await getOrCreateClient(token);
        const slug = args[0];
        term.writeLine(`\x1b[33mDeleting ${slug}...\x1b[0m`);

        try {
          await client.deletePost(slug);
          term.writeLine(`\x1b[32m\u2713 Deleted ${slug}\x1b[0m`);
        } catch (e) {
          term.writeLine(`\x1b[31mError: ${e instanceof Error ? e.message : 'Unknown error'}\x1b[0m`);
        }
      },
    });

    ctx.registerCommand('save', {
      description: 'Quick save (use after edit)',
      requiresAuth: true,
      handler: (_args, terminal) => {
        const term = terminal as { writeLine: (s: string) => void };
        term.writeLine('\x1b[90mUse the Save button in the editor, or edit \u2192 make changes \u2192 save\x1b[0m');
      },
    });

    // Cleanup
    return () => {
      window.removeEventListener('ellyseum:navigate', onNavigate);
      delete (window as unknown as Record<string, unknown>)._a;
    };
  },
};

export default githubCms;
