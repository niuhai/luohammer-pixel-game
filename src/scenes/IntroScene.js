import Phaser from 'phaser';
import { AudioSystem } from '../systems/AudioSystem.js';
import { SaveSystem } from '../systems/SaveSystem.js';
import { MetaProgression } from '../systems/MetaProgression.js';
import { GAME_WIDTH, GAME_HEIGHT, GRID } from '../config.js';

/**
 * 开场动画「星图 · 人生路口」
 *
 * 核心意象：每一个选择都是一颗星，连成线就是一个人的人生。
 * - 深空星场淡入 → 中心节点（此刻的你）亮起
 * - 5 条像素光轨逐格延伸（像星座连线），远端节点依次点亮
 * - 节点点亮伴随五声音阶上行音效，情绪逐星抬升
 * - 全图呼吸后淡入游戏
 *
 * 文案与视觉互文：
 *   L1 每一个选择，都是一颗星。
 *   L2 连成线，就是一个人的人生。
 *   L3 这一次，换你走他的路。（"他"字金色高亮，暗扣主角）
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

/**
 * 5 条人生路径：折点序列 + 终点节点气质色。
 * 构图：右侧 3 条（未来感展开），左侧 2 条（平衡画面）。
 * 节点颜色微差暗示不同人生结局气质：金/暖白/淡金/青金/暗金。
 */
const PATH_DEFS = [
  { bends: [[470, 140], [560, 112], [662, 88]],  color: 0xf0c040, node: 0xffd860 },
  { bends: [[492, 172], [584, 156], [692, 162]], color: 0xe8d5a3, node: 0xfff0c8 },
  { bends: [[472, 208], [562, 244], [652, 278]], color: 0xd8b860, node: 0xf0d890 },
  { bends: [[328, 130], [248, 108], [148, 88]],  color: 0x9ac8d8, node: 0xb8e0f0 },
  { bends: [[322, 202], [238, 240], [142, 270]], color: 0xb89858, node: 0xd8b878 }
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

    this._gfx = this.add.graphics();

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

  /** 生成深空星场：~90 颗像素星，30% 带闪烁相位 */
  _buildStarfield() {
    this._stars = [];
    for (let i = 0; i < 90; i++) {
      this._stars.push({
        x: Math.floor(Math.random() * GAME_WIDTH / GRID) * GRID,
        y: Math.floor(Math.random() * GAME_HEIGHT / GRID) * GRID,
        size: Math.random() < 0.2 ? 3 : 2,
        base: 0.15 + Math.random() * 0.45,
        twinkle: Math.random() < 0.3,
        phase: Math.random() * Math.PI * 2,
        speed: 0.6 + Math.random() * 1.2,
        warm: Math.random() < 0.35 // 淡金星 vs 白星
      });
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
      return { ...def, cells, endX: end.x, endY: end.y, litAt: -1 };
    });
  }

  update(time) {
    if (this._finished) return;
    if (this._startTime === 0) this._startTime = time;
    const t = time - this._startTime;
    this._draw(t);

    // 检测光轨全部走完 → 触发节点点亮 + 音阶音效
    this._paths.forEach((p, i) => {
      const startAt = this._pathStartAt(i);
      const doneAt = startAt + p.cells.length * STEP_MS;
      if (p.litAt < 0 && t >= doneAt) {
        p.litAt = t;
        if (this.audio) this.audio.playIntroNode(this._litNodes);
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

    // 深空背景渐变
    g.fillGradientStyle(0x05050a, 0x05050a, 0x0e0c16, 0x0e0c16, 1);
    g.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    this._drawStars(g, t);
    this._drawHeart(g, t);
    this._drawPaths(g, t);
    this._drawNodes(g, t);
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

    g.fillStyle(0xf0c040, 0.14 * grow);
    g.fillCircle(CENTER.x, CENTER.y, r * 3.2);
    g.fillStyle(0xf0c040, 0.28 * grow);
    g.fillCircle(CENTER.x, CENTER.y, r * 2);
    // 像素核心：金色方块（星图的起点）
    const core = Math.max(GRID, Math.round(10 * grow / GRID) * GRID);
    g.fillStyle(0xffe080, 0.95 * grow);
    g.fillRect(CENTER.x - core / 2, CENTER.y - core / 2, core, core);
  }

  /** 光轨：逐格点亮，头部亮、尾部暗，制造光的流动感 */
  _drawPaths(g, t) {
    this._paths.forEach((p, i) => {
      const startAt = this._pathStartAt(i);
      if (t < startAt) return;
      const litCount = this._reducedMotion
        ? p.cells.length
        : Math.min(p.cells.length, Math.floor((t - startAt) / STEP_MS) + 1);
      for (let c = 0; c < litCount; c++) {
        const cell = p.cells[c];
        const distFromHead = litCount - 1 - c;
        let alpha = 0.5;
        if (!this._reducedMotion) {
          if (distFromHead === 0) alpha = 1.0;
          else if (distFromHead === 1) alpha = 0.75;
          else if (distFromHead === 2) alpha = 0.6;
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
