import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ACHIEVEMENT_HUNTER_MAX_BONUSES,
  TALENTS,
  applyAchievementHunterBonus,
  drawTalents,
  getTalentCombination
} from '../../src/data/talents.js';

afterEach(() => {
  vi.restoreAllMocks();
});

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

describe('五选二抽取规则', () => {
  it('默认抽取 5 张、卡牌唯一并保底至少 1 张稀有', () => {
    const hand = drawTalents(undefined, { guaranteeRare: true });
    expect(hand).toHaveLength(5);
    expect(new Set(hand.map(talent => talent.id)).size).toBe(5);
    expect(hand.some(talent => talent.rarity === 'rare')).toBe(true);
  });

  it('成就猎人在解锁前不进入池，解锁后才进入', () => {
    const lockedPool = drawTalents(TALENTS.length, {
      unlockedTalentIds: []
    });
    const unlockedPool = drawTalents(TALENTS.length, {
      unlockedTalentIds: ['achievement_hunter']
    });

    expect(lockedPool.some(talent => talent.id === 'achievement_hunter')).toBe(false);
    expect(unlockedPool.some(talent => talent.id === 'achievement_hunter')).toBe(true);
  });

  it('60/30/10 权重按稀有度分类选择', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.7);
    expect(drawTalents(1)[0].rarity).toBe('rare');
  });

  it('同一手牌避免重复 special 家族', () => {
    for (let i = 0; i < 100; i++) {
      const specials = drawTalents(5, { guaranteeRare: true })
        .map(talent => talent.special)
        .filter(Boolean);
      expect(new Set(specials).size).toBe(specials.length);
    }
  });

  it('guaranteeTalentIds 必现在池天赋且不占重复槽（多周目保底时间旅者）', () => {
    for (let i = 0; i < 50; i++) {
      const hand = drawTalents(5, { guaranteeRare: true, guaranteeTalentIds: ['time_traveler'] });
      expect(hand).toHaveLength(5);
      expect(hand.filter(talent => talent.id === 'time_traveler')).toHaveLength(1);
      expect(new Set(hand.map(talent => talent.id)).size).toBe(5);
    }
  });

  it('guaranteeTalentIds 对不在池中的天赋静默跳过', () => {
    // achievement_hunter 未解锁时不在池，保底不应凭空造牌
    const hand = drawTalents(5, { guaranteeTalentIds: ['achievement_hunter', 'time_traveler'] });
    expect(hand).toHaveLength(5);
    expect(hand.some(talent => talent.id === 'achievement_hunter')).toBe(false);
    expect(hand.some(talent => talent.id === 'time_traveler')).toBe(true);
  });

  it('两张天赋生成可分享的人生底色', () => {
    const business = TALENTS.find(talent => talent.id === 'business_sense');
    const ideal = TALENTS.find(talent => talent.id === 'dreamer');
    const combo = getTalentCombination([business, ideal]);

    expect(combo.title).toBe('理想与面包');
    expect(combo.desc).toContain('商业嗅觉 × 理想主义者');
  });
});
