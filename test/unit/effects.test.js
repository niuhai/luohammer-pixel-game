// effects.js 单元测试
import { describe, it, expect } from 'vitest';
import {
  applyEffects,
  checkPressureCrash,
  checkThresholdTriggers,
  checkComboTriggers,
  createInitialState,
  ATTRIBUTES
} from '../../src/data/effects.js';

// 构造一个干净的基础 state
function makeState(overrides = {}) {
  return {
    pride: 5,
    wealth: 5,
    reputation: 5,
    failures: 0,
    pressure: 0,
    trust: 5,
    pressureMax: 10,
    failurePenalty: 1,
    successBonus: 1,
    talentSpecials: [],
    flags: new Set(),
    triggeredEvents: new Set(),
    history: [],
    ...overrides
  };
}

describe('applyEffects - 基础应用', () => {
  it('正向 delta 累加到属性', () => {
    const { state, changes } = applyEffects(makeState(), { pride: 2 });
    expect(state.pride).toBe(7);
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({ attr: 'pride', delta: 2, oldValue: 5, newValue: 7 });
  });

  it('负向 delta 从属性减去', () => {
    const { state } = applyEffects(makeState(), { wealth: -3 });
    expect(state.wealth).toBe(2);
  });

  it('delta=0 跳过不产生 changes', () => {
    const { state, changes } = applyEffects(makeState(), { pride: 0 });
    expect(state.pride).toBe(5);
    expect(changes).toHaveLength(0);
  });

  it('undefined value 跳过', () => {
    const { changes } = applyEffects(makeState(), { pride: undefined });
    expect(changes).toHaveLength(0);
  });

  it('null effects 返回原 state', () => {
    const original = makeState();
    const { state, changes } = applyEffects(original, null);
    expect(state).toEqual(original);
    expect(changes).toEqual([]);
  });

  it('未知属性名跳过（不写入 state，不产生 changes）', () => {
    const { state, changes } = applyEffects(makeState(), { unknown_attr: 5 });
    expect(state.unknown_attr).toBeUndefined();
    expect(changes).toHaveLength(0);
  });
});

describe('applyEffects - 属性钳制', () => {
  it('pride 钳制到 [0, 10] 上限', () => {
    const { state } = applyEffects(makeState({ pride: 9 }), { pride: 5 });
    expect(state.pride).toBe(10);
  });

  it('pride 钳制到 [0, 10] 下限', () => {
    const { state } = applyEffects(makeState({ pride: 1 }), { pride: -5 });
    expect(state.pride).toBe(0);
  });

  it('wealth 钳制到 [0, 10]', () => {
    const { state } = applyEffects(makeState({ wealth: 0 }), { wealth: -3 });
    expect(state.wealth).toBe(0);
  });

  it('pressure 使用 pressureMax 作为上限', () => {
    const { state } = applyEffects(makeState({ pressure: 8, pressureMax: 10 }), { pressure: 5 });
    expect(state.pressure).toBe(10);
  });

  it('pressure 尊重 talent 的 pressureMax 提升', () => {
    const { state } = applyEffects(makeState({ pressure: 11, pressureMax: 15 }), { pressure: 5 });
    expect(state.pressure).toBe(15);
  });

  it('pressure 下限为 0（即使 delta 为负）', () => {
    const { state } = applyEffects(makeState({ pressure: 0 }), { pressure: -3 });
    expect(state.pressure).toBe(0);
  });

  it('failures 上限为 99（attrDef.max）', () => {
    const { state } = applyEffects(makeState({ failures: 98 }), { failures: 5 });
    expect(state.failures).toBe(99);
  });
});

describe('applyEffects - 翻身减1 机制', () => {
  it('pride delta > 2 时 failures -1', () => {
    const { state, changes } = applyEffects(
      makeState({ pride: 5, failures: 3 }),
      { pride: 3 }
    );
    expect(state.failures).toBe(2);
    expect(changes.some(c => c.attr === 'failures' && c.delta === -1)).toBe(true);
  });

  it('reputation delta > 2 时 failures -1', () => {
    const { state } = applyEffects(
      makeState({ reputation: 5, failures: 2 }),
      { reputation: 3 }
    );
    expect(state.failures).toBe(1);
  });

  it('delta = 2（边界）不触发翻身', () => {
    const { state } = applyEffects(
      makeState({ pride: 5, failures: 1 }),
      { pride: 2 }
    );
    expect(state.failures).toBe(1);
  });

  it('failures = 0 时不减到负数', () => {
    const { state } = applyEffects(
      makeState({ pride: 5, failures: 0 }),
      { pride: 5 }
    );
    expect(state.failures).toBe(0);
  });
});

