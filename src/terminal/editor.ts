/**
 * Markdown editor with AI assistant
 * Lazy loaded on auth (Layer 3)
 *
 * Uses existing Groq worker for AI rewrites
 */

import { marked } from 'marked';
import * as Diff from 'diff';
import type { GitHubClient } from './github';
import { SITE_CONFIG } from '../data/site-config';

export interface EditorOptions {
  path: string;
  content: string;
  github: GitHubClient;
  isNew?: boolean;
  onSave?: () => void;
  onClose?: () => void;
}

let currentEditor: HTMLDivElement | null = null;
let currentDiffView: HTMLDivElement | null = null;
let pendingChangesIndicator: HTMLDivElement | null = null;
let currentOnClose: (() => void) | null = null;

// Local storage for uncommitted edits
const EDITS_KEY = 'ellyseum_pending_edits';

interface PendingEdit {
  path: string;
  content: string;
  originalContent: string;
  timestamp: number;
  oldPath?: string; // Set when post is renamed
}

function getPendingEdits(): Record<string, PendingEdit> {
  try {
    return JSON.parse(localStorage.getItem(EDITS_KEY) || '{}');
  } catch {
    return {};
  }
}

function addRedirectToFrontmatter(content: string, oldPath: string): string {
  const fmMatch = content.match(/^(---\s*\n)([\s\S]*?)(\n---)/);
  if (!fmMatch) return content;

  const [fullMatch, open, body, close] = fmMatch;
  const cleanOldPath = oldPath.replace(/\/$/, '') + '/';

  // Check if redirect_from already exists
  const redirectMatch = body.match(/^redirect_from:\s*\n((?:\s+-\s+.*\n)*)/m);
  if (redirectMatch) {
    // Already has redirect_from - check if this path is already listed
    if (redirectMatch[0].includes(cleanOldPath)) {
      return content; // Already there
    }
    // Append to existing list
    const updatedRedirects = redirectMatch[0].trimEnd() + `\n  - ${cleanOldPath}\n`;
    return content.replace(redirectMatch[0], updatedRedirects);
  }

  // No redirect_from yet - add it before the closing ---
  const newBody = body.trimEnd() + `\nredirect_from:\n  - ${cleanOldPath}`;
  return content.replace(fullMatch, open + newBody + close);
}



function removePendingEdit(path: string): void {
  const edits = getPendingEdits();
  delete edits[path];
  localStorage.setItem(EDITS_KEY, JSON.stringify(edits));
  updatePendingChangesIndicator();
}

function getPendingEdit(path: string): PendingEdit | null {
  const edits = getPendingEdits();
  return edits[path] || null;
}

// Get edited content for a path (used by page rendering)
export function getLocalEdit(urlPath: string): string | null {
  const edit = getPendingEdit(urlPath);
  return edit?.content || null;
}

// Check if there are any pending edits
export function hasPendingEdits(): boolean {
  return Object.keys(getPendingEdits()).length > 0;
}

// Create/update the floating pending changes indicator
function updatePendingChangesIndicator(): void {
  const edits = getPendingEdits();
  const count = Object.keys(edits).length;

  if (count === 0) {
    if (pendingChangesIndicator) {
      pendingChangesIndicator.remove();
      pendingChangesIndicator = null;
    }
    return;
  }

  if (!pendingChangesIndicator) {
    pendingChangesIndicator = document.createElement('div');
    pendingChangesIndicator.id = 'pending-changes-indicator';
    pendingChangesIndicator.innerHTML = `
      <style>
        #pending-changes-indicator {
          position: fixed;
          bottom: 100px;
          right: 24px;
          z-index: 9999;
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 16px;
          background: var(--surface-solid, rgba(15, 15, 20, 0.95));
          border: 1px solid var(--primary, #7c3aed);
          border-radius: 8px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
          backdrop-filter: blur(10px);
          animation: slideIn 0.3s ease-out;
          font-family: 'Inter', system-ui, sans-serif;
        }

        @keyframes slideIn {
          from { transform: translateX(100px); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }

        .pending-badge {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 24px;
          height: 24px;
          background: linear-gradient(135deg, var(--primary, #7c3aed), var(--secondary, #ec4899));
          border-radius: 50%;
          font-size: 12px;
          font-weight: 600;
          color: white;
        }

        .pending-text {
          font-size: 13px;
          color: var(--text, #e5e7eb);
        }

        .pending-btn {
          padding: 6px 12px;
          border: 1px solid var(--border, #444);
          border-radius: 4px;
          background: var(--surface, #1f1f2e);
          color: var(--text, #e5e7eb);
          font-size: 12px;
          cursor: pointer;
          transition: all 0.15s;
        }

        .pending-btn:hover {
          background: #2a2a3e;
        }

        .pending-btn-commit {
          border-color: #22c55e;
          color: #86efac;
        }

        .pending-btn-commit:hover {
          background: #22c55e33;
        }

        .pending-btn-discard {
          border-color: #ef4444;
          color: #fca5a5;
        }

        .pending-btn-discard:hover {
          background: #ef444433;
        }
      </style>
      <span class="pending-badge">${count}</span>
      <span class="pending-text">uncommitted edit${count > 1 ? 's' : ''}</span>
      <button class="pending-btn pending-btn-commit">Commit & Push</button>
      <button class="pending-btn pending-btn-discard">Discard</button>
    `;

    document.body.appendChild(pendingChangesIndicator);
  } else {
    // Update count
    const badge = pendingChangesIndicator.querySelector('.pending-badge');
    const text = pendingChangesIndicator.querySelector('.pending-text');
    if (badge) badge.textContent = String(count);
    if (text) text.textContent = `uncommitted edit${count > 1 ? 's' : ''}`;
  }

  // Rebind event handlers
  const commitBtn = pendingChangesIndicator.querySelector('.pending-btn-commit');
  const discardBtn = pendingChangesIndicator.querySelector('.pending-btn-discard');

  commitBtn?.replaceWith(commitBtn.cloneNode(true));
  discardBtn?.replaceWith(discardBtn.cloneNode(true));

  pendingChangesIndicator.querySelector('.pending-btn-commit')?.addEventListener('click', showCommitDialog);
  pendingChangesIndicator.querySelector('.pending-btn-discard')?.addEventListener('click', showDiscardDialog);
}

