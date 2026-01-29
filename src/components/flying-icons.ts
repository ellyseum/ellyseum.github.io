interface IconConfig {
  name: string;
  svg: string;
}

const ICONS: IconConfig[] = [
  {
    name: 'github',
    svg: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>'
  },
  {
    name: 'claude',
    svg: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1.5 14.5c0 .83-.67 1.5-1.5 1.5s-1.5-.67-1.5-1.5.67-1.5 1.5-1.5 1.5.67 1.5 1.5zm1.5-3.5c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm4.5 3.5c0 .83-.67 1.5-1.5 1.5s-1.5-.67-1.5-1.5.67-1.5 1.5-1.5 1.5.67 1.5 1.5z"/><circle cx="12" cy="10" r="2" fill="none" stroke="currentColor" stroke-width="0.5"/></svg>'
  },
  {
    name: 'copilot',
    svg: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.477 2 2 6.477 2 12c0 2.237.74 4.3 1.988 5.963l-.487 3.068a.75.75 0 001.029.81l2.905-1.21A9.96 9.96 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2zm-2.5 13a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm5 0a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm-5.5-5c0-1.657 1.343-3 3-3s3 1.343 3 3v.5h-6V10z"/></svg>'
  },
  {
    name: 'vscode',
    svg: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.583 2.243L8.17 9.962 3.4 6.087.55 7.175v9.65l2.85 1.088 4.77-3.875 9.413 7.72 5.867-2.393V4.636l-5.867-2.393zM3.4 13.738V10.26l2.1 1.74-2.1 1.738zm12.35 3.987l-5.55-4.55v-.35l5.55-4.55v9.45z"/></svg>'
  },
  {
    name: 'cursor',
    svg: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M5 3l14 9-14 9V3z"/><path d="M13 12h7v2h-7z" fill-opacity="0.6"/></svg>'
  },
  {
    name: 'terminal',
    svg: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="2" y="4" width="20" height="16" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M6 8l4 4-4 4M12 16h6"/></svg>'
  }
];

interface BezierPath {
  x: number[];
  y: number[];
}

export class FlyingIcons {
  private flyingElements: HTMLDivElement[] = [];
  private animationFrameIds: number[] = [];

  constructor() {
    // Only show on home page
    if (!document.querySelector('.home')) return;
    this.init();
  }

  private init(): void {
    const count = Math.min(ICONS.length, 5 + Math.floor(Math.random() * 2));

    for (let i = 0; i < count; i++) {
      this.createFlyingIcon(i);
    }
  }

  private createFlyingIcon(index: number): void {
    const icon = ICONS[index % ICONS.length];

    const container = document.createElement('div');
    container.className = 'flying-icon';
    container.innerHTML = `
      <div class="flying-icon-trail"></div>
      <div class="flying-icon-trail"></div>
      <div class="flying-icon-trail"></div>
      <div class="flying-icon-body">${icon.svg}</div>
    `;

    const startX = Math.random() * window.innerWidth;
    const startY = Math.random() * window.innerHeight;

    container.style.left = `${startX}px`;
    container.style.top = `${startY}px`;

    document.body.appendChild(container);
    this.animateIcon(container, index);
    this.flyingElements.push(container);
  }

  private animateIcon(element: HTMLDivElement, index: number): void {
    const duration = 15000 + Math.random() * 10000;
    const delay = index * 2000;

    let path = this.generatePath();
    let startTime: number | null = null;
    let currentX = parseFloat(element.style.left);
    let currentY = parseFloat(element.style.top);

    const animate = (timestamp: number): void => {
      if (!document.body.contains(element)) return;

      if (!startTime) startTime = timestamp + delay;
      if (timestamp < startTime) {
        const frameId = requestAnimationFrame(animate);
        this.animationFrameIds.push(frameId);
        return;
      }

      const elapsed = timestamp - startTime;
      const progress = (elapsed % duration) / duration;

      const t = progress;
      const x = this.bezier(t, path.x);
      const y = this.bezier(t, path.y);

      const dx = x - currentX;
      const dy = y - currentY;
      const angle = Math.atan2(dy, dx) * 180 / Math.PI;

      element.style.left = `${x}px`;
      element.style.top = `${y}px`;
      element.style.transform = `rotate(${angle}deg)`;

      currentX = x;
      currentY = y;

      if (progress > 0.99) {
        startTime = null;
        path = this.generatePath();
      }

      const frameId = requestAnimationFrame(animate);
      this.animationFrameIds.push(frameId);
    };

    const frameId = requestAnimationFrame(animate);
    this.animationFrameIds.push(frameId);
  }

  private generatePath(): BezierPath {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const margin = 100;

    return {
      x: [
        -margin + Math.random() * (w + margin),
        Math.random() * w,
        Math.random() * w,
        w + margin - Math.random() * (w + margin)
      ],
      y: [
        -margin + Math.random() * (h + margin),
        Math.random() * h,
        Math.random() * h,
        h + margin - Math.random() * (h + margin)
      ]
    };
  }

  private bezier(t: number, points: number[]): number {
    const [p0, p1, p2, p3] = points;
    const t2 = t * t;
    const t3 = t2 * t;
    const mt = 1 - t;
    const mt2 = mt * mt;
    const mt3 = mt2 * mt;

    return mt3 * p0 + 3 * mt2 * t * p1 + 3 * mt * t2 * p2 + t3 * p3;
  }

  destroy(): void {
    this.animationFrameIds.forEach(id => cancelAnimationFrame(id));
    this.animationFrameIds = [];
    this.flyingElements.forEach(el => el.remove());
    this.flyingElements = [];
  }
}
