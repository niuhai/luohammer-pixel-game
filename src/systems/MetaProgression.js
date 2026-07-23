/**
 * 跨周目进度系统
 *
 * 管理：
 * - 人生经验点数（EXP）
 * - 已解锁技能
 * - 已见结局
 * - 总游玩次数
 * - 成就积分（achievementScore）
 * - 已达成里程碑奖励（milestoneRewards）
 *
 * 数据存储在 localStorage，跨周目持久化。
 */

const STORAGE_KEY = 'luohammer_meta_progress';
const ENDING_STATS_KEY = 'luohammer_ending_stats';

import { ALL_SKILLS } from '../data/skillTree.js';

/**
 * 里程碑奖励定义
 * 当玩家累计解锁的成就数量达到阈值时，下周目获得对应奖励。
 * type 用于在 GameScene._applyMetaSkills 中应用效果。
 */
export const MILESTONE_REWARDS = [
  {
    threshold: 10,
    id: 'milestone_10',
    name: '初露锋芒',
    desc: '解锁10个成就 → 下周目初始所有属性+1',
    type: 'init_bonus_all',
    value: 1
  },
  {
    threshold: 20,
    id: 'milestone_20',
    name: '崭露头角',
    desc: '解锁20个成就 → 下周目初始压力-2',
    type: 'pressure_reduce',
    value: 2
  },
  {
    threshold: 30,
    id: 'milestone_30',
    name: '游刃有余',
    desc: '解锁30个成就 → 下周目天赋选择时额外刷新一次',
    type: 'extra_talent_reroll',
    value: 1
  },
  {
    threshold: 40,
    id: 'milestone_40',
    name: '炉火纯青',
    desc: '解锁40个成就 → 下周目初始所有属性+2',
    type: 'init_bonus_all',
    value: 2
  },
  {
    threshold: 50,
    id: 'milestone_50',
    name: '成就猎人',
    desc: '解锁50个成就 → 解锁特殊天赋"成就猎人"（所有检定+1）',
    type: 'unlock_achievement_hunter',
    value: 1
  }
];

/**
 * 成就里程碑奖励定义（经验奖励型）
 * 当玩家累计解锁的成就数量达到阈值时，给予跨周目经验奖励。
 * 与 MILESTONE_REWARDS（效果型）独立运作，互不冲突。
 */
export const ACHIEVEMENT_MILESTONES = [
  {
    threshold: 10,
    id: 'ach_ms_10',
    name: '初窥门径',
    desc: '解锁10个成就 → 奖励2点经验',
    exp: 2
  },
  {
    threshold: 20,
    id: 'ach_ms_20',
    name: '渐入佳境',
    desc: '解锁20个成就 → 奖励3点经验',
    exp: 3
  },
  {
    threshold: 30,
    id: 'ach_ms_30',
    name: '成就猎人',
    desc: '解锁30个成就 → 奖励5点经验 + 解锁特殊天赋"成就猎人"',
    exp: 5,
    unlockTalent: 'achievement_hunter'
  },
  {
    threshold: 50,
    id: 'ach_ms_50',
    name: '收集大师',
    desc: '解锁50个成就 → 奖励10点经验 + 称号"收集大师"',
    exp: 10,
    title: '收集大师'
  }
];

export class MetaProgression {
  constructor() {
    this.data = this._load();
  }

