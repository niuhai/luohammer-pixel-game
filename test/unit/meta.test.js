// MetaProgression 跨周目进度系统测试（mock localStorage）
import { describe, it, expect, beforeEach } from 'vitest';
import { MetaProgression, MILESTONE_REWARDS, ACHIEVEMENT_MILESTONES } from '../../src/systems/MetaProgression.js';

beforeEach(() => {
  localStorage.clear();
});

describe('MetaProgression - 经验点数', () => {
  it('初始经验为 0', () => {
    const meta = new MetaProgression();
    expect(meta.getExp()).toBe(0);
  });

  it('addExp 累加经验', () => {
    const meta = new MetaProgression();
    meta.addExp(5);
    meta.addExp(3);
    expect(meta.getExp()).toBe(8);
  });

  it('spendExp 余额足够返回 true 并扣减', () => {
    const meta = new MetaProgression();
    meta.addExp(10);
    const ok = meta.spendExp(4);
    expect(ok).toBe(true);
    expect(meta.getExp()).toBe(6);
  });

  it('spendExp 余额不足返回 false 不扣减', () => {
    const meta = new MetaProgression();
    meta.addExp(3);
    const ok = meta.spendExp(5);
    expect(ok).toBe(false);
    expect(meta.getExp()).toBe(3);
  });

  it('addExp(0) 不报错', () => {
    const meta = new MetaProgression();
    meta.addExp(0);
    expect(meta.getExp()).toBe(0);
  });

  it('经验持久化到 localStorage', () => {
    const meta1 = new MetaProgression();
    meta1.addExp(7);
    const meta2 = new MetaProgression();
    expect(meta2.getExp()).toBe(7);
  });
});

describe('MetaProgression - 技能解锁', () => {
  it('初始无技能', () => {
    const meta = new MetaProgression();
    expect(meta.getUnlockedSkills()).toEqual([]);
    expect(meta.isSkillUnlocked('tough_mind')).toBe(false);
  });

  it('unlockSkill 解锁根节点（无前置）', () => {
    const meta = new MetaProgression();
    const ok = meta.unlockSkill('tough_mind');
    expect(ok).toBe(true);
    expect(meta.isSkillUnlocked('tough_mind')).toBe(true);
  });

  it('unlockSkill 重复解锁返回 false', () => {
    const meta = new MetaProgression();
    meta.unlockSkill('tough_mind');
    const ok = meta.unlockSkill('tough_mind');
    expect(ok).toBe(false);
  });

  it('unlockSkill 前置未满足返回 false', () => {
    const meta = new MetaProgression();
    // iron_will requires tough_mind
    const ok = meta.unlockSkill('iron_will');
    expect(ok).toBe(false);
  });

  it('unlockSkill 前置满足后可解锁', () => {
    const meta = new MetaProgression();
    meta.unlockSkill('tough_mind');
    const ok = meta.unlockSkill('iron_will');
    expect(ok).toBe(true);
  });

  it('unlockSkill 互斥校验：A 已解锁则 B 不可解锁', () => {
    const meta = new MetaProgression();
    // 解锁前置链
    meta.unlockSkill('tough_mind');
    meta.unlockSkill('iron_will');
    meta.unlockSkill('phoenix');
    // 解锁分支 A
    meta.unlockSkill('survival_instinct');
    expect(meta.isSkillUnlocked('survival_instinct')).toBe(true);
    // 分支 B 应被互斥锁定
    const ok = meta.unlockSkill('mountain_calm');
    expect(ok).toBe(false);
  });

  it('unlockSkill requiresAny 满足任一即可', () => {
    const meta = new MetaProgression();
    // undying_phoenix requiresAny: survival_instinct | mountain_calm
    meta.unlockSkill('tough_mind');
    meta.unlockSkill('iron_will');
    meta.unlockSkill('phoenix');
    meta.unlockSkill('mountain_calm');
    const ok = meta.unlockSkill('undying_phoenix');
    expect(ok).toBe(true);
  });

  it('isLockedByExclusion: 互斥对象已解锁时返回 true', () => {
    const meta = new MetaProgression();
    meta.unlockSkill('tough_mind');
    meta.unlockSkill('iron_will');
    meta.unlockSkill('phoenix');
    meta.unlockSkill('survival_instinct');
    expect(meta.isLockedByExclusion('mountain_calm')).toBe(true);
  });

  it('arePrerequisitesMet: 前置全满足返回 true', () => {
    const meta = new MetaProgression();
    meta.unlockSkill('tough_mind');
    expect(meta.arePrerequisitesMet('iron_will')).toBe(true);
  });

  it('arePrerequisitesMet: 前置未满足返回 false', () => {
    const meta = new MetaProgression();
    expect(meta.arePrerequisitesMet('iron_will')).toBe(false);
  });

  it('未知 skillId 解锁返回 false', () => {
    const meta = new MetaProgression();
    expect(meta.unlockSkill('non_existent_skill')).toBe(false);
  });
});

