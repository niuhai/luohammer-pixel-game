import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config.js';
import { TALENTS } from '../data/talents.js';
import {
  drawClassroom,
  drawOffice,
  drawStage,
  drawLivestream,
  drawLab,
  drawPodcast,
  drawStreet,
  drawFridgeSmash,
  drawTalkshow,
  drawCourt,
  drawEnding,
  drawCharacter as drawCharacterFallback
} from './render/scenes/index.js';

// ---- 粒子对象池 ----
// 预分配粒子对象，避免频繁 new / GC
// 使用 free list（空闲索引栈）替代线性扫描，O(1) 获取/归还
const POOL_SIZE = 200;
const particlePool = [];
const freeList = []; // 空闲索引栈，O(1) push/pop

function initPool() {
  for (let i = 0; i < POOL_SIZE; i++) {
    particlePool.push({
      _idx: i, // 池索引，用于 O(1) 归还
      x: 0, y: 0, color: 0, size: 2, life: 0, maxLife: 1,
      vx: 0, vy: 0, gravity: 200, active: false, type: 'default'
    });
    freeList.push(i); // 初始全部空闲
  }
}
initPool();

// 归还粒子到池（O(1)，通过 _idx 直接定位）
function releaseParticle(p) {
  p.active = false;
  freeList.push(p._idx);
}

// ---- 背景粒子配置 ----
const BG_PARTICLE_COUNT = 40;

const BG_PARTICLE_MIN_SIZE = 1;
const BG_PARTICLE_MAX_SIZE = 5;
const BG_PARTICLE_MIN_SPEED = 8;
const BG_PARTICLE_MAX_SPEED = 25;

// ---- 场景环境粒子模式 ----
// 让粒子随场景氛围变化：办公室慢尘、雨夜雨丝、舞台光尘、直播间弹幕式横漂
// move: 运动方向 up/down/side；speedMul: 速度倍率；color: 粒子颜色；
// alphaMul: 透明度倍率；streak: 是否画成竖条（雨丝）
const PARTICLE_MODES = {
  dust:        { move: 'up',   speedMul: 1.0,  color: 0xf0c040, alphaMul: 1.0,  streak: false },
  dust_dim:    { move: 'up',   speedMul: 0.45, color: 0x7a8aaa, alphaMul: 0.55, streak: false },
  dust_bright: { move: 'up',   speedMul: 1.2,  color: 0xffe8b0, alphaMul: 1.25, streak: false },
  rain:        { move: 'down', speedMul: 14,   color: 0x7fb8e8, alphaMul: 0.75, streak: true },
  float_side:  { move: 'side', speedMul: 3.2,  color: 0x88ccff, alphaMul: 0.9,  streak: false },
  sparkle:     { move: 'up',   speedMul: 0.7,  color: 0xffd870, alphaMul: 1.35, streak: false }
};

// 场景类型 → 粒子模式映射
const SCENE_PARTICLE_MODES = {
  classroom: 'dust', lecture: 'dust', podcast: 'dust', ending: 'sparkle',
  office: 'dust_dim', office_empty: 'dust_dim', lab: 'dust_dim', court: 'dust_dim',
  street: 'dust_dim', street_night: 'dust_dim',
  office_busy: 'dust_bright', street_day: 'dust_bright',
  office_dark: 'rain',
  stage: 'sparkle', stage_arena: 'sparkle', talkshow: 'sparkle', fridge_smash: 'sparkle',
  livestream: 'float_side', livestream_first: 'float_side'
};

export class PixelRenderer {
  constructor(scene) {
    this.scene = scene;
    this.bgGraphics = scene.add.graphics();
    this.fgGraphics = scene.add.graphics();
    this.uiGraphics = scene.add.graphics();
    this.bgGraphics.setDepth(0);
    this.fgGraphics.setDepth(100);
    this.uiGraphics.setDepth(200);
    this.particles = [];
    this.shakeIntensity = 0;
    this.flashAlpha = 0;
    this._wasShaking = false;
    this._particleGfxDirty = false;
    this.currentBg = null;
    this.bgSprite = null;
    this.charSprite = null;
    this.currentPose = null;
    this._particleMode = 'dust'; // 当前环境粒子模式
    this._bgFadeTween = null;    // 背景淡入动画

    // ---- 背景漂浮粒子 ----
    this.bgParticles = [];
    this._initBgParticles();

    // ---- 缓存背景粒子透明度分组对象，避免每帧 new ----
    // 预分配 26 个桶（0~25 对应 0%~100%），避免动态创建数组
    this._bgAlphaBuckets = new Array(26);
    for (let i = 0; i < 26; i++) this._bgAlphaBuckets[i] = [];

    // ---- 粒子 Graphics 层（背景粒子绘制在 fg 之下） ----
    this.bgParticleGfx = scene.add.graphics();
    this.bgParticleGfx.setDepth(5);

    // ---- 前景粒子 Graphics 层（粒子+闪光绘制在角色之上，不覆盖 fgGraphics 的角色 fallback） ----
    this.particleGfx = scene.add.graphics();
    this.particleGfx.setDepth(110);

    // ---- 角色脚下阴影 Graphics 层（depth 49，位于 charSprite 50 之下） ----
    this.shadowGfx = scene.add.graphics();
    this.shadowGfx.setDepth(49);

    // ---- 背景粒子鼠标视差 ----
    this._parallaxTargetX = 0;
    this._parallaxTargetY = 0;
    this._parallaxCurrentX = 0;
    this._parallaxCurrentY = 0;
    this._parallaxHandler = (pointer) => {
      this._parallaxTargetX = pointer.x - GAME_WIDTH / 2;
      this._parallaxTargetY = pointer.y - GAME_HEIGHT / 2;
    };
    this.scene.input.on('pointermove', this._parallaxHandler);
  }

  /**
   * 初始化背景漂浮粒子（40个金色微粒缓慢飘动）
   */
  _initBgParticles() {
    this.bgParticles = [];
    for (let i = 0; i < BG_PARTICLE_COUNT; i++) {
      this.bgParticles.push(this._createBgParticle());
    }
  }

