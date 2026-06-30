// checkThresholdTriggers 阈值触发器测试（16 个触发器）
import { describe, it, expect } from 'vitest';
import { checkThresholdTriggers } from '../../src/data/effects.js';

function makeState(overrides = {}) {
  return {
    pride: 5, wealth: 5, reputation: 5, failures: 0,
    pressure: 0, trust: 5, pressureMax: 10,
    ...overrides
  };
}

// 描述每个触发器的触发条件
const TRIGGERS = [
  { id: 'born_proud', flag: 'born_proud_triggered', condition: s => s.pride >= 9, setup: { pride: 9 } },
  { id: 'peoples_luo', flag: 'peoples_luo_triggered', condition: s => s.trust >= 9, setup: { trust: 9 } },
  { id: 'penniless', flag: 'penniless_triggered', condition: s => s.wealth <= 0, setup: { wealth: 0 } },
  { id: 'deadbeat', flag: 'deadbeat_triggered', condition: s => (s.failures || 0) >= 3, setup: { failures: 3 } },
  { id: 'famous', flag: 'famous_triggered', condition: s => s.reputation >= 9, setup: { reputation: 9 } },
  { id: 'realist', flag: 'realist_triggered', condition: s => s.pride <= 1, setup: { pride: 1 } },
  { id: 'distrusted', flag: 'distrusted_triggered', condition: s => s.trust <= 1, setup: { trust: 1 } },
  { id: 'anxiety', flag: 'anxiety_triggered', condition: s => s.pressure >= 6, setup: { pressure: 6 } },
  { id: 'rich', flag: 'rich_triggered', condition: s => s.wealth >= 9, setup: { wealth: 9 } },
  { id: 'indomitable', flag: 'indomitable_triggered', condition: s => (s.failures || 0) >= 5, setup: { failures: 5 } },
  { id: 'moderate', flag: 'moderate_triggered', condition: s =>
      s.pride >= 4 && s.pride <= 6 && s.wealth >= 4 && s.wealth <= 6 &&
      s.reputation >= 4 && s.reputation <= 6 && (s.failures || 0) <= 1,
    setup: { pride: 5, wealth: 5, reputation: 5, failures: 0 },
    // 默认 state (5,5,5,0) 也满足 moderate，需要更极端的状态作为 miss
    miss: { pride: 7, wealth: 5, reputation: 5, failures: 0 } },
  { id: 'opinion_leader', flag: 'opinion_leader_triggered', condition: s =>
      s.pride >= 7 && s.reputation >= 7, setup: { pride: 7, reputation: 7 } },
  // P2-5 新增的 4 个跨属性触发器
  { id: 'stress_erosion_trust', flag: 'stress_erosion_trust_triggered',
    condition: s => s.pressure >= 7 && s.trust >= 5, setup: { pressure: 7, trust: 5 } },
  { id: 'wealth_buy_fame', flag: 'wealth_buy_fame_triggered',
    condition: s => s.wealth >= 8 && s.reputation < 6, setup: { wealth: 8, reputation: 5 } },
  { id: 'crack_ideal', flag: 'crack_ideal_triggered',
    condition: s => (s.failures || 0) >= 3 && s.pride >= 7, setup: { failures: 3, pride: 7 } },
  { id: 'friend_bailout', flag: 'friend_bailout_triggered',
    condition: s => s.trust >= 8 && (s.failures || 0) >= 2, setup: { trust: 8, failures: 2 } }
];

describe('checkThresholdTriggers - 单触发器行为', () => {
  TRIGGERS.forEach(({ id, flag, setup, miss }) => {
    describe(`触发器 [${id}]`, () => {
      it('满足条件时触发', () => {
        const triggers = checkThresholdTriggers(makeState(setup), new Set());
        const found = triggers.find(t => t.id === id);
        expect(found, `应触发 ${id}`).toBeDefined();
        expect(found.flag).toBe(flag);
        expect(found.effects, `${id} 应有 effects`).toBeTypeOf('object');
        expect(found.text, `${id} 应有 text`).toBeTruthy();
      });

      it('flag 已存在时不重复触发', () => {
        const triggers = checkThresholdTriggers(
          makeState(setup),
          new Set([flag])
        );
        const found = triggers.find(t => t.id === id);
        expect(found, `${id} 不应重复触发`).toBeUndefined();
      });

      it('不满足条件时不触发', () => {
        // 用 miss 字段（如有）或默认 state，验证不触发
        const missState = miss ? makeState(miss) : makeState();
        const triggers = checkThresholdTriggers(missState, new Set());
        const found = triggers.find(t => t.id === id);
        expect(found, `${id} 不应在 miss 条件触发`).toBeUndefined();
      });
    });
  });
});