// Show commit dialog
function showCommitDialog(): void {
  const edits = getPendingEdits();
  const editList = Object.values(edits);

  if (editList.length === 0) return;

  const dialog = document.createElement('div');
  dialog.className = 'commit-dialog-overlay';
  dialog.innerHTML = `
    <style>
      .commit-dialog-overlay {
        position: fixed;
        inset: 0;
        z-index: 10003;
        display: flex;
        align-items: center;
        justify-content: center;
        animation: fadeIn 0.2s ease-out;
      }

      .commit-dialog-backdrop {
        position: absolute;
        inset: 0;
        background: rgba(0, 0, 0, 0.9);
      }

      .commit-dialog {
        position: relative;
        width: min(500px, 90vw);
        background: var(--surface-solid, #0f0f14);
        border: 1px solid var(--primary, #7c3aed);
        border-radius: 8px;
        box-shadow: var(--glow-strong, 0 0 60px rgba(124, 58, 237, 0.3));
        animation: slideUp 0.3s ease-out;
      }

      @keyframes slideUp {
        from { transform: translateY(20px); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
      }

      .commit-dialog-header {
        padding: 16px 20px;
        border-bottom: 1px solid #333;
        background: #1a1a24;
        border-radius: 8px 8px 0 0;
      }

      .commit-dialog-header h3 {
        margin: 0;
        font-size: 15px;
        font-weight: 600;
        color: #e5e7eb;
      }

      .commit-dialog-body {
        padding: 20px;
      }

      .commit-files {
        margin-bottom: 16px;
        padding: 12px;
        background: color-mix(in srgb, var(--primary, #7c3aed) 10%, transparent);
        border-radius: 6px;
        font-family: monospace;
        font-size: 12px;
        color: var(--primary-light, #c4b5fd);
        max-height: 120px;
        overflow-y: auto;
      }

      .commit-file {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 4px 0;
      }

      .commit-file-icon {
        color: #22c55e;
      }

      .commit-message-input {
        width: 100%;
        padding: 12px;
        border: 1px solid #333;
        border-radius: 6px;
        background: #0a0a0f;
        color: #e5e7eb;
        font-size: 14px;
        font-family: system-ui, sans-serif;
        resize: none;
        outline: none;
      }

      .commit-message-input:focus {
        border-color: var(--primary, #7c3aed);
      }

      .commit-message-input::placeholder {
        color: #6b7280;
      }

      .commit-dialog-footer {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
        padding: 16px 20px;
        border-top: 1px solid #333;
        background: #1a1a24;
        border-radius: 0 0 8px 8px;
      }

      .commit-btn {
        padding: 10px 20px;
        border: 1px solid #444;
        border-radius: 4px;
        background: #1f1f2e;
        color: #e5e7eb;
        font-size: 13px;
        cursor: pointer;
        transition: all 0.15s;
      }

      .commit-btn:hover {
        background: #2a2a3e;
      }

      .commit-btn-primary {
        border-color: #22c55e;
        background: #22c55e;
        color: #0a0a0f;
        font-weight: 600;
      }

      .commit-btn-primary:hover {
        background: #16a34a;
      }

      .commit-btn-primary:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
    </style>
    <div class="commit-dialog-backdrop"></div>
    <div class="commit-dialog">
      <div class="commit-dialog-header">
        <h3>Commit & Push Changes</h3>
      </div>
      <div class="commit-dialog-body">
        <div class="commit-files">
          ${editList.map(e => {
            if (e.oldPath) {
              return `<div class="commit-file"><span class="commit-file-icon" style="color:#eab308">R</span> ${e.oldPath} → ${e.path}</div>`;
            }
            return `<div class="commit-file"><span class="commit-file-icon">M</span> ${e.path}</div>`;
          }).join('')}
        </div>
        <textarea class="commit-message-input" rows="3" placeholder="Commit message (e.g., Update blog post)"></textarea>
      </div>
      <div class="commit-dialog-footer">
        <button class="commit-btn commit-btn-cancel">Cancel</button>
        <button class="commit-btn commit-btn-primary commit-btn-push">Push to GitHub</button>
      </div>
    </div>
  `;

  const closeDialog = () => dialog.remove();

  dialog.querySelector('.commit-dialog-backdrop')?.addEventListener('click', closeDialog);
  dialog.querySelector('.commit-btn-cancel')?.addEventListener('click', closeDialog);

  const messageInput = dialog.querySelector('.commit-message-input') as HTMLTextAreaElement;
  const pushBtn = dialog.querySelector('.commit-btn-push') as HTMLButtonElement;

  pushBtn.addEventListener('click', async () => {
    const message = messageInput.value.trim() || 'Update content';
    pushBtn.disabled = true;
    pushBtn.textContent = 'Pushing...';

    try {
      // Get the GitHub client from the stored instance
      const github = (window as unknown as Record<string, unknown>).__githubClient as import('./github').GitHubClient | undefined;
      if (!github) {
        throw new Error('Not authenticated. Run `login` in terminal first.');
      }

      // Push each edit
      for (const edit of editList) {
        let filePath = edit.path;
        if (filePath.startsWith('/')) filePath = filePath.slice(1);

        // Convert URL path to file path for posts
        const match = edit.path.match(/\/(\d{4})\/(\d{2})\/(\d{2})\/([^/]+)/);
        if (match) {
          const [, year, month, day, slug] = match;
          filePath = `${year}-${month}-${day}-${slug}.md`;
        }

        // Save content to (possibly new) path
        await github.saveFile(filePath, edit.content, message);

        // If renamed, delete the old file
        if (edit.oldPath) {
          const oldMatch = edit.oldPath.match(/\/(\d{4})\/(\d{2})\/(\d{2})\/([^/]+)/);
          if (oldMatch) {
            const [, oy, om, od, os] = oldMatch;
            const oldFilePath = `${oy}-${om}-${od}-${os.replace(/\/$/, '')}.md`;
            try {
              await github.deleteFile(oldFilePath, `Rename: ${oldFilePath} → ${filePath}`);
            } catch (e) {
              console.warn('[commit] Failed to delete old file:', oldFilePath, e);
            }
          }
        }

        removePendingEdit(edit.path);
      }

      closeDialog();

      // Show success toast
      showToast('Changes pushed to GitHub!', 'success');
    } catch (e) {
      pushBtn.disabled = false;
      pushBtn.textContent = 'Push to GitHub';
      showToast((e instanceof Error ? e.message : 'Push failed'), 'error');
    }
  });

  // ESC to close
  const escHandler = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      closeDialog();
      document.removeEventListener('keydown', escHandler);
    }
  };
  document.addEventListener('keydown', escHandler);

  document.body.appendChild(dialog);
  messageInput.focus();
}

// Show discard confirmation dialog
function showDiscardDialog(): void {
  if (!confirm('Discard all uncommitted changes? This cannot be undone.')) return;

  localStorage.removeItem(EDITS_KEY);
  updatePendingChangesIndicator();
  showToast('Changes discarded', 'info');

  // Reload current page to restore original content
  window.location.reload();
}

// Simple toast notification
function showToast(message: string, type: 'success' | 'error' | 'info'): void {
  const toast = document.createElement('div');
  const colors = {
    success: { bg: '#22c55e', text: '#fff' },
    error: { bg: '#ef4444', text: '#fff' },
    info: { bg: '#3b82f6', text: '#fff' },
  };

  toast.style.cssText = `
    position: fixed;
    bottom: 24px;
    left: 50%;
    transform: translateX(-50%);
    padding: 12px 24px;
    background: ${colors[type].bg};
    color: ${colors[type].text};
    font-size: 14px;
    font-weight: 500;
    border-radius: 6px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
    z-index: 10004;
    animation: toastIn 0.3s ease-out;
  `;
  toast.textContent = message;

  const style = document.createElement('style');
  style.textContent = `
    @keyframes toastIn {
      from { transform: translateX(-50%) translateY(20px); opacity: 0; }
      to { transform: translateX(-50%) translateY(0); opacity: 1; }
    }
  `;
  toast.appendChild(style);

  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

// Initialize indicator on load
export function initPendingEditsIndicator(): void {
  updatePendingChangesIndicator();
}

// Update the current page content with new markdown
function updatePageContent(editPath: string, markdown: string): void {
  // Check if we're on the page being edited
  const currentPath = window.location.pathname;

  // Normalize paths for comparison
  const normalizedEditPath = editPath.replace(/\/$/, '');
  const normalizedCurrentPath = currentPath.replace(/\/$/, '');

  if (normalizedEditPath !== normalizedCurrentPath) {
    // Not viewing this page, nothing to update visually
    return;
  }

  // Parse frontmatter and content
  const fmMatch = markdown.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);

  let frontmatter: Record<string, string> = {};
  let content = markdown;

  if (fmMatch) {
    const fmLines = fmMatch[1].split('\n');
    for (const line of fmLines) {
      const match = line.match(/^(\w+):\s*["']?([^"'\n]*)["']?/);
      if (match) {
        frontmatter[match[1]] = match[2];
      }
    }
    content = fmMatch[2];
  }

  // Find the post content container
  const postContent = document.querySelector('.post-content, .page-content, article .content, main .content');
  if (postContent) {
    // Render markdown to HTML
    const html = marked.parse(content) as string;
    postContent.innerHTML = html;
  }

  // Update title if present
  if (frontmatter.title) {
    const titleEl = document.querySelector('.post-title, h1.title, article h1');
    if (titleEl) titleEl.textContent = frontmatter.title;
    document.title = `${frontmatter.title} | Ellyseum Dreams`;
  }

  // Update subtitle if present
  if (frontmatter.subtitle) {
    const subtitleEl = document.querySelector('.post-subtitle, .subtitle');
    if (subtitleEl) subtitleEl.textContent = frontmatter.subtitle;
  }

  // Show visual indicator that page has local changes
  addLocalChangesIndicator();
}

// Add a visual indicator to the page showing it has local changes
function addLocalChangesIndicator(): void {
  if (document.getElementById('local-changes-badge')) return;

  const badge = document.createElement('div');
  badge.id = 'local-changes-badge';
  badge.innerHTML = `
    <style>
      #local-changes-badge {
        position: fixed;
        top: 80px;
        right: 24px;
        padding: 8px 12px;
        background: linear-gradient(135deg, var(--primary, #7c3aed), var(--secondary, #ec4899));
        color: white;
        font-size: 12px;
        font-weight: 500;
        border-radius: 4px;
        z-index: 1000;
        font-family: system-ui, sans-serif;
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
      }
    </style>
    ✏️ Local changes (not pushed)
  `;
  document.body.appendChild(badge);
}

// Apply local edits when page loads (for SPA navigation)
export function applyLocalEditsToPage(): void {
  const currentPath = window.location.pathname;
  const edit = getPendingEdit(currentPath);

  if (edit) {
    updatePageContent(currentPath, edit.content);
  }
}

// Diff view for AI changes
interface DiffHunk {
  id: number;
  oldStart: number;
  oldLines: string[];
  newLines: string[];
  accepted: boolean | null; // null = pending, true = accepted, false = rejected
}

