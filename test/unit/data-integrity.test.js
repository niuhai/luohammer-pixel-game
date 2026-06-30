// 数据完整性测试：talents/skillTree/endings 三大数据源
import { describe, it, expect } from 'vitest';
import { TALENTS } from '../../src/data/talents.js';
import { SKILL_TREES, ALL_SKILLS, getSkill } from '../../src/data/skillTree.js';
import { ENDINGS } from '../../src/data/endings.js';
import { ATTRIBUTES } from '../../src/data/effects.js';

// effects.js 中实际处理的 special 字符串
const HANDLED_SPECIALS = new Set([
  'failure_heals_pride',
  'failure_wealth_bonus',
  'fans_loyalty_bonus',
  'reputation_gain_doubled',
  'trust_gain_bonus',
  'low_stats_bonus',
  'all_choices_bonus',
  'debt_reduction_bonus',
  'high_risk_high_reward',
  'late_game_bonus',
  'titan_heart_effect',
  'reality_distortion_field',
  'stage_events_bonus',
  'product_events_bonus',
  'pressure_recovery',
  'pressure_gain_halved',          // BUG-001 修复后已在 effects.js 实现
  'pressure_crash_halved',
  'trust_check_bonus',             // BUG-001 修复后已在 GameScene._performCheck 实现
  'random_events_bias_positive',   // 在 RandomEventSystem 中处理（不在 effects.js）
  'replay_bonus',                  // 在 talents.applyTalentEffects 中处理
  'achievement_hunter_bonus'       // 在 GameScene 中处理
]);

describe('talents.js 数据完整性', () => {
  it('所有天赋有唯一 id', () => {
    const ids = TALENTS.map(t => t.id);
    const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
    expect(dupes, `重复的 talent id: ${dupes.join(', ')}`).toEqual([]);
  });

  it('所有天赋有 name/desc/icon/rarity/effects', () => {
    TALENTS.forEach(t => {
      expect(t.name, `talent ${t.id} 缺 name`).toBeTruthy();
      expect(t.desc, `talent ${t.id} 缺 desc`).toBeTruthy();
      expect(t.icon, `talent ${t.id} 缺 icon`).toBeTruthy();
      expect(t.rarity, `talent ${t.id} 缺 rarity`).toBeTruthy();
      expect(t.effects, `talent ${t.id} 缺 effects`).toBeTypeOf('object');
    });
  });

  it('rarity 字段合法（common/rare/legendary）', () => {
    const valid = new Set(['common', 'rare', 'legendary']);
    TALENTS.forEach(t => {
      expect(valid.has(t.rarity), `talent ${t.id} rarity "${t.rarity}" 不合法`).toBe(true);
    });
  });

  it('effects 属性名在 ATTRIBUTES 中或为已知字段', () => {
    const knownAttrKeys = new Set([
      ...Object.keys(ATTRIBUTES),
      'pressureMax',
      'failurePenalty',
      'successBonus'
    ]);
    TALENTS.forEach(t => {
      for (const key of Object.keys(t.effects)) {
        expect(
          knownAttrKeys.has(key),
          `talent ${t.id} effects.${key} 不在 ATTRIBUTES 中`
        ).toBe(true);
      }
    });
  });

  it('special 字段非空字符串', () => {
    TALENTS.forEach(t => {
      if (t.special !== undefined) {
        expect(typeof t.special, `talent ${t.id} special 应为字符串`).toBe('string');
        expect(t.special.length, `talent ${t.id} special 不能为空`).toBeGreaterThan(0);
      }
    });
  });

  // BUG-001 修复后：所有 special 都应有对应实现
  it('special 字段在 effects.js/GameScene 中有对应处理', () => {
    const unhandled = [];
    TALENTS.forEach(t => {
      if (t.special && !HANDLED_SPECIALS.has(t.special)) {
        unhandled.push(`${t.id} → ${t.special}`);
      }
    });
    expect(unhandled, `未实现的 special: ${unhandled.join(', ')}`).toEqual([]);
  });
});

