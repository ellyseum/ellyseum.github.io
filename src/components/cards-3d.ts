export class Cards3D {
  private cards: NodeListOf<HTMLElement>;
  private mouse = { x: 0, y: 0 };
  private targetMouse = { x: 0, y: 0 };

  constructor() {
    this.cards = document.querySelectorAll('.post-item');

    if (this.cards.length === 0) return;

    // Skip 3D tilt on mobile - no mouse cursor to track
    if (window.innerWidth <= 768) return;

    this.init();
  }

  private init(): void {
    const container = document.querySelector('.post-list') as HTMLElement | null;
    if (container) {
      container.style.perspective = '1200px';
      container.style.perspectiveOrigin = '50% 50%';
    }

    this.cards.forEach((card, i) => {
      card.style.transformStyle = 'preserve-3d';
      card.style.willChange = 'transform';

      // Only set random rotations if not already set (preserve across reinit)
      if (!card.dataset.baseRotX) {
        const baseRotX = (Math.random() - 0.5) * 1.8;
        const baseRotY = (Math.random() - 0.5) * 2.4;
        const baseZ = i * -4.5 + (Math.random() - 0.5) * 6;

        card.dataset.baseRotX = String(baseRotX);
        card.dataset.baseRotY = String(baseRotY);
        card.dataset.baseZ = String(baseZ);
      }
      card.dataset.index = String(i);

      // Skip animation handling for js-animated cards (SPA navigated)
      if (card.classList.contains('js-animated')) {
        // Use slower transition initially for smooth tilt-in, then switch to fast for hover
        card.style.transition = 'transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.2s ease-out, border-color 0.2s';
        setTimeout(() => {
          card.style.transition = 'transform 0.15s ease-out, box-shadow 0.2s ease-out, border-color 0.2s';
        }, 700);
      } else {
        // Remove CSS animation after it completes so JS can control transform
        const handleAnimationEnd = (): void => {
          card.style.animation = 'none';
          card.style.opacity = '1';
          card.style.transition = 'transform 0.15s ease-out, box-shadow 0.2s ease-out, border-color 0.2s';
          card.removeEventListener('animationend', handleAnimationEnd);
        };
        card.addEventListener('animationend', handleAnimationEnd);

        // Check if animation already finished
        const computed = window.getComputedStyle(card);
        if (computed.animationName === 'none' || computed.opacity === '1') {
          card.style.animation = 'none';
          card.style.opacity = '1';
          card.style.transition = 'transform 0.15s ease-out, box-shadow 0.2s ease-out, border-color 0.2s';
        }
      }

      // Enhanced hover effect per card
      card.addEventListener('mouseenter', () => {
        card.dataset.hovered = 'true';
      });

      card.addEventListener('mouseleave', () => {
        card.dataset.hovered = 'false';
      });
    });
  }

  updateMouse(x: number, y: number): void {
    this.targetMouse.x = x;
    this.targetMouse.y = y;
  }

  update(): void {
    this.mouse.x += (this.targetMouse.x - this.mouse.x) * 0.1;
    this.mouse.y += (this.targetMouse.y - this.mouse.y) * 0.1;

    this.cards.forEach(card => {
      const baseRotX = parseFloat(card.dataset.baseRotX || '0');
      const baseRotY = parseFloat(card.dataset.baseRotY || '0');
      const baseZ = parseFloat(card.dataset.baseZ || '0');
      const hovered = card.dataset.hovered === 'true';

      // Subtle rotation - cards face toward cursor
      const rotX = baseRotX + this.mouse.y * 2.1;
      const rotY = baseRotY + this.mouse.x * 2.7;
      const z = hovered ? baseZ + 12 : baseZ;
      const scale = hovered ? 1.03 : 1;

      card.style.transform = `
        translateZ(${z}px)
        rotateX(${rotX}deg)
        rotateY(${rotY}deg)
        scale(${scale})
      `;
    });
  }
}