describe('MetaProgression - 结局记录', () => {
  it('recordEnding 新结局返回 true', () => {
    const meta = new MetaProgression();
    const isNew = meta.recordEnding('legend');
    expect(isNew).toBe(true);
  });

  it('recordEnding 重复结局返回 false', () => {
    const meta = new MetaProgression();
    meta.recordEnding('legend');
    const isNew = meta.recordEnding('legend');
    expect(isNew).toBe(false);
  });

  it('getSeenEndings 返回已见结局列表', () => {
    const meta = new MetaProgression();
    meta.recordEnding('legend');
    meta.recordEnding('phoenix');
    expect(meta.getSeenEndings()).toEqual(['legend', 'phoenix']);
  });

  it('结局记录持久化', () => {
    const meta1 = new MetaProgression();
    meta1.recordEnding('legend');
    const meta2 = new MetaProgression();
    expect(meta2.getSeenEndings()).toEqual(['legend']);
  });
});

describe('MetaProgression - 游玩统计', () => {
  it('初始 playCount=0', () => {
    const meta = new MetaProgression();
    expect(meta.getPlayCount()).toBe(0);
  });

  it('incrementPlayCount 累加', () => {
    const meta = new MetaProgression();
    meta.incrementPlayCount();
    meta.incrementPlayCount();
    expect(meta.getPlayCount()).toBe(2);
  });

  it('addChoices 累加', () => {
    const meta = new MetaProgression();
    meta.addChoices(5);
    meta.addChoices(3);
    expect(meta.data.totalChoices).toBe(8);
  });
});

describe('MetaProgression - 成就积分', () => {
  it('初始积分 0', () => {
    const meta = new MetaProgression();
    expect(meta.getAchievementScore()).toBe(0);
  });

  it('addAchievementScore 累加', () => {
    const meta = new MetaProgression();
    meta.addAchievementScore(10);
    meta.addAchievementScore(5);
    expect(meta.getAchievementScore()).toBe(15);
  });

  it('addAchievementScore(0) 不变', () => {
    const meta = new MetaProgression();
    meta.addAchievementScore(0);
    expect(meta.getAchievementScore()).toBe(0);
  });
});

describe('MetaProgression - 里程碑奖励（效果型）', () => {
  it('未达阈值返回 null', () => {
    const meta = new MetaProgression();
    const result = meta.checkMilestoneRewards(5);
    expect(result).toBeNull();
  });

  it('达到 10 解锁 milestone_10', () => {
    const meta = new MetaProgression();
    const result = meta.checkMilestoneRewards(10);
    expect(result).not.toBeNull();
    expect(result.id).toBe('milestone_10');
  });

  it('达到 20 返回最高里程碑 milestone_20', () => {
    const meta = new MetaProgression();
    const result = meta.checkMilestoneRewards(25);
    expect(result.id).toBe('milestone_20');
  });

  it('不重复触发同一里程碑', () => {
    const meta = new MetaProgression();
    meta.checkMilestoneRewards(10);
    // 再次调用相同成就数，不应重复触发
    const before = meta.data.claimedMilestones.length;
    meta.checkMilestoneRewards(10);
    expect(meta.data.claimedMilestones.length).toBe(before);
  });

  it('isMilestoneClaimed 正确查询', () => {
    const meta = new MetaProgression();
    meta.checkMilestoneRewards(10);
    expect(meta.isMilestoneClaimed('milestone_10')).toBe(true);
    expect(meta.isMilestoneClaimed('milestone_20')).toBe(false);
  });
});