  _load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return {
          exp: parsed.exp || 0,
          unlockedSkills: parsed.unlockedSkills || [],
          seenEndings: parsed.seenEndings || [],
          playCount: parsed.playCount || 0,
          totalChoices: parsed.totalChoices || 0,
          seenEvents: Array.isArray(parsed.seenEvents) ? parsed.seenEvents : [],
          achievementScore: typeof parsed.achievementScore === 'number' ? parsed.achievementScore : 0,
          claimedMilestones: Array.isArray(parsed.claimedMilestones) ? parsed.claimedMilestones : [],
          claimedAchievementMilestones: Array.isArray(parsed.claimedAchievementMilestones) ? parsed.claimedAchievementMilestones : [],
          titles: Array.isArray(parsed.titles) ? parsed.titles : [],
        };
      }
    } catch (e) {}
    return {
      exp: 0,
      unlockedSkills: [],
      seenEndings: [],
      playCount: 0,
      totalChoices: 0,
      seenEvents: [],
      achievementScore: 0,
      claimedMilestones: [],
      claimedAchievementMilestones: [],
      titles: [],
    };
  }

  save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
    } catch (e) {}
  }

  // === 经验点数 ===
  getExp() { return this.data.exp; }
  addExp(amount) {
    this.data.exp += amount;
    this.save();
  }
  spendExp(amount) {
    if (this.data.exp < amount) return false;
    this.data.exp -= amount;
    this.save();
    return true;
  }

  // === 成就积分 ===
  /**
   * 获取累计成就积分
   * @returns {number}
   */
  getAchievementScore() {
    return typeof this.data.achievementScore === 'number' ? this.data.achievementScore : 0;
  }

  /**
   * 累加成就积分
   * @param {number} amount
   */
  addAchievementScore(amount) {
    if (!amount) return;
    this.data.achievementScore = (this.data.achievementScore || 0) + amount;
    this.save();
  }

  /**
   * 检查里程碑奖励：根据传入的累计成就总数，返回当前已达成的最高里程碑。
   * 同时将新达成的里程碑记录到 claimedMilestones 中。
   *
   * @param {number} [totalAchievements] - 当前已解锁成就总数；不传则返回已记录的最高里程碑
   * @returns {object|null} 已达成的最高里程碑定义；若无则返回 null
   */
  checkMilestoneRewards(totalAchievements) {
    if (typeof totalAchievements !== 'number') {
      // 返回已记录的最高里程碑
      const claimed = this.data.claimedMilestones || [];
      if (claimed.length === 0) return null;
      let highest = null;
      for (const id of claimed) {
        const def = MILESTONE_REWARDS.find(m => m.id === id);
        if (def && (!highest || def.threshold > highest.threshold)) {
          highest = def;
        }
      }
      return highest;
    }

    const newlyClaimed = [];
    for (const ms of MILESTONE_REWARDS) {
      if (totalAchievements >= ms.threshold && !this.data.claimedMilestones.includes(ms.id)) {
        this.data.claimedMilestones.push(ms.id);
        newlyClaimed.push(ms);
      }
    }
    if (newlyClaimed.length > 0) {
      this.save();
    }

    // 返回当前已达成的最高里程碑（包含新达成的）
    let highest = null;
    for (const ms of MILESTONE_REWARDS) {
      if (totalAchievements >= ms.threshold) {
        if (!highest || ms.threshold > highest.threshold) {
          highest = ms;
        }
      }
    }
    return highest;
  }

  /**
   * 获取所有已记录的里程碑奖励列表
   * @returns {Array<object>}
   */
  getClaimedMilestones() {
    const claimed = this.data.claimedMilestones || [];
    return MILESTONE_REWARDS.filter(m => claimed.includes(m.id));
  }

  /**
   * 判断某里程碑是否已达成
   * @param {string} milestoneId
   * @returns {boolean}
   */
  isMilestoneClaimed(milestoneId) {
    return (this.data.claimedMilestones || []).includes(milestoneId);
  }

  // === 成就里程碑（经验奖励型） ===
  /**
   * 检查成就里程碑奖励：根据传入的累计成就总数，触发对应的经验奖励里程碑。
   * 每个里程碑只触发一次，用 claimedAchievementMilestones 记录。
   *
   * @param {number} totalUnlocked - 当前已解锁成就总数（普通+隐藏+组合）
   * @returns {Array<object>} 本次新触发的里程碑定义数组
   */
  checkAchievementMilestones(totalUnlocked) {
    if (typeof totalUnlocked !== 'number') return [];
    if (!Array.isArray(this.data.claimedAchievementMilestones)) {
      this.data.claimedAchievementMilestones = [];
    }
    if (!Array.isArray(this.data.titles)) {
      this.data.titles = [];
    }

    const newlyTriggered = [];
    for (const ms of ACHIEVEMENT_MILESTONES) {
      if (totalUnlocked >= ms.threshold && !this.data.claimedAchievementMilestones.includes(ms.id)) {
        this.data.claimedAchievementMilestones.push(ms.id);
        // 奖励经验
        if (ms.exp) {
          this.data.exp = (this.data.exp || 0) + ms.exp;
        }
        // 解锁特殊天赋
        if (ms.unlockTalent && !this.data.unlockedSkills.includes(ms.unlockTalent)) {
          this.data.unlockedSkills.push(ms.unlockTalent);
        }
        // 称号
        if (ms.title && !this.data.titles.includes(ms.title)) {
          this.data.titles.push(ms.title);
        }
        newlyTriggered.push(ms);
      }
    }
    if (newlyTriggered.length > 0) this.save();
    return newlyTriggered;
  }

  /**
   * 获取所有已触发的成就里程碑列表
   * @returns {Array<object>}
   */
  getClaimedAchievementMilestones() {
    const claimed = this.data.claimedAchievementMilestones || [];
    return ACHIEVEMENT_MILESTONES.filter(m => claimed.includes(m.id));
  }

  /**
   * 获取所有已获得的称号
   * @returns {Array<string>}
   */
  getTitles() {
    return Array.isArray(this.data.titles) ? this.data.titles : [];
  }

  // === 技能 ===
  getUnlockedSkills() { return this.data.unlockedSkills; }
  isSkillUnlocked(skillId) { return this.data.unlockedSkills.includes(skillId); }

  /**
   * 解锁技能（带互斥与前置校验）
   * @param {string} skillId
   * @returns {boolean} 是否解锁成功
   */
  unlockSkill(skillId) {
    if (this.data.unlockedSkills.includes(skillId)) return false;
    const skill = this._getSkillDef(skillId);
    if (!skill) return false;
    // 前置校验（AND + OR）
    if (skill.requires && !skill.requires.every(r => this.data.unlockedSkills.includes(r))) return false;
    if (skill.requiresAny && !skill.requiresAny.some(r => this.data.unlockedSkills.includes(r))) return false;
    // 互斥校验：若互斥对象已解锁，则不可解锁
    if (skill.exclusiveWith && skill.exclusiveWith.some(ex => this.data.unlockedSkills.includes(ex))) return false;
    this.data.unlockedSkills.push(skillId);
    this.save();
    return true;
  }

  /**
   * 判断某技能是否因互斥而被锁定（互斥对象已解锁）
   */
  isLockedByExclusion(skillId) {
    const skill = this._getSkillDef(skillId);
    if (!skill || !skill.exclusiveWith) return false;
    return skill.exclusiveWith.some(ex => this.data.unlockedSkills.includes(ex));
  }

  /**
   * 判断某技能的前置是否全部满足
   */
  arePrerequisitesMet(skillId) {
    const skill = this._getSkillDef(skillId);
    if (!skill) return false;
    if (skill.requires && !skill.requires.every(r => this.data.unlockedSkills.includes(r))) return false;
    if (skill.requiresAny && !skill.requiresAny.some(r => this.data.unlockedSkills.includes(r))) return false;
    return true;
  }

  // === 结局 ===
  getSeenEndings() { return this.data.seenEndings; }
  recordEnding(endingId) {
    const isNew = !this.data.seenEndings.includes(endingId);
    if (isNew) {
      this.data.seenEndings.push(endingId);
      this.save();
    }
    return isNew;
  }

  // === 游玩统计 ===
  getPlayCount() { return this.data.playCount; }
  incrementPlayCount() {
    this.data.playCount++;
    this.save();
  }
  addChoices(count) {
    this.data.totalChoices += count;
    this.save();
  }

  // === 事件图鉴 ===
  /**
   * 记录已遇到的随机事件ID（去重）
   * @param {string} eventId - 随机事件ID
   * @returns {boolean} 是否为新事件
   */
  addSeenEvent(eventId) {
    if (!eventId) return false;
    if (!Array.isArray(this.data.seenEvents)) this.data.seenEvents = [];
    if (this.data.seenEvents.includes(eventId)) return false;
    this.data.seenEvents.push(eventId);
    this.save();
    return true;
  }

  /**
   * 返回已遇到的随机事件ID数组
   * @returns {string[]}
   */
  getSeenEvents() {
    return Array.isArray(this.data.seenEvents) ? this.data.seenEvents : [];
  }

  /**
   * 返回已遇到的随机事件数量
   * @returns {number}
   */
  getSeenEventCount() {
    return this.getSeenEvents().length;
  }

  // === 技能效果查询 ===
  /**
   * 检查某类效果是否已解锁
   * @param {string} effectType - 效果类型
   * @returns {object|null} 第一个匹配的效果定义，或 null
   */
  getEffect(effectType) {
    for (const skillId of this.data.unlockedSkills) {
      const skill = this._getSkillDef(skillId);
      if (skill && skill.effect && skill.effect.type === effectType) {
        return skill.effect;
      }
    }
    return null;
  }

  /**
   * 获取所有已解锁的效果
   */
  getAllEffects() {
    const effects = [];
    for (const skillId of this.data.unlockedSkills) {
      const skill = this._getSkillDef(skillId);
      if (skill && skill.effect) effects.push(skill.effect);
    }
    return effects;
  }

  _getSkillDef(skillId) {
    return ALL_SKILLS.find(s => s.id === skillId);
  }


  // === 结局触发统计（调试用） ===
  /**
   * 获取各结局的触发次数统计
   * 数据持久化在 localStorage（key: luohammer_ending_stats）
   * @returns {Object<string, number>} { endingId: count, ... }
   */
  getEndingStats() {
    try {
      const raw = localStorage.getItem(ENDING_STATS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          return parsed;
        }
      }
    } catch (e) {}
    return {};
  }

  /**
   * 记录一次结局触发（次数 +1）
   * @param {string} endingId - 结局ID
   */
  recordEndingStat(endingId) {
    if (!endingId) return;
    const stats = this.getEndingStats();
    stats[endingId] = (stats[endingId] || 0) + 1;
    try {
      localStorage.setItem(ENDING_STATS_KEY, JSON.stringify(stats));
    } catch (e) {}
  }

  /**
   * 清空结局触发统计（调试用）
   */
  clearEndingStats() {
    try {
      localStorage.removeItem(ENDING_STATS_KEY);
    } catch (e) {}
  }

  /**
   * 重置所有进度（调试用）
   */
  reset() {
    this.data = {
      exp: 0,
      unlockedSkills: [],
      seenEndings: [],
      playCount: 0,
      totalChoices: 0,
      seenEvents: [],
      achievementScore: 0,
      claimedMilestones: [],
      claimedAchievementMilestones: [],
      titles: [],
    };
    this.save();
  }
}
