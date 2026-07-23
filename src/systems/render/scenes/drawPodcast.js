import { rect } from '../primitives.js';
import { COLORS, GAME_WIDTH } from '../../../config.js';

export function drawPodcast(g) {
  const c = COLORS.podcast;
  rect(g, 0, 0, GAME_WIDTH, 200, c.wall);
  rect(g, 0, 0, GAME_WIDTH, 100, 0x1a0a1e);

  g.fillStyle(0x2a1a2e, 1);
  for (let x = 40; x < GAME_WIDTH - 40; x += 40) {
    g.fillRect(x, 20, 20, 60);
    g.fillRect(x + 20, 40, 20, 60);
  }
  g.fillStyle(0x220a26, 1);
  for (let x = 60; x < GAME_WIDTH - 60; x += 80) {
    g.fillRect(x, 28, 24, 48);
    g.fillRect(x + 32, 52, 24, 48);
  }
  g.fillStyle(0x3a1a3e, 0.4);
  for (let x = 40; x < GAME_WIDTH - 40; x += 40) {
    g.fillRect(x, 20, 20, 3);
    g.fillRect(x + 20, 40, 20, 3);
  }

  rect(g, 0, 200, GAME_WIDTH, 100, c.floor);
  g.fillStyle(0x1a1a2e, 1);
  for (let y = 220; y < 300; y += 20) {
    g.fillRect(0, y, GAME_WIDTH, 1);
  }

  rect(g, 200, 180, 320, 40, c.desk);
  rect(g, 200, 180, 320, 4, 0x3a2a1a);

  rect(g, 300, 116, 36, 64, c.mic);
  rect(g, 296, 112, 44, 8, 0x6a6a7a);
  rect(g, 308, 124, 20, 4, 0x5a5a6a);
  rect(g, 316, 176, 4, 8, 0x7a7a8a);
  rect(g, 456, 120, 36, 60, c.mic);
  rect(g, 452, 116, 44, 8, 0x6a6a7a);
  rect(g, 464, 128, 20, 4, 0x5a5a6a);
  rect(g, 472, 176, 4, 8, 0x7a7a8a);

  rect(g, 376, 168, 24, 12, 0x4a4a5a);
  rect(g, 380, 172, 16, 4, 0x3a3a4a);
  rect(g, 376, 168, 4, 8, 0x5a5a6a);
  rect(g, 396, 168, 4, 8, 0x5a5a6a);

  rect(g, 240, 188, 56, 8, 0x2a2a3e);
  rect(g, 244, 190, 48, 4, 0x3a3a4e);
  rect(g, 500, 188, 40, 8, 0x4a4a5e);
  rect(g, 504, 190, 32, 4, 0x5a5a6e);

  rect(g, 0, 270, GAME_WIDTH, 8, 0x3a2a1a);
  rect(g, 0, 278, GAME_WIDTH, 4, 0x4a3a2a);
  rect(g, 80, 276, 72, 16, 0x22223e);
  rect(g, 84, 280, 64, 8, 0x33334e);
}
