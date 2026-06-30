import { GRID, GAME_WIDTH, GAME_HEIGHT } from '../../config.js';

/**
 * 对齐到像素网格 (GRID = 4)。所有绘制坐标/尺寸必须走这里，
 * 杜绝 1px / 3px 这种无法在像素风格下干净显示的尺寸。
 */
export function px(n) {
  if (Number.isNaN(n)) return 0;
  return Math.round(n / GRID) * GRID;
}

/** 对齐到网格后调用 fillRect。 */
export function rect(g, x, y, w, h, color, alpha = 1) {
  g.fillStyle(color, alpha);
  g.fillRect(px(x), px(y), Math.max(GRID, px(w)), Math.max(GRID, px(h)));
}

/** 画一个像素风格的"盒子"（带顶部高光、侧面阴影）。 */
export function box(g, x, y, w, h, { top, side, fill, outline = 0x0a0a0a } = {}) {
  if (fill) rect(g, x, y, w, h, fill);
  if (top) rect(g, x, y, w, GRID, top);
  if (side) {
    rect(g, x, y + h - GRID, w, GRID, side);
    rect(g, x + w - GRID, y, GRID, h, side);
  }
  if (outline) {
    rect(g, x, y, w, GRID, outline);
    rect(g, x, y + h - GRID, w, GRID, outline);
    rect(g, x, y, GRID, h, outline);
    rect(g, x + w - GRID, y, GRID, h, outline);
  }
}

/** 像素风格的进度条外壳。 */
export function barShell(g, x, y, w, h, color) {
  rect(g, x, y, w, h, 0x1a1a2e);
  rect(g, x, y, w, GRID, 0x4a4a5e);
  rect(g, x, y + h - GRID, w, GRID, 0x4a4a5e);
  rect(g, x, y, GRID, h, 0x4a4a5e);
  rect(g, x + w - GRID, y, GRID, h, 0x4a4a5e);
  const inner = Math.max(0, (w - GRID * 2) * Math.min(1, Math.max(0, color.progress)));
  rect(g, x + GRID, y + GRID, inner, h - GRID * 2, color.color);
}

/** 小像素人物（用于 NPC / 迷你头像）。 */
export function miniFigure(g, cx, baseY, skin, hair, shirt, bounce = 0) {
  const y = baseY + bounce;
  rect(g, cx - 8, y - 28, 16, 8, hair);
  rect(g, cx - 10, y - 20, 20, 20, skin);
  rect(g, cx - 6, y - 14, 4, 2, 0x1a1a1a);
  rect(g, cx + 2, y - 14, 4, 2, 0x1a1a1a);
  rect(g, cx - 12, y, 24, 28, shirt);
  rect(g, cx - 12, y, 24, GRID, 0x0a0a0a);
}

/** CRT 扫描线叠加。画在已有背景之上，制造复古显示器质感。 */
export function scanlines(g, alpha = 0.08) {
  g.fillStyle(0x000000, alpha);
  for (let y = 0; y < GAME_HEIGHT; y += GRID * 2) {
    g.fillRect(0, y, GAME_WIDTH, GRID);
  }
}

/** 16 进制 → CSS 字符串（供 Phaser Text 使用）。 */
export function toCSS(hex) {
  return '#' + hex.toString(16).padStart(6, '0');
}

/** 画金色 L 形角装饰。 */
export function drawCornerDecor(g, x, y, w, h, color = 0xf0c040, size = 8, thickness = 2) {
  const s = size;
  const t = thickness;
  g.fillStyle(color, 1);
  g.fillRect(x, y, s, t);
  g.fillRect(x, y, t, s);
  g.fillRect(x + w - s, y, s, t);
  g.fillRect(x + w - t, y, t, s);
  g.fillRect(x, y + h - s, s, t);
  g.fillRect(x, y + h - t, t, s);
  g.fillRect(x + w - s, y + h - s, s, t);
  g.fillRect(x + w - t, y + h - s, t, s);
}
