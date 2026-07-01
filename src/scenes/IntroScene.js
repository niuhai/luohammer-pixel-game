import Phaser from 'phaser';
import { AudioSystem } from '../systems/AudioSystem.js';
import { SaveSystem } from '../systems/SaveSystem.js';
import { MetaProgression } from '../systems/MetaProgression.js';
import { GAME_WIDTH, GAME_HEIGHT } from '../config.js';

const LINES = [
  '人生总会有很多选择。',
  '在不同的路口，你会怎么选？',
  '你又会怎么想？'
];

/**
 * 开场动画场景：人生路口
 *
 * 简化版：只显示文字动画 + 简单背景，减少 Canvas 绘制复杂度
 * 避免高 DPI 设备上复杂 Graphics 导致的渲染问题
 */
export class IntroScene extends Phaser.Scene {
  constructor() { super('IntroScene'); }

  create() {
    const data = this.scene.settings.data || {};
    this._returnToBoot = data.returnToBoot === true;

    // 二周目起自动跳过开场（玩家主动"回顾开场"时不跳过）
    if (!this._returnToBoot) {
      try {
        const metaProgress = new MetaProgression();
        if (metaProgress.getPlayCount() > 0) {
          this.scene.start('GameScene', {});
          return;
        }
      } catch (e) {}
    }

    this.audio = new AudioSystem(this);

    const overlay = document.getElementById('ui-intro-overlay');
    const skipHint = document.getElementById('ui-intro-skip-hint');
    const fade = document.getElementById('ui-intro-fade');

    if (!overlay) {
      // 兜底：若 DOM 结构缺失，直接进入游戏
      this.scene.start('GameScene', {});
      return;
    }

    this._skipEnabled = false;
    this._finished = false;

    // 简单背景：纯色矩形 + 中心发光点
    this._bg = this.add.graphics();
    this._bg.fillStyle(0x0a0806, 1);
    this._bg.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // 中心发光圆
    this._centerX = GAME_WIDTH / 2;
    this._centerY = GAME_HEIGHT / 2 - 20;
    this._centerGfx = this.add.graphics();

    // 显示开场层
    overlay.classList.add('visible');
    if (fade) fade.classList.remove('active');
    if (skipHint) skipHint.classList.remove('visible');
    this._resetText();

    // 启动动画时间线
    this._scheduleTimeline(skipHint, fade);

    // 跳过逻辑
    this._setupSkip(overlay, skipHint, fade);

    // 场景关闭时清理
    this.events.on('shutdown', () => this._cleanup(overlay));
  }

  update() {
    if (this._finished) return;
    this._drawCenter();
  }

  /**
   * 绘制中心发光圆（简单的呼吸效果）
   */
  _drawCenter() {
    const gfx = this._centerGfx;
    gfx.clear();

    const breathe = 1.1 + Math.sin(Date.now() / 3000 * Math.PI * 2) * 0.1;
    const radius = 12 * breathe;

    // 外层光晕
    gfx.fillStyle(0xf0c040, 0.15);
    gfx.fillCircle(this._centerX, this._centerY, radius * 3);
    gfx.fillStyle(0xf0c040, 0.3);
    gfx.fillCircle(this._centerX, this._centerY, radius * 2);
    // 核心
    gfx.fillStyle(0xffe080, 0.6);
    gfx.fillCircle(this._centerX, this._centerY, radius);
  }

  _resetText() {
    const lineEls = [
      document.getElementById('ui-intro-line1'),
      document.getElementById('ui-intro-line2'),
      document.getElementById('ui-intro-line3')
    ];
    lineEls.forEach(el => {
      if (el) {
        el.classList.remove('visible');
        el.innerHTML = '';
      }
    });
  }

  _setupText(lineEl, text) {
    if (!lineEl) return;
    lineEl.innerHTML = '';
    text.split('').forEach(char => {
      const span = document.createElement('span');
      span.className = 'ui-intro-char';
      span.textContent = char;
      lineEl.appendChild(span);
    });
  }

  _revealChars(lineEl, duration = 1200) {
    if (!lineEl) return;
    const chars = lineEl.querySelectorAll('.ui-intro-char');
    if (chars.length === 0) return;
    const interval = duration / chars.length;
    lineEl.classList.add('visible');
    chars.forEach((char, i) => {
      this.time.delayedCall(i * interval, () => char.classList.add('revealed'));
    });
  }

  _scheduleTimeline(skipHint, fade) {
    const lineEls = [
      document.getElementById('ui-intro-line1'),
      document.getElementById('ui-intro-line2'),
      document.getElementById('ui-intro-line3')
    ];
    
    // 第一行文字立即显示
    this.time.delayedCall(0, () => {
      this._setupText(lineEls[0], LINES[0]);
      this._revealChars(lineEls[0], 600);
      if (this.audio) this.audio.speak(LINES[0], { force: true });
    });
    
    // 第二行
    this.time.delayedCall(900, () => {
      this._setupText(lineEls[1], LINES[1]);
      this._revealChars(lineEls[1], 600);
      if (this.audio) this.audio.speak(LINES[1], { force: true });
    });
    
    // 第三行
    this.time.delayedCall(1800, () => {
      this._setupText(lineEls[2], LINES[2]);
      this._revealChars(lineEls[2], 600);
      if (this.audio) this.audio.speak(LINES[2], { force: true });
    });

    // 0.5 秒后可跳过
    this.time.delayedCall(500, () => {
      this._skipEnabled = true;
      if (skipHint) skipHint.classList.add('visible');
    });

    // 2.5 秒后自然结束（比之前更短）
    this.time.delayedCall(2500, () => this._finish(fade));
  }

  _setupSkip(overlay, skipHint, fade) {
    const onPointer = () => this._finish(fade);
    const onKey = (e) => {
      if (e.code === 'Space') this._finish(fade);
    };

    overlay.addEventListener('pointerdown', onPointer);
    window.addEventListener('keydown', onKey);
    this._skipPointerHandler = onPointer;
    this._skipKeyHandler = onKey;
  }

  _finish(fade) {
    if (!this._skipEnabled || this._finished) return;
    this._finished = true;

    // 跳过/结束时立即停止语音播报
    if (this.audio) this.audio.stopSpeaking();

    // 标记开场动画已观看
    try {
      const save = new SaveSystem(this);
      save.markIntroSeen();
    } catch (e) {}

    const skipHint = document.getElementById('ui-intro-skip-hint');
    if (skipHint) skipHint.classList.remove('visible');
    if (fade) fade.classList.add('active');

    // 淡出后进入游戏或返回标题页
    this.time.delayedCall(800, () => {
      if (this._returnToBoot) {
        this.scene.start('BootScene');
      } else {
        this.scene.start('GameScene', {});
      }
    });
  }

  _cleanup(overlay) {
    if (this._skipPointerHandler && overlay) {
      overlay.removeEventListener('pointerdown', this._skipPointerHandler);
    }
    if (this._skipKeyHandler) {
      window.removeEventListener('keydown', this._skipKeyHandler);
    }
    if (overlay) overlay.classList.remove('visible');

    if (this.audio) {
      this.audio.destroy();
      this.audio = null;
    }
  }

  shutdown() {
    this._cleanup(document.getElementById('ui-intro-overlay'));
  }
}
