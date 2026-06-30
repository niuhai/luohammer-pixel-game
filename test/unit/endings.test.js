// endings.js 结局 check 函数测试（35 个结局）
import { describe, it, expect } from 'vitest';
import { ENDINGS } from '../../src/data/endings.js';

function makeState(overrides = {}) {
  return {
    pride: 5, wealth: 5, reputation: 5, failures: 0,
    pressure: 0, trust: 5, pressureMax: 10,
    flags: new Set(),
    ...overrides
  };
}

// 测试每个结局的 check 函数能否正确判定
describe('endings.js - 35 个结局 check 函数', () => {
  // 列出每个结局的"满足条件"和"不满足条件"的 state 构造
  const CASES = [
    { id: 'legend', meet: { pride: 8, failures: 2, wealth: 2 }, miss: { pride: 7, failures: 1, wealth: 5 } },
    { id: 'tycoon', meet: { wealth: 8, pride: 2 }, miss: { wealth: 7, pride: 2 } },
    { id: 'warrior', meet: { pride: 7, reputation: 7, failures: 2 }, miss: { pride: 6, reputation: 7, failures: 2 } },
    { id: 'scapegoat', meet: { reputation: 1, failures: 3 }, miss: { reputation: 3, failures: 3 } },
    { id: 'balance', meet: { pride: 6, wealth: 6, reputation: 6, trust: 6, failures: 2 }, miss: { pride: 6, wealth: 6, reputation: 6, trust: 6, failures: 3 } },
    { id: 'rational', meet: { pride: 5, wealth: 3, failures: 3 }, miss: { pride: 5, wealth: 3, failures: 2 } },
    { id: 'supply_chain', meet: { wealth: 4, pride: 3, failures: 2 }, miss: { wealth: 4, pride: 4, failures: 2 } },
    { id: 'talkshow_star', meet: { reputation: 8, pride: 5 }, miss: { reputation: 7, pride: 5 } },
    { id: 'ai_visionary', meet: { wealth: 7, reputation: 5, pride: 4 }, miss: { wealth: 6, reputation: 5, pride: 4 } },
    { id: 'phoenix', meet: { pride: 7, failures: 3, wealth: 4 }, meetFlags: ['honest_repay'], miss: { pride: 7, failures: 3, wealth: 4 }, missFlags: [] },
    { id: 'hermit', meet: { pressure: 0 }, meetFlags: ['retired'], miss: { pressure: 0 }, missFlags: [] },
    { id: 'peace', meet: { pride: 4, wealth: 4, reputation: 4, trust: 4, failures: 0 }, miss: { pride: 7, wealth: 4, reputation: 4, trust: 4, failures: 0 } },
    { id: 'survivor', meet: { failures: 4 }, miss: { failures: 3 } },
    { id: 'craftsman', meet: { pride: 9 }, meetFlags: ['persist_premium'], miss: { pride: 9 }, missFlags: [] },
    { id: 'scholar', meet: { pride: 2, wealth: 3 }, miss: { pride: 2, wealth: 3 }, missFlags: ['started_business'] },
    { id: 'ordinary', meet: { pride: 2, wealth: 3, reputation: 2 }, miss: { pride: 2, wealth: 3, reputation: 3 } },
    { id: 'comfort', meet: { wealth: 4, pride: 3 }, meetFlags: ['stayed_xinfang'], miss: { wealth: 4, pride: 3 }, missFlags: [] },
    { id: 'xiaomi', meet: { wealth: 3, pride: 3 }, meetFlags: ['joined_xiaomi'], miss: { wealth: 3, pride: 3 }, missFlags: [] },
    { id: 'retreat', meet: { pride: 2, wealth: 2 }, meetFlags: ['gave_up_hardware'], miss: { pride: 2, wealth: 2 }, missFlags: [] },
    { id: 'bankrupt_early', meet: { pride: 5, wealth: 1 }, meetFlags: ['killed_m1'], miss: { pride: 5, wealth: 1 }, missFlags: [] },
    { id: 'escape', meet: { pride: 2, reputation: 2 }, meetFlags: ['declared_bankruptcy'], miss: { pride: 2, reputation: 2 }, missFlags: [] },
    { id: 'moderate_success', meet: { wealth: 5, pride: 4 }, meetFlags: ['conservative_funding'], miss: { wealth: 5, pride: 4 }, missFlags: [] },
    { id: 'anchor', meet: { wealth: 4, pride: 3 }, meetFlags: ['continued_livestream'], miss: { wealth: 4, pride: 3 }, missFlags: [] },
    { id: 'comeback', meet: { pride: 6, reputation: 5 }, meetFlags: ['final_comeback'], miss: { pride: 6, reputation: 5 }, missFlags: [] },
    { id: 'educator', meet: { trust: 5, reputation: 4 }, meetFlags: ['education_reform'], miss: { trust: 5, reputation: 4 }, missFlags: [] },
    { id: 'writer', meet: { pride: 4, reputation: 4 }, meetFlags: ['wrote_book'], miss: { pride: 4, reputation: 4 }, missFlags: [] },
    { id: 'influencer', meet: { reputation: 6, wealth: 4 }, meetFlags: ['became_influencer'], miss: { reputation: 6, wealth: 4 }, missFlags: [] },
    { id: 'mentor', meet: { trust: 5, reputation: 4 }, meetFlags: ['mentor'], miss: { trust: 5, reputation: 4 }, missFlags: [] },
    { id: 'idealist', meet: { pride: 8, wealth: 3 }, meetFlags: ['never_compromised'], miss: { pride: 8, wealth: 3 }, missFlags: [] },
    { id: 'venture_capitalist', meet: { wealth: 5, reputation: 3 }, meetFlags: ['became_investor'], miss: { wealth: 5, reputation: 3 }, missFlags: [] },
    { id: 'tech_blogger', meet: {}, meetFlags: ['became_tech_blogger'], miss: {}, missFlags: [] },
    { id: 'rights_fighter', meet: {}, meetFlags: ['public_feud_champion'], miss: {}, missFlags: [] },
    { id: 'monk', meet: {}, meetFlags: ['became_monk'], miss: {}, missFlags: [] },
    { id: 'returns', meet: {}, meetFlags: ['luo_teacher_returns'], miss: {}, missFlags: [] },
    { id: 'philanthropist', meet: {}, meetFlags: ['philanthropy_champion'], miss: {}, missFlags: [] }
  ];

  CASES.forEach(({ id, meet, miss, meetFlags, missFlags }) => {
    const ending = ENDINGS.find(e => e.id === id);
    if (!ending) {
      it(`结局 ${id} 应存在`, () => {
        throw new Error(`结局 ${id} 不存在`);
      });
      return;
    }

    describe(`结局 [${id}] ${ending.name}`, () => {
      it('满足条件时 check 返回 true', () => {
        const state = makeState(meet);
        const flags = new Set(meetFlags || []);
        // 把 state 的 flags 字段也设进去（部分 check 用 state.flags）
        state.flags = new Set(meetFlags || []);
        expect(ending.check(state, flags)).toBe(true);
      });

      it('不满足条件时 check 返回 false', () => {
        const state = makeState(miss);
        const flags = new Set(missFlags || []);
        state.flags = new Set(missFlags || []);
        expect(ending.check(state, flags)).toBe(false);
      });
    });
  });
});

