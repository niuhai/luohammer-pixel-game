import Phaser from 'phaser';
import { ENDINGS, STORY } from '../data/story.js';
import { COLORS, GAME_WIDTH, GAME_HEIGHT, FONTS, ENDING_SCENE_MAP, SCENE_ASSETS } from '../config.js';
import { PixelRenderer } from '../systems/PixelRenderer.js';
import { AudioSystem } from '../systems/AudioSystem.js';
import { SaveSystem } from '../systems/SaveSystem.js';
import { ALL_ACHIEVEMENTS, HIDDEN_ACHIEVEMENTS, isHiddenAchievement, loadUnlockedAchievements, getAchievementScore, calculateAchievementScore, checkComboAchievements, loadComboAchievements, COMBO_ACHIEVEMENTS } from '../ui/AchievementPopup.js';
import { showAchievementGallery, getUnlockedAchievementNames } from '../ui/AchievementGallery.js';
import { showEndingGallery, getEndingProgress } from '../ui/EndingGallery.js';
import { MetaProgression, MILESTONE_REWARDS } from '../systems/MetaProgression.js';
import { SKILL_TREES, ALL_SKILLS, getUnlockableSkills, calculateExpGain } from '../data/skillTree.js';
import { RANDOM_EVENTS } from '../data/events-random.js';
import { toast } from '../systems/ToastSystem.js';

export class EndingScene extends Phaser.Scene {
  constructor() { super('EndingScene'); }

  init(data) {
    this.state = data.state;
    this.endingKey = data.ending || 'default';
    this.reviewVisible = false;
    this.shareCardVisible = false;
    this._lifeMapCloseBound = false;
    this._lifeMapEventsBound = false;
  }

  /**
   * 懒加载结局专属背景图：只加载当前结局需要的那一张。
   * 之前 GameScene.preload 会一次性加载全部 5 张结局图（约 1MB），
   * 现在按需加载，单次结局只需 1 张图。
   */
  preload() {
    const sceneType = ENDING_SCENE_MAP[this.endingKey];
    if (!sceneType) return;
    const assetKey = `bg-${sceneType}`;
    if (this.textures.exists(assetKey)) return; // 已加载（玩家游戏中预读过）
    const asset = SCENE_ASSETS.find(a => a.type === sceneType);
    if (!asset) return;
    this.load.image(assetKey, asset.url);
  }

  create() {
    // 隐藏游戏主界面遗留的 DOM UI，确保结局画面干净完整
    this._hideGameUI();

    // 结局背景音乐
    this.audio = new AudioSystem(this);
    const bgmType = this._getEndingBGMType(this.endingKey);
    this.audio.startBGM(bgmType);

    this.ending = ENDINGS[this.endingKey] || ENDINGS.default;

    // Dark background (Canvas 保留)
    const bg = this.add.graphics();
    bg.fillStyle(0x0a0a0a, 1);
    bg.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // === A. 结局专属背景图 ===
    this._loadEndingBackground();

    // === B. 结局专属背景动画（Canvas 保留） ===
    this.createEndingParticles(this.endingKey);

    // === 跨周目经验结算（需在渲染前完成，以便图鉴显示当前结局） ===
    this.meta = new MetaProgression();
    const isNewEnding = this.meta.recordEnding(this.endingKey);
    // 调试统计：记录本次结局触发次数
    try { this.meta.recordEndingStat(this.endingKey); } catch(e) {}
    const expGained = calculateExpGain(this.state, { id: this.endingKey });
    this.meta.addExp(expGained);
    this._expGained = expGained;
    this._isNewEnding = isNewEnding;

    // === 成就积分结算、组合成就检查、经验里程碑检查 ===
    this._checkAchievementRewards();

    // === 选择高光闪回 → 然后渲染结局 ===
    this._startFlashback(() => {
      this._renderEndingDOM();
    });

    // Hide overlay when scene is shutdown
    this.events.on('shutdown', () => {
      const overlay = document.getElementById('ui-ending-overlay');
      const lifeMapOverlay = document.getElementById('ui-life-map-overlay');
      const flashback = document.getElementById('ui-ending-flashback');
      if (overlay) overlay.classList.remove('visible');
      if (lifeMapOverlay) lifeMapOverlay.classList.remove('visible');
      if (flashback) flashback.classList.remove('visible');
    });
  }

