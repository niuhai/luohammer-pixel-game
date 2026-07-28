import Phaser from 'phaser';
import { AudioSystem } from '../systems/AudioSystem.js';
import { SaveSystem } from '../systems/SaveSystem.js';
import { MetaProgression } from '../systems/MetaProgression.js';
import { GAME_WIDTH, GAME_HEIGHT, GRID, FONTS } from '../config.js';

/**
 * 开场动画「星图 · 人生路口」
 *
 * 核心意象：每一个选择都是一颗星，连成线就是一个人的人生。
 * - 黑暗中心星火点燃（白色闪核 + 冲击环 + 低频轰鸣），星场才渐次亮起
 * - 深空星场淡入（烘焙星云纹理铺底：径向渐变 + 像素噪声斑块 + 银河带）
 * - 双层星场反向漂移（视差纵深），亮星带十字星芒
 * - 流星划向金色路径拐点：星星坠落处火花四溅，选择开始生长
 * - 5 条像素光轨逐格延伸（头部星芒 + 沿途火花），远端节点爆发点亮
 * - 节点点亮浮现人生方向词（理想/担当/热爱/自由/平凡），暗合五大结局家族
 * - 节点点亮伴随五声音阶上行音效，情绪逐星抬升；已点亮光轨有微光周期性流过
 * - 相机随 5.4s 时间线缓慢推近（电影感 slow push），L3 出现时 L1/L2 降透明度聚焦
 * - 终局高潮：L3 浮现同刻微白闪，金色波前从中心沿 5 条光轨冲向远端节点，
 *   星光齐明后全图集体"呼吸"一次，相机脉冲推近
 * - 收场（自然看完）：五轨星光向中心回流汇聚，中心爆发白金闪光，白场顶点切入游戏
 *   （跳过则保持原黑场快速淡出）
 *
 * 文案与视觉互文：
 *   L1 每一个选择，都是一颗星。
 *   L2 连成线，就是一个人的人生。
 *   L3 这一次，换你站在他的十字路口。（"你"字金色高亮 + 波前从中心涌出 = 选择从玩家流向所有可能）
 */
const LINES = [
  { text: '每一个选择，都是一颗星。' },
  { text: '连成线，就是一个人的人生。' },
  {
    text: '这一次，换你站在他的十字路口。',
    highlight: [5],
    accent: [10, 11, 12, 13]
  }
];

// 情感时间线（ms）
const TL = {
  arriveAt: 40,    // 首帧就让旧路星光进入，避免黑场等待
  igniteAt: 420,   // 更早建立“你在这里”的视觉锚点
  line1At: 600,    // L1 文案
  path1At: 1250,   // 第一批光轨（2 条）开始延伸
  line2At: 1550,   // L2 文案
  path2At: 2050,   // 第二批光轨（3 条）
  line3At: 3100,   // L3 文案
  fadeAt: 5400,    // 高潮完整停留约 1s 后收场，避免等待感回升
  skipAt: 350      // 尽早把节奏控制权交给玩家
};

const STEP_MS = 38;      // 光轨每格点亮间隔：五条未来更紧凑地展开
const CENTER = { x: GAME_WIDTH / 2, y: 172 }; // 偏上，下半屏留给文案

// 玩家抵达路口前已经走过的那条路：从画面下方蜿蜒进入中心。
// 它不是第六个选择，而是过去；到达后退成暗金余迹，把视觉主角交给五条未来。
const ARRIVAL = {
  reachAt: TL.igniteAt,
  fadeAt: TL.path2At + 300,
  points: [[354, 356], [370, 310], [362, 266], [388, 220], [400, 172]]
};

// 终局高潮：金色波前从中心沿 5 条光轨涌出（850ms 冲到头），节点白金闪光。
// 同步锚点：L3 共 15 字、760ms 逐字浮现，"你"为 index 5 → line3At + 5×50.7ms ≈ +250ms。
// 波前在"你"字显现的同刻从中心涌出——选择由玩家流向所有可能。
const FINALE = { at: TL.line3At + 250, waveMs: 850 };

// 收场：星光回流中心（480ms）→ 白金爆发切场（240ms）
const CONVERGE_MS = 480;
const BURST_MS = 240;

// 带十字星芒的亮星（固定构图，避开光轨与节点标签区）
const HERO_STARS = [
  { x: 96, y: 56 }, { x: 704, y: 44 }, { x: 236, y: 326 },
  { x: 616, y: 336 }, { x: 756, y: 236 }, { x: 48, y: 232 }
];

/**
 * 5 条人生路径：折点序列 + 终点节点气质色 + 人生方向词。
 * 构图：右侧 3 条（未来感展开），左侧 2 条（平衡画面）。
 * 节点颜色微差暗示不同人生结局气质：金/暖白/淡金/青金/暗金。
 * 方向词暗合游戏五大结局家族：triumph/spotlight/rebirth/peaceful/withdrawn。
 */
const PATH_DEFS = [
  { bends: [[470, 140], [560, 112], [662, 88]],  color: 0xf0c040, node: 0xffd860, label: '理想', labelDx: 0, labelDy: 14 },
  { bends: [[492, 172], [584, 156], [692, 162]], color: 0xe8d5a3, node: 0xfff0c8, label: '担当', labelDx: 0, labelDy: 14 },
  { bends: [[472, 208], [562, 244], [652, 278]], color: 0xd8b860, node: 0xf0d890, label: '热爱', labelDx: 0, labelDy: 16 },
  { bends: [[328, 130], [248, 108], [148, 88]],  color: 0x9ac8d8, node: 0xb8e0f0, label: '自由', labelDx: 0, labelDy: 14 },
  { bends: [[322, 202], [238, 240], [142, 270]], color: 0xb89858, node: 0xd8b878, label: '平凡', labelDx: 0, labelDy: 16 }
];

/**
 * 流星：t=1.5s 亮流星划向金色路径拐点（星星坠落处，选择开始生长），
 * t=4.4s 暗流星掠过左上深空呼应。确定性轨迹，保证每次演出一致。
 */
