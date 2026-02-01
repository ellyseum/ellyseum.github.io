/**
 * Snake game for terminal
 * Lazy loaded on demand
 */

import type { Terminal } from '@xterm/xterm';

interface Point {
  x: number;
  y: number;
}

export function startSnake(xterm: Terminal): void {
  const cols = xterm.cols;
  const rows = xterm.rows - 2; // Leave room for score

  // Game state
  let snake: Point[] = [{ x: Math.floor(cols / 2), y: Math.floor(rows / 2) }];
  let direction: Point = { x: 1, y: 0 };
  let food: Point = spawnFood();
  let score = 0;
  let gameOver = false;
  let gameLoop: ReturnType<typeof setInterval> | null = null;

  function spawnFood(): Point {
    let pos: Point;
    do {
      pos = {
        x: Math.floor(Math.random() * (cols - 2)) + 1,
        y: Math.floor(Math.random() * (rows - 2)) + 1,
      };
    } while (snake.some(s => s.x === pos.x && s.y === pos.y));
    return pos;
  }

  function draw(): void {
    // Clear screen
    xterm.write('\x1b[2J\x1b[H');

    // Draw border
    xterm.write('\x1b[36m');
    xterm.write('+' + '-'.repeat(cols - 2) + '+\r\n');
    for (let y = 1; y < rows - 1; y++) {
      xterm.write('|' + ' '.repeat(cols - 2) + '|\r\n');
    }
    xterm.write('+' + '-'.repeat(cols - 2) + '+\r\n');
    xterm.write('\x1b[0m');

    // Draw food
    xterm.write(`\x1b[${food.y + 1};${food.x + 1}H\x1b[31m●\x1b[0m`);

    // Draw snake
    for (let i = 0; i < snake.length; i++) {
      const p = snake[i];
      const char = i === 0 ? '\x1b[32m█\x1b[0m' : '\x1b[92m▓\x1b[0m';
      xterm.write(`\x1b[${p.y + 1};${p.x + 1}H${char}`);
    }

    // Draw score
    xterm.write(`\x1b[${rows + 1};1H\x1b[33mScore: ${score}\x1b[0m  \x1b[90m[WASD/Arrows to move, Q to quit]\x1b[0m`);
  }

  function update(): void {
    if (gameOver) return;

    // Move snake
    const head = { x: snake[0].x + direction.x, y: snake[0].y + direction.y };

    // Check wall collision
    if (head.x <= 0 || head.x >= cols - 1 || head.y <= 0 || head.y >= rows - 1) {
      endGame();
      return;
    }

    // Check self collision
    if (snake.some(s => s.x === head.x && s.y === head.y)) {
      endGame();
      return;
    }

    snake.unshift(head);

    // Check food
    if (head.x === food.x && head.y === food.y) {
      score += 10;
      food = spawnFood();
    } else {
      snake.pop();
    }

    draw();
  }

  function endGame(): void {
    gameOver = true;
    if (gameLoop) {
      clearInterval(gameLoop);
      gameLoop = null;
    }

    xterm.write('\x1b[2J\x1b[H');
    xterm.write('\x1b[31m');
    xterm.write(`
   +----------------------------+
   |        GAME OVER!          |
   |                            |
   |     Final Score: ${String(score).padStart(4)}      |
   |                            |
   |   Press any key to exit    |
   +----------------------------+
`);
    xterm.write('\x1b[0m');
  }

  // Input handler
  const inputHandler = xterm.onData((data: string) => {
    if (gameOver) {
      inputHandler.dispose();
      xterm.clear();
      return;
    }

    const key = data.toLowerCase();

    // Handle arrow keys
    if (data === '\x1b[A' || key === 'w') {
      if (direction.y !== 1) direction = { x: 0, y: -1 };
    } else if (data === '\x1b[B' || key === 's') {
      if (direction.y !== -1) direction = { x: 0, y: 1 };
    } else if (data === '\x1b[C' || key === 'd') {
      if (direction.x !== -1) direction = { x: 1, y: 0 };
    } else if (data === '\x1b[D' || key === 'a') {
      if (direction.x !== 1) direction = { x: -1, y: 0 };
    } else if (key === 'q' || data === '\x1b' || data === '\x03') {
      // Quit
      gameOver = true;
      if (gameLoop) {
        clearInterval(gameLoop);
        gameLoop = null;
      }
      inputHandler.dispose();
      xterm.clear();
    }
  });

  // Start game
  draw();
  gameLoop = setInterval(update, 100);
}
