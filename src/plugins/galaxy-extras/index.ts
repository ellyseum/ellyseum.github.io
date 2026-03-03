import type { EllysPlugin } from '@/core/plugin-types';
import { Cards3D } from '@/components/cards-3d';
import { FlyingIconsGPU } from '@/components/flying-icons-gpu';
import { FPSMonitor } from '@/components/fps-monitor';
import { TargetReticle } from '@/components/target-reticle';
import { initTypewriter } from '@/components/typewriter';

const galaxyExtras: EllysPlugin = {
  name: 'galaxy-extras',
  description: 'Decorative galaxy theme effects: cards, flying icons, FPS monitor, typewriter',
  dependencies: ['webgl-galaxy'],
  loadStrategy: 'idle',

  async init(ctx) {
    // Skip for classic themes
    if (ctx.theme.isClassic) return;

    let cards: Cards3D | null = new Cards3D();
    let flyingIcons: FlyingIconsGPU | null = null;
    const targetReticle = new TargetReticle();

    const fpsMonitor = new FPSMonitor({
      onPotatoMode: (enabled: boolean) => {
        ctx.emit('potato-mode', { enabled });
        if (enabled) {
          flyingIcons?.destroy();
          flyingIcons = null;
          document.body.classList.add('potato-mode');
        } else {
          document.body.classList.remove('potato-mode');
          if (!flyingIcons) flyingIcons = new FlyingIconsGPU();
        }
      },
    });

    // Frame updates
    ctx.onFrame(() => {
      fpsMonitor.incrementFrameCount();
      flyingIcons?.render();
      cards?.update();
      targetReticle?.render();
    });

    // Pointer events from webgl-galaxy
    ctx.on('pointer', (data) => {
      const { nx, ny } = data as { nx: number; ny: number };
      cards?.updateMouse(nx, ny);
    });

    // Navigation reinit
    const onNavigate = () => {
      cards = new Cards3D();
      initTypewriter();
    };
    ctx.on('navigate', onNavigate);
    window.addEventListener('ellyseum:navigate', onNavigate);

    // Phase 3: decorative effects (deferred one frame)
    requestAnimationFrame(() => {
      flyingIcons = new FlyingIconsGPU();
    });

    initTypewriter();

    // Theme destruction
    ctx.onThemeChange((theme) => {
      if (theme !== 'galaxy') {
        flyingIcons?.destroy();
        flyingIcons = null;
      }
    });

    return () => {
      flyingIcons?.destroy();
      window.removeEventListener('ellyseum:navigate', onNavigate);
    };
  },
};

export default galaxyExtras;
