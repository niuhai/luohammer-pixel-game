import { GAME_WIDTH, GAME_HEIGHT, COLORS, UI_COLORS, FONTS } from '../config.js';
import { PixelRenderer } from '../systems/PixelRenderer.js';

const CARD_X = 40;
const CARD_Y = GAME_HEIGHT - 170;
const CARD_W = GAME_WIDTH - 80;
const CARD_H = 50;
const CORNER_LEN = 8;
const CORNER_THICK = 2;

export class HistoryCard {
  constructor(scene) {
    this.scene = scene;
    this.container = scene.add.container(0, 0).setDepth(500).setVisible(false);

    this.bg = scene.add.graphics();
    this.container.add(this.bg);

    // 像素风卷轴图标（8×12）
    this.scrollIcon = scene.add.graphics();
    this._drawScrollIcon(this.scrollIcon, 48, CARD_Y + 4);
    this.container.add(this.scrollIcon);

    this.text = scene.add.text(64, CARD_Y + 2, '', {
      fontSize: '12px', fontFamily: FONTS.body, color: PixelRenderer.toCSS(COLORS.border),
      wordWrap: { width: CARD_W - 40 }
    });
    this.container.add(this.text);

    this.hint = scene.add.text(GAME_WIDTH - 30, CARD_Y + CARD_H - 8, '点击继续 ▶', {
      fontSize: '8px', fontFamily: FONTS.pixel, color: PixelRenderer.toCSS(COLORS.accent)
    }).setOrigin(1, 1);
    this.hint.setVisible(false);
    this.container.add(this.hint);

    this.clickZone = scene.add.zone(
      GAME_WIDTH / 2, CARD_Y + CARD_H / 2,
      CARD_W, CARD_H
    ).setInteractive({ useHandCursor: true });
    this.container.add(this.clickZone);

    // 滚动相关
    this.scrollTween = null;
    this.originalTextY = CARD_Y + 2;

    this._drawBg(false);
  }

  _drawCorners(g, x, y, w, h) {
    PixelRenderer.drawCornerDecor(g, x, y, w, h, UI_COLORS.cornerDecor, 8, 2);
  }

  _drawScrollIcon(g, x, y) {
    g.clear();
    // 金色边框
    g.fillStyle(COLORS.accent, 1);
    g.fillRect(x, y, 8, 2);
    g.fillRect(x, y + 10, 8, 2);
    g.fillRect(x, y, 2, 12);
    g.fillRect(x + 6, y, 2, 12);
    // 米色内容
    g.fillStyle(0xf5e6c8, 1);
    g.fillRect(x + 2, y + 2, 4, 8);
    // 卷轴横线
    g.fillStyle(0xc09030, 1);
    g.fillRect(x + 3, y + 4, 2, 1);
    g.fillRect(x + 3, y + 6, 2, 1);
  }

  _drawBg(hover) {
    this.bg.clear();
    this.bg.fillStyle(hover ? 0x1a3a5c : 0x1a1a2e, 0.98);
    this.bg.fillRect(CARD_X, CARD_Y, CARD_W, CARD_H);
    this.bg.lineStyle(hover ? 3 : 2, COLORS.accent);
    this.bg.strokeRect(CARD_X, CARD_Y, CARD_W, CARD_H);
    // 像素风边角装饰
    this._drawCorners(this.bg, CARD_X, CARD_Y, CARD_W, CARD_H);
  }

  show(historyNote, onContinue) {
    this.text.setText(historyNote || '');
    this.text.setY(this.originalTextY);
    this.hint.setVisible(false);

    // 出现动画：alpha 0→1, y +20 → 原位
    this.container.setAlpha(0);
    this.container.setY(20);
    this.container.setVisible(true);
    this._drawBg(false);

    this.scene.tweens.add({
      targets: this.container,
      alpha: 1,
      y: 0,
      duration: 200,
      ease: 'Cubic.Out',
      onComplete: () => {
        // 检查文本是否超出卡片高度，若超出则自动滚动
        const textHeight = this.text.height;
        const maxVisibleHeight = CARD_H - 4;

        if (textHeight > maxVisibleHeight) {
          const scrollDistance = textHeight - maxVisibleHeight;
          this.scrollTween = this.scene.tweens.add({
            targets: this.text,
            y: this.originalTextY - scrollDistance,
            duration: scrollDistance * 50,
            ease: 'Linear',
            onComplete: () => {
              this.hint.setVisible(true);
            }
          });
        } else {
          this.hint.setVisible(true);
        }
      }
    });

    this.clickZone.removeAllListeners();
    this.clickZone.on('pointerover', () => this._drawBg(true));
    this.clickZone.on('pointerout', () => this._drawBg(false));
    this.clickZone.once('pointerup', () => {
      // 停止滚动动画
      if (this.scrollTween) {
        this.scene.tweens.killTweensOf(this.text);
        this.scrollTween = null;
      }
      this.container.setVisible(false);
      this.container.setAlpha(1);
      this.container.setY(0);
      if (onContinue) onContinue();
    });
  }

  hide() {
    if (this.scrollTween) {
      this.scene.tweens.killTweensOf(this.text);
      this.scrollTween = null;
    }
    this.container.setVisible(false);
    this.container.setAlpha(1);
    this.container.setY(0);
    this.clickZone.removeAllListeners();
  }

  /**
   * 销毁资源，防止内存泄漏
   */
  destroy() {
    if (this.scrollTween) {
      this.scene.tweens.killTweensOf(this.text);
      this.scrollTween = null;
    }
    if (this.clickZone) {
      this.clickZone.removeAllListeners();
    }
    if (this.container) {
      this.container.destroy(true);
      this.container = null;
    }
    this.scene = null;
  }
}
