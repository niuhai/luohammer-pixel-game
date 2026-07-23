import { rect } from '../primitives.js';
import { COLORS, GAME_WIDTH } from '../../../config.js';

export function drawStreet(g) {
  const c = COLORS.street;
  rect(g, 0, 0, GAME_WIDTH, 200, c.sky);
  rect(g, 0, 0, GAME_WIDTH, 100, 0x1a1a2e);

  g.fillStyle(0xffffff, 0.7);
  const starPositions = [
    [60,20],[140,36],[220,16],[300,44],[380,24],
    [460,40],[540,20],[620,32],[700,16],[760,38],
    [100,56],[180,48],[260,60],[340,52],[420,64],
    [500,48],[580,56],[660,44],[740,56],
    [80,76],[200,72],[360,80],[520,68],[680,76]
  ];
  for (const [sx, sy] of starPositions) {
    g.fillRect(sx, sy, 2, 2);
  }
  rect(g, 680, 28, 32, 32, 0xf0e8a0);
  rect(g, 696, 28, 16, 32, c.sky);

  rect(g, 40, 60, 120, 140, c.building);
  rect(g, 200, 40, 160, 160, c.building);
  rect(g, 400, 80, 100, 120, c.building);
  rect(g, 540, 50, 140, 150, c.building);
  g.fillStyle(0xf0c040, 0.3);
  for (let x = 50; x < 150; x += 20) {
    for (let y = 70; y < 180; y += 20) {
      if (Math.random() > 0.5) g.fillRect(x, y, 8, 8);
    }
  }
  for (let x = 210; x < 350; x += 20) {
    for (let y = 50; y < 180; y += 20) {
      if (Math.random() > 0.5) g.fillRect(x, y, 8, 8);
    }
  }

  g.fillStyle(0xe04080, 0.35);
  g.fillRect(52, 88, 80, 24);
  g.fillStyle(0xe05090, 0.6);
  g.fillRect(56, 92, 72, 16);
  g.fillStyle(0xff60a0, 0.8);
  g.fillRect(60, 96, 64, 8);
  g.fillStyle(0xffc0e0, 0.5);
  for (let i = 0; i < 5; i++) {
    g.fillRect(64 + i * 12, 98, 8, 2);
  }
  g.fillStyle(0xe04080, 0.12);
  g.fillRect(44, 80, 96, 44);

  g.fillStyle(0xc03030, 0.35);
  g.fillRect(560, 70, 96, 28);
  g.fillStyle(0xd04040, 0.55);
  g.fillRect(564, 74, 88, 20);
  g.fillStyle(0xff5050, 0.75);
  g.fillRect(568, 78, 80, 12);
  g.fillStyle(0xffa0a0, 0.45);
  for (let i = 0; i < 6; i++) {
    g.fillRect(572 + i * 12, 82, 10, 2);
  }
  g.fillStyle(0xc03030, 0.10);
  g.fillRect(550, 62, 116, 48);

  rect(g, 0, 200, GAME_WIDTH, 100, c.ground);
  for (let x = 0; x < GAME_WIDTH; x += 60) {
    rect(g, x, 240, 30, 4, COLORS.street.highlight);
  }

  rect(g, 300, 120, 80, 40, c.sign);
  rect(g, 304, 124, 72, 32, 0x0a0a1a);
  rect(g, 340, 160, 4, 40, c.sign);

  rect(g, 48, 140, 12, 240, 0x3a3a4a);
  rect(g, 48, 140, 12, 4, 0x2a2a3a);
  rect(g, 50, 376, 8, 4, 0x2a2a3a);
  rect(g, 44, 136, 20, 6, 0x3a3a4a);
  rect(g, 40, 124, 28, 14, 0x4a4a5a);
  rect(g, 44, 128, 20, 6, 0x5a5a6a);
  g.fillStyle(0xf0d080, 0.25);
  g.fillRect(32, 120, 44, 22);
  g.fillStyle(0xf0e8a0, 0.15);
  g.fillRect(24, 112, 60, 38);
  g.fillStyle(0xf8f0c0, 0.08);
  g.fillRect(16, 104, 76, 54);
  g.fillStyle(0xf0d080, 0.06);
  g.fillRect(44, 144, 20, 160);

  rect(g, 732, 180, 8, 180, 0x3a3a4a);
  rect(g, 728, 172, 16, 10, 0x4a4a5a);
  g.fillStyle(0xf0d080, 0.15);
  g.fillRect(720, 168, 32, 18);
}
