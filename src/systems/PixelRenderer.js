import { COLORS, UI_COLORS, GAME_WIDTH, GAME_HEIGHT } from '../config.js';
import { TALENTS } from '../data/talents.js';
import {
  drawClassroom,
  drawLecture,
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

function acquireParticle() {
  // O(1) 从 free list 栈顶取空闲粒子
  if (freeList.length > 0) {
    const idx = freeList.pop();
    const p = particlePool[idx];
    p.active = true;
    return p;
  }
  // 池满：强制回收最旧的活跃粒子（遍历找 life 最小的）
  let minLife = Infinity;
  let victimIdx = 0;
  for (let i = 0; i < POOL_SIZE; i++) {
    if (particlePool[i].life < minLife) {
      minLife = particlePool[i].life;
      victimIdx = i;
    }
  }
  return particlePool[victimIdx];
}

// 归还粒子到池（O(1)，通过 _idx 直接定位）
function releaseParticle(p) {
  p.active = false;
  freeList.push(p._idx);
}

// ---- 背景粒子配置 ----
const BG_PARTICLE_COUNT = 40;
const BG_PARTICLE_COLOR = 0xf0c040; // 金色
const BG_PARTICLE_MIN_SIZE = 1;
const BG_PARTICLE_MAX_SIZE = 5;
const BG_PARTICLE_MIN_SPEED = 8;
const BG_PARTICLE_MAX_SPEED = 25;

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
  static renderShareCard(state, ending) {
    const W = 600;
    const H = 900;
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');

    const accentColor = '#f0c040';
    const dimColor = '#9a8a6a';
    const gridColor = '#1a1a2e';
    const bgColor = '#0a0a1a';
    const fontFamily = '"Microsoft YaHei", "PingFang SC", sans-serif';

    // 圆角矩形辅助函数（兼容性优于 ctx.roundRect）
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

    // 像素网格纹理
    ctx.fillStyle = 'rgba(240, 192, 64, 0.025)';
    for (let x = 0; x < W; x += 4) {
      for (let y = 0; y < H; y += 4) {
        if ((x + y) % 8 === 0) {
          ctx.fillRect(x, y, 2, 2);
        }
      }
    }

    // === 顶部区域 (0-120): 游戏品牌 ===
    ctx.fillStyle = accentColor;
    ctx.font = '16px ' + fontFamily;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('真还传 · 人生模拟', W / 2, 50);

    // 金色装饰线
    ctx.fillStyle = accentColor;
    ctx.fillRect(W / 2 - 100, 80, 200, 2);
    ctx.fillRect(W / 2 - 60, 85, 120, 1);

    // === 标题区域 (120-220): 结局标题 ===
    ctx.fillStyle = accentColor;
    ctx.font = 'bold 28px ' + fontFamily;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(ending.title || '结局', W / 2, 155);

    // 结局简短描述（前40字符）
    const desc = (ending.desc || '').substring(0, 40);
    if (desc) {
      ctx.fillStyle = dimColor;
      ctx.font = '13px ' + fontFamily;
      ctx.fillText(desc, W / 2, 195);
    }

    // === 雷达图区域 (220-480): 六维属性雷达图 ===
    const cx = 300;
    const cy = 350;
    const radius = 100;

    const axes = [
      { label: '理想主义', value: state.pride || 0 },
      { label: '财富', value: state.wealth || 0 },
      { label: '名声', value: state.reputation || 0 },
      { label: '信任', value: state.trust || 0 },
      { label: '压力', value: state.pressure || 0 },
      { label: '翻车', value: state.failures || 0 }
    ];
    // 标准化到 0-10（failures 可能大于10，取 min）
    axes.forEach(a => {
      a.normalized = Math.max(0, Math.min(10, a.value));
    });

    // 六边形顶点角度：从正上方开始，每60度一个（-90°, -30°, 30°, 90°, 150°, 210°）
    const angles = [
      -Math.PI / 2,      // -90° 上
      -Math.PI / 6,      // -30° 右上
      Math.PI / 6,       // 30° 右下
      Math.PI / 2,       // 90° 下
      5 * Math.PI / 6,   // 150° 左下
      7 * Math.PI / 6    // 210° 左上
    ];

    // 背景3层同心六边形（网格，暗色）
    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 1;
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

    // 轴线（从中心到顶点）
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

    // 数据多边形（半透明金色填充 + 金色边线）
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const r = (axes[i].normalized / 10) * radius;
      const x = cx + r * Math.cos(angles[i]);
      const y = cy + r * Math.sin(angles[i]);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = 'rgba(240, 192, 64, 0.25)';
    ctx.fill();
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 2;
    ctx.stroke();

    // 数据点（顶点小圆点）
    ctx.fillStyle = accentColor;
    for (let i = 0; i < 6; i++) {
      const r = (axes[i].normalized / 10) * radius;
      const x = cx + r * Math.cos(angles[i]);
      const y = cy + r * Math.sin(angles[i]);
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // 轴标签（顶点外侧）
    ctx.fillStyle = dimColor;
    ctx.font = '12px ' + fontFamily;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const labelR = radius + 20;
    for (let i = 0; i < 6; i++) {
      const x = cx + labelR * Math.cos(angles[i]);
      const y = cy + labelR * Math.sin(angles[i]);
      ctx.fillText(axes[i].label, x, y);
    }

    // === 天赋区域 (480-580): 天赋展示 ===
    ctx.fillStyle = dimColor;
    ctx.font = '12px ' + fontFamily;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('— 天赋 —', W / 2, 498);

    // 解析 state.talent（逗号分隔的天赋ID字符串）
    let talentStr = state.talent || '';
    if (Array.isArray(talentStr)) talentStr = talentStr.join(',');
    const talentIds = String(talentStr).split(',').map(s => s.trim()).filter(Boolean).slice(0, 3);
    const talents = talentIds.map(id => TALENTS.find(t => t.id === id)).filter(Boolean);

    const rarityColors = {
      common: '#9a9a9a',
      rare: '#4080f0',
      legendary: '#f0c040'
    };

    if (talents.length > 0) {
      const cardW = 140;
      const cardH = 65;
      const cardGap = 20;
      const totalCardW = talents.length * cardW + (talents.length - 1) * cardGap;
      const startCardX = (W - totalCardW) / 2;
      const cardY = 510;

      talents.forEach((t, i) => {
        const x = startCardX + i * (cardW + cardGap);
        const color = rarityColors[t.rarity] || rarityColors.common;

        // 卡片背景
        ctx.fillStyle = 'rgba(20, 20, 40, 0.6)';
        roundRect(x, cardY, cardW, cardH, 6);
        ctx.fill();

        // 边框（稀有度颜色）
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        roundRect(x, cardY, cardW, cardH, 6);
        ctx.stroke();

        // 像素图标
        ctx.fillStyle = color;
        ctx.font = '22px ' + fontFamily;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(t.icon || '◆', x + cardW / 2, cardY + 22);

        // 名称
        ctx.fillStyle = '#e0e0e0';
        ctx.font = '12px ' + fontFamily;
        ctx.fillText(t.name, x + cardW / 2, cardY + 48);
      });
    } else {
      ctx.fillStyle = dimColor;
      ctx.font = '12px ' + fontFamily;
      ctx.fillText('— 无 —', W / 2, 540);
    }

    // === 金句区域 (580-660): 人生金句 ===
    const quote = ending.quote || '';
    if (quote) {
      // 上装饰线
      ctx.fillStyle = accentColor;
      ctx.fillRect(W / 2 - 80, 590, 160, 1);

      // 金句（斜体，金色，自动换行）
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
      const startY = 615 - ((lines.length - 1) * lineH) / 2;
      lines.forEach((l, i) => {
        ctx.fillText(l, W / 2, startY + i * lineH);
      });

      // 下装饰线
      const lastY = startY + (lines.length - 1) * lineH;
      ctx.fillStyle = accentColor;
      ctx.fillRect(W / 2 - 80, lastY + 15, 160, 1);
    }

    // === 人生关键词区域 (660-740) ===
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

    // 区域标题
    ctx.fillStyle = dimColor;
    ctx.font = '12px ' + fontFamily;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('— 人生关键词 —', W / 2, 680);

    // 关键词标签（金色圆角矩形背景，横排居中）
    ctx.font = '13px ' + fontFamily;
    const padX = 12;
    const tagH = 26;
    const tagGap = 10;
    const widths = topKeywords.map(k => ctx.measureText(k).width + padX * 2);
    const totalTagW = widths.reduce((a, b) => a + b, 0) + (topKeywords.length - 1) * tagGap;
    let tagX = (W - totalTagW) / 2;
    const tagY = 700;

    topKeywords.forEach((kw, i) => {
      const w = widths[i];
      ctx.fillStyle = 'rgba(240, 192, 64, 0.15)';
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

    // === 底部区域 (740-900): 行动召唤 ===
    ctx.fillStyle = '#ffffff';
    ctx.font = '14px ' + fontFamily;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('我在《罗的十字路口》走出了这段人生', W / 2, 775);

    ctx.fillStyle = accentColor;
    ctx.font = 'bold 18px ' + fontFamily;
    ctx.fillText('你呢？来试试你的人生', W / 2, 810);

    // 游戏URL（灰色小字）
    ctx.fillStyle = dimColor;
    ctx.font = '11px ' + fontFamily;
    ctx.fillText('luohammer.pages.dev', W / 2, 870);

    // === 金色像素装饰角（四角） ===
    const cornerSize = 20;
    const cornerThick = 3;
    ctx.fillStyle = accentColor;
    // 左上
    ctx.fillRect(16, 16, cornerSize, cornerThick);
    ctx.fillRect(16, 16, cornerThick, cornerSize);
    // 右上
    ctx.fillRect(W - 16 - cornerSize, 16, cornerSize, cornerThick);
    ctx.fillRect(W - 16 - cornerThick, 16, cornerThick, cornerSize);
    // 左下
    ctx.fillRect(16, H - 16 - cornerThick, cornerSize, cornerThick);
    ctx.fillRect(16, H - 16 - cornerSize, cornerThick, cornerSize);
    // 右下
    ctx.fillRect(W - 16 - cornerSize, H - 16 - cornerThick, cornerSize, cornerThick);
    ctx.fillRect(W - 16 - cornerThick, H - 16 - cornerSize, cornerThick, cornerSize);

    // === 外边框（金色，2px） ===
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 2;
    ctx.strokeRect(12, 12, W - 24, H - 24);

    // === CRT 扫描线效果（每隔2px一条半透明水平线） ===
    ctx.fillStyle = 'rgba(0, 0, 0, 0.06)';
    for (let y = 0; y < H; y += 2) {
      ctx.fillRect(0, y, W, 1);
    }

    return canvas;
  }

  drawBackground(type) {
    if (this.currentBg === type) return;
    this.currentBg = type;

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
      podcast: 'bg-podcast'
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
      this.bgSprite.setDisplaySize(GAME_WIDTH, GAME_HEIGHT);
      this.bgSprite.setPosition(GAME_WIDTH / 2, GAME_HEIGHT / 2);
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

  clearForeground() {
    this.fgGraphics.clear();
    this.particleGfx.clear();
    this.particles.length = 0;
  }

  _createBlackBackgroundMask(textureKey) {
    this._charProcessedKey = textureKey;
  }

  /**
   * 更新遮罩位置以匹配角色 sprite
   */
  _updateCharMask() {
    if (this.charMask && this.charSprite) {
      this.charMask.setPosition(this.charSprite.x, this.charSprite.y);
      this.charMask.setScale(this.charSprite.scaleX, this.charSprite.scaleY);
    }
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
  //  粒子系统（使用对象池）
  // ===================================================================

  /**
   * 添加单个粒子（使用对象池，兼容原 API）
   */
  addParticle(x, y, color, size, life, vx, vy) {
    const p = acquireParticle();
    p.x = x;
    p.y = y;
    p.color = color;
    p.size = size;
    p.life = life;
    p.maxLife = life;
    p.vx = vx;
    p.vy = vy;
    p.gravity = 200;
    p.active = true;
    p.type = 'default';
    this.particles.push(p);
  }

  /**
   * 选择反馈粒子：从指定位置喷射金色粒子
   * @param {number} x - 中心 x
   * @param {number} y - 中心 y
   * @param {number} [count=12] - 粒子数量
   * @param {number} [color=0xf0c040] - 粒子颜色（默认金色）
   */
  emitChoiceParticles(x, y, count = 12, color = 0xf0c040) {
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
      const speed = 60 + Math.random() * 100;
      const p = acquireParticle();
      p.x = x + (Math.random() - 0.5) * 10;
      p.y = y + (Math.random() - 0.5) * 6;
      p.color = color;
      p.size = 2 + Math.random() * 3;
      p.life = 0.4 + Math.random() * 0.4;
      p.maxLife = p.life;
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed - 30;
      p.gravity = 150;
      p.active = true;
      p.type = 'choice';
      this.particles.push(p);
    }
  }

  /**
   * 属性变化粒子：从指定位置向上喷射彩色粒子
   * @param {number} x - 中心 x
   * @param {number} y - 中心 y
   * @param {number} color - 粒子颜色
   * @param {number} [count=8] - 粒子数量
   * @param {boolean} [isNegative=false] - 是否为负面变化（粒子向下）
   */
  emitStatParticles(x, y, color, count = 8, isNegative = false) {
    for (let i = 0; i < count; i++) {
      const angle = isNegative
        ? Math.PI / 2 + (Math.random() - 0.5) * 1.2  // 向下散开
        : -Math.PI / 2 + (Math.random() - 0.5) * 1.2; // 向上散开
      const speed = 50 + Math.random() * 80;
      const p = acquireParticle();
      p.x = x + (Math.random() - 0.5) * 20;
      p.y = y;
      p.color = color;
      p.size = 2 + Math.random() * 2;
      p.life = 0.5 + Math.random() * 0.3;
      p.maxLife = p.life;
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed;
      p.gravity = isNegative ? 200 : -50; // 负面加重力，正面反重力
      p.active = true;
      p.type = 'stat';
      this.particles.push(p);
    }
  }

  /**
   * 翻车粒子爆发：大量红色粒子从中心爆发
   * @param {number} [x=GAME_WIDTH/2] - 中心 x
   * @param {number} [y=GAME_HEIGHT/2] - 中心 y
   * @param {number} [count=30] - 粒子数量
   */
  emitCrashParticles(x = GAME_WIDTH / 2, y = GAME_HEIGHT / 2, count = 30) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 80 + Math.random() * 180;
      const p = acquireParticle();
      p.x = x + (Math.random() - 0.5) * 40;
      p.y = y + (Math.random() - 0.5) * 30;
      p.color = Math.random() > 0.3 ? 0xe04040 : 0xff6030; // 红 + 橙红
      p.size = 3 + Math.random() * 4;
      p.life = 0.6 + Math.random() * 0.5;
      p.maxLife = p.life;
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed;
      p.gravity = 120;
      p.active = true;
      p.type = 'crash';
      this.particles.push(p);
    }
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

    const time = this.scene.time.now / 1000;
    for (let i = 0; i < this.bgParticles.length; i++) {
      const bp = this.bgParticles[i];
      // 缓慢上飘
      bp.y -= bp.speed * dt;
      // 水平漂移
      bp.x += bp.drift * dt;

      // 闪烁
      bp._currentAlpha = bp.alpha * (0.6 + 0.4 * Math.sin(time * bp.twinkleSpeed + bp.phase));

      // 超出顶部则从底部重生（复用对象，避免 new）
      if (bp.y < -bp.size) {
        this._resetBgParticle(bp, true);
      }
      // 超出左右边界则回绕
      if (bp.x < -bp.size) bp.x = GAME_WIDTH + bp.size;
      if (bp.x > GAME_WIDTH + bp.size) bp.x = -bp.size;
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
      g.fillStyle(BG_PARTICLE_COLOR, alpha);
      for (let i = 0; i < items.length; i++) {
        const bp = items[i];
        // 鼠标视差：大粒子（size > 3）偏移系数 0.02，小粒子 0.01
        const factor = bp.size > 3 ? 0.02 : 0.01;
        const ox = this._parallaxCurrentX * factor;
        const oy = this._parallaxCurrentY * factor;
        g.fillRect(bp.x - bp.size / 2 + ox, bp.y - bp.size / 2 + oy, bp.size, bp.size);
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

  screenShake(intensity) {
    this.shakeIntensity = intensity;
  }

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

  /**
   * 翻车强震动 (8px, 300ms)
   */
  shakeHard() {
    this.cameraShake(8, 300);
  }

  /**
   * 重大选择轻微震动 (2px, 100ms)
   */
  shakeLight() {
    this.cameraShake(2, 100);
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
