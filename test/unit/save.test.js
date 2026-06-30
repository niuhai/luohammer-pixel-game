// SaveSystem 测试（jsdom 自带 localStorage）
import { describe, it, expect, beforeEach } from 'vitest';
import { SaveSystem, AUTO_SLOT, MANUAL_SLOTS, ALL_SLOTS } from '../../src/systems/SaveSystem.js';

beforeEach(() => {
  localStorage.clear();
  // 重置 SaveSystem 静态缓存
  SaveSystem._seenNodesCache = null;
});

function makeState(overrides = {}) {
  return {
    pride: 5, wealth: 5, reputation: 5, failures: 0,
    pressure: 0, trust: 5, pressureMax: 10,
    failurePenalty: 1, successBonus: 1,
    talentSpecials: [],
    currentNode: 'intro',
    currentStageId: null,
    flags: new Set(['flag_a', 'flag_b']),
    triggeredEvents: new Set(['evt_1']),
    history: [{ nodeId: 'intro', choiceLabel: '开始', effects: { pride: 1 } }],
    achievements: [],
    ...overrides
  };
}

describe('SaveSystem - auto 槽位', () => {
  it('save/load 往返一致性（含 Set flags）', () => {
    const ss = new SaveSystem();
    const original = makeState();
    const ok = ss.save(original, AUTO_SLOT);
    expect(ok).toBe(true);

    const loaded = ss.load(AUTO_SLOT);
    expect(loaded).not.toBeNull();
    expect(loaded.pride).toBe(5);
    expect(loaded.flags).toContain('flag_a');
    expect(loaded.flags).toContain('flag_b');
    expect(loaded.triggeredEvents).toContain('evt_1');
    expect(loaded.history).toHaveLength(1);
    expect(loaded.currentNode).toBe('intro');
  });

  it('hasSave 正确反映存档状态', () => {
    const ss = new SaveSystem();
    expect(ss.hasSave(AUTO_SLOT)).toBe(false);
    ss.save(makeState(), AUTO_SLOT);
    expect(ss.hasSave(AUTO_SLOT)).toBe(true);
  });

  it('clear 清除存档', () => {
    const ss = new SaveSystem();
    ss.save(makeState(), AUTO_SLOT);
    expect(ss.hasSave(AUTO_SLOT)).toBe(true);
    ss.clear(AUTO_SLOT);
    expect(ss.hasSave(AUTO_SLOT)).toBe(false);
  });
});

describe('SaveSystem - 主存档损坏从备份恢复', () => {
  it('主存档损坏时从 BACKUP_KEY 恢复', () => {
    const ss = new SaveSystem();
    ss.save(makeState({ pride: 7 }), AUTO_SLOT);
    // 再次保存（让备份也更新到 pride=7）
    ss.save(makeState({ pride: 7 }), AUTO_SLOT);

    // 损坏主存档
    localStorage.setItem('luohammer_save', '{invalid json');

    const loaded = ss.load(AUTO_SLOT);
    expect(loaded).not.toBeNull();
    expect(loaded.pride).toBe(7);
  });

  it('主存档和备份都损坏时返回 null', () => {
    const ss = new SaveSystem();
    localStorage.setItem('luohammer_save', '{invalid');
    localStorage.setItem('luohammer_save_backup', '{also invalid');
    const loaded = ss.load(AUTO_SLOT);
    expect(loaded).toBeNull();
  });

  it('无任何存档时返回 null', () => {
    const ss = new SaveSystem();
    const loaded = ss.load(AUTO_SLOT);
    expect(loaded).toBeNull();
  });
});

