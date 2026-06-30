/**
 * 跨周目技能树系统数据定义
 *
 * 玩家每次通关（无论成功失败）获得「人生经验」点数，
 * 可在技能树中解锁永久增益，下一周目生效。
 *
 * 4 棵树 × 5 级 = 20 个技能节点
 * 第 4 级为分支选择（A/B 二选一，互斥），第 5 级需先解锁任意一条 Lv4 分支。
 *
 * 字段说明：
 * - requires: AND 逻辑前置依赖（全部解锁后才可解锁）
 * - requiresAny: OR 逻辑前置依赖（任意一个解锁即可）
 * - exclusiveWith: 互斥节点（若其中任意一个已解锁，则本节点不可解锁）
 */

// === 技能树分支 ===
export const SKILL_TREES = {
  resilience: {
    id: 'resilience',
    name: '韧性',
    icon: '◉',
    color: '#4a9eff',
    desc: '扛住失败，越挫越勇',
    skills: [
      {
        id: 'tough_mind',
        name: '抗压体质',
        desc: '压力上限从 10 提升到 12',
        cost: 1,
        level: 1,
        effect: { type: 'pressure_cap', value: 12 }
      },
      {
        id: 'iron_will',
        name: '钢铁意志',
        desc: '检定失败时，额外惩罚减半',
        cost: 2,
        level: 2,
        requires: ['tough_mind'],
        effect: { type: 'check_fail_mitigate', value: 0.5 }
      },
      {
        id: 'phoenix',
        name: '浴火重生',
        desc: '每次翻车后，下个选择的效果 +50%',
        cost: 3,
        level: 3,
        requires: ['iron_will'],
        effect: { type: 'comeback_boost', value: 1.5 }
      },
      {
        id: 'survival_instinct',
        name: '绝境逢生',
        desc: '压力崩溃时，负面损失保留 50%（Lv4 分支A）',
        cost: 4,
        level: 4,
        branch: 'A',
        requires: ['phoenix'],
        exclusiveWith: ['mountain_calm'],
        effect: { type: 'crash_keep_stats', value: 0.5 }
      },
      {
        id: 'mountain_calm',
        name: '泰山崩于前',
        desc: '压力上限提升到 15，但初始压力 +2（Lv4 分支B）',
        cost: 4,
        level: 4,
        branch: 'B',
        requires: ['phoenix'],
        exclusiveWith: ['survival_instinct'],
        effect: { type: 'pressure_cap_15', value: 15 }
      },
      {
        id: 'undying_phoenix',
        name: '不死鸟',
        desc: '每局游戏有一次满血复活机会（属性恢复到崩溃前）',
        cost: 6,
        level: 5,
        requiresAny: ['survival_instinct', 'mountain_calm'],
        effect: { type: 'phoenix_revive', value: 1 }
      }
    ]
  },

  connections: {
    id: 'connections',
    name: '人脉',
    icon: '◈',
    color: '#f0c040',
    desc: '关系就是生产力',
    skills: [
      {
        id: 'good_reputation',
        name: '初始名声',
        desc: '游戏开始时名声 +2',
        cost: 1,
        level: 1,
        effect: { type: 'init_bonus', attr: 'reputation', value: 2 }
      },
      {
        id: 'trusted',
        name: '初始信任',
        desc: '游戏开始时信任 +2',
        cost: 2,
        level: 2,
        requires: ['good_reputation'],
        effect: { type: 'init_bonus', attr: 'trust', value: 2 }
      },
      {
        id: 'well_connected',
        name: '八面玲珑',
        desc: '解锁特殊对话选项（关键节点多一个选择）',
        cost: 3,
        level: 3,
        requires: ['trusted'],
        effect: { type: 'extra_choices', value: true }
      },
      {
        id: 'rally_call',
        name: '一呼百应',
        desc: '名声 ≥ 7 时，所有属性检定 +1（Lv4 分支A）',
        cost: 4,
        level: 4,
        branch: 'A',
        requires: ['well_connected'],
        exclusiveWith: ['hardship_friends'],
        effect: { type: 'reputation_check_bonus', value: 1 }
      },
      {
        id: 'hardship_friends',
        name: '患难之交',
        desc: '信任 ≥ 7 时，检定失败的惩罚减半（Lv4 分支B）',
        cost: 4,
        level: 4,
        branch: 'B',
        requires: ['well_connected'],
        exclusiveWith: ['rally_call'],
        effect: { type: 'trust_fail_mitigate', value: 0.5 }
      },
      {
        id: 'network',
        name: '人脉网络',
        desc: '游戏开始时所有属性 +1',
        cost: 6,
        level: 5,
        requiresAny: ['rally_call', 'hardship_friends'],
        effect: { type: 'init_bonus_all', value: 1 }
      }
    ]
  },

  insight: {
    id: 'insight',
    name: '洞察',
    icon: '◉',
    color: '#9b59b6',
    desc: '看透选择背后的代价',
    skills: [
      {
        id: 'foresight',
        name: '先见之明',
        desc: '选项默认显示效果预览（无需长按）',
        cost: 1,
        level: 1,
        effect: { type: 'auto_preview', value: true }
      },
      {
        id: 'mind_reader',
        name: '读心术',
        desc: '显示选项的检定要求和成功率',
        cost: 2,
        level: 2,
        requires: ['foresight'],
        effect: { type: 'show_check_info', value: true }
      },
      {
        id: 'destiny_seer',
        name: '命运之眼',
        desc: '可以看到每个选择导向的大致方向（好/坏/中性）',
        cost: 3,
        level: 3,
        requires: ['mind_reader'],
        effect: { type: 'show_alignment', value: true }
      },
      {
        id: 'foresee_future',
        name: '预知未来',
        desc: '随机事件触发前显示预兆提示（Lv4 分支A）',
        cost: 4,
        level: 4,
        branch: 'A',
        requires: ['destiny_seer'],
        exclusiveWith: ['read_hearts'],
        effect: { type: 'show_event_omen', value: true }
      },
      {
        id: 'read_hearts',
        name: '洞察人心',
        desc: '进入节点时显示 NPC 真实态度的额外提示（Lv4 分支B）',
        cost: 4,
        level: 4,
        branch: 'B',
        requires: ['destiny_seer'],
        exclusiveWith: ['foresee_future'],
        effect: { type: 'show_npc_attitude', value: true }
      },
      {
        id: 'omniscient',
        name: '全知之眼',
        desc: '成就图鉴中显示隐藏成就的触发提示',
        cost: 6,
        level: 5,
        requiresAny: ['foresee_future', 'read_hearts'],
        effect: { type: 'show_hidden_hints', value: true }
      }
    ]
  },

  comeback: {
    id: 'comeback',
    name: '逆袭',
    icon: '▲',
    color: '#e74c3c',
    desc: '从谷底反弹的力量',
    skills: [
      {
        id: 'debt_instinct',
        name: '债务直觉',
        desc: '游戏开始时财富 +2',
        cost: 1,
        level: 1,
        effect: { type: 'init_bonus', attr: 'wealth', value: 2 }
      },
      {
        id: 'second_chance',
        name: '第二次机会',
        desc: '每周目一次：检定失败时自动转为成功',
        cost: 2,
        level: 2,
        requires: ['debt_instinct'],
        effect: { type: 'free_retry', value: 1 }
      },
      {
        id: 'true_return',
        name: '真·归来',
        desc: '解锁隐藏结局「罗老师回来了」的额外条件路径',
        cost: 3,
        level: 3,
        requires: ['second_chance'],
        effect: { type: 'unlock_ending', value: 'ending_returns_alt' }
      },
      {
        id: 'desperate_strike',
        name: '绝地反击',
        desc: '财富 ≤ 2 时，所有正面效果 +50%（Lv4 分支A）',
        cost: 4,
        level: 4,
        branch: 'A',
        requires: ['true_return'],
        exclusiveWith: ['steady_progress'],
        effect: { type: 'low_wealth_boost', value: 1.5 }
      },
      {
        id: 'steady_progress',
        name: '稳扎稳打',
        desc: '初始财富 +3，但失去所有天赋加成（Lv4 分支B）',
        cost: 4,
        level: 4,
        branch: 'B',
        requires: ['true_return'],
        exclusiveWith: ['desperate_strike'],
        effect: { type: 'steady_wealth', value: 3 }
      },
      {
        id: 'defy_fate',
        name: '逆天改命',
        desc: '游戏开始时可以重选一次天赋',
        cost: 6,
        level: 5,
        requiresAny: ['desperate_strike', 'steady_progress'],
        effect: { type: 'talent_reroll', value: 1 }
      }
    ]
  }
};

