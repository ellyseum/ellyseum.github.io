import {
  PerformanceTier,
  TIER_COLORS,
  getTierByName,
  detectDeviceCapabilities,
  getTierFromRefreshRate
} from '@/utils/performance';

export interface FPSMonitorCallbacks {
  onTierChange?: (tier: PerformanceTier, targetFPS: number) => void;
  onPotatoMode?: (enabled: boolean) => void;
}

export class FPSMonitor {
  private container: HTMLDivElement;
  private fpsLink: HTMLAnchorElement;
  private fpsPanel: HTMLDivElement;
  private fpsGraph: HTMLCanvasElement;
  private fpsGraphCtx: CanvasRenderingContext2D;
  private fpsCounter: HTMLDivElement;
  private closeBtn: HTMLButtonElement;
  private fpsHistory: number[] = [];
  private maxHistoryLength = 50;

  private frameCount = 0;
  private fps = 60;
  private performanceTier: PerformanceTier = 'medium';
  private targetFPS = 60;
  private detectedRefreshRate = 60;

  // Drag state
  private isDragging = false;
  private dragOffset = { x: 0, y: 0 };

  private callbacks: FPSMonitorCallbacks;

  constructor(callbacks: FPSMonitorCallbacks = {}) {
    this.callbacks = callbacks;

    // Create container
    this.container = document.createElement('div');
    this.container.className = 'fps-monitor';

    // Create minimized link
    this.fpsLink = document.createElement('a');
    this.fpsLink.className = 'fps-link';
    this.fpsLink.href = '#';
    this.fpsLink.textContent = 'FPS: --';
    this.fpsLink.addEventListener('click', (e) => {
      e.preventDefault();
      this.expand();
    });

    // Create expanded panel
    this.fpsPanel = document.createElement('div');
    this.fpsPanel.className = 'fps-panel';
    this.fpsPanel.style.display = 'none';
    this.fpsPanel.addEventListener('mousedown', (e) => this.startDrag(e));
    this.fpsPanel.addEventListener('touchstart', (e) => this.startDrag(e), { passive: false });

    // Close button (overlaid)
    this.closeBtn = document.createElement('button');
    this.closeBtn.className = 'fps-close';
    this.closeBtn.innerHTML = '&times;';
    this.closeBtn.setAttribute('aria-label', 'Minimize FPS monitor');
    this.closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.collapse();
    });

    // Create FPS graph canvas
    this.fpsGraph = document.createElement('canvas');
    this.fpsGraph.className = 'fps-graph';
    this.fpsGraph.width = 100;
    this.fpsGraph.height = 32;
    this.fpsGraphCtx = this.fpsGraph.getContext('2d')!;

    // Create FPS counter element
    this.fpsCounter = document.createElement('div');
    this.fpsCounter.className = 'fps-counter';
    this.fpsCounter.textContent = '-- FPS';

    // Assemble panel
    this.fpsPanel.appendChild(this.closeBtn);
    this.fpsPanel.appendChild(this.fpsGraph);
    this.fpsPanel.appendChild(this.fpsCounter);

    // Assemble container
    this.container.appendChild(this.fpsLink);
    this.container.appendChild(this.fpsPanel);
    document.body.appendChild(this.container);

    // Global mouse/touch events for dragging
    document.addEventListener('mousemove', (e) => this.onDrag(e));
    document.addEventListener('mouseup', () => this.stopDrag());
    document.addEventListener('touchmove', (e) => this.onDrag(e), { passive: false });
    document.addEventListener('touchend', () => this.stopDrag());

    this.detectPerformance();
    this.startMonitoring();
  }

  private expand(): void {
    this.fpsLink.style.display = 'none';
    this.fpsPanel.style.display = 'flex';
    this.container.classList.add('expanded');
  }

  private collapse(): void {
    this.fpsLink.style.display = 'block';
    this.fpsPanel.style.display = 'none';
    this.container.classList.remove('expanded');
    // Reset position
    this.container.style.top = '';
    this.container.style.left = '';
    this.container.style.right = '';
  }

  private startDrag(e: MouseEvent | TouchEvent): void {
    if (e.target === this.closeBtn) return;

    this.isDragging = true;
    this.container.classList.add('dragging');

    const rect = this.container.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    this.dragOffset.x = clientX - rect.left;
    this.dragOffset.y = clientY - rect.top;

    // Switch from right-positioned to left-positioned for dragging
    this.container.style.right = 'auto';
    this.container.style.left = rect.left + 'px';
    this.container.style.top = rect.top + 'px';

    if ('touches' in e) e.preventDefault();
  }

  private onDrag(e: MouseEvent | TouchEvent): void {
    if (!this.isDragging) return;

    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    const x = clientX - this.dragOffset.x;
    const y = clientY - this.dragOffset.y;

    // Constrain to viewport
    const rect = this.container.getBoundingClientRect();
    const maxX = window.innerWidth - rect.width;
    const maxY = window.innerHeight - rect.height;

    this.container.style.left = Math.max(0, Math.min(x, maxX)) + 'px';
    this.container.style.top = Math.max(0, Math.min(y, maxY)) + 'px';

    if ('touches' in e) e.preventDefault();
  }

  private stopDrag(): void {
    if (!this.isDragging) return;
    this.isDragging = false;
    this.container.classList.remove('dragging');
  }

  private detectPerformance(): void {
    const { isMobile, lowMemory } = detectDeviceCapabilities();

    if (lowMemory) {
      this.setTier('low');
    } else if (isMobile) {
      this.setTier('medium');
    } else {
      this.detectRefreshRate();
    }
  }

  private detectRefreshRate(): void {
    let frames = 0;
    const startTime = performance.now();

    const countFrames = (): void => {
      frames++;
      const elapsed = performance.now() - startTime;

      if (elapsed < 1000) {
        requestAnimationFrame(countFrames);
      } else {
        this.detectedRefreshRate = Math.round(frames);
        const tier = getTierFromRefreshRate(this.detectedRefreshRate);
        this.setTier(tier.name);
      }
    };

    requestAnimationFrame(countFrames);
  }

  private setTier(tier: PerformanceTier): void {
    const config = getTierByName(tier);
    this.performanceTier = config.name;
    this.targetFPS = config.fps;
    this.callbacks.onTierChange?.(this.performanceTier, this.targetFPS);
  }

  private startMonitoring(): void {
    let stableFrames = 0;
    let warmupComplete = false;

    // Wait for page to settle before monitoring
    setTimeout(() => { warmupComplete = true; }, 3000);

    setInterval(() => {
      this.fps = this.frameCount * 2; // Counts per 500ms * 2
      this.frameCount = 0;

      // Update display
      this.updateDisplay();

      // Update graph
      this.fpsHistory.push(this.fps);
      if (this.fpsHistory.length > this.maxHistoryLength) {
        this.fpsHistory.shift();
      }
      this.drawGraph();

      if (!warmupComplete) return;

      // Find the appropriate tier for current FPS
      const appropriateTier = this.getTierForFPS(this.fps);

      if (appropriateTier !== this.performanceTier) {
        stableFrames++;
        // Quick reaction (2 samples = 1 second) for tier changes
        if (stableFrames >= 2) {
          this.setTierDirect(appropriateTier);
          stableFrames = 0;
        }
      } else {
        stableFrames = 0;
      }
    }, 500);
  }

  private getTierForFPS(fps: number): PerformanceTier {
    // Find the highest tier this FPS can sustain (need 90% of tier's target)
    if (fps >= 432) return 'superUltra';  // 480 * 0.9
    if (fps >= 216) return 'ultra';        // 240 * 0.9
    if (fps >= 108) return 'high';         // 120 * 0.9
    if (fps >= 54) return 'medium';        // 60 * 0.9
    if (fps >= 27) return 'low';           // 30 * 0.9
    return 'potato';
  }

  private setTierDirect(tier: PerformanceTier): void {
    const prevTier = this.performanceTier;
    this.setTier(tier);

    // Handle potato mode transitions
    if (tier === 'potato' && prevTier !== 'potato') {
      this.callbacks.onPotatoMode?.(true);
    } else if (prevTier === 'potato' && tier !== 'potato') {
      this.callbacks.onPotatoMode?.(false);
    }
  }

  private updateDisplay(): void {
    const tier = getTierByName(this.performanceTier);
    // Update link text
    this.fpsLink.textContent = `FPS: ${this.fps}`;
    this.fpsLink.dataset.tier = this.performanceTier;
    // Update panel counter
    this.fpsCounter.textContent = `${this.fps} FPS · ${tier.label}`;
    this.fpsCounter.dataset.tier = this.performanceTier;
    this.container.dataset.tier = this.performanceTier;
  }

  private drawGraph(): void {
    const ctx = this.fpsGraphCtx;
    const w = this.fpsGraph.width;
    const h = this.fpsGraph.height;

    ctx.clearRect(0, 0, w, h);

    if (this.fpsHistory.length < 2) return;

    const maxFPS = Math.max(this.targetFPS, ...this.fpsHistory) * 1.1;
    const color = TIER_COLORS[this.performanceTier];

    // Draw target line
    const targetY = h - (this.targetFPS / maxFPS) * h;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 2]);
    ctx.beginPath();
    ctx.moveTo(0, targetY);
    ctx.lineTo(w, targetY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw FPS line
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();

    const step = w / (this.maxHistoryLength - 1);

    this.fpsHistory.forEach((fps, i) => {
      const x = i * step;
      const y = h - (fps / maxFPS) * h;

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });

    ctx.stroke();

    // Draw fill under line
    ctx.lineTo((this.fpsHistory.length - 1) * step, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    ctx.fillStyle = color + '26'; // 15% opacity
    ctx.fill();
  }

  incrementFrameCount(): void {
    this.frameCount++;
  }

  getCurrentTier(): PerformanceTier {
    return this.performanceTier;
  }

  getTargetFPS(): number {
    return this.targetFPS;
  }
}