  /**
   * 切换环境粒子模式（场景氛围），见 PARTICLE_MODES / SCENE_PARTICLE_MODES
   * @param {string} mode dust/dust_dim/dust_bright/rain/float_side/sparkle
   */
  setParticleMode(mode) {
    if (!PARTICLE_MODES[mode] || this._particleMode === mode) return;
    this._particleMode = mode;
  }

  /**
   * 场景切换时背景淡入，避免硬切造成视觉跳跃。
   * 快速连续切换时停止旧动画，防止 tween 叠加。
   */
  _fadeInBackground() {
    if (!this.bgSprite) return;
    if (this._bgFadeTween) this._bgFadeTween.stop();
    this.bgSprite.setAlpha(0);
    this._bgFadeTween = this.scene.tweens.add({
      targets: this.bgSprite,
      alpha: 1,
      duration: 350,
      ease: 'Sine.easeOut'
    });
  }

  _createBgParticle(fromBottom = false) {
    const size = BG_PARTICLE_MIN_SIZE + Math.random() * (BG_PARTICLE_MAX_SIZE - BG_PARTICLE_MIN_SIZE);
    const speed = BG_PARTICLE_MIN_SPEED + Math.random() * (BG_PARTICLE_MAX_SPEED - BG_PARTICLE_MIN_SPEED);
    return {
      x: Math.random() * GAME_WIDTH,
      y: fromBottom ? GAME_HEIGHT + size : Math.random() * GAME_HEIGHT,
      size: size,
      speed: speed,
      alpha: 0.15 + Math.random() * 0.35,
      // 水平漂移
      drift: (Math.random() - 0.5) * 12,
      // 闪烁相位
      phase: Math.random() * Math.PI * 2,
      twinkleSpeed: 0.5 + Math.random() * 2,
      // 缓存当前透明度，避免每帧计算
      _currentAlpha: 0
    };
  }

  /**
   * 重置背景粒子到初始位置（避免 new 对象）
   */
  _resetBgParticle(bp, fromBottom = false) {
    bp.x = Math.random() * GAME_WIDTH;
    bp.y = fromBottom ? GAME_HEIGHT + bp.size : Math.random() * GAME_HEIGHT;
    bp.size = BG_PARTICLE_MIN_SIZE + Math.random() * (BG_PARTICLE_MAX_SIZE - BG_PARTICLE_MIN_SIZE);
    bp.speed = BG_PARTICLE_MIN_SPEED + Math.random() * (BG_PARTICLE_MAX_SPEED - BG_PARTICLE_MIN_SPEED);
    bp.alpha = 0.15 + Math.random() * 0.35;
    bp.drift = (Math.random() - 0.5) * 12;
    bp.phase = Math.random() * Math.PI * 2;
    bp.twinkleSpeed = 0.5 + Math.random() * 2;
    bp._currentAlpha = 0;
  }

  static toCSS(hex) {
    return '#' + hex.toString(16).padStart(6, '0');
  }

  static drawCornerDecor(g, x, y, w, h, color, size, thickness) {
    const s = size;
    const t = thickness || 2;
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

  /**
   * 渲染分享卡到 Canvas（600x900 竖版海报）
   * @param {object} state - 游戏状态
   * @param {object} ending - 结局数据
   * @returns {HTMLCanvasElement} 渲染完成的 Canvas
   */
  static renderShareCard(state, ending, meta = {}) {
    const W = 600;
    const H = 900;
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');

    // === 氛围色系统：根据结局类型选择主色调 ===
    const endingKey = meta.endingKey || 'default';
    const THEME = {
      legend: '#f0c040', idealist: '#f0c040', craftsman: '#f0c040', returns: '#f0c040',
      warrior: '#ff6b3d', phoenix: '#ff6b3d', comeback: '#ff6b3d', survivor: '#ff6b3d',
      tycoon: '#40c060', anchor: '#40c060', venture_capitalist: '#40c060',
      balance: '#4090e0', peace: '#4090e0', moderate_success: '#4090e0',
      monk: '#8040c0', hermit: '#8040c0',
      educator: '#40c8c8', writer: '#40c8c8', mentor: '#40c8c8', philanthropist: '#40c8c8',
      talkshow_star: '#ff6b9d', influencer: '#ff6b9d', tech_blogger: '#ff6b9d',
      rights_fighter: '#e04040', rational: '#e04040',
      scapegoat: '#c06060', bankrupt_early: '#c06060', escape: '#c06060', supply_chain: '#c06060',
      ordinary: '#9a8a6a', scholar: '#9a8a6a', comfort: '#9a8a6a', retreat: '#9a8a6a', xiaomi: '#9a8a6a', ai_visionary: '#9a8a6a',
      default: '#f0c040'
    };
    const accentColor = THEME[endingKey] || THEME.default;

    const hexToRgba = (hex, alpha) => {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
    };

    const dimColor = '#b3a789';
    const gridColor = '#1a1a2e';
    const bgColor = '#0a0a1a';
    const fontFamily = '"Microsoft YaHei", "PingFang SC", sans-serif';

    const roundRect = (x, y, w, h, r) => {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + w - r, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + r);
      ctx.lineTo(x + w, y + h - r);
      ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      ctx.lineTo(x + r, y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - r);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.closePath();
    };

    // === 背景 ===
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, W, H);

    // 顶部氛围色渐变光晕
    const topGlow = ctx.createRadialGradient(W / 2, 120, 20, W / 2, 120, 350);
    topGlow.addColorStop(0, hexToRgba(accentColor, 0.12));
    topGlow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = topGlow;
    ctx.fillRect(0, 0, W, 400);

    // 像素网格纹理
    ctx.fillStyle = hexToRgba(accentColor, 0.02);
    for (let x = 0; x < W; x += 4) {
      for (let y = 0; y < H; y += 4) {
        if ((x + y) % 8 === 0) {
          ctx.fillRect(x, y, 2, 2);
        }
      }
    }

    // === 顶部品牌区 (0-70) ===
    ctx.fillStyle = dimColor;
    ctx.font = '13px ' + fontFamily;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('真还传 · 人生模拟', W / 2, 35);

    ctx.fillStyle = accentColor;
    ctx.fillRect(W / 2 - 80, 55, 160, 1);
    ctx.fillRect(W / 2 - 40, 59, 80, 1);

