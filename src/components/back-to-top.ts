let button: HTMLButtonElement | null = null;

export function initBackToTop(): void {
  if (button) return; // already initialized

  button = document.createElement('button');
  button.className = 'back-to-top';
  button.setAttribute('aria-label', 'Back to top');
  button.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg>`;
  document.body.appendChild(button);

  button.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  // Show/hide based on scroll position
  let visible = false;
  let ticking = false;

  const update = (): void => {
    const show = window.scrollY > 300;
    if (show !== visible) {
      visible = show;
      button!.classList.toggle('visible', show);
    }
    ticking = false;
  };

  window.addEventListener('scroll', () => {
    if (!ticking) {
      requestAnimationFrame(update);
      ticking = true;
    }
  }, { passive: true });

  // Check initial state
  update();
}
