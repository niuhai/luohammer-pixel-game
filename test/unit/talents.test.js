import { describe, expect, it } from 'vitest';
import {
  ACHIEVEMENT_HUNTER_MAX_BONUSES,
  applyAchievementHunterBonus
} from '../../src/data/talents.js';

function createState(overrides = {}) {
  return {
    pride: 5,
    wealth: 5,
    reputation: 5,
    trust: 5,
    talentSpecials: ['achievement_hunter_bonus'],
    ...overrides
  };
}

describe('成就猎人天赋', () => {
  it('没有选择成就猎人时不改变状态', () => {
    const state = createState({ talentSpecials: [] });
    const result = applyAchievementHunterBonus(state);

    expect(result.applied).toBe(false);
    expect(result.state).toBe(state);
  });

  it('每次解锁成就时提升当前最低的基础属性', () => {
    const result = applyAchievementHunterBonus(createState({
      pride: 8,
      wealth: 2,
      reputation: 6,
      trust: 4
    }));

    expect(result.applied).toBe(true);
    expect(result.attr).toBe('wealth');
    expect(result.attrName).toBe('财富');
    expect(result.state.wealth).toBe(3);
    expect(result.state.achievementHunterBonusCount).toBe(1);
  });

  it('同值时按稳定顺序轮换到下一项最低属性', () => {
    const first = applyAchievementHunterBonus(createState());
    const second = applyAchievementHunterBonus(first.state);

    expect(first.attr).toBe('pride');
    expect(second.attr).toBe('wealth');
    expect(second.state.achievementHunterBonusCount).toBe(2);
  });

  it('基础属性均满值时不再浪费触发次数', () => {
    const state = createState({ pride: 10, wealth: 10, reputation: 10, trust: 10 });
    const result = applyAchievementHunterBonus(state);

    expect(result.applied).toBe(false);
    expect(result.state).toBe(state);
    expect(result.state.achievementHunterBonusCount).toBeUndefined();
  });

  it('达到五次上限后不再修改属性', () => {
    const state = createState({
      pride: 4,
      achievementHunterBonusCount: ACHIEVEMENT_HUNTER_MAX_BONUSES
    });
    const result = applyAchievementHunterBonus(state);

    expect(result.applied).toBe(false);
    expect(result.state).toBe(state);
    expect(result.state.pride).toBe(4);
  });
});
