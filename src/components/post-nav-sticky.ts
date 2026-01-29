let observer: IntersectionObserver | null = null;

export function cleanupPostNavSticky(): void {
  if (observer) {
    observer.disconnect();
    observer = null;
  }
  // Safety net: remove header-hidden in case a stale callback added it
  document.querySelector('.site-header')?.classList.remove('header-hidden');
  document.querySelector('.post-nav-sticky')?.classList.remove('visible');
  document.querySelector('.fps-monitor')?.classList.remove('fps-in-sticky');
}

export function initPostNavSticky(): void {
  cleanupPostNavSticky();

  // Reset site header state from any previous page
  const siteHeader = document.querySelector('.site-header');
  if (siteHeader) siteHeader.classList.remove('header-hidden');

  // Skip sticky nav on mobile - it's hidden via CSS
  if (window.innerWidth <= 768) return;

  // IMPORTANT: Scope to .site-content to avoid matching cached prerender divs
  const topNav = document.querySelector('.site-content .post-nav-top');
  const sticky = document.querySelector('.site-content .post-nav-sticky');
  const footer = document.querySelector('.site-content .post-footer');
  if (!topNav || !sticky) return;

  // Clone site nav into sticky bar's right slot
  const rightSlot = sticky.querySelector('.post-nav-sticky-right');
  if (rightSlot) {
    rightSlot.innerHTML = '';
    const headerNav = siteHeader?.querySelector('.site-nav');
    if (headerNav) {
      rightSlot.appendChild(headerNav.cloneNode(true));
    }
  }

  // Wire up back-to-top buttons
  const stickyTopBtn = sticky.querySelector('.post-nav-sticky-top');
  const footerTopBtn = document.querySelector('.site-content .post-footer-top');
  const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });
  stickyTopBtn?.addEventListener('click', scrollToTop);
  footerTopBtn?.addEventListener('click', scrollToTop);

  const fpsMonitor = document.querySelector('.fps-monitor') as HTMLElement | null;

  function isInViewport(el: Element): boolean {
    const rect = el.getBoundingClientRect();
    return rect.bottom > 0 && rect.top < window.innerHeight;
  }

  // Track visibility state
  let topVisible = true; // Assume visible initially to prevent header flash
  let footerVisible = footer ? isInViewport(footer) : false;
  let initialized = false; // Prevent updates until layout settles

  function update(): void {
    if (!initialized) return; // Don't update until initialized
    const show = !topVisible && !footerVisible;
    sticky!.classList.toggle('visible', show);
    if (siteHeader) siteHeader.classList.toggle('header-hidden', show);
    if (fpsMonitor) fpsMonitor.classList.toggle('fps-in-sticky', show);
  }

  observer = new IntersectionObserver((entries) => {
    if (!observer) return; // stale callback after cleanup
    for (const e of entries) {
      if (e.target === topNav) topVisible = e.isIntersecting;
      if (e.target === footer) footerVisible = e.isIntersecting;
    }
    update();
  }, { threshold: 0 });

  observer.observe(topNav);
  if (footer) observer.observe(footer);

  // Delay enabling updates to let layout settle after SPA navigation
  setTimeout(() => {
    initialized = true;
    topVisible = isInViewport(topNav);
    update();
  }, 150);
}
