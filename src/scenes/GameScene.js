import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, SCENE_ASSETS, CHARACTER_ASSETS, ENDING_SCENE_MAP } from '../config.js';
import { STORY, CHAR_INFO } from '../data/story.js';
import { PixelRenderer } from '../systems/PixelRenderer.js';
import { DialogSystem } from '../systems/DialogSystem.js';
import { ChoiceSystem } from '../systems/ChoiceSystem.js';
import { StatsSystem } from '../systems/StatsSystem.js';
import { Transition } from '../systems/Transition.js';
import { AudioSystem, VOICE_PRESETS } from '../systems/AudioSystem.js';
import { SaveSystem } from '../systems/SaveSystem.js';
import { HistoryCard } from '../ui/HistoryCard.js';
import { showSaveLoadPanel } from '../ui/SaveLoadPanel.js';
import { AchievementPopup, isHiddenAchievement, addAchievementToStorage, HIDDEN_ACHIEVEMENTS, ALL_ACHIEVEMENTS, loadUnlockedHiddenEndings, addHiddenEndingToStorage, addEndingToStorage, findAchievementDef, getAchievementScore, checkComboAchievements, loadUnlockedAchievements } from '../ui/AchievementPopup.js';
import { TalentSystem } from '../systems/TalentSystem.js';
import { RandomEventSystem } from '../systems/RandomEventSystem.js';
import { drawTalents, applyTalentEffects } from '../data/talents.js';
import { matchEnding } from '../data/endings.js';
import { getStageByNodeId, STAGES } from '../data/stages.js';
import { applyEffects, checkPressureCrash, checkThresholdTriggers, checkComboTriggers, checkFlagConsequences, createInitialState, ATTRIBUTES } from '../data/effects.js';
import { MetaProgression } from '../systems/MetaProgression.js';
import { toast } from '../systems/ToastSystem.js';
import { DebugLogger } from '../systems/DebugLogger.js';

// 关键冲击场景集合：进入这些场景时触发白闪，增强转场冲击感
// 落实项目硬约束：冰箱砸碎/法庭/脱口秀等关键场景转场应有 1-2 帧白闪
const FLASH_SCENES = new Set(['fridge_smash', 'court', 'talkshow']);

// 杀手级时刻节点集合：进入这些节点时触发四维特效（视觉+音效+文案+压力）
// 复赛核心记忆点——评委10分钟后只能记住1-2个瞬间，这些瞬间必须做到惊艳
// act6_night: 6亿欠款·空办公室的深夜——"最难的不是欠6个亿，是凌晨三点醒来"
// act6_crash: 资金链断裂·债务从2亿到6亿
// act_fridge_smash: 砸冰箱维权——一锤成名的起点
// act7_first_live: 首播前夜——放下身段赚钱还债
// act6_a: TNT鸟巢演示演砸——理想主义最贵的一次摔跤
const KILLER_NODES = new Set(['act6_night', 'act6_crash', 'act_fridge_smash', 'act7_first_live', 'act6_a']);

export class GameScene extends Phaser.Scene {
  constructor() { super('GameScene'); }

  // 姿态→纹理key映射
  static CHAR_TEXTURES = {
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

  // 场景光照配置：让角色融入背景
  // tint: 角色主色调叠加（模拟环境光）
  // rimColor: 边缘轮廓光颜色
  // rimAlpha: 边缘光强度
  // shadowColor: 地面阴影颜色
  // shadowAlpha: 阴影透明度
  // shadowScale: 阴影宽度倍数
  // warmOverlay: 角色前方暖色叠加强度（模拟舞台光从前方照射）
  static SCENE_LIGHTING = {
    classroom:   { tint: 0xffe8c0, tintAlpha: 0.08, rimColor: 0xffcc66, rimAlpha: 0.12, shadowColor: 0x2a1a0a, shadowAlpha: 0.30, shadowScale: 0.9, warmOverlay: 0.04 },
    lecture:     { tint: 0xffd890, tintAlpha: 0.10, rimColor: 0xffbb44, rimAlpha: 0.15, shadowColor: 0x1a0e00, shadowAlpha: 0.35, shadowScale: 0.8, warmOverlay: 0.06 },
    office:      { tint: 0xd0dce8, tintAlpha: 0.04, rimColor: 0x88aacc, rimAlpha: 0.07, shadowColor: 0x0a0a18, shadowAlpha: 0.25, shadowScale: 0.9, warmOverlay: 0.0 },
    // 场景变体：人去楼空的夜晚办公室（冷蓝夜色+EXIT灯）
    office_empty:{ tint: 0x8fa8c8, tintAlpha: 0.10, rimColor: 0x5a8ac0, rimAlpha: 0.12, shadowColor: 0x050810, shadowAlpha: 0.38, shadowScale: 0.85, warmOverlay: 0.0 },
    // 场景变体：雨夜债务深夜的办公桌（深蓝雨夜+屏幕青光）
    office_dark: { tint: 0x90b0d0, tintAlpha: 0.08, rimColor: 0x66b8e8, rimAlpha: 0.14, shadowColor: 0x04060c, shadowAlpha: 0.40, shadowScale: 0.85, warmOverlay: 0.0 },
    // 场景变体：深夜街道（冷蓝夜色，比白天 street 更冷更暗）
    street_night:{ tint: 0x7090b0, tintAlpha: 0.12, rimColor: 0x4488cc, rimAlpha: 0.12, shadowColor: 0x050810, shadowAlpha: 0.38, shadowScale: 0.85, warmOverlay: 0.0 },
    // 场景变体：白天忙碌创业办公室（明亮暖阳）
    office_busy: { tint: 0xfff0d8, tintAlpha: 0.05, rimColor: 0xffdd99, rimAlpha: 0.08, shadowColor: 0x1a1408, shadowAlpha: 0.22, shadowScale: 0.9, warmOverlay: 0.03 },
    // 场景变体：首播简陋直播间（昏暗暖台灯）
    livestream_first: { tint: 0xffd090, tintAlpha: 0.10, rimColor: 0xffaa44, rimAlpha: 0.12, shadowColor: 0x100800, shadowAlpha: 0.35, shadowScale: 0.85, warmOverlay: 0.05 },
    // 场景变体：90年代小城白天老街（明亮暖阳）
    street_day:  { tint: 0xffe8c0, tintAlpha: 0.06, rimColor: 0xffcc66, rimAlpha: 0.10, shadowColor: 0x2a1a0a, shadowAlpha: 0.25, shadowScale: 0.9, warmOverlay: 0.04 },
    // 场景变体：巨型体育馆（深蓝夜色+金色舞台光）
    stage_arena: { tint: 0xffc870, tintAlpha: 0.12, rimColor: 0xffaa33, rimAlpha: 0.20, shadowColor: 0x0a0600, shadowAlpha: 0.40, shadowScale: 0.7, warmOverlay: 0.08 },
    stage:       { tint: 0xffc870, tintAlpha: 0.12, rimColor: 0xffaa33, rimAlpha: 0.20, shadowColor: 0x0a0600, shadowAlpha: 0.40, shadowScale: 0.7, warmOverlay: 0.08 },
    livestream:  { tint: 0xf0f4ff, tintAlpha: 0.06, rimColor: 0x88ccff, rimAlpha: 0.12, shadowColor: 0x0a0a1a, shadowAlpha: 0.25, shadowScale: 0.9, warmOverlay: 0.03 },
    lab:         { tint: 0xd8e4f0, tintAlpha: 0.04, rimColor: 0x77aadd, rimAlpha: 0.07, shadowColor: 0x081018, shadowAlpha: 0.25, shadowScale: 0.9, warmOverlay: 0.0 },
    podcast:     { tint: 0xead5b5, tintAlpha: 0.06, rimColor: 0xcc9966, rimAlpha: 0.10, shadowColor: 0x1a1008, shadowAlpha: 0.28, shadowScale: 0.85, warmOverlay: 0.03 },
    street:      { tint: 0x7090b0, tintAlpha: 0.10, rimColor: 0x4488cc, rimAlpha: 0.10, shadowColor: 0x050810, shadowAlpha: 0.35, shadowScale: 0.85, warmOverlay: 0.0 },
    fridge_smash:{ tint: 0xff9050, tintAlpha: 0.12, rimColor: 0xff6622, rimAlpha: 0.18, shadowColor: 0x1a0800, shadowAlpha: 0.40, shadowScale: 0.75, warmOverlay: 0.08 },
    talkshow:    { tint: 0xffd090, tintAlpha: 0.10, rimColor: 0xffaa44, rimAlpha: 0.15, shadowColor: 0x1a1000, shadowAlpha: 0.35, shadowScale: 0.8, warmOverlay: 0.06 },
    court:       { tint: 0xd8d8e0, tintAlpha: 0.03, rimColor: 0x9999aa, rimAlpha: 0.06, shadowColor: 0x0a0a10, shadowAlpha: 0.28, shadowScale: 0.9, warmOverlay: 0.0 },
    ending:      { tint: 0xffd890, tintAlpha: 0.10, rimColor: 0xffcc44, rimAlpha: 0.18, shadowColor: 0x1a1200, shadowAlpha: 0.30, shadowScale: 0.8, warmOverlay: 0.05 }
  };

  static _getSceneLighting(bgType) {
    return GameScene.SCENE_LIGHTING[bgType] || GameScene.SCENE_LIGHTING.classroom;
  }

  static BG_TEXTURES = (() => {
    const m = {};
    for (const a of SCENE_ASSETS) m[a.type] = a.key;
    return m;
  })();

  preload() {
    // 懒加载策略：首屏只加载序章 + 第一章必需资源
    // - classroom + standing：序章教室场景
    // - young：第一章青年立绘（_inferMood 规则：youth/teacher 阶段强制用 young）
    // - office：第二章办公室场景（提前预读，避免章节切换卡顿）
    // 其余资源在 _renderNode 时按需加载 + _preloadAdjacentScenes 后台预读
    this.load.image('bg-classroom', 'assets/characters/scene-classroom-v2.webp');
    this.load.image('char-standing', 'assets/characters/luo-standing-v2-nobg.webp');
    this.load.image('char-young', 'assets/characters/luo-young-v2-nobg.webp');
    this.load.image('bg-office', 'assets/characters/scene-office-v2.webp');
  }

  // === 资源懒加载辅助 ===
  // type/pose → url 反查表（避免每次循环查找 SCENE_ASSETS/CHARACTER_ASSETS）
  static _SCENE_URL_BY_TYPE = (() => {
    const m = {};
    for (const a of SCENE_ASSETS) m[a.type] = a.url;
    return m;
  })();
  static _CHAR_URL_BY_POSE = (() => {
    const m = {};
    for (const a of CHARACTER_ASSETS) m[a.pose] = a.url;
    return m;
  })();

  // 已发起但尚未完成的加载去重表（key → Promise），避免并发重复加载
  _loadingPromises = new Map();

  /**
   * 异步确保某个场景背景纹理已加载。
   * 已存在 → 立即 resolve；已发起 → 复用同一 Promise；未加载 → 触发 load。
   * @param {string} sceneType 场景类型（classroom/stage/...）
   * @returns {Promise<void>}
   */
  _ensureSceneTexture(sceneType) {
    const assetKey = `bg-${sceneType}`;
    if (this.textures.exists(assetKey)) return Promise.resolve();

    // 已在加载中：复用 Promise
    if (this._loadingPromises.has(assetKey)) {
      return this._loadingPromises.get(assetKey);
    }

    const url = GameScene._SCENE_URL_BY_TYPE[sceneType];
    if (!url) return Promise.resolve(); // 无对应资源，drawBackground 会用 Graphics 兜底

    const p = new Promise((resolve) => {
      this.load.once(`filecomplete-image-${assetKey}`, () => resolve());
      this.load.image(assetKey, url);
      // 失败也要 resolve，避免卡住流程（drawBackground 会自动降级）
      this.load.once(`loaderror`, () => resolve());
      if (!this.load.isLoading()) this.load.start();
    });
    this._loadingPromises.set(assetKey, p);
    p.finally(() => this._loadingPromises.delete(assetKey));
    return p;
  }

  /**
   * 异步确保某个角色姿态纹理已加载。
   * @param {string} pose 姿态（standing/angry/young/...）
   * @returns {Promise<void>}
   */
  _ensureCharacterTexture(pose) {
    const assetKey = `char-${pose}`;
    if (this.textures.exists(assetKey)) return Promise.resolve();
    if (this._loadingPromises.has(assetKey)) {
      return this._loadingPromises.get(assetKey);
    }
    const url = GameScene._CHAR_URL_BY_POSE[pose];
    if (!url) return Promise.resolve();

    const p = new Promise((resolve) => {
      this.load.once(`filecomplete-image-${assetKey}`, () => resolve());
      this.load.image(assetKey, url);
      this.load.once(`loaderror`, () => resolve());
      if (!this.load.isLoading()) this.load.start();
    });
    this._loadingPromises.set(assetKey, p);
    p.finally(() => this._loadingPromises.delete(assetKey));
    return p;
  }

  /**
   * 后台预读当前节点选项指向的下一节点资源（fire-and-forget，不阻塞渲染）。
   * 玩家点选项时，对应场景图 + 角色立绘通常已在缓存中，切换无感知。
   * 同一节点最多预读 N 个相邻场景（默认上限 4，避免一次性触发过多请求）。
   *
   * 优化：除场景背景外，同时预读角色姿态立绘，
   * 避免 _renderNode → _ensureCharacterTexture 的现场加载卡顿。
   */
  _preloadAdjacentScenes(node) {
    if (!node.choices || !node.choices.length) return;
    const seen = new Set();
    let count = 0;
    for (const c of node.choices) {
      if (count >= 4) break;
      if (!c || !c.next) continue;
      const nextNode = STORY[c.next];
      if (!nextNode || !nextNode.sceneType) continue;
      if (seen.has(nextNode.sceneType)) continue;
      seen.add(nextNode.sceneType);
      // 预读场景背景
      this._ensureSceneTexture(nextNode.sceneType);
      // 预读角色姿态：复用 _resolveEffectivePose 逻辑推断下一节点姿态
      const nextPose = this._predictNodePose(c.next, nextNode);
      if (nextPose) this._ensureCharacterTexture(nextPose);
      count++;
    }
  }

  /**
   * 预测给定节点的角色姿态（用于预读，避免与 _renderNode 的 _inferMood 重复耦合）。
   * 简化版推断：mood > livestream > 阶段推断 > 默认 standing
   * 不做 state 属性推断（pressure/failures），因为预读时 state 可能尚未变化。
   * @param {string} nodeId 节点 ID（用于阶段推断）
   * @param {object} node 目标节点对象
   * @returns {string|null} 姿态名（如 'young'/'middle'/'livestream'），null 表示用 standing
   */
  _predictNodePose(nodeId, node) {
    if (!node) return null;
    // 1. 节点显式 mood 优先
    if (node.mood) return node.mood;
    // 2. 直播场景固定立绘
    if (node.sceneType === 'livestream') return 'livestream';
    // 3. 阶段推断：简化版（不查 state，仅按节点 ID 归属阶段）
    const stage = getStageByNodeId(nodeId);
    if (stage) {
      const earlyStages = new Set(['youth', 'teacher']);
      const middleStages = new Set(['startup', 'dark', 'repay', 'reborn']);
      if (earlyStages.has(stage.id)) return 'young';
      if (middleStages.has(stage.id)) return 'middle';
    }
    // 4. 默认 standing
    return 'standing';
  }

  init(data) {
    data = data || {};
    this.isNewGame = !data.state;

    if (data.state) {
      // 继续游戏：恢复状态
      this.state = { ...data.state };
      // 恢复Set对象（JSON序列化后变成数组，需兼容数组、Set、普通对象、null/undefined）
      this.state.flags = this._toSet(data.state.flags);
      this.state.triggeredEvents = this._toSet(data.state.triggeredEvents);
      // 清理已废弃的 choicesMade 字段（历史冗余字段，现统一使用 history）
      delete this.state.choicesMade;
    } else {
      // 新游戏：使用默认初始状态
      this.state = createInitialState();
      // 记录游戏开始时间（用于速通成就检测）
      this.state.gameStartTime = Date.now();

      // 累计游玩次数 +1
      this._incrementPlayCount();
    }

    // === 跨周目进度系统（新游戏和读档都需要） ===
    this.meta = new MetaProgression();
    if (this.isNewGame) {
      this._applyMetaSkills();
    }
    if (!this.state.achievements) this.state.achievements = [];

    // 兼容旧存档：确保 gameStartTime 存在
    if (!this.state.gameStartTime) this.state.gameStartTime = Date.now();

    // 选择计时（用于速通检测）
    this._choiceStartTime = Date.now();
    this._firstChoiceTime = null;
    this._lastChoiceTime = null;
    this._totalChoicesMade = 0;

    // 原生 setTimeout 引用列表（_onShutdown 时集中清理，防止场景切换后回调引用已销毁对象）
    this._pendingTimeouts = [];
  }

  /**
   * 安全注册原生 setTimeout 并跟踪引用，_onShutdown 时自动清理
   * 用于阶段结算/检定动画/成就弹窗等需要在场景切换时取消的回调
   * @param {Function} fn 回调函数
   * @param {number} delay 延迟毫秒
   * @returns {number} setTimeout id
   */
  _trackedTimeout(fn, delay) {
    const id = setTimeout(() => {
      // 回调触发时从列表中移除自身引用
      const idx = this._pendingTimeouts.indexOf(id);
      if (idx >= 0) this._pendingTimeouts.splice(idx, 1);
      try { fn(); } catch (e) { /* 场景已销毁时静默忽略 */ }
    }, delay);
    this._pendingTimeouts.push(id);
    return id;
  }

  /**
   * 安全地将值转换为 Set（兼容数组、Set、普通对象、null/undefined 等各种存档格式）
   * 修复：旧存档中 flags 可能被序列化为 {} 而非 []，此时尝试提取其键作为 Set 成员
   */
  _toSet(val) {
    if (!val) return new Set();
    if (val instanceof Set) return new Set(val);
    if (Array.isArray(val)) return new Set(val);
    // 兜底：如果是普通对象（旧存档损坏），尝试提取其键作为成员
    if (typeof val === 'object') {
      try {
        const keys = Object.keys(val);
        if (keys.length > 0) return new Set(keys);
      } catch (e) {}
    }
    return new Set();
  }

  /**
   * 累计游玩次数
   */
  _incrementPlayCount() {
    try {
      let count = parseInt(localStorage.getItem('luohammer_play_count') || '0', 10);
      count++;
      localStorage.setItem('luohammer_play_count', String(count));
    } catch (e) {}
  }

  /**
   * 获取累计游玩次数
   */
  _getPlayCount() {
    try {
      return parseInt(localStorage.getItem('luohammer_play_count') || '0', 10);
    } catch (e) {
      return 0;
    }
  }

  /**
   * 应用跨周目已解锁的技能效果到当前游戏状态
   */
  _applyMetaSkills() {
    if (!this.meta) return;
    const effects = this.meta.getAllEffects();

    for (const eff of effects) {
      switch (eff.type) {
        case 'init_bonus':
          // 初始属性加成
          if (eff.attr && eff.value) {
            this.state[eff.attr] = (this.state[eff.attr] || 0) + eff.value;
          }
          break;
        case 'pressure_cap':
          // 抗压体质：压力上限提升（effects.js 中 checkPressureCrash/applyEffects 读取 state.pressureMax）
          this.state.pressureMax = eff.value;
          break;
        case 'comeback_boost':
          // 翻车后效果增强（标记，在 makeChoice 中使用）
          this.state._comebackBoost = eff.value;
          break;
        case 'free_retry':
          // 免费重试次数
          this.state._freeRetry = eff.value;
          break;
        case 'auto_preview':
          // 选项自动预览
          this.state._autoPreview = true;
          break;
        case 'show_check_info':
          // 显示检定信息
          this.state._showCheckInfo = true;
          break;
        case 'show_alignment':
          // 显示选项倾向
          this.state._showAlignment = true;
          break;
        case 'extra_choices':
          // 解锁特殊选项
          this.state._extraChoices = true;
          break;
        // === 新增 Lv4/Lv5 技能效果 ===
        case 'pressure_cap_15':
          // 泰山崩于前：压力上限提升到 15，初始压力 +2
          this.state.pressureMax = eff.value;
          this.state.pressure = (this.state.pressure || 0) + 2;
          break;
        case 'crash_keep_stats':
          // 绝境逢生：压力崩溃时保留 50% 属性（在 _handlePressureCrash 中使用）
          this.state._crashKeepStats = eff.value;
          break;
        case 'phoenix_revive':
          // 不死鸟：每局一次满血复活机会
          this.state._phoenixRevive = eff.value;
          break;
        case 'reputation_check_bonus':
          // 一呼百应：名声≥7 时检定 +1（在 _performCheck 中使用）
          this.state._reputationCheckBonus = eff.value;
          break;
        case 'trust_fail_mitigate':
          // 患难之交：信任≥7 时失败惩罚减半（在 _performCheck 中使用）
          this.state._trustFailMitigate = eff.value;
          break;
        case 'init_bonus_all':
          // 人脉网络：所有属性 +1
          this.state.pride = Math.min(10, (this.state.pride || 5) + 1);
          this.state.wealth = Math.min(10, (this.state.wealth || 5) + 1);
          this.state.reputation = Math.min(10, (this.state.reputation || 5) + 1);
          this.state.trust = Math.min(10, (this.state.trust || 5) + 1);
          break;
        case 'show_event_omen':
          // 预知未来：随机事件触发前显示预兆
          this.state._showEventOmen = true;
          break;
        case 'show_npc_attitude':
          // 洞察人心：进入节点时显示 NPC 态度提示
          this.state._showNpcAttitude = true;
          break;
        case 'show_hidden_hints':
          // 全知之眼：成就图鉴显示隐藏成就提示
          this.state._showHiddenHints = true;
          break;
        case 'low_wealth_boost':
          // 绝地反击：财富≤2 时正面效果 +50%（在效果引擎 getMultiplier 中读取）
          this.state._lowWealthBoost = eff.value;
          break;
        case 'steady_wealth':
          // 稳扎稳打：初始财富 +3，但失去天赋加成
          this.state.wealth = Math.min(10, (this.state.wealth || 5) + eff.value);
          this.state._steadyWealth = true;
          break;
        case 'talent_reroll':
          // 逆天改命：游戏开始时可重选一次天赋
          this.state._talentReroll = eff.value;
          break;
        case 'unlock_ending':
          // 真·归来：解锁隐藏结局的额外条件路径
          // 在 endings.js 的对应结局 check 中识别 _unlockedEndings 数组
          if (!Array.isArray(this.state._unlockedEndings)) {
            this.state._unlockedEndings = [];
          }
          if (!this.state._unlockedEndings.includes(eff.value)) {
            this.state._unlockedEndings.push(eff.value);
          }
          break;
        // check_fail_mitigate 在 _performCheck 中通过 meta.getEffect 直接查询
      }
    }
  }

  /**
   * 移动端触觉反馈（安卓原生支持，iOS 16+ 部分支持）
   * @param {number} ms - 振动时长（毫秒）
   */
  vibrate(ms = 15) {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try { navigator.vibrate(ms); } catch (e) {}
    }
  }

