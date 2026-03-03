/**
 * Mini roguelike dungeon crawler for terminal
 * Lazy loaded on demand
 */

import type { Terminal } from '@xterm/xterm';

const enum Tile {
  WALL = '#',
  FLOOR = '.',
  GOLD = '*',
  STAIRS = '>',
}

interface Monster {
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  atk: number;
  char: string;
  name: string;
}

interface Room {
  x: number;
  y: number;
  w: number;
  h: number;
}

const MONSTER_DEFS = [
  { char: 'r', name: 'rat', hp: 1, atk: 1, minFloor: 1 },
  { char: 's', name: 'skeleton', hp: 3, atk: 2, minFloor: 2 },
  { char: 'o', name: 'orc', hp: 5, atk: 3, minFloor: 3 },
  { char: 'D', name: 'dragon', hp: 10, atk: 5, minFloor: 5 },
];

export function startRoguelike(xterm: Terminal): void {
  const cols = xterm.cols;
  const rows = xterm.rows - 2; // Reserve 2 lines for HUD

  // Player state
  let px = 0;
  let py = 0;
  let hp = 20;
  const maxHp = 20;
  let atk = 3;
  let gold = 0;
  let score = 0;
  let floor = 1;
  let kills = 0;
  let message = 'Welcome to the dungeon. Find the stairs (>).';
  let gameOver = false;

  // Map state
  let map: string[][] = [];
  let monsters: Monster[] = [];

  function rand(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function generateDungeon(): void {
    // Fill with walls
    map = [];
    for (let y = 0; y < rows; y++) {
      map[y] = [];
      for (let x = 0; x < cols; x++) {
        map[y][x] = Tile.WALL;
      }
    }

    // Place 5-8 non-overlapping rooms
    const rooms: Room[] = [];
    const numRooms = rand(5, 8);
    let attempts = 0;

    while (rooms.length < numRooms && attempts < 200) {
      attempts++;
      const w = rand(4, 8);
      const h = rand(3, 6);
      const rx = rand(1, cols - w - 2);
      const ry = rand(1, rows - h - 2);

      // Check overlap (with 1-tile padding)
      const overlaps = rooms.some(
        r => rx - 1 < r.x + r.w && rx + w + 1 > r.x && ry - 1 < r.y + r.h && ry + h + 1 > r.y,
      );
      if (overlaps) continue;

      rooms.push({ x: rx, y: ry, w, h });

      // Carve room floor
      for (let y = ry; y < ry + h; y++) {
        for (let x = rx; x < rx + w; x++) {
          map[y][x] = Tile.FLOOR;
        }
      }
    }

    // Connect rooms with L-shaped corridors
    for (let i = 1; i < rooms.length; i++) {
      const a = rooms[i - 1];
      const b = rooms[i];
      const ax = Math.floor(a.x + a.w / 2);
      const ay = Math.floor(a.y + a.h / 2);
      const bx = Math.floor(b.x + b.w / 2);
      const by = Math.floor(b.y + b.h / 2);

      // Random elbow direction
      if (Math.random() < 0.5) {
        carveCorridor(ax, ay, bx, ay); // horizontal first
        carveCorridor(bx, ay, bx, by); // then vertical
      } else {
        carveCorridor(ax, ay, ax, by); // vertical first
        carveCorridor(ax, by, bx, by); // then horizontal
      }
    }

    // Place player in first room center
    const first = rooms[0];
    px = Math.floor(first.x + first.w / 2);
    py = Math.floor(first.y + first.h / 2);

    // Place stairs in last room center
    const last = rooms[rooms.length - 1];
    const sx = Math.floor(last.x + last.w / 2);
    const sy = Math.floor(last.y + last.h / 2);
    map[sy][sx] = Tile.STAIRS;

    // Spawn monsters in random rooms (not the player's room)
    monsters = [];
    const monsterCount = rand(3, 5);
    const eligible = MONSTER_DEFS.filter(m => m.minFloor <= floor);
    for (let i = 0; i < monsterCount && eligible.length > 0; i++) {
      const roomIdx = rand(1, rooms.length - 1); // skip room 0 (player)
      const room = rooms[roomIdx];
      const mx = rand(room.x, room.x + room.w - 1);
      const my = rand(room.y, room.y + room.h - 1);

      // Don't stack on stairs or other monsters
      if (map[my][mx] !== Tile.FLOOR) continue;
      if (monsters.some(m => m.x === mx && m.y === my)) continue;

      const def = eligible[rand(0, eligible.length - 1)];
      monsters.push({ x: mx, y: my, hp: def.hp, maxHp: def.hp, atk: def.atk, char: def.char, name: def.name });
    }

    // Scatter gold
    const goldCount = rand(2, 4);
    for (let i = 0; i < goldCount; i++) {
      const roomIdx = rand(0, rooms.length - 1);
      const room = rooms[roomIdx];
      const gx = rand(room.x, room.x + room.w - 1);
      const gy = rand(room.y, room.y + room.h - 1);
      if (map[gy][gx] === Tile.FLOOR && !(gx === px && gy === py)) {
        map[gy][gx] = Tile.GOLD;
      }
    }
  }

  function carveCorridor(x1: number, y1: number, x2: number, y2: number): void {
    let x = x1;
    let y = y1;
    while (x !== x2 || y !== y2) {
      if (y >= 0 && y < rows && x >= 0 && x < cols) {
        map[y][x] = Tile.FLOOR;
      }
      if (x < x2) x++;
      else if (x > x2) x--;
      if (y < y2) y++;
      else if (y > y2) y--;
    }
    if (y >= 0 && y < rows && x >= 0 && x < cols) {
      map[y][x] = Tile.FLOOR;
    }
  }

  function draw(): void {
    xterm.write('\x1b[?25l'); // Hide cursor
    xterm.write('\x1b[H'); // Home position

    for (let y = 0; y < rows; y++) {
      let line = '';
      for (let x = 0; x < cols; x++) {
        // Check for player
        if (x === px && y === py) {
          line += '\x1b[92m@\x1b[0m';
          continue;
        }

        // Check for monster
        const mon = monsters.find(m => m.x === x && m.y === y);
        if (mon) {
          const color = mon.char === 'D' ? '\x1b[91m' : '\x1b[31m';
          line += `${color}${mon.char}\x1b[0m`;
          continue;
        }

        // Draw tile
        const tile = map[y]?.[x] ?? Tile.WALL;
        switch (tile) {
          case Tile.WALL:
            line += '\x1b[90m#\x1b[0m';
            break;
          case Tile.FLOOR:
            line += '\x1b[38;5;238m.\x1b[0m';
            break;
          case Tile.GOLD:
            line += '\x1b[33m*\x1b[0m';
            break;
          case Tile.STAIRS:
            line += '\x1b[36m>\x1b[0m';
            break;
          default:
            line += tile;
        }
      }
      xterm.write(line);
      if (y < rows - 1) xterm.write('\r\n');
    }

    // HUD line 1: stats
    const hpPct = hp / maxHp;
    const hpBarLen = 10;
    const hpFilled = Math.ceil(hpPct * hpBarLen);
    const hpColor = hpPct > 0.5 ? '\x1b[32m' : hpPct > 0.25 ? '\x1b[33m' : '\x1b[31m';
    const hpBar = `${hpColor}${'█'.repeat(hpFilled)}${'░'.repeat(hpBarLen - hpFilled)}\x1b[0m`;

    const hud = `\r\nFloor ${floor}  HP: ${hpBar} ${hp}/${maxHp}  ATK: ${atk}  Gold: ${gold}  Score: ${score}`;
    xterm.write(hud);

    // HUD line 2: message + controls
    const msgLine = `\r\n\x1b[93m${message}\x1b[0m \x1b[90m[WASD/Arrows, Q quit]\x1b[0m`;
    // Clear rest of line to prevent artifacts
    xterm.write(msgLine + '\x1b[K');
  }

  function movePlayer(dx: number, dy: number): void {
    if (gameOver) return;

    const nx = px + dx;
    const ny = py + dy;

    // Bounds check
    if (ny < 0 || ny >= rows || nx < 0 || nx >= cols) return;

    // Wall check
    if (map[ny][nx] === Tile.WALL) return;

    // Monster check - bump to attack
    const monIdx = monsters.findIndex(m => m.x === nx && m.y === ny);
    if (monIdx !== -1) {
      const mon = monsters[monIdx];
      mon.hp -= atk;
      hp -= mon.atk;
      if (mon.hp <= 0) {
        monsters.splice(monIdx, 1);
        kills++;
        score += 5;
        message = `You slayed the ${mon.name}!`;
      } else {
        message = `Hit ${mon.name} for ${atk}! Took ${mon.atk} damage.`;
      }
      if (hp <= 0) {
        hp = 0;
        endGame();
        return;
      }
      draw();
      return;
    }

    // Move
    px = nx;
    py = ny;

    // Pickup gold
    if (map[ny][nx] === Tile.GOLD) {
      const amount = rand(1, 3);
      gold += amount;
      score += amount;
      map[ny][nx] = Tile.FLOOR;
      message = `Found ${amount} gold!`;
    }
    // Descend stairs
    else if (map[ny][nx] === Tile.STAIRS) {
      floor++;
      atk++;
      score += 10;
      message = `Descended to floor ${floor}. ATK increased to ${atk}!`;
      generateDungeon();
    } else {
      message = '';
    }

    draw();
  }

  function endGame(): void {
    gameOver = true;
    score += gold + kills * 5 + floor * 10;

    xterm.write('\x1b[2J\x1b[H');
    xterm.write('\x1b[31m');
    xterm.write('\r\n');
    xterm.write('   +================================+\r\n');
    xterm.write('   |          YOU DIED!              |\r\n');
    xterm.write('   |                                 |\r\n');
    xterm.write(`   |   Floor: ${String(floor).padStart(3)}                    |\r\n`);
    xterm.write(`   |   Gold:  ${String(gold).padStart(3)}                    |\r\n`);
    xterm.write(`   |   Kills: ${String(kills).padStart(3)}                    |\r\n`);
    xterm.write(`   |   Score: ${String(score).padStart(4)}                   |\r\n`);
    xterm.write('   |                                 |\r\n');
    xterm.write('   |     Press any key to exit       |\r\n');
    xterm.write('   +================================+\r\n');
    xterm.write('\x1b[0m');
  }

  // Input handler
  const inputHandler = xterm.onData((data: string) => {
    if (gameOver) {
      inputHandler.dispose();
      xterm.write('\x1b[?25h');
      xterm.clear();
      return;
    }

    const key = data.toLowerCase();

    if (data === '\x1b[A' || key === 'w') movePlayer(0, -1);
    else if (data === '\x1b[B' || key === 's') movePlayer(0, 1);
    else if (data === '\x1b[C' || key === 'd') movePlayer(1, 0);
    else if (data === '\x1b[D' || key === 'a') movePlayer(-1, 0);
    else if (key === 'q' || data === '\x1b' || data === '\x03') {
      gameOver = true;
      inputHandler.dispose();
      xterm.write('\x1b[?25h');
      xterm.clear();
    }
  });

  // Start
  xterm.write('\x1b[2J');
  generateDungeon();
  draw();
}