function showDiffView(
  original: string,
  proposed: string,
  onAccept: (result: string) => void,
  onReject: () => void
): void {
  closeDiffView();

  // Compute line-by-line diff
  const changes = Diff.diffLines(original, proposed);
  const hunks: DiffHunk[] = [];
  let hunkId = 0;
  let lineNum = 1;

  // Group changes into hunks - a hunk is a contiguous block of changes
  // We need to pair adjacent removed+added as a single hunk
  let i = 0;
  while (i < changes.length) {
    const change = changes[i];
    const lines = change.value.split('\n');
    if (lines[lines.length - 1] === '') lines.pop();

    if (!change.added && !change.removed) {
      // Unchanged - just advance line counter
      lineNum += lines.length;
      i++;
      continue;
    }

    // Start a new hunk
    const hunk: DiffHunk = {
      id: hunkId++,
      oldStart: lineNum,
      oldLines: [],
      newLines: [],
      accepted: null,
    };

    // Collect all contiguous changes into this hunk
    while (i < changes.length) {
      const c = changes[i];
      if (!c.added && !c.removed) break; // Hit unchanged, stop

      const cLines = c.value.split('\n');
      if (cLines[cLines.length - 1] === '') cLines.pop();

      if (c.removed) {
        hunk.oldLines.push(...cLines);
        lineNum += cLines.length;
      }
      if (c.added) {
        hunk.newLines.push(...cLines);
      }
      i++;
    }

    hunks.push(hunk);
  }

  // If no hunks, content is identical
  if (hunks.length === 0) {
    onAccept(proposed);
    return;
  }

  // Create diff view overlay
  const overlay = document.createElement('div');
  overlay.className = 'diff-overlay';
  overlay.innerHTML = `
    <div class="diff-backdrop"></div>
    <div class="diff-window">
      <div class="diff-header">
        <span class="diff-title">Review AI Changes</span>
        <span class="diff-stats">${hunks.length} change${hunks.length > 1 ? 's' : ''}</span>
        <div class="diff-actions">
          <button class="diff-btn diff-accept-all">✓ Accept All</button>
          <button class="diff-btn diff-reject-all">✕ Reject All</button>
        </div>
      </div>
      <div class="diff-body">
        <div class="diff-hunks"></div>
      </div>
      <div class="diff-footer">
        <button class="diff-btn diff-apply">Apply Selected Changes</button>
        <button class="diff-btn diff-cancel">Cancel</button>
      </div>
    </div>
  `;

  // Add styles
  const style = document.createElement('style');
  style.textContent = `
    .diff-overlay {
      position: fixed;
      inset: 0;
      z-index: 10002;
      display: flex;
      align-items: center;
      justify-content: center;
      animation: diffFadeIn 0.2s ease-out;
    }

    @keyframes diffFadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    .diff-backdrop {
      position: absolute;
      inset: 0;
      background: rgba(0, 0, 0, 0.95);
    }

    .diff-window {
      position: relative;
      width: min(1100px, 95vw);
      max-height: 90vh;
      background: var(--surface-solid, #0f0f14);
      border: 1px solid var(--primary, #7c3aed);
      border-radius: 8px;
      display: flex;
      flex-direction: column;
      animation: diffSlideIn 0.3s ease-out;
      box-shadow: var(--glow-strong, 0 0 60px rgba(124, 58, 237, 0.3));
    }

    @keyframes diffSlideIn {
      from { transform: translateY(20px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }

    .diff-header {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 14px 20px;
      background: #1a1a24;
      border-bottom: 1px solid #333;
      border-radius: 8px 8px 0 0;
    }

    .diff-title {
      font-size: 15px;
      font-weight: 600;
      color: #e5e7eb;
    }

    .diff-stats {
      font-size: 13px;
      color: var(--text-muted, #9ca3af);
      padding: 2px 8px;
      background: color-mix(in srgb, var(--primary, #7c3aed) 20%, transparent);
      border-radius: 4px;
    }

    .diff-actions {
      margin-left: auto;
      display: flex;
      gap: 8px;
    }

    .diff-btn {
      padding: 8px 14px;
      border: 1px solid #444;
      border-radius: 4px;
      background: #1f1f2e;
      color: #e5e7eb;
      font-size: 13px;
      cursor: pointer;
      transition: all 0.15s;
    }

    .diff-btn:hover {
      background: #2a2a3e;
      border-color: #555;
    }

    .diff-accept-all {
      border-color: #22c55e;
      color: #86efac;
    }

    .diff-accept-all:hover {
      background: #22c55e33;
    }

    .diff-reject-all {
      border-color: #ef4444;
      color: #fca5a5;
    }

    .diff-reject-all:hover {
      background: #ef444433;
    }

    .diff-apply {
      border-color: var(--primary, #7c3aed);
      color: var(--primary-light, #c4b5fd);
    }

    .diff-apply:hover {
      background: color-mix(in srgb, var(--primary, #7c3aed) 25%, transparent);
    }

    .diff-body {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
    }

    .diff-hunks {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .diff-hunk {
      border: 1px solid #333;
      border-radius: 6px;
      overflow: hidden;
      transition: border-color 0.2s, box-shadow 0.2s;
    }

    .diff-hunk.accepted {
      border-color: #22c55e;
      box-shadow: 0 0 20px rgba(34, 197, 94, 0.15);
    }

    .diff-hunk.rejected {
      border-color: #ef4444;
      opacity: 0.5;
    }

    .diff-hunk-header {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      background: #1a1a24;
      border-bottom: 1px solid #333;
    }

    .diff-hunk-title {
      font-family: monospace;
      font-size: 12px;
      color: #9ca3af;
    }

    .diff-hunk-actions {
      margin-left: auto;
      display: flex;
      gap: 4px;
    }

    .diff-hunk-btn {
      padding: 4px 8px;
      border: 1px solid #444;
      border-radius: 3px;
      background: transparent;
      font-size: 11px;
      cursor: pointer;
      transition: all 0.15s;
    }

    .diff-hunk-accept {
      color: #86efac;
      border-color: #22c55e55;
    }

    .diff-hunk-accept:hover {
      background: #22c55e33;
    }

    .diff-hunk-reject {
      color: #fca5a5;
      border-color: #ef444455;
    }

    .diff-hunk-reject:hover {
      background: #ef444433;
    }

    .diff-hunk-content {
      display: grid;
      grid-template-columns: 1fr 1fr;
    }

    .diff-side {
      padding: 12px;
      font-family: "JetBrains Mono", monospace;
      font-size: 12px;
      line-height: 1.6;
      white-space: pre-wrap;
      word-break: break-word;
      overflow-x: auto;
    }

    .diff-old {
      background: rgba(239, 68, 68, 0.08);
      border-right: 1px solid #333;
    }

    .diff-new {
      background: rgba(34, 197, 94, 0.08);
    }

    .diff-line {
      display: block;
      padding: 2px 4px;
      margin: 0 -4px;
      border-radius: 2px;
    }

    .diff-line-removed {
      background: rgba(239, 68, 68, 0.25);
      color: #fca5a5;
    }

    .diff-line-added {
      background: rgba(34, 197, 94, 0.25);
      color: #86efac;
    }

    .diff-word-removed {
      background: rgba(239, 68, 68, 0.5);
      padding: 1px 2px;
      border-radius: 2px;
    }

    .diff-word-added {
      background: rgba(34, 197, 94, 0.5);
      padding: 1px 2px;
      border-radius: 2px;
    }

    .diff-footer {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      padding: 14px 20px;
      background: #1a1a24;
      border-top: 1px solid #333;
      border-radius: 0 0 8px 8px;
    }

    .diff-cancel {
      color: #9ca3af;
    }

    @media (max-width: 768px) {
      .diff-hunk-content {
        grid-template-columns: 1fr;
      }

      .diff-old {
        border-right: none;
        border-bottom: 1px solid #333;
      }
    }
  `;
  overlay.appendChild(style);

  // Render hunks
  const hunksContainer = overlay.querySelector('.diff-hunks')!;

  for (const hunk of hunks) {
    const hunkEl = document.createElement('div');
    hunkEl.className = 'diff-hunk';
    hunkEl.dataset.hunkId = String(hunk.id);

    // Word-level diff for better visibility
    const wordDiffHtml = computeWordDiff(hunk.oldLines.join('\n'), hunk.newLines.join('\n'));

    hunkEl.innerHTML = `
      <div class="diff-hunk-header">
        <span class="diff-hunk-title">Line ${hunk.oldStart}</span>
        <div class="diff-hunk-actions">
          <button class="diff-hunk-btn diff-hunk-accept">✓ Accept</button>
          <button class="diff-hunk-btn diff-hunk-reject">✕ Reject</button>
        </div>
      </div>
      <div class="diff-hunk-content">
        <div class="diff-side diff-old">${wordDiffHtml.old}</div>
        <div class="diff-side diff-new">${wordDiffHtml.new}</div>
      </div>
    `;

    // Hunk accept/reject handlers
    hunkEl.querySelector('.diff-hunk-accept')!.addEventListener('click', () => {
      hunk.accepted = true;
      hunkEl.classList.remove('rejected');
      hunkEl.classList.add('accepted');
    });

    hunkEl.querySelector('.diff-hunk-reject')!.addEventListener('click', () => {
      hunk.accepted = false;
      hunkEl.classList.remove('accepted');
      hunkEl.classList.add('rejected');
    });

    hunksContainer.appendChild(hunkEl);
  }

  // Global actions
  overlay.querySelector('.diff-accept-all')!.addEventListener('click', () => {
    for (const hunk of hunks) {
      hunk.accepted = true;
    }
    const result = applySelectedHunks(original, proposed, hunks);
    closeDiffView();
    onAccept(result);
  });

  overlay.querySelector('.diff-reject-all')!.addEventListener('click', () => {
    closeDiffView();
    onReject();
  });

  // Apply selected changes
  overlay.querySelector('.diff-apply')!.addEventListener('click', () => {
    const result = applySelectedHunks(original, proposed, hunks);
    closeDiffView();
    onAccept(result);
  });

  // Cancel
  overlay.querySelector('.diff-cancel')!.addEventListener('click', () => {
    closeDiffView();
    onReject();
  });

  overlay.querySelector('.diff-backdrop')!.addEventListener('click', () => {
    closeDiffView();
    onReject();
  });

  // ESC to close
  const escHandler = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      closeDiffView();
      onReject();
      document.removeEventListener('keydown', escHandler);
    }
  };
  document.addEventListener('keydown', escHandler);

  document.body.appendChild(overlay);
  currentDiffView = overlay;
}