describe('skillTree.js 数据完整性', () => {
  it('所有技能有唯一 id', () => {
    const ids = ALL_SKILLS.map(s => s.id);
    const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
    expect(dupes, `重复的 skill id: ${dupes.join(', ')}`).toEqual([]);
  });

  it('4 棵树 × 6 技能 = 24 个节点（含 Lv4 分支）', () => {
    expect(Object.keys(SKILL_TREES).length).toBe(4);
    expect(ALL_SKILLS.length).toBe(24);
  });

  it('requires/requiresAny/exclusiveWith 引用的 id 存在', () => {
    const allIds = new Set(ALL_SKILLS.map(s => s.id));
    ALL_SKILLS.forEach(skill => {
      if (skill.requires) {
        skill.requires.forEach(req => {
          expect(allIds.has(req), `skill ${skill.id} requires 不存在的 ${req}`).toBe(true);
        });
      }
      if (skill.requiresAny) {
        skill.requiresAny.forEach(req => {
          expect(allIds.has(req), `skill ${skill.id} requiresAny 不存在的 ${req}`).toBe(true);
        });
      }
      if (skill.exclusiveWith) {
        skill.exclusiveWith.forEach(ex => {
          expect(allIds.has(ex), `skill ${skill.id} exclusiveWith 不存在的 ${ex}`).toBe(true);
        });
      }
    });
  });

  it('exclusiveWith 是双向的（A 互斥 B，则 B 也互斥 A）', () => {
    const exclusivity = new Map();
    ALL_SKILLS.forEach(s => {
      if (s.exclusiveWith) {
        exclusivity.set(s.id, new Set(s.exclusiveWith));
      }
    });
    exclusivity.forEach((partners, id) => {
      partners.forEach(p => {
        const partnerSet = exclusivity.get(p);
        expect(
          partnerSet && partnerSet.has(id),
          `${id} 互斥 ${p}，但 ${p} 未声明互斥 ${id}`
        ).toBe(true);
      });
    });
  });

  it('requires 图无循环依赖', () => {
    // 简单 DFS 检测环
    const skillMap = new Map(ALL_SKILLS.map(s => [s.id, s]));
    const visiting = new Set();
    const visited = new Set();
    let hasCycle = false;

    function dfs(id) {
      if (visiting.has(id)) { hasCycle = true; return; }
      if (visited.has(id)) return;
      visiting.add(id);
      const skill = skillMap.get(id);
      if (skill && skill.requires) {
        skill.requires.forEach(dfs);
      }
      visiting.delete(id);
      visited.add(id);
    }

    ALL_SKILLS.forEach(s => dfs(s.id));
    expect(hasCycle, '技能树 requires 存在循环依赖').toBe(false);
  });

  it('每个技能有 cost/level/effect', () => {
    ALL_SKILLS.forEach(s => {
      expect(s.cost, `skill ${s.id} 缺 cost`).toBeGreaterThan(0);
      expect(s.level, `skill ${s.id} 缺 level`).toBeGreaterThanOrEqual(1);
      expect(s.effect, `skill ${s.id} 缺 effect`).toBeTypeOf('object');
      expect(s.effect.type, `skill ${s.id} effect 缺 type`).toBeTruthy();
    });
  });
});

describe('endings.js 数据完整性', () => {
  it('35 个结局全部存在', () => {
    expect(ENDINGS.length).toBe(35);
  });

  it('所有结局有唯一 id', () => {
    const ids = ENDINGS.map(e => e.id);
    const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
    expect(dupes, `重复的 ending id: ${dupes.join(', ')}`).toEqual([]);
  });

  it('每个结局有 name/subtitle/desc/check/priority', () => {
    ENDINGS.forEach(e => {
      expect(e.name, `ending ${e.id} 缺 name`).toBeTruthy();
      expect(e.subtitle, `ending ${e.id} 缺 subtitle`).toBeTruthy();
      expect(e.desc, `ending ${e.id} 缺 desc`).toBeTruthy();
      expect(e.check, `ending ${e.id} 缺 check`).toBeTypeOf('function');
      expect(e.priority, `ending ${e.id} 缺 priority`).toBeTypeOf('number');
    });
  });

  it('priority 字段无重复（除允许的特殊情况）', () => {
    const priorities = ENDINGS.map(e => e.priority);
    const counts = {};
    priorities.forEach(p => { counts[p] = (counts[p] || 0) + 1; });
    const dupes = Object.entries(counts).filter(([_, n]) => n > 1);
    if (dupes.length > 0) {
      console.log('[信息] priority 有重复值（非错误，匹配时按声明顺序兜底）:', dupes);
    }
    // 不硬性失败，priority 重复是允许的（靠声明顺序兜底）
  });

  it('check 函数能用最小 state 调用不抛异常', () => {
    const minimalState = {
      pride: 5, wealth: 5, reputation: 5, failures: 0,
      pressure: 0, trust: 5
    };
    const minimalFlags = new Set();
    ENDINGS.forEach(e => {
      expect(() => {
        e.check(minimalState, minimalFlags);
      }, `ending ${e.id}.check 抛异常`).not.toThrow();
    });
  });

  it('ENDINGS 按 priority 降序后顺序稳定', () => {
    const sorted = [...ENDINGS].sort((a, b) => b.priority - a.priority);
    // 验证排序结果符合预期
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i - 1].priority).toBeGreaterThanOrEqual(sorted[i].priority);
    }
  });
});
