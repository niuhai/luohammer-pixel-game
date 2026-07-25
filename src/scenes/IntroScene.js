import Phaser from 'phaser';
import { AudioSystem } from '../systems/AudioSystem.js';
import { SaveSystem } from '../systems/SaveSystem.js';
import { MetaProgression } from '../systems/MetaProgression.js';
import { GAME_WIDTH, GAME_HEIGHT, GRID, FONTS } from '../config.js';

/**
 * 开场动画「星图 · 人生路口」
 *
 * 核心意象：每一个选择都是一颗星，连成线就是一个人的人生。
 * - 深空星场淡入（烘焙星云纹理铺底：径向渐变 + 像素噪声斑块）
 * - 流星划向金色路径拐点：星星坠落处，选择开始生长
 * - 5 条像素光轨逐格延伸（像星座连线），远端节点依次点亮
 * - 节点点亮浮现人生方向词（理想/担当/热爱/自由/平凡），暗合五大结局家族
 * - 节点点亮伴随五声音阶上行音效，情绪逐星抬升
 * - 相机 7s 缓慢推近（电影感 slow push），L3 出现时 L1/L2 降透明度聚焦
 * - 终局高潮：L3 浮现同刻，金色波前从中心沿 5 条光轨冲向远端节点，星光齐明
 * - 全图高亮保持后淡入游戏
 *
 * 文案与视觉互文：
 *   L1 每一个选择，都是一颗星。
 *   L2 连成线，就是一个人的人生。
 *   L3 这一次，换你走他的路。（"他"字金色高亮 + 波前从中心涌出 = 光从"他"流向所有可能）
 */
const LINES = [
  { text: '每一个选择，都是一颗星。' },
  { text: '连成线，就是一个人的人生。' },
  { text: '这一次，换你走他的路。', highlight: [7] } // "他"
];

// 情感时间线（ms）
const TL = {
  heartAt: 500,    // 中心节点亮起
  line1At: 900,    // L1 文案
  path1At: 2100,   // 第一批光轨（2 条）开始延伸
  line2At: 2600,   // L2 文案
  path2At: 3300,   // 第二批光轨（3 条）
  line3At: 4900,   // L3 文案
  fadeAt: 7000,    // 自然结束淡出
  skipAt: 1000     // 可跳过时间
};

const STEP_MS = 55;      // 光轨每格点亮间隔
const CENTER = { x: GAME_WIDTH / 2, y: 172 }; // 偏上，下半屏留给文案