  /**
   * 加载跨周目节点选择记录（用于平行宇宙成就检测）
   */
  _loadNodeChoices() {
    try {
      const raw = localStorage.getItem('luohammer_node_choices');
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }

  /**
   * 保存跨周目节点选择记录
   */
  _saveNodeChoices(choices) {
    try {
      localStorage.setItem('luohammer_node_choices', JSON.stringify(choices));
    } catch (e) {}
  }

  create() {
    this.pixelRenderer = new PixelRenderer(this);
    this.dialog = new DialogSystem(this);
    this.choices = new ChoiceSystem(this);
    this.stats = new StatsSystem(this);
    this.transition = new Transition(this);
    this.audio = new AudioSystem(this);
    this.audio.unlock();  // 用户已经点击开始按钮，强制解锁
    this.save = new SaveSystem(this);
    this.historyCard = new HistoryCard(this);
    this.achievementPopup = new AchievementPopup(this);
    this.talentSystem = new TalentSystem(this);
    this.randomEventSystem = new RandomEventSystem(this);
    this.debug = new DebugLogger();

    // 注册场景 shutdown 事件，确保场景切换时清理资源
    this.events.on('shutdown', this._onShutdown, this);

    // Chapter display (DOM overlay)
    this.chapterNameEl = document.getElementById('ui-chapter-name');
    this.chapterSubEl = document.getElementById('ui-chapter-sub');
    this.progressFillEl = document.getElementById('ui-progress-fill');
    this.chapterEl = document.getElementById('ui-chapter');
    if (this.chapterEl) this.chapterEl.classList.add('visible');

    // Sound toggle (DOM overlay)
    this.soundToggleEl = document.getElementById('ui-sound-toggle');
    this.soundIconEl = document.getElementById('ui-sound-icon');
    if (this.soundIconEl) this.soundIconEl.textContent = this.audio.enabled ? '♪' : '×';
    if (this.soundToggleEl) this.soundToggleEl.classList.add('visible');

    // Sound toggle event listener (managed by AbortController for cleanup)
    this._uiAbortController = new AbortController();
    const uiSignalOpts = { signal: this._uiAbortController.signal };
    if (this.soundToggleEl) {
      this.soundToggleEl.addEventListener('click', () => {
        this.audio.toggle();
        if (this.soundIconEl) this.soundIconEl.textContent = this.audio.enabled ? '♪' : '×';
      }, uiSignalOpts);
    }

    // === 剧情朗读开关 ===
    this.narrationToggleEl = document.getElementById('ui-narration-toggle');
    this.narrationIconEl = document.getElementById('ui-narration-icon');
    if (this.narrationIconEl) this.narrationIconEl.textContent = this.audio.isNarrationEnabled() ? '朗读✓' : '朗读';
    if (this.narrationToggleEl) {
      this.narrationToggleEl.classList.toggle('active', this.audio.isNarrationEnabled());
      this.narrationToggleEl.classList.add('visible');
      this.narrationToggleEl.addEventListener('click', () => {
        const on = this.audio.toggleNarration();
        this.narrationToggleEl.classList.toggle('active', on);
        if (this.narrationIconEl) this.narrationIconEl.textContent = on ? '朗读✓' : '朗读';
        if (!on) this.audio.stopSpeaking();
      }, uiSignalOpts);
    }

    // === 音色快捷切换按钮（游戏内直接切换配音预设，无需返回标题页）===
    this.voiceToggleEl = document.getElementById('ui-voice-toggle');
    this.voiceIconEl = document.getElementById('ui-voice-icon');
    if (this.voiceToggleEl) {
      this.voiceToggleEl.classList.add('visible');
      // 显示当前预设简称
      this._updateVoiceToggleLabel();
      this.voiceToggleEl.addEventListener('click', () => {
        this.vibrate(12);
        this._showQuickVoicePanel();
      }, uiSignalOpts);
    }

    // === 菜单按钮 + ESC快捷键返回标题 ===
    this.menuToggleEl = document.getElementById('ui-menu-toggle');
    this.menuConfirmEl = document.getElementById('ui-menu-confirm');
    this.menuCancelBtn = document.getElementById('ui-menu-cancel');
    this.menuOkBtn = document.getElementById('ui-menu-ok');
    if (this.menuToggleEl) this.menuToggleEl.classList.add('visible');

    this._showMenuConfirm = () => {
      if (this.menuConfirmEl) this.menuConfirmEl.classList.add('visible');
    };
    this._hideMenuConfirm = () => {
      if (this.menuConfirmEl) this.menuConfirmEl.classList.remove('visible');
    };
    this._returnToMenu = () => {
      this._hideMenuConfirm();
      // 自动保存
      try { this.save.save(this._serializeState()); } catch(e) {}
      // 清理可能干扰的定时器，然后直接切换场景
      try { this.time.removeAllEvents(); } catch(e) {}
      // 停止BGM（非阻塞，新场景会重新创建 AudioSystem）
      try { this.audio.fadeOutBGM(0.3); } catch(e) {}
      // 直接返回标题（不使用 delayedCall，避免被 shutdown 时的 removeAllEvents 清除）
      this.scene.start('BootScene');
    };

    if (this.menuToggleEl) {
      this.menuToggleEl.addEventListener('click', this._showMenuConfirm, uiSignalOpts);
    }
    if (this.menuCancelBtn) {
      this.menuCancelBtn.addEventListener('click', this._hideMenuConfirm, uiSignalOpts);
    }
    if (this.menuOkBtn) {
      this.menuOkBtn.addEventListener('click', this._returnToMenu, uiSignalOpts);
    }

    // === 菜单弹窗增加"保存游戏"按钮 + 改为暂停菜单风格 ===
    this._setupSaveButton(uiSignalOpts);

    // ESC 快捷键
    this._escHandler = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        // 存档面板打开时，ESC 由面板自行处理，避免冲突
        const saveload = document.getElementById('ui-saveload-overlay');
        if (saveload && saveload.classList.contains('visible')) return;
        if (this.menuConfirmEl && this.menuConfirmEl.classList.contains('visible')) {
          this._hideMenuConfirm();
        } else {
          this._showMenuConfirm();
        }
      }
    };
    window.addEventListener('keydown', this._escHandler);

    // === 移动端双指点击快速打开菜单 ===
    this._setupTwoFingerTap();

    // === DialogSystem Hooks：剧情文字开始时朗读 ===
    this.dialog.setHook('onTextStart', (characterName, text) => {
      if (this.audio.isNarrationEnabled()) {
        this.audio.speak(text);
      }
    });
    // 对话框隐藏时停止朗读
    this.dialog.setHook('onHide', () => {
      this.audio.stopSpeaking();
    });

    // 阶段 BGM 追踪与启动
    this._currentBGMType = null;
    this._bgmStarted = false;
    this._tryStartStageBGM();

    // 兜底：若从 BootScene 带入的音频上下文未解锁，首次交互时解锁并启动 BGM
    this._bgmUnlockFallback = async () => {
      await this.audio.unlock();
      this._tryStartStageBGM();
    };
    window.addEventListener('pointerdown', this._bgmUnlockFallback, { once: true });

    this.stats.update(this.state);

    // 暴露调试接口到控制台
    if (this.debug && this.debug.isEnabled()) {
      window.__luohammerDebug = {
        logger: this.debug,
        exportLogs: () => this.debug.downloadLogs(),
        getSummary: () => this.debug.getSummary(),
        printSummary: () => console.table(this.debug.getSummary()),
        state: () => this.state
      };
      console.log('[Debug] 调试模式已启用。可用命令：\n  __luohammerDebug.printSummary()\n  __luohammerDebug.exportLogs()\n  __luohammerDebug.state()');
    }

    // 首次进入游戏时提示键盘快捷键（桌面端，仅一次）
    if (!('ontouchstart' in window) && !localStorage.getItem('luohammer_kbd_hint_shown')) {
      localStorage.setItem('luohammer_kbd_hint_shown', '1');
      this._trackedTimeout(() => {
        try { toast('键盘提示：A 自动播放 · S 打字速度 · 空格继续', 3500); } catch (e) {}
      }, 2500);
    }

