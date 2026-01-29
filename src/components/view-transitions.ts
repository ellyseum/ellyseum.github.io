import { cleanupPostNavSticky } from '@/components/post-nav-sticky';

interface PrefetchCache {
  title: string;
  mainContent: string;
  processedContent?: string;
  prerender: HTMLDivElement;
  timestamp: number;
}

export class ViewTransitions {
  private isNavigating = false;
  private isAnimatingIn = false; // true during in-animations (interruptible)
  private runningAnimations: Animation[] = [];
  private prefetchCache = new Map<string, PrefetchCache>();
  private prefetchingUrls = new Set<string>();
  private worker: Worker | null = null;
  private pendingWorkerCallbacks = new Map<string, () => void>();
  private onReinitCallback?: () => void;
  private clickedCard: HTMLElement | null = null; // Card that was clicked for zoom transition

  private isMobile(): boolean {
    return window.innerWidth <= 768;
  }

  constructor(onReinit?: () => void) {
    this.onReinitCallback = onReinit;
    this.initWorker();
    this.init();
  }

  private initWorker(): void {
    try {
      this.worker = new Worker(new URL('../workers/nav-worker.ts', import.meta.url));
      this.worker.onmessage = (e: MessageEvent) => {
        const { type, originalHref, title, mainContent, processedContent, error } = e.data;
        // Use originalHref (relative) for cache key, not the absolute URL
        const cacheKey = originalHref;

        if (type === 'parsed') {
          const prerender = document.createElement('div');
          prerender.className = 'prerender-cache';
          prerender.dataset.href = cacheKey;
          prerender.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none;top:-9999px;left:-9999px;';
          prerender.innerHTML = mainContent;
          document.body.appendChild(prerender);

          this.prefetchCache.set(cacheKey, {
            title,
            mainContent,
            processedContent,
            prerender,
            timestamp: Date.now()
          });

          this.prefetchingUrls.delete(cacheKey);

          const callback = this.pendingWorkerCallbacks.get(cacheKey);
          if (callback) {
            callback();
            this.pendingWorkerCallbacks.delete(cacheKey);
          }
        } else if (type === 'error') {
          console.error('Worker error:', error);
          this.prefetchingUrls.delete(cacheKey);
        }
      };
    } catch {
      console.log('Web Worker not available, using main thread');
      this.worker = null;
    }
  }

  private init(): void {
    // Prefetch on hover/focus
    document.addEventListener('mouseenter', (e) => {
      if (!(e.target instanceof Element)) return;
      const link = e.target.closest('a');
      if (link) this.prefetch(link.getAttribute('href'));
    }, true);

    document.addEventListener('focusin', (e) => {
      if (!(e.target instanceof Element)) return;
      const link = e.target.closest('a');
      if (link) this.prefetch(link.getAttribute('href'));
    });

    document.addEventListener('touchstart', (e) => {
      if (!(e.target instanceof Element)) return;
      const link = e.target.closest('a');
      if (link) this.prefetch(link.getAttribute('href'));
    }, { passive: true });

    // Intercept clicks
    document.addEventListener('click', (e) => {
      if (!(e.target instanceof Element)) return;
      const link = e.target.closest('a');
      if (!link) return;

      const href = link.getAttribute('href');
      if (!href || href.startsWith('http') || href.startsWith('#') || href.startsWith('mailto:') || href.endsWith('.xml')) return;

      // Capture clicked card for zoom transition
      const card = e.target.closest('.post-item') as HTMLElement | null;
      this.clickedCard = card;

      e.preventDefault();
      this.navigate(href);
    });

    // Handle back/forward
    window.addEventListener('popstate', () => {
      this.navigate(location.pathname + location.search, false);
    });

    // Prefetch strategy: mobile = batch all page links, desktop = on hover
    if (this.isMobile()) {
      this.prefetchAllVisibleLinksBatch();
    } else {
      this.prefetch('/');
    }
    setInterval(() => this.cleanCache(), 120000);
  }