function closeDiffView(): void {
  if (currentDiffView) {
    currentDiffView.remove();
    currentDiffView = null;
  }
}

// Compute diff with HTML highlighting
// Uses word-level for small changes, line-level for large ones
function computeWordDiff(oldText: string, newText: string): { old: string; new: string } {
  const oldLines = oldText.split('\n');
  const newLines = newText.split('\n');

  // For large hunks or very different sizes, use line-by-line display
  const sizeDiff = Math.abs(oldLines.length - newLines.length);
  const isLarge = oldLines.length > 5 || newLines.length > 5 || sizeDiff > 3;

  if (isLarge) {
    // Line-by-line display
    const oldHtml = oldLines.map(line =>
      `<span class="diff-line diff-line-removed">${escapeHtml(line) || ' '}</span>`
    ).join('\n');

    const newHtml = newLines.map(line =>
      `<span class="diff-line diff-line-added">${escapeHtml(line) || ' '}</span>`
    ).join('\n');

    return {
      old: oldHtml || '<em style="color:#666">(empty)</em>',
      new: newHtml || '<em style="color:#666">(empty)</em>'
    };
  }

  // For small changes, use word-level diff
  const wordDiff = Diff.diffWords(oldText, newText);

  let oldHtml = '';
  let newHtml = '';

  for (const part of wordDiff) {
    const escaped = escapeHtml(part.value);

    if (part.removed) {
      oldHtml += `<span class="diff-word-removed">${escaped}</span>`;
    } else if (part.added) {
      newHtml += `<span class="diff-word-added">${escaped}</span>`;
    } else {
      oldHtml += escaped;
      newHtml += escaped;
    }
  }

  return { old: oldHtml || '<em style="color:#666">(empty)</em>', new: newHtml || '<em style="color:#666">(empty)</em>' };
}

// Apply only accepted hunks
function applySelectedHunks(original: string, proposed: string, hunks: DiffHunk[]): string {
  // If all accepted, return proposed
  if (hunks.every(h => h.accepted === true)) {
    return proposed;
  }

  // If all rejected, return original
  if (hunks.every(h => h.accepted === false)) {
    return original;
  }

  // Partial acceptance - apply changes line by line
  const originalLines = original.split('\n');
  const proposedLines = proposed.split('\n');
  const changes = Diff.diffLines(original, proposed);

  const result: string[] = [];
  let origIdx = 0;
  let propIdx = 0;
  let hunkIdx = 0;

  for (const change of changes) {
    const lineCount = change.count || change.value.split('\n').filter((_, i, arr) => i < arr.length - 1 || arr[i] !== '').length;

    if (!change.added && !change.removed) {
      // Unchanged lines
      for (let i = 0; i < lineCount; i++) {
        if (origIdx + i < originalLines.length) {
          result.push(originalLines[origIdx + i]);
        }
      }
      origIdx += lineCount;
      propIdx += lineCount;
    } else if (change.removed) {
      // Check if this hunk is accepted
      const hunk = hunks[hunkIdx];
      if (hunk && hunk.accepted !== true) {
        // Keep original lines
        for (let i = 0; i < lineCount; i++) {
          if (origIdx + i < originalLines.length) {
            result.push(originalLines[origIdx + i]);
          }
        }
      }
      origIdx += lineCount;
    } else if (change.added) {
      // Check if this hunk is accepted
      const hunk = hunks[hunkIdx];
      if (hunk && hunk.accepted === true) {
        // Use proposed lines
        for (let i = 0; i < lineCount; i++) {
          if (propIdx + i < proposedLines.length) {
            result.push(proposedLines[propIdx + i]);
          }
        }
      }
      propIdx += lineCount;
      hunkIdx++;
    }
  }

  return result.join('\n');
}