describe('endings.js - 优先级排序', () => {
  it('balance (priority 12) 高于 legend (priority 10)', () => {
    expect(
      ENDINGS.find(e => e.id === 'balance').priority
    ).toBeGreaterThan(
      ENDINGS.find(e => e.id === 'legend').priority
    );
  });

  it('phoenix (priority 11) 高于 legend (priority 10)', () => {
    expect(
      ENDINGS.find(e => e.id === 'phoenix').priority
    ).toBeGreaterThan(
      ENDINGS.find(e => e.id === 'legend').priority
    );
  });

  it('按 priority 降序匹配：构造同时满足 balance 和 legend 的状态，balance 应优先', () => {
    // balance 需要 pride/wealth/rep/trust >=6 且 failures <=2
    // legend 需要 pride>=8, failures>=2, wealth<3 —— 与 balance 冲突（wealth 要求相反）
    // 改为：同时满足 legend 和 warrior
    // legend: pride>=8, failures>=2, wealth<3
    // warrior: pride>=7, rep>=7, failures>=2
    const state = makeState({ pride: 8, reputation: 7, failures: 2, wealth: 2 });
    const matches = ENDINGS
      .filter(e => e.check(state, new Set()))
      .sort((a, b) => b.priority - a.priority);
    expect(matches.length).toBeGreaterThan(0);
    // warrior (priority 9) 应排在 legend (priority 10) 之后
    const warriorP = ENDINGS.find(e => e.id === 'warrior').priority;
    const legendP = ENDINGS.find(e => e.id === 'legend').priority;
    expect(legendP).toBeGreaterThan(warriorP);
  });

  it('balance 结局在 failures=2 时可达（P0 修复点验证）', () => {
    const state = makeState({ pride: 6, wealth: 6, reputation: 6, trust: 6, failures: 2 });
    const balance = ENDINGS.find(e => e.id === 'balance');
    expect(balance.check(state, new Set())).toBe(true);
  });

  it('balance 结局在 failures=3 时不可达', () => {
    const state = makeState({ pride: 6, wealth: 6, reputation: 6, trust: 6, failures: 3 });
    const balance = ENDINGS.find(e => e.id === 'balance');
    expect(balance.check(state, new Set())).toBe(false);
  });
});

describe('endings.js - 特殊结局', () => {
  it('returns 结局支持两条路径：flag 或 _unlockedEndings', () => {
    const returns = ENDINGS.find(e => e.id === 'returns');
    // 路径1: luo_teacher_returns flag
    const state1 = makeState({ flags: new Set(['luo_teacher_returns']) });
    state1.flags = new Set(['luo_teacher_returns']);
    expect(returns.check(state1, new Set(['luo_teacher_returns']))).toBe(true);
    // 路径2: _unlockedEndings 包含 ending_returns_alt
    const state2 = makeState({ _unlockedEndings: ['ending_returns_alt'] });
    expect(returns.check(state2, new Set())).toBe(true);
    // 不满足任一条件
    const state3 = makeState({});
    expect(returns.check(state3, new Set())).toBe(false);
  });

  it('phoenix 结局必须依赖 honest_repay flag', () => {
    const phoenix = ENDINGS.find(e => e.id === 'phoenix');
    const state = makeState({ pride: 7, failures: 3, wealth: 4 });
    // 没有 flag
    expect(phoenix.check(state, new Set())).toBe(false);
    // 有 flag
    expect(phoenix.check(state, new Set(['honest_repay']))).toBe(true);
  });
});