// === 扁平化所有技能，方便查询 ===
export const ALL_SKILLS = Object.values(SKILL_TREES).flatMap(tree =>
  tree.skills.map(skill => ({
    ...skill,
    treeId: tree.id,
    treeName: tree.name,
    treeIcon: tree.icon,
    treeColor: tree.color
  }))
);

// === 根据技能 ID 获取技能定义 ===
export function getSkill(skillId) {
  return ALL_SKILLS.find(s => s.id === skillId);
}

// === 获取技能树解锁状态 ===
// 判定规则：
//   1. 已解锁的不再出现
//   2. requires（AND）：所有前置必须已解锁
//   3. requiresAny（OR）：至少一个前置已解锁
//   4. exclusiveWith（互斥）：若互斥节点中任意一个已解锁，则本节点不可解锁
export function getUnlockableSkills(unlockedSkills) {
  return ALL_SKILLS.filter(skill => {
    if (unlockedSkills.includes(skill.id)) return false;
    // AND 前置
    if (skill.requires && !skill.requires.every(req => unlockedSkills.includes(req))) return false;
    // OR 前置
    if (skill.requiresAny && !skill.requiresAny.some(req => unlockedSkills.includes(req))) return false;
    // 互斥：若互斥对象已解锁，则不可解锁
    if (skill.exclusiveWith && skill.exclusiveWith.some(ex => unlockedSkills.includes(ex))) return false;
    return true;
  });
}

// === 判断某技能是否因互斥而被锁定（用于 UI 灰显）===
export function isLockedByExclusion(skill, unlockedSkills) {
  if (!skill.exclusiveWith) return false;
  return skill.exclusiveWith.some(ex => unlockedSkills.includes(ex));
}

// === 判断某技能的前置是否满足（综合 requires 与 requiresAny）===
export function arePrerequisitesMet(skill, unlockedSkills) {
  if (skill.requires && !skill.requires.every(req => unlockedSkills.includes(req))) return false;
  if (skill.requiresAny && !skill.requiresAny.some(req => unlockedSkills.includes(req))) return false;
  return true;
}

// === 计算每次通关获得的经验点数 ===
export function calculateExpGain(state, ending) {
  let exp = 1; // 基础经验

  // 根据进度加成
  if (state.currentNode) {
    const progress = state.progress || 0;
    if (progress >= 90) exp += 2;
    else if (progress >= 50) exp += 1;
  }

  // 首次达成结局额外奖励
  if (ending && state.seenEndings && !state.seenEndings.includes(ending.id)) {
    exp += 1;
  }

  // 成就数量加成
  const achCount = (state.achievements || []).length;
  if (achCount >= 10) exp += 1;

  return exp;
}