describe('SaveSystem - 手动槽位', () => {
  it('slot1/2/3 独立存读', () => {
    const ss = new SaveSystem();
    ss.save(makeState({ pride: 1 }), 'slot1');
    ss.save(makeState({ pride: 2 }), 'slot2');
    ss.save(makeState({ pride: 3 }), 'slot3');

    expect(ss.load('slot1').pride).toBe(1);
    expect(ss.load('slot2').pride).toBe(2);
    expect(ss.load('slot3').pride).toBe(3);
  });

  it('clear 单个槽位不影响其他槽位', () => {
    const ss = new SaveSystem();
    ss.save(makeState({ pride: 1 }), 'slot1');
    ss.save(makeState({ pride: 2 }), 'slot2');

    ss.clear('slot1');
    expect(ss.hasSave('slot1')).toBe(false);
    expect(ss.hasSave('slot2')).toBe(true);
  });

  it('未知 slotId 返回 null/false', () => {
    const ss = new SaveSystem();
    expect(ss.save(makeState(), 'invalid_slot')).toBe(false);
    expect(ss.load('invalid_slot')).toBeNull();
    expect(ss.hasSave('invalid_slot')).toBe(false);
  });

  it('saveToSlot/loadFromSlot 是语义别名', () => {
    const ss = new SaveSystem();
    const ok = ss.saveToSlot('slot1', makeState({ pride: 9 }));
    expect(ok).toBe(true);
    const loaded = ss.loadFromSlot('slot1');
    expect(loaded.pride).toBe(9);
  });
});

describe('SaveSystem - hasAnySave', () => {
  it('无任何存档返回 false', () => {
    const ss = new SaveSystem();
    expect(ss.hasAnySave()).toBe(false);
  });

  it('只有 auto 槽位有存档返回 true', () => {
    const ss = new SaveSystem();
    ss.save(makeState(), AUTO_SLOT);
    expect(ss.hasAnySave()).toBe(true);
  });

  it('只有手动槽位有存档返回 true', () => {
    const ss = new SaveSystem();
    ss.save(makeState(), 'slot2');
    expect(ss.hasAnySave()).toBe(true);
  });
});

describe('SaveSystem - getSlotInfo', () => {
  it('空槽位返回 empty=true', () => {
    const ss = new SaveSystem();
    const info = ss.getSlotInfo('slot1');
    expect(info.empty).toBe(true);
    expect(info.label).toBe('存档 1');
  });

  it('auto 槽位有存档时返回元信息', () => {
    const ss = new SaveSystem();
    ss.save(makeState({ pride: 8, wealth: 6 }), AUTO_SLOT);
    const info = ss.getSlotInfo(AUTO_SLOT);
    expect(info.empty).toBe(false);
    expect(info.label).toBe('自动存档');
    expect(info.attributes.pride).toBe(8);
    expect(info.attributes.wealth).toBe(6);
  });

  it('手动槽位有存档时返回元信息', () => {
    const ss = new SaveSystem();
    ss.save(makeState({ pride: 7 }), 'slot1');
    const info = ss.getSlotInfo('slot1');
    expect(info.empty).toBe(false);
    expect(info.attributes.pride).toBe(7);
  });

  it('getAllSlotsInfo 返回 4 个槽位', () => {
    const ss = new SaveSystem();
    const infos = ss.getAllSlotsInfo();
    expect(infos).toHaveLength(4);
    expect(infos.map(i => i.slotId)).toEqual(['auto', 'slot1', 'slot2', 'slot3']);
  });
});