    // === 结局标题区 (70-200) ===
    const endingIdx = meta.endingIndex || 0;
    const totalEndings = meta.totalEndings || 35;
    if (endingIdx > 0) {
      ctx.fillStyle = dimColor;
      ctx.font = '11px ' + fontFamily;
      ctx.fillText('ENDING ' + String(endingIdx).padStart(2, '0') + ' / ' + totalEndings, W / 2, 88);
    }

    const titleText = (ending.title || '结局').replace(/罗远/g, '老罗');
    ctx.fillStyle = accentColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    // 智能标题排版：优先单行显示，超出则逐级缩小字号；
    // 仍超限时按标点（·、，）优先断行，避免最后一个字被挤到第二行
    const titleMaxWidth = 500;
    let titleFontSize = 24;
    let titleLines = [];
    const wrapTitle = (text, fontSize) => {
      ctx.font = `bold ${fontSize}px ` + fontFamily;
      if (ctx.measureText(text).width <= titleMaxWidth) return [text];
      // 优先在标点处断行
      const breakChars = ['·', '，', '——', '：', '、'];
      let bestBreak = -1;
      for (let ci = Math.floor(text.length / 2); ci < text.length; ci++) {
        if (breakChars.includes(text[ci])) { bestBreak = ci + 1; break; }
      }
      if (bestBreak > 0 && ctx.measureText(text.slice(0, bestBreak)).width <= titleMaxWidth) {
        return [text.slice(0, bestBreak), text.slice(bestBreak)];
      }
      // 兜底：逐字断行（从尾部找能放下的位置）
      let line = '';
      for (let ci = 0; ci < text.length; ci++) {
        const test = line + text[ci];
        if (ctx.measureText(test).width > titleMaxWidth && line.length > 0) {
          return [line, text.slice(line.length)];
        }
        line = test;
      }
      return [text];
    };
    while (titleFontSize > 16) {
      titleLines = wrapTitle(titleText, titleFontSize);
      const lastLineShort = titleLines.length > 1 && titleLines[titleLines.length - 1].length <= 2;
      if (titleLines.length === 1 || !lastLineShort) break;
      titleFontSize -= 2;
    }
    ctx.font = `bold ${titleFontSize}px ` + fontFamily;
    const titleLineH = titleFontSize + 6;
    const titleStartY = 120 - ((titleLines.length - 1) * titleLineH) / 2;
    titleLines.forEach((l, i) => {
      ctx.fillText(l, W / 2, titleStartY + i * titleLineH);
    });

    const desc = (ending.desc || '').substring(0, 50);
    if (desc) {
      ctx.fillStyle = dimColor;
      ctx.font = '12px ' + fontFamily;
      ctx.fillText(desc, W / 2, 175);
    }

    // === 雷达图区 (200-470) ===
    const cx = 300;
    const cy = 340;
    const radius = 120;

    const axes = [
      { label: '理想主义', value: state.pride || 0 },
      { label: '财富', value: state.wealth || 0 },
      { label: '名声', value: state.reputation || 0 },
      { label: '信任', value: state.trust || 0 },
      { label: '压力', value: state.pressure || 0 },
      { label: '翻车', value: state.failures || 0 }
    ];
    axes.forEach(a => {
      a.normalized = Math.max(0, Math.min(10, a.value));
    });

    const angles = [
      -Math.PI / 2, -Math.PI / 6, Math.PI / 6,
      Math.PI / 2, 5 * Math.PI / 6, 7 * Math.PI / 6
    ];