export function openEditor(options: EditorOptions): void {
  // Close any existing editor
  closeEditor();

  const { path, content, github, onSave } = options;
  currentOnClose = options.onClose || null;

  // Create editor container
  const editor = document.createElement('div');
  editor.id = 'secret-editor';
  editor.innerHTML = `
    <div class="editor-backdrop"></div>
    <div class="editor-window">
      <div class="editor-header">
        <span class="editor-path" data-original-path="${path}"></span>
        <div class="editor-actions">
          <button class="editor-btn editor-btn-ai" title="AI Assistant">✨ AI</button>
          <button class="editor-btn editor-btn-save" title="Save changes">💾 Save</button>
          <button class="editor-btn editor-btn-close" title="Close">×</button>
        </div>
      </div>
      <div class="editor-body">
        <div class="editor-pane editor-source">
          <textarea class="editor-textarea" spellcheck="false">${escapeHtml(content)}</textarea>
        </div>
        <div class="editor-pane editor-preview">
          <div class="editor-preview-content"></div>
        </div>
      </div>
      <div class="editor-ai-panel" hidden>
        <div class="ai-header">
          <span>AI Assistant</span>
          <select class="ai-model-select">
            ${AI_MODELS.map(m => `<option value="${m.id}" ${m.id === getSavedModel() ? 'selected' : ''}>${m.name}</option>`).join('')}
          </select>
          <button class="ai-close">×</button>
        </div>
        <div class="ai-body">
          <textarea class="ai-input" placeholder="Describe what you want to change...
Examples:
• Make the intro punchier
• Fix any grammar issues
• Add a conclusion paragraph
• Rewrite in a more casual tone"></textarea>
          <div class="ai-actions">
            <select class="ai-voice-select">
              <option value="">Default voice</option>
              <option value="casual">Casual</option>
              <option value="professional">Professional</option>
              <option value="witty">Witty</option>
              <option value="technical">Technical</option>
            </select>
            <button class="ai-submit">Apply Changes</button>
          </div>
        </div>
        <div class="ai-loading" hidden>
          <span class="ai-spinner"></span> Thinking...
        </div>
      </div>
    </div>
  `;

  // Add styles
  const style = document.createElement('style');
  style.textContent = `
    #secret-editor {
      position: fixed;
      inset: 0;
      z-index: 10001;
      display: flex;
      align-items: center;
      justify-content: center;
      animation: editorFadeIn 0.2s ease-out;
    }

    @keyframes editorFadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    .editor-backdrop {
      position: absolute;
      inset: 0;
      background: rgba(0, 0, 0, 0.9);
    }

    .editor-window {
      position: relative;
      width: min(1200px, 95vw);
      height: min(800px, 90vh);
      background: var(--surface-solid, #0f0f14);
      border: 1px solid var(--border, #333);
      border-radius: 8px;
      display: flex;
      flex-direction: column;
      animation: editorSlideIn 0.3s ease-out;
    }

    @keyframes editorSlideIn {
      from { transform: scale(0.95); opacity: 0; }
      to { transform: scale(1); opacity: 1; }
    }

    .editor-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 16px;
      background: var(--surface, #1a1a24);
      border-bottom: 1px solid var(--border, #333);
      border-radius: 8px 8px 0 0;
    }

    .editor-path {
      font-family: monospace;
      font-size: 13px;
      color: #9ca3af;
      display: flex;
      align-items: center;
      gap: 0;
    }

    .editor-path-prefix {
      color: #6b7280;
    }

    .editor-path-slug {
      color: var(--primary-light, #c4b5fd);
      cursor: pointer;
      padding: 1px 4px;
      border-radius: 3px;
      border: 1px solid transparent;
      transition: border-color 0.2s, background 0.2s;
    }

    .editor-path-slug:hover {
      border-color: color-mix(in srgb, var(--primary, #7c3aed) 30%, transparent);
      background: color-mix(in srgb, var(--primary, #7c3aed) 8%, transparent);
    }

    .editor-path-slug-input {
      font-family: monospace;
      font-size: 13px;
      color: var(--primary-light, #c4b5fd);
      background: color-mix(in srgb, var(--primary, #7c3aed) 10%, transparent);
      border: 1px solid var(--primary, #7c3aed);
      border-radius: 3px;
      padding: 1px 4px;
      outline: none;
      width: auto;
    }

    .editor-path-suffix {
      color: #6b7280;
    }

    .editor-path-renamed {
      color: #eab308;
      font-size: 11px;
      margin-left: 8px;
    }

    .editor-actions {
      display: flex;
      gap: 8px;
    }

    .editor-btn {
      padding: 6px 12px;
      border: 1px solid #444;
      border-radius: 4px;
      background: #1f1f2e;
      color: #e5e7eb;
      font-size: 13px;
      cursor: pointer;
      transition: all 0.15s;
    }

    .editor-btn:hover {
      background: #2a2a3e;
      border-color: #555;
    }

    .editor-btn-ai {
      border-color: var(--primary, #7c3aed);
      color: var(--primary-light, #c4b5fd);
    }

    .editor-btn-ai:hover {
      background: color-mix(in srgb, var(--primary, #7c3aed) 20%, transparent);
    }

    .editor-btn-save {
      border-color: #22c55e;
      color: #86efac;
    }

    .editor-btn-save:hover:not(:disabled) {
      background: #22c55e33;
    }

    .editor-btn-save:disabled {
      border-color: #374151;
      color: #4b5563;
      cursor: default;
      opacity: 0.5;
    }

    .editor-btn-close {
      padding: 6px 10px;
      font-size: 18px;
      line-height: 1;
    }

    .editor-btn-close:hover {
      color: #ef4444;
      border-color: #ef4444;
    }

    .editor-body {
      flex: 1;
      display: flex;
      overflow: hidden;
    }

    .editor-pane {
      flex: 1;
      overflow: auto;
    }

    .editor-source {
      border-right: 1px solid #333;
    }

    .editor-textarea {
      width: 100%;
      height: 100%;
      padding: 16px;
      border: none;
      background: var(--surface-solid, #0a0a0f);
      color: var(--text, #e5e7eb);
      font-family: "JetBrains Mono", "Fira Code", monospace;
      font-size: 14px;
      line-height: 1.6;
      resize: none;
      outline: none;
    }

    .editor-preview {
      background: var(--surface-solid, rgba(8, 6, 18, 0.95));
      --font-mono: "JetBrains Mono", "Fira Code", monospace;
      --transition: 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .editor-preview-content {
      padding: 24px 32px;
      color: var(--text-body, #c4c4cc);
      font-family: 'Inter', system-ui, sans-serif;
      font-size: 1.0625rem;
      line-height: 1.75;
      max-width: 100%;
    }

    .preview-title {
      font-size: clamp(1.75rem, 4vw, 2.5rem);
      font-weight: 700;
      letter-spacing: -0.02em;
      color: var(--text);
      margin: 0 0 0.25rem;
      line-height: 1.2;
      padding: 24px 32px 0;
    }

    .preview-subtitle {
      font-size: clamp(0.95rem, 2vw, 1.15rem);
      font-family: var(--font-mono);
      font-weight: 400;
      letter-spacing: 0.02em;
      color: transparent;
      background: linear-gradient(135deg, var(--primary-light), var(--secondary), var(--tertiary));
      background-size: 200% 200%;
      background-clip: text;
      -webkit-background-clip: text;
      animation: subtitleShimmer 8s ease-in-out infinite;
      filter: drop-shadow(0 0 8px rgba(139, 92, 246, 0.35));
      margin: 0 0 1rem;
      line-height: 1.4;
      padding: 0 32px;
    }

    .preview-date {
      font-family: var(--font-mono);
      font-size: 0.85rem;
      color: var(--text-muted);
      margin: 0 0 1.5em;
      padding: 0 32px;
    }

    @keyframes subtitleShimmer {
      0%, 100% { background-position: 0% 50%; }
      50% { background-position: 200% 50%; }
    }

    @keyframes italicShimmer {
      0%, 100% { background-position: 0% 50%; }
      50% { background-position: 100% 50%; }
    }

    /* Headings */
    .editor-preview-content h2 {
      margin-top: 2.5rem;
      margin-bottom: 1rem;
      font-size: 1.5rem;
      color: var(--text);
      padding-bottom: 0.5rem;
      text-shadow: 0 0 20px rgba(139, 92, 246, 0.2);
      position: relative;
    }

    .editor-preview-content h2::after {
      content: '';
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      height: 1px;
      background: linear-gradient(90deg, var(--primary), var(--secondary), var(--primary));
      opacity: 0.6;
      box-shadow: 0 0 6px rgba(139, 92, 246, 0.4), 0 0 15px rgba(139, 92, 246, 0.2);
    }

    .editor-preview-content h3 {
      margin-top: 2rem;
      margin-bottom: 0.75rem;
      font-size: 1.25rem;
      color: var(--text);
      text-shadow: 0 0 15px rgba(139, 92, 246, 0.15);
    }

    .editor-preview-content p {
      margin-bottom: 1.5rem;
      color: var(--text-body, #c4c4cc);
    }

    /* Text emphasis - matches blog styling */
    .editor-preview-content strong {
      color: var(--text);
      font-weight: 600;
      text-shadow: 0 0 8px rgba(244, 244, 245, 0.15);
    }

    .editor-preview-content strong.glow {
      font-style: normal;
      font-weight: 700;
      color: transparent;
      background: linear-gradient(135deg, var(--primary-light), var(--secondary));
      background-clip: text;
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-size: 200% 200%;
      animation: italicShimmer 6s ease-in-out infinite;
      filter: drop-shadow(0 0 14px rgba(139, 92, 246, 0.6)) drop-shadow(0 0 30px rgba(236, 72, 153, 0.3));
      text-shadow: none;
      padding: 0 0.15em;
      margin: 0 -0.15em;
    }

    .editor-preview-content em {
      font-style: italic;
      background: linear-gradient(135deg, var(--primary-light), var(--secondary));
      background-clip: text;
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-size: 200% 200%;
      animation: italicShimmer 6s ease-in-out infinite;
      filter: drop-shadow(0 0 6px rgba(139, 92, 246, 0.3));
      padding: 0 0.15em;
      margin: 0 -0.15em;
    }

    .editor-preview-content strong em,
    .editor-preview-content em strong {
      font-style: italic;
      font-weight: 700;
      background: linear-gradient(135deg, var(--primary-light), var(--secondary));
      background-clip: text;
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-size: 200% 200%;
      animation: italicShimmer 6s ease-in-out infinite;
      filter: drop-shadow(0 0 10px rgba(139, 92, 246, 0.45));
      padding: 0 0.15em;
      margin: 0 -0.15em;
    }

    /* Links */
    .editor-preview-content a {
      color: var(--primary-light);
      text-decoration: none;
      border-bottom: 1px solid transparent;
      transition: border-color var(--transition), color var(--transition), filter var(--transition);
    }

    .editor-preview-content a:hover {
      color: var(--text);
      border-bottom-color: var(--primary);
      filter: drop-shadow(0 0 4px rgba(139, 92, 246, 0.4));
    }

    /* Lists */
    .editor-preview-content ul,
    .editor-preview-content ol {
      margin-bottom: 1.5rem;
      padding-left: 1.5rem;
      color: var(--text-body, #c4c4cc);
    }

    .editor-preview-content li {
      margin-bottom: 0.5rem;
    }

    /* Inline code */
    .editor-preview-content code {
      font-family: var(--font-mono);
      font-size: 0.9em;
      background: rgba(139, 92, 246, 0.15);
      padding: 0.2rem 0.4rem;
      border-radius: 4px;
      color: var(--tertiary);
    }

    /* Code blocks */
    .editor-preview-content pre {
      background: rgba(0, 0, 0, 0.5);
      border: 1px solid rgba(139, 92, 246, 0.3);
      border-radius: 8px;
      padding: 1.25rem;
      overflow-x: auto;
      margin: 1.5em 0;
    }

    .editor-preview-content pre code {
      background: none;
      padding: 0;
      color: var(--text);
    }

    /* Blockquote */
    .editor-preview-content blockquote {
      border-left: 3px solid var(--primary);
      margin: 2rem 0;
      padding: 1rem 1.5rem;
      background: linear-gradient(135deg, rgba(139, 92, 246, 0.1), rgba(236, 72, 153, 0.05));
      border-radius: 0 8px 8px 0;
      color: var(--primary-light);
      font-style: italic;
      box-shadow: inset 0 0 20px rgba(139, 92, 246, 0.08);
    }

    /* HR */
    .editor-preview-content hr {
      border: none;
      height: 1px;
      background: linear-gradient(90deg, var(--primary), var(--secondary), var(--primary));
      opacity: 0.5;
      margin: 2.5rem 0;
      box-shadow: 0 0 10px rgba(139, 92, 246, 0.3);
    }

    .editor-preview-content img {
      max-width: 100%;
      height: auto;
      border-radius: 8px;
      border: 1px solid var(--border);
    }

    /* Tables */
    .editor-preview-content table {
      width: 100%;
      border-collapse: collapse;
      margin: 1.5rem 0;
    }

    .editor-preview-content th,
    .editor-preview-content td {
      padding: 0.75rem 1rem;
      border: 1px solid var(--border);
      text-align: left;
    }

    .editor-preview-content th {
      background: rgba(139, 92, 246, 0.15);
      color: var(--text);
      font-weight: 600;
    }

    .editor-preview-content tr:nth-child(even) {
      background: rgba(139, 92, 246, 0.05);
    }

    /* Classic theme: suppress glow effects in preview */
    html.classic .editor-preview-content h2 { text-shadow: none; }
    html.classic .editor-preview-content h2::after { box-shadow: none; }
    html.classic .editor-preview-content h3 { text-shadow: none; }
    html.classic .editor-preview-content strong { text-shadow: none; }
    html.classic .editor-preview-content em {
      background: none;
      -webkit-background-clip: unset;
      -webkit-text-fill-color: var(--primary, inherit);
      filter: none;
      animation: none;
    }
    html.classic .editor-preview-content strong em,
    html.classic .editor-preview-content em strong {
      background: none;
      -webkit-background-clip: unset;
      -webkit-text-fill-color: var(--primary, inherit);
      filter: none;
      animation: none;
    }
    html.classic .editor-preview-content strong.glow {
      background: none;
      -webkit-background-clip: unset;
      -webkit-text-fill-color: var(--primary, inherit);
      filter: none;
      animation: none;
    }
    html.classic .preview-subtitle {
      background: none;
      -webkit-background-clip: unset;
      -webkit-text-fill-color: var(--primary, inherit);
      filter: none;
      animation: none;
    }
    html.classic .editor-preview-content hr { box-shadow: none; }
    html.classic .editor-preview-content blockquote { box-shadow: none; }

    /* AI Panel */
    .editor-ai-panel {
      position: absolute;
      right: 16px;
      top: 60px;
      width: 320px;
      background: var(--surface, #1a1a24);
      border: 1px solid var(--primary, #7c3aed);
      border-radius: 8px;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
    }

    .ai-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 10px 14px;
      border-bottom: 1px solid var(--border, #333);
      color: var(--primary-light, #c4b5fd);
      font-size: 13px;
      font-weight: 500;
    }

    .ai-model-select {
      padding: 4px 8px;
      border: 1px solid var(--border, #333);
      border-radius: 4px;
      background: var(--surface-solid, #0f0f14);
      color: var(--primary-light, #c4b5fd);
      font-size: 11px;
      outline: none;
      margin-left: auto;
    }

    .ai-model-select:focus {
      border-color: var(--primary, #7c3aed);
    }

    .ai-close {
      background: none;
      border: none;
      color: #9ca3af;
      font-size: 18px;
      cursor: pointer;
      padding: 0 4px;
      margin-left: 8px;
    }

    .ai-close:hover {
      color: #ef4444;
    }

    .ai-body {
      padding: 12px;
    }

    .ai-input {
      width: 100%;
      height: 120px;
      padding: 10px;
      border: 1px solid #333;
      border-radius: 6px;
      background: #0f0f14;
      color: #e5e7eb;
      font-size: 13px;
      font-family: system-ui, sans-serif;
      resize: none;
      outline: none;
    }

    .ai-input:focus {
      border-color: var(--primary, #7c3aed);
    }

    .ai-input::placeholder {
      color: #6b7280;
    }

    .ai-actions {
      display: flex;
      gap: 8px;
      margin-top: 10px;
    }

    .ai-voice-select {
      flex: 1;
      padding: 8px;
      border: 1px solid #333;
      border-radius: 4px;
      background: #0f0f14;
      color: #e5e7eb;
      font-size: 12px;
      outline: none;
    }

    .ai-submit {
      padding: 8px 16px;
      border: none;
      border-radius: 4px;
      background: var(--primary, #7c3aed);
      color: white;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      transition: background 0.15s;
    }

    .ai-submit:hover {
      background: color-mix(in srgb, var(--primary, #7c3aed) 85%, black);
    }

    .ai-submit:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .ai-loading {
      padding: 16px;
      text-align: center;
      color: #9ca3af;
    }

    .ai-spinner {
      display: inline-block;
      width: 16px;
      height: 16px;
      border: 2px solid var(--border, #333);
      border-top-color: var(--primary, #7c3aed);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    /* Mobile */
    @media (max-width: 768px) {
      .editor-body {
        flex-direction: column;
      }

      .editor-source {
        border-right: none;
        border-bottom: 1px solid #333;
      }

      .editor-ai-panel {
        right: 8px;
        left: 8px;
        width: auto;
      }
    }

    .editor-toast {
      position: absolute;
      top: 56px;
      right: 16px;
      padding: 8px 16px;
      border-radius: 6px;
      font-family: monospace;
      font-size: 13px;
      z-index: 10;
      animation: editorToastIn 0.2s ease-out;
      pointer-events: none;
    }

    .editor-toast.success {
      background: rgba(34, 197, 94, 0.15);
      border: 1px solid #22c55e;
      color: #86efac;
    }

    .editor-toast.error {
      background: rgba(239, 68, 68, 0.15);
      border: 1px solid #ef4444;
      color: #fca5a5;
    }

    @keyframes editorToastIn {
      from { opacity: 0; transform: translateY(-8px); }
      to { opacity: 1; transform: translateY(0); }
    }

    @keyframes editorToastOut {
      from { opacity: 1; transform: translateY(0); }
      to { opacity: 0; transform: translateY(-8px); }
    }
  `;
  editor.appendChild(style);

  function showToast(message: string, type: 'success' | 'error' = 'success', duration = 2000) {
    const existing = editor.querySelector('.editor-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = `editor-toast ${type}`;
    toast.textContent = message;
    editor.querySelector('.editor-window')!.appendChild(toast);

    setTimeout(() => {
      toast.style.animation = 'editorToastOut 0.2s ease-in forwards';
      setTimeout(() => toast.remove(), 200);
    }, duration);
  }

  // Get elements
  const textarea = editor.querySelector('.editor-textarea') as HTMLTextAreaElement;
  const preview = editor.querySelector('.editor-preview-content') as HTMLDivElement;
  const aiPanel = editor.querySelector('.editor-ai-panel') as HTMLDivElement;
  const aiInput = editor.querySelector('.ai-input') as HTMLTextAreaElement;
  const aiVoice = editor.querySelector('.ai-voice-select') as HTMLSelectElement;
  const aiModel = editor.querySelector('.ai-model-select') as HTMLSelectElement;
  const aiSubmit = editor.querySelector('.ai-submit') as HTMLButtonElement;
  const aiLoading = editor.querySelector('.ai-loading') as HTMLDivElement;
  const aiBody = editor.querySelector('.ai-body') as HTMLDivElement;

  // Save model preference when changed
  aiModel.addEventListener('change', () => {
    saveModel(aiModel.value);
  });

  // Build editable path UI
  const pathEl = editor.querySelector('.editor-path') as HTMLSpanElement;
  const postMatch = path.match(/^(\/\d{4}\/\d{2}\/\d{2}\/)([^/]+)(\/?)$/);
  let currentPath = path;

  if (postMatch) {
    const [, prefix, slug, suffix] = postMatch;
    pathEl.innerHTML = `<span class="editor-path-prefix">${prefix}</span><span class="editor-path-slug">${slug}</span><span class="editor-path-suffix">${suffix}</span>`;

    const slugEl = pathEl.querySelector('.editor-path-slug') as HTMLSpanElement;

    slugEl.addEventListener('click', () => {
      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'editor-path-slug-input';
      input.value = slugEl.textContent || '';
      input.size = Math.max(input.value.length, 10);

      input.addEventListener('input', () => {
        input.size = Math.max(input.value.length, 10);
      });

      const finishEdit = () => {
        const newSlug = input.value.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
        if (!newSlug) {
          slugEl.style.display = '';
          input.remove();
          return;
        }
        slugEl.textContent = newSlug;
        slugEl.style.display = '';
        input.remove();

        const newPath = prefix + newSlug + '/';
        if (newPath !== path) {
          currentPath = newPath;
          // Show renamed indicator
          let badge = pathEl.querySelector('.editor-path-renamed') as HTMLSpanElement;
          if (!badge) {
            badge = document.createElement('span');
            badge.className = 'editor-path-renamed';
            pathEl.appendChild(badge);
          }
          badge.textContent = '(renamed)';
        } else {
          currentPath = path;
          pathEl.querySelector('.editor-path-renamed')?.remove();
        }
        checkDirty();
      };

      input.addEventListener('blur', finishEdit);
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
        if (e.key === 'Escape') { slugEl.style.display = ''; input.remove(); }
      });

      slugEl.style.display = 'none';
      slugEl.parentNode!.insertBefore(input, slugEl);
      input.focus();
      input.select();
    });
  } else {
    pathEl.textContent = path;
  }

  // Update preview on input
  function updatePreview() {
    const md = textarea.value;
    // Extract frontmatter and content
    const fmMatch = md.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);

    let frontmatter: Record<string, string> = {};
    let content = md;

    if (fmMatch) {
      // Parse frontmatter
      const fmLines = fmMatch[1].split('\n');
      for (const line of fmLines) {
        const match = line.match(/^(\w+):\s*["']?([^"'\n]*)["']?/);
        if (match) {
          frontmatter[match[1]] = match[2];
        }
      }
      content = fmMatch[2];
    }

    // Build preview with title/subtitle from frontmatter
    let html = '';
    if (frontmatter.title) {
      html += `<h1 class="preview-title">${frontmatter.title}</h1>`;
    }
    if (frontmatter.subtitle) {
      html += `<p class="preview-subtitle">${frontmatter.subtitle}</p>`;
    }
    if (frontmatter.date) {
      html += `<p class="preview-date">${frontmatter.date}</p>`;
    }
    html += '<div class="preview-content">' + (marked.parse(content) as string) + '</div>';

    preview.innerHTML = html;
  }

  const saveBtn = editor.querySelector('.editor-btn-save') as HTMLButtonElement;
  let lastSavedContent = content;
  let lastSavedPath = path;

  function checkDirty() {
    const dirty = textarea.value !== lastSavedContent || currentPath !== lastSavedPath;
    saveBtn.disabled = !dirty;
  }

  textarea.addEventListener('input', () => { updatePreview(); checkDirty(); });
  updatePreview();
  checkDirty();

  // Close handlers
  editor.querySelector('.editor-backdrop')?.addEventListener('click', closeEditor);
  editor.querySelector('.editor-btn-close')?.addEventListener('click', closeEditor);

  // ESC to close
  const escHandler = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      closeEditor();
      document.removeEventListener('keydown', escHandler);
    }
  };
  document.addEventListener('keydown', escHandler);

  // Save handler - saves locally, updates page in memory
  saveBtn.addEventListener('click', () => {
    if (saveBtn.disabled) return;
    let newContent = textarea.value;

    // Check if frontmatter date changed - updates the path automatically
    if (postMatch) {
      const fmDateMatch = newContent.match(/^---\s*\n[\s\S]*?^date:\s*["']?(\d{4}-\d{2}-\d{2})["']?/m);
      if (fmDateMatch) {
        const fmDate = fmDateMatch[1];
        const [origYear, origMonth, origDay] = [postMatch[1], postMatch[2], postMatch[3]];
        const origDate = `${origYear}-${origMonth}-${origDay}`;
        if (fmDate !== origDate) {
          const [newYear, newMonth, newDay] = fmDate.split('-');
          const currentSlug = currentPath.match(/\/\d{4}\/\d{2}\/\d{2}\/([^/]+)/)?.[1] || postMatch[2 + 2];
          currentPath = `/${newYear}/${newMonth}/${newDay}/${currentSlug}/`;
          // Update the path display
          const prefixEl = pathEl.querySelector('.editor-path-prefix');
          if (prefixEl) prefixEl.textContent = `/${newYear}/${newMonth}/${newDay}/`;
          let badge = pathEl.querySelector('.editor-path-renamed') as HTMLSpanElement;
          if (!badge) {
            badge = document.createElement('span');
            badge.className = 'editor-path-renamed';
            pathEl.appendChild(badge);
          }
          badge.textContent = '(renamed)';
        }
      }
    }

    // If renamed (slug or date change), handle redirect_from in frontmatter
    const isRenamed = currentPath !== path;
    if (isRenamed) {
      newContent = addRedirectToFrontmatter(newContent, path);
      textarea.value = newContent;
      updatePreview();
    }

    // Save to localStorage under the NEW path
    const editPath = isRenamed ? currentPath : path;
    const edit = { path: editPath, content: newContent, originalContent: content, timestamp: Date.now(), oldPath: isRenamed ? path : undefined };
    const edits = getPendingEdits();
    // If renamed, remove any edit saved under the old path
    if (isRenamed && edits[path]) {
      delete edits[path];
    }
    edits[editPath] = edit;
    localStorage.setItem(EDITS_KEY, JSON.stringify(edits));
    updatePendingChangesIndicator();

    // Update the page in memory if we're viewing it
    updatePageContent(path, newContent);

    // Store github client globally for commit dialog
    (window as unknown as Record<string, unknown>).__githubClient = github;

    lastSavedContent = newContent;
    lastSavedPath = currentPath;
    saveBtn.disabled = true;
    onSave?.();

    showToast('Saved locally', 'success', 800);
    setTimeout(() => closeEditor(), 1000);
  });

  // AI Panel toggle
  editor.querySelector('.editor-btn-ai')?.addEventListener('click', () => {
    aiPanel.hidden = !aiPanel.hidden;
    if (!aiPanel.hidden) {
      aiInput.focus();
    }
  });

  editor.querySelector('.ai-close')?.addEventListener('click', () => {
    aiPanel.hidden = true;
  });

  // AI Submit
  aiSubmit.addEventListener('click', async () => {
    const instruction = aiInput.value.trim();
    if (!instruction) return;

    const voice = aiVoice.value;
    const model = aiModel.value;
    const currentContent = textarea.value;

    // Preserve frontmatter - AI should only edit body content
    const fmSplit = currentContent.match(/^(---\s*\n[\s\S]*?\n---\s*\n)([\s\S]*)$/);
    const frontmatter = fmSplit ? fmSplit[1] : '';
    const bodyOnly = fmSplit ? fmSplit[2] : currentContent;

    aiBody.hidden = true;
    aiLoading.hidden = false;
    aiSubmit.disabled = true;

    try {
      const aiResult = await callAI(bodyOnly, instruction, voice, model);

      // Strip any frontmatter the AI might have added to its response
      const aiBody2 = aiResult.replace(/^---\s*\n[\s\S]*?\n---\s*\n/, '');

      // Reconstruct with preserved frontmatter
      const result = frontmatter + aiBody2;

      // Show diff view instead of directly applying
      showDiffView(
        currentContent,
        result,
        // On accept
        (accepted) => {
          textarea.value = accepted;
          updatePreview();
          checkDirty();
          aiInput.value = '';
          aiPanel.hidden = true;
        },
        // On reject - do nothing, content stays the same
        () => {}
      );
    } catch (e) {
      console.error('AI error:', e);
      showToast('AI request failed: ' + (e instanceof Error ? e.message : 'Unknown error'), 'error', 4000);
    } finally {
      aiBody.hidden = false;
      aiLoading.hidden = true;
      aiSubmit.disabled = false;
    }
  });

  // Cmd/Ctrl+S to save
  textarea.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 's') {
      e.preventDefault();
      editor.querySelector('.editor-btn-save')?.dispatchEvent(new Event('click'));
    }
  });

  document.body.appendChild(editor);
  document.body.style.overflow = 'hidden';
  currentEditor = editor;
  textarea.focus();
}