describe('checkThresholdTriggers - 边界值', () => {
  it('born_proud 在 pride=8 时不触发（边界 9）', () => {
    const triggers = checkThresholdTriggers(makeState({ pride: 8 }), new Set());
    expect(triggers.find(t => t.id === 'born_proud')).toBeUndefined();
  });

  it('born_proud 在 pride=9 时触发', () => {
    const triggers = checkThresholdTriggers(makeState({ pride: 9 }), new Set());
    expect(triggers.find(t => t.id === 'born_proud')).toBeDefined();
  });

  it('realist 在 pride=2 时不触发（边界 1）', () => {
    const triggers = checkThresholdTriggers(makeState({ pride: 2 }), new Set());
    expect(triggers.find(t => t.id === 'realist')).toBeUndefined();
  });

  it('realist 在 pride=1 时触发', () => {
    const triggers = checkThresholdTriggers(makeState({ pride: 1 }), new Set());
    expect(triggers.find(t => t.id === 'realist')).toBeDefined();
  });
});

describe('checkThresholdTriggers - 多触发器同时满足', () => {
  it('多个条件满足时全部返回', () => {
    // 构造一个高 pride + 高 reputation + 高 failures 的 state
    const triggers = checkThresholdTriggers(
      makeState({ pride: 9, reputation: 9, failures: 5, pressure: 8 }),
      new Set()
    );
    const ids = triggers.map(t => t.id);
    // 至少应触发 born_proud、famous、indomitable、anxiety
    expect(ids).toContain('born_proud');
    expect(ids).toContain('famous');
    expect(ids).toContain('indomitable');
    expect(ids).toContain('anxiety');
  });

  it('返回的 flag 各不相同', () => {
    const triggers = checkThresholdTriggers(
      makeState({ pride: 9, reputation: 9, failures: 5, pressure: 8 }),
      new Set()
    );
    const flags = triggers.map(t => t.flag);
    const uniqueFlags = new Set(flags);
    expect(uniqueFlags.size).toBe(flags.length);
  });
});

describe('checkThresholdTriggers - P2-5 新增跨属性触发器', () => {
  it('stress_erosion_trust: 压力>=7 但信任<5 不触发', () => {
    const triggers = checkThresholdTriggers(
      makeState({ pressure: 7, trust: 4 }),
      new Set()
    );
    expect(triggers.find(t => t.id === 'stress_erosion_trust')).toBeUndefined();
  });

  it('wealth_buy_fame: 财富>=8 但名声>=6 不触发', () => {
    const triggers = checkThresholdTriggers(
      makeState({ wealth: 8, reputation: 6 }),
      new Set()
    );
    expect(triggers.find(t => t.id === 'wealth_buy_fame')).toBeUndefined();
  });

  it('crack_ideal: 翻车<3 不触发（即使理想高）', () => {
    const triggers = checkThresholdTriggers(
      makeState({ failures: 2, pride: 7 }),
      new Set()
    );
    expect(triggers.find(t => t.id === 'crack_ideal')).toBeUndefined();
  });

  it('friend_bailout: 信任<8 不触发（即使翻车高）', () => {
    const triggers = checkThresholdTriggers(
      makeState({ trust: 7, failures: 3 }),
      new Set()
    );
    expect(triggers.find(t => t.id === 'friend_bailout')).toBeUndefined();
  });

  it('friend_bailout: effects 应减少 failures', () => {
    const triggers = checkThresholdTriggers(
      makeState({ trust: 8, failures: 3 }),
      new Set()
    );
    const bail = triggers.find(t => t.id === 'friend_bailout');
    expect(bail.effects.failures).toBeLessThan(0);
  });
});
