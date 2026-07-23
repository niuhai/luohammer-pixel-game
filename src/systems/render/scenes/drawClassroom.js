import { rect } from '../primitives.js';
import { COLORS, GAME_WIDTH, GAME_HEIGHT } from '../../../config.js';

export function drawClassroom(g) {
  const c = COLORS.classroom;

  rect(g, 0, 0, GAME_WIDTH, 320, c.wall);
  rect(g, 0, 0, GAME_WIDTH, 160, 0x32324a);
  g.fillStyle(0x6a8aaa, 0.08);
  g.fillRect(20, 60, 60, 260);
  g.fillRect(720, 60, 60, 260);
  g.fillStyle(0x8abaca, 0.04);
  g.fillRect(80, 160, 120, 160);
  g.fillRect(600, 160, 120, 160);

  rect(g, 0, 320, GAME_WIDTH, 180, c.floor);
  g.fillStyle(0x1e1e32, 1);
  for (let y = 340; y < GAME_HEIGHT; y += 20) {
    g.fillRect(0, y, GAME_WIDTH, 1);
  }
  g.fillStyle(0x16162a, 1);
  for (let x = 0; x < GAME_WIDTH; x += 80) {
    g.fillRect(x, 320, 1, 180);
  }

  rect(g, 200, 40, 400, 160, c.board);
  rect(g, 196, 36, 408, 4, COLORS.border);
  rect(g, 196, 200, 408, 4, COLORS.border);
  rect(g, 196, 36, 4, 168, COLORS.border);
  rect(g, 600, 36, 4, 168, COLORS.border);
  g.fillStyle(0x2a5a2a, 0.15);
  g.fillRect(204, 44, 392, 40);
  g.fillStyle(0xc0c0c0, 1);
  g.fillRect(220, 70, 160, 2);
  g.fillRect(220, 100, 120, 2);
  g.fillRect(220, 130, 140, 2);
  g.fillRect(380, 76, 80, 2);
  g.fillRect(360, 106, 100, 2);
  rect(g, 580, 190, 8, 3, 0xffffff);

  rect(g, 360, 220, 80, 40, 0x5a4a3a);
  rect(g, 364, 224, 72, 32, 0x4a3a2a);
  rect(g, 360, 220, 80, 4, 0x6a5a4a);

  g.fillStyle(c.desk, 1);
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 5; col++) {
      const dx = 80 + col * 140;
      const dy = 260 + row * 50;
      g.fillRect(dx, dy, 60, 16);
      g.fillStyle(0x3a2a1a, 1);
      g.fillRect(dx + 4, dy + 16, 4, 8);
      g.fillRect(dx + 52, dy + 16, 4, 8);
      g.fillStyle(c.desk, 1);
    }
  }
  const bookColors = [0xc04040, 0x4040c0, 0x40c040, 0xc0c040, 0xc040c0];
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 5; col++) {
      const dx = 80 + col * 140;
      const dy = 260 + row * 50;
      const bc = bookColors[(row + col) % bookColors.length];
      rect(g, dx + 8, dy - 8, 16, 8, bc);
    }
  }

  rect(g, 20, 60, 60, 100, 0x3a4a6a);
  rect(g, 720, 60, 60, 100, 0x3a4a6a);
  g.fillStyle(0x5a7aaa, 0.3);
  g.fillRect(24, 64, 20, 40);
  g.fillRect(724, 64, 20, 40);
  g.fillStyle(0x5a5a7a, 1);
  g.fillRect(20, 60, 60, 2);
  g.fillRect(20, 160, 60, 2);
  g.fillRect(20, 60, 2, 100);
  g.fillRect(78, 60, 2, 100);
  g.fillRect(48, 60, 2, 100);
  g.fillRect(720, 60, 60, 2);
  g.fillRect(720, 160, 60, 2);
  g.fillRect(720, 60, 2, 100);
  g.fillRect(778, 60, 2, 100);
  g.fillRect(748, 60, 2, 100);

  rect(g, 660, 120, 40, 200, 0x5a4a3a);
  rect(g, 692, 220, 4, 4, COLORS.border);

  rect(g, 100, 360, 120, 20, 0x5a4a3a);
  rect(g, 340, 360, 120, 20, 0x5a4a3a);
  rect(g, 580, 360, 120, 20, 0x5a4a3a);
  rect(g, 104, 380, 4, 24, 0x3a2a1a);
  rect(g, 212, 380, 4, 24, 0x3a2a1a);
  rect(g, 344, 380, 4, 24, 0x3a2a1a);
  rect(g, 452, 380, 4, 24, 0x3a2a1a);
  rect(g, 584, 380, 4, 24, 0x3a2a1a);
  rect(g, 692, 380, 4, 24, 0x3a2a1a);
  rect(g, 120, 352, 20, 8, 0xc04040);
  rect(g, 360, 352, 20, 8, 0x4040c0);
  rect(g, 600, 352, 20, 8, 0x40c040);
}
