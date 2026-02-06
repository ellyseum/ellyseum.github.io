/**
 * Ellyseum - Immersive WebGL Experience
 * TypeScript + Vite build
 */

import { Experience } from '@/core/experience';
import { ThemeManager } from '@/core/theme-manager';
import { initThemeSwitcher } from '@/components/theme-switcher';
import { initSecretTerminal } from '@/terminal';

// Initialize secret terminal (console easter egg + konami listener)
initSecretTerminal();

// Check for pending edits and show indicator if any exist
(() => {
  try {
    const edits = JSON.parse(localStorage.getItem('ellyseum_pending_edits') || '{}');
    if (Object.keys(edits).length > 0) {
      // Lazy load editor module to show indicator
      import('@/terminal/editor').then(({ initPendingEditsIndicator, applyLocalEditsToPage }) => {
        initPendingEditsIndicator();
        applyLocalEditsToPage();
      });
    }
  } catch { /* ignore */ }
})();

// Silent auth shortcut
(window as unknown as Record<string, unknown>)._a = (t: string) => {
  if (!t) return;
  import('@/terminal/github').then(async ({ GitHubClient }) => {
    const g = new GitHubClient(t);
    if (!await g.validateToken()) return;
    localStorage.setItem('_ep', t);
    try { sessionStorage.setItem('ellyseum_terminal_unlocked', '1'); } catch {}
    (window as unknown as Record<string, unknown>).__githubClient = g;
    import('./edit-button').then(m => m.initEditButton()).catch(() => {});
  }).catch(() => {});
};

// Floating edit button for authenticated users on post pages
(() => {
  try {
    if (!localStorage.getItem('_ep')) return;
    if (!/^\/\d{4}\/\d{2}\/\d{2}\/[^/]+\/?$/.test(window.location.pathname)) return;
    import('./edit-button').then(({ initEditButton }) => initEditButton());
  } catch { /* ignore */ }
})();

// Theme manager - handles lifecycle, localStorage, WebGL create/destroy
const experience: { current: Experience | null } = { current: null };

const themeManager = new ThemeManager((theme) => {
  // Galaxy -> Classic: destroy WebGL (no reload needed)
  if (theme !== 'galaxy' && experience.current) {
    experience.current.destroy();
    experience.current = null;
    (window as Window & { experience?: Experience }).experience = undefined;
  }
});

// Apply theme (the inline script already set data-theme for FOUC prevention,
// but this ensures JS state is in sync)
themeManager.applyTheme();

// Initialize theme switcher UI
initThemeSwitcher(themeManager);

// Conditionally initialize WebGL experience
if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  document.body.classList.add('reduced-motion');
} else if (!themeManager.isClassic()) {
  // Galaxy theme: full WebGL experience (includes SPA nav, cards, etc.)
  experience.current = new Experience();
  (window as Window & { experience?: Experience }).experience = experience.current;
} else {
  // Classic themes: no WebGL, but still need SPA navigation + interactive components
  document.body.classList.add('loaded');
  import('@/core/classic-experience').then(({ initClassicExperience }) => {
    initClassicExperience();
  });
}

// Chat widget loading strategy
(() => {
  const isMobile = window.innerWidth <= 768;

  if (isMobile) {
    // Mobile: Load chat widget and preload LLM worker immediately
    import('@/components/chat-widget/chat-widget').then(({ initChatWidget }) => {
      const widget = initChatWidget();
      widget.preload();
    });
  } else {
    // Desktop: Show placeholder button, load real widget on hover
    const placeholder = document.createElement('div');
    placeholder.innerHTML = `
      <button class="chat-toggle-placeholder" style="
        position: fixed;
        bottom: 24px;
        right: 24px;
        width: 56px;
        height: 56px;
        border-radius: 50%;
        background: linear-gradient(135deg, var(--primary), var(--secondary));
        border: none;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: var(--glow);
        z-index: 200;
        transition: transform 0.3s, box-shadow 0.3s;
      ">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="white">
          <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/>
        </svg>
      </button>
    `;
    const btn = placeholder.firstElementChild as HTMLElement;
    document.body.appendChild(btn);

    btn.addEventListener('mouseenter', () => {
      btn.style.transform = 'scale(1.05)';
      btn.style.boxShadow = 'var(--glow-strong, 0 6px 30px rgba(139, 92, 246, 0.6))';
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.transform = '';
      btn.style.boxShadow = '';
    });

    let loaded = false;
    const loadChat = () => {
      if (loaded) return;
      loaded = true;
      import('@/components/chat-widget/chat-widget').then(({ initChatWidget }) => {
        btn.remove(); // Remove placeholder only after widget is ready
        const widget = initChatWidget();
        // Preload worker immediately so LLM is ready faster
        widget.preload();
      });
    };

    btn.addEventListener('mouseenter', loadChat, { once: true });
  }
})();