export function closeEditor(): void {
  if (currentEditor) {
    currentEditor.remove();
    currentEditor = null;
    document.body.style.overflow = '';
  }
  if (currentOnClose) {
    currentOnClose();
    currentOnClose = null;
  }
}

// Available models for the AI assistant
const AI_MODELS = [
  { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B', description: 'Best quality' },
  { id: 'openai/gpt-oss-120b', name: 'GPT OSS 120B', description: 'OpenAI open-weight' },
];

// Comprehensive style guide for the blog
const STYLE_GUIDE = `
## Markdown Formatting Rules

### Emphasis Hierarchy (use sparingly, each level stronger than the last):
1. *Italics* - For asides, parenthetical commentary, softer emphasis, self-deprecating remarks
2. **Bold** - For key terms, important phrases, technical emphasis
3. <strong class="glow">Glow text</strong> - For maximum impact moments, key insights, revelations, "flex" moments. Use 2-5 times per post maximum.
4. <strong><em>Bold italic</em></strong> - For names or terms that need special styling (rare)

### Structure:
- Use \`---\` horizontal rules to separate major sections
- Use \`## Section Title\` for main sections (h2)
- Use \`### Subsection\` for subsections (h3)
- Frontmatter: layout, title, subtitle (optional), date, tags

### Code:
- Inline \`backticks\` for commands, file names, technical terms, function names
- Code blocks with language identifier for longer examples: \`\`\`typescript

### Lists:
- Use \`-\` for bullet lists
- Use numbers for ordered/sequential steps
- Parallel structure within lists

### Links:
- Standard markdown: [text](url)
- External links should be relevant and authoritative

## Voice Patterns

### Conversational Asides (in italics):
- Add color and personality: *Like this.*
- Self-deprecating humor: *I was ten. Cut me some slack.*
- Sarcastic commentary: *Thanks, I hate it!*
- Soften technical claims: *roughly speaking*

### Direct Address:
- "Here's the thing:" / "Let me explain"
- "Let me be specific about..."
- Rhetorical questions followed by answers

### Rhythm:
- Vary sentence length. Short punchy sentences. Then longer ones that build and expand on the idea with additional context and nuance.
- Build tension, then payoff
- End sections with punch lines

### Punctuation:
- NEVER use em dashes (—). Use hyphens (-), colons, semicolons, or restructure sentences instead.
- Keep hyphens in compound words: follow-up, re-download, pre-installed, time-based, etc.

### Common Patterns:
- "Not because X, but because Y"
- Lists with strong parallel structure
- Callbacks to earlier points
- Strong opinions with acknowledged tradeoffs
`;

// Voice definitions
const VOICE_GUIDES: Record<string, string> = {
  casual: `Casual/Conversational Voice:
- Heavy use of contractions (don't, won't, it's, that's)
- Frequent italicized asides for commentary: *obviously*, *surprisingly*, *not gonna lie*
- Self-deprecating humor and admitting mistakes
- Direct "you" address to the reader
- Rhetorical questions: "Sound familiar?"
- Colloquialisms: "the thing is", "here's the deal", "look"
- Sentence fragments for emphasis. Like this.
- Exclamations: "Come on!!", "It's beautiful!"
- Pop culture references when relevant`,

  professional: `Professional/Authoritative Voice:
- Clear, declarative statements
- Precise technical terminology
- Well-structured arguments with evidence
- Measured tone - confident but not arrogant
- Fewer asides, more direct exposition
- Complete sentences, proper grammar
- Citations and references where appropriate
- Acknowledges complexity and tradeoffs
- "Consider", "Note that", "It's worth mentioning"`,

  witty: `Witty/Playful Voice:
- Clever wordplay and double meanings
- Unexpected analogies and metaphors
- Subverted expectations - set up one thing, deliver another
- Self-aware meta-commentary: *Yes, I'm bragging. Deal with it.*
- Dry humor and understatement
- Pop culture and internet references
- Playful jabs at common frustrations
- Callbacks and running jokes within the piece
- Strong punchlines at section ends
- "Chef's kiss", "Absolutely iconic", "We love to see it"`,

  technical: `Technical/Educational Voice:
- Precise definitions and explanations
- Step-by-step breakdowns
- Code examples with inline commentary
- "First... then... finally..." structure
- Anticipates reader questions
- Links concepts to prior knowledge
- Uses analogies to explain complex ideas
- "In other words", "Put simply", "The key insight is"
- Acknowledges edge cases and limitations`,
};

// Get saved model preference
function getSavedModel(): string {
  try {
    return localStorage.getItem('ellyseum_ai_model') || AI_MODELS[0].id;
  } catch {
    return AI_MODELS[0].id;
  }
}

// Save model preference
function saveModel(modelId: string): void {
  try {
    localStorage.setItem('ellyseum_ai_model', modelId);
  } catch {
    // localStorage might be unavailable
  }
}

// Estimate tokens (~4 chars per token for English, conservative)
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 3.5);
}

