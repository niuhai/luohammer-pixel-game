import { rect, px, scanlines, miniFigure } from '../primitives.js';
import { COLORS, GAME_WIDTH, GAME_HEIGHT } from '../../../config.js';

export function drawFridgeSmash(g) {
  const c = COLORS.fridge_smash;
  rect(g, 0, 0, GAME_WIDTH, 320, 0x3A4A5E);
  g.fillStyle(0x2A3A4E, 1);
  for (let x = 0; x < GAME_WIDTH; x += 80) {
    g.fillRect(x, 0, 4, 320);
  }
  for (let y = 0; y < 320; y += 60) {
    g.fillRect(0, y, GAME_WIDTH, 4);
  }
  g.fillStyle(0x4A5A6E, 1);
  g.fillRect(80, 60, 40, 160);
  g.fillRect(240, 120, 40, 160);
  g.fillRect(400, 40, 40, 160);
  g.fillRect(560, 100, 40, 160);

  rect(g, 0, 320, GAME_WIDTH, 180, c.ground);
  g.fillStyle(0x2a2a2a, 1);
  for (let y = 340; y < GAME_HEIGHT; y += 40) {
    g.fillRect(0, y, GAME_WIDTH, 4);
  }
  for (let x = 0; x < GAME_WIDTH; x += 80) {
    g.fillRect(x, 320, 4, 180);
  }

  for (let i = 0; i < 3; i++) {
    const fx = 160 + i * 160;
    const fy = 200;
    rect(g, fx, fy, 80, 120, c.fridge);
    rect(g, fx, fy + 52, 80, 4, 0xc0c0c0);
    rect(g, fx + 68, fy + 16, 4, 28, 0x8a8a8a);
    rect(g, fx + 68, fy + 64, 4, 28, 0x8a8a8a);
    rect(g, fx + 16, fy + 12, 48, 12, c.logo);
    rect(g, fx + 20, fy + 14, 40, 8, c.fridge);
  }

  g.fillStyle(0xd0d0d0, 1);
  const debrisMid = [
    [200, 340], [240, 348], [280, 336], [320, 344],
    [360, 340], [400, 348], [440, 336], [480, 344],
    [520, 340], [560, 348], [600, 336], [640, 344]
  ];
  for (const [dx, dy] of debrisMid) {
    g.fillRect(dx, dy, 8, 4);
  }
  g.fillStyle(0xb0b0b0, 1);
  const debrisMid2 = [
    [220, 356], [260, 352], [300, 360], [340, 356],
    [380, 352], [420, 360], [460, 356], [500, 352],
    [540, 360], [580, 356], [620, 352]
  ];
  for (const [dx, dy] of debrisMid2) {
    g.fillRect(dx, dy, 4, 4);
  }

  g.fillStyle(c.crowd, 1);
  for (let i = 0; i < 4; i++) {
    const px = 20 + i * 40;
    g.fillRect(px, 280, 24, 40);
    g.fillStyle(0xd0b090, 1);
    g.fillRect(px + 8, 268, 8, 12);
    g.fillStyle(c.crowd, 1);
  }
  for (let i = 0; i < 4; i++) {
    const px = 620 + i * 40;
    g.fillRect(px, 280, 24, 40);
    g.fillStyle(0xd0b090, 1);
    g.fillRect(px + 8, 268, 8, 12);
    g.fillStyle(c.crowd, 1);
  }

  rect(g, 80, 360, 560, 40, 0xb03030);
  rect(g, 76, 356, 568, 4, 0x0a0a0a);
  rect(g, 76, 400, 568, 4, 0x0a0a0a);
  rect(g, 76, 356, 4, 48, 0x0a0a0a);
  rect(g, 640, 356, 4, 48, 0x0a0a0a);
  rect(g, 80, 352, 4, 8, 0x5a5a5a);
  rect(g, 636, 352, 4, 8, 0x5a5a5a);
  g.fillStyle(0x1a1a1a, 1);
  for (let i = 0; i < 16; i++) {
    g.fillRect(96 + i * 32, 368, 24, 8);
  }
  for (let i = 0; i < 14; i++) {
    g.fillRect(112 + i * 32, 384, 24, 8);
  }

  rect(g, 40, 420, 24, 16, 0xe0e0e0);
  rect(g, 120, 440, 20, 12, 0xe0e0e0);
  rect(g, 240, 432, 28, 16, 0xe0e0e0);
  rect(g, 360, 448, 24, 12, 0xe0e0e0);
  rect(g, 480, 428, 20, 16, 0xe0e0e0);
  rect(g, 600, 444, 28, 12, 0xe0e0e0);
  rect(g, 720, 436, 24, 16, 0xe0e0e0);
  rect(g, 80, 460, 16, 12, 0xc0c0c0);
  rect(g, 200, 456, 20, 12, 0xc0c0c0);
  rect(g, 320, 464, 16, 8, 0xc0c0c0);
  rect(g, 440, 452, 20, 16, 0xc0c0c0);
  rect(g, 560, 460, 16, 12, 0xc0c0c0);
  rect(g, 680, 456, 20, 12, 0xc0c0c0);
  rect(g, 160, 480, 32, 20, 0xd8d8d8);
  rect(g, 400, 488, 28, 16, 0xd8d8d8);
  rect(g, 640, 484, 32, 20, 0xd8d8d8);
}
