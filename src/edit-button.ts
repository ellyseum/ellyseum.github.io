/**
 * Edit button for authenticated users on blog post pages.
 * Dynamically injected into .post-header via JS only - invisible in page source.
 * Lazy-loads editor + GitHub modules only on click.
 */

const POST_URL_PATTERN = /^\/\d{4}\/\d{2}\/\d{2}\/[^/]+\/?$/;
const PAT_KEY = '_ep';

let editButton: HTMLButtonElement | null = null;
let styleEl: HTMLStyleElement | null = null;
let cachedGitHub: import('@/terminal/github').GitHubClient | null = null;

export async function initEditButton(): Promise<void> {
  if (!POST_URL_PATTERN.test(window.location.pathname)) return;
  const pat = localStorage.getItem(PAT_KEY);
  if (!pat) return;

  // Validate token before showing anything
  const { GitHubClient } = await import('@/terminal/github');
  const github = new GitHubClient(pat);
  const valid = await github.validateToken();
  if (!valid) {
    localStorage.removeItem(PAT_KEY);
    return;
  }

  // Token valid - cache the client and show the button
  cachedGitHub = github;
  injectButton();
}

function injectButton(): void {
  if (editButton) return;

  const body = document.querySelector('.post-content');
  if (!body) return;

  // Make body position-relative so we can absolutely position the icon
  (body as HTMLElement).style.position = 'relative';

  editButton = document.createElement('button');
  editButton.className = 'edit-post-btn';
  editButton.setAttribute('aria-label', 'Edit this post');
  editButton.title = 'Edit this post';
  editButton.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>`;

  styleEl = document.createElement('style');
  styleEl.textContent = `
    .edit-post-btn {
      position: absolute;
      top: 0;
      right: 0;
      width: 32px;
      height: 32px;
      border-radius: 6px;
      background: transparent;
      border: 1px solid transparent;
      color: #6b7280;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: color 0.2s, border-color 0.2s, background 0.2s, transform 0.2s;
      opacity: 0;
      animation: editBtnFadeIn 0.4s ease-out forwards;
    }
    .edit-post-btn:hover {
      color: #a78bfa;
      transform: scale(1.1);
    }
    .edit-post-btn:active {
      transform: scale(0.95);
    }
    .edit-post-btn.loading {
      pointer-events: none;
      color: #a78bfa;
    }
    .edit-post-btn.loading svg {
      animation: editBtnSpin 1s linear infinite;
    }
    @keyframes editBtnFadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    @keyframes editBtnSpin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
    .edit-toast {
      position: fixed;
      top: 24px;
      right: 24px;
      background: rgba(15, 15, 20, 0.95);
      border: 1px solid #ef4444;
      color: #fca5a5;
      padding: 8px 16px;
      border-radius: 8px;
      font-family: monospace;
      font-size: 13px;
      z-index: 9999;
      animation: editBtnFadeIn 0.2s ease-out;
    }
  `;
  document.head.appendChild(styleEl);

  editButton.addEventListener('click', handleEditClick);
  body.appendChild(editButton);
}

function showButton(): void {
  if (editButton) {
    editButton.style.display = 'flex';
  }
}

function hideButton(): void {
  if (editButton) {
    editButton.style.display = 'none';
  }
}

function showToast(message: string): void {
  const toast = document.createElement('div');
  toast.className = 'edit-toast';
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

async function handleEditClick(): Promise<void> {
  if (!editButton) return;

  const pat = localStorage.getItem(PAT_KEY);
  if (!pat) {
    removeButton();
    return;
  }

  editButton.classList.add('loading');

  try {
    const { openEditor } = await import('@/terminal/editor');

    // Use cached client from init validation
    const github = cachedGitHub!;
    const content = await github.getFileContent(window.location.pathname);
    if (!content) {
      editButton.classList.remove('loading');
      showToast('Could not find source for this page.');
      return;
    }

    (window as unknown as Record<string, unknown>).__githubClient = github;

    hideButton();
    openEditor({
      path: window.location.pathname,
      content,
      github,
      onClose: showButton,
    });
  } catch (err) {
    console.error('[edit-button]', err);
    showToast('Failed to open editor.');
  } finally {
    if (editButton) {
      editButton.classList.remove('loading');
    }
  }
}

function removeButton(): void {
  if (editButton) {
    editButton.remove();
    editButton = null;
  }
  if (styleEl) {
    styleEl.remove();
    styleEl = null;
  }
}