async function callAI(content: string, instruction: string, voice: string, model: string): Promise<string> {
  // Get worker URL from config
  const config = SITE_CONFIG as Record<string, unknown>;
  const workerUrl = (config.worker_url as string) || 'https://chat.api.ellyseum.dev';

  // Calculate tokens needed - content will be returned modified, so output ≈ input size
  const contentTokens = estimateTokens(content);
  const bufferTokens = 2000; // Extra room for AI additions
  const maxOutputTokens = Math.max(contentTokens + bufferTokens, 16384);

  console.log(`[AI] Content: ~${contentTokens} tokens, requesting ${maxOutputTokens} max output`);

  // Build comprehensive system prompt
  let systemPrompt = `You are a skilled writing assistant helping edit a markdown blog post.
The user will give you the current content and an instruction for how to modify it.

CRITICAL: Return ONLY the modified markdown content. No explanations, no code fences wrapping the whole thing, no "Here's the updated version:" preamble. Just the raw markdown content starting with the frontmatter.

Preserve the frontmatter (the --- delimited section at the top) exactly as-is unless the instruction specifically asks to change it.

${STYLE_GUIDE}`;

  // Add voice-specific guidance
  if (voice && VOICE_GUIDES[voice]) {
    systemPrompt += `\n\n## Voice Style to Use:\n${VOICE_GUIDES[voice]}`;
  } else if (voice) {
    // Custom voice prompt
    systemPrompt += `\n\n## Voice Style to Use:\n${voice}`;
  }

  const response = await fetch(workerUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Here is the current content:\n\n${content}\n\n---\n\nInstruction: ${instruction}` },
      ],
      model: model || 'llama-3.3-70b-versatile',
      temperature: 0.7,
      max_tokens: maxOutputTokens,
    }),
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  // Check Content-Type to determine response format
  const contentType = response.headers.get('content-type') || '';
  const isSSE = contentType.includes('text/event-stream');
  const isJSON = contentType.includes('application/json');

  console.log('[AI] Response Content-Type:', contentType, 'isSSE:', isSSE, 'isJSON:', isJSON);

  let result = '';

  // Handle non-streaming JSON response
  if (isJSON && !isSSE) {
    const json = await response.json();
    console.log('[AI] Got JSON response:', JSON.stringify(json).slice(0, 500));

    // Handle standard chat completion response
    const content = json.choices?.[0]?.message?.content || json.choices?.[0]?.delta?.content;
    if (content) {
      result = content;
    } else if (json.error) {
      throw new Error(json.error.message || 'API returned an error');
    } else {
      console.error('[AI] Unexpected JSON structure:', json);
      throw new Error('Unexpected API response format');
    }
  } else {
    // Handle streaming SSE response
    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine) continue;

        if (trimmedLine.startsWith('data: ')) {
          const data = trimmedLine.slice(6).trim();
          if (data === '[DONE]') continue;

          try {
            const parsed = JSON.parse(data);
            // Handle both streaming (delta) and non-streaming (message) formats
            const token = parsed.choices?.[0]?.delta?.content ||
                          parsed.choices?.[0]?.message?.content;
            if (token) {
              result += token;
            }
            // Check for error in response
            if (parsed.error) {
              console.error('[AI] Error in stream:', parsed.error);
              throw new Error(parsed.error.message || 'API error');
            }
          } catch (e) {
            if (e instanceof SyntaxError) {
              // JSON parse error - log but continue
              console.warn('[AI] Failed to parse SSE data:', data.slice(0, 100));
            } else {
              throw e;
            }
          }
        } else if (trimmedLine.startsWith('{')) {
          // Some APIs send raw JSON without "data: " prefix
          try {
            const parsed = JSON.parse(trimmedLine);
            const token = parsed.choices?.[0]?.delta?.content ||
                          parsed.choices?.[0]?.message?.content;
            if (token) {
              result += token;
            }
          } catch {
            // Ignore parse errors
          }
        }
      }
    }

    // Process any remaining content in buffer
    if (buffer.trim()) {
      for (const line of buffer.split('\n')) {
        const trimmedLine = line.trim();
        if (trimmedLine.startsWith('data: ')) {
          const data = trimmedLine.slice(6).trim();
          if (data && data !== '[DONE]') {
            try {
              const parsed = JSON.parse(data);
              const token = parsed.choices?.[0]?.delta?.content ||
                            parsed.choices?.[0]?.message?.content;
              if (token) {
                result += token;
              }
            } catch {
              // Ignore
            }
          }
        } else if (trimmedLine.startsWith('{')) {
          try {
            const parsed = JSON.parse(trimmedLine);
            const token = parsed.choices?.[0]?.delta?.content ||
                          parsed.choices?.[0]?.message?.content;
            if (token) {
              result += token;
            }
          } catch {
            // Ignore
          }
        }
      }
    }
  }

  console.log('[AI] Final result length:', result.length, 'chars');
  console.log('[AI] Result preview:', result.slice(0, 500) + (result.length > 500 ? '...' : ''));

  // Sanity check - if result is empty or way too short, something went wrong
  if (!result || result.trim().length === 0) {
    throw new Error('AI returned empty response. Please try again.');
  }

  // If result is less than 20% of original length, probably truncated/broken
  if (result.length < content.length * 0.2) {
    console.warn('[AI] Result suspiciously short:', result.length, 'vs original', content.length);
    throw new Error(`AI response appears truncated (${result.length} chars vs ${content.length} original). Please try again.`);
  }

  // Remove all em dashes - LLMs love inserting them everywhere
  // Between words: follow—up → follow-up
  // Standalone/punctuation: " — " → " - ", "—" → "-"
  result = result.replace(/(\w)—(\w)/g, '$1-$2');
  result = result.replace(/\s*—\s*/g, ' - ');

  // Sanity check for truncation
  if (result && looksLikeTruncated(result)) {
    console.warn('[AI] Output appears truncated, attempting continuation...');
    const continuation = await continueGeneration(workerUrl, result, model);
    if (continuation) {
      result = continuation;
    }
  }

  return result;
}

// Check if output looks truncated
function looksLikeTruncated(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;

  // Check for mid-word cutoff (ends with letter but no punctuation)
  const lastChar = trimmed[trimmed.length - 1];
  const endsWithLetter = /[a-zA-Z]/.test(lastChar);
  const lastWord = trimmed.split(/\s+/).pop() || '';
  const lastWordLooksIncomplete = endsWithLetter && lastWord.length < 15 && !/^(a|I|to|in|on|is|it|be|as|at|so|we|he|or|an|my|do|if|up|no)$/i.test(lastWord);

  // Check for unclosed code blocks
  const codeBlockStarts = (text.match(/```/g) || []).length;
  const unclosedCodeBlock = codeBlockStarts % 2 !== 0;

  // Check for missing closing frontmatter
  const frontmatterStarts = (text.match(/^---\s*$/gm) || []).length;
  const missingFrontmatter = frontmatterStarts === 1; // Should have 2 (open and close)

  // Check for obvious cutoffs
  const endsWithPartialWord = /[a-zA-Z]{2,}$/.test(trimmed) && !/[.!?:;"'\]\)]$/.test(trimmed);

  return unclosedCodeBlock || missingFrontmatter || (lastWordLooksIncomplete && endsWithPartialWord);
}

