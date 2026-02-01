/**
 * Matrix rain effect for terminal
 * Lazy loaded on demand
 */

import type { Terminal } from '@xterm/xterm';

const CHARS = 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

interface Drop {
  x: number;
  y: number;
  speed: number;
  length: number;
  chars: string[];
}

export function startMatrix(xterm: Terminal): void {
  const cols = xterm.cols;
  const rows = xterm.rows;

  // Create drops
  const drops: Drop[] = [];
  for (let i = 0; i < cols; i++) {
    if (Math.random() > 0.5) {
      drops.push(createDrop(i, rows));
    }
  }

  let running = true;
  let frame = 0;

  function createDrop(x: number, maxRows: number): Drop {
    const length = Math.floor(Math.random() * 15) + 5;
    const chars: string[] = [];
    for (let i = 0; i < length; i++) {
      chars.push(CHARS[Math.floor(Math.random() * CHARS.length)]);
    }
    return {
      x,
      y: -Math.floor(Math.random() * maxRows),
      speed: Math.random() * 0.5 + 0.5,
      length,
      chars,
    };
  }

  function draw(): void {
    // Build screen buffer
    const buffer: string[][] = [];
    for (let y = 0; y < rows; y++) {
      buffer[y] = [];
      for (let x = 0; x < cols; x++) {
        buffer[y][x] = ' ';
      }
    }

    // Update and draw drops
    for (let i = 0; i < drops.length; i++) {
      const drop = drops[i];

      // Update position
      drop.y += drop.speed;

      // Mutate characters occasionally
      if (Math.random() > 0.95) {
        const idx = Math.floor(Math.random() * drop.chars.length);
        drop.chars[idx] = CHARS[Math.floor(Math.random() * CHARS.length)];
      }

      // Draw drop trail
      for (let j = 0; j < drop.length; j++) {
        const y = Math.floor(drop.y) - j;
        if (y >= 0 && y < rows) {
          buffer[y][drop.x] = drop.chars[j];
        }
      }

      // Reset drop if off screen
      if (drop.y - drop.length > rows) {
        drops[i] = createDrop(drop.x, rows);
      }
    }

    // Add new drops occasionally
    if (Math.random() > 0.97 && drops.length < cols) {
      const x = Math.floor(Math.random() * cols);
      if (!drops.some(d => d.x === x)) {
        drops.push(createDrop(x, rows));
      }
    }

    // Render to terminal
    xterm.write('\x1b[H'); // Move to home

    for (let y = 0; y < rows; y++) {
      let line = '';
      for (let x = 0; x < cols; x++) {
        const char = buffer[y][x];
        if (char !== ' ') {
          // Find the drop at this position for coloring
          const drop = drops.find(d => d.x === x);
          if (drop) {
            const headY = Math.floor(drop.y);
            const distFromHead = headY - y;

            if (distFromHead === 0) {
              // Head - bright white
              line += `\x1b[97m${char}\x1b[0m`;
            } else if (distFromHead < 3) {
              // Near head - bright green
              line += `\x1b[92m${char}\x1b[0m`;
            } else if (distFromHead < 8) {
              // Mid trail - green
              line += `\x1b[32m${char}\x1b[0m`;
            } else {
              // Far trail - dark green
              line += `\x1b[2;32m${char}\x1b[0m`;
            }
          } else {
            line += char;
          }
        } else {
          line += ' ';
        }
      }
      xterm.write(line);
      if (y < rows - 1) {
        xterm.write('\r\n');
      }
    }
  }

  // Input handler
  const inputHandler = xterm.onData(() => {
    running = false;
    inputHandler.dispose();
    xterm.clear();
  });

  // Hide cursor
  xterm.write('\x1b[?25l');

  // Animation loop
  function animate(): void {
    if (!running) {
      // Show cursor
      xterm.write('\x1b[?25h');
      return;
    }

    frame++;
    if (frame % 2 === 0) { // Slow down a bit
      draw();
    }

    requestAnimationFrame(animate);
  }

  // Initial clear
  xterm.write('\x1b[2J');
  animate();
}
