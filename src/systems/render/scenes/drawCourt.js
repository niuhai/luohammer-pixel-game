import { rect, px, scanlines, miniFigure } from '../primitives.js';
import { COLORS, GAME_WIDTH, GAME_HEIGHT } from '../../../config.js';

export function drawCourt(g) {
  const c = COLORS.court;
  rect(g, 0, 0, GAME_WIDTH, 200, c.wall);
  rect(g, 0, 0, GAME_WIDTH, 100, 0x2a2a3e);
  rect(g, 0, 200, GAME_WIDTH, 100, c.floor);
  g.fillStyle(0x3a2a1a, 1);
  for (let y = 220; y < 300; y += 20) {
    g.fillRect(0, y, GAME_WIDTH, 1);
  }
  rect(g, 200, 140, 320, 40, c.bench);
  rect(g, 200, 140, 320, 4, 0x4a3a2a);
  rect(g, 40, 180, 120, 40, c.dock);
  rect(g, 560, 180, 120, 40, c.dock);
  rect(g, 40, 20, 60, 40, c.flag);
  rect(g, 60, 30, 8, 8, 0xf0c040);
  rect(g, 80, 40, 8, 8, 0xf0c040);
  g.fillStyle(c.bar, 1);
  for (let x = 40; x < GAME_WIDTH - 40; x += 40) {
    g.fillRect(x, 240, 24, 16);
  }
}
