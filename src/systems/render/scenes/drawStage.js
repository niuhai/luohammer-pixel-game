import { rect, px, scanlines, miniFigure } from '../primitives.js';
import { COLORS, GAME_WIDTH, GAME_HEIGHT } from '../../../config.js';

export function drawStage(g) {
  const c = COLORS.stage;
  rect(g, 0, 0, GAME_WIDTH, 200, c.wall);
  rect(g, 0, 0, GAME_WIDTH, 100, 0x0a0a1a);
  rect(g, 0, 200, GAME_WIDTH, 100, c.floor);
  g.fillStyle(0x1a1a2e, 1);
  for (let y = 220; y < 300; y += 20) {
    g.fillRect(0, y, GAME_WIDTH, 1);
  }
  rect(g, 100, 160, 520, 40, 0x2a2a3e);
  rect(g, 100, 160, 520, 4, 0x1a1a2e);

  rect(g, 200, 20, 320, 80, c.screen);
  rect(g, 204, 24, 312, 72, 0x0a0a1a);
  g.fillStyle(c.spotlight, 0.5);
  g.fillRect(240, 36, 240, 6);
  g.fillRect(248, 48, 80, 5);
  g.fillRect(336, 48, 120, 5);
  g.fillRect(260, 60, 200, 5);
  g.fillRect(280, 72, 160, 5);
  g.fillRect(320, 36, 8, 42);
  g.fillStyle(c.spotlight, 0.15);
  g.fillRect(196, 16, 328, 88);

  g.fillStyle(c.spotlight, 0.08);
  g.fillRect(180, 0, 80, 160);
  g.fillStyle(c.spotlight, 0.12);
  g.fillRect(340, 0, 80, 160);
  g.fillStyle(c.spotlight, 0.06);
  g.fillRect(260, 0, 100, 160);
  g.fillStyle(c.spotlight, 0.18);
  g.fillRect(356, 0, 48, 160);

  g.fillStyle(0x12122e, 1);
  for (let i = 0; i < 10; i++) {
    const ax = 40 + i * 76;
    g.fillRect(ax, 240, 24, 16);
    g.fillStyle(0xd0b090, 1);
    g.fillRect(ax + 6, 232, 10, 8);
    g.fillStyle(0x12122e, 1);
  }
  g.fillStyle(0x0a0a1e, 1);
  for (let i = 0; i < 6; i++) {
    const ax = 70 + i * 120;
    g.fillRect(ax, 256, 32, 20);
    g.fillStyle(0xb09070, 1);
    g.fillRect(ax + 8, 246, 16, 12);
    g.fillStyle(0x0a0a1e, 1);
  }
  g.fillStyle(0xffffff, 0.8);
  for (let i = 0; i < 7; i++) {
    const fx = 80 + i * 105;
    g.fillRect(fx, 248, 4, 4);
    g.fillRect(fx + 2, 246, 2, 2);
  }
  g.fillStyle(0xffffff, 0.45);
  for (let i = 0; i < 5; i++) {
    const fx = 120 + i * 130;
    g.fillRect(fx, 264, 3, 3);
  }
}