describe('applyEffects - 天赋倍率 getMultiplier', () => {
  it('fans_loyalty_bonus: trust/reputation 正向翻倍', () => {
    const { state } = applyEffects(
      makeState({ talentSpecials: ['fans_loyalty_bonus'] }),
      { trust: 2, reputation: 2 }
    );
    expect(state.trust).toBe(9);   // 5 + 2*2
    expect(state.reputation).toBe(9);
  });

  it('fans_loyalty_bonus 不影响负向 delta', () => {
    const { state } = applyEffects(
      makeState({ talentSpecials: ['fans_loyalty_bonus'] }),
      { trust: -2 }
    );
    expect(state.trust).toBe(3);
  });

  it('reputation_gain_doubled: 名声正向翻倍（钳到上限 10）', () => {
    const { state } = applyEffects(
      makeState({ talentSpecials: ['reputation_gain_doubled'] }),
      { reputation: 3 }
    );
    // 5 + 3*2 = 11，钳到 10
    expect(state.reputation).toBe(10);
  });

  it('low_stats_bonus: 属性<=3 时正向加成 +1 倍率', () => {
    const { state } = applyEffects(
      makeState({ wealth: 2, talentSpecials: ['low_stats_bonus'] }),
      { wealth: 2 }
    );
    // 2 + 2*(1+1) = 6
    expect(state.wealth).toBe(6);
  });

  it('low_stats_bonus: 属性 > 3 时不触发', () => {
    const { state } = applyEffects(
      makeState({ wealth: 5, talentSpecials: ['low_stats_bonus'] }),
      { wealth: 2 }
    );
    expect(state.wealth).toBe(7);
  });

  it('high_risk_high_reward: |delta|>=2 时翻倍（正向）', () => {
    const { state } = applyEffects(
      makeState({ talentSpecials: ['high_risk_high_reward'] }),
      { pride: 2 }
    );
    expect(state.pride).toBe(9); // 5 + 2*2
  });

  it('high_risk_high_reward: |delta|>=2 时翻倍（负向）', () => {
    const { state } = applyEffects(
      makeState({ talentSpecials: ['high_risk_high_reward'] }),
      { wealth: -2 }
    );
    expect(state.wealth).toBe(1); // 5 - 2*2
  });

  it('high_risk_high_reward: |delta|<2 不触发', () => {
    const { state } = applyEffects(
      makeState({ talentSpecials: ['high_risk_high_reward'] }),
      { pride: 1 }
    );
    expect(state.pride).toBe(6);
  });

  it('debt_reduction_bonus: wealth 负值消耗减半', () => {
    const { state } = applyEffects(
      makeState({ talentSpecials: ['debt_reduction_bonus'] }),
      { wealth: -4 }
    );
    // 5 + (-4)*0.5 = 3
    expect(state.wealth).toBe(3);
  });

  it('reality_distortion_field: 正面效果 +15%', () => {
    const { state } = applyEffects(
      makeState({ talentSpecials: ['reality_distortion_field'] }),
      { pride: 10 }
    );
    // 5 + round(10 * 1.15) = 5 + 12 = 17 → 钳到 10
    expect(state.pride).toBe(10);
  });

  it('all_choices_bonus: 所有正向 +1 倍率', () => {
    const { state } = applyEffects(
      makeState({ talentSpecials: ['all_choices_bonus'] }),
      { pride: 2 }
    );
    // 5 + 2*(1+1) = 9
    expect(state.pride).toBe(9);
  });

  it('titan_heart_effect: 压力>=6 时 pride 正向加成', () => {
    const { state } = applyEffects(
      makeState({ pressure: 6, talentSpecials: ['titan_heart_effect'] }),
      { pride: 2 }
    );
    // 5 + 2*(1+1) = 9
    expect(state.pride).toBe(9);
  });

  it('titan_heart_effect: 压力>=8 时加成更大', () => {
    const { state } = applyEffects(
      makeState({ pressure: 8, talentSpecials: ['titan_heart_effect'] }),
      { pride: 2 }
    );
    // 5 + 2*(1+1+1) = 11 → 钳到 10
    expect(state.pride).toBe(10);
  });

  it('pressure_gain_halved: 压力正向 delta 减半', () => {
    const { state } = applyEffects(
      makeState({ pressure: 0, talentSpecials: ['pressure_gain_halved'] }),
      { pressure: 4 }
    );
    // 0 + 4*0.5 = 2
    expect(state.pressure).toBe(2);
  });

  it('pressure_gain_halved: 不影响压力负向 delta（恢复不翻倍）', () => {
    const { state } = applyEffects(
      makeState({ pressure: 6, talentSpecials: ['pressure_gain_halved'] }),
      { pressure: -2 }
    );
    // 6 + (-2)*1 = 4（减半只对正向生效）
    expect(state.pressure).toBe(4);
  });
});