  private prefetchAllVisibleLinksBatch(): void {
    const links = document.querySelectorAll('a[href]');
    const urls: string[] = [];

    links.forEach(link => {
      let href = link.getAttribute('href');
      if (!href) return;

      // Skip external, hash, mailto, feed links
      if (href.startsWith('http') || href.startsWith('#') || href.startsWith('mailto:') || href.endsWith('.xml')) return;

      // Skip already cached or in-flight
      if (href.startsWith('/search/') && href.includes('?')) href = '/search/';
      if (this.prefetchCache.has(href) || this.prefetchingUrls.has(href)) return;

      // Mark as in-flight
      this.prefetchingUrls.add(href);
      urls.push(href);
    });

    // Send all URLs to worker in one batch message
    if (urls.length > 0 && this.worker) {
      this.worker.postMessage({ type: 'parseBatch', urls });
    }
  }

  private cleanCache(): void {
    const maxAge = 5 * 60 * 1000;
    const now = Date.now();

    for (const [url, data] of this.prefetchCache) {
      if (now - data.timestamp > maxAge) {
        data.prerender.remove();
        this.prefetchCache.delete(url);
      }
    }
  }

  private prefetch(href: string | null): void {
    if (!href || href.startsWith('http') || href.startsWith('#') || href.startsWith('mailto:')) return;

    // Search page with query params - prefetch /search/ instead (same HTML, JS reads params)
    if (href.startsWith('/search/') && href.includes('?')) {
      href = '/search/';
    }

    if (this.prefetchCache.has(href) || this.prefetchingUrls.has(href)) return;

    this.prefetchingUrls.add(href);

    if (this.worker) {
      // Send relative URL - worker will resolve relative to its own HTTPS origin
      this.worker.postMessage({ type: 'parse', url: href, originalHref: href });
    } else {
      this.prefetchMainThread(href);
    }
  }

  private async prefetchMainThread(href: string): Promise<void> {
    try {
      const response = await fetch(href, { priority: 'low' } as RequestInit);
      const html = await response.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');

      const prerender = document.createElement('div');
      prerender.className = 'prerender-cache';
      prerender.dataset.href = href;
      prerender.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none;top:-9999px;left:-9999px;';
      prerender.innerHTML = doc.querySelector('.site-content')?.innerHTML || '';
      document.body.appendChild(prerender);

      this.prefetchCache.set(href, {
        title: doc.title,
        mainContent: prerender.innerHTML,
        prerender,
        timestamp: Date.now()
      });
    } catch {
      // Ignore prefetch errors
    } finally {
      this.prefetchingUrls.delete(href);
    }
  }

  private cacheCurrentPage(): void {
    const currentUrl = location.pathname;
    if (this.prefetchCache.has(currentUrl)) return;

    const main = document.querySelector('.site-content');
    if (!main) return;

    const prerender = document.createElement('div');
    prerender.className = 'prerender-cache';
    prerender.dataset.href = currentUrl;
    prerender.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none;top:-9999px;left:-9999px;';
    prerender.innerHTML = main.innerHTML;
    document.body.appendChild(prerender);

    this.prefetchCache.set(currentUrl, {
      title: document.title,
      mainContent: main.innerHTML,
      prerender,
      timestamp: Date.now()
    });
  }

