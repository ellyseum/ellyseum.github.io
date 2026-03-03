import type { EllysPlugin, PluginContext } from '@/core/plugin-types';
import { CosmicBackground } from '@/core/cosmic-background';

const webglGalaxy: EllysPlugin = {
  name: 'webgl-galaxy',
  description: 'WebGL cosmic background with nebula and star field',
  loadStrategy: 'eager',

  async init(ctx) {
    // Skip for classic themes or reduced motion
    if (ctx.theme.isClassic || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      document.body.classList.add(ctx.theme.isClassic ? 'loaded' : 'reduced-motion');
      return;
    }

    const canvas = document.getElementById('webgl-canvas') as HTMLCanvasElement | null;
    if (!canvas) {
      document.body.classList.add('loaded');
      return;
    }

    const bg = new CosmicBackground(canvas);

    // Register render in the frame loop
    ctx.onFrame(() => bg.render());
    document.body.classList.add('loaded');

    // Mouse/touch tracking
    const emitPointer = (clientX: number, clientY: number) => {
      const x = clientX / window.innerWidth;
      const y = 1 - clientY / window.innerHeight;
      bg.updateMouse(x, y);
      ctx.emit('pointer', {
        x, y,
        nx: (clientX / window.innerWidth) * 2 - 1,
        ny: -((clientY / window.innerHeight) * 2 - 1),
      });
    };

    const onMouseMove = (e: MouseEvent) => emitPointer(e.clientX, e.clientY);
    const onTouch = (e: TouchEvent) => {
      if (e.touches.length > 0) emitPointer(e.touches[0].clientX, e.touches[0].clientY);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('touchmove', onTouch, { passive: true });
    window.addEventListener('touchstart', onTouch, { passive: true });

    // Device orientation (iOS 13+ permission handling)
    setupDeviceOrientation(bg, ctx);

    // Expose for galaxy-extras
    ctx.provide('canvas', canvas);
    ctx.provide('background', bg);

    // Potato mode from FPS monitor
    ctx.on('potato-mode', (data) => {
      const { enabled } = data as { enabled: boolean };
      bg.setResolutionScale(enabled ? 0.5 : 1);
    });

    // Theme destruction
    const unTheme = ctx.onThemeChange((theme) => {
      if (theme !== 'galaxy') {
        bg.destroy();
        canvas.style.display = 'none';
      }
    });

    return () => {
      unTheme();
      bg.destroy();
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('touchmove', onTouch);
      window.removeEventListener('touchstart', onTouch);
    };
  },
};

function setupDeviceOrientation(
  bg: CosmicBackground,
  ctx: PluginContext,
): void {
  if (!('DeviceOrientationEvent' in window)) return;

  const handleOrientation = (e: DeviceOrientationEvent): void => {
    if (e.gamma === null || e.beta === null) return;
    const x = Math.max(0, Math.min(1, (e.gamma / 45) * 0.5 + 0.5));
    const y = Math.max(0, Math.min(1, ((e.beta - 45) / 45) * 0.5 + 0.5));
    bg.updateMouse(x, y);
    ctx.emit('pointer', {
      x, y,
      nx: x * 2 - 1,
      ny: -(y * 2 - 1),
    });
  };

  const DOE = DeviceOrientationEvent as typeof DeviceOrientationEvent & {
    requestPermission?: () => Promise<'granted' | 'denied'>;
  };

  if (typeof DOE.requestPermission === 'function') {
    const req = () => {
      DOE.requestPermission!()
        .then(p => { if (p === 'granted') window.addEventListener('deviceorientation', handleOrientation); })
        .catch(console.error);
      document.removeEventListener('touchstart', req);
    };
    document.addEventListener('touchstart', req, { once: true });
  } else {
    window.addEventListener('deviceorientation', handleOrientation);
  }
}

export default webglGalaxy;