// 终局高潮：L3 浮现同刻，金色波前从中心沿 5 条光轨涌出（850ms 冲到头），节点白金闪光
const FINALE = { at: TL.line3At + 150, waveMs: 850 };

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
  { at: 1500, dur: 900, x0: 700, y0: 56, x1: 470, y1: 140, dim: false },
  { at: 4400, dur: 800, x0: 96, y0: 36, x1: 300, y1: 104, dim: true }
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
          this.scene.start('GameScene', {});
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

    this._buildStarfield();
    this._buildPaths();

    this._buildNebula();   // 静态星云纹理（含深空底色），垫底
    this._gfx = this.add.graphics();
    // 绘制顺序：星云纹理(底) < _gfx 星/光轨/节点 < 方向词标签(顶)
    this._buildNodeLabels();

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
    if (fade) fade.classList.remove('active');
    if (skipHint) skipHint.classList.remove('visible');
    this._resetText();

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
      this._stars.push({
        x: Math.floor(Math.random() * GAME_WIDTH / GRID) * GRID,
        y: Math.floor(Math.random() * GAME_HEIGHT / GRID) * GRID,
        size: roll < 0.25 ? 1 : roll < 0.82 ? 2 : 3,
        base: 0.15 + Math.random() * 0.45,
        twinkle: Math.random() < 0.3,
        phase: Math.random() * Math.PI * 2,
        speed: 0.6 + Math.random() * 1.2,
        warm: Math.random() < 0.35 // 淡金星 vs 白星
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
        { x: 0.80, y: 0.18, r: 0.36, c: '138,106,48', a: 0.34 }, // 右上暖金
        { x: 0.16, y: 0.78, r: 0.40, c: '42,74,94',   a: 0.38 }, // 左下青蓝
        { x: 0.50, y: 0.98, r: 0.44, c: '58,42,78',   a: 0.30 }  // 底部微紫
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

  /** 把每条折线路径展开为 GRID 步进的像素点序列 */
  _buildPaths() {
    this._paths = PATH_DEFS.map(def => {
      const pts = [{ x: CENTER.x, y: CENTER.y }];
      def.bends.forEach(([x, y]) => pts.push({ x, y }));
      const cells = [];
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i], b = pts[i + 1];
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
      const end = pts[pts.length - 1];
      return { ...def, cells, endX: end.x, endY: end.y, litAt: -1, flashAt: -1 };
    });
  }

  /** 为每个终点节点创建人生方向词标签（初始隐藏，节点点亮时弹性浮现） */
  _buildNodeLabels() {
    this._nodeLabels = this._paths.map(p => {
      const color = '#' + p.node.toString(16).padStart(6, '0');
      return this.add.text(p.endX + p.labelDx, p.endY + p.labelDy, p.label, {
        fontFamily: FONTS.chinese,
        fontSize: '15px',
        color
      }).setOrigin(0.5, 0).setAlpha(0).setScale(0.6).setStroke('#0a0a0a', 3);
    });
  }

  update(time) {
    if (this._finished) return;
    if (this._startTime === 0) this._startTime = time;
    const t = time - this._startTime;
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
    this._drawMeteors(g, t);
    this._drawHeart(g, t);
    this._drawPaths(g, t);
    this._drawNodes(g, t);
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
    for (const s of this._stars) {
      let alpha = s.base * fadeIn;
      if (s.twinkle && !this._reducedMotion) {
        alpha *= 0.5 + 0.5 * Math.sin(t / 1000 * s.speed * Math.PI + s.phase);
      }
      g.fillStyle(s.warm ? 0xf0e0b8 : 0xd8dce8, alpha);
      g.fillRect(s.x, s.y, s.size, s.size);
    }
  }

  /** 中心节点："此刻的你" —— 像素核心 + 呼吸光晕 */
  _drawHeart(g, t) {
    const appear = this._reducedMotion ? 0 : TL.heartAt;
    if (t < appear) return;
    const grow = this._reducedMotion ? 1 : Math.min(1, (t - appear) / 500);
    const breathe = this._reducedMotion ? 1 : 1 + Math.sin(t / 2400 * Math.PI * 2) * 0.12;
    const r = 14 * breathe * grow;

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
  }

  /** 光轨：逐格点亮，头部亮、尾部暗；终局金色波前沿轨道冲向远端节点 */
  _drawPaths(g, t) {
    this._paths.forEach((p, i) => {
      const startAt = this._pathStartAt(i);
      if (t < startAt) return;
      const litCount = this._reducedMotion
        ? p.cells.length
        : Math.min(p.cells.length, Math.floor((t - startAt) / STEP_MS) + 1);

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

  /** 远端节点：光轨到达后点亮，一次脉冲环，随后明暗呼吸 */
  _drawNodes(g, t) {
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

      const breathe = this._reducedMotion ? 1 : 1 + Math.sin(t / 2000 * Math.PI * 2 + p.endX) * 0.15;
      g.fillStyle(p.node, 0.2);
      g.fillCircle(p.endX, p.endY, 12 * breathe);
      const core = 5;
      g.fillStyle(p.node, 0.9);
      g.fillRect(p.endX - core / 2, p.endY - core / 2, core, core);
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
    line.text.split('').forEach((char, i) => {
      const span = document.createElement('span');
      span.className = 'ui-intro-char';
      if (hl.includes(i)) span.classList.add('ui-intro-char-hl');
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

  _showLine(index, at) {
    this.time.delayedCall(at, () => {
      if (this._finished) return;
      const el = document.getElementById(`ui-intro-line${index + 1}`);
      this._setupText(el, LINES[index]);
      this._revealChars(el, 900);
      // L3 是情绪最高点：L1/L2 降透明度，视线聚焦到"他"
      if (index === 2) {
        const layer = document.querySelector('.ui-intro-text-layer');
        if (layer) layer.classList.add('finale');
      }
      if (this.audio) this.audio.speak(LINES[index].text, { force: true });
    });
  }

  _scheduleTimeline(skipHint, fade) {
    if (this._reducedMotion) {
      // 降级：全部静态点亮，文案直接显示，2.5s 后结束
      this._showLine(0, 100);
      this._showLine(1, 500);
      this._showLine(2, 900);
      this.time.delayedCall(TL.skipAt, () => {
        this._skipEnabled = true;
        if (skipHint) skipHint.classList.add('visible');
      });
      this.time.delayedCall(2500, () => this._finish(fade));
      return;
    }

    // 中心节点亮起 + 心跳音
    this.time.delayedCall(TL.heartAt, () => {
      if (!this._finished && this.audio) this.audio.playIntroHeart();
    });

    this._showLine(0, TL.line1At);
    this._showLine(1, TL.line2At);
    this._showLine(2, TL.line3At);

    // 两批光轨的延伸音效
    this.time.delayedCall(TL.path1At, () => {
      if (!this._finished && this.audio) this.audio.playIntroPath();
    });
    this.time.delayedCall(TL.path2At, () => {
      if (!this._finished && this.audio) this.audio.playIntroPath();
    });

    // 流星音效（与视觉同刻）
    METEORS.forEach(m => {
      this.time.delayedCall(m.at, () => {
        if (!this._finished && this.audio) this.audio.playIntroMeteor();
      });
    });

    // 终局高潮音效：金色波前从中心涌出
    this.time.delayedCall(FINALE.at, () => {
      if (!this._finished && this.audio) this.audio.playIntroFinale();
    });

    this.time.delayedCall(TL.skipAt, () => {
      this._skipEnabled = true;
      if (skipHint) skipHint.classList.add('visible');
    });

    this.time.delayedCall(TL.fadeAt, () => this._finish(fade));
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
    if (fade) fade.classList.add('active');

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
}