describe('SaveSystem - 已读节点追踪（O(1) 查询）', () => {
  it('初始无已读节点', () => {
    expect(SaveSystem.getSeenNodes()).toEqual({});
    expect(SaveSystem.isNodeSeen('any_node')).toBe(false);
  });

  it('markNodeSeen 记录后可查询', () => {
    SaveSystem.markNodeSeen('node_a');
    expect(SaveSystem.isNodeSeen('node_a')).toBe(true);
    expect(SaveSystem.isNodeSeen('node_b')).toBe(false);
  });

  it('markNodeSeen 重复调用不重复写入', () => {
    SaveSystem.markNodeSeen('node_a');
    SaveSystem.markNodeSeen('node_a');
    const seen = SaveSystem.getSeenNodes();
    expect(Object.keys(seen)).toEqual(['node_a']);
  });

  it('兼容旧数组格式：旧存档是 Array 也能正确读取', () => {
    localStorage.setItem('luohammer_seen_nodes', JSON.stringify(['old_a', 'old_b', 'old_c']));
    SaveSystem._seenNodesCache = null; // 重置缓存强制重读
    expect(SaveSystem.isNodeSeen('old_a')).toBe(true);
    expect(SaveSystem.isNodeSeen('old_b')).toBe(true);
    expect(SaveSystem.isNodeSeen('old_c')).toBe(true);
    expect(SaveSystem.isNodeSeen('old_d')).toBe(false);
  });

  it('缓存生效：第二次读取不查 localStorage', () => {
    SaveSystem.markNodeSeen('cached_node');
    // 删除 localStorage，但缓存应该还有
    localStorage.removeItem('luohammer_seen_nodes');
    expect(SaveSystem.isNodeSeen('cached_node')).toBe(true);
  });

  it('超过 500 个节点时淘汰最旧的', () => {
    // 写入 510 个节点
    for (let i = 0; i < 510; i++) {
      SaveSystem.markNodeSeen(`node_${i}`);
    }
    const seen = SaveSystem.getSeenNodes();
    const keys = Object.keys(seen);
    expect(keys.length).toBeLessThanOrEqual(500);
    // 最旧的 node_0 应该被淘汰（假设 FIFO）
    expect(seen['node_0']).toBeUndefined();
    // 最新的 node_509 应该还在
    expect(seen['node_509']).toBe(1);
  });

  it('损坏的 JSON 返回空对象', () => {
    localStorage.setItem('luohammer_seen_nodes', '{invalid json');
    SaveSystem._seenNodesCache = null;
    expect(SaveSystem.getSeenNodes()).toEqual({});
    expect(SaveSystem.isNodeSeen('any')).toBe(false);
  });

  it('markNodeSeen 写入后格式为对象（不是数组）', () => {
    SaveSystem.markNodeSeen('test_node');
    const raw = localStorage.getItem('luohammer_seen_nodes');
    const parsed = JSON.parse(raw);
    expect(Array.isArray(parsed)).toBe(false);
    expect(parsed).toBeTypeOf('object');
    expect(parsed.test_node).toBe(1);
  });
});

describe('SaveSystem - intro 已读', () => {
  it('初始 isIntroSeen=false', () => {
    const ss = new SaveSystem();
    expect(ss.isIntroSeen()).toBe(false);
  });

  it('markIntroSeen 后 isIntroSeen=true', () => {
    const ss = new SaveSystem();
    ss.markIntroSeen();
    expect(ss.isIntroSeen()).toBe(true);
  });

  it('clearIntroSeen 清除标记', () => {
    const ss = new SaveSystem();
    ss.markIntroSeen();
    ss.clearIntroSeen();
    expect(ss.isIntroSeen()).toBe(false);
  });
});

describe('SaveSystem - sanitizeForJSON', () => {
  it('Set flags 转 Array', () => {
    const ss = new SaveSystem();
    ss.save(makeState({ flags: new Set(['x', 'y', 'z']) }), AUTO_SLOT);
    const raw = localStorage.getItem('luohammer_save');
    const parsed = JSON.parse(raw);
    expect(Array.isArray(parsed.flags)).toBe(true);
    expect(parsed.flags).toContain('x');
    expect(parsed.flags).toContain('y');
    expect(parsed.flags).toContain('z');
  });

  it('null flags 转空数组', () => {
    const ss = new SaveSystem();
    const state = makeState();
    state.flags = null;
    ss.save(state, AUTO_SLOT);
    const parsed = JSON.parse(localStorage.getItem('luohammer_save'));
    expect(parsed.flags).toEqual([]);
  });

  it('保存版本号 _version 写入', () => {
    const ss = new SaveSystem();
    ss.save(makeState(), AUTO_SLOT);
    const parsed = JSON.parse(localStorage.getItem('luohammer_save'));
    expect(parsed._version).toBe(2);
  });
});

describe('SaveSystem - 常量导出', () => {
  it('AUTO_SLOT = "auto"', () => {
    expect(AUTO_SLOT).toBe('auto');
  });

  it('MANUAL_SLOTS = ["slot1", "slot2", "slot3"]', () => {
    expect(MANUAL_SLOTS).toEqual(['slot1', 'slot2', 'slot3']);
  });

  it('ALL_SLOTS = ["auto", "slot1", "slot2", "slot3"]', () => {
    expect(ALL_SLOTS).toEqual(['auto', 'slot1', 'slot2', 'slot3']);
  });
});