// Continue a truncated generation
async function continueGeneration(workerUrl: string, partialResult: string, model: string): Promise<string | null> {
  try {
    const response = await fetch(workerUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: 'Continue writing from exactly where this text left off. Do not repeat any content, just continue seamlessly.' },
          { role: 'user', content: `Continue this text:\n\n${partialResult.slice(-2000)}` }, // Last 2000 chars for context
        ],
        model: model || 'llama-3.3-70b-versatile',
        temperature: 0.7,
        max_tokens: 8192,
      }),
    });

    if (!response.ok) return null;

    const reader = response.body?.getReader();
    if (!reader) return null;

    const decoder = new TextDecoder();
    let buffer = '';
    let continuation = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') continue;
          try {
            const parsed = JSON.parse(data);
            const token = parsed.choices?.[0]?.delta?.content;
            if (token) continuation += token;
          } catch { /* ignore */ }
        }
      }
    }

    if (continuation) {
      // Find overlap point and merge
      const overlapSize = 50;
      const partialEnd = partialResult.slice(-overlapSize);
      const overlapIndex = continuation.indexOf(partialEnd.slice(-20));

      if (overlapIndex > -1) {
        // Found overlap, merge cleanly
        return partialResult + continuation.slice(overlapIndex + 20);
      } else {
        // No clear overlap, just append
        return partialResult + continuation;
      }
    }
  } catch (e) {
    console.error('[AI] Continuation failed:', e);
  }
  return null;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
