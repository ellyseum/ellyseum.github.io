/**
 * Target Reticle - GPU-accelerated DOM brackets
 * Shows animated [[[ ]]] brackets around links when cards are clicked
 * Rendered as DOM elements inside the card so they inherit 3D transforms
 */

export class TargetReticle {
  private animationDuration = 1500;
  private activeContainer: HTMLElement | null = null;
  private activeIndicator: HTMLElement | null = null;
  private fadeTimeout: number | null = null;
  private cleanupTimeout: number | null = null;
  private activeH3: HTMLElement | null = null;
  private originalPosition: string = '';

  constructor() {
    this.injectStyles();
    this.setupListeners();
    this.cleanupStaleElements();
  }

  private cleanupStaleElements(): void {
    // Remove any stale indicators left over from previous page loads/navigation
    document.querySelectorAll('.click-indicator, .bracket-container').forEach(el => {
      el.remove();
    });
    // Remove bracket-target class from any elements that have it
    document.querySelectorAll('.bracket-target').forEach(el => {
      el.classList.remove('bracket-target', 'fade-out');
    });
  }

  private injectStyles(): void {
    const style = document.createElement('style');
    style.textContent = `
      .bracket-container {
        pointer-events: none;
        display: flex;
        align-items: center;
        justify-content: space-between;
        will-change: transform, opacity;
        box-sizing: border-box;
      }

      .bracket-group {
        display: flex;
        gap: 3px;
        will-change: transform;
      }

      .bracket-group.left { flex-direction: row-reverse; }
      .bracket-group.right { flex-direction: row; }

      .bracket {
        font-family: monospace;
        font-weight: 300;
        line-height: 1;
        will-change: transform, opacity, color;
        transform: translateZ(0);
      }

      /* Staggered fade in */
      .bracket:nth-child(1) { animation: bracketIn 0.15s ease-out forwards, bracketPulse 1.2s ease-in-out 0.15s infinite, colorWave 0.8s ease-in-out infinite; }
      .bracket:nth-child(2) { animation: bracketIn 0.15s ease-out 0.05s forwards, bracketPulse 1.2s ease-in-out 0.2s infinite, colorWave 0.8s ease-in-out 0.15s infinite; opacity: 0; }
      .bracket:nth-child(3) { animation: bracketIn 0.15s ease-out 0.1s forwards, bracketPulse 1.2s ease-in-out 0.25s infinite, colorWave 0.8s ease-in-out 0.3s infinite; opacity: 0; }

      .bracket-container.fade-out .bracket {
        animation: bracketOut 0.3s ease-in forwards !important;
      }

      @keyframes bracketIn {
        from { opacity: 0; transform: translateZ(0) scaleY(0.5); }
        to { opacity: 1; transform: translateZ(0) scaleY(1); }
      }

      @keyframes bracketOut {
        to { opacity: 0; transform: translateZ(0) scale(1.1); }
      }

      @keyframes bracketPulse {
        0%, 100% { transform: translateZ(0) scaleX(1); }
        50% { transform: translateZ(0) scaleX(1.15); }
      }

      @keyframes colorWave {
        0%, 100% { color: #00cc66; }
        50% { color: #66ffaa; }
      }

      /* Animated gradient on the targeted link */
      .bracket-target {
        animation: linkColorWave 0.6s ease-in-out infinite !important;
        text-shadow: 0 0 8px rgba(102, 255, 170, 0.5);
      }

      /* Subtitle gets its own animation, not inherit */
      .bracket-target .post-item-subtitle {
        animation: linkColorWave 0.6s ease-in-out infinite !important;
        opacity: 1 !important;
      }

      .bracket-target.fade-out {
        animation: linkFadeBack 0.3s ease-out forwards !important;
      }

      .bracket-target.fade-out .post-item-subtitle {
        animation: subtitleFadeBack 0.3s ease-out forwards !important;
      }

      @keyframes linkColorWave {
        0%, 100% { color: #00cc66; text-shadow: 0 0 8px rgba(0, 204, 102, 0.6); }
        50% { color: #66ffaa; text-shadow: 0 0 12px rgba(102, 255, 170, 0.8); }
      }

      @keyframes linkFadeBack {
        to { color: inherit; text-shadow: none; }
      }

      @keyframes subtitleFadeBack {
        from { color: #00cc66; opacity: 1; text-shadow: 0 0 8px rgba(0, 204, 102, 0.6); }
        to { color: #a78bfa; opacity: 0.7; text-shadow: none; }
      }

      /* Click here indicator */
      .click-indicator {
        position: absolute;
        left: 50%;
        bottom: 100%;
        transform: translateX(-50%);
        display: flex;
        flex-direction: column;
        align-items: center;
        pointer-events: none;
        animation: indicatorIn 0.3s ease-out forwards;
        will-change: transform, opacity;
        margin-bottom: 4px;
      }

      .click-indicator-text {
        font-family: monospace;
        font-size: 0.75em;
        white-space: nowrap;
        animation: bobbing 0.8s ease-in-out infinite, colorWave 0.6s ease-in-out infinite;
      }

      .click-indicator-arrow {
        font-size: 0.9em;
        animation: bobbing 0.8s ease-in-out infinite, colorWave 0.6s ease-in-out 0.1s infinite;
      }

      .click-indicator.fade-out {
        animation: indicatorOut 0.3s ease-in forwards !important;
      }

      .click-indicator.fade-out .click-indicator-text,
      .click-indicator.fade-out .click-indicator-arrow {
        animation: none;
      }

      @keyframes indicatorIn {
        from { opacity: 0; transform: translateX(-50%) translateY(8px); }
        to { opacity: 1; transform: translateX(-50%) translateY(0); }
      }

      @keyframes indicatorOut {
        to { opacity: 0; transform: translateX(-50%) translateY(-8px); }
      }

      @keyframes bobbing {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-4px); }
      }
    `;
    document.head.appendChild(style);
  }

