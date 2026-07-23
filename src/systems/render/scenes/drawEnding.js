import { rect } from '../primitives.js';
import { COLORS, GAME_WIDTH, GAME_HEIGHT } from '../../../config.js';

export function drawEnding(g) {
  const c = COLORS.ending;
  rect(g, 0, 0, GAME_WIDTH, GAME_HEIGHT, c.bg);
  g.fillStyle(c.glow, 0.1);
  for (let i = 0; i < 10; i++) {
    const angle = (i / 10) * Math.PI * 2;
    const x = 360 + Math.cos(angle) * 200;
    const y = 150 + Math.sin(angle) * 200;
    g.fillRect(360, 150, x - 360, y - 150);
  }
  g.fillStyle(c.glow, 0.3);
  g.fillRect(260, 50, 200, 200);
  g.fillStyle(c.glow, 0.5);
  g.fillRect(300, 90, 120, 120);
  g.fillStyle(c.glow, 0.7);
  g.fillRect(330, 120, 60, 60);
}
