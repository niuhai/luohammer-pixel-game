import { rect } from '../primitives.js';
import { COLORS, GAME_WIDTH } from '../../../config.js';

export function drawLecture(g) {
  const c = COLORS.lecture;
  rect(g, 0, 0, GAME_WIDTH, 60, 0x0a0a1a);
  rect(g, 0, 60, GAME_WIDTH, 60, 0x12122a);
  rect(g, 0, 120, GAME_WIDTH, 80, c.wall);
  rect(g, 0, 200, GAME_WIDTH, 100, c.floor);
  g.fillStyle(0x2a1a0a, 1);
  for (let y = 220; y < 300; y += 20) {
    g.fillRect(0, y, GAME_WIDTH, 1);
  }
  rect(g, 200, 160, 320, 40, c.stage);
  rect(g, 200, 160, 320, 4, 0x3a2a1a);

  rect(g, 240, 20, 240, 100, c.screen);
  rect(g, 244, 24, 232, 92, 0x0a0a1a);
  g.fillStyle(0x4a5a7a, 0.6);
  g.fillRect(260, 36, 160, 4);
  g.fillRect(260, 48, 120, 4);
  g.fillRect(260, 60, 140, 4);
  g.fillRect(260, 76, 100, 4);
  g.fillRect(340, 36, 80, 4);
  g.fillRect(360, 48, 100, 4);
  g.fillStyle(0x8abaca, 0.5);
  g.fillRect(340, 148, 16, 12);
  rect(g, 342, 150, 12, 8, 0x6a8aaa);
  rect(g, 344, 152, 8, 4, 0x4a6a8a);

  g.fillStyle(0x3a3a4e, 1);
  for (let x = 40; x < GAME_WIDTH - 40; x += 60) {
    g.fillRect(x, 240, 40, 20);
  }

  g.fillStyle(0x1a1a3a, 1);
  for (let i = 0; i < 8; i++) {
    const ax = 60 + i * 95;
    g.fillRect(ax, 280, 28, 20);
    g.fillStyle(0xd0b090, 1);
    g.fillRect(ax + 8, 270, 12, 10);
    g.fillStyle(0x1a1a3a, 1);
  }
  g.fillStyle(0x14142e, 1);
  for (let i = 0; i < 5; i++) {
    const ax = 100 + i * 140;
    g.fillRect(ax, 296, 36, 24);
    g.fillStyle(0xc0a080, 1);
    g.fillRect(ax + 10, 284, 16, 14);
    g.fillStyle(0x14142e, 1);
  }
  g.fillStyle(0xffffff, 0.6);
  for (let i = 0; i < 5; i++) {
    const fx = 100 + i * 140;
    g.fillRect(fx, 290, 4, 4);
  }
  g.fillStyle(0xffffff, 0.35);
  for (let i = 0; i < 4; i++) {
    const fx = 140 + i * 150;
    g.fillRect(fx, 300, 4, 4);
  }
}
