interface StarPoint {
  el: HTMLDivElement;
  point: { x: number; y: number };
}

export class ConstellationText {
  private words = ['DEVELOPER', 'CREATOR', 'EXPLORER'];
  private currentIndex = 0;
  private container: HTMLDivElement | null = null;
  private stars: StarPoint[] = [];
  private lines: HTMLDivElement[] = [];
  private intervalId: number | null = null;

  constructor() {
    // Only show on home page
    if (!document.querySelector('.home')) return;
    this.init();
  }

  private init(): void {
    this.container = document.createElement('div');
    this.container.className = 'constellation-container';
    document.body.appendChild(this.container);

    this.createConstellation(this.words[0]);

    this.intervalId = window.setInterval(() => {
      this.currentIndex = (this.currentIndex + 1) % this.words.length;
      this.fadeOut(() => {
        this.createConstellation(this.words[this.currentIndex]);
      });
    }, 5000);
  }

  private getTextPoints(text: string): { x: number; y: number }[] {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    const fontSize = Math.min(window.innerWidth / 8, 80);

    canvas.width = window.innerWidth;
    canvas.height = 200;

    ctx.font = `bold ${fontSize}px "Inter", system-ui, sans-serif`;
    ctx.fillStyle = 'white';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, canvas.width / 2, canvas.height / 2);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const points: { x: number; y: number }[] = [];
    const step = 6;

    for (let y = 0; y < canvas.height; y += step) {
      for (let x = 0; x < canvas.width; x += step) {
        const i = (y * canvas.width + x) * 4;
        if (imageData.data[i + 3] > 128) {
          points.push({
            x: x + (Math.random() - 0.5) * 3,
            y: y + (Math.random() - 0.5) * 3
          });
        }
      }
    }

    return points;
  }

  private createConstellation(text: string): void {
    if (!this.container) return;

    this.container.innerHTML = '';
    this.stars = [];
    this.lines = [];

    const points = this.getTextPoints(text);

    points.forEach((point, i) => {
      const star = document.createElement('div');
      star.className = 'constellation-star';
      star.style.left = `${point.x}px`;
      star.style.top = `${point.y}px`;
      star.style.animationDelay = `${i * 15}ms`;

      this.container!.appendChild(star);
      this.stars.push({ el: star, point });
    });

    const maxDist = 25;
    for (let i = 0; i < points.length; i++) {
      for (let j = i + 1; j < points.length; j++) {
        const dx = points[j].x - points[i].x;
        const dy = points[j].y - points[i].y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < maxDist && Math.random() > 0.6) {
          const line = document.createElement('div');
          line.className = 'constellation-line';

          const angle = Math.atan2(dy, dx) * 180 / Math.PI;
          line.style.left = `${points[i].x}px`;
          line.style.top = `${points[i].y}px`;
          line.style.width = `${dist}px`;
          line.style.transform = `rotate(${angle}deg)`;
          line.style.animationDelay = `${(i + j) * 8}ms`;

          this.container!.appendChild(line);
          this.lines.push(line);
        }
      }
    }
  }

  private fadeOut(callback: () => void): void {
    if (!this.container) return;

    this.container.classList.add('fading');
    setTimeout(() => {
      this.container?.classList.remove('fading');
      callback();
    }, 600);
  }

  destroy(): void {
    if (this.intervalId) clearInterval(this.intervalId);
    if (this.container) this.container.remove();
    this.container = null;
  }
}
