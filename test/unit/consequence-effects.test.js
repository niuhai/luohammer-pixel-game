import { describe, expect, it } from 'vitest';
import {
  checkComboTriggers,
  checkFlagConsequences
} from '../../src/data/effects.js';

const COMBO_CASES = [
  {
    id: 'combo_idealist_rich',
    state: { pride: 8, wealth: 8, reputation: 5, trust: 5, failures: 0, pressure: 0 }
  },
  {
    id: 'combo_dark_moment',
    state: { pride: 2, wealth: 5, reputation: 5, trust: 5, failures: 3, pressure: 0 }
  },
  {
    id: 'combo_charismatic_leader',
    state: { pride: 5, wealth: 5, reputation: 8, trust: 8, failures: 0, pressure: 0 }
  },
  {
    id: 'combo_underdog_rise',
    state: { pride: 7, wealth: 2, reputation: 5, trust: 5, failures: 0, pressure: 0 }
  },
  {
    id: 'combo_pressure_explosion',
    state: { pride: 7, wealth: 5, reputation: 5, trust: 5, failures: 0, pressure: 8 }
  }
];

const CONSEQUENCE_FLAGS_BY_STAGE = {
  youth: ['bookworm', 'fighter', 'dropout'],
  teacher: ['corrupt', 'influencer', 'stayed_xinfang', 'education_reform'],
  startup: [
    'all_in',
    'sued_big_tech',
    'public_feud',
    'joined_xiaomi',
    'started_business',
    'gave_up_hardware',
    'persist_premium',
    'never_compromised',
    'killed_m1',
    'conservative_funding'
  ],
  dark: ['honest_repay', 'declared_bankruptcy', 'became_investor'],
  repay: [
    'sold_out',
    'honest_repay',
    'banned_fight',
    'wrote_book',
    'became_influencer',
    'continued_livestream',
    'retired'
  ],
  reborn: ['mentor', 'sold_name', 'ai_believer', 'comeback_attempt', 'final_comeback']
};

describe('属性联动与远期后果展示元数据', () => {
  it.each(COMBO_CASES)('$id 返回可解释的成立条件和叙事', ({ id, state }) => {
    const otherComboIds = COMBO_CASES
      .map(item => item.id)
      .filter(comboId => comboId !== id);
    const result = checkComboTriggers({
      ...state,
      flags: new Set(otherComboIds)
    });

    expect(result.id).toBe(id);
    expect(result.title).toBeTruthy();
    expect(result.text).toBeTruthy();
    expect(result.cause).toBeTypeOf('string');
    expect(result.cause).toMatch(/[≤≥]/);
    expect(result.effects).toBeTypeOf('object');
  });

  it('所有 32 个跨阶段后果都返回来源、标题和兑现阶段', () => {
    const consequences = Object.entries(CONSEQUENCE_FLAGS_BY_STAGE)
      .flatMap(([stageId, flags]) => checkFlagConsequences(stageId, new Set(flags)));

    expect(consequences).toHaveLength(32);
    for (const consequence of consequences) {
      expect(consequence.title, consequence.id).toBeTruthy();
      expect(consequence.sourceFlag, consequence.id).toBeTruthy();
      expect(consequence.sourceLabel, consequence.id).toBeTruthy();
      expect(consequence.cause, consequence.id).toContain('源自先前选择');
      expect(consequence.cause, consequence.id).toContain('兑现');
      expect(consequence.effects, consequence.id).toBeTypeOf('object');
    }
  });

  it('同一还债承诺在不同阶段保留同一来源、使用不同回响标题', () => {
    const darkEcho = checkFlagConsequences('dark', new Set(['honest_repay']))
      .find(item => item.id === 'honest_repay_dark_consequence');
    const repayEcho = checkFlagConsequences('repay', new Set(['honest_repay']))
      .find(item => item.id === 'honest_repay_consequence');

    expect(darkEcho.sourceFlag).toBe('honest_repay');
    expect(repayEcho.sourceFlag).toBe('honest_repay');
    expect(darkEcho.sourceLabel).toBe(repayEcho.sourceLabel);
    expect(darkEcho.title).not.toBe(repayEcho.title);
    expect(darkEcho.cause).toContain('低谷阶段');
    expect(repayEcho.cause).toContain('还债阶段');
  });
});