describe('applyEffects - 天赋 passive（applySpecialPassives）', () => {
  it('failure_heals_pride: failures 增加时 pride +1', () => {
    const { state } = applyEffects(
      makeState({ pride: 5, talentSpecials: ['failure_heals_pride'] }),
      { failures: 1 }
    );
    expect(state.pride).toBe(6);
  });

  it('failure_heals_pride 不在 failures 未增加时触发', () => {
    const { state } = applyEffects(
      makeState({ pride: 5, talentSpecials: ['failure_heals_pride'] }),
      { pride: 1 }
    );
    expect(state.pride).toBe(6); // 只 +1 来自 pride delta
  });

  it('failure_wealth_bonus: failures 增加时 wealth +1', () => {
    const { state } = applyEffects(
      makeState({ wealth: 5, talentSpecials: ['failure_wealth_bonus'] }),
      { failures: 1 }
    );
    expect(state.wealth).toBe(6);
  });

  it('passive 钳制到上限 10', () => {
    const { state } = applyEffects(
      makeState({ pride: 10, talentSpecials: ['failure_heals_pride'] }),
      { failures: 1 }
    );
    expect(state.pride).toBe(10);
  });
});

describe('checkPressureCrash', () => {
  it('压力达到上限时触发崩溃事件', () => {
    const event = checkPressureCrash(makeState({ pressure: 10, pressureMax: 10 }));
    expect(event).not.toBeNull();
    expect(event.id).toBe('pressure_crash');
    expect(event.choices.length).toBeGreaterThanOrEqual(2);
  });

  it('压力未到上限不触发', () => {
    const event = checkPressureCrash(makeState({ pressure: 9, pressureMax: 10 }));
    expect(event).toBeNull();
  });

  it('pressure_crash_halved: 损失减半版事件', () => {
    const event = checkPressureCrash(
      makeState({ pressure: 10, pressureMax: 10, talentSpecials: ['pressure_crash_halved'] })
    );
    expect(event).not.toBeNull();
    // 减半版的第一个选项 pride 仅 -1（原版 -2）
    expect(event.choices[0].effects.pride).toBe(-1);
  });

  it('尊重自定义 pressureMax', () => {
    const event = checkPressureCrash(makeState({ pressure: 12, pressureMax: 15 }));
    expect(event).toBeNull();
  });
});

describe('createInitialState', () => {
  it('默认初始值正确', () => {
    const s = createInitialState();
    expect(s.pride).toBe(5);
    expect(s.wealth).toBe(5);
    expect(s.reputation).toBe(5);
    expect(s.failures).toBe(0);
    expect(s.pressure).toBe(0);
    expect(s.trust).toBe(5);
    expect(s.pressureMax).toBe(10);
    expect(s.currentNode).toBe('intro');
    expect(s.flags).toBeInstanceOf(Set);
  });

  it('应用天赋 effects（钳制）', () => {
    const s = createInitialState({ pride: 10 });
    expect(s.pride).toBe(10);
  });

  it('天赋 effects 超出上限钳制', () => {
    const s = createInitialState({ pride: 100 });
    expect(s.pride).toBe(10);
  });
});

describe('ATTRIBUTES 定义一致性', () => {
  it('所有属性有 min/max', () => {
    for (const [key, def] of Object.entries(ATTRIBUTES)) {
      expect(def.min, `${key}.min 应存在`).toBeDefined();
      expect(def.max, `${key}.max 应存在`).toBeDefined();
      expect(def.min).toBeLessThanOrEqual(def.max);
    }
  });

  it('failures 范围是 0~99', () => {
    expect(ATTRIBUTES.failures.min).toBe(0);
    expect(ATTRIBUTES.failures.max).toBe(99);
  });
});