  private setupListeners(): void {
    document.addEventListener('click', (e) => {
      const target = e.target as Element;
      const card = target.closest('.post-item');
      const link = target.closest('a');

      if (card && !link) {
        const titleLink = card.querySelector('h3 a') as HTMLElement;
        if (titleLink) {
          this.showTarget(titleLink);
        }
      }
    });
  }

  private showTarget(element: HTMLElement): void {
    // Clear any pending timeouts and clean up previous brackets
    this.cleanup();

    // Make the link element itself the positioning parent
    this.activeH3 = element; // Reusing this field for the link element
    this.originalPosition = element.style.position;
    element.style.position = 'relative';
    element.classList.add('bracket-target');

    // Get computed font size for proper bracket sizing
    const fontSize = parseFloat(getComputedStyle(element).fontSize);

    // Calculate bracket group width (3 brackets + gaps)
    const bracketGroupWidth = fontSize * 1.8; // Approximate width of [[[ or ]]]

    // Create container that extends OUTSIDE the link boundaries
    const container = document.createElement('div');
    container.className = 'bracket-container';
    container.style.cssText = `
      position: absolute;
      top: 50%;
      left: -${bracketGroupWidth + 8}px;
      right: -${bracketGroupWidth + 8}px;
      transform: translateY(-50%);
      height: 1.2em;
      font-size: ${fontSize}px;
    `;

    // Create left brackets [[[
    const leftGroup = document.createElement('div');
    leftGroup.className = 'bracket-group left';
    for (let i = 0; i < 3; i++) {
      const b = document.createElement('span');
      b.className = 'bracket';
      b.textContent = '[';
      leftGroup.appendChild(b);
    }

    // Create right brackets ]]]
    const rightGroup = document.createElement('div');
    rightGroup.className = 'bracket-group right';
    for (let i = 0; i < 3; i++) {
      const b = document.createElement('span');
      b.className = 'bracket';
      b.textContent = ']';
      rightGroup.appendChild(b);
    }

    container.appendChild(leftGroup);
    container.appendChild(rightGroup);
    element.appendChild(container);

    // Create "click here" indicator above the link
    const indicator = document.createElement('div');
    indicator.className = 'click-indicator';

    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

    const indicatorText = document.createElement('span');
    indicatorText.className = 'click-indicator-text';
    indicatorText.textContent = isTouchDevice ? '> touch here <' : '> click here <';

    const indicatorArrow = document.createElement('span');
    indicatorArrow.className = 'click-indicator-arrow';
    indicatorArrow.textContent = '▼';

    indicator.appendChild(indicatorText);
    indicator.appendChild(indicatorArrow);
    element.appendChild(indicator);

    this.activeContainer = container;
    this.activeIndicator = indicator;

    // Fade out
    this.fadeTimeout = window.setTimeout(() => {
      if (this.activeContainer === container) {
        container.classList.add('fade-out');
        indicator.classList.add('fade-out');
        element.classList.add('fade-out');
      }
    }, this.animationDuration - 300);

    // Cleanup
    this.cleanupTimeout = window.setTimeout(() => {
      if (this.activeContainer === container) {
        this.cleanup();
      }
    }, this.animationDuration);
  }

  private cleanup(): void {
    // Clear pending timeouts
    if (this.fadeTimeout !== null) {
      clearTimeout(this.fadeTimeout);
      this.fadeTimeout = null;
    }
    if (this.cleanupTimeout !== null) {
      clearTimeout(this.cleanupTimeout);
      this.cleanupTimeout = null;
    }

    // Remove container and indicator
    if (this.activeContainer) {
      this.activeContainer.remove();
      this.activeContainer = null;
    }
    if (this.activeIndicator) {
      this.activeIndicator.remove();
      this.activeIndicator = null;
    }

    // Restore link element state
    if (this.activeH3) {
      this.activeH3.style.position = this.originalPosition || '';
      this.activeH3.classList.remove('bracket-target', 'fade-out');
      this.activeH3 = null;
    }
  }

  render(): void {
    // No-op - animation handled by CSS
  }

  isActive(): boolean {
    return this.activeContainer !== null;
  }
}
