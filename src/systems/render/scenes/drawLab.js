import { rect } from '../primitives.js';
import { COLORS, GAME_WIDTH } from '../../../config.js';

export function drawLab(g) {
  const c = COLORS.lab;
  rect(g, 0, 0, GAME_WIDTH, 200, c.wall);
  rect(g, 0, 0, GAME_WIDTH, 100, 0x22223a);

  rect(g, 280, 28, 200, 80, 0xe8e8d8);
  rect(g, 284, 32, 192, 72, 0xd0d0c0);
  g.fillStyle(0x2a3a5a, 0.6);
  g.fillRect(296, 40, 80, 3);
  g.fillRect(296, 50, 120, 3);
  g.fillRect(296, 60, 60, 3);
  g.fillRect(380, 40, 60, 3);
  g.fillRect(400, 50, 56, 3);
  g.fillRect(360, 70, 100, 3);
  rect(g, 280, 28, 200, 3, 0x8a8a7a);
  rect(g, 280, 28, 3, 80, 0x8a8a7a);
  rect(g, 477, 28, 3, 80, 0x8a8a7a);
  rect(g, 280, 105, 200, 3, 0x8a8a7a);

  rect(g, 0, 200, GAME_WIDTH, 100, c.floor);
  g.fillStyle(0x2a2a3e, 1);
  for (let y = 220; y < 300; y += 20) {
    g.fillRect(0, y, GAME_WIDTH, 1);
  }

  rect(g, 100, 180, 200, 40, c.table);
  rect(g, 420, 180, 200, 40, c.table);
  rect(g, 100, 180, 200, 4, 0x3a3a4e);
  rect(g, 420, 180, 200, 4, 0x3a3a4e);

  rect(g, 116, 152, 56, 28, 0x5a5a6e);
  rect(g, 120, 156, 48, 20, 0x4a4a5e);
  g.fillStyle(c.glow, 0.45);
  g.fillRect(124, 132, 8, 24);
  g.fillRect(136, 128, 8, 28);
  g.fillRect(148, 134, 8, 22);
  rect(g, 122, 154, 12, 4, 0x4a4a5e);
  rect(g, 134, 154, 12, 4, 0x4a4a5e);
  rect(g, 146, 154, 12, 4, 0x4a4a5e);
  g.fillStyle(c.glow, 0.35);
  g.fillRect(168, 140, 20, 36);
  rect(g, 166, 172, 24, 4, 0x3a3a4e);
  g.fillStyle(c.glow, 0.25);
  g.fillRect(172, 136, 8, 8);

  g.fillStyle(c.glow, 0.5);
  g.fillRect(460, 140, 20, 40);
  g.fillRect(500, 144, 16, 36);
  rect(g, 456, 176, 28, 4, 0x4a4a5e);
  rect(g, 496, 176, 24, 4, 0x4a4a5e);
  rect(g, 540, 156, 48, 24, 0x5a5a6e);
  rect(g, 544, 160, 40, 16, 0x4a4a5e);
  g.fillStyle(c.glow, 0.4);
  g.fillRect(548, 138, 6, 22);
  g.fillRect(558, 142, 6, 18);
  g.fillRect(568, 136, 6, 24);
  rect(g, 546, 158, 10, 3, 0x4a4a5e);
  rect(g, 556, 158, 10, 3, 0x4a4a5e);
  rect(g, 566, 158, 10, 3, 0x4a4a5e);

  rect(g, 20, 80, 60, 100, 0x4a4a5e);
  rect(g, 660, 80, 60, 100, 0x4a4a5e);
  rect(g, 48, 85, 4, 90, 0x3a3a4e);
  rect(g, 688, 85, 4, 90, 0x3a3a4e);

  rect(g, 0, 272, GAME_WIDTH, 8, 0x3a3a4e);
  rect(g, 0, 280, GAME_WIDTH, 4, 0x4a4a5e);
  g.fillStyle(c.glow, 0.2);
  g.fillRect(80, 260, 12, 20);
  g.fillRect(700, 264, 10, 16);
}
