import { CosmicBackground } from './cosmic-background';
import { Cards3D } from '@/components/cards-3d';
// import { ConstellationTextGPU } from '@/components/constellation-text-gpu';
import { FlyingIconsGPU } from '@/components/flying-icons-gpu';
import { ViewTransitions } from '@/components/view-transitions';
import { FPSMonitor } from '@/components/fps-monitor';
import { TargetReticle } from '@/components/target-reticle';
import { initPostNavSticky } from '@/components/post-nav-sticky';
import { initBackToTop } from '@/components/back-to-top';
import { SearchFilter } from '@/components/search-filter';
import { initTypewriter } from '@/components/typewriter';
import { initCodeCopy } from '@/components/code-copy';

export class Experience {
  private canvas: HTMLCanvasElement | null;
  private background: CosmicBackground | null = null;
  private cards: Cards3D | null = null;
  // private constellation: ConstellationTextGPU | null = null;
  private flyingIcons: FlyingIconsGPU | null = null;
  private fpsMonitor: FPSMonitor | null = null;
  private targetReticle: TargetReticle | null = null;
  private searchFilter: SearchFilter | null = null;

  constructor() {
    this.canvas = document.getElementById('webgl-canvas') as HTMLCanvasElement | null;
    this.init();
  }

  private init(): void {
    // Phase 1: Background + render loop (visible immediately)
    if (this.canvas) {
      this.background = new CosmicBackground(this.canvas);
    }

    this.animate();
    document.body.classList.add('loaded');

    // Phase 2: Interactive elements (next frame, after first paint)
    requestAnimationFrame(() => {
      this.fpsMonitor = new FPSMonitor({
        onPotatoMode: (enabled) => {
          if (enabled) {
            this.enablePotatoMode();
          } else {
            this.disablePotatoMode();
          }
        }
      });

      this.cards = new Cards3D();
      new ViewTransitions(() => this.reinit());
      initPostNavSticky();
      initBackToTop();
      this.initSearch();
      initTypewriter();
      initCodeCopy();

      // Pointer events
      window.addEventListener('mousemove', (e) => this.handlePointer(e.clientX, e.clientY));
      window.addEventListener('touchmove', (e) => {
        if (e.touches.length > 0) {
          this.handlePointer(e.touches[0].clientX, e.touches[0].clientY);
        }
      }, { passive: true });
      window.addEventListener('touchstart', (e) => {
        if (e.touches.length > 0) {
          this.handlePointer(e.touches[0].clientX, e.touches[0].clientY);
        }
      }, { passive: true });
      this.setupDeviceOrientation();

      // Phase 3: Decorative effects (after interactive is ready)
      requestAnimationFrame(() => {
        // this.constellation = new ConstellationTextGPU();
        this.flyingIcons = new FlyingIconsGPU();
        this.targetReticle = new TargetReticle();
      });
    });
  }

  private handlePointer(clientX: number, clientY: number): void {
    const x = clientX / window.innerWidth;
    const y = 1 - clientY / window.innerHeight;

    this.background?.updateMouse(x, y);

    const nx = (clientX / window.innerWidth) * 2 - 1;
    const ny = -((clientY / window.innerHeight) * 2 - 1);

    this.cards?.updateMouse(nx, ny);
  }

  private animate = (): void => {
    this.fpsMonitor?.incrementFrameCount();

    this.background?.render();
    this.flyingIcons?.render();
    // this.constellation?.render();
    this.cards?.update();
    this.targetReticle?.render();

    requestAnimationFrame(this.animate);
  };

  private reinit(): void {
    // Constellation (nebula) persists across page transitions - no destroy/recreate
    // This prevents white flash from canvas being cleared during reinit

    // Cards need reinit for new page
    this.cards = new Cards3D();

    // Flying icons persist across page transitions (no destroy/recreate)

    initPostNavSticky();
    this.initSearch();
    initTypewriter();
    initCodeCopy();
  }

  private initSearch(): void {
    // Only match #posts-data inside .site-content, not in cached prerender divs
    if (document.querySelector('.site-content #posts-data')) {
      this.searchFilter = new SearchFilter();
      this.searchFilter.init();
    }
  }

  private setupDeviceOrientation(): void {
    if (!('DeviceOrientationEvent' in window)) return;

    const handleOrientation = (e: DeviceOrientationEvent): void => {
      if (e.gamma === null || e.beta === null) return;

      // gamma: left-right tilt (-90 to 90)
      // beta: front-back tilt (-180 to 180)
      const x = Math.max(0, Math.min(1, (e.gamma / 45) * 0.5 + 0.5));
      const y = Math.max(0, Math.min(1, ((e.beta - 45) / 45) * 0.5 + 0.5));

      // Update background
      this.background?.updateMouse(x, y);

      // Update cards with normalized coords (-1 to 1)
      const nx = x * 2 - 1;
      const ny = -(y * 2 - 1);
      this.cards?.updateMouse(nx, ny);
    };

    // iOS 13+ requires permission
    const DeviceOrientationEventTyped = DeviceOrientationEvent as typeof DeviceOrientationEvent & {
      requestPermission?: () => Promise<'granted' | 'denied'>;
    };

    if (typeof DeviceOrientationEventTyped.requestPermission === 'function') {
      // Request on first touch (iOS requirement)
      const requestPermission = (): void => {
        DeviceOrientationEventTyped.requestPermission!()
          .then(permission => {
            if (permission === 'granted') {
              window.addEventListener('deviceorientation', handleOrientation);
            }
          })
          .catch(console.error);
        document.removeEventListener('touchstart', requestPermission);
      };
      document.addEventListener('touchstart', requestPermission, { once: true });
    } else {
      // Non-iOS or older iOS
      window.addEventListener('deviceorientation', handleOrientation);
    }
  }

  private enablePotatoMode(): void {
    // this.constellation?.destroy();
    // this.constellation = null;

    this.flyingIcons?.destroy();
    this.flyingIcons = null;

    document.body.classList.add('potato-mode');

    this.background?.setResolutionScale(0.5);
  }

  private disablePotatoMode(): void {
    document.body.classList.remove('potato-mode');

    this.background?.setResolutionScale(1);

    // if (!this.constellation) {
    //   this.constellation = new ConstellationTextGPU();
    // }
    if (!this.flyingIcons) {
      this.flyingIcons = new FlyingIconsGPU();
    }
  }
}
