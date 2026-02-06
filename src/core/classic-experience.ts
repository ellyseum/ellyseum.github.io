/**
 * Classic Experience - non-WebGL components for classic themes
 * Provides SPA navigation, interactive cards, and utilities
 * without any WebGL rendering
 */

import { ViewTransitions } from '@/components/view-transitions';
import { initPostNavSticky } from '@/components/post-nav-sticky';
import { initBackToTop } from '@/components/back-to-top';
import { SearchFilter } from '@/components/search-filter';
import { initTypewriter } from '@/components/typewriter';
import { initCodeCopy } from '@/components/code-copy';

function reinit(): void {
  initPostNavSticky();
  initTypewriter();
  initCodeCopy();

  if (document.querySelector('.site-content #posts-data')) {
    const sf = new SearchFilter();
    sf.init();
  }

  // Edit button for authenticated users on post pages
  try {
    if (localStorage.getItem('_ep')) {
      import('@/edit-button').then(({ initEditButton }) => initEditButton());
    }
  } catch { /* ignore */ }

  // Apply local edits to current page
  try {
    const edits = JSON.parse(localStorage.getItem('ellyseum_pending_edits') || '{}');
    if (Object.keys(edits).length > 0) {
      import('@/terminal/editor').then(({ applyLocalEditsToPage }) => applyLocalEditsToPage());
    }
  } catch { /* ignore */ }
}

export function initClassicExperience(): void {
  new ViewTransitions(() => reinit());
  initPostNavSticky();
  initBackToTop();
  initTypewriter();
  initCodeCopy();

  if (document.querySelector('.site-content #posts-data')) {
    const sf = new SearchFilter();
    sf.init();
  }
}
