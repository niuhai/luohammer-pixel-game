import { rect, px, scanlines, miniFigure } from '../primitives.js';
import { COLORS, GAME_WIDTH, GAME_HEIGHT } from '../../../config.js';

export function drawTalkshow(g) {
  const c = COLORS.talkshow;

  rect(g, 0, 0, GAME_WIDTH, GAME_HEIGHT, c.wall);

  g.fillStyle(c.spotlight, 0.04);
  g.fillRect(200, 0, 400, 500);
  g.fillStyle(c.spotlight, 0.06);
  g.fillRect(280, 0, 240, 500);
  g.fillStyle(c.spotlight, 0.08);
  g.fillRect(340, 0, 120, 400);

  rect(g, 0, 0, 60, GAME_HEIGHT, c.curtain);
  rect(g, 740, 0, 60, GAME_HEIGHT, c.curtain);
  rect(g, 56, 0, 4, GAME_HEIGHT, 0x6a1010);
  rect(g, 740, 0, 4, GAME_HEIGHT, 0x6a1010);
  g.fillStyle(0x7a1a1a, 1);
  for (let y = 0; y < GAME_HEIGHT; y += 32) {
    g.fillRect(8, y, 44, 4);
    g.fillRect(16, y + 16, 36, 4);
  }
  for (let y = 0; y < GAME_HEIGHT; y += 32) {
    g.fillRect(748, y, 44, 4);
    g.fillRect(748, y + 16, 36, 4);
  }

  rect(g, 200, 320, 400, 40, c.stage);
  rect(g, 160, 328, 40, 24, c.stage);
  rect(g, 600, 328, 40, 24, c.stage);
  rect(g, 120, 336, 40, 16, c.stage);
  rect(g, 640, 336, 40, 16, c.stage);
  rect(g, 220, 324, 360, 32, c.floor);
  rect(g, 168, 332, 32, 16, c.floor);
  rect(g, 600, 332, 32, 16, c.floor);
  rect(g, 128, 340, 24, 8, c.floor);
  rect(g, 648, 340, 24, 8, c.floor);
  rect(g, 200, 356, 400, 4, 0x4a2a2a);
  rect(g, 160, 348, 40, 4, 0x4a2a2a);
  rect(g, 600, 348, 40, 4, 0x4a2a2a);

  rect(g, 396, 216, 8, 104, 0x8a8a9a);
  rect(g, 384, 316, 32, 4, 0x5a5a6a);
  rect(g, 388, 200, 24, 16, 0x6a6a7a);
  rect(g, 392, 204, 16, 8, 0x8a8a9a);

  rect(g, 280, 20, 240, 40, c.spotlight);
  rect(g, 284, 24, 232, 32, c.wall);
  g.fillStyle(c.highlight, 1);
  g.fillRect(296, 32, 16, 4);
  g.fillRect(304, 36, 4, 16);
  g.fillRect(320, 36, 4, 16);
  g.fillRect(320, 32, 12, 4);
  g.fillRect(320, 40, 12, 4);
  g.fillRect(340, 32, 4, 20);
  g.fillRect(344, 32, 12, 4);
  g.fillRect(360, 32, 4, 20);
  g.fillRect(364, 40, 4, 4);
  g.fillRect(380, 32, 12, 4);
  g.fillRect(380, 36, 4, 4);
  g.fillRect(380, 40, 12, 4);
  g.fillRect(388, 44, 4, 4);
  g.fillRect(380, 48, 12, 4);
  g.fillRect(400, 32, 4, 20);
  g.fillRect(412, 32, 4, 20);
  g.fillRect(400, 40, 12, 4);
  g.fillRect(424, 32, 12, 20);
  g.fillRect(428, 36, 4, 12);
  g.fillRect(444, 32, 4, 20);
  g.fillRect(456, 32, 4, 20);
  g.fillRect(448, 40, 4, 8);
  g.fillRect(452, 44, 4, 8);
  g.fillStyle(c.spotlight, 0.6);
  for (let i = 0; i < 16; i++) {
    g.fillRect(280 + i * 16, 16, 4, 4);
    g.fillRect(280 + i * 16, 60, 4, 4);
  }

  g.fillStyle(c.audience, 1);
  for (let row = 0; row < 5; row++) {
    const y = 380 + row * 24;
    for (let col = 0; col < 12; col++) {
      const x = 100 + col * 52;
      g.fillRect(x, y, 16, 12);
      g.fillStyle(0xd0b090, 1);
      g.fillRect(x + 4, y - 6, 8, 6);
      g.fillStyle(c.audience, 1);
    }
  }

  g.fillStyle(c.spotlight, 0.4);
  for (let i = 0; i < 20; i++) {
    g.fillRect(60 + i * 36, 360, 8, 4);
  }
  g.fillStyle(c.spotlight, 0.2);
  for (let i = 0; i < 20; i++) {
    g.fillRect(60 + i * 36, 368, 4, 8);
  }
  rect(g, 60, 356, 680, 4, 0x3a1a1a);
}
