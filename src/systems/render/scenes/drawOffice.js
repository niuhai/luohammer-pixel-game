import { rect, px, scanlines, miniFigure } from '../primitives.js';
import { COLORS, GAME_WIDTH, GAME_HEIGHT } from '../../../config.js';

export function drawOffice(g) {
  const c = COLORS.office;
  rect(g, 0, 0, GAME_WIDTH, 200, c.wall);
  rect(g, 0, 0, GAME_WIDTH, 100, 0x22223a);
  rect(g, 376, 24, 48, 48, 0xe8e8e8);
  rect(g, 396, 44, 8, 8, 0x3a3a4e);
  rect(g, 404, 36, 4, 12, 0x3a3a4e);
  rect(g, 398, 46, 4, 4, 0x0a0a0a);
  rect(g, 560, 32, 56, 48, 0xf0f0d0);
  rect(g, 564, 36, 48, 36, 0x0a0a1a);
  g.fillStyle(0xc0c0a0, 1);
  for (let i = 0; i < 4; i++) {
    g.fillRect(568, 42 + i * 8, 40, 2);
  }
  rect(g, 0, 200, GAME_WIDTH, 100, c.floor);
  g.fillStyle(0x2a2a3e, 1);
  for (let y = 220; y < 300; y += 20) {
    g.fillRect(0, y, GAME_WIDTH, 1);
  }
  rect(g, 100, 180, 200, 60, c.desk);
  rect(g, 420, 180, 200, 60, c.desk);
  rect(g, 100, 180, 200, 4, 0x3a2a1a);
  rect(g, 420, 180, 200, 4, 0x3a2a1a);

  rect(g, 140, 140, 120, 40, c.monitor);
  rect(g, 460, 140, 120, 40, c.monitor);
  rect(g, 144, 144, 112, 32, 0x0a0a1a);
  rect(g, 464, 144, 112, 32, 0x0a0a1a);
  g.fillStyle(0x4a6a9a, 0.15);
  g.fillRect(136, 136, 128, 52);
  g.fillRect(456, 136, 128, 52);
  g.fillStyle(0x2a3a5a, 0.5);
  g.fillRect(152, 148, 96, 4);
  g.fillRect(152, 156, 72, 4);
  g.fillRect(152, 164, 88, 4);
  g.fillRect(472, 148, 96, 4);
  g.fillRect(472, 156, 72, 4);
  g.fillRect(472, 164, 88, 4);

  rect(g, 264, 164, 20, 16, 0xd0d0d0);
  rect(g, 266, 164, 16, 3, 0xb0b0b0);
  rect(g, 268, 168, 12, 4, 0x7a5a3a);
  rect(g, 284, 168, 4, 10, 0xc0c0c0);

  rect(g, 20, 100, 60, 100, 0x4a4a5e);
  rect(g, 660, 100, 60, 100, 0x4a4a5e);
  g.fillStyle(0x3a3a4e, 1);
  for (let y = 110; y < 190; y += 20) {
    g.fillRect(24, y, 52, 2);
    g.fillRect(664, y, 52, 2);
  }

  rect(g, 0, 270, GAME_WIDTH, 8, 0x4a3a2a);
  rect(g, 0, 278, GAME_WIDTH, 4, 0x5a4a3a);
  rect(g, 116, 262, 80, 12, 0x2a1a0a);
  g.fillStyle(0x3a2a1a, 1);
  for (let kx = 0; kx < 8; kx++) {
    g.fillRect(120 + kx * 9, 264, 6, 2);
    g.fillRect(122 + kx * 9, 268, 6, 2);
  }
  rect(g, 436, 262, 80, 12, 0x2a1a0a);
  g.fillStyle(0x3a2a1a, 1);
  for (let kx = 0; kx < 8; kx++) {
    g.fillRect(440 + kx * 9, 264, 6, 2);
    g.fillRect(442 + kx * 9, 268, 6, 2);
  }

  rect(g, 700, 248, 28, 32, 0xe8e8e8);
  rect(g, 702, 248, 24, 4, 0xc8c8c8);
  rect(g, 704, 252, 20, 6, 0x8a6a4a);
  rect(g, 728, 254, 8, 18, 0xd8d8d8);
}