    // 新游戏：先显示天赋选择
    if (this.isNewGame) {
      // 先绘制一个默认背景，避免天赋选择阶段黑屏
      this.pixelRenderer.drawBackground('classroom');
      this._showTalentSelection();
    } else {
      this.loadNode(this.state.currentNode);
    }
  }

  /**
   * 在菜单确认弹窗中插入"保存游戏"按钮，并将其改造为暂停菜单风格。
   * 点击后打开 SaveLoadPanel（save 模式，自动槽位只读）。
   * @param {object} uiSignalOpts - AbortController 的监听选项
   */
  _setupSaveButton(uiSignalOpts) {
    if (!this.menuConfirmEl) return;
    const btnsRow = this.menuConfirmEl.querySelector('.ui-menu-confirm-btns');
    if (!btnsRow || this._saveGameBtn) return;

    // 更新弹窗文案为暂停菜单风格
    const textEl = this.menuConfirmEl.querySelector('.ui-menu-confirm-text');
    if (textEl) {
      textEl.innerHTML = '已暂停<br><small>当前进度已自动保存。</small>';
    }

    // 创建"保存游戏"按钮，插入到"返回菜单"按钮之前（跨场景重启时复用同一节点）
    let saveBtn = document.getElementById('ui-menu-save-game');
    if (!saveBtn) {
      saveBtn = document.createElement('button');
      saveBtn.id = 'ui-menu-save-game';
      saveBtn.className = 'ui-menu-confirm-btn';
      saveBtn.textContent = '保存游戏';
      btnsRow.insertBefore(saveBtn, this.menuOkBtn);
    }
    this._saveGameBtn = saveBtn;

    saveBtn.addEventListener('click', () => {
      // 关闭菜单弹窗，打开存档面板
      this._hideMenuConfirm();
      showSaveLoadPanel({
        mode: 'save',
        saveSystem: this.save,
        currentState: this._serializeState(),
        onLoad: (slotId, state) => {
          // 读取存档：以加载的状态重启 GameScene
          try { this.audio.fadeOutBGM(0.4); } catch (e) {}
          this.scene.start('GameScene', { state });
        }
      });
    }, uiSignalOpts);
  }

  /**
   * 移动端双指点击快速打开菜单
   * - 只在触摸设备上启用
   * - 双指同时触摸屏幕时触发 _showMenuConfirm
   * - 使用 passive: true，不阻止默认行为
   * - 监听器通过 _gestureAbortController 管理，场景关闭时清理
   */
  _setupTwoFingerTap() {
    if (!('ontouchstart' in window)) return;

    const target = this.sys.game.canvas;
    if (!target) return;

    // 使用独立的 AbortController 管理手势监听器，便于场景关闭时清理
    this._gestureAbortController = new AbortController();

    target.addEventListener('touchstart', (e) => {
      if (e.touches.length === 2) {
        // 菜单确认弹窗已可见时不重复触发
        if (this.menuConfirmEl && this.menuConfirmEl.classList.contains('visible')) return;
        // 选项面板可见时不触发（避免误触）
        const choicesEl = document.getElementById('ui-choices');
        if (choicesEl && choicesEl.classList.contains('visible')) return;
        this.vibrate(10);
        this._showMenuConfirm();
      }
    }, { signal: this._gestureAbortController.signal, passive: true });
  }

  /**
   * 每帧更新（Phaser 生命周期）
   */
  update(time, delta) {
    // 更新打字机效果（累积时间驱动，替代逐字 delayedCall）
    if (this.dialog) {
      this.dialog.update(time, delta);
    }
    // 更新渲染器效果（粒子、震动等）
    if (this.pixelRenderer) {
      this.pixelRenderer.updateEffects(delta / 1000);
      this.pixelRenderer.render();
      // 覆盖 PixelRenderer 中写死的角色坐标，确保角色始终位于右侧 1/3
      this._updateCharacterPosition();
      // === 压力可视化效果：根据当前压力值显示暗角/抖动/红色闪烁 ===
      if (this.state && typeof this.state.pressure !== 'undefined') {
        this.pixelRenderer.updatePressureEffect(this.state.pressure, 10);
      }
    }
  }

  /**
   * 天赋选择流程（5选2）
   */
  _showTalentSelection() {
    const talents = drawTalents(5, { guaranteeRare: true });

    // 里程碑奖励 + 逆天改命技能：额外天赋刷新次数
    const milestoneReroll = this.state._milestoneExtraReroll || 0;
    const talentReroll = this.state._talentReroll || 0;
    const rerollCount = milestoneReroll + talentReroll;
    const onReroll = rerollCount > 0 ? () => drawTalents(5, { guaranteeRare: true }) : null;

    this.talentSystem.show(talents, (selectedTalents) => {
      // 天赋选中音效
      try { this.audio.playTalentSelect(); } catch(e) {}

      // === 跨周目技能：稳扎稳打 — 失去天赋加成，仅记录选择 ===
      if (this.state._steadyWealth) {
        this.state.talent = selectedTalents.map(t => t.id).join(',');
        try { toast.info('▣ 稳扎稳打生效：牺牲天赋加成换取财富 +3', 3000); } catch(e) {}
      } else {
        // 应用天赋效果（支持多个天赋）
        this.state = applyTalentEffects(this.state, selectedTalents);
        this.state.talent = selectedTalents.map(t => t.id).join(',');
      }
      this.stats.update(this.state);

      // 开始游戏
      this.loadNode(this.state.currentNode);
    }, onReroll ? { onReroll, rerollCount } : {});
  }

  /**
   * 加载剧情节点
   */
  loadNode(nodeId) {
    const node = STORY[nodeId];
    if (!node) { this.showEnding(); return; }
    if (node.isEnding) { this.showEnding(); return; }

    this.state.currentNode = nodeId;

    // 更新当前阶段ID（供天赋 late_game_bonus 等使用）
    const stage = getStageByNodeId(nodeId);
    if (stage) {
      this.state.currentStageId = stage.id;
    }

    // 根据阶段切换氛围 BGM
    this._updateStageBGM(nodeId);

    // 检查是否进入新阶段 → 触发阶段结算
    if (stage && this._isStageEntry(nodeId, stage)) {
      this._showStageSettlement(stage, () => {
        this._renderNode(node);
      });
      return;
    }

    this._renderNode(node);
  }

  /**
   * 渲染节点
   * async：渲染前会异步等待场景背景 + 角色立绘纹理加载完成，避免出现 Graphics 兜底闪烁
   */
  async _renderNode(node) {
    // 标记节点为已读（用于快进功能）
    try { SaveSystem.markNodeSeen(this.state.currentNode); } catch(e) {}

    if (this.chapterNameEl) this.chapterNameEl.textContent = node.act || '';
    if (this.chapterSubEl) this.chapterSubEl.textContent = node.actSub || '';

    if (this.progressFillEl) {
      this.progressFillEl.style.width = Math.min((node.progress || 0), 100) + '%';
    }

    // === 跨周目技能：洞察人心 — 进入节点时显示 NPC 真实态度提示 ===
    if (this.state._showNpcAttitude) {
      try {
        const attitudeHint = this._inferNpcAttitude(node);
        if (attitudeHint) toast.info(attitudeHint, 3500);
      } catch(e) {}
    }

    // === 资源懒加载：先确保当前节点所需纹理就绪再渲染 ===
    // 并行加载场景背景 + 角色立绘，避免串行等待
    const poseMap = {
      'classroom': 'sitting', 'lecture': 'speaking', 'office': 'sitting',
      'stage': 'speaking', 'livestream': 'sitting', 'lab': 'standing',
      'podcast': 'sitting', 'street': 'standing', 'ending': 'standing',
      'fridge_smash': 'angry', 'talkshow': 'speaking', 'court': 'standing',
      // 场景变体沿用基础场景的姿态
      'office_empty': 'sitting', 'office_dark': 'sitting', 'street_night': 'standing',
      'office_busy': 'sitting', 'livestream_first': 'sitting',
      'street_day': 'standing', 'stage_arena': 'speaking'
    };
    const pose = poseMap[node.sceneType] || 'standing';
    const mood = this._inferMood(node);
    // 实际生效的姿态：mood 优先（如 young/middle/livestream），否则用场景对应 pose
    const effectivePose = mood || pose;

    await Promise.all([
      this._ensureSceneTexture(node.sceneType),
      this._ensureCharacterTexture(effectivePose)
    ]);

    // 资源就绪后开始渲染（PixelRenderer 仍会兜底处理意外缺失的纹理）
    this.pixelRenderer.drawBackground(node.sceneType);

    // 关键冲击场景：触发 1-2 帧白闪，增强转场冲击感（落实 memory 硬约束）
    if (FLASH_SCENES.has(node.sceneType)) {
      this.pixelRenderer.flashScreen(0.15);
    }

    // 杀手级时刻：进入标记节点时触发四维特效（复赛核心记忆点）
    if (KILLER_NODES.has(this.state.currentNode)) {
      this._triggerKillerMoment(this.state.currentNode);
    }

    const targetTexture = this._resolveMoodTexture(mood, pose);

    const renderer = this.pixelRenderer;
    const hasSprite = renderer.charSprite && renderer.charSprite.active;
    const currentTexture = hasSprite ? renderer.charSprite.texture.key : null;

    if (!hasSprite) {
      // 首次显示：直接用目标纹理创建角色
      renderer.drawCharacter(effectivePose);
      this._layoutCharacter(pose);
    } else if (currentTexture !== targetTexture) {
      // 纹理变化：淡入淡出切换
      this._transitionCharacterTexture(targetTexture, pose);
    } else {
      // 纹理未变：仅更新布局（呼吸动画等可能随 pose 改变）
      this._layoutCharacter(pose);
    }

    // === 后台预读相邻节点的场景资源，玩家点选项时已就绪 ===
    this._preloadAdjacentScenes(node);

    const charInfo = CHAR_INFO[this.state.currentNode] || ['罗远', ''];
    // 动态名字解析：早期阶段 → 小罗，后期阶段 → 老罗
    const displayName = charInfo[0] === '罗远' ? this._resolveCharacterName(this.state.currentNode) : charInfo[0];
    const resolvedText = node.text ? this._replaceCharacterNameInText(node.text, this.state.currentNode) : node.text;
    this.dialog.show(displayName, resolvedText, () => {
      if (node.choices && node.choices.length > 0) {
        // 选项中的"罗远"也做同样替换
        const resolvedChoices = node.choices.map(c => ({
          ...c,
          label: this._replaceCharacterNameInText(c.label || c, this.state.currentNode)
        }));

        // === 跨周目技能：八面玲珑 — 解锁特殊对话选项（关键节点多一个选择）===
        // 追加一个圆滑应对选项：小幅 trust/pressure 变化，跳转到首个非检定选项的 next 节点
        if (this.state._extraChoices) {
          const fallback = resolvedChoices.find(c => c.next && !c.check);
          resolvedChoices.push({
            label: '◈ 【八面玲珑】以圆滑方式应对，留有余地',
            next: fallback ? fallback.next : undefined,
            effects: { trust: 1, pressure: 1 }
          });
        }

        this.choices.show(resolvedChoices, (choice) => { this.makeChoice(choice); });
      }
    }, node.mood);
  }

  /**
   * 洞察人心：根据节点与当前状态推断 NPC 真实态度提示文本
   * @param {object} node - 当前剧情节点
   * @returns {string|null} 提示文本，无内容时返回 null
   */
  _inferNpcAttitude(node) {
    if (!node) return null;
    const state = this.state || {};
    const trust = state.trust ?? 5;
    const reputation = state.reputation ?? 5;
    const pressure = state.pressure ?? 0;
    // 根据信任/名声/压力组合推断 NPC 态度
    if (trust >= 8 && reputation >= 7) {
      return '◉ 洞察人心：周围的人对你颇为信赖，态度友善。';
    }
    if (trust <= 2) {
      return '◉ 洞察人心：公众信任低迷，你能感受到他人眼中的警惕。';
    }
    if (reputation <= 2) {
      return '◉ 洞察人心：名声不佳，旁人态度冷淡甚至轻蔑。';
    }
    if (pressure >= 8) {
      return '◉ 洞察人心：你压力极高，旁人察觉到你的紧绷，言语间多了几分试探。';
    }
    return '◉ 洞察人心：众人的态度不咸不淡，仍在观望。';
  }

  /**
   * 杀手级时刻：触发四维特效（复赛核心记忆点）
   * - 视觉：白闪 + 强震动 + 压力暗角全开
   * - 音效：BGM 骤停 + 心跳声加速 + 闷响
   * - 文案：AI 动态点评（根据玩家属性组合生成不同文案）
   * - 压力：临时拉满压力可视化
   */
  _triggerKillerMoment(nodeId) {
    // 防抖：同一节点短时间内不重复触发
    if (this._lastKillerNode === nodeId) return;
    this._lastKillerNode = nodeId;

    // === 视觉维度 ===
    // 1. 白闪（比普通 FLASH_SCENES 更强，0.25s）
    if (this.pixelRenderer) {
      this.pixelRenderer.flashScreen(0.25);
    }
    // 2. 强震动（8px, 400ms，比 shakeHard 略长）
    if (this.transition) {
      this.transition.shake(10, 400);
    }

    // === 6亿数字砸出（仅 act6_night · 评委记忆锚点）===
    // 白闪后 100ms，红色巨号数字从屏幕顶部砸下，落地保持 1.5s 后淡出
    if (nodeId === 'act6_night') {
      this.time.delayedCall(100, () => {
        const numEl = document.createElement('div');
        numEl.textContent = '¥600,000,000';
        numEl.style.cssText = [
          'position:fixed', 'top:-120px', 'left:50%',
          'transform:translateX(-50%)',
          'font-size:clamp(36px,7vw,72px)',
          'font-weight:900', 'letter-spacing:2px',
          'color:var(--color-danger)',
          'text-shadow:0 0 20px rgba(224,64,64,0.8),0 0 40px rgba(224,64,64,0.4)',
          'z-index:10000', 'pointer-events:none',
          'font-family:var(--font-pixel)',
          'transition:top 0.4s cubic-bezier(0.7,0,1,0.5)'
        ].join(';');
        document.body.appendChild(numEl);
        // 触发砸下动画
        requestAnimationFrame(() => { numEl.style.top = '38%'; });
        // 落地后 1.5s 淡出移除
        this.time.delayedCall(1900, () => {
          numEl.style.transition = 'opacity 0.3s';
          numEl.style.opacity = '0';
          this.time.delayedCall(300, () => {
            if (numEl.parentNode) numEl.parentNode.removeChild(numEl);
          });
        });
      });
    }
    // 3. 压力暗角全开（临时模拟压力爆表；基准值与主流程一致为 10）
    if (this.pixelRenderer) {
      this.pixelRenderer.updatePressureEffect(10, 10);
    }

    // === 音效维度 ===
    if (this.audio) {
      // 1. BGM 骤停
      this.audio.stopBGM();

      // 2. 心跳声：3 次低频脉冲，模拟紧张心跳加速
      //    复用 _playTone，低频 sawtooth 模拟心脏跳动
      const heartbeats = [0, 300, 600];
      heartbeats.forEach((delay, _i) => {
        this.time.delayedCall(delay, () => {
          if (!this.audio || !this.audio.enabled) return;
          // 心跳双拍：lub-dub
          this.audio._playTone(60, 0.12, 'sawtooth', 0.08);
          this.time.delayedCall(150, () => {
            if (this.audio && this.audio.enabled) {
              this.audio._playTone(50, 0.08, 'sawtooth', 0.06);
            }
          });
        });
      });

      // 3. 闷响：心跳结束后一声低频闷响，象征"6亿"砸下来
      this.time.delayedCall(1000, () => {
        if (!this.audio || !this.audio.enabled) return;
        this.audio._playTone(40, 0.6, 'sawtooth', 0.12);
      });
    }

    // === AI 动态点评维度（复赛创新性核心记忆点）===
    // 根据玩家当前属性组合，生成不同的"老罗语录"式点评
    // 让同一节点在不同周目呈现不同解读，提升复玩价值与"AI 洞察"感
    const commentary = this._generateKillerCommentary(nodeId, this.state);
    if (commentary) {
      // 闷响结束后 500ms 显示点评（与音效错开，避免信息过载）
      this.time.delayedCall(1500, () => {
        const echoEl = document.getElementById('life-echo');
        if (echoEl) {
          echoEl.textContent = commentary;
          echoEl.classList.add('show', 'killer');
          // 5 秒后淡出（比普通 echo 多 2 秒，强化仪式感）
          this.time.delayedCall(5000, () => {
            echoEl.classList.remove('show', 'killer');
          });
        }
        // 语音朗读（如启用）：延迟 300ms 等文字先出现
        this.time.delayedCall(300, () => {
          if (this.audio && this.audio.enabled) {
            try { this.audio.speak(commentary); } catch (e) {}
          }
        });
      });
    }

    // === 压力维度恢复：3 秒后恢复真实压力值 ===
    // 注意基准值为 10（与主流程一致），误用 100 会导致压力特效被错误关闭
    this.time.delayedCall(3000, () => {
      if (this.pixelRenderer && this.state) {
        const realPressure = this.state.pressure || 0;
        this.pixelRenderer.updatePressureEffect(realPressure, 10);
      }
    });
  }

  /**
   * 根据玩家属性组合生成杀手级时刻的 AI 动态点评文案。
   * 同一节点在不同周目/不同玩家手中呈现不同解读，
   * 这是复赛"创新性"维度的核心记忆点——评委看到的不是固定脚本，
   * 而是基于玩家行为的"AI 洞察"。
   *
   * 设计原则：
   * - 优先用玩家可感知的可见属性（pride/wealth/reputation/failures）
   * - pressure 作为辅助判断（隐藏属性但可展开查看）
   * - 每个分支文案呼应节点主题，但角度因属性而异
   *
   * @param {string} nodeId 杀手级节点 ID
   * @param {object} state 当前游戏状态
   * @returns {string} 点评文案（空字符串表示无点评）
   */
  _generateKillerCommentary(nodeId, state) {
    const pride = state.pride || 0;
    const wealth = state.wealth || 0;
    const pressure = state.pressure || 0;
    const failures = state.failures || 0;
    const reputation = state.reputation || 0;

    if (nodeId === 'act6_night') {
      // 6 亿欠款深夜：根据玩家此刻的"人格画像"给出不同注解
      // 优先级 1：理想未灭 + 压力爆表 → 倔强的殉道者
      if (pride >= 6 && pressure >= 7) {
        return '◉ AI 洞察：压力已到临界，理想却未熄灭——这种倔强，是创业者的毒药，也是解药。能扛过今晚的人，才配谈明天。';
      }
      // 优先级 2：理想崩塌 + 压力高 → 濒临放弃的悬崖
      if (pride <= 3 && pressure >= 6) {
        return '◉ AI 洞察：理想已熄，压力满载——你离崩溃只差这一个深夜。此刻的每一个选择，都会被余生反复回放。';
      }
      // 优先级 3：财富见底 → 现实的窒息感
      if (wealth <= 1) {
        return '◉ AI 洞察：账上所剩无几，6 亿是远景，明天的房租才是近景。最压垮人的从来不是大数字，是小数字。';
      }
      // 优先级 4：连环翻车 → 伤痕即勋章
      if (failures >= 3) {
        return '◉ AI 洞察：失败次数已无法计算——但每一次翻车，都在为下一次起飞交学费。只是这次的学费，是 6 亿。';
      }
      // 优先级 5：名声尚在 → 最后的筹码
      if (reputation >= 7) {
        return '◉ AI 洞察：6 亿债务之外，你还有名声——这是此刻唯一能换成现金的东西。保住它，就保住了翻盘的入场券。';
      }
      // 优先级 6：众叛亲离 → 最深的孤独
      if (reputation <= 3) {
        return '◉ AI 洞察：众叛亲离的深夜，连催债电话都成了唯一还有人记得你的证据。孤独比债务更重。';
      }
      // 兜底：普世注解
      return '◉ AI 洞察：凌晨三点的办公室，6 亿债务压在胸口——这一夜，注定无眠。而明天，还得继续。';
    }

    if (nodeId === 'act6_crash') {
      // 资金链断裂·债务从2亿到6亿
      if (wealth <= 2) {
        return '◉ AI 洞察：断裂前你早已身无分文——压垮你的不是最后一根稻草，是你把每一根稻草都烧给了理想。';
      }
      if (pride >= 7) {
        return '◉ AI 洞察：TNT 是你赌上一切的"下一张"。骄傲让你敢在鸟巢开火，也让你看不见弹药已空。';
      }
      if (reputation >= 6) {
        return '◉ AI 洞察：供应商还愿意坐下来听你说话，是因为你过去从没赖过账。信用，是你此刻唯一的现金流。';
      }
      if (failures >= 3) {
        return '◉ AI 洞察：这不是你第一次坠落，却是最深的一次。过去每一次爬起，都是为这一次准备的。';
      }
      return '◉ AI 洞察：从估值 26 亿到账上 20 万，只用了一年。崩塌从不提前打招呼。';
    }

    if (nodeId === 'act_fridge_smash') {
      // 砸冰箱维权
      if (pride >= 6) {
        return '◉ AI 洞察：这一锤砸下去，有人看到冲动，有人看到态度。你砸的不是冰箱，是"消费者只能忍"的潜规则。';
      }
      if (reputation >= 6) {
        return '◉ AI 洞察：名人维权的代价是放大镜——这一锤会被记住十年，用得好是勋章，用不好是枷锁。';
      }
      if (pressure >= 6) {
        return '◉ AI 洞察：压力之下的爆发最痛快也最危险。这一锤之后，你得用十倍的冷静来收场。';
      }
      return '◉ AI 洞察：锤子落下的一刻，维权和表演就再也分不开了。';
    }

    if (nodeId === 'act7_first_live') {
      // 首播前夜·放下身段
      if (pride >= 6) {
        return '◉ AI 洞察：一个曾经的 CEO 对着手机镜头练话术——放下面子赚钱，是你骄傲过的证据，也是你成熟了的证据。';
      }
      if (pressure >= 6) {
        return '◉ AI 洞察：6 亿在身后，镜头在眼前。这场直播没有彩排，因为生活从不给你 NG 的机会。';
      }
      if (failures >= 3) {
        return '◉ AI 洞察：翻车这么多次，终于有一次观众是等着看你翻的——这本身，就成了流量。';
      }
      return '◉ AI 洞察：三天三夜选品，是怕对不起"罗老师"三个字，还是怕对不起自己？';
    }

    if (nodeId === 'act6_a') {
      // TNT鸟巢演示演砸
      if (pride >= 7) {
        return '◉ AI 洞察：你坚持把未完成的梦想搬上鸟巢——理想主义最贵的地方，就是它从不开发票。';
      }
      if (reputation <= 3) {
        return '◉ AI 洞察：嘘声响起时，体面和尊严只能选一个带走。你留在台上继续演示——这就是你。';
      }
      if (failures >= 3) {
        return '◉ AI 洞察："理解万岁"救不了场，但它会成为你日后最贵的段子。有些失败，要很多年后才能兑换成掌声。';
      }
      return '◉ AI 洞察：八万人看着你演示一个还没准备好的未来。这一晚之后，"下一张"成了最昂贵的口头禅。';
    }

    return '';
  }

  /**
   * 将角色 Sprite 定位到画面右侧 1/3 区域，确保完整脸部可见。
   * 由于 PixelRenderer.drawCharacter 内部写死了居中位置与缩放，
   * 这里在绘制完成后覆盖其显示参数（位置、缩放、原点）。
   */
  _layoutCharacter(pose) {
    const renderer = this.pixelRenderer;
    if (!renderer) return;
    const sprite = renderer.charSprite;
    if (!sprite || !sprite.active) return;

    this._stopCharacterTweens(renderer);
    this._applyCharacterLayout(sprite, pose);
    this._startCharacterTalkTween(sprite, pose);
  }

  /**
   * 停止角色相关的呼吸/说话 tween，避免切换时被旧 tween 覆盖缩放。
   */
  _stopCharacterTweens(renderer) {
    if (renderer._talkTween) {
      renderer._talkTween.stop();
      renderer._talkTween = null;
    }
    if (this._charTalkTween) {
      this._charTalkTween.stop();
      this._charTalkTween = null;
    }
  }

  /**
   * 根据目标纹理与姿态计算并应用角色缩放、位置与视觉特效。
   * 新立绘已为半身像，显示在右下角 1/4 区域，并附加金色轮廓光与底部投影。
   */
  _applyCharacterLayout(sprite, _pose) {
    const texture = sprite.texture;
    const src = texture.getSourceImage();
    const srcW = src.width || 1;
    const srcH = src.height || 1;

    // 缩小角色尺寸：从84%降到62%高度，让角色融入场景而不是遮挡场景
    const maxDisplayW = GAME_WIDTH / 3.2;
    const maxDisplayH = GAME_HEIGHT * 0.62;

    const baseScale = Math.min(maxDisplayW / srcW, maxDisplayH / srcH);
    this._charBaseScale = baseScale;

    sprite.setOrigin(0.5, 1);
    sprite.setScale(baseScale);
    sprite.setCrop();
    sprite.setDepth(50);

    // 清除固定tint，让场景光照系统接管
    sprite.clearTint();

    // 右下角，留出更多边距避免贴边
    const rightMargin = 24;
    this._charBaseX = GAME_WIDTH - rightMargin - (srcW * baseScale) / 2;
    this._charBaseY = GAME_HEIGHT - 12;
    sprite.setPosition(this._charBaseX, this._charBaseY);

    // 获取当前场景光照配置
    const bgType = this.pixelRenderer ? this.pixelRenderer.currentBg : 'classroom';
    this._charLighting = GameScene._getSceneLighting(bgType);

    // 应用环境色调
    this._applySceneTint(sprite);
    // 更新光效
    this._updateCharacterBackdrop(sprite);
    this._updateCharacterGlow(sprite);
    this._updateCharacterShadow(sprite);
    this._updateWarmOverlay(sprite);
  }

  _applySceneTint(sprite) {
    const light = this._charLighting;
    if (!light) return;
    // 使用 Phaser tint 叠加环境色：从左上角到右下角的渐变tint
    // 上半部分偏环境光色，下半部分稍暗（模拟接地区域）
    const tint = light.tint;
    const r = (tint >> 16) & 0xff;
    const g = (tint >> 8) & 0xff;
    const b = tint & 0xff;
    // 对角色整体轻微叠加环境色（不是纯tint替换，而是与原色混合）
    // Phaser的setTint是乘法混合，我们计算保持原色但偏暖/偏冷的值
    const tintStrength = light.tintAlpha;
    const tr = Math.round(255 - (255 - r) * tintStrength);
    const tg = Math.round(255 - (255 - g) * tintStrength);
    const tb = Math.round(255 - (255 - b) * tintStrength);
    const tintColor = (tr << 16) | (tg << 8) | tb;
    sprite.setTint(tintColor);
  }

  /**
   * 角色前方暖色光叠加（模拟舞台灯/阳光照射在角色正面）。
   * 使用一个半透明椭圆覆盖在角色前侧（depth 51，在角色之上）。
   */
  _updateWarmOverlay(sprite) {
    const light = this._charLighting;
    if (!light || !light.warmOverlay || light.warmOverlay <= 0) {
      if (this._charWarmOverlay && this._charWarmOverlay.active) {
        this._charWarmOverlay.clear();
      }
      return;
    }
    if (!this._charWarmOverlay || !this._charWarmOverlay.active) {
      this._charWarmOverlay = this.add.graphics();
      this._charWarmOverlay.setDepth(51);
      this._charWarmOverlay.setBlendMode(Phaser.BlendModes.SCREEN);
    }
    const g = this._charWarmOverlay;
    g.clear();

    const w = sprite.displayWidth * 1.0;
    const h = sprite.displayHeight * 0.8;
    const cx = this._charBaseX;
    const cy = this._charBaseY - h * 0.4;

    // 多层暖光椭圆模拟聚光灯照射，从上往下衰减
    const steps = 4;
    for (let i = 0; i < steps; i++) {
      const t = i / steps;
      const alpha = light.warmOverlay * (1 - t) * 0.5;
      g.fillStyle(0xffddaa, alpha);
      const rw = w * (0.35 + 0.65 * t);
      const rh = h * (0.3 + 0.7 * t);
      g.fillEllipse(cx, cy - h * 0.1 * (1 - t), rw, rh);
    }
  }

  /**
   * 为说话/直播姿势添加轻微的呼吸动画。
   * 使用存储的 baseScale，避免旧 tween 残留导致缩放异常。
   */
  _startCharacterTalkTween(_sprite, _pose) {
    if (this._charTalkTween) {
      this._charTalkTween.stop();
      this._charTalkTween = null;
    }
  }

  /**
   * 角色后方环境光：去掉黑色背板，改为与场景光源匹配的柔和光晕。
   * 暖光场景（教室/舞台/演讲）→ 暖黄微光；冷光场景（办公室/实验室）→ 冷蓝微光。
   */
  _updateCharacterBackdrop(sprite) {
    if (!this._charBackdrop || !this._charBackdrop.active) {
      this._charBackdrop = this.add.graphics();
      this._charBackdrop.setDepth(47);
    }
    const g = this._charBackdrop;
    g.clear();

    const light = this._charLighting;
    if (!light) return;

    const w = sprite.displayWidth * 0.9;
    const h = sprite.displayHeight * 0.7;
    const cx = this._charBaseX;
    const cy = this._charBaseY - h * 0.4;

    // 极淡的环境光晕（不再用黑色压暗，而是用光源色淡淡提亮）
    const steps = 3;
    for (let i = 0; i < steps; i++) {
      const t = i / steps;
      const alpha = 0.04 * (1 - t);
      g.fillStyle(light.tint, alpha);
      const rw = w * (0.5 + 0.5 * t);
      const rh = h * (0.5 + 0.5 * t);
      g.fillEllipse(cx, cy, rw, rh);
    }
  }

  /**
   * 边缘轮廓光：颜色和强度随场景光照变化。
   * 舞台/演讲场景用强金色，办公室用冷蓝，夜间用冷色。
   */
  _updateCharacterGlow(sprite) {
    if (!this._charGlow || !this._charGlow.active) {
      this._charGlow = this.add.image(0, 0, sprite.texture.key);
      this._charGlow.setOrigin(0.5, 1);
      this._charGlow.setBlendMode(Phaser.BlendModes.SCREEN);
      this._charGlow.setDepth(49);
    } else {
      this._charGlow.setTexture(sprite.texture.key);
    }
    // 光晕与角色立绘共用纹理，保持线性过滤避免锯齿
    this._charGlow.texture.setFilter(Phaser.Textures.FilterMode.LINEAR);

    const light = this._charLighting;
    if (light) {
      this._charGlow.setTint(light.rimColor);
      this._charGlow.setAlpha(light.rimAlpha);
    } else {
      this._charGlow.setTint(0xf0c040);
      this._charGlow.setAlpha(0.08);
    }

    const glowScale = this._charBaseScale || sprite.scaleX;
    this._charGlow.setScale(glowScale * 1.01);
    this._charGlow.setPosition(this._charBaseX, this._charBaseY);
  }

  /**
   * 接地阴影：更大、更柔和、颜色匹配场景地面色调，让角色"站"在场景中。
   */
  _updateCharacterShadow(sprite) {
    const light = this._charLighting;
    const shadowColor = light ? light.shadowColor : 0x000000;
    const shadowAlpha = light ? light.shadowAlpha : 0.25;
    const shadowScale = light ? light.shadowScale : 0.85;

    if (!this._charShadow || !this._charShadow.active) {
      this._charShadow = this.add.ellipse(0, 0, 100, 14, shadowColor, shadowAlpha);
      this._charShadow.setDepth(48);
    }

    this._charShadow.setFillStyle(shadowColor, shadowAlpha);

    // 更宽更扁的接触阴影，模拟地面接触
    const shadowW = sprite.displayWidth * 0.7 * shadowScale;
    const shadowH = Math.max(6, shadowW * 0.10);
    this._charShadow.setSize(shadowW, shadowH);
    this._charShadow.setPosition(this._charBaseX, this._charBaseY - 3);

    // 添加第二层更淡的扩散阴影
    if (!this._charShadow2 || !this._charShadow2.active) {
      this._charShadow2 = this.add.ellipse(0, 0, shadowW * 1.5, shadowH * 2, shadowColor, shadowAlpha * 0.3);
      this._charShadow2.setDepth(47);
    }
    this._charShadow2.setFillStyle(shadowColor, shadowAlpha * 0.25);
    this._charShadow2.setSize(shadowW * 1.5, shadowH * 2.5);
    this._charShadow2.setPosition(this._charBaseX, this._charBaseY - 2);
  }

  /**
   * 在两_textureKey_间做淡入淡出切换，用于情绪/姿态变化时的立绘过渡。
   */
  _transitionCharacterTexture(targetKey, pose) {
    const renderer = this.pixelRenderer;
    const oldSprite = renderer.charSprite;
    if (!oldSprite || !oldSprite.active) return;

    this._stopCharacterTweens(renderer);

    renderer._createBlackBackgroundMask(targetKey);
    const processedKey = renderer._charProcessedKey || targetKey;
    const newSprite = this.add.image(0, 0, processedKey);
    newSprite.setDepth(oldSprite.depth);
    newSprite.setOrigin(0.5, 1);
    newSprite.setAlpha(0);
    // AI 立绘纹理使用线性过滤，避免缩放锯齿
    newSprite.texture.setFilter(Phaser.Textures.FilterMode.LINEAR);

    this._applyCharacterLayout(newSprite, pose);
    this._startCharacterTalkTween(newSprite, pose);

    // 旧 sprite 使用新 sprite 的最终位置，确保过渡时对齐
    oldSprite.setPosition(this._charBaseX, this._charBaseY);

    renderer.charSprite = newSprite;

    // 保存旧 sprite 引用，供每帧位置同步，避免过渡期间错位
    this._charOldSprite = oldSprite;

    this.tweens.add({
      targets: oldSprite,
      alpha: 0,
      duration: 200,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        if (this._charOldSprite === oldSprite) this._charOldSprite = null;
        if (oldSprite && oldSprite.active) oldSprite.destroy();
      }
    });

    this.tweens.add({
      targets: newSprite,
      alpha: 1,
      duration: 200,
      ease: 'Sine.easeInOut'
    });
  }

  /**
   * 每帧修正角色位置，覆盖 PixelRenderer.render 在屏幕震动时使用的硬编码坐标。
   * 同时同步轮廓光与投影位置。
   */
  _updateCharacterPosition() {
    const renderer = this.pixelRenderer;
    const sprite = renderer && renderer.charSprite;
    if (!sprite || !sprite.active || this._charBaseX == null) return;

    let dx = 0;
    let dy = 0;
    if (renderer.shakeIntensity > 0) {
      dx = (Math.random() - 0.5) * renderer.shakeIntensity;
      dy = (Math.random() - 0.5) * renderer.shakeIntensity;
    }
    // === 角色凝视偏移：跟随鼠标轻微移动 ===
    const gazeX = renderer._gazeOffsetX || 0;
    const gazeY = renderer._gazeOffsetY || 0;
    const x = this._charBaseX + dx + gazeX;
    const y = this._charBaseY + dy + gazeY;
    sprite.setPosition(x, y);

    // 同步过渡中的旧 sprite 位置，避免双影错位
    if (this._charOldSprite && this._charOldSprite.active) {
      this._charOldSprite.setPosition(x, y);
    }

    if (this._charBackdrop && this._charBackdrop.active) {
      this._updateCharacterBackdrop(sprite);
    }
    if (this._charGlow && this._charGlow.active) {
      this._charGlow.setPosition(x, y);
    }
    if (this._charShadow && this._charShadow.active) {
      this._charShadow.setPosition(x, y - 2);
    }
  }

  /**
   * 判断是否是阶段入口节点
   */
  _isStageEntry(nodeId, stage) {
    return stage.nodes[0] === nodeId && !this.state.triggeredEvents.has(`stage_entry_${stage.id}`);
  }

  /**
   * 尝试启动当前阶段对应的 BGM（仅在音频已解锁时真正播放）
   */
  _tryStartStageBGM() {
    if (!this.audio || this._bgmStarted) return;
    if (!this.audio.isUnlocked()) {
      // 若还没解锁，尝试解锁（用户已经有过交互）
      this.audio.unlock();
    }
    const stage = getStageByNodeId(this.state.currentNode);
    if (!stage) return;
    const bgmType = this.audio.getBGMTypeForStage(stage.id);
    this._currentBGMType = bgmType;
    this._bgmStarted = true;
    this.audio.crossfadeBGM(bgmType, 800);
  }

  /**
   * 节点切换时，若进入新阶段则淡入淡出切换氛围音乐
   */
  _updateStageBGM(nodeId) {
    if (!this.audio || !this._bgmStarted) return;
    if (!this.audio.isUnlocked()) this.audio.unlock();
    const stage = getStageByNodeId(nodeId);
    if (!stage) return;
    const bgmType = this.audio.getBGMTypeForStage(stage.id);
    if (bgmType && bgmType !== this._currentBGMType) {
      this._currentBGMType = bgmType;
      this.audio.crossfadeBGM(bgmType, 800);
    }
  }

  /**
   * 根据节点所在阶段返回角色名字：youth/teacher/startup → 小罗，dark/repay/reborn → 老罗
   */
  _resolveCharacterName(nodeId) {
    const stage = getStageByNodeId(nodeId);
    if (!stage) return '罗远';
    const earlyStages = new Set(['youth', 'teacher', 'startup']);
    return earlyStages.has(stage.id) ? '小罗' : '老罗';
  }

  /**
   * 在文本中替换"罗远"为对应阶段的角色名
   */
  _replaceCharacterNameInText(text, nodeId) {
    if (!text || typeof text !== 'string') return text;
    const resolved = this._resolveCharacterName(nodeId);
    return text.replace(/罗远/g, resolved);
  }

  /**
   * 根据节点 mood 字段、当前状态属性和阶段推断角色情绪姿态。
   * 返回值为 CHAR_TEXTURES 中定义的 key（如 'happy'/'depressed'），
   * 若无需覆盖则返回 null，保持原有姿态纹理。
   */
  _inferMood(node) {
    if (!node) return null;

    // 1. 节点显式指定 mood 时优先级最高，强制指定表情
    if (node.mood) return node.mood;

    // 2. 直播/卖货场景固定使用直播立绘
    if (node.sceneType === 'livestream') return 'livestream';

    // 3. 根据阶段推断年龄立绘：早期用 young，中后期用 middle
    const stage = getStageByNodeId(this.state.currentNode);
    if (stage) {
      // startup(锤子科技 2012-2018) 主角已 40+ 岁，应归中年组，原归入 earlyStages 会导致该阶段全程显示少年立绘
      const earlyStages = new Set(['youth', 'teacher']);
      const middleStages = new Set(['startup', 'dark', 'repay', 'reborn']);
      if (earlyStages.has(stage.id)) {
        // 年轻阶段：如果没有显式 mood 覆盖情绪，用 young 立绘
        if (!node.mood && node.sceneType !== 'livestream') return 'young';
      } else if (middleStages.has(stage.id)) {
        // 中年阶段：如果没有显式 mood 覆盖情绪，用 middle 立绘
        if (!node.mood && node.sceneType !== 'livestream') return 'middle';
      }
    }

    // 4. 状态属性推断：翻车/压力高 → 沮丧；理想主义高 → 自信/开心
    const pride = this.state.pride || 0;
    const pressure = this.state.pressure || 0;
    const failures = this.state.failures || 0;

    if (pressure >= 7 || failures >= 7) return 'depressed';
    if (failures >= 5 && pride >= 6) return 'angry';
    if (pride >= 8) return 'happy';
    if (pride >= 6) return 'speaking';

    // 5. 文本关键词兜底推断
    const text = (node.text || '').toLowerCase();
    if (this._textContainsAny(text, ['翻车', '崩溃', '绝望', '失败', '对不起', '压力'])) return 'depressed';
    if (this._textContainsAny(text, ['愤怒', '混蛋', '骗子', '怼', '砸'])) return 'angry';
    if (this._textContainsAny(text, ['理想', '情怀', '工匠精神', '改变世界', '骄傲', '自豪', '牛逼'])) return 'speaking';

    return null;
  }

  /**
   * 辅助：判断文本是否包含任一关键词（大小写不敏感）。
   */
  _textContainsAny(text, keywords) {
    return keywords.some(k => text.includes(k.toLowerCase()));
  }

  /**
   * 将 mood 或 pose 解析为实际纹理 key。
   * 优先使用 mood 映射；若无效则回退到 pose 映射；最终兜底 char-standing。
   */
  _resolveMoodTexture(mood, pose) {
    if (mood) {
      const moodKey = GameScene.CHAR_TEXTURES[mood];
      if (moodKey) return moodKey;
    }
    return GameScene.CHAR_TEXTURES[pose] || 'char-standing';
  }

  /**
   * 显示阶段结算（DOM overlay 实现）
   */
  _showStageSettlement(stage, onComplete) {
    this.state.triggeredEvents.add(`stage_entry_${stage.id}`);
    try { this.debug.logStageSettlement(stage.id, this.state); } catch(e) {}

    // 阶段进度成就触发
    const stageAchievements = {
      youth:   ALL_ACHIEVEMENTS.first_steps,
      teacher: ALL_ACHIEVEMENTS.stage_2,
      blog:    ALL_ACHIEVEMENTS.stage_3,
      hammer:  ALL_ACHIEVEMENTS.stage_4,
      crisis:  ALL_ACHIEVEMENTS.stage_5,
      repay:   ALL_ACHIEVEMENTS.stage_6
    };
    const stageAch = stageAchievements[stage.id];
    if (stageAch && !this.state.achievements.includes(stageAch.name)) {
      this._unlockAchievement(stageAch);
    }

    // 阶段结算音效
    try { this.audio.playStageSettlement(); } catch(e) {}

    // 检查阶段结算条件
    const results = [];
    if (stage.settlement && stage.settlement.checks) {
      for (const check of stage.settlement.checks) {
        const val = this.state[check.attr] || 0;
        if (val >= check.min && val <= check.max) {
          results.push(check);
        }
      }
    }

    // 收集结算效果（先计算不应用，用于属性变化动画展示）
    const pendingChanges = [];
    for (const check of results) {
      if (check.effects) {
        const { changes } = applyEffects(this.state, check.effects);
        for (const c of changes) {
          // 同一属性累加
          const existing = pendingChanges.find(p => p.attr === c.attr);
          if (existing) {
            existing.delta += c.delta;
            existing.newValue = existing.oldValue + existing.delta;
          } else {
            pendingChanges.push({ ...c });
          }
        }
      }
    }

    // 过滤掉隐藏属性（pressure/trust 在结算中不单独展示变化条）
    const visibleChanges = pendingChanges.filter(c => {
      const attrDef = ATTRIBUTES[c.attr];
      return attrDef && !attrDef.hidden;
    });

    // 收集结算结果文本
    const resultTexts = results.map(r => r.result);

    // 检查是否有成就解锁（结算效果中的 achievement，支持数组）
    const settlementAchievements = [];
    for (const check of results) {
      if (check.effects && check.effects.achievement) {
        const achNames = Array.isArray(check.effects.achievement) ? check.effects.achievement : [check.effects.achievement];
        const achIcons = Array.isArray(check.effects.icon) ? check.effects.icon : [check.effects.icon || '★'];
        achNames.forEach((name, idx) => {
          if (!this.state.achievements.includes(name)) {
            settlementAchievements.push({
              name,
              icon: achIcons[idx] || achIcons[0] || '★'
            });
          }
        });
      }
    }

    // 构建阶段序号
    const stageIndex = STAGES.findIndex(s => s.id === stage.id);
    const stageNum = stageIndex >= 0 ? stageIndex + 1 : '';

    // 构建 DOM overlay
    const overlay = document.createElement('div');
    overlay.className = 'ui-settlement-overlay';
    overlay.innerHTML = `
      <div class="ui-settlement-card">
        <div class="ui-settlement-header">
          <div class="ui-settlement-label">阶段结算</div>
          <div class="ui-settlement-stage-name">${stageNum ? `<span class="ui-settlement-stage-num">${stageNum}</span>` : ''}${stage.name}</div>
          <div class="ui-settlement-period">${stage.period}</div>
        </div>
        <div class="ui-settlement-body">
          <div class="ui-settlement-text">${stage.settlement ? stage.settlement.text : stage.name}</div>
          ${resultTexts.length > 0 ? `<div class="ui-settlement-results">${resultTexts.map(r => `<div class="ui-settlement-result-item">▸ ${r}</div>`).join('')}</div>` : ''}
          <div class="ui-settlement-attrs" id="ui-settlement-attrs"></div>
          <div class="ui-settlement-achievements" id="ui-settlement-achievements"></div>
        </div>
        <div class="ui-settlement-footer">
          <div class="ui-settlement-countdown" id="ui-settlement-countdown"></div>
          <button class="ui-settlement-continue" id="ui-settlement-continue">继续</button>
        </div>
      </div>
    `;

    document.getElementById('ui-overlay').appendChild(overlay);

    // 触发动画
    requestAnimationFrame(() => {
      overlay.classList.add('visible');
    });

    // 渲染属性变化动画条
    const attrsContainer = overlay.querySelector('#ui-settlement-attrs');
    if (visibleChanges.length > 0) {
      visibleChanges.forEach((change, changeIdx) => {
        const attrDef = ATTRIBUTES[change.attr];
        if (!attrDef) return;

        // failures 用 10 作为显示上限（与 StatsSystem 一致），其余用 attrDef.max
        const maxVal = change.attr === 'failures' ? 10 : (attrDef.max || 10);
        const oldPct = Math.min(100, Math.max(0, (change.oldValue / maxVal) * 100));
        const newPct = Math.min(100, Math.max(0, (change.newValue / maxVal) * 100));
        const isPositive = change.delta > 0;
        const deltaText = change.delta > 0 ? `+${change.delta}` : `${change.delta}`;
        const deltaColor = isPositive ? '#40C040' : '#E04040';

        const attrEl = document.createElement('div');
        attrEl.className = 'ui-settlement-attr';
        attrEl.style.animationDelay = `${0.4 + changeIdx * 0.15}s`;
        attrEl.innerHTML = `
          <div class="ui-settlement-attr-icon">${attrDef.icon}</div>
          <div class="ui-settlement-attr-label">${attrDef.name}</div>
          <div class="ui-settlement-attr-bar-bg">
            <div class="ui-settlement-attr-bar-old" style="width: ${oldPct}%"></div>
            <div class="ui-settlement-attr-bar-new" style="width: ${oldPct}%; background: ${isPositive ? '#40C040' : '#E04040'}"></div>
          </div>
          <div class="ui-settlement-attr-delta" style="color: ${deltaColor}">${deltaText}</div>
          <div class="ui-settlement-attr-values">${change.oldValue} → ${change.newValue}</div>
        `;
        attrsContainer.appendChild(attrEl);

        // 延迟播放属性条动画
        this._trackedTimeout(() => {
          const newBar = attrEl.querySelector('.ui-settlement-attr-bar-new');
          if (newBar) newBar.style.width = `${newPct}%`;
        }, 600 + changeIdx * 200);
      });
    }

    // 渲染成就解锁金色弹窗（在属性动画之后依次展示）
    const achievementsContainer = overlay.querySelector('#ui-settlement-achievements');
    if (settlementAchievements.length > 0) {
      const baseDelay = 800 + visibleChanges.length * 200;
      settlementAchievements.forEach((ach, idx) => {
        const achDef = findAchievementDef(ach.name);
        const achDesc = achDef && achDef.desc ? achDef.desc : '';
        const achEl = document.createElement('div');
        achEl.className = 'ui-settlement-achievement';
        achEl.innerHTML = `
          <div class="ui-settlement-achievement-glow"></div>
          <div class="ui-settlement-achievement-icon">${ach.icon}</div>
          <div class="ui-settlement-achievement-info">
            <div class="ui-settlement-achievement-label">成就解锁</div>
            <div class="ui-settlement-achievement-name">${ach.name}</div>
            ${achDesc ? `<div class="ui-settlement-achievement-desc">${achDesc}</div>` : ''}
          </div>
        `;
        achievementsContainer.appendChild(achEl);

        // 延迟逐个展示成就弹窗
        this._trackedTimeout(() => {
          achEl.classList.add('visible');
          // 成就解锁音效
          try {
            const hidden = isHiddenAchievement(ach.name);
            if (hidden) {
              this.audio.playAchievementLegendary();
            } else {
              this.audio.playAchievement();
            }
          } catch(e) {}
        }, baseDelay + idx * 800);
      });
    }

    // 倒计时自动关闭（5秒，有成就时延长到8秒）
    const autoCloseTime = settlementAchievements.length > 0 ? 8 : 5;
    let countdown = autoCloseTime;
    const countdownEl = overlay.querySelector('#ui-settlement-countdown');
    const updateCountdown = () => {
      if (countdownEl) countdownEl.textContent = `${countdown}s 后自动继续`;
    };
    updateCountdown();

    const countdownTimer = setInterval(() => {
      countdown--;
      if (countdown <= 0) {
        clearInterval(countdownTimer);
        this._settlementTimer = null;
        _closeSettlement();
        return;
      }
      updateCountdown();
    }, 1000);
    // 提升为实例属性，便于 _onShutdown 清理（避免场景切换时 setInterval 泄漏）
    this._settlementTimer = countdownTimer;

    // 关闭结算画面
    let settled = false;
    const _closeSettlement = () => {
      if (settled) return;
      settled = true;
      clearInterval(countdownTimer);
      this._settlementTimer = null;

      // 应用结算效果
      for (const check of results) {
        if (check.effects) {
          const { state: newState } = applyEffects(this.state, check.effects);
          this.state = newState;
        }
      }

      // 天赋 pressure_recovery: 每个阶段结束自动降低 2 点压力
      const specials = this.state.talentSpecials || [];
      if (specials.includes('pressure_recovery')) {
        const oldPressure = this.state.pressure || 0;
        const newPressure = Math.max(0, oldPressure - 2);
        if (newPressure !== oldPressure) {
          this.state.pressure = newPressure;
        }
      }

      this.stats.update(this.state);

      // 记录成就到状态和 localStorage
      for (const ach of settlementAchievements) {
        if (!this.state.achievements.includes(ach.name)) {
          this.state.achievements.push(ach.name);
          const hidden = isHiddenAchievement(ach.name);
          addAchievementToStorage(ach.name, ach.icon, hidden);
        }
      }

      // 关闭动画
      overlay.classList.remove('visible');
      overlay.classList.add('closing');

      this._trackedTimeout(() => {
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);

        // 检查远期标记后果
        const consequences = checkFlagConsequences(stage.id, this.state.flags);
        if (consequences.length > 0) {
          this._showConsequences(consequences, 0, onComplete);
        } else {
          onComplete();
        }
      }, 400);
    };

    // 继续按钮
    const continueBtn = overlay.querySelector('#ui-settlement-continue');
    if (continueBtn) {
      continueBtn.addEventListener('click', _closeSettlement);
    }

    // 点击遮罩也可关闭
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) _closeSettlement();
    });
  }

  /**
   * 依次显示远期后果
   */
  _showConsequences(consequences, index, onComplete) {
    if (index >= consequences.length) {
      onComplete();
      return;
    }

    const c = consequences[index];
    // 远期后果音效
    try { this.audio.playConsequence(); } catch(e) {}
    this.dialog.show('往事回响', this._replaceCharacterNameInText(c.text, this.state.currentNode), () => {
      if (c.effects) {
        const { state: newState } = applyEffects(this.state, c.effects);
        this.state = newState;
        this.stats.update(this.state);
      }
      this._showConsequences(consequences, index + 1, onComplete);
    });
  }

  /**
   * 属性变化时高亮属性面板对应条目
   */
  _flashStatBar(attr, delta) {
    try {
      const bar = document.querySelector(`.ui-stat-item[data-stat="${attr}"]`);
      if (!bar) return;
      bar.classList.remove('stat-flash-up', 'stat-flash-down');
      void bar.offsetWidth;
      bar.classList.add(delta > 0 ? 'stat-flash-up' : 'stat-flash-down');
      this._trackedTimeout(() => bar.classList.remove('stat-flash-up', 'stat-flash-down'), 600);
    } catch(e) {}
  }

  /**
   * 任务3：人生回响系统——关键选择后显示模糊的未来暗示文字
   */
  _showLifeEcho(choice) {
    // 只对含 flag 或 achievement 的关键选择触发
    if (!choice.flag && !(choice.effects && choice.effects.achievement)) return;

    // 根据选择的 effects 生成回响文字
    const echoes = {
      idealist: ['这个选择会在多年后回响...', '理想主义的种子已经埋下...', '你选择了最难走的路...'],
      pragmatic: ['现实比你想的更残酷...', '这个妥协会改变你...', '你学会了弯腰...'],
      risky: ['命运的天平已经倾斜...', '这一步可能改变一切...', '风开始吹了...']
    };

    // 判断选择方向
    const effects = choice.effects || {};
    let type = 'idealist';
    if (effects.wealth > 0 && effects.pride < 0) type = 'pragmatic';
    if (effects.failures > 0 || effects.pressure > 2) type = 'risky';

    const echoText = echoes[type][Math.floor(Math.random() * echoes[type].length)];

    // 显示回响文字
    const echoEl = document.getElementById('life-echo');
    if (echoEl) {
      echoEl.textContent = echoText;
      echoEl.classList.add('show');
      this._trackedTimeout(() => echoEl.classList.remove('show'), 3000);
    }
  }

  /**
   * 做出选择
   */
  makeChoice(choice) {
    try { this.audio.playChoice(); } catch(e) {}
    this.choices.hide();
    this.dialog.hide();
    this._showLifeEcho(choice);  // 任务3：人生回响

    // 使用效果引擎应用属性变化
    const effects = choice.effects || {};
    const stateBefore = this.state;
    const { state: newState, changes } = applyEffects(this.state, effects);
    this.state = newState;
    try { this.debug.logChoice(this.state.currentNode, choice.label, effects, stateBefore, this.state); } catch(e) {}

    // === 跨周目技能：浴火重生 — 翻车后下个选择效果 +50% ===
    // 本次选择若消费了 comeback 加成，清除激活标记（仅对下一个选择生效）
    if (this.state._comebackBoostConsumed) {
      delete this.state._comebackBoostConsumed;
      delete this.state._comebackBoostActive;
    }
    // 本次选择若增加了 failures，激活下个选择的 comeback 加成
    if (this.state._comebackBoost && changes && changes.some(c => c.attr === 'failures' && c.delta > 0)) {
      this.state._comebackBoostActive = true;
    }

    // 属性变化音效 + 视觉高亮
    if (changes && changes.length > 0) {
      for (const change of changes) {
        if (change.delta > 0) {
          try { this.audio.playStatUp(change.delta); } catch(e) {}
        } else if (change.delta < 0) {
          try { this.audio.playStatDown(Math.abs(change.delta)); } catch(e) {}
        }
        // 属性面板高亮反馈
        this._flashStatBar(change.attr, change.delta);
      }
    }

    // 远期标记
    if (choice.flag) {
      this.state.flags.add(choice.flag);
    }

    // 选择计时（用于速通隐藏成就检测）
    this._totalChoicesMade++;
    const now = Date.now();
    if (!this._firstChoiceTime) this._firstChoiceTime = now;
    this._lastChoiceTime = now;

    // 成就（支持单个或数组）
    const achievements = Array.isArray(effects.achievement) ? effects.achievement : (effects.achievement ? [effects.achievement] : []);
    const icons = Array.isArray(effects.icon) ? effects.icon : [];
    achievements.forEach((achName, idx) => {
      if (this.state.achievements.includes(achName)) return;

      // 条件成就：无债一身轻需要 honest_repay 且财富 > 5
      if (achName === ALL_ACHIEVEMENTS.debt_free.name && !this._canUnlockDebtFree()) {
        return;
      }

      this.state.achievements.push(achName);
      const achIcon = icons[idx] || effects.icon || '★';
      const hidden = isHiddenAchievement(achName);
      this.achievementPopup.show(achName, achIcon, hidden);
      // 同步到 localStorage
      addAchievementToStorage(achName, achIcon, hidden);
      // 根据成就稀有度播放不同音效
      try {
        if (hidden) {
          this.audio.playAchievementLegendary();
        } else if (achIcon === '♔' || achIcon === '★') {
          this.audio.playAchievementLegendary();
        } else if (achIcon === '◆' || achIcon === '▲') {
          this.audio.playAchievementRare();
        } else {
          this.audio.playAchievement();
        }
      } catch(e) {}
    });

    // 隐藏成就检测
    this._checkHiddenAchievements();

    // 记录选择历史（决策回顾用）
    if (!this.state.history) this.state.history = [];
    this.state.history.push({
      nodeId: this.state.currentNode,
      choiceLabel: choice.label,
      historyChoice: choice.label.substring(0, 20) + (choice.label.length > 20 ? '...' : '')
    });

    // 跨周目节点选择追踪（平行宇宙成就：同一节点选了不同选项）
    this._checkParallelUniverse(choice.label);

    this.stats.update(this.state);
    try { this.save.save(this._serializeState()); } catch(e) {}

    // 选择效果后检查压力崩溃；未崩溃则继续阈值/随机事件流程
    this._checkPressureCrashOrProceed(() => {
      // 检查属性阈值触发
      const triggers = checkThresholdTriggers(this.state, this.state.flags);
      if (triggers.length > 0) {
        this._showThresholdTriggers(triggers, 0, () => {
          this._proceedAfterChoice(choice);
        }, choice);
        return;
      }

      this._proceedAfterChoice(choice);
    }, choice);
  }

  /**
   * 隐藏成就检测
   * 在每次选择后调用，检测是否满足隐藏成就条件
   */
  _checkHiddenAchievements() {
    // 老罗附体：理想主义达到9
    if (this.state.pride >= 9 && !this.state.achievements.includes(HIDDEN_ACHIEVEMENTS.luo_possessed.name)) {
      this._unlockHiddenAchievement(HIDDEN_ACHIEVEMENTS.luo_possessed);
    }

    // 再来亿次：累计游玩3次以上
    if (this._getPlayCount() >= 3 && !this.state.achievements.includes(HIDDEN_ACHIEVEMENTS.try_again_billion.name)) {
      this._unlockHiddenAchievement(HIDDEN_ACHIEVEMENTS.try_again_billion);
    }

    // 社交达人：触发5次以上随机事件（排除阶段结算等内部事件）
    const eventCount = [...(this.state.triggeredEvents || [])].filter(id => !id.startsWith('stage_entry_')).length;
    if (eventCount >= 5 && !this.state.achievements.includes(HIDDEN_ACHIEVEMENTS.social_butterfly.name)) {
      this._unlockHiddenAchievement(HIDDEN_ACHIEVEMENTS.social_butterfly);
    }

    // 无债一身轻：选择诚实还债路线且财富超过5
    if (this.state.flags.has('honest_repay') && this.state.wealth > 5 && !this.state.achievements.includes(ALL_ACHIEVEMENTS.debt_free.name)) {
      this._unlockAchievement(ALL_ACHIEVEMENTS.debt_free);
    }

    // === 属性阈值成就 ===
    if (this.state.pride >= 10 && !this.state.achievements.includes(ALL_ACHIEVEMENTS.high_idealist.name)) {
      this._unlockAchievement(ALL_ACHIEVEMENTS.high_idealist);
    }
    if (this.state.wealth >= 8 && !this.state.achievements.includes(ALL_ACHIEVEMENTS.tycoon_wannabe.name)) {
      this._unlockAchievement(ALL_ACHIEVEMENTS.tycoon_wannabe);
    }
    if (this.state.reputation >= 9 && !this.state.achievements.includes(ALL_ACHIEVEMENTS.famous.name)) {
      this._unlockAchievement(ALL_ACHIEVEMENTS.famous);
    }
    if (this.state.trust >= 9 && !this.state.achievements.includes(ALL_ACHIEVEMENTS.trusted.name)) {
      this._unlockAchievement(ALL_ACHIEVEMENTS.trusted);
    }
    if ((this.state.failures || 0) >= 3 && !this.state.achievements.includes(ALL_ACHIEVEMENTS.failure_king.name)) {
      this._unlockAchievement(ALL_ACHIEVEMENTS.failure_king);
    }

    // === 隐藏属性成就 ===
    // 压力锅：压力达到上限但未崩溃
    if (this.state.pressure >= 10 && !this.state.achievements.includes(HIDDEN_ACHIEVEMENTS.pressure_cooker.name)) {
      this._unlockHiddenAchievement(HIDDEN_ACHIEVEMENTS.pressure_cooker);
    }
    // 信任崩塌：公众信任降到0
    if (this.state.trust <= 0 && !this.state.achievements.includes(HIDDEN_ACHIEVEMENTS.trust_fall.name)) {
      this._unlockHiddenAchievement(HIDDEN_ACHIEVEMENTS.trust_fall);
    }
    // 全能选手：四项属性同时达到6以上
    if (this.state.pride >= 6 && this.state.wealth >= 6 && this.state.reputation >= 6 && this.state.trust >= 6
        && !this.state.achievements.includes(HIDDEN_ACHIEVEMENTS.all_rounder.name)) {
      this._unlockHiddenAchievement(HIDDEN_ACHIEVEMENTS.all_rounder);
    }
    // 完美人生：单局零失败通关（failures=0 且已有游戏开始时间）
    if ((this.state.failures || 0) === 0 && this.state.gameStartTime
        && !this.state.achievements.includes(HIDDEN_ACHIEVEMENTS.perfect_run.name)) {
      // 仅在后期阶段检测（避免一开始就触发）
      const lateStage = ['crisis', 'repay', 'final'].includes((getStageByNodeId(this.state.currentNode) || {}).id || '');
      if (lateStage) {
        this._unlockHiddenAchievement(HIDDEN_ACHIEVEMENTS.perfect_run);
      }
    }
    // 涅槃重生：连续失败3次后仍保持高理想
    if ((this.state.failures || 0) >= 3 && this.state.pride >= 7
        && !this.state.achievements.includes(HIDDEN_ACHIEVEMENTS.phoenix_rise.name)) {
      this._unlockHiddenAchievement(HIDDEN_ACHIEVEMENTS.phoenix_rise);
    }

    // === 成就收藏家：解锁30个以上成就 ===
    const totalUnlocked = this.state.achievements.length;
    if (totalUnlocked >= 30 && !this.state.achievements.includes(HIDDEN_ACHIEVEMENTS.collector.name)) {
      this._unlockHiddenAchievement(HIDDEN_ACHIEVEMENTS.collector);
    }
  }

  /**
   * 平行宇宙成就检测：同一节点选了不同选项（跨周目检测）
   */
  _checkParallelUniverse(choiceLabel) {
    const nodeChoices = this._loadNodeChoices();
    const currentNodeId = this.state.currentNode;
    if (currentNodeId && choiceLabel) {
      if (nodeChoices[currentNodeId] && nodeChoices[currentNodeId] !== choiceLabel) {
        // 同一节点，不同选项 → 解锁平行宇宙
        if (!this.state.achievements.includes(HIDDEN_ACHIEVEMENTS.parallel_universe.name)) {
          this._unlockHiddenAchievement(HIDDEN_ACHIEVEMENTS.parallel_universe);
        }
      }
      // 记录当前选择
      nodeChoices[currentNodeId] = choiceLabel;
      this._saveNodeChoices(nodeChoices);
    }

    // 同时检测 state.history 中的重复 nodeId（字面条件）
    if (this.state.history && this.state.history.length > 1) {
      const nodeIds = this.state.history.map(h => h.nodeId);
      const seen = new Set();
      for (const nid of nodeIds) {
        if (seen.has(nid)) {
          if (!this.state.achievements.includes(HIDDEN_ACHIEVEMENTS.parallel_universe.name)) {
            this._unlockHiddenAchievement(HIDDEN_ACHIEVEMENTS.parallel_universe);
          }
          break;
        }
        seen.add(nid);
      }
    }
  }

  /**
   * 解锁隐藏成就
   */
  _unlockHiddenAchievement(achDef) {
    if (this.state.achievements.includes(achDef.name)) return;
    this.state.achievements.push(achDef.name);
    this.achievementPopup.show(achDef.name, achDef.icon, true);
    addAchievementToStorage(achDef.name, achDef.icon, true);
    try { this.audio.playAchievementLegendary(); } catch(e) {}

    // === 累加成就积分 ===
    const score = getAchievementScore(achDef.name);
    if (score > 0 && this.meta) {
      this.meta.addAchievementScore(score);
    }

    // === 检查里程碑奖励与组合成就 ===
    this._checkAchievementMilestones();
    this._checkComboAchievements();
  }

  /**
   * 解锁普通成就
   */
  _unlockAchievement(achDef) {
    if (this.state.achievements.includes(achDef.name)) return;
    this.state.achievements.push(achDef.name);
    this.achievementPopup.show(achDef.name, achDef.icon, false);
    addAchievementToStorage(achDef.name, achDef.icon, false);
    try { this.audio.playAchievement(); } catch(e) {}

    // === 累加成就积分 ===
    const score = getAchievementScore(achDef.name);
    if (score > 0 && this.meta) {
      this.meta.addAchievementScore(score);
    }

    // === 检查里程碑奖励与组合成就 ===
    this._checkAchievementMilestones();
    this._checkComboAchievements();
  }

  /**
   * 检查成就里程碑奖励
   * 当累计解锁成就数达到阈值时，记录到 MetaProgression
   */
  _checkAchievementMilestones() {
    if (!this.meta || typeof this.meta.checkMilestoneRewards !== 'function') return;
    try {
      // 计算累计解锁成就总数（session + storage 去重）
      const sessionSet = new Set(this.state.achievements || []);
      const stored = (typeof loadUnlockedAchievements === 'function')
        ? loadUnlockedAchievements()
        : [];
      for (const a of stored) {
        if (a && a.name) sessionSet.add(a.name);
      }
      const total = sessionSet.size;
      const highest = this.meta.checkMilestoneRewards(total);
      if (highest) {
        // 里程碑达成提示
        try {
          toast.success(`★ 里程碑达成：${highest.name}`, 5000);
        } catch(e) {}
      }
    } catch(e) {}
  }

  /**
   * 检查组合成就解锁
   * 当玩家同时满足组合成就的 requires 或 condition 时解锁
   */
  _checkComboAchievements() {
    try {
      // 构造已解锁成就名称集合
      const unlockedSet = new Set(this.state.achievements || []);
      const stored = (typeof loadUnlockedAchievements === 'function')
        ? loadUnlockedAchievements()
        : [];
      for (const a of stored) {
        if (a && a.name) unlockedSet.add(a.name);
      }

      // 统计数量
      let normalCount = 0;
      let hiddenCount = 0;
      for (const name of unlockedSet) {
        if (isHiddenAchievement(name)) {
          hiddenCount++;
        } else {
          normalCount++;
        }
      }

      // 获取已解锁结局数（优先用 localStorage 中的全结局记录，更可靠）
      let endingCount = 0;
      try {
        const raw = localStorage.getItem('luohammer_all_endings');
        endingCount = raw ? JSON.parse(raw).length : 0;
      } catch(e) {
        if (this.meta && typeof this.meta.getSeenEndings === 'function') {
          endingCount = this.meta.getSeenEndings().length;
        }
      }

      const newlyUnlocked = checkComboAchievements({
        unlockedNames: unlockedSet,
        normalCount,
        hiddenCount,
        endingCount
      });

      // 弹窗显示新解锁的组合成就
      if (newlyUnlocked.length > 0 && this.achievementPopup) {
        // 累加组合成就积分
        for (const combo of newlyUnlocked) {
          if (this.meta && combo.score) {
            this.meta.addAchievementScore(combo.score);
          }
          // 延迟显示，避免与普通成就弹窗冲突
          this._trackedTimeout(() => {
            try {
              this.achievementPopup.show(combo.name, combo.icon, true);
              try { this.audio.playAchievementLegendary(); } catch(e) {}
            } catch(e) {}
          }, 800);
        }
      }
    } catch(e) {}
  }

  /**
   * 选择后的流程推进
   */
  _proceedAfterChoice(choice) {
    const currentNode = STORY[this.state.currentNode];

    // === 属性联动事件检测：在 applyEffects 之后、_goToNextNode 之前触发 ===
    // 联动事件不阻断剧情流程，仅显示 toast 提示并应用额外效果
    const comboTrigger = checkComboTriggers(this.state);
    if (comboTrigger) {
      try { this.debug.logComboTrigger(comboTrigger.id, comboTrigger.message); } catch(e) {}
      try { toast.warning(comboTrigger.message, 4000); } catch(e) {}
      if (comboTrigger.effects) {
        const { state: comboState } = applyEffects(this.state, comboTrigger.effects);
        this.state = comboState;
        this.stats.update(this.state);
      }
    }

    // 尝试触发随机事件
    const stage = getStageByNodeId(this.state.currentNode);
    if (stage) {
      // 推进节流计数（每个主线节点 +1）
      this.randomEventSystem.onNodeAdvanced();
      const triggered = this.randomEventSystem.tryTrigger(
        this.state,
        stage.id,
        this.state.triggeredEvents,
        (effects, flag, eventId) => {
          // 随机事件音效
          try { this.audio.playRandomEvent(); } catch(e) {}
          try { this.debug.logRandomEvent(eventId, stage ? stage.id : null); } catch(e) {}

          // === 事件图鉴：记录已遇到的随机事件 ===
          try { this.meta.addSeenEvent(eventId); } catch(e) {}

          // 随机事件选择后的回调
          const { state: newState } = applyEffects(this.state, effects);
          this.state = newState;
          if (flag) this.state.flags.add(flag);
          this.state.triggeredEvents.add(eventId);
          this.stats.update(this.state);
          try { this.save.save(this._serializeState()); } catch(e) {}

          // 随机事件效果后重检压力崩溃；崩溃处理完成后直接推进节点，避免再次触发随机事件
          this._checkPressureCrashOrProceed(() => {
            this._goToNextNode(choice, currentNode);
          }, choice, true);
        }
      );
      if (triggered) {
        // === 跨周目技能：预知未来 — 随机事件预兆提示 ===
        if (this.state._showEventOmen) {
          try { toast.info('◯ 预知未来：你预感到一个随机事件正在发生……', 3500); } catch(e) {}
        }
        return;
      }
    }

    this._goToNextNode(choice, currentNode);
  }

  _goToNextNode(choice, currentNode) {
    // === 属性检定系统：如果选项有 check 字段，先执行检定 ===
    if (choice.check) {
      this._performCheck(choice, currentNode);
      return;
    }

    this._proceedToNode(choice, choice.next, currentNode);
  }

  /**
   * 显示检定动画
   * 全屏遮罩 + 旋转骰子 + 结果展示，动画结束后调用 callback
   * @param {object} check - 检定定义
   * @param {boolean} passed - 是否通过检定
   * @param {string} attrLabel - 属性中文名
   * @param {number} attrValue - 当前属性值
   * @param {Function} callback - 动画结束回调
   */
  _showCheckAnimation(check, passed, attrLabel, attrValue, callback) {
    const overlay = document.createElement('div');
    overlay.className = 'check-animation-overlay';
    overlay.innerHTML = `
      <div class="check-animation-content">
        <div class="check-animation-dice">◊</div>
        <div class="check-animation-text">属性检定中...</div>
        <div class="check-animation-info">${attrLabel} ${attrValue}/${check.min}</div>
      </div>
    `;
    document.body.appendChild(overlay);

    // 触发淡入
    requestAnimationFrame(() => {
      overlay.classList.add('visible');
    });

    // 1秒后显示结果
    this._trackedTimeout(() => {
      const content = overlay.querySelector('.check-animation-content');
      if (!content) return;
      const resultText = passed ? '检定成功！' : '检定失败';
      const resultClass = passed ? 'success' : 'fail';
      content.innerHTML = `
        <div class="check-animation-result ${resultClass}">${resultText}</div>
        <div class="check-animation-info">${attrLabel} ${attrValue}/${check.min}</div>
      `;
    }, 1000);

    // 1.8秒后淡出并调用回调（总时长不超过2秒）
    this._trackedTimeout(() => {
      overlay.classList.remove('visible');
      overlay.classList.add('closing');
      this._trackedTimeout(() => {
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
        callback();
      }, 200);
    }, 1800);
  }

  /**
   * 执行属性检定。
   * check 格式: { attr, min, successNext, failNext, successEffects?, failEffects?, label? }
   */
  _performCheck(choice, currentNode) {
    const check = choice.check;
    const rawAttrValue = this.state[check.attr] || 0;
    // === 跨周目技能：一呼百应 — 名声≥7 时检定值 +1 ===
    let checkBonus = 0;
    if (this.state._reputationCheckBonus && (this.state.reputation || 0) >= 7) {
      checkBonus = this.state._reputationCheckBonus;
    }
    // === 天赋：人脉编织者 — 信任≥5 时检定值 +1 ===
    if (this.state.talentSpecials && this.state.talentSpecials.includes('trust_check_bonus') && (this.state.trust || 0) >= 5) {
      checkBonus += 1;
    }
    // === 里程碑奖励：成就猎人 — 所有检定 +1 ===
    if (this.state._achievementHunter) {
      checkBonus += 1;
    }
    const attrValue = rawAttrValue + checkBonus;
    let passed = attrValue >= check.min;
    const attrLabel = ChoiceSystem.STAT_LABELS[check.attr] || check.attr;

    // === 跨周目技能：免费重试 ===
    if (!passed && this.state._freeRetry && this.state._freeRetry > 0) {
      this.state._freeRetry--;
      passed = true;
      // 检定音效（特殊）
      try { this.audio.playAchievementRare(); } catch(e) {}
      this.dialog.show('◊ 属性检定', `【${attrLabel}检定】${rawAttrValue}${checkBonus ? `+${checkBonus}` : ''}/${check.min} —— 失败！\n但「第二次机会」技能触发，自动转为成功！`, () => {
        if (check.successEffects) {
          const { state: newState } = applyEffects(this.state, check.successEffects);
          this.state = newState;
          this.stats.update(this.state);
        }
        const nextNode = check.successNext;
        try { this.debug.logCheck(check.attr, check.min, attrValue, true, nextNode); } catch(e) {}
        this._proceedToNode(choice, nextNode, currentNode);
      });
      return;
    }

    // 检定音效
    try { this.audio.playThresholdTrigger(); } catch(e) {}

    // 显示检定动画，动画结束后应用效果并跳转
    this._showCheckAnimation(check, passed, attrLabel, attrValue, () => {
      // 应用检定结果效果
      if (passed && check.successEffects) {
        const { state: newState } = applyEffects(this.state, check.successEffects);
        this.state = newState;
        this.stats.update(this.state);
      } else if (!passed && check.failEffects) {
        // === 跨周目技能：检定失败惩罚减半 ===
        let actualFailEffects = check.failEffects;
        const mitigate = this.meta ? this.meta.getEffect('check_fail_mitigate') : null;
        if (mitigate && actualFailEffects) {
          actualFailEffects = { ...actualFailEffects };
          for (const key of Object.keys(actualFailEffects)) {
            if (typeof actualFailEffects[key] === 'number' && actualFailEffects[key] < 0) {
              actualFailEffects[key] = Math.ceil(actualFailEffects[key] * mitigate.value);
            }
          }
        }
        // === 跨周目技能：患难之交 — 信任≥7 时失败惩罚再减半 ===
        if (this.state._trustFailMitigate && (this.state.trust || 0) >= 7 && actualFailEffects) {
          actualFailEffects = { ...actualFailEffects };
          for (const key of Object.keys(actualFailEffects)) {
            if (typeof actualFailEffects[key] === 'number' && actualFailEffects[key] < 0) {
              actualFailEffects[key] = Math.ceil(actualFailEffects[key] * this.state._trustFailMitigate);
            }
          }
        }
        const { state: newState } = applyEffects(this.state, actualFailEffects);
        this.state = newState;
        this.stats.update(this.state);
      }

      // 跳转到对应节点
      const nextNode = passed ? check.successNext : check.failNext;
      try { this.debug.logCheck(check.attr, check.min, attrValue, passed, nextNode); } catch(e) {}
      this._proceedToNode(choice, nextNode, currentNode);
    });
  }

  /**
   * 统一的节点跳转逻辑（检定后或直接跳转共用）
   */
  _proceedToNode(choice, nextNodeId, currentNode) {
    if (currentNode && currentNode.historyNote) {
      // 历史对照音效
      try { this.audio.playHistoryCard(); } catch(e) {}

      // 记录本局解锁的历史真相（去重），供结局回顾使用
      if (!this.state.unlockedHistoryNotes) this.state.unlockedHistoryNotes = [];
      const nodeId = this.state.currentNode;
      if (!this.state.unlockedHistoryNotes.some(h => h.nodeId === nodeId)) {
        this.state.unlockedHistoryNotes.push({
          nodeId,
          actSub: currentNode.actSub || '',
          note: currentNode.historyNote
        });
      }

      // 显示「历史真相」按钮，玩家可选择查看或跳过
      // onRead 回调：玩家点击查看时，记录为已读
      const onRead = () => {
        if (!this.state.readHistoryNotes) this.state.readHistoryNotes = [];
        if (!this.state.readHistoryNotes.includes(nodeId)) {
          this.state.readHistoryNotes.push(nodeId);
          try { this.save.save(this._serializeState()); } catch(e) {}
        }
      };

      this.dialog.showHistoryNoteButton(currentNode.historyNote, () => {
        // 关闭 overlay 后继续加载下一节点
        try { this.audio.playTransition(); } catch(e) {}
        // 修复：在黑屏中点切换场景内容，而非淡出后再切换
        this.transition.play(() => { this.loadNode(nextNodeId); }, () => {});
      }, onRead);
    } else {
      try { this.audio.playTransition(); } catch(e) {}
      this.transition.play(() => { this.loadNode(nextNodeId); }, () => {});
    }
  }

  /**
   * 统一检查压力崩溃；若达到上限则处理崩溃事件，否则执行继续回调。
   * 用于选择效果、阈值效果、随机事件效果等任意状态变更后重检。
   */
  _checkPressureCrashOrProceed(continueCallback, originalChoice, skipRandomEvent = false) {
    const crashEvent = checkPressureCrash(this.state);
    if (crashEvent) {
      // === 跨周目技能：不死鸟 — 每局一次满血复活，跳过崩溃 ===
      if (this.state._phoenixRevive && this.state._phoenixRevive > 0) {
        this._offerPhoenixRevive(crashEvent, originalChoice, skipRandomEvent, continueCallback);
        return;
      }
      this._handlePressureCrash(crashEvent, originalChoice, skipRandomEvent);
    } else {
      continueCallback();
    }
  }

  /**
   * 不死鸟复活：消耗一次复活机会，将压力降至安全线并跳过崩溃惩罚
   */
  _offerPhoenixRevive(crashEvent, originalChoice, skipRandomEvent, continueCallback) {
    try { this.audio.playAchievementRare(); } catch(e) {}
    this.dialog.show('▲ 不死鸟觉醒', '压力即将崩溃！\n「不死鸟」技能可消耗一次复活机会，将压力降至 3 并免于崩溃惩罚。是否使用？', () => {
      // 提供两个选项：使用复活 / 硬扛崩溃
      this.choices.show([
        { label: '▲ 使用复活机会', effects: {}, _useRevive: true },
        { label: '◉ 硬扛崩溃', effects: {}, _useRevive: false }
      ], (choice) => {
        this.choices.hide();
        this.dialog.hide();
        if (choice._useRevive) {
          // 使用复活：消耗机会，压力降至 3，跳过崩溃
          this.state._phoenixRevive--;
          const maxP = this.state.pressureMax || 10;
          this.state.pressure = Math.min(maxP, 3);
          this.stats.update(this.state);
          try { toast.success('▲ 不死鸟觉醒！压力已降至 3，本次免于崩溃。', 3500); } catch(e) {}
          continueCallback();
        } else {
          // 不使用：进入正常崩溃流程
          this._handlePressureCrash(crashEvent, originalChoice, skipRandomEvent);
        }
      });
    });
  }

  /**
   * 处理压力崩溃
   */
  _handlePressureCrash(crashEvent, originalChoice, skipRandomEvent = false) {
    // 压力警告音效
    try { this.audio.playPressureWarning(); } catch(e) {}

    // === 跨周目技能：绝境逢生 — 崩溃选项负面效果减半 ===
    let crashChoices = crashEvent.choices;
    if (this.state._crashKeepStats && crashChoices) {
      const keepRatio = this.state._crashKeepStats; // 0.5
      crashChoices = crashChoices.map(c => {
        const newEffects = { ...c.effects };
        for (const key of Object.keys(newEffects)) {
          if (typeof newEffects[key] === 'number' && newEffects[key] < 0) {
            newEffects[key] = Math.ceil(newEffects[key] * keepRatio);
          }
        }
        return { ...c, effects: newEffects };
      });
      try { toast.info('◉ 绝境逢生：本次崩溃的负面损失已减半。', 3500); } catch(e) {}
    }

    // 用对话框显示崩溃事件
    this.dialog.show('⚠ 压力崩溃', this._replaceCharacterNameInText(crashEvent.text, this.state.currentNode), () => {
      this.choices.show(crashChoices, (choice) => {
        const { state: newState } = applyEffects(this.state, choice.effects);
        this.state = newState;
        this.stats.update(this.state);
        this.choices.hide();
        this.dialog.hide();

        // 继续原来的流程
        if (skipRandomEvent) {
          this._goToNextNode(originalChoice, STORY[this.state.currentNode]);
        } else {
          this._proceedAfterChoice(originalChoice);
        }
      });
    });
  }

  /**
   * 显示属性阈值触发事件
   */
  _showThresholdTriggers(triggers, index, onComplete, originalChoice) {
    if (index >= triggers.length) {
      // 所有阈值事件处理完毕，隐藏对话框再继续主线/结局流程
      this.dialog.hide();
      // 阈值效果后重检压力崩溃
      this._checkPressureCrashOrProceed(onComplete, originalChoice);
      return;
    }

    const t = triggers[index];
    // 阈值触发音效
    try { this.audio.playThresholdTrigger(); } catch(e) {}
    this.dialog.show('✦ 隐藏事件', this._replaceCharacterNameInText(t.text, this.state.currentNode), () => {
      if (t.effects) {
        const { state: newState } = applyEffects(this.state, t.effects);
        this.state = newState;
        this.stats.update(this.state);
      }
      if (t.flag) {
        this.state.flags.add(t.flag);
      }
      this._showThresholdTriggers(triggers, index + 1, onComplete, originalChoice);
    });
  }

  /**
   * 显示结局
   */
  showEnding() {
    // 进入结局前隐藏游戏主界面的对话框和选项，避免覆盖结局画面
    if (this.dialog) this.dialog.hide();
    if (this.choices) this.choices.hide();

    // 注：play_count 已在 GameScene.init() 中 +1，此处不再重复计数
    // （replay_bonus 天赋读取的是 init 时写入的值，避免双重计数）

    // 速通玩家成就检测：从开始到结局不超过30分钟
    if (this.state.gameStartTime) {
      const elapsed = Date.now() - this.state.gameStartTime;
      if (elapsed <= 30 * 60 * 1000 && !this.state.achievements.includes(HIDDEN_ACHIEVEMENTS.speedrunner.name)) {
        this._unlockHiddenAchievement(HIDDEN_ACHIEVEMENTS.speedrunner);
      }
    }

    let endingKey;
    const nodeId = this.state.currentNode;
    if (nodeId && nodeId.startsWith('ending_')) {
      endingKey = nodeId.replace('ending_', '');
    } else {
      // 使用结局引擎匹配
      const ending = matchEnding(this.state, this.state.flags);
      endingKey = ending ? ending.id : 'survivor';
    }

    // 结局相关成就检测
    const hiddenEndingKeys = new Set(['hermit', 'tech_blogger', 'rights_fighter', 'monk', 'returns']);

    // 东山再起：翻车3次以上且最终名声达到8
    if ((this.state.failures || 0) >= 3 && this.state.reputation >= 8 && !this.state.achievements.includes(ALL_ACHIEVEMENTS.comeback_king.name)) {
      this._unlockAchievement(ALL_ACHIEVEMENTS.comeback_king);
    }

    // 永远的理想主义者：通关时理想主义不低于8
    if (this.state.pride >= 8 && !this.state.achievements.includes(ALL_ACHIEVEMENTS.idealist_forever.name)) {
      this._unlockAchievement(ALL_ACHIEVEMENTS.idealist_forever);
    }

    // 现实主义者：通关时理想主义不超过3
    if (this.state.pride <= 3 && !this.state.achievements.includes(ALL_ACHIEVEMENTS.pragmatist.name)) {
      this._unlockAchievement(ALL_ACHIEVEMENTS.pragmatist);
    }

    // 彩蛋猎人：解锁2个以上隐藏结局
    if (hiddenEndingKeys.has(endingKey)) {
      addHiddenEndingToStorage(endingKey);
    }
    const unlockedHiddenEndings = loadUnlockedHiddenEndings();
    if (unlockedHiddenEndings.length >= 2 && !this.state.achievements.includes(HIDDEN_ACHIEVEMENTS.easter_egg.name)) {
      this._unlockHiddenAchievement(HIDDEN_ACHIEVEMENTS.easter_egg);
    }

    // 结局收集成就
    const totalEndingsUnlocked = addEndingToStorage(endingKey);
    if (totalEndingsUnlocked >= 5 && !this.state.achievements.includes(ALL_ACHIEVEMENTS.ending_explorer.name)) {
      this._unlockAchievement(ALL_ACHIEVEMENTS.ending_explorer);
    }
    if (totalEndingsUnlocked >= 10 && !this.state.achievements.includes(ALL_ACHIEVEMENTS.ending_master.name)) {
      this._unlockAchievement(ALL_ACHIEVEMENTS.ending_master);
    }
    if (totalEndingsUnlocked >= 35 && !this.state.achievements.includes(ALL_ACHIEVEMENTS.ending_completionist.name)) {
      this._unlockAchievement(ALL_ACHIEVEMENTS.ending_completionist);
    }

    // 黑马：以低属性状态达成好结局（全属性≤4但达成非负面结局）
    const goodEndings = new Set(['legend', 'balance', 'phoenix', 'comeback', 'talkshow_star', 'educator', 'writer', 'mentor']);
    if (goodEndings.has(endingKey) && this.state.pride <= 4 && this.state.wealth <= 4
        && this.state.reputation <= 4 && !this.state.achievements.includes(HIDDEN_ACHIEVEMENTS.dark_horse.name)) {
      this._unlockHiddenAchievement(HIDDEN_ACHIEVEMENTS.dark_horse);
    }
    // 根据结局类型播放不同音效
    try {
      const legendaryEndings = ['ideal_king', 'tech_giant', 'cultural_icon'];
      const tragicEndings = ['debt_prison', 'forgotten', 'exile'];
      const peacefulEndings = ['survivor', 'compromise', 'quiet_life'];
      if (legendaryEndings.includes(endingKey)) {
        this.audio.playEndingLegendary();
      } else if (tragicEndings.includes(endingKey)) {
        this.audio.playEndingTragic();
      } else if (peacefulEndings.includes(endingKey)) {
        this.audio.playEndingPeaceful();
      } else {
        this.audio.playEnding();
      }
    } catch(e) {}

    // 进入结局场景前淡出 BGM
    if (this.audio) {
      try { this.audio.fadeOutBGM(1.0); } catch(e) {}
    }

    // 预读结局专属插图（避免结局页加载卡顿）
    // 结局图在 EndingScene 中由 PixelRenderer.drawBackground 绘制，
    // 提前用 Phaser load 预读到纹理缓存，场景切换时直接可用
    this._preloadEndingScene(endingKey);

    try { this.debug.logEnding(endingKey, this.state); } catch(e) {}
    this.scene.start('EndingScene', { state: this.state, ending: endingKey });
  }

  /**
   * 预读结局场景专属插图（fire-and-forget）。
   * 根据 endingKey 查 ENDING_SCENE_MAP 获取场景 type，再触发纹理加载。
   * 加载未完成时进入 EndingScene，PixelRenderer 会用 Graphics 兜底，不影响展示。
   * @param {string} endingKey 结局 ID
   */
  _preloadEndingScene(endingKey) {
    const sceneType = ENDING_SCENE_MAP[endingKey] || 'ending';
    // 复用 _ensureSceneTexture 预读（已内置去重和失败兜底）
    this._ensureSceneTexture(sceneType);
    // 同时预读通用 ending 背景（兜底场景）
    this._ensureSceneTexture('ending');
  }

  /**
   * 更新音色切换按钮的标签（显示当前预设简称）
   */
  _updateVoiceToggleLabel() {
    if (!this.voiceIconEl || !this.audio) return;
    try {
      const preset = this.audio.getVoicePreset();
      // 取标签前4字作为简称
      const short = preset.label.replace(/★/, '').split('·')[0].slice(0, 4);
      this.voiceIconEl.textContent = short;
    } catch(e) {
      this.voiceIconEl.textContent = '音色';
    }
  }

  /**
   * 游戏内快捷音色切换面板（简化版：预设列表 + 试听 + 应用，不含自定义导入）
   */
  _showQuickVoicePanel() {
    // 若已存在则关闭
    if (this._quickVoicePanelEl) {
      this._closeQuickVoicePanel();
      return;
    }
    const audio = this.audio;
    if (!audio) return;
    const currentKey = audio.getVoicePresetKey();

    const panel = document.createElement('div');
    panel.style.cssText = [
      'position: fixed',
      'inset: 0',
      'background: rgba(0, 0, 0, 0.7)',
      'display: flex',
      'align-items: center',
      'justify-content: center',
      'z-index: 1000',
      'font-family: "Press Start 2P", "Cascadia Mono", monospace'
    ].join(';');

    const box = document.createElement('div');
    box.style.cssText = [
      'background: #1a1a2e',
      'border: 2px solid var(--color-gold)',
      'border-radius: 6px',
      'padding: 20px',
      'max-width: 90vw',
      'max-height: 80vh',
      'overflow-y: auto',
      'box-shadow: 0 0 30px rgba(240, 192, 64, 0.3)',
      'color: var(--color-gold)'
    ].join(';');

    const title = document.createElement('div');
    title.textContent = '♪ 配音音色切换';
    title.style.cssText = 'font-size: 14px; color: var(--color-gold); margin-bottom: 14px; text-align: center; font-weight: 700;';
    box.appendChild(title);

    const presets = Object.values(VOICE_PRESETS);
    presets.forEach(preset => {
      const row = document.createElement('div');
      row.style.cssText = [
        'display: flex',
        'align-items: center',
        'justify-content: space-between',
        'padding: 10px 12px',
        'margin-bottom: 8px',
        'border: 1px solid rgba(240, 192, 64, 0.18)',
        'border-radius: 4px',
        'background: rgba(240, 192, 64, 0.04)',
        preset.key === currentKey ? 'border-color: rgba(240, 192, 64, 0.7); background: rgba(240, 192, 64, 0.1);' : ''
      ].join(';');

      const left = document.createElement('div');
      left.style.cssText = 'flex: 1; padding-right: 10px;';

      const name = document.createElement('div');
      name.style.cssText = 'font-size: 12px; color: var(--color-gold); font-weight: 700; margin-bottom: 3px;';
      name.textContent = (preset.key === currentKey ? '★ ' : '') + preset.label;
      left.appendChild(name);

      const desc = document.createElement('div');
      desc.style.cssText = 'font-size: 10px; color: var(--color-text-secondary); line-height: 1.4;';
      desc.textContent = preset.desc;
      left.appendChild(desc);

      row.appendChild(left);

      // 试听按钮
      const previewBtn = document.createElement('button');
      previewBtn.textContent = '试听';
      previewBtn.style.cssText = 'background: rgba(120, 80, 30, 0.4); color: var(--color-gold); border: 1px solid var(--color-gold-border); padding: 6px 10px; font-size: 10px; cursor: pointer; margin-left: 8px; font-family: inherit;';
      previewBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        audio.previewVoicePreset(preset.key);
      });
      row.appendChild(previewBtn);

      // 应用按钮
      const applyBtn = document.createElement('button');
      applyBtn.textContent = preset.key === currentKey ? '当前' : '应用';
      applyBtn.style.cssText = preset.key === currentKey
        ? 'background: rgba(120, 120, 120, 0.3); color: var(--color-text-secondary); border: 1px solid var(--color-text-muted); padding: 6px 10px; font-size: 10px; cursor: default; margin-left: 6px; font-family: inherit;'
        : 'background: rgba(120, 80, 30, 0.6); color: var(--color-gold); border: 1px solid var(--color-gold); padding: 6px 10px; font-size: 10px; cursor: pointer; margin-left: 6px; font-family: inherit;';
      if (preset.key !== currentKey) {
        applyBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          if (audio.setVoicePreset(preset.key)) {
            this._updateVoiceToggleLabel();
            this._closeQuickVoicePanel();
            try { toast(`已切换：${preset.label}`, { type: 'info' }); } catch(e) {}
          }
        });
      }
      row.appendChild(applyBtn);

      box.appendChild(row);
    });

    // 关闭按钮
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '✕ 关闭';
    closeBtn.style.cssText = 'display: block; margin: 14px auto 0; background: transparent; color: var(--color-text-secondary); border: 1px solid var(--color-text-muted); padding: 8px 16px; font-size: 11px; cursor: pointer; font-family: inherit;';
    closeBtn.addEventListener('click', () => this._closeQuickVoicePanel());
    box.appendChild(closeBtn);

    panel.appendChild(box);

    // 点击背景关闭
    panel.addEventListener('click', (e) => {
      if (e.target === panel) this._closeQuickVoicePanel();
    });

    // ESC 关闭
    const onKey = (e) => {
      if (e.code === 'Escape') this._closeQuickVoicePanel();
    };
    window.addEventListener('keydown', onKey);

    document.body.appendChild(panel);
    this._quickVoicePanelEl = panel;
    this._quickVoicePanelOnKey = onKey;
  }

  _closeQuickVoicePanel() {
    if (!this._quickVoicePanelEl) return;
    if (this._quickVoicePanelOnKey) {
      window.removeEventListener('keydown', this._quickVoicePanelOnKey);
      this._quickVoicePanelOnKey = null;
    }
    if (this._quickVoicePanelEl.parentNode) {
      this._quickVoicePanelEl.parentNode.removeChild(this._quickVoicePanelEl);
    }
    this._quickVoicePanelEl = null;
    // 切换面板时停止试听语音
    try { this.audio.stopSpeaking(); } catch(e) {}
  }

  /**
   * 场景关闭时清理资源，防止内存泄漏
   */
  _onShutdown() {
    // 移除 shutdown 事件监听器本身，避免重复触发
    this.events.off('shutdown', this._onShutdown, this);

    // 清理快捷音色切换面板（避免场景切换时 DOM 残留）
    if (this._quickVoicePanelEl) {
      this._closeQuickVoicePanel();
    }

    // 清理阶段结算的 setInterval（避免场景切换时内存泄漏）
    if (this._settlementTimer) {
      clearInterval(this._settlementTimer);
      this._settlementTimer = null;
    }

    // 清理所有挂起的原生 setTimeout（防止场景切换后回调引用已销毁对象）
    if (this._pendingTimeouts && this._pendingTimeouts.length > 0) {
      for (const id of this._pendingTimeouts) {
        clearTimeout(id);
      }
      this._pendingTimeouts = [];
    }

    // 清理 PixelRenderer（Graphics/Sprite/纹理）
    if (this.pixelRenderer) {
      this.pixelRenderer.destroy();
      this.pixelRenderer = null;
    }
    // 清理 DialogSystem（DOM 事件监听器等）
    if (this.dialog) {
      this.dialog.destroy();
      this.dialog = null;
    }
    // 清理 ChoiceSystem（键盘事件监听器）
    if (this.choices) {
      this.choices.hide(); // 确保移除键盘监听器
      this.choices = null;
    }
    // 清理 StatsSystem（隐藏 DOM 元素）
    if (this.stats && this.stats.el) {
      this.stats.el.classList.remove('visible');
    }
    this.stats = null;
    // 清理 Transition（Graphics/tween）
    if (this.transition) {
      this.transition.destroy();
      this.transition = null;
    }
    // 清理音频系统
    if (this.audio) {
      this.audio.destroy();
      this.audio = null;
    }
    // 清理 HistoryCard（Container/Graphics）
    if (this.historyCard) {
      this.historyCard.destroy();
      this.historyCard = null;
    }
    // 清理 AchievementPopup（Container/Graphics）
    if (this.achievementPopup) {
      this.achievementPopup.destroy();
      this.achievementPopup = null;
    }
    // 清理 TalentSystem（DOM 事件监听器）
    if (this.talentSystem) {
      if (typeof this.talentSystem.destroy === 'function') {
        this.talentSystem.destroy();
      }
      this.talentSystem = null;
    }
    // 清理随机事件系统
    if (this.randomEventSystem) {
      this.randomEventSystem.destroy();
      this.randomEventSystem = null;
    }
    // 清理 SaveSystem
    this.save = null;

    // 清理角色呼吸动画 tween
    if (this._charTalkTween) {
      this._charTalkTween.stop();
      this._charTalkTween = null;
    }
    // 清理角色视觉特效（暗板、轮廓光、投影）
    if (this._charBackdrop) {
      this._charBackdrop.destroy();
      this._charBackdrop = null;
    }
    if (this._charGlow) {
      this._charGlow.destroy();
      this._charGlow = null;
    }
    if (this._charShadow) {
      this._charShadow.destroy();
      this._charShadow = null;
    }
    this._charBaseX = null;
    this._charBaseY = null;
    this._charBaseScale = null;

    // 清理 tween 和 timer
    this.tweens.killAll();
    this.time.removeAllEvents();

    // 清理 DOM overlay 元素（章节显示、音效开关）
    if (this.chapterEl) this.chapterEl.classList.remove('visible');
    if (this.soundToggleEl) this.soundToggleEl.classList.remove('visible');
    if (this.menuToggleEl) this.menuToggleEl.classList.remove('visible');
    if (this.menuConfirmEl) this.menuConfirmEl.classList.remove('visible');
    // 清理检定动画遮罩（防止场景切换时残留）
    document.querySelectorAll('.check-animation-overlay').forEach(el => el.remove());
    if (this._uiAbortController) {
      this._uiAbortController.abort();
      this._uiAbortController = null;
    }
    // 清理ESC快捷键
    if (this._escHandler) {
      window.removeEventListener('keydown', this._escHandler);
      this._escHandler = null;
    }
    // 清理移动端双指点击手势监听
    if (this._gestureAbortController) {
      this._gestureAbortController.abort();
      this._gestureAbortController = null;
    }
    // 清理兜底解锁监听器
    if (this._bgmUnlockFallback) {
      window.removeEventListener('pointerdown', this._bgmUnlockFallback);
      this._bgmUnlockFallback = null;
    }
    this.chapterNameEl = null;
    this.chapterSubEl = null;
    this.progressFillEl = null;
    this.chapterEl = null;
    this.soundToggleEl = null;
    this.soundIconEl = null;
    this.menuToggleEl = null;
    this.menuConfirmEl = null;
    this.menuCancelBtn = null;
    this.menuOkBtn = null;
  }

  /**
   * 序列化状态（Set→Array for JSON）
   */
  _serializeState() {
    const { choicesMade: _choicesMade, flags, triggeredEvents, ...rest } = this.state;
    return {
      ...rest,
      flags: Array.from(flags || []),
      triggeredEvents: Array.from(triggeredEvents || [])
    };
  }
}