const METEORS = [
  { at: 1200, dur: 760, x0: 700, y0: 56, x1: 470, y1: 140, dim: false },
  { at: 3400, dur: 680, x0: 96, y0: 36, x1: 300, y1: 104, dim: true }
];

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
          this._ensureGameplayScenes()
            .then(() => this.scene.start('GameScene', {}))
            .catch(error => {
              console.error('[IntroScene] 主游戏资源加载失败:', error);
              this.scene.start('BootScene');
            });
          return;
        }
      } catch (e) {}
    }

    this.audio = new AudioSystem(this);
    this._reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const overlay = document.getElementById('ui-intro-overlay');
    const skipHint = document.getElementById('ui-intro-skip-hint');
    const fade = document.getElementById('ui-intro-fade');

    if (!overlay) {
      this.scene.start('GameScene', {});
      return;
    }

    this._skipEnabled = false;
    this._finished = false;
    this._startTime = 0;
    this._litNodes = 0;
    this._now = 0;            // 场景相对时钟（ms），供粒子/回流使用
    this._prevT = 0;
    this._particles = [];     // 像素火花粒子池（流星撞击/光轨沿途）
    this._impacts = [];       // 流星撞击冲击环
    this._meteorImpacted = METEORS.map(() => false); // 流星撞击触发标记（实例级，可重放）
    this._pathSparked = [0, 0, 0, 0, 0];             // 每条光轨已迸火花的格 index
    this._convergeAt = -1;    // 星光回流开始时刻（-1 = 未进入收场）
    this._burstAt = -1;       // 白金爆发时刻（-1 = 未爆发）
    this._tlQueue = [];       // 单时钟时间线事件队列（update 帧驱动，杜绝双时钟分叉）
    this._tlCursor = 0;       // 队列游标
    this._revealing = [];     // 正在逐字浮现的文案行 {chars, startT, interval, cursor}
    this._naturalEnd = false; // 自然看完收场（回流→爆发→白闪溶解），区别于跳过路径

    // 重置闪白层与文案层（"回顾开场"重放时清除上次的收场状态）
    const flashEl = document.getElementById('ui-scene-flash');
    if (flashEl) { flashEl.style.transition = 'none'; flashEl.style.opacity = '0'; }
    const textLayer = document.querySelector('.ui-intro-text-layer');
    if (textLayer) { textLayer.style.transition = ''; textLayer.style.opacity = ''; }
    const kicker = document.querySelector('.ui-intro-kicker');
    if (kicker) { kicker.style.transition = ''; kicker.style.opacity = ''; }

    // 星云从透明淡入时也必须先清掉标题场景的上一帧，否则最初 700ms 会透出标题字样。
    this.cameras.main.setBackgroundColor('#05050a');

    this._buildStarfield();
    this._buildPaths();

    // 独立实色垫底，确保 IntroScene 首帧就覆盖 BootScene 留在同一 canvas 上的最后画面。
    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x05050a, 1).setOrigin(0, 0);
    this._buildNebula();   // 静态星云纹理（含深空底色），垫底
    this._gfx = this.add.graphics();
    // 绘制顺序：星云纹理(底) < _gfx 星/光轨/节点 < 方向词标签(顶)
    this._buildNodeLabels();
    this._buildCenterLabel();

    // 电影感 slow push：7s 内相机 1.0 → 1.045，静止星图因此"活"起来
    if (!this._reducedMotion) {
      this.cameras.main.setZoom(1);
      this.tweens.add({
        targets: this.cameras.main,
        zoom: 1.045,
        duration: TL.fadeAt,
        ease: 'Sine.easeInOut'
      });
    }

    overlay.classList.add('visible');
    overlay.dataset.stage = '0';
    if (fade) fade.classList.remove('active');
    if (skipHint) skipHint.classList.remove('visible');
    this._resetText();

    // 序章第一帧即预热主游戏代码，让下载/解析与星图演出并行；
    // 收场时仍会 await 同一 Promise，因此失败路径与兜底逻辑保持不变。
    if (!this._returnToBoot) {
      this._ensureGameplayScenes().catch(error => {
        console.warn('[IntroScene] 主游戏资源预热未完成，将在收场时重试:', error);
      });
    }

    // 音频：从标题页点击进入，AudioContext 已解锁，直接起开场 BGM
    this.audio.unlock().then(() => {
      if (!this._finished && this.audio) this.audio.startBGM('intro');
    });

    this._scheduleTimeline(skipHint, fade);
    this._setupSkip(overlay, skipHint, fade);

    this.events.on('shutdown', () => this._cleanup(overlay));
  }

  /** 生成深空星场：~130 颗像素星（1px 远星/2px 主星/3px 亮星分层），30% 带闪烁相位 */
  _buildStarfield() {
    this._stars = [];
    for (let i = 0; i < 130; i++) {
      const roll = Math.random();
      const layer = i % 5 < 3 ? 0 : 1;
      this._stars.push({
        x: Math.floor(Math.random() * GAME_WIDTH / GRID) * GRID,
        y: Math.floor(Math.random() * GAME_HEIGHT / GRID) * GRID,
        size: roll < 0.25 ? 1 : roll < 0.82 ? 2 : 3,
        base: (0.15 + Math.random() * 0.45) * (layer === 1 ? 1.25 : 1),
        twinkle: Math.random() < 0.3,
        phase: Math.random() * Math.PI * 2,
        speed: 0.6 + Math.random() * 1.2,
        warm: Math.random() < 0.35, // 淡金星 vs 白星
        layer
      });
    }
    // 银河带：y = 0.16x + 24 附近高斯散布的 1px 微星群，增加深空质感
    for (let i = 0; i < 36; i++) {
      const bx = Math.random() * GAME_WIDTH;
      const spread = (Math.random() + Math.random() - 1) * 34;
      const by = 0.16 * bx + 24 + spread;
      if (by < 0 || by > GAME_HEIGHT) continue;
      this._stars.push({
        x: Math.floor(bx / GRID) * GRID,
        y: Math.floor(by / GRID) * GRID,
        size: 1,
        base: 0.18 + Math.random() * 0.28,
        twinkle: Math.random() < 0.4,
        phase: Math.random() * Math.PI * 2,
        speed: 0.5 + Math.random() * 0.9,
        warm: Math.random() < 0.5,
        layer: 0
      });
    }
  }

  /**
   * 烘焙深空星云纹理（一次性，静态 Image 垫底，替代每帧 fillCircle）。
   * 深空底色渐变 + 三团径向渐变星云 + 像素噪声斑块（打破 CG 感，回到像素质地）。
   */
  _buildNebula() {
    const KEY = 'intro-nebula';
    if (!this.textures.exists(KEY)) {
      const W = GAME_WIDTH, H = GAME_HEIGHT;
      const tex = this.textures.createCanvas(KEY, W, H);
      const ctx = tex.getContext();

      // 深空底色（原 _draw 里的每帧渐变，烘焙进纹理）
      const bg = ctx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, '#05050a');
      bg.addColorStop(1, '#0e0c16');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      const BLOBS = [
        { x: 0.80, y: 0.18, r: 0.36, c: '138,106,48', a: 0.40 }, // 右上暖金
        { x: 0.16, y: 0.78, r: 0.40, c: '42,74,94',   a: 0.44 }, // 左下青蓝
        { x: 0.50, y: 0.98, r: 0.44, c: '58,42,78',   a: 0.36 }  // 底部微紫
      ];
      for (const b of BLOBS) {
        const R = b.r * W;
        const grad = ctx.createRadialGradient(b.x * W, b.y * H, 0, b.x * W, b.y * H, R);
        grad.addColorStop(0, `rgba(${b.c},${b.a})`);
        grad.addColorStop(0.55, `rgba(${b.c},${(b.a * 0.4).toFixed(3)})`);
        grad.addColorStop(1, `rgba(${b.c},0)`);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, W, H);
        // 像素噪声斑块：GRID 对齐的小方块，越靠边缘越淡
        for (let i = 0; i < 240; i++) {
          const ang = Math.random() * Math.PI * 2;
          const d = Math.sqrt(Math.random()) * R * 0.9;
          const px = Math.round((b.x * W + Math.cos(ang) * d) / GRID) * GRID;
          const py = Math.round((b.y * H + Math.sin(ang) * d) / GRID) * GRID;
          const fall = 1 - d / R;
          ctx.fillStyle = `rgba(${b.c},${((0.05 + Math.random() * 0.11) * fall).toFixed(3)})`;
          ctx.fillRect(px, py, GRID, GRID);
        }
      }
      tex.refresh();
    }
    this._nebulaImg = this.add.image(0, 0, KEY).setOrigin(0, 0);
    if (this._reducedMotion) {
      this._nebulaImg.setAlpha(1);
    } else {
      // 与星场同步淡入，深空"亮起来"
      this._nebulaImg.setAlpha(0);
      this.tweens.add({ targets: this._nebulaImg, alpha: 1, duration: 1400, ease: 'Sine.easeIn' });
    }
  }

  /** 把折线展开为 GRID 步进的像素点序列 */
  _expandPolyline(points) {
    const cells = [];
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i], b = points[i + 1];
      const dist = Math.hypot(b.x - a.x, b.y - a.y);
      const steps = Math.max(1, Math.round(dist / (GRID * 2)));
      for (let s = 1; s <= steps; s++) {
        const t = s / steps;
        cells.push({
          x: Math.round((a.x + (b.x - a.x) * t) / GRID) * GRID,
          y: Math.round((a.y + (b.y - a.y) * t) / GRID) * GRID
        });
      }
    }
    return cells;
  }

  /** 建立五条未来光轨，并准备一条从过去抵达路口的来路 */
  _buildPaths() {
    this._paths = PATH_DEFS.map(def => {
      const pts = [{ x: CENTER.x, y: CENTER.y }];
      def.bends.forEach(([x, y]) => pts.push({ x, y }));
      const cells = this._expandPolyline(pts);
      const end = pts[pts.length - 1];
      return { ...def, points: pts, cells, endX: end.x, endY: end.y, litAt: -1, flashAt: -1 };
    });
    this._arrivalCells = this._expandPolyline(ARRIVAL.points.map(([x, y]) => ({ x, y })));
  }

  /** 为每个终点节点创建人生方向词标签（初始隐藏，节点点亮时弹性浮现） */
  _buildNodeLabels() {
    // 竖屏移动端：画布 FIT 缩放 ~0.47，15px 方向词显示仅 ~7px 不可读，
    // 放大到 21px（显示 ~10px）+ 加粗描边保住"人生方向"信息载体
    const portrait = this.registry.get('isPortraitMobile') === true;
    const fontSize = portrait ? '20px' : '14px';
    const strokeW = portrait ? 3 : 2;
    this._nodeLabels = this._paths.map(p => {
      const color = '#' + p.node.toString(16).padStart(6, '0');
      return this.add.text(p.endX + p.labelDx, p.endY + p.labelDy, p.label, {
        fontFamily: FONTS.chinese,
        fontSize,
        color,
        letterSpacing: portrait ? 3 : 2
      }).setOrigin(0.5, 0).setAlpha(0).setScale(0.72).setStroke('#07070b', strokeW);
    });
  }

  /** 路口中心的玩家站位提示：克制显示，不与方向词争夺视觉层级 */
  _buildCenterLabel() {
    const portrait = this.registry.get('isPortraitMobile') === true;
    this._centerLabel = this.add.text(CENTER.x, CENTER.y + 25, '此刻 · 你', {
      fontFamily: FONTS.chinese,
      fontSize: portrait ? '17px' : '11px',
      color: '#fff0c8',
      letterSpacing: portrait ? 4 : 3
    }).setOrigin(0.5, 0).setAlpha(0).setScale(0.94).setStroke('#07070b', portrait ? 3 : 2);
  }

  update(time) {
    if (this._finished) return;
    if (this._startTime === 0) this._startTime = time;
    const t = time - this._startTime;
    this._now = t;

    // 单时钟时间线：文案浮现/音效/跳过提示全部由场景相对时钟 t 驱动（与绘制同一时钟）。
    // delayedCall 走 Phaser Clock，帧 delta 在低性能设备被钳制时会滞后于 RAF 时钟，
    // 导致文案比画面慢（双时钟分叉）——整条时间线必须同钟，"他"字与波前的同步才在全设备成立。
    while (this._tlCursor < this._tlQueue.length && t >= this._tlQueue[this._tlCursor].at) {
      this._tlQueue[this._tlCursor++].fn();
    }
    // 逐字浮现推进（同钟驱动）
    for (let r = this._revealing.length - 1; r >= 0; r--) {
      const rev = this._revealing[r];
      const target = Math.min(rev.chars.length, Math.floor((t - rev.startT) / rev.interval) + 1);
      while (rev.cursor < target) rev.chars[rev.cursor++].classList.add('revealed');
      if (rev.cursor >= rev.chars.length) this._revealing.splice(r, 1);
    }

    this._draw(t);

    // 检测光轨全部走完 → 触发节点点亮 + 音阶音效 + 方向词浮现
    this._paths.forEach((p, i) => {
      const startAt = this._pathStartAt(i);
      const doneAt = startAt + p.cells.length * STEP_MS;
      if (p.litAt < 0 && t >= doneAt) {
        p.litAt = t;
        if (this.audio) this.audio.playIntroNode(this._litNodes);
        const label = this._nodeLabels[i];
        if (label) {
          if (this._reducedMotion) {
            label.setAlpha(0.9).setScale(1);
          } else {
            this.tweens.add({ targets: label, alpha: 0.9, scale: 1, duration: 650, ease: 'Back.easeOut' });
          }
        }
        this._litNodes++;
      }
    });

    // 流星到达拐点：火花迸发 + 冲击环（星星坠落处，选择开始生长）
    if (!this._reducedMotion && this._convergeAt < 0) {
      METEORS.forEach((m, i) => {
        const arriveAt = m.at + m.dur;
        if (!this._meteorImpacted[i] && t >= arriveAt) {
          this._meteorImpacted[i] = true;
          this._spawnBurst(m.x1, m.y1, m.dim ? 8 : 16, m.dim, false, t);
          this._impacts.push({ x: m.x1, y: m.y1, at: t, dim: m.dim });
        }
      });
      // 光轨头部沿途火花：每前进 6 格迸 1 颗微火花
      this._paths.forEach((p, i) => {
        const startAt = this._pathStartAt(i);
        if (t < startAt) return;
        const litCount = Math.min(p.cells.length, Math.floor((t - startAt) / STEP_MS) + 1);
        const nextSpark = this._pathSparked[i] + 6;
        if (litCount >= nextSpark && nextSpark < p.cells.length) {
          this._pathSparked[i] = nextSpark;
          const cell = p.cells[nextSpark];
          this._spawnBurst(cell.x, cell.y, 1, false, true, t);
        }
      });
    }

    // 收场序列由场景相对时钟 t 驱动（与视觉同一时钟，避免低性能设备上双时钟分叉导致收场过晚）
    if (!this._reducedMotion) {
      if (this._convergeAt < 0 && t >= TL.fadeAt) {
        this._startConverge(t);
      } else if (this._convergeAt >= 0 && this._burstAt < 0 && t >= this._convergeAt + CONVERGE_MS) {
        this._burst(t);
      } else if (this._burstAt >= 0 && t >= this._burstAt + BURST_MS + 90) {
        this._convergeFinish();
      }
    }
  }

  /** 第 i 条光轨的开始延伸时刻：第一批 [0,1]，第二批 [2,3,4] 错落 */
  _pathStartAt(i) {
    if (this._reducedMotion) return 0;
    if (i < 2) return TL.path1At + i * 180;
    return TL.path2At + (i - 2) * 220;
  }

  _draw(t) {
    const g = this._gfx;
    g.clear();
    // 深空底色与星云已烘焙进 _nebulaImg 纹理（垫底），这里只画动态元素

    this._drawStars(g, t);
    this._drawHeroStars(g, t);
    this._drawGhostNetwork(g, t);
    this._drawArrival(g, t);
    this._drawPaths(g, t);
    this._drawMeteors(g, t);
    this._drawParticles(g, t);
    this._drawNodes(g, t);
    this._drawHeart(g, t);
  }

  /** 未被选择的未来先以极淡的星尘伏笔存在，点亮时才真正成为路 */
  _drawGhostNetwork(g, t) {
    if (this._convergeAt >= 0 || t < 900) return;
    const reveal = Math.min(1, (t - 900) / 900);
    const breathe = this._reducedMotion ? 1 : 0.8 + Math.sin(t / 2200 * Math.PI * 2) * 0.2;
    this._paths.forEach((p, pathIndex) => {
      for (let c = pathIndex % 2; c < p.cells.length; c += 3) {
        const cell = p.cells[c];
        g.fillStyle(p.color, 0.055 * reveal * breathe);
        g.fillRect(cell.x - 1, cell.y - 1, 2, 2);
      }
    });
  }

  /** 过去的路由下向上抵达中心：亮头前进、身后留下渐暗的像素足迹 */
  _drawArrival(g, t) {
    if (!this._arrivalCells || t < TL.arriveAt || t > ARRIVAL.fadeAt) return;
    const moving = t < ARRIVAL.reachAt;
    const progress = moving
      ? Math.min(1, (t - TL.arriveAt) / (ARRIVAL.reachAt - TL.arriveAt))
      : 1;
    const count = Math.max(1, Math.floor(progress * this._arrivalCells.length));
    const fade = moving ? 1 : Math.max(0, 1 - (t - ARRIVAL.reachAt) / (ARRIVAL.fadeAt - ARRIVAL.reachAt));

    for (let c = 0; c < count; c++) {
      const cell = this._arrivalCells[c];
      const fromHead = count - 1 - c;
      const wake = Math.max(0.18, 1 - fromHead / 18);
      const alpha = fade * (moving ? wake : 0.36);
      g.fillStyle(0xd8b878, 0.05 * alpha);
      g.fillRect(cell.x - 4, cell.y - 4, 8, 8);
      g.fillStyle(0xe8d5a3, 0.68 * alpha);
      g.fillRect(cell.x - 1.5, cell.y - 1.5, 3, 3);
    }

    if (moving) {
      const head = this._arrivalCells[count - 1];
      g.fillStyle(0xfff4d8, 0.28);
      g.fillCircle(head.x, head.y, 10);
      g.fillStyle(0xffffff, 0.95);
      g.fillRect(head.x - 2, head.y - 2, 4, 4);
    }
  }

  /** 在 (x,y) 迸发像素火花：径向飞散 + 微下坠 + 渐隐；micro=沿途单颗微火花 */
  _spawnBurst(x, y, count, dim, micro, t) {
    for (let i = 0; i < count; i++) {
      const ang = Math.random() * Math.PI * 2;
      const sp = micro ? 0.015 + Math.random() * 0.03 : 0.05 + Math.random() * 0.11;
      this._particles.push({
        x, y,
        vx: Math.cos(ang) * sp,
        vy: Math.sin(ang) * sp - (micro ? 0.01 : 0.015),
        at: t,
        life: micro ? 320 : 500 + Math.random() * 250,
        size: micro ? 1 : (Math.random() < 0.4 ? 2 : 1),
        color: dim ? 0xd8dce8 : (Math.random() < 0.6 ? 0xffe080 : 0xfff4d8)
      });
    }
    // 池上限：极端帧率下也不失控
    if (this._particles.length > 120) this._particles.splice(0, this._particles.length - 120);
  }

  /** 火花与冲击环：流星撞击处环扩散，火花 GRID 对齐跳格飞行（像素质感） */
  _drawParticles(g, t) {
    if (this._particles.length === 0 && this._impacts.length === 0) return;
    // 冲击环：520ms 扩散衰减
    this._impacts = this._impacts.filter(r => t - r.at < 520);
    for (const r of this._impacts) {
      const k = (t - r.at) / 520;
      g.lineStyle(1.5, r.dim ? 0xd8dce8 : 0xffd860, (r.dim ? 0.3 : 0.5) * (1 - k));
      g.strokeCircle(r.x, r.y, 6 + k * 42);
    }
    // 火花：径向飞散 + 轻微重力
    this._particles = this._particles.filter(pt => t - pt.at < pt.life);
    const dt = Math.min(50, Math.max(0, t - this._prevT));
    for (const pt of this._particles) {
      const k = (t - pt.at) / pt.life;
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vy += 0.0012 * dt;
      const px = Math.round(pt.x / GRID) * GRID;
      const py = Math.round(pt.y / GRID) * GRID;
      g.fillStyle(pt.color, (1 - k) * 0.9);
      g.fillRect(px, py, pt.size, pt.size);
    }
    this._prevT = t;
  }

  /** 流星：头部亮、尾部渐隐的像素 streak，ease-out 减速 */
  _drawMeteors(g, t) {
    if (this._reducedMotion) return;
    for (const m of METEORS) {
      if (t < m.at || t > m.at + m.dur) continue;
      const k = (t - m.at) / m.dur;
      const ease = 1 - (1 - k) * (1 - k);
      const hx = m.x0 + (m.x1 - m.x0) * ease;
      const hy = m.y0 + (m.y1 - m.y0) * ease;
      const dx = m.x1 - m.x0, dy = m.y1 - m.y0;
      const len = Math.hypot(dx, dy);
      const ux = dx / len, uy = dy / len;
      const baseA = (m.dim ? 0.45 : 0.8) * Math.sin(Math.PI * Math.min(1, k * 1.15));
      const segs = 7;
      for (let s = 0; s < segs; s++) {
        const d = s * 9;
        const px = Math.round((hx - ux * d) / GRID) * GRID;
        const py = Math.round((hy - uy * d) / GRID) * GRID;
        g.fillStyle(0xfff4d8, baseA * (1 - s / segs));
        g.fillRect(px, py, s === 0 ? 3 : 2, s === 0 ? 3 : 2);
      }
    }
  }

  _drawStars(g, t) {
    const fadeIn = this._reducedMotion ? 1 : Math.min(1, t / 800);
    // 星光齐明：终局波前到齐后，全星场在 900ms 内亮度抬升 40%，整个星空参与高潮
    let swell = 1;
    if (!this._reducedMotion && t >= FINALE.at + FINALE.waveMs) {
      swell = 1 + Math.min(1, (t - FINALE.at - FINALE.waveMs) / 900) * 0.4;
    }
    // 双层反向漂移（视差纵深）：远层慢、近层快且反向，GRID 取整保持像素跳格感
    const drift = this._reducedMotion ? 0 : (t / TL.fadeAt) * 3;
    for (const s of this._stars) {
      let alpha = s.base * fadeIn * swell;
      if (s.twinkle && !this._reducedMotion) {
        alpha *= 0.5 + 0.5 * Math.sin(t / 1000 * s.speed * Math.PI + s.phase);
      }
      const dx = Math.round((s.layer === 0 ? drift : -drift * 1.4) / GRID) * GRID;
      g.fillStyle(s.warm ? 0xf0e0b8 : 0xd8dce8, Math.min(1, alpha));
      g.fillRect(s.x + dx, s.y, s.size, s.size);
    }
  }

  /** 亮星带十字星芒：6 颗固定构图锚点（避开光轨与标签区），呼吸明暗，随终局齐明 */
  _drawHeroStars(g, t) {
    const fadeIn = this._reducedMotion ? 1 : Math.min(1, t / 1200);
    if (fadeIn <= 0) return;
    let swell = 1;
    if (!this._reducedMotion && t >= FINALE.at + FINALE.waveMs) {
      swell = 1 + Math.min(1, (t - FINALE.at - FINALE.waveMs) / 900) * 0.4;
    }
    for (const h of HERO_STARS) {
      const breathe = this._reducedMotion ? 1 : 0.85 + 0.15 * Math.sin(t / 1800 * Math.PI * 2 + h.x);
      const a = Math.min(1, fadeIn * swell * breathe);
      // 3px 亮核
      g.fillStyle(0xfff4d8, 0.9 * a);
      g.fillRect(h.x - 1, h.y - 1, 3, 3);
      // 十字星芒：上下左右两臂渐隐（内段实、外段虚）
      g.fillStyle(0xf0e0b8, 0.5 * a);
      g.fillRect(h.x, h.y - 5, 1, 4);
      g.fillRect(h.x, h.y + 2, 1, 4);
      g.fillRect(h.x - 5, h.y, 4, 1);
      g.fillRect(h.x + 2, h.y, 4, 1);
      g.fillStyle(0xf0e0b8, 0.22 * a);
      g.fillRect(h.x, h.y - 8, 1, 2);
      g.fillRect(h.x, h.y + 7, 1, 2);
      g.fillRect(h.x - 8, h.y, 2, 1);
      g.fillRect(h.x + 7, h.y, 2, 1);
    }
  }

  /** 中心节点："此刻的你" —— 像素核心 + 呼吸光晕 */
  _drawHeart(g, t) {
    const appear = this._reducedMotion ? 0 : TL.igniteAt;
    if (t < appear) return;
    const grow = this._reducedMotion ? 1 : Math.min(1, (t - appear) / 500);
    const breathe = this._reducedMotion ? 1 : 1 + Math.sin(t / 2400 * Math.PI * 2) * 0.12;
    const r = 14 * breathe * grow;

    // 命运罗盘刻度：极慢旋转的方向感，不增加强光，只给中心更多空间层次。
    const dialRotation = this._reducedMotion ? 0 : t / 14000;
    const dialAlpha = 0.16 * grow;
    for (let i = 0; i < 12; i++) {
      const angle = dialRotation + i / 12 * Math.PI * 2;
      const cardinal = i % 3 === 0;
      const inner = cardinal ? 29 : 31;
      const outer = cardinal ? 38 : 35;
      g.lineStyle(1, cardinal ? 0xffe0a0 : 0xd8b860, dialAlpha * (cardinal ? 1 : 0.58));
      g.beginPath();
      g.moveTo(CENTER.x + Math.cos(angle) * inner, CENTER.y + Math.sin(angle) * inner);
      g.lineTo(CENTER.x + Math.cos(angle) * outer, CENTER.y + Math.sin(angle) * outer);
      g.strokePath();
    }

    // 四层光晕渐进，消除圆盘边缘感
    g.fillStyle(0xf0c040, 0.08 * grow);
    g.fillCircle(CENTER.x, CENTER.y, r * 3.6);
    g.fillStyle(0xf0c040, 0.12 * grow);
    g.fillCircle(CENTER.x, CENTER.y, r * 2.6);
    g.fillStyle(0xf0c040, 0.18 * grow);
    g.fillCircle(CENTER.x, CENTER.y, r * 1.8);
    g.fillStyle(0xf0c040, 0.26 * grow);
    g.fillCircle(CENTER.x, CENTER.y, r * 1.2);
    // 像素核心：金色方块（星图的起点）
    const core = Math.max(GRID, Math.round(10 * grow / GRID) * GRID);
    g.fillStyle(0xffe080, 0.95 * grow);
    g.fillRect(CENTER.x - core / 2, CENTER.y - core / 2, core, core);

    // 点燃瞬间（前 460ms）：白色闪核 + 冲击环，黑暗中第一颗星的"诞生"
    if (!this._reducedMotion && t < appear + 460) {
      const ik = (t - appear) / 460;
      // 白色闪核：比金核更大、快速衰减
      if (ik < 0.55) {
        const wk = ik / 0.55;
        const ws = 16 * (1 - wk * 0.5);
        g.fillStyle(0xffffff, 0.9 * (1 - wk));
        g.fillRect(CENTER.x - ws / 2, CENTER.y - ws / 2, ws, ws);
      }
      // 冲击环：向外扩散的亮环
      g.lineStyle(2, 0xfff4d8, 0.65 * (1 - ik));
      g.strokeCircle(CENTER.x, CENTER.y, 8 + ik * 72);
      g.lineStyle(1, 0xf0c040, 0.4 * (1 - ik));
      g.strokeCircle(CENTER.x, CENTER.y, 4 + ik * 46);
    }

    // 心跳脉冲环：每 2.4s 一圈向外扩散，与呼吸同频
    if (!this._reducedMotion && t > appear + 600) {
      const ringAge = (t - appear - 600) % 2400;
      if (ringAge < 1200) {
        const rk = ringAge / 1200;
        g.lineStyle(1.5, 0xf0c040, 0.2 * (1 - rk));
        g.strokeCircle(CENTER.x, CENTER.y, 24 + rk * 58);
      }
    }

    // 终局爆发：L3 时刻中心涌出一轮大金色脉冲环（光轨波前的源头）
    if (!this._reducedMotion && t >= FINALE.at) {
      const fs = t - FINALE.at;
      if (fs < 700) {
        const k = fs / 700;
        g.lineStyle(2, 0xffd860, 0.5 * (1 - k));
        g.strokeCircle(CENTER.x, CENTER.y, 16 + k * 96);
        // 核心短暂超亮
        if (fs < 260) {
          const fk = fs / 260;
          g.fillStyle(0xfff4d8, 0.55 * (1 - fk));
          g.fillCircle(CENTER.x, CENTER.y, 18 * (1 - fk * 0.4));
        }
      }
    }

    // 收场回流中：五轨星光汇入，中心随之增亮
    if (!this._reducedMotion && this._convergeAt >= 0 && this._burstAt < 0) {
      const ck = Math.min(1, (t - this._convergeAt) / CONVERGE_MS);
      g.fillStyle(0xffd860, 0.25 * ck);
      g.fillCircle(CENTER.x, CENTER.y, 16 + ck * 10);
    }

    // 收场白金爆发：回流星光在中心汇聚成一颗超亮新星
    if (!this._reducedMotion && this._burstAt >= 0) {
      const bk = Math.min(1, (t - this._burstAt) / BURST_MS);
      g.fillStyle(0xfff4d8, 0.5 * (1 - bk));
      g.fillCircle(CENTER.x, CENTER.y, 24 + bk * 200);
      const bs = 10 + bk * 26;
      g.fillStyle(0xffffff, 0.95);
      g.fillRect(CENTER.x - bs / 2, CENTER.y - bs / 2, bs, bs);
    }
  }

  /** 光轨：逐格点亮，头部亮、尾部暗；终局金色波前沿轨道冲向远端节点 */
  _drawPaths(g, t) {
    // 收场阶段：光轨不再逐格延伸，切换为回流动画
    if (this._convergeAt >= 0) {
      this._drawConverge(g, t);
      return;
    }
    this._paths.forEach((p, i) => {
      const startAt = this._pathStartAt(i);
      if (t < startAt) return;
      const litCount = this._reducedMotion
        ? p.cells.length
        : Math.min(p.cells.length, Math.floor((t - startAt) / STEP_MS) + 1);

      // 低亮连续结构线托住像素光点：远看是一条完整命运轨道，近看仍保留像素颗粒。
      if (litCount > 1) {
        const settled = p.flashAt >= 0;
        g.lineStyle(1, p.color, settled ? 0.2 : 0.1);
        g.beginPath();
        g.moveTo(CENTER.x, CENTER.y);
        for (let c = 1; c < litCount; c += 2) {
          g.lineTo(p.cells[c].x, p.cells[c].y);
        }
        const last = p.cells[litCount - 1];
        g.lineTo(last.x, last.y);
        g.strokePath();
      }

      // 终局波前：L3 同刻从中心涌出，front 是波头所在的格 index
      let waveFront = -1;
      if (!this._reducedMotion && t >= FINALE.at) {
        waveFront = (t - FINALE.at) / FINALE.waveMs * p.cells.length;
        if (p.flashAt < 0 && waveFront >= p.cells.length) p.flashAt = t;
      }

      for (let c = 0; c < litCount; c++) {
        const cell = p.cells[c];
        const distFromHead = litCount - 1 - c;
        let alpha = 0.62;
        if (!this._reducedMotion) {
          if (distFromHead === 0) alpha = 1.0;
          else if (distFromHead === 1) alpha = 0.78;
          else if (distFromHead === 2) alpha = 0.66;
        }
        // 波前经过处增亮（6 格衰减）；波后全轨保持高亮（星座完成态）
        let boost = 0;
        if (waveFront >= 0) {
          boost = Math.max(0, 1 - Math.abs(c - waveFront) / 6);
          alpha = Math.min(1, alpha + boost * 0.55);
        }
        if (p.flashAt >= 0) alpha = Math.max(alpha, 0.8);

        // 全程微光底 + 波前强辉光，像光在轨道上流动
        g.fillStyle(p.color, 0.07 + boost * 0.3);
        g.fillRect(cell.x - 4, cell.y - 4, 8, 8);
        if (distFromHead < 6 || boost > 0.3) {
          g.fillStyle(p.color, alpha * 0.18);
          g.fillRect(cell.x - 5, cell.y - 5, 10, 10);
        }
        g.fillStyle(p.color, alpha);
        g.fillRect(cell.x - 1.5, cell.y - 1.5, 3, 3);
      }
    });
  }

  /** 收场回流：每条光轨的亮点从远端退回中心（头部亮），远端节点余晖渐灭 */
  _drawConverge(g, t) {
    const k = Math.min(1, (t - this._convergeAt) / CONVERGE_MS);
    this._paths.forEach((p) => {
      const front = Math.floor((1 - k) * (p.cells.length - 1)); // 回流头从末端退回 0
      for (let c = 0; c <= front; c++) {
        const cell = p.cells[c];
        const dHead = front - c;
        let alpha = 0.5 * (1 - k * 0.5);
        if (dHead === 0) alpha = 1.0;
        else if (dHead === 1) alpha = 0.75;
        else if (dHead === 2) alpha = 0.6;
        g.fillStyle(p.color, 0.05 + (dHead === 0 ? 0.25 : 0));
        g.fillRect(cell.x - 4, cell.y - 4, 8, 8);
        if (dHead < 3) {
          g.fillStyle(p.color, alpha * 0.2);
          g.fillRect(cell.x - 5, cell.y - 5, 10, 10);
        }
        g.fillStyle(p.color, alpha);
        g.fillRect(cell.x - 1.5, cell.y - 1.5, 3, 3);
      }
      // 远端节点余晖渐灭（比光轨消退更快，先"交出"星光）
      const fadeA = Math.max(0, 1 - k * 1.6);
      if (fadeA > 0) {
        g.fillStyle(p.node, 0.2 * fadeA);
        g.fillCircle(p.endX, p.endY, 10);
        g.fillStyle(p.node, 0.8 * fadeA);
        g.fillRect(p.endX - 2, p.endY - 2, 4, 4);
      }
    });
  }

  /** 远端节点：光轨到达后点亮，一次脉冲环，随后明暗呼吸 */
  _drawNodes(g, t) {
    if (this._convergeAt >= 0) return; // 收场由 _drawConverge 统一绘制节点余晖
    this._paths.forEach((p) => {
      if (p.litAt < 0) return;
      const since = t - p.litAt;

      // 点亮瞬间的脉冲环（400ms 扩散衰减）
      if (!this._reducedMotion && since < 400) {
        const k = since / 400;
        g.fillStyle(p.node, 0.35 * (1 - k));
        g.fillCircle(p.endX, p.endY, 8 + k * 20);
      }

      // 终局波前到达：白金色强闪光（500ms），星光齐明
      if (!this._reducedMotion && p.flashAt >= 0) {
        const fs = t - p.flashAt;
        if (fs < 500) {
          const k = fs / 500;
          g.fillStyle(0xfff4d8, 0.5 * (1 - k));
          g.fillCircle(p.endX, p.endY, 6 + k * 34);
          const fc = 4 + k * 6;
          g.fillStyle(0xffffff, 0.85 * (1 - k));
          g.fillRect(p.endX - fc / 2, p.endY - fc / 2, fc, fc);
        }
      }

      const breathe = this._reducedMotion ? 1 : 1 + Math.sin(t / 2000 * Math.PI * 2 + p.endX) * 0.12;
      g.fillStyle(p.node, 0.16);
      g.fillCircle(p.endX, p.endY, 14 * breathe);
      g.lineStyle(1, p.node, 0.3);
      g.strokeCircle(p.endX, p.endY, 9 * breathe);
      // 稳态节点改为像素菱形路标，比单纯圆点更像一个明确的“方向”
      const r = 5;
      g.fillStyle(p.node, 0.9);
      g.fillPoints([
        { x: p.endX, y: p.endY - r },
        { x: p.endX + r, y: p.endY },
        { x: p.endX, y: p.endY + r },
        { x: p.endX - r, y: p.endY }
      ], true);
      g.fillStyle(0xfff4d8, 0.8);
      g.fillRect(p.endX - 1, p.endY - 1, 2, 2);
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
    // 重置终局聚焦态（回顾开场可重放）
    const layer = document.querySelector('.ui-intro-text-layer');
    if (layer) layer.classList.remove('finale');
  }

  _setupText(lineEl, line) {
    if (!lineEl) return;
    lineEl.innerHTML = '';
    const hl = line.highlight || [];
    const accent = line.accent || [];
    line.text.split('').forEach((char, i) => {
      const span = document.createElement('span');
      span.className = 'ui-intro-char';
      if (hl.includes(i)) span.classList.add('ui-intro-char-hl');
      if (accent.includes(i)) span.classList.add('ui-intro-char-accent');
      span.textContent = char;
      lineEl.appendChild(span);
    });
  }

  /** 注册一行文案的逐字浮现：由 update() 以场景时钟推进（无动画偏好时直接全亮） */
  _startReveal(lineEl, duration = 700) {
    if (!lineEl) return;
    const chars = lineEl.querySelectorAll('.ui-intro-char');
    if (chars.length === 0) return;
    lineEl.classList.add('visible');
    if (this._reducedMotion) {
      chars.forEach(c => c.classList.add('revealed'));
      return;
    }
    this._revealing.push({ chars, startT: this._now, interval: duration / chars.length, cursor: 0 });
  }

  /** 立即展示一行文案（时刻由单时钟队列控制） */
  _showLine(index) {
    if (this._finished) return;
    const overlay = document.getElementById('ui-intro-overlay');
    if (overlay) overlay.dataset.stage = String(index + 1);
    const el = document.getElementById(`ui-intro-line${index + 1}`);
    this._setupText(el, LINES[index]);
    // 前两句承担世界观说明，整行淡入比左起逐字更安静，也不会短暂留下孤立首字；
    // 点题句保留逐字浮现，把唯一的戏剧性节奏留给“换你站在十字路口”。
    if (index < 2 && el) {
      el.querySelectorAll('.ui-intro-char').forEach(char => char.classList.add('revealed'));
      requestAnimationFrame(() => {
        if (!this._finished) el.classList.add('visible');
      });
    } else {
      this._startReveal(el, 760);
    }
    // L3 是情绪最高点：L1/L2 降透明度，视线聚焦到"他"
    if (index === 2) {
      const layer = document.querySelector('.ui-intro-text-layer');
      if (layer) layer.classList.add('finale');
    }
    if (this.audio) {
      this.audio.speak(LINES[index].text, {
        kind: 'intro',
        highlightText: LINES[index].text,
        mood: index === 2 ? 'excited' : 'reflective',
        rate: index === 2 ? 1.04 : 0.98,
        enqueue: true
      });
    }
  }

  _scheduleTimeline(skipHint, fade) {
    if (this._reducedMotion) {
      // 降级：全部静态点亮，文案直接显示，2.5s 后结束（静态无时序同步问题，保留 delayedCall）
      if (this._centerLabel) this._centerLabel.setAlpha(0.72).setScale(1);
      this.time.delayedCall(100, () => this._showLine(0));
      this.time.delayedCall(500, () => this._showLine(1));
      this.time.delayedCall(900, () => this._showLine(2));
      this.time.delayedCall(TL.skipAt, () => {
        this._skipEnabled = true;
        if (skipHint) skipHint.classList.add('visible');
      });
      this.time.delayedCall(2500, () => this._finish(fade));
      return;
    }

    // 正常路径：全部事件进单时钟队列，由 update() 按场景时钟 t 触发
    const Q = (at, fn) => this._tlQueue.push({ at, fn });
    // 中心节点亮起 + 点燃音（低频轰鸣 + 亮光上行）
    Q(TL.igniteAt, () => { if (this.audio) this.audio.playIntroIgnite(); });
    Q(TL.igniteAt + 140, () => {
      if (!this._centerLabel) return;
      this.tweens.add({
        targets: this._centerLabel,
        alpha: 0.72,
        scale: 1,
        duration: 650,
        ease: 'Sine.easeOut'
      });
    });
    Q(TL.line1At, () => this._showLine(0));
    Q(TL.path1At, () => { if (this.audio) this.audio.playIntroPath(); });
    Q(TL.line2At, () => this._showLine(1));
    Q(TL.path2At, () => { if (this.audio) this.audio.playIntroPath(); });
    // 流星音效（与视觉同刻）
    METEORS.forEach(m => Q(m.at, () => { if (this.audio) this.audio.playIntroMeteor(); }));
    Q(TL.line3At, () => this._showLine(2));
    // 终局高潮音效：金色波前从中心涌出（"你"字显现同刻）
    Q(FINALE.at, () => {
      if (this.audio) this.audio.playIntroFinale();
      if (this._centerLabel) {
        this.tweens.add({
          targets: this._centerLabel,
          alpha: 1,
          scale: 1.08,
          y: CENTER.y + 23,
          duration: 360,
          yoyo: true,
          hold: 120,
          ease: 'Sine.easeOut'
        });
      }
    });
    Q(TL.skipAt, () => {
      this._skipEnabled = true;
      if (skipHint) skipHint.classList.add('visible');
    });
    this._tlQueue.sort((a, b) => a.at - b.at);

    // 自然看完的收场序列（回流 → 爆发 → 切场）由 update() 帧驱动，时刻见 TL.fadeAt
  }

  /** 收场第 1 段：五轨星光开始向中心回流，BGM 淡出，方向词与文案层退场 */
  _startConverge(t) {
    if (this._finished) return;
    this._convergeAt = t;
    if (this.audio) this.audio.fadeOutBGM((CONVERGE_MS + BURST_MS) / 1000 + 0.3);
    // 方向词随星光一起回流淡出
    this._nodeLabels.forEach(label => {
      if (label) this.tweens.add({ targets: label, alpha: 0, duration: CONVERGE_MS * 0.75, ease: 'Sine.easeIn' });
    });
    if (this._centerLabel) {
      this.tweens.add({ targets: this._centerLabel, alpha: 0, duration: CONVERGE_MS * 0.75, ease: 'Sine.easeIn' });
    }
    // 文案层同步退场：故事已讲完，文字随星光一起归还夜空，
    // 避免白金爆发/白闪上残留文字鬼影（略快于回流，爆发前已消失）
    const textLayer = document.querySelector('.ui-intro-text-layer');
    if (textLayer) {
      textLayer.style.transition = `opacity ${Math.round(CONVERGE_MS * 0.8)}ms ease-in`;
      textLayer.style.opacity = '0';
    }
    const kicker = document.querySelector('.ui-intro-kicker');
    if (kicker) {
      kicker.style.transition = `opacity ${Math.round(CONVERGE_MS * 0.7)}ms ease-in`;
      kicker.style.opacity = '0';
    }
    // 跳过提示随收场退场（class 驱动，CSS 自带 0.6s 过渡）
    const skipHint = document.getElementById('ui-intro-skip-hint');
    if (skipHint) skipHint.classList.remove('visible');
  }

  /** 收场第 2 段：回流完成 → 白金爆发 + 白闪层点亮（万星归一的低频轰鸣） */
  _burst(t) {
    if (this._finished) return;
    this._burstAt = t;
    if (this.audio) this.audio.playIntroBurst();
    const flashEl = document.getElementById('ui-scene-flash');
    if (flashEl) {
      flashEl.style.transition = `opacity ${BURST_MS}ms ease-in`;
      flashEl.style.opacity = '1';
    }
  }

  /** 收场第 3 段：白场顶点切入游戏（白闪层跨场景停留，新场景就绪后溶解） */
  async _convergeFinish() {
    if (this._finished) return;
    this._finished = true;
    try {
      const save = new SaveSystem(this);
      save.markIntroSeen();
    } catch (e) {}
    const targetKey = this._returnToBoot ? 'BootScene' : 'GameScene';
    const flashEl = document.getElementById('ui-scene-flash');
    const gameLoadingEl = document.getElementById('ui-game-loading');
    let loadingDelay = null;
    if (targetKey === 'GameScene') {
      // 主游戏代码若尚未准备好，不让白闪停成“卡死白屏”。短等待保持电影式溶解，
      // 超过 180ms 就切到明确的加载反馈；GameScene 会继续接管真实资源进度。
      loadingDelay = setTimeout(() => {
        const introOverlay = document.getElementById('ui-intro-overlay');
        if (introOverlay) introOverlay.classList.remove('visible');
        if (flashEl) {
          flashEl.style.transition = 'opacity 220ms ease-out';
          flashEl.style.opacity = '0';
        }
        if (gameLoadingEl) {
          const title = gameLoadingEl.querySelector('.app-loading-title');
          const text = gameLoadingEl.querySelector('.ui-game-loading-text');
          if (title) title.textContent = '正在展开人生…';
          if (text) text.textContent = '正在准备你的第一段故事';
          gameLoadingEl.classList.add('visible');
        }
      }, 180);
      try {
        await this._ensureGameplayScenes();
        clearTimeout(loadingDelay);
      } catch (error) {
        clearTimeout(loadingDelay);
        console.error('[IntroScene] 主游戏资源加载失败:', error);
        if (flashEl) { flashEl.style.transition = 'opacity 240ms ease-out'; flashEl.style.opacity = '0'; }
        if (gameLoadingEl) gameLoadingEl.classList.remove('visible');
        this.scene.start('BootScene');
        return;
      }
    }
    // 白闪溶解：目标场景 create 较重（GameScene ~750ms DOM/数据初始化），
    // 2 帧 RAF 远早于新场景就绪——白闪会溶进黑屏再硬切（实测探针确认）。
    // 改为监听目标场景 create 生命周期事件：create 完成 + 两帧首渲染后，
    // 白闪 480ms ease-out 退场，"从白光中浮现新人生"。
    // 切换黑缝期间白闪停留满白覆盖（BGM 已淡出，如闪光灯余晖）。
    if (flashEl && flashEl.style.opacity === '1') {
      const dissolve = () => {
        if (flashEl.style.opacity !== '1') return; // 已被跳过路径复位
        flashEl.style.transition = 'opacity 480ms ease-out';
        flashEl.style.opacity = '0';
      };
      const target = this.scene.get(targetKey);
      if (target) {
        target.events.once('create', () => {
          requestAnimationFrame(() => requestAnimationFrame(() => {
            if (document.getElementById('ui-scene-flash')) dissolve();
          }));
        });
        // 兜底：目标场景 2s 内未就绪则强制溶解，避免白屏卡死
        setTimeout(dissolve, 2000);
      } else {
        dissolve();
      }
    }
    this.scene.start(targetKey, {});
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

  async _ensureGameplayScenes() {
    const ensureScenes = this.registry.get('ensureGameplayScenes');
    if (typeof ensureScenes === 'function') await ensureScenes();
  }

  _finish(fade) {
    if (!this._skipEnabled || this._finished) return;
    this._finished = true;

    if (this.audio) {
      this.audio.stopSpeaking();
      this.audio.fadeOutBGM(0.8);
    }

    try {
      const save = new SaveSystem(this);
      save.markIntroSeen();
    } catch (e) {}

    const skipHint = document.getElementById('ui-intro-skip-hint');
    if (skipHint) skipHint.classList.remove('visible');
    // 跳过与收场白闪竞争时，以黑淡为准：复位白闪层
    const flashEl = document.getElementById('ui-scene-flash');
    if (flashEl) { flashEl.style.transition = 'none'; flashEl.style.opacity = '0'; }
    if (fade) fade.classList.add('active');

    this.time.delayedCall(800, async () => {
      if (this._returnToBoot) {
        this.scene.start('BootScene');
      } else {
        const gameLoadingEl = document.getElementById('ui-game-loading');
        const loadingDelay = setTimeout(() => {
          const introOverlay = document.getElementById('ui-intro-overlay');
          if (introOverlay) introOverlay.classList.remove('visible');
          if (gameLoadingEl) {
            const title = gameLoadingEl.querySelector('.app-loading-title');
            const text = gameLoadingEl.querySelector('.ui-game-loading-text');
            if (title) title.textContent = '正在展开人生…';
            if (text) text.textContent = '正在准备你的第一段故事';
            gameLoadingEl.classList.add('visible');
          }
        }, 180);
        try {
          await this._ensureGameplayScenes();
          clearTimeout(loadingDelay);
          this.scene.start('GameScene', {});
        } catch (error) {
          clearTimeout(loadingDelay);
          console.error('[IntroScene] 主游戏资源加载失败:', error);
          if (gameLoadingEl) gameLoadingEl.classList.remove('visible');
          if (fade) fade.classList.remove('active');
          this.scene.start('BootScene');
        }
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
}