  async navigate(url: string, pushState = true): Promise<void> {
    // Block during content swap, but allow interruption during in-animations
    if (this.isNavigating && !this.isAnimatingIn) return;

    // If interrupting an animation, cancel it and reset
    if (this.isAnimatingIn) {
      this.runningAnimations.forEach(a => a.cancel());
      this.runningAnimations = [];
      this.isAnimatingIn = false;
    }

    this.isNavigating = true;

    // Freeze any CSS-animated cards before adding spa-navigating
    // (prevents snap-back to opacity:0 when animation selector stops matching)
    document.querySelectorAll('.post-item:not(.js-animated)').forEach(card => {
      const el = card as HTMLElement;
      const computed = getComputedStyle(el);
      el.style.opacity = computed.opacity;
      el.style.transform = computed.transform;
      el.classList.add('js-animated');
    });

    // Prevent CSS animations during SPA navigation
    document.body.classList.add('spa-navigating');

    // Kill the observer BEFORE content swap to prevent stale callbacks
    cleanupPostNavSticky();

    // Reset sticky nav state so header is visible for the new page
    const siteHeader = document.querySelector('.site-header');
    if (siteHeader) siteHeader.classList.remove('header-hidden');
    document.querySelector('.post-nav-sticky')?.classList.remove('visible');
    document.querySelector('.fps-monitor')?.classList.remove('fps-in-sticky');

    // Detect where we're coming FROM
    const currentPath = location.pathname;
    const isComingFromPost = currentPath.includes('/20') || currentPath.includes('/posts/');
    const isComingFromArchive = currentPath.includes('/archive');

    this.cacheCurrentPage();

    const isGoingToPost = (url.includes('/20') || url.includes('/posts/')) && !url.includes('/search');
    const isGoingHome = url === '/' || url === '/index.html';
    const isGoingToSearch = url.startsWith('/search');

    // Determine if this is a "browse" navigation (sequential/archive) vs "explore" (from home)
    const isSequentialNav = isComingFromPost && isGoingToPost; // prev/next navigation
    const isArchiveNav = isComingFromArchive && isGoingToPost; // archive to post
    const useSimpleAnimation = isSequentialNav || isArchiveNav;

    // For search page, strip query params for fetch/cache (same HTML, JS reads params)
    const fetchUrl = isGoingToSearch ? '/search/' : url;

    try {
      // Start out animation IMMEDIATELY (don't wait for fetch)

      const isMobile = this.isMobile();
      let outAnimationTime = 250; // default
      if (isGoingToPost) {
        if (useSimpleAnimation || isMobile) {
          this.animateContentOut();
          outAnimationTime = 200;
        } else {
          this.animateCardsOut();
          outAnimationTime = 750; // Card zoom: 250ms delay + 500ms animation
        }
      } else if (isGoingHome) {
        this.animateContentOut();
        outAnimationTime = isMobile ? 200 : 250;
      } else if (isGoingToSearch) {
        this.animateContentOut();
        outAnimationTime = isMobile ? 200 : 250;
      } else {
        // Catch-all for archive, about, etc.
        this.animateContentOut();
        outAnimationTime = isMobile ? 200 : 250;
      }

      // Fetch content in parallel with out animation
      const fetchPromise = (async () => {
        let newTitle: string | undefined;
        let prerenderEl: HTMLDivElement | null = null;

        const cached = this.prefetchCache.get(fetchUrl);
        if (cached) {
          newTitle = cached.title;
          prerenderEl = cached.prerender;
        } else {
          document.body.classList.add('navigating');

          if (this.prefetchingUrls.has(fetchUrl)) {
            await new Promise<void>(resolve => {
              this.pendingWorkerCallbacks.set(fetchUrl, resolve);
              setTimeout(() => {
                if (this.pendingWorkerCallbacks.has(fetchUrl)) {
                  this.pendingWorkerCallbacks.delete(fetchUrl);
                  resolve();
                }
              }, 3000);
            });
          }

          const cachedAfterWait = this.prefetchCache.get(fetchUrl);
          if (cachedAfterWait) {
            newTitle = cachedAfterWait.title;
            prerenderEl = cachedAfterWait.prerender;
          } else {
            const response = await fetch(fetchUrl);
            const html = await response.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            newTitle = doc.title;

            prerenderEl = document.createElement('div');
            prerenderEl.innerHTML = doc.querySelector('.site-content')?.innerHTML || '';
          }

          document.body.classList.remove('navigating');
        }

        return { newTitle, prerenderEl };
      })();

      // Wait for BOTH animation and fetch to complete
      const [{ newTitle, prerenderEl }] = await Promise.all([
        fetchPromise,
        new Promise(r => setTimeout(r, outAnimationTime))
      ]);

      await new Promise(r => requestAnimationFrame(r));

      // Scroll to top after animation completes, before content swap
      window.scrollTo(0, 0);

      const main = document.querySelector('.site-content') as HTMLElement | null;
      if (main && prerenderEl) {
        main.style.visibility = 'hidden';
        main.style.opacity = '0';

        const cachedData = this.prefetchCache.get(fetchUrl);
        // Only use processed content (flying-word spans) for full animation, not simple
        if (isGoingToPost && cachedData?.processedContent && !useSimpleAnimation) {
          main.innerHTML = prerenderEl.innerHTML;
          const postContent = main.querySelector('.post-content');
          if (postContent && cachedData.processedContent) {
            const temp = document.createElement('div');
            temp.innerHTML = cachedData.processedContent;
            const processedPostContent = temp.querySelector('.post-content');
            if (processedPostContent) {
              postContent.innerHTML = processedPostContent.innerHTML;
            }
          }
        } else {
          main.innerHTML = prerenderEl.innerHTML;
        }

        if (this.prefetchCache.has(fetchUrl)) {
          prerenderEl.remove();
        }

        // Hide content BEFORE showing the main container to prevent flash
        if (isGoingHome) {
          const cards = main.querySelectorAll('.post-item');
          cards.forEach(card => {
            const htmlCard = card as HTMLElement;
            htmlCard.classList.add('js-animated');
            htmlCard.style.opacity = '0';
          });
          // Hide intro children individually (not the container)
          const intro = main.querySelector('.intro') as HTMLElement | null;
          if (intro) {
            intro.classList.add('js-animated');
            const introChildren = [
              intro.querySelector('h1'),
              intro.querySelector('.intro-tagline'),
              intro.querySelector('.intro-byline')
            ].filter(Boolean) as HTMLElement[];
            introChildren.forEach(child => {
              child.style.opacity = '0';
              child.style.transform = 'translateY(-15px)';
            });
          }
          // Hide "Recent" heading
          const recentHeading = main.querySelector('.posts h2') as HTMLElement | null;
          if (recentHeading) {
            recentHeading.classList.add('js-animated');
            recentHeading.style.opacity = '0';
            recentHeading.style.transform = 'translateY(10px)';
          }
        } else {
          // For other pages (archive, about, search, posts), hide the main content areas
          const selectors = '.archive, .page-container, .search-page, .post-nav-top, .post-header, .post-content, .post-footer';
          main.querySelectorAll(selectors).forEach(el => {
            (el as HTMLElement).style.opacity = '0';
            (el as HTMLElement).style.transform = 'translateY(20px)';
          });
        }

        await new Promise(r => requestAnimationFrame(r));
        main.style.visibility = '';
        main.style.opacity = '1';
      }

      if (newTitle) {
        document.title = newTitle;
      }

      // Update URL immediately after content swap, before animations
      if (pushState) {
        history.pushState({}, '', url);
      }

      // Update active nav link to match current URL
      this.updateNavActive(url);

      this.isAnimatingIn = true;

      // Call reinit BEFORE animations when going home, so typewriter starts immediately
      if (isGoingHome) {
        this.onReinitCallback?.();
      }

      if (isGoingToPost) {
        if (useSimpleAnimation) {
          await this.animateContentIn();
        } else {
          await this.animateWordsIn();
        }
      } else if (isGoingHome) {
        await this.animateCardsIn();
      } else if (isGoingToSearch) {
        await this.animateContentIn();
      } else {
        // Archive, about, etc.
        await this.animateContentIn();
      }

      this.isAnimatingIn = false;
      this.runningAnimations = [];

      // Call reinit after animations for non-home pages
      if (!isGoingHome) {
        this.onReinitCallback?.();
      }

      // Final safety: ensure header is visible on non-post pages
      requestAnimationFrame(() => {
        if (!document.querySelector('.post-nav-sticky')) {
          document.querySelector('.site-header')?.classList.remove('header-hidden');
        }
      });
    } catch (error) {
      console.error('Navigation error:', error);
      document.body.classList.remove('spa-navigating');
      window.location.href = url;
    }

    // Delay removing spa-navigating to allow styles to settle and prevent CSS animation re-triggers
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        document.body.classList.remove('spa-navigating');
        this.isNavigating = false;
      });
    });
  }

  private animateCardsOut(): void {
    const cards = document.querySelectorAll('.post-item');

    // Cancel all running animations
    this.runningAnimations.forEach(a => a.cancel());
    this.runningAnimations = [];
    cards.forEach(card => {
      (card as HTMLElement).getAnimations().forEach(a => a.cancel());
    });

    // Mobile: simple fade out
    if (this.isMobile()) {
      cards.forEach(card => {
        const htmlCard = card as HTMLElement;
        htmlCard.animate([
          { opacity: 1 },
          { opacity: 0 }
        ], {
          duration: 200,
          easing: 'ease-out',
          fill: 'forwards'
        });
      });

      // Also fade out intro/search elements
      const fadeElements = [
        document.querySelector('.intro'),
        document.querySelector('.search-header'),
        document.querySelector('.search-pagination')
      ].filter(Boolean) as HTMLElement[];

      fadeElements.forEach(el => {
        el.animate([
          { opacity: 1 },
          { opacity: 0 }
        ], {
          duration: 200,
          easing: 'ease-out',
          fill: 'forwards'
        });
      });

      this.clickedCard = null;
      return;
    }

    // Desktop: fancy fly-out and zoom animations
    const directions = ['left', 'right', 'top', 'bottom'];

    cards.forEach((card, i) => {
      const htmlCard = card as HTMLElement;
      const isClickedCard = htmlCard === this.clickedCard;

      // Reset clicked card to final position, let others keep their current state for fly-out
      if (isClickedCard) {
        htmlCard.style.transform = 'none';
        htmlCard.style.opacity = '1';
      } else {
        // For non-clicked cards, just ensure they're visible
        htmlCard.style.opacity = '1';
      }

      if (isClickedCard) {
        // Clicked card zooms INTO the camera center - delayed so other cards start flying first
        const rect = htmlCard.getBoundingClientRect();
        const centerX = window.innerWidth / 2 - (rect.left + rect.width / 2);
        const centerY = window.innerHeight / 2 - (rect.top + rect.height / 2);

        htmlCard.style.zIndex = '100';
        htmlCard.animate([
          { transform: 'none', opacity: 1 },
          { transform: `translate(${centerX}px, ${centerY}px) scale(15)`, opacity: 1, offset: 0.85 },
          { transform: `translate(${centerX}px, ${centerY}px) scale(20)`, opacity: 0 }
        ], {
          duration: 500,
          delay: 250, // Let other cards start flying first
          easing: 'cubic-bezier(0.4, 0, 1, 1)',
          fill: 'forwards'
        });

        // Fade out page-specific elements during the zoom
        // Home page: intro section (title, blurb, signature)
        // Search page: header (title, input, filters, count) and pagination
        const fadeElements = [
          document.querySelector('.intro'),
          document.querySelector('.search-header'),
          document.querySelector('.search-pagination')
        ].filter(Boolean) as HTMLElement[];

        fadeElements.forEach(el => {
          el.animate([
            { opacity: getComputedStyle(el).opacity },
            { opacity: 0 }
          ], {
            duration: 350,
            delay: 350, // Start as card is zooming
            easing: 'ease-in',
            fill: 'forwards'
          });
        });
      } else {
        // Other cards fly off screen with spin
        const direction = directions[i % directions.length];
        const rect = card.getBoundingClientRect();

        let x = 0, y = 0, startRotate = 0, endRotate = 0;

        switch (direction) {
          case 'left':
            x = -(rect.left + rect.width + 100);
            startRotate = -15;
            endRotate = -180 - Math.random() * 90;
            break;
          case 'right':
            x = window.innerWidth - rect.left + 100;
            startRotate = 15;
            endRotate = 180 + Math.random() * 90;
            break;
          case 'top':
            y = -(rect.top + rect.height + 100);
            startRotate = (Math.random() - 0.5) * 20;
            endRotate = (Math.random() > 0.5 ? 180 : -180) + (Math.random() - 0.5) * 90;
            break;
          case 'bottom':
            y = window.innerHeight - rect.top + 100;
            startRotate = (Math.random() - 0.5) * 20;
            endRotate = (Math.random() > 0.5 ? 180 : -180) + (Math.random() - 0.5) * 90;
            break;
        }

        htmlCard.animate([
          { transform: 'none', opacity: 1 },
          { transform: `translate(${x * 0.3}px, ${y * 0.3}px) rotate(${startRotate}deg) scale(0.95)`, opacity: 0.8, offset: 0.3 },
          { transform: `translate(${x}px, ${y}px) rotate(${endRotate}deg) scale(0.7)`, opacity: 0 }
        ], {
          duration: 650,
          easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
          delay: i * 60,
          fill: 'forwards'
        });
      }
    });

    // Clear the reference
    this.clickedCard = null;
  }

  private async animateCardsIn(): Promise<void> {
    const isMobile = this.isMobile();

    // Animate intro children with stagger (h1, tagline, byline)
    const intro = document.querySelector('.intro') as HTMLElement | null;
    if (intro) {
      intro.classList.add('js-animated');

      const introChildren = [
        intro.querySelector('h1'),
        intro.querySelector('.intro-tagline'),
        intro.querySelector('.intro-byline')
      ].filter(Boolean) as HTMLElement[];

      introChildren.forEach((child, i) => {
        child.style.opacity = '0';
        child.style.transform = 'translateY(-15px)';

        const anim = child.animate([
          { opacity: 0, transform: 'translateY(-15px)' },
          { opacity: 1, transform: 'translateY(0)' }
        ], {
          duration: isMobile ? 300 : 400,
          delay: (isMobile ? 30 : 80) * i,
          easing: 'ease-out',
          fill: 'forwards'
        });

        this.runningAnimations.push(anim);
        anim.finished.then(() => {
          child.style.opacity = '1';
          child.style.transform = 'translateY(0)';
          anim.cancel();
        }).catch(() => {});
      });
    }

    // Animate "Recent" heading
    const recentHeading = document.querySelector('.posts h2') as HTMLElement | null;
    if (recentHeading) {
      recentHeading.classList.add('js-animated');
      recentHeading.style.opacity = '0';
      recentHeading.style.transform = 'translateY(10px)';
      const recentAnim = recentHeading.animate([
        { opacity: 0, transform: 'translateY(10px)' },
        { opacity: 1, transform: 'translateY(0)' }
      ], {
        duration: 400,
        delay: 50,
        easing: 'ease-out',
        fill: 'forwards'
      });
      this.runningAnimations.push(recentAnim);
      recentAnim.finished.then(() => {
        recentHeading.style.opacity = '1';
        recentHeading.style.transform = 'translateY(0)';
        recentAnim.cancel();
      }).catch(() => {});
    }

    const cards = document.querySelectorAll('.post-item');
    const animations: Animation[] = [];
    const allCards: HTMLElement[] = [];

    cards.forEach(card => {
      const htmlCard = card as HTMLElement;
      htmlCard.classList.add('js-animated');
      htmlCard.style.opacity = '0';
      htmlCard.style.visibility = 'hidden';
      allCards.push(htmlCard);
    });

    document.body.offsetHeight;
    await new Promise(r => requestAnimationFrame(r));

    // Mobile: simple fade-in with slight stagger
    if (isMobile) {
      cards.forEach((card, i) => {
        const htmlCard = card as HTMLElement;
        htmlCard.style.transform = 'translateY(10px)';
        htmlCard.style.visibility = 'visible';

        const anim = htmlCard.animate([
          { transform: 'translateY(10px)', opacity: 0 },
          { transform: 'translateY(0)', opacity: 1 }
        ], {
          duration: 250,
          easing: 'ease-out',
          delay: 50 + i * 40,
          fill: 'forwards'
        });

        animations.push(anim);
        this.runningAnimations.push(anim);
      });
    } else {
      // Desktop: fancy fly-in with rotation
      const directions = ['left', 'right', 'top', 'bottom'];

      cards.forEach((card, i) => {
        const htmlCard = card as HTMLElement;
        const direction = directions[i % directions.length];

        let startX = 0, startY = 0, startRotate = 0;

        switch (direction) {
          case 'left':
            startX = -window.innerWidth;
            startRotate = -20;
            break;
          case 'right':
            startX = window.innerWidth;
            startRotate = 20;
            break;
          case 'top':
            startY = -window.innerHeight;
            startRotate = (Math.random() - 0.5) * 30;
            break;
          case 'bottom':
            startY = window.innerHeight;
            startRotate = (Math.random() - 0.5) * 30;
            break;
        }

        htmlCard.style.transform = `translate(${startX}px, ${startY}px) rotate(${startRotate}deg)`;
        htmlCard.style.visibility = 'visible';

        const anim = htmlCard.animate([
          { transform: `translate(${startX}px, ${startY}px) rotate(${startRotate}deg)`, opacity: 0 },
          { transform: 'translate(0, 0) rotate(0deg)', opacity: 1 }
        ], {
          duration: 800,
          easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
          delay: 100 + i * 100,
          fill: 'forwards'
        });

        animations.push(anim);
        this.runningAnimations.push(anim);
      });
    }

    try {
      await Promise.all(animations.map(a => a.finished));
    } catch {
      return;
    }

    // Set final state explicitly instead of clearing to CSS defaults
    allCards.forEach(card => {
      card.style.opacity = '1';
      card.style.transform = 'none';
      card.style.visibility = '';
    });
    animations.forEach(a => a.cancel());
  }

  private animateContentOut(): void {
    const content = document.querySelector('.post, .page, .search-page, .archive') as HTMLElement | null;
    if (!content) return;

    content.animate([
      { opacity: 1, transform: 'translateY(0) scale(1)' },
      { opacity: 0, transform: 'translateY(-50px) scale(0.95)' }
    ], {
      duration: 400,
      easing: 'ease-in',
      fill: 'forwards'
    });
  }

  private async animateContentIn(): Promise<void> {
    // IMPORTANT: Scope to .site-content to avoid matching cached prerender divs
    const main = document.querySelector('.site-content');
    if (!main) return;

    // Simple, subtle fade-in for sequential/archive navigation
    const postNavTop = main.querySelector('.post-nav-top') as HTMLElement | null;
    const postHeader = main.querySelector('.post-header') as HTMLElement | null;
    const postContent = main.querySelector('.post-content') as HTMLElement | null;
    const postFooter = main.querySelector('.post-footer') as HTMLElement | null;

    let elements = [postNavTop, postHeader, postContent, postFooter].filter(Boolean) as HTMLElement[];

    // Fallback for non-post pages (search, archive, generic pages)
    if (elements.length === 0) {
      const page = main.querySelector('.search-page, .archive, .page-container') as HTMLElement | null;
      if (page) elements = [page];
    }

    if (elements.length === 0) return;

    // Reset any flying-word spans to visible (in case content was previously animated)
    elements.forEach(el => {
      el.querySelectorAll('.flying-word').forEach(span => {
        const s = span as HTMLElement;
        s.style.opacity = '1';
        s.style.transform = '';
        s.style.filter = '';
      });
    });

    const animations: Animation[] = [];

    elements.forEach(el => {
      el.classList.add('js-animated');
      // Use visibility:hidden initially for bulletproof hiding
      el.style.visibility = 'hidden';
      el.style.opacity = '0';
      el.style.transform = 'translateY(20px)';
    });

    // Force layout, then reveal and animate
    document.body.offsetHeight;
    await new Promise(r => requestAnimationFrame(r));

    elements.forEach((el, i) => {
      el.style.visibility = 'visible';

      const anim = el.animate([
        { opacity: 0, transform: 'translateY(20px)' },
        { opacity: 1, transform: 'translateY(0)' }
      ], {
        duration: 400,
        easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
        delay: i * 80,
        fill: 'forwards'
      });

      animations.push(anim);
    });

    await Promise.all(animations.map(a => a.finished));

    // Set final state explicitly
    elements.forEach(el => {
      el.style.opacity = '1';
      el.style.transform = 'translateY(0)';
      el.style.visibility = '';
    });
    animations.forEach(a => a.cancel());
  }

  private async animateWordsIn(): Promise<void> {
    // Mobile: use simple content fade instead of flying words
    if (this.isMobile()) {
      await this.animateContentIn();
      return;
    }

    await new Promise(r => setTimeout(r, 75));

    const postContent = document.querySelector('.post-content') as HTMLElement | null;
    const postNavTop = document.querySelector('.post-nav-top') as HTMLElement | null;
    const postHeader = document.querySelector('.post-header') as HTMLElement | null;
    const post = document.querySelector('.post') as HTMLElement | null;

    if (!postContent) return;

    // Zoom out the whole post from viewport center
    if (post) {
      // Use viewport-relative transform origin
      post.style.transformOrigin = 'center 40vh';
      post.style.transform = 'scale(3)';
      post.style.filter = 'blur(8px)';

      const zoomAnim = post.animate([
        { transform: 'scale(3)', filter: 'blur(8px)' },
        { transform: 'scale(1.3)', filter: 'blur(2px)', offset: 0.6 },
        { transform: 'scale(1)', filter: 'blur(0px)' }
      ], {
        duration: 450,
        easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
        fill: 'forwards'
      });

      zoomAnim.finished.then(() => {
        post.style.transform = '';
        post.style.filter = '';
        post.style.transformOrigin = '';
      }).catch(() => {});
    }

    // Nav top fades in during zoom
    if (postNavTop) {
      postNavTop.style.opacity = '0';
      postNavTop.animate([
        { opacity: 0 },
        { opacity: 1 }
      ], {
        duration: 300,
        easing: 'ease-out',
        delay: 150,
        fill: 'forwards'
      });
    }

    // Header fades in during zoom
    if (postHeader) {
      postHeader.style.opacity = '0';
      postHeader.animate([
        { opacity: 0 },
        { opacity: 1 }
      ], {
        duration: 300,
        easing: 'ease-out',
        delay: 100,
        fill: 'forwards'
      });
    }

    const elements = postContent.querySelectorAll('p, h2, h3, li, blockquote, pre');
    const allAnimations: Animation[] = [];
    const allWordSpans: HTMLElement[] = [];

    elements.forEach((el, blockIndex) => {
      const htmlEl = el as HTMLElement;

      if (el.tagName === 'PRE') {
        htmlEl.style.opacity = '0';
        htmlEl.style.transform = 'translateY(40px) rotateX(-10deg)';

        htmlEl.animate([
          { opacity: 0, transform: 'translateY(40px) rotateX(-10deg)' },
          { opacity: 1, transform: 'translateY(0) rotateX(0)' }
        ], {
          duration: 350,
          easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
          delay: 150 + blockIndex * 40,
          fill: 'forwards'
        });
        return;
      }

      let wordSpans = el.querySelectorAll('.flying-word');

      if (wordSpans.length === 0) {
        let html = el.innerHTML;

        // Protect inline elements by treating them as single units
        const inlineMatches: string[] = [];
        html = html.replace(/<(em|code|a|strong|abbr|span)[^>]*>.*?<\/\1>/gi, (match) => {
          inlineMatches.push(match);
          return `__INLINE_${inlineMatches.length - 1}__`;
        });

        // Split and wrap words
        const words = html.split(/(\s+)/);
        html = words.map(word => {
          if (word.trim() === '') return word;
          return `<span class="flying-word">${word}</span>`;
        }).join('');

        // Restore inline elements (now each is a single flying-word)
        inlineMatches.forEach((match, i) => {
          html = html.replace(`__INLINE_${i}__`, match);
        });

        el.innerHTML = html;

        wordSpans = el.querySelectorAll('.flying-word');
      }

      wordSpans.forEach((span, wordIndex) => {
        const htmlSpan = span as HTMLElement;
        const edge = Math.floor(Math.random() * 4);
        let startX = 0, startY = 0;

        switch (edge) {
          case 0:
            startX = -window.innerWidth * 0.5 - Math.random() * 200;
            startY = (Math.random() - 0.5) * 400;
            break;
          case 1:
            startX = window.innerWidth * 0.5 + Math.random() * 200;
            startY = (Math.random() - 0.5) * 400;
            break;
          case 2:
            startX = (Math.random() - 0.5) * 600;
            startY = -window.innerHeight * 0.3 - Math.random() * 200;
            break;
          case 3:
            startX = (Math.random() - 0.5) * 600;
            startY = window.innerHeight * 0.3 + Math.random() * 200;
            break;
        }

        const rotation = (Math.random() - 0.5) * 180;
        const delay = 200 + blockIndex * 30 + wordIndex * 10;

        htmlSpan.style.display = 'inline-block';
        htmlSpan.style.opacity = '0';

        const anim = htmlSpan.animate([
          {
            opacity: 0,
            transform: `translate(${startX}px, ${startY}px) rotate(${rotation}deg) scale(0.5)`,
            filter: 'blur(4px)'
          },
          {
            opacity: 0.7,
            transform: `translate(${startX * 0.3}px, ${startY * 0.3}px) rotate(${rotation * 0.3}deg) scale(0.9)`,
            filter: 'blur(1px)',
            offset: 0.6
          },
          {
            opacity: 1,
            transform: 'translate(0, 0) rotate(0deg) scale(1)',
            filter: 'blur(0)'
          }
        ], {
          duration: 450,
          easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
          delay,
          fill: 'forwards'
        });

        allAnimations.push(anim);
        allWordSpans.push(htmlSpan);
      });
    });

    // Batch cleanup after ALL animations finish to avoid staggered reflows
    if (allAnimations.length > 0) {
      Promise.all(allAnimations.map(a => a.finished)).then(() => {
        // Single batched DOM update
        allWordSpans.forEach(span => {
          span.style.opacity = '1';
          span.style.transform = '';
          span.style.filter = '';
          span.style.display = '';
        });
        allAnimations.forEach(a => a.cancel());
      });
    }
  }

  private updateNavActive(url: string): void {
    const nav = document.querySelector('.site-header .site-nav');
    if (!nav) return;
    const path = url.split('?')[0];
    nav.querySelectorAll('a[href]').forEach(link => {
      const href = link.getAttribute('href');
      if (!href || href.startsWith('http')) return;
      if (href === path || (href === '/' && path === '/index.html')) {
        link.setAttribute('aria-current', 'page');
      } else {
        link.removeAttribute('aria-current');
      }
    });
  }
}