  /**
   * 加载结局专属背景图（如果有的话）。
   * 有专属背景的结局会显示一张全屏背景图，再叠加粒子特效。
   * 没有的则保持纯黑背景 + 粒子。
   */
  _loadEndingBackground() {
    const sceneType = ENDING_SCENE_MAP[this.endingKey];
    if (!sceneType) return; // 无专属背景，保持默认

    const assetKey = `bg-${sceneType}`;
    // 图片已通过 GameScene.preload 加载，直接用 textures 获取
    if (!this.textures.exists(assetKey)) return;

    const img = this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, assetKey);
    img.setDisplaySize(GAME_WIDTH, GAME_HEIGHT);
    img.setAlpha(0.35); // 半透明叠加，保留粒子效果
    img.setDepth(-1);
  }

  /**
   * 结局专属背景粒子动画
   * 根据结局类型生成不同颜色和行为的粒子，营造氛围
   */
  createEndingParticles(endingKey) {
    const legendaryEndings = ['legend', 'ideal_king', 'tech_giant', 'cultural_icon'];
    const tragicEndings = ['debt_prison', 'forgotten', 'exile'];
    const peacefulEndings = ['survivor', 'compromise', 'quiet_life', 'balance'];

    let color = 0xf0c040; // 默认金色
    let count = 30;
    if (legendaryEndings.includes(endingKey)) {
      color = 0xffd866; count = 50;
    } else if (tragicEndings.includes(endingKey)) {
      color = 0x666666; count = 20;
    } else if (peacefulEndings.includes(endingKey)) {
      color = 0xa0d8a0; count = 25;
    }

    const gfx = this.add.graphics();
    gfx.setDepth(-0.5);
    const particles = [];
    for (let i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * GAME_WIDTH,
        y: GAME_HEIGHT + Math.random() * 50,
        vy: -(0.2 + Math.random() * 0.5),
        vx: (Math.random() - 0.5) * 0.2,
        r: 1 + Math.random() * 2,
        alpha: 0.3 + Math.random() * 0.4
      });
    }
    this._endingParticles = { gfx, particles, color };
    this.events.on('update', () => {
      gfx.clear();
      for (const p of particles) {
        p.y += p.vy;
        p.x += p.vx;
        if (p.y < -10) {
          p.y = GAME_HEIGHT + 10;
          p.x = Math.random() * GAME_WIDTH;
        }
        gfx.fillStyle(color, p.alpha);
        gfx.fillCircle(p.x, p.y, p.r);
      }
    });
  }

  /**
   * 隐藏游戏主界面残留的 DOM UI（对话框、选项、属性条、章节标题、随机事件等）
   */
  _hideGameUI() {
    const ids = [
      'ui-dialog', 'ui-choices', 'ui-stats', 'ui-hidden-stats', 'ui-chapter',
      'ui-random-event-overlay', 'ui-history-note-area', 'ui-history-note-overlay',
      'dialog-touch-layer'
    ];
    ids.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = 'none';
    });
    // 注意：不能隐藏 #ui-overlay 容器，因为 #ui-ending-overlay、#ui-life-map-overlay
    // 等子元素需要在 EndingScene 中显示。父元素 display:none 会导致所有子元素
    // （包括 position:fixed）bounding box 为 0，无法渲染。
  }

  /**
   * 通关时检查成就奖励：成就积分、组合成就、经验里程碑。
   * - 计算已解锁成就总积分并持久化到 MetaProgression
   * - 检查组合成就解锁条件，新解锁的组合成就存入 localStorage 并 toast 提示
   * - 检查成就里程碑（经验奖励型），用 flags 记录只触发一次，toast 提示
   */
  /**
   * 结局前选择高光闪回——快速展示玩家本局关键选择的走马灯动画
   */
  _startFlashback(onComplete) {
    const flashback = document.getElementById('ui-ending-flashback');
    const label = document.getElementById('ui-ending-flashback-label');
    const choicesEl = document.getElementById('ui-ending-flashback-choices');
    if (!flashback || !choicesEl) { onComplete(); return; }

    const history = this.state.history || [];
    if (history.length === 0) { onComplete(); return; }

    // 选取最多5个关键选择——优先采样设置了 flag 或属性变化大的选择，让闪回更有"命运转折"感
    const maxShow = 5;
    let picks = history;
    if (history.length > maxShow) {
      // 为每个历史项打分：设置了 flag 得高分，属性变化幅度大得高分
      const scored = history.map((item, idx) => {
        let score = 0;
        // 设置了 flag 的选择加分（命运转折点）
        if (item.flags && item.flags.length > 0) score += 10;
        // 属性变化大的选择加分
        if (item.effects) {
          const delta = Object.values(item.effects).reduce((s, v) => s + Math.abs(v), 0);
          score += delta;
        }
        // 翻车选择加分（重要负面事件）
        if (item.effects && item.effects.failures > 0) score += 5;
        // 保留时序位置作为次要因子，避免全集中在中段
        return { item, idx, score };
      });
      // 按分数降序取前 maxShow，再按原始时序排序，保持叙事顺序
      const topPicks = scored.sort((a, b) => b.score - a.score).slice(0, maxShow);
      picks = topPicks.sort((a, b) => a.idx - b.idx).map(s => s.item);
      // 如果高分项不足（都没 flag/effects），回退到均匀采样
      if (picks.length < maxShow) {
        picks = [];
        const step = history.length / maxShow;
        for (let i = 0; i < maxShow; i++) {
          picks.push(history[Math.floor(i * step)]);
        }
      }
    }

    flashback.classList.add('visible');
    choicesEl.innerHTML = '';

    // 标题淡入
    this.time.delayedCall(300, () => {
      if (label) {
        label.textContent = '◇ 你的人生走马灯 ◇';
        label.classList.add('show');
      }
    });

    // 逐个展示选择
    let skipFlag = false;
    const skipHandler = () => { skipFlag = true; };
    flashback.addEventListener('pointerdown', skipHandler);
    const keyHandler = (e) => { if (e.code === 'Space') skipFlag = true; };
    window.addEventListener('keydown', keyHandler);

    picks.forEach((item, i) => {
      const delay = 800 + i * 700;
      this.time.delayedCall(delay, () => {
        if (skipFlag) return;
        const el = document.createElement('div');
        el.className = 'ui-ending-flashback-choice';
        const nodeLabel = item.nodeId ? item.nodeId.replace(/_/g, ' ').toUpperCase() : '';
        el.innerHTML = `<div class="fc-node">${nodeLabel}</div><div class="fc-text">${item.choiceLabel || ''}</div>`;
        choicesEl.appendChild(el);
        requestAnimationFrame(() => el.classList.add('show'));
      });
    });

    // 闪回结束后进入结局
    const totalDuration = 800 + picks.length * 700 + 1200;
    this.time.delayedCall(totalDuration, () => {
      flashback.removeEventListener('pointerdown', skipHandler);
      window.removeEventListener('keydown', keyHandler);
      flashback.classList.remove('visible');
      if (label) label.classList.remove('show');
      onComplete();
    });
  }

  _checkAchievementRewards() {
    const unlockedNames = getUnlockedAchievementNames(this.state);
    const stored = loadUnlockedAchievements();
    const comboList = loadComboAchievements();

    // 统计已解锁成就数量（普通+隐藏+组合）
    const allAchDefs = Object.values(ALL_ACHIEVEMENTS);
    const normalCount = allAchDefs.filter(d => unlockedNames.has(d.name) && !isHiddenAchievement(d.name)).length;
    const hiddenCount = allAchDefs.filter(d => unlockedNames.has(d.name) && isHiddenAchievement(d.name)).length;
    const totalUnlocked = normalCount + hiddenCount + comboList.length;

    // 检查组合成就解锁（会自动写入 localStorage）
    const newlyUnlockedCombos = checkComboAchievements({
      unlockedNames,
      normalCount,
      hiddenCount,
      endingCount: this.meta.getSeenEndings().length
    });

    // toast 提示新解锁的组合成就
    for (const combo of newlyUnlockedCombos) {
      toast.success(`组合成就解锁！${combo.icon} ${combo.name}`);
    }

    // 计算并更新成就积分（calculateAchievementScore 内部会读取最新的组合成就列表）
    const totalScore = calculateAchievementScore(stored);
    this.meta.data.achievementScore = totalScore;
    this.meta.save();

    // 检查成就里程碑（经验奖励型），每个里程碑只触发一次
    const updatedTotal = totalUnlocked + newlyUnlockedCombos.length;
    const newlyTriggeredMilestones = this.meta.checkAchievementMilestones(updatedTotal);
    for (const ms of newlyTriggeredMilestones) {
      let msg = `★ 里程碑达成：${ms.name}`;
      if (ms.exp) msg += `（+${ms.exp} EXP）`;
      if (ms.unlockTalent) msg += `，解锁特殊天赋"成就猎人"`;
      if (ms.title) msg += `，获得称号"${ms.title}"`;
      toast.success(msg);
    }
  }

  /**
   * 使用 DOM overlay 渲染结局界面
   */
  _renderEndingDOM() {
    const overlay = document.getElementById('ui-ending-overlay');
    const titleEl = document.getElementById('ui-ending-title');
    const descEl = document.getElementById('ui-ending-desc');
    const statsEl = document.getElementById('ui-ending-stats');
    const quoteEl = document.getElementById('ui-ending-quote');
    const summaryEl = document.getElementById('ui-ending-summary');
    const achievementsEl = document.getElementById('ui-ending-achievements');
    const buttonsEl = document.getElementById('ui-ending-buttons');

    // 清理上次渲染残留的"展开"按钮
    overlay.querySelectorAll('.ui-ending-expand-btn').forEach(el => el.remove());

    // Title
    titleEl.textContent = (this.ending.title || '').replace(/罗远/g, '老罗');

    // Description
    descEl.textContent = (this.ending.desc || '').replace(/罗远/g, '老罗');

    // Stats
    statsEl.innerHTML = '';
    const stats = [
      { label: '理想主义', val: this.state.pride, key: 'pride' },
      { label: '财富', val: this.state.wealth, key: 'wealth' },
      { label: '名声', val: this.state.reputation, key: 'reputation' },
      { label: '翻车', val: this.state.failures, key: 'failures' }
    ];

    const colorMap = {
      pride: 'linear-gradient(90deg, var(--color-gold-dark), var(--color-gold))',
      wealth: 'linear-gradient(90deg, #2a7a4a, #40c040)',
      reputation: 'linear-gradient(90deg, #3a5aaa, #6a9aff)',
      failures: 'linear-gradient(90deg, #aa3a3a, #e04040)'
    };

    stats.forEach((s, i) => {
      const row = document.createElement('div');
      row.className = 'ui-ending-stat-row';

      const targetWidth = s.key === 'failures' ? Math.min(s.val * 16, 160) : s.val * 16;

      row.innerHTML = `
        <span class="ui-ending-stat-label">${s.label}</span>
        <div class="ui-ending-stat-bar-bg">
          <div class="ui-ending-stat-bar-fill" style="width: 0%; background: ${colorMap[s.key]};"></div>
        </div>
        <span class="ui-ending-stat-value">${s.val}/10</span>
      `;

      statsEl.appendChild(row);

      // Animate bar fill
      setTimeout(() => {
        const fill = row.querySelector('.ui-ending-stat-bar-fill');
        fill.style.width = targetWidth + '%';
      }, 800 + i * 200);
    });

    // Quote
    quoteEl.textContent = (this.ending.quote || '').replace(/罗远/g, '老罗');

    // Summary
    summaryEl.textContent = (this.ending.summary || '').replace(/罗远/g, '老罗');

    // Achievements - 展示已解锁/未解锁成就列表
    const sessionAchievements = this.state.achievements || [];
    const storedAchievements = loadUnlockedAchievements();
    const unlockedSet = new Set();
    for (const ach of sessionAchievements) {
      const name = typeof ach === 'string' ? ach : (ach.name || ach.achievement);
      unlockedSet.add(name);
    }
    for (const ach of storedAchievements) {
      unlockedSet.add(ach.name);
    }
    const allAchDefs = Object.values(ALL_ACHIEVEMENTS);
    const unlocked = allAchDefs.filter(d => unlockedSet.has(d.name));
    const locked = allAchDefs.filter(d => !unlockedSet.has(d.name));

    achievementsEl.innerHTML = '';
    // 默认折叠成就区，降低首屏信息密度；点击"展开"按钮才展开，避免误触成就条目
    achievementsEl.classList.add('collapsed');

    // 成就标题栏
    const achHeader = document.createElement('div');
    achHeader.style.cssText = 'display: flex; align-items: center; justify-content: center; gap: 8px; margin-bottom: 8px;';
    const achTitle = document.createElement('span');
    achTitle.style.cssText = 'font-size: 11px; color: var(--color-gold); font-weight: 700; letter-spacing: 2px;';
    achTitle.textContent = `★ 成就`;
    const achCount = document.createElement('span');
    achCount.style.cssText = 'font-size: 10px; color: var(--color-text-secondary); font-weight: 400;';
    achCount.textContent = `${unlocked.length} / ${allAchDefs.length}`;
    achHeader.appendChild(achTitle);
    achHeader.appendChild(achCount);
    achievementsEl.appendChild(achHeader);

    // === 成就积分显示 ===
    const totalScore = this.meta ? (this.meta.getAchievementScore ? this.meta.getAchievementScore() : 0) : 0;
    const scoreEl = document.createElement('div');
    scoreEl.style.cssText = 'font-size: 10px; color: var(--color-gold); text-align: center; margin-bottom: 6px; font-weight: 600;';
    scoreEl.textContent = `★ 成就积分：${totalScore}`;
    achievementsEl.appendChild(scoreEl);

    // === 已达成里程碑奖励 ===
    if (this.meta && typeof this.meta.getClaimedMilestones === 'function') {
      const claimedMs = this.meta.getClaimedMilestones();
      if (claimedMs && claimedMs.length > 0) {
        const msEl = document.createElement('div');
        msEl.style.cssText = 'font-size: 9px; color: #c8a040; text-align: center; margin-bottom: 6px;';
        const highest = claimedMs.reduce((a, b) => (a.threshold > b.threshold ? a : b));
        msEl.textContent = `★ 已达成里程碑：${highest.name}（共 ${claimedMs.length}/${MILESTONE_REWARDS.length}）`;
        achievementsEl.appendChild(msEl);
      }
    }

    // 进度条
    const progBg = document.createElement('div');
    progBg.style.cssText = 'width: 200px; height: 4px; background: var(--color-bg-border); border-radius: 2px; margin: 0 auto 8px;';
    const progFill = document.createElement('div');
    const pct = allAchDefs.length > 0 ? (unlocked.length / allAchDefs.length * 100) : 0;
    progFill.style.cssText = `width: ${pct}%; height: 100%; background: linear-gradient(90deg, var(--color-gold-dark), var(--color-gold)); border-radius: 2px; transition: width 1s ease;`;
    progBg.appendChild(progFill);
    achievementsEl.appendChild(progBg);

    // 成就网格容器
    const achGrid = document.createElement('div');
    achGrid.style.cssText = 'display: flex; flex-wrap: wrap; gap: 4px 6px; justify-content: center; max-width: 640px; max-height: 100px; overflow-y: auto; padding: 2px;';

    // 已解锁成就
    const unlockedNames = getUnlockedAchievementNames(this.state);
    const showHiddenHints = !!(this.meta && typeof this.meta.getEffect === 'function' && this.meta.getEffect('show_hidden_hints'));
    unlocked.forEach(ach => {
      const hidden = isHiddenAchievement(ach.name);
      const item = document.createElement('span');
      item.style.cssText = `font-size: 9px; color: ${hidden ? '#ff88cc' : 'var(--color-gold)'}; white-space: nowrap; padding: 1px 4px; border-radius: 2px; background: ${hidden ? 'rgba(255,136,204,0.1)' : 'rgba(240,192,64,0.08)'}; border: 1px solid ${hidden ? 'rgba(255,136,204,0.3)' : 'rgba(240,192,64,0.2)'}; cursor: pointer;`;
      item.textContent = `${ach.icon} ${ach.name}`;
      item.dataset.name = ach.name;
      item.addEventListener('click', () => showAchievementGallery({ unlockedNames, highlightName: ach.name, showHiddenHints }));
      achGrid.appendChild(item);
    });

    // 未解锁成就（灰色 + "???"）
    locked.forEach(ach => {
      const hidden = isHiddenAchievement(ach.name);
      const item = document.createElement('span');
      item.style.cssText = 'font-size: 9px; color: #3a3a4a; white-space: nowrap; padding: 1px 4px; border-radius: 2px; background: rgba(58,58,74,0.15); border: 1px solid rgba(58,58,74,0.2); cursor: pointer;';
      item.textContent = `${hidden ? '◑' : '?'} ${hidden ? '???' : ach.name}`;
      item.dataset.name = ach.name;
      item.addEventListener('click', () => showAchievementGallery({ unlockedNames, highlightName: ach.name, showHiddenHints }));
      achGrid.appendChild(item);
    });

    achievementsEl.appendChild(achGrid);

    // 提示可点击查看详情
    const achHint = document.createElement('div');
    achHint.style.cssText = 'font-size: 9px; color: #5a5a6e; margin-top: 6px; text-align: center;';
    achHint.textContent = '点击成就查看触发原因';
    achievementsEl.appendChild(achHint);

    // === 结局图鉴进度 ===
    const endingProgress = getEndingProgress(this.meta.getSeenEndings());
    const endingGalleryEl = document.createElement('div');
    endingGalleryEl.style.cssText = 'margin-top: 10px; text-align: center;';

    // 结局图鉴标题栏
    const endingHeader = document.createElement('div');
    endingHeader.style.cssText = 'display: flex; align-items: center; justify-content: center; gap: 8px; margin-bottom: 6px; cursor: pointer;';
    endingHeader.addEventListener('click', () => {
      showEndingGallery({ seenEndings: this.meta.getSeenEndings() });
    });
    const endingTitle = document.createElement('span');
    endingTitle.style.cssText = 'font-size: 11px; color: var(--color-gold); font-weight: 700; letter-spacing: 2px;';
    endingTitle.textContent = '▤ 结局图鉴';
    const endingCount = document.createElement('span');
    endingCount.style.cssText = 'font-size: 10px; color: var(--color-text-secondary); font-weight: 400;';
    endingCount.textContent = `${endingProgress.unlocked} / ${endingProgress.total}`;
    endingHeader.appendChild(endingTitle);
    endingHeader.appendChild(endingCount);
    endingGalleryEl.appendChild(endingHeader);

    // 结局进度条
    const endingProgBg = document.createElement('div');
    endingProgBg.style.cssText = 'width: 200px; height: 4px; background: var(--color-bg-border); border-radius: 2px; margin: 0 auto 6px;';
    const endingProgFill = document.createElement('div');
    endingProgFill.style.cssText = `width: ${endingProgress.pct}%; height: 100%; background: linear-gradient(90deg, var(--color-gold-dark), var(--color-gold)); border-radius: 2px; transition: width 1s ease;`;
    endingProgBg.appendChild(endingProgFill);
    endingGalleryEl.appendChild(endingProgBg);

    // 提示文字
    const endingHint = document.createElement('div');
    endingHint.style.cssText = 'font-size: 9px; color: #5a5a6e; text-align: center;';
    endingHint.textContent = '点击查看全部结局';
    endingGalleryEl.appendChild(endingHint);

    achievementsEl.appendChild(endingGalleryEl);

    // === 随机事件图鉴进度 ===
    const seenEventCount = this.meta.getSeenEventCount();
    const totalRandomEvents = RANDOM_EVENTS.length;
    const eventGalleryEl = document.createElement('div');
    eventGalleryEl.style.cssText = 'margin-top: 10px; text-align: center;';

    const eventHeader = document.createElement('div');
    eventHeader.style.cssText = 'display: flex; align-items: center; justify-content: center; gap: 8px; margin-bottom: 6px;';
    const eventTitle = document.createElement('span');
    eventTitle.style.cssText = 'font-size: 11px; color: #40c0c0; font-weight: 700; letter-spacing: 2px;';
    eventTitle.textContent = '▤ 随机事件图鉴';
    const eventCount = document.createElement('span');
    eventCount.style.cssText = 'font-size: 10px; color: var(--color-text-secondary); font-weight: 400;';
    eventCount.textContent = `${seenEventCount} / ${totalRandomEvents}`;
    eventHeader.appendChild(eventTitle);
    eventHeader.appendChild(eventCount);
    eventGalleryEl.appendChild(eventHeader);

    // 事件图鉴进度条（与成就/结局进度条样式一致）
    const eventProgBg = document.createElement('div');
    eventProgBg.style.cssText = 'width: 200px; height: 4px; background: var(--color-bg-border); border-radius: 2px; margin: 0 auto;';
    const eventProgFill = document.createElement('div');
    const eventPct = totalRandomEvents > 0 ? (seenEventCount / totalRandomEvents * 100) : 0;
    eventProgFill.style.cssText = `width: 0%; height: 100%; background: linear-gradient(90deg, #2a8a8a, #40c0c0); border-radius: 2px; transition: width 1s ease;`;
    eventProgBg.appendChild(eventProgFill);
    eventGalleryEl.appendChild(eventProgBg);

    achievementsEl.appendChild(eventGalleryEl);
    // 延迟触发进度条动画
    setTimeout(() => { eventProgFill.style.width = `${eventPct}%`; }, 600);

    // === 调试模式：显示结局触发统计 ===
    try {
      let debugEnabled = false;
      try { debugEnabled = localStorage.getItem('luohammer_debug') === '1'; } catch(e) {}
      if (debugEnabled && this.meta && typeof this.meta.getEndingStats === 'function') {
        const stats = this.meta.getEndingStats();
        const entries = Object.entries(stats)
          .map(([k, v]) => ({ key: k, count: Number(v) || 0 }))
          .filter(e => e.count > 0)
          .sort((a, b) => b.count - a.count);

        const totalRecorded = entries.reduce((s, e) => s + e.count, 0);

        const debugEl = document.createElement('div');
        debugEl.style.cssText = 'margin-top: 10px; text-align: center; padding: 6px 8px; border: 1px dashed #ff5555; background: rgba(255,85,85,0.06); border-radius: 4px;';

        const debugHeader = document.createElement('div');
        debugHeader.style.cssText = 'display: flex; align-items: center; justify-content: center; gap: 8px; margin-bottom: 6px;';
        const debugTitle = document.createElement('span');
        debugTitle.style.cssText = 'font-size: 11px; color: #ff5555; font-weight: 700; letter-spacing: 2px;';
        debugTitle.textContent = 'DEBUG 结局触发统计';
        const debugCount = document.createElement('span');
        debugCount.style.cssText = 'font-size: 10px; color: var(--color-text-secondary); font-weight: 400;';
        debugCount.textContent = `${entries.length} / ${Object.keys(ENDINGS).length} 种结局 · 共 ${totalRecorded} 次`;
        debugHeader.appendChild(debugTitle);
        debugHeader.appendChild(debugCount);
        debugEl.appendChild(debugHeader);

        // 列表显示各结局触发次数（最多展示前 12 项，避免过长）
        const listEl = document.createElement('div');
        listEl.style.cssText = 'max-height: 120px; overflow-y: auto; font-size: 10px; color: #c8a0a0; padding: 2px 4px;';
        if (entries.length === 0) {
          const empty = document.createElement('div');
          empty.style.cssText = 'font-size: 10px; color: #6a5a5a; text-align: center; padding: 4px;';
          empty.textContent = '暂无统计';
          listEl.appendChild(empty);
        } else {
          const showMax = Math.min(entries.length, 12);
          for (let i = 0; i < showMax; i++) {
            const e = entries[i];
            const endingDef = ENDINGS[e.key];
            const title = endingDef && endingDef.title
              ? endingDef.title.replace(/罗远/g, '老罗').substring(0, 24)
              : e.key;
            const row = document.createElement('div');
            row.style.cssText = `display: flex; justify-content: space-between; padding: 2px 6px; ${i === 0 ? 'background: rgba(255,85,85,0.08);' : ''}`;
            const isCurrent = e.key === this.endingKey;
            const nameSpan = document.createElement('span');
            nameSpan.style.cssText = `color: ${isCurrent ? '#ff8855' : '#c8a0a0'}; ${isCurrent ? 'font-weight: 700;' : ''}`;
            nameSpan.textContent = `${isCurrent ? '▶ ' : ''}${title}`;
            const countSpan = document.createElement('span');
            countSpan.style.cssText = `color: ${isCurrent ? '#ff8855' : 'var(--color-text-secondary)'};`;
            countSpan.textContent = `× ${e.count}`;
            row.appendChild(nameSpan);
            row.appendChild(countSpan);
            listEl.appendChild(row);
          }
          if (entries.length > showMax) {
            const more = document.createElement('div');
            more.style.cssText = 'font-size: 9px; color: #6a5a5a; text-align: center; padding: 2px;';
            more.textContent = `...还有 ${entries.length - showMax} 项`;
            listEl.appendChild(more);
          }
        }
        debugEl.appendChild(listEl);

        achievementsEl.appendChild(debugEl);
      }
    } catch(e) {}

    // === 文本符号语义对照表（图例）—— 帮助玩家理解像素符号含义 ===
    const legendEl = document.createElement('div');
    legendEl.className = 'ui-ending-legend';
    legendEl.innerHTML = [
      '<div class="legend-title">◈ 符号图例</div>',
      '<div class="legend-grid">',
      '<span><b>★</b> 成就</span>',
      '<span><b>♣</b> 技能树</span>',
      '<span><b>♪</b> 音效</span>',
      '<span><b>▣</b> 工匠/意志</span>',
      '<span><b>◈</b> 社交/人脉</span>',
      '<span><b>✦</b> 理想</span>',
      '<span><b>◊</b> 孤注一掷</span>',
      '<span><b>▲</b> 浴火重生</span>',
      '<span><b>↻</b> 东山再起</span>',
      '<span><b>⚡</b> 老罗附体</span>',
      '</div>'
    ].join('');
    achievementsEl.appendChild(legendEl);

    // 折叠状态下的"展开"按钮（作为兄弟元素插入，不受 max-height 影响）
    const expandBtn = document.createElement('button');
    expandBtn.className = 'ui-ending-expand-btn';
    expandBtn.textContent = '▾ 展开成就 / 图鉴详情';
    expandBtn.addEventListener('click', () => {
      achievementsEl.classList.remove('collapsed');
      expandBtn.remove();
    });
    achievementsEl.parentNode.insertBefore(expandBtn, achievementsEl.nextSibling);

    // Buttons —— 收敛为 3 个主按钮 + "更多"折叠菜单，降低首屏信息密度
    buttonsEl.innerHTML = '';

    const retryBtn = document.createElement('button');
    retryBtn.className = 'ui-ending-btn ui-ending-btn-primary';
    retryBtn.textContent = '再来一次';
    retryBtn.addEventListener('click', () => {
      this.audio.fadeOutBGM(0.5);
      // 通关后清理存档，避免"继续游戏"回到结局前节点导致状态错乱
      try { new SaveSystem().clear(); } catch(e) { console.warn('[EndingScene] Failed to clear save:', e); }
      overlay.classList.remove('visible');
      this.scene.start('BootScene');
    });

    // === 技能树按钮（主按钮：跨周目核心） ===
    const skillTreeBtn = document.createElement('button');
    skillTreeBtn.className = 'ui-ending-btn';
    skillTreeBtn.style.borderColor = 'var(--color-gold)';
    skillTreeBtn.style.color = 'var(--color-gold)';
    const exp = this.meta.getExp();
    skillTreeBtn.textContent = `♣ 技能树 (${exp} EXP)`;
    skillTreeBtn.addEventListener('click', () => {
      this._showSkillTree();
    });

    // === "更多" 折叠按钮（次级操作） ===
    const moreBtn = document.createElement('button');
    moreBtn.className = 'ui-ending-btn ui-ending-btn-more';
    moreBtn.textContent = '更多 ▾';

    const moreMenu = document.createElement('div');
    moreMenu.className = 'ui-ending-more-menu';
    moreMenu.style.display = 'none';

    const addMoreItem = (label, onClick) => {
      const btn = document.createElement('button');
      btn.className = 'ui-ending-btn ui-ending-btn-sub';
      btn.textContent = label;
      btn.addEventListener('click', () => {
        moreMenu.style.display = 'none';
        moreBtn.textContent = '更多 ▾';
        onClick();
      });
      moreMenu.appendChild(btn);
    };

    addMoreItem('决策回顾', () => this.toggleDecisionReview());

    // === 历史真相回顾 ===
    // 未读历史真相高亮提示玩家查看
    const unlockedNotes = (this.state && this.state.unlockedHistoryNotes) || [];
    const readNotes = (this.state && this.state.readHistoryNotes) || [];
    const unreadCount = unlockedNotes.filter(h => !readNotes.includes(h.nodeId)).length;
    const historyBtnLabel = unreadCount > 0
      ? `▤ 历史真相回顾 ★${unreadCount} 未读`
      : `▤ 历史真相回顾 (${unlockedNotes.length})`;
    const historyBtn = document.createElement('button');
    historyBtn.className = 'ui-ending-btn ui-ending-btn-sub' + (unreadCount > 0 ? ' has-unread' : '');
    historyBtn.textContent = historyBtnLabel;
    historyBtn.addEventListener('click', () => {
      moreMenu.style.display = 'none';
      moreBtn.textContent = '更多 ▾';
      this._showHistoryReview();
    });
    if (unreadCount > 0) {
      // 高亮闪烁样式（未读提示）
      historyBtn.style.borderColor = 'var(--color-gold)';
      historyBtn.style.color = 'var(--color-gold)';
      historyBtn.style.background = 'rgba(240,192,64,0.15)';
      historyBtn.style.animation = 'ending-history-pulse 1.5s ease-in-out infinite';
    }
    moreMenu.appendChild(historyBtn);

    addMoreItem('分享卡', () => this.generateShareCard());
    addMoreItem('复制分享文案', () => this.copyShareText());
    addMoreItem('人生地图', () => this.showLifeMap());

    moreBtn.addEventListener('click', () => {
      const isOpen = moreMenu.style.display === 'flex';
      moreMenu.style.display = isOpen ? 'none' : 'flex';
      moreBtn.textContent = isOpen ? '更多 ▾' : '收起 ▴';
    });

    buttonsEl.appendChild(retryBtn);
    buttonsEl.appendChild(skillTreeBtn);
    buttonsEl.appendChild(moreBtn);
    buttonsEl.appendChild(moreMenu);

    overlay.classList.add('visible');
  }

  /**
   * 根据结局类型返回BGM类型
   */
  _getEndingBGMType(endingKey) {
    const legendary = ['ideal_king', 'tech_giant', 'cultural_icon', 'legend', 'warrior', 'comeback'];
    const tragic = ['debt_prison', 'forgotten', 'exile', 'scapegoat', 'supply_chain'];
    const peaceful = ['survivor', 'compromise', 'quiet_life', 'balance', 'peace', 'default'];
    if (legendary.includes(endingKey)) return 'ending_legendary';
    if (tragic.includes(endingKey)) return 'ending_tragic';
    if (peaceful.includes(endingKey)) return 'ending_peaceful';
    return 'ending_peaceful';
  }

  /**
   * 切换决策回顾面板
   */
  toggleDecisionReview() {
    this.reviewVisible = !this.reviewVisible;
    if (this.reviewVisible) {
      this._showDecisionReview();
    } else {
      this._hideDecisionReview();
    }
  }

  _showDecisionReview() {
    // Remove existing panel if any
    this._hideDecisionReview();

    const history = this.state.history || [];
    const overlay = document.getElementById('ui-ending-overlay');

    const panel = document.createElement('div');
    panel.id = 'ui-review-panel';
    panel.style.cssText = `
      position: absolute; inset: 0; background: rgba(0,0,0,0.8);
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      z-index: 60; pointer-events: auto;
    `;

    const panelContent = document.createElement('div');
    panelContent.style.cssText = `
      background: #0d0d1a; border: 2px solid var(--color-gold); padding: 20px;
      width: 700px; max-height: 380px; overflow-y: auto;
    `;

    // Title
    const title = document.createElement('div');
    title.style.cssText = 'font-size: 14px; color: var(--color-gold); text-align: center; margin-bottom: 12px; font-weight: 700;';
    title.textContent = '决策回顾';
    panelContent.appendChild(title);

    // Table header
    const header = document.createElement('div');
    header.style.cssText = 'display: flex; gap: 8px; padding: 4px 0; border-bottom: 1px solid var(--color-gold); margin-bottom: 8px;';
    ['章节节点', '你的选择', '简述'].forEach(h => {
      const col = document.createElement('span');
      col.style.cssText = 'font-size: 10px; color: var(--color-gold); flex: 1;';
      col.textContent = h;
      header.appendChild(col);
    });
    panelContent.appendChild(header);

    // Table rows
    const maxRows = Math.min(history.length, 12);
    for (let i = 0; i < maxRows; i++) {
      const entry = history[i];
      const row = document.createElement('div');
      row.style.cssText = `display: flex; gap: 8px; padding: 4px 0; font-size: 9px; color: var(--color-text-secondary); ${i % 2 === 0 ? 'background: rgba(18,18,42,0.5);' : ''}`;

      const nodeLabel = this._getNodeLabel(entry.nodeId);
      const choiceText = (entry.choiceLabel || '').substring(0, 28);
      const shortChoice = entry.historyChoice || '';

      [nodeLabel, choiceText, shortChoice].forEach(text => {
        const col = document.createElement('span');
        col.style.cssText = 'flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;';
        col.textContent = text;
        row.appendChild(col);
      });

      panelContent.appendChild(row);
    }

    if (history.length === 0) {
      const empty = document.createElement('div');
      empty.style.cssText = 'font-size: 11px; color: var(--color-text-secondary); text-align: center; padding: 20px;';
      empty.textContent = '暂无选择记录';
      panelContent.appendChild(empty);
    }

    // Close button
    const closeBtn = document.createElement('div');
    closeBtn.style.cssText = 'position: absolute; top: 8px; right: 12px; font-size: 14px; color: var(--color-gold); cursor: pointer; padding: 4px 8px;';
    closeBtn.textContent = 'X';
    closeBtn.addEventListener('click', () => { this._hideDecisionReview(); this.reviewVisible = false; });
    panelContent.style.position = 'relative';
    panelContent.appendChild(closeBtn);

    // Footer
    const footer = document.createElement('div');
    footer.style.cssText = 'font-size: 9px; color: #5a5a6a; text-align: center; margin-top: 8px;';
    footer.textContent = `共 ${history.length} 次关键选择`;
    panelContent.appendChild(footer);

    panel.appendChild(panelContent);
    overlay.appendChild(panel);
  }

  _hideDecisionReview() {
    const panel = document.getElementById('ui-review-panel');
    if (panel) panel.remove();
  }

  /**
   * 显示历史真相回顾面板
   * 列出本局所有解锁的历史真相，未读的高亮提示
   */
  _showHistoryReview() {
    this._hideHistoryReview();

    const unlockedNotes = (this.state && this.state.unlockedHistoryNotes) || [];
    const readNotes = (this.state && this.state.readHistoryNotes) || [];
    const overlay = document.getElementById('ui-ending-overlay');

    const panel = document.createElement('div');
    panel.id = 'ui-history-review-panel';
    panel.style.cssText = `
      position: absolute; inset: 0; background: rgba(0,0,0,0.85);
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      z-index: 60; pointer-events: auto;
    `;

    const panelContent = document.createElement('div');
    panelContent.style.cssText = `
      background: #0d0d1a; border: 2px solid var(--color-gold); padding: 20px;
      width: min(720px, 92vw); max-height: 80vh; overflow-y: auto;
      position: relative;
    `;

    // 标题
    const title = document.createElement('div');
    title.style.cssText = 'font-size: 14px; color: var(--color-gold); text-align: center; margin-bottom: 6px; font-weight: 700;';
    title.textContent = '▤ 历史真相回顾';
    panelContent.appendChild(title);

    // 副标题：统计信息
    const subtitle = document.createElement('div');
    const unreadCount = unlockedNotes.filter(h => !readNotes.includes(h.nodeId)).length;
    subtitle.style.cssText = 'font-size: 10px; color: var(--color-text-secondary); text-align: center; margin-bottom: 12px;';
    subtitle.innerHTML = `共 ${unlockedNotes.length} 篇 · 已读 ${unlockedNotes.length - unreadCount} · 未读 <span style="color: var(--color-gold);">${unreadCount}</span>`;
    panelContent.appendChild(subtitle);

    // 列表
    if (unlockedNotes.length === 0) {
      const empty = document.createElement('div');
      empty.style.cssText = 'font-size: 11px; color: var(--color-text-secondary); text-align: center; padding: 30px 10px;';
      empty.textContent = '本局未解锁任何历史真相';
      panelContent.appendChild(empty);
    } else {
      unlockedNotes.forEach((item, idx) => {
        const isRead = readNotes.includes(item.nodeId);
        const row = document.createElement('div');
        row.style.cssText = `
          padding: 10px 12px; margin-bottom: 8px; font-size: 11px; line-height: 1.6;
          border: 1px solid ${isRead ? '#333' : 'var(--color-gold)'};
          background: ${isRead ? 'rgba(18,18,42,0.5)' : 'rgba(240,192,64,0.08)'};
          color: ${isRead ? 'var(--color-text-secondary)' : '#e8d5a3'};
          ${!isRead ? 'box-shadow: 0 0 8px rgba(240,192,64,0.2);' : ''}
        `;

        const header = document.createElement('div');
        header.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;';
        const label = document.createElement('span');
        label.style.cssText = 'font-size: 11px; font-weight: 700; color: ' + (isRead ? 'var(--color-text-secondary)' : 'var(--color-gold)');
        label.textContent = `◇ ${item.actSub || '未知章节'}`;
        header.appendChild(label);

        const tag = document.createElement('span');
        if (!isRead) {
          tag.style.cssText = 'font-size: 9px; color: var(--color-gold); border: 1px solid var(--color-gold); padding: 1px 6px; animation: ending-history-pulse 1.5s ease-in-out infinite;';
          tag.textContent = '★ 未读';
        } else {
          tag.style.cssText = 'font-size: 9px; color: #5a5a6a;';
          tag.textContent = '已读';
        }
        header.appendChild(tag);
        row.appendChild(header);

        const body = document.createElement('div');
        body.style.cssText = 'font-size: 11px; line-height: 1.7; color: ' + (isRead ? 'var(--color-text-secondary)' : '#e8d5a3');
        body.textContent = item.note;
        row.appendChild(body);

        panelContent.appendChild(row);
      });
    }

    // 关闭按钮
    const closeBtn = document.createElement('div');
    closeBtn.style.cssText = 'position: absolute; top: 8px; right: 12px; font-size: 14px; color: var(--color-gold); cursor: pointer; padding: 4px 8px;';
    closeBtn.textContent = 'X';
    closeBtn.addEventListener('click', () => { this._hideHistoryReview(); });
    panelContent.appendChild(closeBtn);

    panel.appendChild(panelContent);
    overlay.appendChild(panel);
  }

  _hideHistoryReview() {
    const panel = document.getElementById('ui-history-review-panel');
    if (panel) panel.remove();
  }

  /**
   * 根据节点ID获取可读标签
   */
  _getNodeLabel(nodeId) {
    if (!nodeId) return '???';
    const node = STORY[nodeId];
    if (node && node.actSub) {
      return node.actSub.substring(0, 14);
    }
    const labelMap = {
      'intro': '序章',
      'act1_lei': '退学离家',
      'act1_korea': '韩国留学',
      'act2_neworiental': '新东方试讲',
      'act2_teacher': '名师之路',
      'act3_lei': '牛博网创业',
      'act3_blog': '博客时代',
      'act4_smartisan': '锤子创业',
      'act4_phone': '手机发布',
      'act5_fang': '方舟子论战',
      'act5_report': '实名举报',
      'act6_debt': '债务危机',
      'act6_livestream': '直播还债',
      'act7_ar': 'AR创业',
      'act7_ai': 'AI转型'
    };
    return labelMap[nodeId] || nodeId.substring(0, 12);
  }

  /**
   * 判断是否为人生地图中的关键转折点
   */
  _isKeyNode(nodeId) {
    const keyNodes = [
      'intro',
      'act_fridge_smash',
      'act6_a',
      'act6_crash',
      'act7_sign',
      'act7_jimi',
      'act4_a',
      'act4_launch',
      'act2_neworiental',
      'act3_lei'
    ];
    return keyNodes.includes(nodeId);
  }

  /**
   * 获取关键节点图标
   */
  _getKeyNodeIcon(nodeId) {
    const iconMap = {
      'intro': '▤',
      'act_fridge_smash': '▣',
      'act6_a': '◉',
      'act6_crash': '✕',
      'act7_sign': '◈',
      'act7_jimi': '▦',
      'act4_a': '★',
      'act4_launch': '▦',
      'act2_neworiental': '♪',
      'act3_lei': '✎'
    };
    return iconMap[nodeId] || '★';
  }

  /**
   * 构建人生地图数据：本局走过的路径 + 未选择分支
   */
  _buildLifeMapData() {
    const history = this.state.history || [];
    const visitedIds = new Set();
    const visitedSequence = [];

    // 按历史顺序收集访问过的节点，去重
    for (const entry of history) {
      if (entry && entry.nodeId && !visitedIds.has(entry.nodeId)) {
        visitedIds.add(entry.nodeId);
        visitedSequence.push(entry.nodeId);
      }
    }

    // 将结局节点加入路径
    const endingId = this.endingKey;
    if (endingId && !visitedIds.has(endingId)) {
      visitedIds.add(endingId);
      visitedSequence.push(endingId);
    }

    const nodes = [];
    const edges = [];
    const nodeMap = new Map();

    // 创建已访问节点
    visitedSequence.forEach((nodeId, index) => {
      const storyNode = STORY[nodeId];
      const progress = storyNode && storyNode.progress != null
        ? storyNode.progress
        : (index / Math.max(1, visitedSequence.length - 1) * 100);
      const isEnding = nodeId === endingId;
      const node = {
        id: nodeId,
        label: isEnding
          ? (this.ending.title || '结局').replace(/罗远/g, '老罗').substring(0, 16)
          : this._getNodeLabel(nodeId),
        progress,
        type: 'visited',
        index,
        isEnding,
        isKey: this._isKeyNode(nodeId)
      };
      nodes.push(node);
      nodeMap.set(nodeId, node);
    });

    // 根据历史选择构建已走路径边，并收集未选择分支
    for (let i = 0; i < visitedSequence.length - 1; i++) {
      const fromId = visitedSequence[i];
      const toId = visitedSequence[i + 1];
      const storyNode = STORY[fromId];
      const fromNode = nodeMap.get(fromId);
      const parentProgress = fromNode && fromNode.progress != null ? fromNode.progress : 50;
      let chosenIndex = -1;

      if (storyNode && storyNode.choices) {
        chosenIndex = storyNode.choices.findIndex(c => c.next === toId);
      }

      edges.push({ from: fromId, to: toId, type: 'visited', choiceIndex: chosenIndex });

      // 添加同节点下未被选择的其他分支
      if (storyNode && storyNode.choices) {
        storyNode.choices.forEach((choice, idx) => {
          if (!choice.next || choice.next === toId) return;
          if (visitedIds.has(choice.next)) return;

          if (!nodeMap.has(choice.next)) {
            const branchStoryNode = STORY[choice.next];
            const branchProgress = branchStoryNode && branchStoryNode.progress != null
              ? branchStoryNode.progress
              : parentProgress;
            const branchNode = {
              id: choice.next,
              label: this._getNodeLabel(choice.next),
              progress: branchProgress,
              type: 'branch',
              index: -1,
              isEnding: false,
              isKey: this._isKeyNode(choice.next)
            };
            nodes.push(branchNode);
            nodeMap.set(choice.next, branchNode);
          }
          edges.push({ from: fromId, to: choice.next, type: 'branch', choiceIndex: idx });
        });
      }
    }

    return { nodes, edges, nodeMap };
  }

  /**
   * 为地图节点计算二维坐标
   */
  _layoutLifeMap(nodes, edges, nodeMap) {
    const mapWidth = 2200;
    const mapHeight = 900;
    const paddingX = 120;
    const centerY = mapHeight / 2;

    const visitedNodes = nodes.filter(n => n.type === 'visited').sort((a, b) => a.index - b.index);
    const branchNodes = nodes.filter(n => n.type === 'branch');

    // 已走路径：按 progress 排布 x，y 做轻微正弦波动
    visitedNodes.forEach((node, i) => {
      const progress = node.progress != null ? node.progress : (i / Math.max(1, visitedNodes.length - 1) * 100);
      const x = paddingX + (progress / 100) * (mapWidth - paddingX * 2);
      const wave = Math.sin((i / Math.max(1, visitedNodes.length - 1)) * Math.PI * 2) * 70;
      node.x = x;
      node.y = centerY + wave;
    });

    // 未选择分支：从父节点向上下两侧展开
    branchNodes.forEach(node => {
      const progress = node.progress != null ? node.progress : 50;
      const x = paddingX + (progress / 100) * (mapWidth - paddingX * 2);

      const parentEdge = edges.find(e => e.to === node.id && e.type === 'branch');
      let dir = 1;
      let magnitude = 140;

      if (parentEdge) {
        const choiceIndex = Math.max(0, parentEdge.choiceIndex);
        dir = choiceIndex % 2 === 0 ? -1 : 1;
        magnitude = 110 + (Math.floor(choiceIndex / 2) + 1) * 55;
      }

      node.x = x;
      node.y = centerY + dir * magnitude;
    });

    return { width: mapWidth, height: mapHeight };
  }

  /**
   * 渲染人生地图 SVG
   */
  _renderLifeMap() {
    const { nodes, edges, nodeMap } = this._buildLifeMapData();
    const { width, height } = this._layoutLifeMap(nodes, edges, nodeMap);

    const svg = document.getElementById('ui-life-map-svg');
    const root = document.getElementById('ui-life-map-root');
    if (!svg || !root) return;

    // 设置 SVG 视口
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    root.innerHTML = '';

    // 绘制背景网格
    const gridGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    for (let x = 0; x <= width; x += 80) {
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', x);
      line.setAttribute('y1', 0);
      line.setAttribute('x2', x);
      line.setAttribute('y2', height);
      line.setAttribute('class', 'life-map-grid');
      gridGroup.appendChild(line);
    }
    for (let y = 0; y <= height; y += 80) {
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', 0);
      line.setAttribute('y1', y);
      line.setAttribute('x2', width);
      line.setAttribute('y2', y);
      line.setAttribute('class', 'life-map-grid');
      gridGroup.appendChild(line);
    }
    root.appendChild(gridGroup);

    // 按类型分组边
    const branchEdges = edges.filter(e => e.type === 'branch');
    const visitedEdges = edges.filter(e => e.type === 'visited');

    // 先画灰色分支边
    branchEdges.forEach(edge => {
      const from = nodeMap.get(edge.from);
      const to = nodeMap.get(edge.to);
      if (!from || !to) return;
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', from.x);
      line.setAttribute('y1', from.y);
      line.setAttribute('x2', to.x);
      line.setAttribute('y2', to.y);
      line.setAttribute('class', 'life-map-edge-branch');
      root.appendChild(line);
    });

    // 再画金色已走路径边
    visitedEdges.forEach(edge => {
      const from = nodeMap.get(edge.from);
      const to = nodeMap.get(edge.to);
      if (!from || !to) return;
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', from.x);
      line.setAttribute('y1', from.y);
      line.setAttribute('x2', to.x);
      line.setAttribute('y2', to.y);
      line.setAttribute('class', 'life-map-edge-visited');
      root.appendChild(line);
    });

    // 绘制节点与标签
    nodes.forEach(node => {
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');

      // 节点圆点
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', node.x);
      circle.setAttribute('cy', node.y);

      if (node.isEnding) {
        circle.setAttribute('r', node.isKey ? 14 : 10);
        circle.setAttribute('class', 'life-map-node-ending');
      } else if (node.isKey) {
        circle.setAttribute('r', 10);
        circle.setAttribute('class', 'life-map-node-key');
      } else if (node.type === 'branch') {
        circle.setAttribute('r', 6);
        circle.setAttribute('class', 'life-map-node-branch');
      } else {
        circle.setAttribute('r', node.type === 'visited' ? 8 : 6);
        circle.setAttribute('class', 'life-map-node-visited');
      }
      g.appendChild(circle);

      // 关键节点图标
      if (node.isKey || node.isEnding) {
        const icon = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        icon.setAttribute('x', node.x);
        icon.setAttribute('y', node.y + 1);
        icon.setAttribute('class', 'life-map-icon');
        icon.textContent = node.isEnding ? '◈' : this._getKeyNodeIcon(node.id);
        g.appendChild(icon);
      }

      // 节点标签
      const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      label.setAttribute('x', node.x);
      label.setAttribute('y', node.y + 26);
      let labelClass = 'life-map-label';
      if (node.isEnding) labelClass += ' life-map-label-ending';
      else if (node.isKey) labelClass += ' life-map-label-key';
      else if (node.type === 'visited') labelClass += ' life-map-label-visited';
      label.setAttribute('class', labelClass);
      label.textContent = node.label;
      g.appendChild(label);

      root.appendChild(g);
    });

    // 初始视图居中并适配
    this._resetLifeMapView(width, height);
  }

  /**
   * 重置地图视口到居中
   */
  _resetLifeMapView(mapWidth, mapHeight) {
    const svg = document.getElementById('ui-life-map-svg');
    const root = document.getElementById('ui-life-map-root');
    if (!svg || !root) return;

    const rect = svg.getBoundingClientRect();
    const scaleX = rect.width / mapWidth;
    const scaleY = rect.height / mapHeight;
    this._lifeMapScale = Math.min(scaleX, scaleY) * 0.9;
    this._lifeMapTranslateX = (rect.width - mapWidth * this._lifeMapScale) / 2;
    this._lifeMapTranslateY = (rect.height - mapHeight * this._lifeMapScale) / 2;
    this._applyLifeMapTransform();
  }

  /**
   * 应用地图缩放与位移
   */
  _applyLifeMapTransform() {
    const root = document.getElementById('ui-life-map-root');
    if (!root) return;
    root.setAttribute('transform', `translate(${this._lifeMapTranslateX}, ${this._lifeMapTranslateY}) scale(${this._lifeMapScale})`);
  }

  /**
   * 设置地图拖拽与滚轮缩放交互
   */
  _setupLifeMapInteractions() {
    const canvas = document.getElementById('ui-life-map-canvas');
    if (!canvas || this._lifeMapEventsBound) return;

    this._lifeMapDragging = false;
    this._lifeMapLastX = 0;
    this._lifeMapLastY = 0;

    const onWheel = (e) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      const canvasRect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - canvasRect.left;
      const mouseY = e.clientY - canvasRect.top;

      const newScale = Math.max(0.3, Math.min(4, this._lifeMapScale * delta));
      const scaleRatio = newScale / this._lifeMapScale;
      this._lifeMapTranslateX = mouseX - (mouseX - this._lifeMapTranslateX) * scaleRatio;
      this._lifeMapTranslateY = mouseY - (mouseY - this._lifeMapTranslateY) * scaleRatio;
      this._lifeMapScale = newScale;
      this._applyLifeMapTransform();
    };

    const onMouseDown = (e) => {
      this._lifeMapDragging = true;
      this._lifeMapLastX = e.clientX;
      this._lifeMapLastY = e.clientY;
      canvas.style.cursor = 'grabbing';
    };

    const onMouseMove = (e) => {
      if (!this._lifeMapDragging) return;
      const dx = e.clientX - this._lifeMapLastX;
      const dy = e.clientY - this._lifeMapLastY;
      this._lifeMapTranslateX += dx;
      this._lifeMapTranslateY += dy;
      this._lifeMapLastX = e.clientX;
      this._lifeMapLastY = e.clientY;
      this._applyLifeMapTransform();
    };

    const onMouseUp = () => {
      this._lifeMapDragging = false;
      canvas.style.cursor = 'grab';
    };

    const onTouchStart = (e) => {
      if (e.touches.length !== 1) return;
      this._lifeMapDragging = true;
      this._lifeMapLastX = e.touches[0].clientX;
      this._lifeMapLastY = e.touches[0].clientY;
    };

    const onTouchMove = (e) => {
      if (!this._lifeMapDragging || e.touches.length !== 1) return;
      e.preventDefault();
      const dx = e.touches[0].clientX - this._lifeMapLastX;
      const dy = e.touches[0].clientY - this._lifeMapLastY;
      this._lifeMapTranslateX += dx;
      this._lifeMapTranslateY += dy;
      this._lifeMapLastX = e.touches[0].clientX;
      this._lifeMapLastY = e.touches[0].clientY;
      this._applyLifeMapTransform();
    };

    const onTouchEnd = () => {
      this._lifeMapDragging = false;
    };

    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('touchstart', onTouchStart, { passive: true });
    canvas.addEventListener('touchmove', onTouchMove, { passive: false });
    canvas.addEventListener('touchend', onTouchEnd);

    this._lifeMapEventHandlers = { onWheel, onMouseDown, onMouseMove, onMouseUp, onTouchStart, onTouchMove, onTouchEnd };
    this._lifeMapEventsBound = true;
  }

  /**
   * 解绑地图交互事件
   */
  _destroyLifeMapInteractions() {
    const canvas = document.getElementById('ui-life-map-canvas');
    if (!canvas || !this._lifeMapEventHandlers) return;

    const h = this._lifeMapEventHandlers;
    canvas.removeEventListener('wheel', h.onWheel);
    canvas.removeEventListener('mousedown', h.onMouseDown);
    window.removeEventListener('mousemove', h.onMouseMove);
    window.removeEventListener('mouseup', h.onMouseUp);
    canvas.removeEventListener('touchstart', h.onTouchStart);
    canvas.removeEventListener('touchmove', h.onTouchMove);
    canvas.removeEventListener('touchend', h.onTouchEnd);

    this._lifeMapEventHandlers = null;
    this._lifeMapEventsBound = false;
    this._lifeMapDragging = false;
  }

  /**
   * 显示人生地图
   */
  showLifeMap() {
    const overlay = document.getElementById('ui-life-map-overlay');
    const closeBtn = document.getElementById('ui-life-map-close');
    if (!overlay) return;

    this._renderLifeMap();
    this._setupLifeMapInteractions();

    if (closeBtn && !this._lifeMapCloseBound) {
      closeBtn.addEventListener('click', () => { this.hideLifeMap(); });
      this._lifeMapCloseBound = true;
    }

    overlay.classList.add('visible');
  }

  /**
   * 隐藏人生地图
   */
  hideLifeMap() {
    const overlay = document.getElementById('ui-life-map-overlay');
    if (overlay) overlay.classList.remove('visible');
  }

  // === G. 分享卡生成 ===
  generateShareCard() {
    if (this.shareCardVisible && this.shareCardContainer) {
      this.shareCardContainer.destroy();
      this.shareCardContainer = null;
      this.shareCardVisible = false;
      return;
    }

    // 使用 PixelRenderer 渲染分享卡
    const canvas = PixelRenderer.renderShareCard(this.state, this.ending);
    const dataURL = canvas.toDataURL('image/png');

    this.shareCardContainer = this.add.container(0, 0);
    this.shareCardContainer.setDepth(600);

    // 半透明遮罩
    const overlay = this.add.graphics();
    overlay.fillStyle(0x000000, 0.8);
    overlay.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    this.shareCardContainer.add(overlay);

    // 显示分享卡图片
    this.textures.addImage('__shareCard', dataURL);
    const cardImg = this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 30, '__shareCard');
    cardImg.setDisplaySize(450, 675);
    this.shareCardContainer.add(cardImg);

    // 提示文字
    const tipText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 220, '长按图片保存 | 点击任意位置关闭', {
      fontSize: '10px', fontFamily: FONTS.pixel, color: PixelRenderer.toCSS(COLORS.textDim)
    }).setOrigin(0.5);
    this.shareCardContainer.add(tipText);

    // 点击关闭
    const closeZone = this.add.zone(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT)
      .setInteractive({ useHandCursor: true });
    closeZone.on('pointerup', () => {
      this.shareCardContainer.destroy();
      this.shareCardContainer = null;
      this.shareCardVisible = false;
      if (this.textures.exists('__shareCard')) {
        this.textures.remove('__shareCard');
      }
    });

    // 长按保存
    closeZone.on('pointerdown', () => {
      this._savePressTimer = this.time.delayedCall(800, () => {
        this._downloadDataURL(dataURL, 'share-card.png');
        this.showToast('分享卡已保存');
      });
    });
    closeZone.on('pointerup', () => {
      if (this._savePressTimer) {
        this._savePressTimer.remove();
        this._savePressTimer = null;
      }
    });
    closeZone.on('pointermove', () => {
      if (this._savePressTimer) {
        this._savePressTimer.remove();
        this._savePressTimer = null;
      }
    });

    this.shareCardContainer.add(closeZone);
    this.shareCardVisible = true;
  }

  /**
   * 下载 dataURL 为文件
   */
  _downloadDataURL(dataURL, filename) {
    try {
      const link = document.createElement('a');
      link.download = filename;
      link.href = dataURL;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(dataURL).catch(() => {});
      }
    }
  }

  /**
   * 显示提示消息（委托给全局 ToastSystem）
   */
  showToast(message) {
    toast.success(message);
  }

  /**
   * 生成适合微信/朋友圈的分享文案并复制到剪贴板
   */
  copyShareText() {
    const endingTitle = (this.ending.title || '未知结局').replace(/罗远/g, '老罗');
    const endingQuote = (this.ending.quote || '').replace(/罗远/g, '老罗');
    const endingSummary = (this.ending.summary || '').replace(/罗远/g, '老罗');

    const sessionAchievements = this.state.achievements || [];
    const storedAchievements = loadUnlockedAchievements();
    const unlockedSet = new Set();
    for (const ach of sessionAchievements) {
      const name = typeof ach === 'string' ? ach : (ach.name || ach.achievement);
      if (name) unlockedSet.add(name);
    }
    for (const ach of storedAchievements) {
      if (ach.name) unlockedSet.add(ach.name);
    }
    const allCount = Object.values(ALL_ACHIEVEMENTS).length;
    const unlockedCount = unlockedSet.size;

    const url = (typeof window !== 'undefined' && window.location && window.location.href)
      ? window.location.href.split('?')[0]
      : '';

    const lines = [
      `【罗的十字路口 · 人生模拟】`,
      ``,
      `我的结局：${endingTitle}`,
      ``,
      `人生数值：`,
      `理想主义 ${this.state.pride}  |  财富 ${this.state.wealth}  |  名声 ${this.state.reputation}  |  翻车 ${this.state.failures}`,
      ``,
    ];

    if (endingQuote) {
      lines.push(`老罗金句：`, `“${endingQuote}”`, ``);
    } else if (endingSummary) {
      lines.push(`结局简述：`, `${endingSummary}`, ``);
    }

    lines.push(`成就解锁：${unlockedCount} / ${allCount}`);
    lines.push(``);
    lines.push(`有人说，人生就是被一个又一个选择锤出来的。`);
    lines.push(`如果是你，会走出怎样的结局？`);

    if (url) {
      lines.push(``);
      lines.push(`► 来试试：${url}`);
    }

    const text = lines.join('\n');

    const doCopy = () => {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        return navigator.clipboard.writeText(text);
      }
      return Promise.reject(new Error('Clipboard API not available'));
    };

    doCopy().then(() => {
      this.showToast('分享文案已复制');
    }).catch(() => {
      // fallback：创建临时 textarea 执行复制
      try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        ta.style.top = '0';
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(ta);
        this.showToast(ok ? '分享文案已复制' : '复制失败，请手动复制');
      } catch (e) {
        this.showToast('复制失败，请手动复制');
      }
    });
  }

  /**
   * 旧版文字分享（保留兼容）
   */
  shareEnding(ending) {
    const stats = this.state;
    const achList = (stats.achievements || []).map(a => a.icon + ' ' + (a.name || a.achievement || a)).join('  ');
    const text = [
      '【真还传·人生模拟】',
      '我的结局：' + ending.title,
      '理想主义：' + stats.pride + '  财富：' + stats.wealth + '  名声：' + stats.reputation + '  翻车：' + stats.failures,
      '成就：' + (achList || '无'),
      '来试试你的人生选择！'
    ].join('\n');

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        this.showToast('已复制到剪贴板');
      }).catch(() => {
        this.showToast('已复制到剪贴板');
      });
    } else {
      this.showToast('已复制到剪贴板');
    }
  }

  showCopyToast() {
    this.showToast('已复制到剪贴板');
  }

  /**
   * 场景关闭时清理资源，防止内存泄漏
   */
  shutdown() {
    // 清理音频系统
    if (this.audio) {
      this.audio.destroy();
      this.audio = null;
    }
    // 清理分享卡容器
    if (this.shareCardContainer) {
      this.shareCardContainer.destroy(true);
      this.shareCardContainer = null;
    }
    // 清理决策回顾面板
    if (this.reviewContainer) {
      this.reviewContainer.destroy(true);
      this.reviewContainer = null;
    }
    // 清理人生地图交互与 overlay
    this._destroyLifeMapInteractions();
    this.hideLifeMap();
    // 清理所有 tween 和 timer
    this.tweens.killAll();
    this.time.removeAllEvents();

    // 确保结局 DOM overlay 被隐藏并清理动态内容，避免返回标题/游戏时残留
    const endingOverlay = document.getElementById('ui-ending-overlay');
    if (endingOverlay) {
      endingOverlay.classList.remove('visible');
      const titleEl = document.getElementById('ui-ending-title');
      const descEl = document.getElementById('ui-ending-desc');
      const statsEl = document.getElementById('ui-ending-stats');
      const quoteEl = document.getElementById('ui-ending-quote');
      const summaryEl = document.getElementById('ui-ending-summary');
      const achievementsEl = document.getElementById('ui-ending-achievements');
      const buttonsEl = document.getElementById('ui-ending-buttons');
      if (titleEl) titleEl.textContent = '';
      if (descEl) descEl.textContent = '';
      if (statsEl) statsEl.innerHTML = '';
      if (quoteEl) quoteEl.textContent = '';
      if (summaryEl) summaryEl.textContent = '';
      if (achievementsEl) achievementsEl.innerHTML = '';
      if (buttonsEl) buttonsEl.innerHTML = '';
    }

    // 移除决策回顾面板（如果存在）
    const reviewPanel = document.getElementById('ui-review-panel');
    if (reviewPanel && reviewPanel.parentNode) {
      reviewPanel.parentNode.removeChild(reviewPanel);
    }

    // 移除历史真相回顾面板（如果存在）
    const historyReviewPanel = document.getElementById('ui-history-review-panel');
    if (historyReviewPanel && historyReviewPanel.parentNode) {
      historyReviewPanel.parentNode.removeChild(historyReviewPanel);
    }
  }

  // === 技能树面板 ===
  _showSkillTree() {
    // 移除已有面板
    const existing = document.getElementById('ui-skill-tree-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'ui-skill-tree-overlay';
    overlay.style.cssText = `
      position: fixed; inset: 0; background: rgba(5,5,15,0.92);
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      z-index: 100; overflow-y: auto; padding: 20px;
    `;

    // 标题栏
    const header = document.createElement('div');
    header.style.cssText = 'display: flex; align-items: center; gap: 16px; margin-bottom: 16px;';
    const title = document.createElement('h2');
    title.style.cssText = 'color: var(--color-gold); font-size: 18px; letter-spacing: 2px; margin: 0;';
    title.textContent = '♣ 人生技能树';
    const expDisplay = document.createElement('span');
    expDisplay.style.cssText = 'color: var(--color-gold); font-size: 14px; padding: 4px 12px; border: 1px solid var(--color-gold); border-radius: 4px;';
    expDisplay.id = 'skill-tree-exp';
    expDisplay.textContent = `${this.meta.getExp()} EXP`;
    header.appendChild(title);
    header.appendChild(expDisplay);

    // 经验获取提示
    if (this._expGained > 0) {
      const gain = document.createElement('span');
      gain.style.cssText = 'color: #40c040; font-size: 12px;';
      gain.textContent = `+${this._expGained} EXP${this._isNewEnding ? ' (新结局奖励!)' : ''}`;
      header.appendChild(gain);
    }
    overlay.appendChild(header);

    // 技能树容器
    const treesContainer = document.createElement('div');
    treesContainer.style.cssText = 'display: flex; flex-wrap: wrap; gap: 16px; justify-content: center; max-width: 900px;';

    // 渲染4棵技能树
    for (const tree of Object.values(SKILL_TREES)) {
      const treeEl = document.createElement('div');
      treeEl.style.cssText = `
        width: 200px; background: rgba(20,20,40,0.8); border: 1px solid ${tree.color}33;
        border-radius: 8px; padding: 12px;
      `;

      // 树标题
      const treeTitle = document.createElement('div');
      treeTitle.style.cssText = `color: ${tree.color}; font-size: 14px; font-weight: 700; margin-bottom: 4px;`;
      treeTitle.textContent = `${tree.icon} ${tree.name}`;
      treeEl.appendChild(treeTitle);

      const treeDesc = document.createElement('div');
      treeDesc.style.cssText = 'color: #6a6a8a; font-size: 10px; margin-bottom: 10px;';
      treeDesc.textContent = tree.desc;
      treeEl.appendChild(treeDesc);

      // 技能节点（支持 Lv4 分支并排与互斥逻辑）
      const renderedSkillIds = new Set();
      const createSkillNode = (skill) => {
        const isUnlocked = this.meta.isSkillUnlocked(skill.id);
        const isExcluded = this.meta.isLockedByExclusion(skill.id);
        const prereqsMet = this.meta.arePrerequisitesMet(skill.id);
        const isAvailable = prereqsMet && !isUnlocked && !isExcluded && this.meta.getExp() >= skill.cost;
        const node = document.createElement('div');
        node.style.cssText = `padding: 6px 8px; margin: 0; border-radius: 4px; cursor: ${isAvailable ? 'pointer' : 'default'}; border: 1px solid ${isUnlocked ? tree.color : isExcluded ? '#444455' : prereqsMet ? tree.color + '44' : '#333344'}; background: ${isUnlocked ? tree.color + '22' : 'rgba(10,10,20,0.6)'}; opacity: ${isExcluded ? 0.3 : (prereqsMet || isUnlocked) ? 1 : 0.4}; transition: all 0.2s; flex: 1; min-width: 0;`;
        if (isAvailable) {
          node.addEventListener('mouseenter', () => { node.style.borderColor = tree.color; node.style.background = tree.color + '33'; });
          node.addEventListener('mouseleave', () => { node.style.borderColor = isUnlocked ? tree.color : (tree.color + '44'); node.style.background = isUnlocked ? (tree.color + '22') : 'rgba(10,10,20,0.6)'; });
        }
        let icon = '◑';
        if (isUnlocked) icon = '✓';
        else if (isExcluded) icon = '✗';
        else if (prereqsMet) icon = '○';
        node.innerHTML = `<div style="display: flex; justify-content: space-between; align-items: center;"><span style="color: ${isUnlocked ? tree.color : isExcluded ? '#666677' : '#aaaabb'}; font-size: 11px; font-weight: 600;">${icon} ${skill.name}</span><span style="color: ${isUnlocked ? '#40c040' : isExcluded ? '#666677' : 'var(--color-gold)'}; font-size: 9px;">${isUnlocked ? '已解锁' : isExcluded ? '已排斥' : `${skill.cost} EXP`}</span></div><div style="color: #8a8aaa; font-size: 9px; margin-top: 3px;">${skill.desc}</div>`;
        if (isAvailable) {
          node.addEventListener('click', () => {
            if (this.meta.spendExp(skill.cost)) {
              this.meta.unlockSkill(skill.id);
              try { this.audio.playAchievement(); } catch(e) {}
              this._showSkillTree();
            }
          });
        }
        return node;
      };
      for (const skill of tree.skills) {
        if (renderedSkillIds.has(skill.id)) continue;
        if (skill.exclusiveWith) {
          const partner = tree.skills.find(s => skill.exclusiveWith.includes(s.id));
          const branchWrap = document.createElement('div');
          branchWrap.style.cssText = 'margin: 4px 0;';
          const branchLabel = document.createElement('div');
          branchLabel.style.cssText = 'color: #f0a040; font-size: 9px; text-align: center; margin-bottom: 2px; font-weight: 600;';
          branchLabel.textContent = '⚠ Lv4 二选一';
          branchWrap.appendChild(branchLabel);
          const branchRow = document.createElement('div');
          branchRow.style.cssText = 'display: flex; gap: 4px;';
          branchRow.appendChild(createSkillNode(skill));
          if (partner) branchRow.appendChild(createSkillNode(partner));
          branchWrap.appendChild(branchRow);
          treeEl.appendChild(branchWrap);
          renderedSkillIds.add(skill.id);
          if (partner) renderedSkillIds.add(partner.id);
        } else {
          const node = createSkillNode(skill);
          node.style.margin = '4px 0';
          treeEl.appendChild(node);
          renderedSkillIds.add(skill.id);
        }
      }

      treesContainer.appendChild(treeEl);
    }
    overlay.appendChild(treesContainer);

    // 关闭按钮
    const closeBtn = document.createElement('button');
    closeBtn.style.cssText = `
      margin-top: 16px; padding: 8px 24px; background: var(--color-bg-border); color: #aaaabb;
      border: 1px solid #333344; border-radius: 4px; cursor: pointer; font-size: 13px;
    `;
    closeBtn.textContent = '关闭';
    closeBtn.addEventListener('click', () => overlay.remove());
    overlay.appendChild(closeBtn);

    document.body.appendChild(overlay);
  }
}