describe('MetaProgression - 成就里程碑（经验奖励型）', () => {
  it('达到 10 个成就奖励 2 点经验', () => {
    const meta = new MetaProgression();
    const triggered = meta.checkAchievementMilestones(10);
    expect(triggered.length).toBe(1);
    expect(triggered[0].id).toBe('ach_ms_10');
    expect(triggered[0].exp).toBe(2);
    expect(meta.getExp()).toBe(2);
  });

  it('达到 30 个成就奖励 5 点经验 + 解锁 achievement_hunter 天赋', () => {
    const meta = new MetaProgression();
    const triggered = meta.checkAchievementMilestones(30);
    const ms30 = triggered.find(t => t.id === 'ach_ms_30');
    expect(ms30).toBeDefined();
    expect(ms30.exp).toBe(5);
    expect(meta.isSkillUnlocked('achievement_hunter')).toBe(true);
  });

  it('达到 50 个成就奖励 10 点经验 + 称号', () => {
    const meta = new MetaProgression();
    const triggered = meta.checkAchievementMilestones(50);
    const ms50 = triggered.find(t => t.id === 'ach_ms_50');
    expect(ms50).toBeDefined();
    expect(ms50.title).toBe('收集大师');
    expect(meta.getTitles()).toContain('收集大师');
  });

  it('不重复触发同一里程碑', () => {
    const meta = new MetaProgression();
    meta.checkAchievementMilestones(10);
    const triggered = meta.checkAchievementMilestones(10);
    expect(triggered).toEqual([]);
  });

  it('跨多阈值一次性触发多个', () => {
    const meta = new MetaProgression();
    const triggered = meta.checkAchievementMilestones(50);
    expect(triggered.length).toBe(4); // 10/20/30/50
  });

  it('非数字参数返回空数组', () => {
    const meta = new MetaProgression();
    expect(meta.checkAchievementMilestones('abc')).toEqual([]);
    expect(meta.checkAchievementMilestones(undefined)).toEqual([]);
  });
});

describe('MetaProgression - 事件图鉴', () => {
  it('addSeenEvent 新事件返回 true', () => {
    const meta = new MetaProgression();
    expect(meta.addSeenEvent('event_1')).toBe(true);
  });

  it('addSeenEvent 重复事件返回 false', () => {
    const meta = new MetaProgression();
    meta.addSeenEvent('event_1');
    expect(meta.addSeenEvent('event_1')).toBe(false);
  });

  it('addSeenEvent(null) 返回 false', () => {
    const meta = new MetaProgression();
    expect(meta.addSeenEvent(null)).toBe(false);
    expect(meta.addSeenEvent('')).toBe(false);
  });

  it('getSeenEventCount 返回数量', () => {
    const meta = new MetaProgression();
    meta.addSeenEvent('a');
    meta.addSeenEvent('b');
    meta.addSeenEvent('c');
    expect(meta.getSeenEventCount()).toBe(3);
  });
});

describe('MetaProgression - reset', () => {
  it('reset 清空所有数据', () => {
    const meta = new MetaProgression();
    meta.addExp(10);
    meta.unlockSkill('tough_mind');
    meta.recordEnding('legend');
    meta.incrementPlayCount();
    meta.addAchievementScore(5);

    meta.reset();

    expect(meta.getExp()).toBe(0);
    expect(meta.getUnlockedSkills()).toEqual([]);
    expect(meta.getSeenEndings()).toEqual([]);
    expect(meta.getPlayCount()).toBe(0);
    expect(meta.getAchievementScore()).toBe(0);
  });
});
