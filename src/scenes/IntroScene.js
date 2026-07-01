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
 * 用「人生地图节点」意象点出教育意义——选择塑造人生。
 * 由 BootScene 在点击"开始游戏"/"新游戏"后启动，1.5 秒后可点击/空格跳过。
 *
 * 绘制全部走 Phaser Graphics API（统一渲染管线），DOM 仅保留文字层与跳过提示。
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
    this._roadStartTime = Date.now();
    this._lastRippleWave = 0;

    // 背景填充（与 DOM overlay 的 radial-gradient 底色一致）
    this._bg = this.add.graphics();
    this._bg.fillStyle(0x0a0806, 1);
    this._bg.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // 主绘制层：路径、波纹、中心节点
    this._gfx = this.add.graphics();

    // 显示开场层
    overlay.classList.add('visible');
    if (fade) fade.classList.remove('active');
    if (skipHint) skipHint.classList.remove('visible');
    this._resetText();

    // 6 条人生路径，呈扇形辐射
    const baseAngles = [-1.2, -0.6, -0.2, 0.2, 0.6, 1.2];
    this._roads = baseAngles.map((offset, i) => ({
      angle: -Math.PI / 2 + offset,
      progress: 0,
      end: 0,
      delay: 1200 + i * 350,
      speed: 0.0016 + Math.random() * 0.0006,
      // 流光粒子
      particles: Array.from({ length: 2 }, () => ({
        t: Math.random(),
        speed: 0.003 + Math.random() * 0.002
      }))
    }));

    // 中心波纹（定期扩散）
    this._ripples = [];

    // 启动动画时间线
    this._scheduleTimeline(skipHint, fade);

    // 跳过逻辑
    this._setupSkip(overlay, skipHint, fade);

    // 场景关闭时清理
    this.events.on('shutdown', () => this._cleanup(overlay));
  }

  /**
   * Phaser 每帧更新：替代原 requestAnimationFrame 循环。
   * 清空 graphics 并重绘所有元素。
   */
  update() {
    if (this._finished) return;
    this._updateRoads();
    this._updateRipples();
    this._draw();
  }

  _draw() {
    const gfx = this._gfx;
    gfx.clear();

    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2 - 20;
    const nodeProgress = Math.min(1, (Date.now() - this._roadStartTime) / 1200);

    // 绘制波纹（在路径之下）
    this._drawRipples(gfx, cx, cy);
    // 中心节点
    this._drawCenterNode(gfx, cx, cy, nodeProgress);
    // 6 条路径
    this._roads.forEach(road => this._drawRoad(gfx, cx, cy, road));
  }

  _drawRipples(gfx, cx, cy) {
    if (!this._ripples) return;
    const maxR = Math.min(GAME_WIDTH, GAME_HEIGHT) * 0.4;
    this._ripples.forEach(r => {
      const radius = r.progress * maxR;
      const alpha = (1 - r.progress) * 0.15;
      gfx.lineStyle(1.5, 0xf0c040, alpha);
      gfx.strokeCircle(cx, cy, radius);
    });
  }

  _drawCenterNode(gfx, cx, cy, progress) {
    const baseRadius = 8 + progress * 3;
    // 呼吸缩放（模拟原 DOM uiIntroNodeBreathe 动画：1.0 ~ 1.2，周期 3s）
    const breathe = 1.1 + Math.sin(Date.now() / 3000 * Math.PI * 2) * 0.1;
    const radius = baseRadius * breathe;

    // 外层光晕：用多层同心圆模拟原 radialGradient + shadowBlur
    gfx.fillStyle(0xf0c040, (0.15 + progress * 0.1) * 0.35);
    gfx.fillCircle(cx, cy, radius * 3);
    gfx.fillStyle(0xf0c040, (0.15 + progress * 0.1) * 0.6);
    gfx.fillCircle(cx, cy, radius * 2.2);
    gfx.fillStyle(0xffd866, (0.4 + progress * 0.3) * 0.5);
    gfx.fillCircle(cx, cy, radius * 1.5);

    // 核心
    gfx.fillStyle(0xffe080, 0.4 + progress * 0.6);
    gfx.fillCircle(cx, cy, radius);

    // 脉冲环
    const pulseR = baseRadius + 5 + Math.sin(Date.now() / 400) * 3;
    gfx.lineStyle(2, 0xf0c040, 0.12 + progress * 0.18);
    gfx.strokeCircle(cx, cy, pulseR);
  }

  _drawRoad(gfx, cx, cy, road) {
    const length = Math.min(GAME_WIDTH, GAME_HEIGHT) * 0.34;
    const endX = cx + Math.cos(road.angle) * length;
    const endY = cy + Math.sin(road.angle) * length;

    // 主路径线：用多段线条模拟原线性渐变
    // 原渐变 stops: t=0→0.5, t=0.7→0.2, t=1→0
    const segments = 8;
    for (let i = 0; i < segments; i++) {
      const t0 = i / segments;
      const t1 = (i + 1) / segments;
      const avgA = (this._pathAlpha(t0) + this._pathAlpha(t1)) / 2;
      const x0 = cx + Math.cos(road.angle) * length * t0 * road.progress;
      const y0 = cy + Math.sin(road.angle) * length * t0 * road.progress;
      const x1 = cx + Math.cos(road.angle) * length * t1 * road.progress;
      const y1 = cy + Math.sin(road.angle) * length * t1 * road.progress;
      gfx.lineStyle(2.5, 0xf0c040, avgA);
      gfx.lineBetween(x0, y0, x1, y1);
    }

    // 流光粒子
    road.particles.forEach(p => {
      if (road.progress < 0.1) return;
      const px = cx + Math.cos(road.angle) * length * p.t * road.progress;
      const py = cy + Math.sin(road.angle) * length * p.t * road.progress;
      const fade = 1 - p.t * 0.7;
      // 用大圆 + 小圆模拟原 shadowBlur 发光
      gfx.fillStyle(0xf0c040, fade * 0.3);
      gfx.fillCircle(px, py, 5);
      gfx.fillStyle(0xffe080, fade * 0.8);
      gfx.fillCircle(px, py, 2.5);
    });

    // 末端脉冲圆环
    if (road.end > 0) {
      const pulseScale = 1 + Math.sin(Date.now() / 600 + road.angle) * 0.15;
      // 外环
      gfx.lineStyle(1.5, 0xf0c040, road.end * 0.4);
      gfx.strokeCircle(endX, endY, 6 * road.end * pulseScale);
      // 核心发光（模拟原 shadowBlur）
      gfx.fillStyle(0xf0c040, road.end * 0.3);
      gfx.fillCircle(endX, endY, 7 * road.end);
      gfx.fillStyle(0xffe080, road.end);
      gfx.fillCircle(endX, endY, 3.5 * road.end);
    }
  }

  /**
   * 原线性渐变 alpha 曲线：t=0→0.5, t=0.7→0.2, t=1→0
   */
  _pathAlpha(t) {
    if (t < 0.7) {
      return 0.5 - 0.3 * (t / 0.7);
    }
    return 0.2 * (1 - (t - 0.7) / 0.3);
  }

  _updateRoads() {
    const now = Date.now();
    const t = now - this._roadStartTime;
    this._roads.forEach(road => {
      if (t > road.delay && road.progress < 1) {
        road.progress = Math.min(1, road.progress + road.speed * 16);
      }
      if (t > road.delay + 900 && road.end < 1) {
        road.end = Math.min(1, road.end + 0.02);
      }
      // 更新流光粒子
      road.particles.forEach(p => {
        p.t += p.speed;
        if (p.t > 1) p.t -= 1;
      });
    });
  }

  _updateRipples() {
    const t = Date.now() - this._roadStartTime;
    // 每 2 秒发射一个波纹
    if (t > 800 && Math.floor(t / 2000) > this._lastRippleWave) {
      this._lastRippleWave = Math.floor(t / 2000);
      this._ripples.push({ progress: 0, startTime: Date.now() });
    }
    // 更新波纹
    this._ripples = this._ripples.filter(r => {
      r.progress = (Date.now() - r.startTime) / 2500;
      return r.progress < 1;
    });
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
    // 三行文字 —— 首句0ms出现，后续1s间隔，总时长压缩到3.5s
    const lineEls = [
      document.getElementById('ui-intro-line1'),
      document.getElementById('ui-intro-line2'),
      document.getElementById('ui-intro-line3')
    ];
    this.time.delayedCall(0, () => {
      this._setupText(lineEls[0], LINES[0]);
      this._revealChars(lineEls[0], 600);
      // 同步语音播报（force=true，无视 narration 开关）
      if (this.audio) this.audio.speak(LINES[0], { force: true });
    });
    this.time.delayedCall(1000, () => {
      this._setupText(lineEls[1], LINES[1]);
      this._revealChars(lineEls[1], 600);
      if (this.audio) this.audio.speak(LINES[1], { force: true });
    });
    this.time.delayedCall(2000, () => {
      this._setupText(lineEls[2], LINES[2]);
      this._revealChars(lineEls[2], 600);
      if (this.audio) this.audio.speak(LINES[2], { force: true });
    });

    // 0.6 秒后可跳过
    this.time.delayedCall(600, () => {
      this._skipEnabled = true;
      if (skipHint) skipHint.classList.add('visible');
    });

    // 3.5 秒后自然结束
    this.time.delayedCall(3500, () => this._finish(fade));
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
    this.time.delayedCall(1200, () => {
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