    // 背景3层同心六边形（虚线网格）
    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 3]);
    for (let layer = 1; layer <= 3; layer++) {
      const r = radius * layer / 3;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const x = cx + r * Math.cos(angles[i]);
        const y = cy + r * Math.sin(angles[i]);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // 轴线
    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 1;
    for (let i = 0; i < 6; i++) {
      const x = cx + radius * Math.cos(angles[i]);
      const y = cy + radius * Math.sin(angles[i]);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(x, y);
      ctx.stroke();
    }

    // 数据多边形（发光 + 氛围色填充）
    ctx.shadowColor = accentColor;
    ctx.shadowBlur = 12;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const r = (axes[i].normalized / 10) * radius;
      const x = cx + r * Math.cos(angles[i]);
      const y = cy + r * Math.sin(angles[i]);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = hexToRgba(accentColor, 0.25);
    ctx.fill();
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // 数据点（发光圆点）
    ctx.shadowColor = accentColor;
    ctx.shadowBlur = 6;
    ctx.fillStyle = accentColor;
    for (let i = 0; i < 6; i++) {
      const r = (axes[i].normalized / 10) * radius;
      const x = cx + r * Math.cos(angles[i]);
      const y = cy + r * Math.sin(angles[i]);
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.shadowBlur = 0;

    // 轴标签（带数值，便于分享时一眼看懂属性）
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const labelR = radius + 22;
    for (let i = 0; i < 6; i++) {
      const x = cx + labelR * Math.cos(angles[i]);
      const y = cy + labelR * Math.sin(angles[i]);
      ctx.fillStyle = dimColor;
      ctx.font = '12px ' + fontFamily;
      ctx.fillText(axes[i].label, x, y - 8);
      ctx.fillStyle = accentColor;
      ctx.font = 'bold 12px ' + fontFamily;
      ctx.fillText(String(axes[i].value), x, y + 7);
    }

    // === 天赋区 (470-590) ===
    let talentStr = state.talent || '';
    if (Array.isArray(talentStr)) talentStr = talentStr.join(',');
    const talentIds = String(talentStr).split(',').map(s => s.trim()).filter(Boolean).slice(0, 3);
    const talents = talentIds.map(id => TALENTS.find(t => t.id === id)).filter(Boolean);

    const rarityColors = {
      common: '#9a9a9a',
      rare: '#4080f0',
      legendary: '#f0c040'
    };
    const rarityBgColors = {
      common: 'rgba(154, 154, 154, 0.1)',
      rare: 'rgba(64, 128, 240, 0.12)',
      legendary: 'rgba(240, 192, 64, 0.15)'
    };

    if (talents.length > 0) {
      ctx.fillStyle = dimColor;
      ctx.font = '11px ' + fontFamily;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('— 天赋 —', W / 2, 506);
      const cardW = 150;
      const cardH = 70;
      const cardGap = 15;
      const totalCardW = talents.length * cardW + (talents.length - 1) * cardGap;
      const startCardX = (W - totalCardW) / 2;
      const cardY = 520;

      talents.forEach((t, i) => {
        const x = startCardX + i * (cardW + cardGap);
        const color = rarityColors[t.rarity] || rarityColors.common;
        const cardBgColor = rarityBgColors[t.rarity] || rarityBgColors.common;

        // 卡片背景（稀有度渐变）
        const cardGrad = ctx.createLinearGradient(x, cardY, x, cardY + cardH);
        cardGrad.addColorStop(0, cardBgColor);
        cardGrad.addColorStop(1, 'rgba(20, 20, 40, 0.4)');
        ctx.fillStyle = cardGrad;
        roundRect(x, cardY, cardW, cardH, 6);
        ctx.fill();

        // 边框（稀有度颜色，带微光）
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.shadowColor = color;
        ctx.shadowBlur = 4;
        roundRect(x, cardY, cardW, cardH, 6);
        ctx.stroke();
        ctx.shadowBlur = 0;

        // 像素图标
        ctx.fillStyle = color;
        ctx.font = '22px ' + fontFamily;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(t.icon || '◆', x + cardW / 2, cardY + 22);

        // 名称
        ctx.fillStyle = '#e0e0e0';
        ctx.font = '11px ' + fontFamily;
        ctx.fillText(t.name, x + cardW / 2, cardY + 48);

        // 稀有度标签
        const rarityLabel = t.rarity === 'legendary' ? '传说' : t.rarity === 'rare' ? '稀有' : '普通';
        ctx.fillStyle = color;
        ctx.font = '9px ' + fontFamily;
        ctx.fillText(rarityLabel, x + cardW / 2, cardY + 62);
      });
    }
    // 无天赋时整块留白（真实玩家开局必选 2 个天赋，此分支仅兜底注入存档等异常态）

    // === 金句区 (590-680) ===
    const quote = (ending.quote || '').replace(/罗远/g, '老罗');
    if (quote) {
      ctx.fillStyle = accentColor;
      ctx.fillRect(W / 2 - 80, 600, 160, 1);
      ctx.fillRect(W / 2 - 60, 604, 120, 1);

      ctx.fillStyle = accentColor;
      ctx.font = 'italic 15px ' + fontFamily;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const maxWidth = 440;
      const lines = [];
      let line = '';
      for (let ci = 0; ci < quote.length; ci++) {
        const testLine = line + quote[ci];
        if (ctx.measureText(testLine).width > maxWidth && line.length > 0) {
          lines.push(line);
          line = quote[ci];
        } else {
          line = testLine;
        }
      }
      if (line) lines.push(line);

      const lineH = 22;
      const startY = 630 - ((lines.length - 1) * lineH) / 2;
      lines.forEach((l, i) => {
        ctx.fillText(l, W / 2, startY + i * lineH);
      });

      const lastY = startY + (lines.length - 1) * lineH;
      ctx.fillStyle = accentColor;
      ctx.fillRect(W / 2 - 80, lastY + 15, 160, 1);
      ctx.fillRect(W / 2 - 60, lastY + 19, 120, 1);
    }

    // === 人生关键词区 (680-770) ===
    const keywords = [];
    const sp = state.pride || 0;
    const sw = state.wealth || 0;
    const sr = state.reputation || 0;
    const st = state.trust || 0;
    const sf = state.failures || 0;
    const spr = state.pressure || 0;
    if (sp >= 7) keywords.push('理想主义者');
    else if (sp <= 2) keywords.push('务实派');
    if (sw >= 7) keywords.push('商业大佬');
    else if (sw <= 2) keywords.push('清贫一生');
    if (sr >= 7) keywords.push('公众偶像');
    else if (sr <= 2) keywords.push('默默无闻');
    if (sf >= 3) keywords.push('屡败屡战');
    if (st >= 7) keywords.push('众望所归');
    else if (st <= 2) keywords.push('众叛亲离');
    if (spr >= 7) keywords.push('压力山大');

    let topKeywords = keywords.slice(0, 4);
    if (topKeywords.length === 0) topKeywords = ['平凡之路'];

    ctx.fillStyle = dimColor;
    ctx.font = '11px ' + fontFamily;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('— 人生关键词 —', W / 2, 700);

    ctx.font = '13px ' + fontFamily;
    const padX = 12;
    const tagH = 26;
    const tagGap = 10;
    const widths = topKeywords.map(k => ctx.measureText(k).width + padX * 2);
    const totalTagW = widths.reduce((a, b) => a + b, 0) + (topKeywords.length - 1) * tagGap;
    let tagX = (W - totalTagW) / 2;
    const tagY = 720;

    topKeywords.forEach((kw, i) => {
      const w = widths[i];
      ctx.fillStyle = hexToRgba(accentColor, 0.12);
      roundRect(tagX, tagY, w, tagH, 13);
      ctx.fill();
      ctx.strokeStyle = accentColor;
      ctx.lineWidth = 1;
      roundRect(tagX, tagY, w, tagH, 13);
      ctx.stroke();

      ctx.fillStyle = accentColor;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(kw, tagX + w / 2, tagY + tagH / 2);

      tagX += w + tagGap;
    });

    // === 底部 CTA 区 (770-880) ===
    ctx.fillStyle = '#ffffff';
    ctx.font = '14px ' + fontFamily;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('我在《罗的十字路口》走出了这段人生', W / 2, 800);

    ctx.fillStyle = accentColor;
    ctx.font = 'bold 18px ' + fontFamily;
    ctx.fillText('你呢？来试试你的人生', W / 2, 835);

    ctx.fillStyle = accentColor;
    ctx.fillRect(W / 2 - 60, 855, 120, 1);

    ctx.fillStyle = dimColor;
    ctx.font = '11px ' + fontFamily;
    // 分享卡 URL：优先取当前部署地址（本地/调试环境回退到线上正式地址）
    const shareUrl = (() => {
      try {
        const host = window.location.host;
        if (host && !/localhost|127\.0\.0\.1/.test(host)) {
          return host + window.location.pathname.replace(/\/$/, '');
        }
      } catch (e) {}
      return 'niuhai.github.io/luohammer-pixel-game';
    })();
    ctx.fillText(shareUrl, W / 2, 875);

    // === 四角装饰（氛围色，加粗） ===
    const cornerSize = 24;
    const cornerThick = 3;
    ctx.fillStyle = accentColor;
    ctx.fillRect(16, 16, cornerSize, cornerThick);
    ctx.fillRect(16, 16, cornerThick, cornerSize);
    ctx.fillRect(W - 16 - cornerSize, 16, cornerSize, cornerThick);
    ctx.fillRect(W - 16 - cornerThick, 16, cornerThick, cornerSize);
    ctx.fillRect(16, H - 16 - cornerThick, cornerSize, cornerThick);
    ctx.fillRect(16, H - 16 - cornerSize, cornerThick, cornerSize);
    ctx.fillRect(W - 16 - cornerSize, H - 16 - cornerThick, cornerSize, cornerThick);
    ctx.fillRect(W - 16 - cornerThick, H - 16 - cornerSize, cornerThick, cornerSize);

    // === 外边框（氛围色） ===
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 2;
    ctx.strokeRect(12, 12, W - 24, H - 24);

    // === CRT 扫描线（减淡） ===
    ctx.fillStyle = 'rgba(0, 0, 0, 0.03)';
    for (let y = 0; y < H; y += 3) {
      ctx.fillRect(0, y, W, 1);
    }

    return canvas;
  }

  drawBackground(type) {
    if (this.currentBg === type) return;
    this.currentBg = type;

    // 切换场景氛围粒子模式（默认 dust）
    this.setParticleMode(SCENE_PARTICLE_MODES[type] || 'dust');

    const bgTextureMap = {
      classroom: 'bg-classroom',
      lecture: 'bg-lecture',
      office: 'bg-office',
      stage: 'bg-stage',
      livestream: 'bg-livestream',
      street: 'bg-street',
      fridge_smash: 'bg-fridge_smash',
      talkshow: 'bg-talkshow',
      court: 'bg-court',
      lab: 'bg-lab',
      podcast: 'bg-podcast',
      // 场景变体（氛围增强）
      office_empty: 'bg-office_empty',
      office_dark: 'bg-office_dark',
      street_night: 'bg-street_night',
      office_busy: 'bg-office_busy',
      livestream_first: 'bg-livestream_first',
      street_day: 'bg-street_day',
      stage_arena: 'bg-stage_arena'
    };

    // 1. 检查预加载纹理
    const textureKey = bgTextureMap[type];
    const hasPreloadedTexture = textureKey && this.scene.textures.exists(textureKey);

    // 2. 检查缓存的 RenderTexture（Graphics 绘制结果缓存）
    const cacheKey = '_cache_bg_' + type;
    const hasCachedTexture = !hasPreloadedTexture && this.scene.textures.exists(cacheKey);

    if (hasPreloadedTexture || hasCachedTexture) {
      // 使用纹理（预加载或缓存），GPU 渲染更高效
      const key = hasPreloadedTexture ? textureKey : cacheKey;
      this.bgGraphics.clear();
      if (!this.bgSprite) {
        this.bgSprite = this.scene.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, key);
        this.bgSprite.setDepth(0);
      } else {
        this.bgSprite.setTexture(key);
      }
      // AI 高清插画改用线性过滤渲染：全局 pixelArt 模式会强制最近邻采样，
      // 2560x1440 插画缩到 800x500 时会产生锯齿/闪烁；仅对 AI 插画解除，
      // 程序化像素缓存纹理（cacheKey）保持默认采样不受影响。
      if (hasPreloadedTexture) {
        this.bgSprite.texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
      }
      this.bgSprite.setDisplaySize(GAME_WIDTH, GAME_HEIGHT);
      this.bgSprite.setPosition(GAME_WIDTH / 2, GAME_HEIGHT / 2);
      this._fadeInBackground();
    } else {
      // 无纹理 - 使用 Graphics 绘制，并缓存为 RenderTexture
      if (this.bgSprite) {
        this.bgSprite.destroy();
        this.bgSprite = null;
      }
      this.bgGraphics.clear();
      const fn = {
        classroom: drawClassroom,
        office: drawOffice,
        stage: drawStage,
        livestream: drawLivestream,
        lab: drawLab,
        podcast: drawPodcast,
        street: drawStreet,
        fridge_smash: drawFridgeSmash,
        talkshow: drawTalkshow,
        court: drawCourt,
        ending: drawEnding
      }[type] || drawClassroom;
      fn(this.bgGraphics);

      // 将 Graphics 输出缓存为 RenderTexture，后续同类型背景直接复用纹理
      try {
        this.bgGraphics.generateTexture(cacheKey, GAME_WIDTH, GAME_HEIGHT);
        this.bgGraphics.clear();
        this.bgSprite = this.scene.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, cacheKey);
        this.bgSprite.setDepth(0);
        this.bgSprite.setDisplaySize(GAME_WIDTH, GAME_HEIGHT);
        this.bgSprite.setPosition(GAME_WIDTH / 2, GAME_HEIGHT / 2);
        this._fadeInBackground();
      } catch (e) {
        // generateTexture 失败时保留 Graphics 绘制（降级方案）
      }
    }
  }

  drawCharacter(pose = 'standing') {
    const charTextureMap = {
      standing: 'char-standing',
      speaking: 'char-speaking',
      angry: 'char-angry',
      depressed: 'char-depressed',
      happy: 'char-happy',
      livestream: 'char-livestream',
      young: 'char-young',
      sitting: 'char-sitting',
      middle: 'char-middle'
    };

    let textureKey = charTextureMap[pose] || 'char-standing';
    if (!this.scene.textures.exists(textureKey)) {
      textureKey = 'char-standing';
    }
    const hasTexture = this.scene.textures.exists(textureKey);

    if (hasTexture) {
      this.fgGraphics.clear();
      this._createBlackBackgroundMask(textureKey);
      const useKey = this._charProcessedKey || textureKey;
      if (!this.charSprite) {
        this.charSprite = this.scene.add.image(400, 460, useKey);
        this.charSprite.setDepth(50);
        this.charSprite.setOrigin(0.5, 1);
      } else if (this.charSprite.texture.key !== useKey) {
        this.charSprite.setTexture(useKey);
      }
      // 角色立绘（AI 高清图）同样使用线性过滤，避免缩放锯齿
      this.charSprite.texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
      if (this._talkTween) {
        this._talkTween.stop();
        this._talkTween = null;
      }
      this.currentPose = pose;
    } else {
      if (this.shadowGfx) this.shadowGfx.clear();
      if (this.charSprite) {
        this.charSprite.destroy();
        this.charSprite = null;
        this.currentPose = null;
      }
      drawCharacterFallback(this.fgGraphics, pose);
    }
  }

  _createBlackBackgroundMask(textureKey) {
    this._charProcessedKey = textureKey;
  }

  /**
   * 销毁所有 Graphics 对象和 Sprite，释放资源（场景切换时调用）
   */
  destroy() {
    // 任务2：停止心跳振动
    this._heartbeatActive = false;

    // 清理粒子
    this.particles.length = 0;
    for (let i = 0; i < this.bgParticles.length; i++) {
      this.bgParticles[i] = null;
    }
    this.bgParticles.length = 0;

    // 清理粒子分组缓存
    if (this._particleGroups) {
      for (const k in this._particleGroups) {
        this._particleGroups[k].items = null;
        delete this._particleGroups[k];
      }
      this._particleGroups = null;
    }

    // 清理背景粒子透明度分组缓存
    if (this._bgAlphaBuckets) {
      for (let i = 0; i < this._bgAlphaBuckets.length; i++) {
        this._bgAlphaBuckets[i] = null;
      }
      this._bgAlphaBuckets = null;
    }

    // 重置对象池空闲列表
    freeList.length = 0;
    for (let i = 0; i < POOL_SIZE; i++) {
      particlePool[i].active = false;
      freeList.push(i);
    }

    // 停止角色说话动画
    if (this._talkTween) {
      this._talkTween.stop();
      this._talkTween = null;
    }

    // === 清理角色凝视监听器 ===
    if (this._gazeHandler && this.scene && this.scene.input) {
      this.scene.input.off('pointermove', this._gazeHandler);
      this._gazeHandler = null;
    }
    this._gazeListenerAdded = false;
    this._gazeOffsetX = 0;
    this._gazeOffsetY = 0;

    // === 清理背景粒子视差监听器 ===
    if (this._parallaxHandler && this.scene && this.scene.input) {
      this.scene.input.off('pointermove', this._parallaxHandler);
      this._parallaxHandler = null;
    }
    this._parallaxTargetX = 0;
    this._parallaxTargetY = 0;
    this._parallaxCurrentX = 0;
    this._parallaxCurrentY = 0;

    // 销毁 Sprite
    if (this.bgSprite) {
      this.bgSprite.destroy();
      this.bgSprite = null;
    }
    if (this.charSprite) {
      this.charSprite.destroy();
      this.charSprite = null;
    }
    if (this.charMask) {
      this.charMask.destroy();
      this.charMask = null;
    }
    // 清理遮罩纹理
    if (this._charMaskKey && this.scene && this.scene.textures) {
      if (this.scene.textures.exists(this._charMaskKey)) {
        this.scene.textures.remove(this._charMaskKey);
      }
    }

    // 销毁 Graphics 对象
    const gfxList = [this.bgGraphics, this.fgGraphics, this.uiGraphics, this.bgParticleGfx, this.particleGfx, this.shadowGfx];
    for (const g of gfxList) {
      if (g) g.destroy();
    }
    this.bgGraphics = null;
    this.fgGraphics = null;
    this.uiGraphics = null;
    this.bgParticleGfx = null;
    this.particleGfx = null;
    this.shadowGfx = null;

    // 清理缓存的 RenderTexture（防止场景切换后纹理残留）
    if (this.scene && this.scene.textures) {
      const textureKeys = [
        '_cache_bg_classroom', '_cache_bg_lecture', '_cache_bg_office',
        '_cache_bg_stage', '_cache_bg_livestream', '_cache_bg_lab',
        '_cache_bg_podcast', '_cache_bg_street', '_cache_bg_fridge_smash',
        '_cache_bg_talkshow', '_cache_bg_court', '_cache_bg_ending'
      ];
      for (const key of textureKeys) {
        if (this.scene.textures.exists(key)) {
          this.scene.textures.remove(key);
        }
      }
    }

    this.currentBg = null;
    this.currentPose = null;
    this.scene = null;
  }

  // ===================================================================
  //  效果更新
  // ===================================================================

  updateEffects(dt) {
    if (this.shakeIntensity > 0) {
      this.shakeIntensity *= 0.9;
      if (this.shakeIntensity < 0.5) this.shakeIntensity = 0;
    }
    if (this.flashTimer > 0) {
      this.flashTimer -= dt;
      this.flashAlpha = this.flashTimer / this.flashDuration;
      if (this.flashTimer <= 0) this.flashAlpha = 0;
    }

    // 更新前景粒子（使用对象池版本，swap-remove 替代 splice 避免 O(n) 移动）
    let writeIdx = 0;
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += p.gravity * dt;
      if (p.life > 0) {
        this.particles[writeIdx++] = p;
      } else {
        p.active = false;
        releaseParticle(p); // 归还到池
      }
    }
    this.particles.length = writeIdx;

    // 更新背景漂浮粒子
    this._updateBgParticles(dt);
  }

  /**
   * 更新背景漂浮粒子
   */
  _updateBgParticles(dt) {
    // 平滑过渡视差偏移（帧率无关 lerp）
    const lerpFactor = Math.min(1, dt * 8);
    this._parallaxCurrentX += (this._parallaxTargetX - this._parallaxCurrentX) * lerpFactor;
    this._parallaxCurrentY += (this._parallaxTargetY - this._parallaxCurrentY) * lerpFactor;

    const mode = PARTICLE_MODES[this._particleMode] || PARTICLE_MODES.dust;
    const time = this.scene.time.now / 1000;
    for (let i = 0; i < this.bgParticles.length; i++) {
      const bp = this.bgParticles[i];
      // 按模式运动：up=上飘（默认）/ down=雨丝下落 / side=弹幕横漂
      if (mode.move === 'down') {
        bp.y += bp.speed * mode.speedMul * dt;
        bp.x += bp.drift * 0.25 * dt; // 雨丝几乎不横漂
      } else if (mode.move === 'side') {
        bp.x += bp.speed * mode.speedMul * dt;
        bp.y -= bp.speed * 0.12 * dt; // 弹幕轻微上浮
      } else {
        bp.y -= bp.speed * mode.speedMul * dt;
        bp.x += bp.drift * dt;
      }

      // 闪烁（雨丝不闪烁，保持匀速稳定）
      bp._currentAlpha = mode.streak
        ? bp.alpha * mode.alphaMul
        : bp.alpha * mode.alphaMul * (0.6 + 0.4 * Math.sin(time * bp.twinkleSpeed + bp.phase));

      // 出界重生（复用对象，避免 new），方向与运动模式一致
      if (mode.move === 'down') {
        if (bp.y > GAME_HEIGHT + bp.size) { bp.y = -bp.size; bp.x = Math.random() * GAME_WIDTH; }
      } else if (mode.move === 'side') {
        if (bp.x > GAME_WIDTH + bp.size) { bp.x = -bp.size; bp.y = Math.random() * GAME_HEIGHT; }
      } else if (bp.y < -bp.size) {
        this._resetBgParticle(bp, true);
      }
      // 左右边界回绕（side 模式的右侧出口已在上方处理）
      if (bp.x < -bp.size) bp.x = GAME_WIDTH + bp.size;
      if (mode.move !== 'side' && bp.x > GAME_WIDTH + bp.size) bp.x = -bp.size;
    }
  }

  /**
   * 绘制背景漂浮粒子（按透明度分组，减少 fillStyle 切换）
   * 使用预分配的 26 个桶数组，避免每帧 new 对象/数组产生 GC 压力
   */
  _drawBgParticles(g) {
    const buckets = this._bgAlphaBuckets;
    // 清空上帧分组（复用预分配数组）
    for (let i = 0; i < 26; i++) buckets[i].length = 0;

    for (let i = 0; i < this.bgParticles.length; i++) {
      const bp = this.bgParticles[i];
      const alpha = bp._currentAlpha !== undefined ? bp._currentAlpha : bp.alpha;
      // 量化到 4% 精度，0~25 对应 0%~100%
      const key = Math.min(alpha * 25 | 0, 25);
      buckets[key].push(bp);
    }
    for (let key = 0; key < 26; key++) {
      const items = buckets[key];
      if (items.length === 0) continue;
      const alpha = key / 25;
      const mode = PARTICLE_MODES[this._particleMode] || PARTICLE_MODES.dust;
      g.fillStyle(mode.color, alpha);
      for (let i = 0; i < items.length; i++) {
        const bp = items[i];
        // 鼠标视差：大粒子（size > 3）偏移系数 0.02，小粒子 0.01
        const factor = bp.size > 3 ? 0.02 : 0.01;
        const ox = this._parallaxCurrentX * factor;
        const oy = this._parallaxCurrentY * factor;
        if (mode.streak) {
          // 雨丝：1px 宽竖条，长度为粒子尺寸的 4 倍
          g.fillRect(bp.x + ox, bp.y + oy, 1, bp.size * 4);
        } else {
          g.fillRect(bp.x - bp.size / 2 + ox, bp.y - bp.size / 2 + oy, bp.size, bp.size);
        }
      }
    }
  }

  drawParticles(g) {
    if (this.particles.length === 0) return;

    // 按颜色分组批量绘制，减少 fillStyle 切换次数
    // 复用分组对象，减少 GC 压力
    const groups = this._particleGroups || (this._particleGroups = {});
    // 清空上帧分组（复用对象，避免每帧 new）
    for (const k in groups) {
      groups[k].items.length = 0;
    }

    // 追踪本帧使用过的 key，用于只遍历活跃分组
    const activeKeys = this._particleActiveKeys || (this._particleActiveKeys = []);
    activeKeys.length = 0;

    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      const alpha = Math.max(0, p.life / p.maxLife);
      // 用 color_alpha 作为分组 key，合并相同颜色+透明度的粒子
      const key = p.color + '_' + (alpha * 100 | 0);
      if (!groups[key]) {
        groups[key] = { color: p.color, alpha: alpha, items: [] };
      } else {
        groups[key].alpha = alpha; // 更新 alpha（量化后相同 key 的 alpha 基本一致）
      }
      groups[key].items.push(p);
      activeKeys.push(key);
    }
    for (let i = 0; i < activeKeys.length; i++) {
      const grp = groups[activeKeys[i]];
      if (grp.items.length === 0) continue; // 跳过空分组
      g.fillStyle(grp.color, grp.alpha);
      for (let j = 0; j < grp.items.length; j++) {
        const p = grp.items[j];
        g.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      }
    }
  }

  // ===================================================================
  //  屏幕震动（增强版：同时支持 camera shake）
  // ===================================================================

  /**
   * 通过 camera shake 实现屏幕震动（不影响 UI 层）
   * 带防抖：若上一次抖动尚未结束且新强度不更高，则跳过，避免叠加造成持续狂抖
   * @param {number} intensity - 震动强度（像素）
   * @param {number} duration - 震动时长 ms
   */
  cameraShake(intensity = 4, duration = 200) {
    const cam = this.scene.cameras.main;
    const shakeEffect = cam.shakeEffect;
    // Phaser 的 shakeEffect 有 isRunning 标志
    if (shakeEffect && shakeEffect.isRunning) {
      // 当前已有抖动进行中，仅在更强时覆盖，避免叠加眩晕
      if (intensity <= (this._currentShakeIntensity || 0)) return;
    }
    this._currentShakeIntensity = intensity;
    cam.shake(duration, intensity / 1000);
    // 抖动结束后清除记录
    this.scene.time.delayedCall(duration, () => {
      if (this._currentShakeIntensity === intensity) this._currentShakeIntensity = 0;
    });
  }

  flashScreen(duration = 0.3) {
    this.flashAlpha = 1;
    this.flashDuration = duration;
    this.flashTimer = duration;
  }

  /**
   * 压力可视化效果：根据压力比例显示暗角、抖动和红色闪烁
   * @param {number} pressure - 当前压力值
   * @param {number} maxPressure - 压力上限
   */
  updatePressureEffect(pressure, maxPressure) {
    // 缓存 vignette 元素，避免每帧 getElementById DOM 查询
    if (!this._vignetteEl) {
      this._vignetteEl = document.getElementById('pressure-vignette');
    }
    const vignette = this._vignetteEl;
    if (!vignette) return;
    const ratio = maxPressure > 0 ? pressure / maxPressure : 0;

    // 缓存上次压力档位，仅在档位变化时操作 classList（避免每帧 remove/add 抖动）
    // 档位：0 = 无效果, 1 = active（>0.7）, 2 = active+shake（>0.85）, 3 = active+critical（>=1.0）
    let tier = 0;
    if (ratio >= 1.0) tier = 3;
    else if (ratio > 0.85) tier = 2;
    else if (ratio > 0.7) tier = 1;

    if (tier !== this._lastPressureTier) {
      this._lastPressureTier = tier;
      vignette.classList.remove('active', 'critical');
      if (tier === 3) vignette.classList.add('active', 'critical');
      else if (tier >= 1) vignette.classList.add('active');
    }

    if (tier === 3) {
      // 压力满：周期性抖动 + 红色闪烁
      // 间隔从 500ms 调至 1500ms，避免持续狂抖导致玩家眩晕；强度也降低
      const now = this.scene.time.now;
      if (!this._lastCriticalShakeTime || now - this._lastCriticalShakeTime >= 1500) {
        this.cameraShake(3, 150);
        this._lastCriticalShakeTime = now;
      }
    } else if (tier === 2) {
      // 压力极高：暗角 + 每5秒抖动一次（缩短单次时长）
      const now = this.scene.time.now;
      if (!this._lastPressureShakeTime || now - this._lastPressureShakeTime >= 5000) {
        this.cameraShake(2, 100);
        this._lastPressureShakeTime = now;
      }
    }

    // 任务2：心跳振动——压力 > 0.7 时启动，节奏随压力加快
    if (ratio > 0.7) {
      if (!this._heartbeatActive) {
        this._heartbeatActive = true;
        this._startHeartbeat(ratio);
      }
    } else {
      this._heartbeatActive = false;
    }

    // 压力降低后重置抖动计时器
    if (ratio <= 0.7) {
      this._lastPressureShakeTime = 0;
      this._lastCriticalShakeTime = 0;
    }
  }

  /**
   * 任务2：心跳振动循环（咚...咚...咚...）
   * 振动100ms → 停顿200ms → 振动100ms → 停顿（随压力缩短）
   * 仅在移动端有效（navigator.vibrate），桌面端无效果但不报错
   */
  _startHeartbeat(ratio) {
    if (!this._heartbeatActive) return;
    // 振动100ms（咚）
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try { navigator.vibrate(100); } catch (e) {}
    }
    setTimeout(() => {
      if (!this._heartbeatActive) return;
      // 振动100ms（咚）
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        try { navigator.vibrate(100); } catch (e) {}
      }
      // 停顿时间随压力增加而缩短
      const interval = Math.max(400, 1200 - ratio * 600);
      setTimeout(() => this._startHeartbeat(ratio), interval);
    }, 200);
  }

  render() {
    // 绘制背景漂浮粒子（仅在 bgParticleGfx 存在时）
    if (this.bgParticleGfx) {
      this.bgParticleGfx.clear();
      this._drawBgParticles(this.bgParticleGfx);
    }

    // 绘制前景粒子和闪光效果（使用独立 particleGfx 层，不覆盖 fgGraphics 的角色 fallback）
    if (this.particleGfx) {
      // 仅在有粒子或闪光时才清空重绘，减少无粒子帧的开销
      if (this.particles.length > 0 || this.flashAlpha > 0) {
        this.particleGfx.clear();
        this.drawParticles(this.particleGfx);
        if (this.flashAlpha > 0) {
          this.particleGfx.fillStyle(0xffffff, this.flashAlpha);
          this.particleGfx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
        }
        this._particleGfxDirty = true;
      } else if (this._particleGfxDirty) {
        // 从有粒子变为无粒子时，清空一次
        this.particleGfx.clear();
        this._particleGfxDirty = false;
      }
    }

    // 震动效果：偏移 Graphics 层（charSprite 位置由 GameScene._updateCharacterPosition 管理）
    if (this.shakeIntensity > 0) {
      const dx = (Math.random() - 0.5) * this.shakeIntensity;
      const dy = (Math.random() - 0.5) * this.shakeIntensity;
      if (this.bgGraphics) this.bgGraphics.setPosition(dx, dy);
      if (this.fgGraphics) this.fgGraphics.setPosition(dx, dy);
      if (this.bgParticleGfx) this.bgParticleGfx.setPosition(dx, dy);
      if (this.particleGfx) this.particleGfx.setPosition(dx, dy);
      if (this.shadowGfx) this.shadowGfx.setPosition(dx, dy);
      if (this.bgSprite) this.bgSprite.setPosition(GAME_WIDTH / 2 + dx, GAME_HEIGHT / 2 + dy);
    } else {
      if (this._wasShaking) {
        if (this.bgGraphics) this.bgGraphics.setPosition(0, 0);
        if (this.fgGraphics) this.fgGraphics.setPosition(0, 0);
        if (this.bgParticleGfx) this.bgParticleGfx.setPosition(0, 0);
        if (this.particleGfx) this.particleGfx.setPosition(0, 0);
        if (this.shadowGfx) this.shadowGfx.setPosition(0, 0);
        if (this.bgSprite) this.bgSprite.setPosition(GAME_WIDTH / 2, GAME_HEIGHT / 2);
        this._wasShaking = false;
      }
    }
    if (this.shakeIntensity > 0) this._wasShaking = true;
  }
}
