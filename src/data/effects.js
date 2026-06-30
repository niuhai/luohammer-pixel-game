/**
 * 效果引擎
 * 
 * 统一处理所有属性变化、远期标记、阈值触发
 */

/**
 * 属性定义（含范围和显示信息）
 */
export const ATTRIBUTES = {
  pride: { name: '理想主义', icon: '★', min: 0, max: 10, hidden: false, color: 0xF0C040 },
  wealth: { name: '财富', icon: '¤', min: 0, max: 10, hidden: false, color: 0x40C040 },
  reputation: { name: '名声', icon: '♪', min: 0, max: 10, hidden: false, color: 0x4080F0 },
  failures: { name: '翻车', icon: '✕', min: 0, max: 99, hidden: false, color: 0xE04040 },
  pressure: { name: '压力', icon: '◉', min: 0, max: 10, hidden: true, color: 0x8040C0 },
  trust: { name: '公众信任', icon: '◈', min: 0, max: 10, hidden: true, color: 0x40C0C0 },
};

/**
 * 应用效果到状态
 * @param {object} state - 当前游戏状态
 * @param {object} effects - 效果对象 { pride: 1, wealth: -2, ... }
 * @returns {object} { state: 修改后的状态, changes: 变化摘要 }
 */
export function applyEffects(state, effects) {
  if (!effects) return { state, changes: [] };

  const newState = { ...state };
  const changes = [];

  for (const [key, value] of Object.entries(effects)) {
    if (value === 0 || value === undefined) continue;
    
    const attrDef = ATTRIBUTES[key];
    if (!attrDef) continue;

    const oldValue = newState[key] ?? (key === 'failures' ? 0 : 5);
    const multiplier = getMultiplier(state, key, value);
    const delta = Math.round(value * multiplier);
    let newValue = oldValue + delta;

    // 钳制范围
    if (key === 'failures') {
      newValue = Math.max(attrDef.min, Math.min(attrDef.max, newValue)); // 翻车只增不减，上限10
    } else {
      const maxVal = key === 'pressure' ? (state.pressureMax || 10) : attrDef.max;
      newValue = Math.max(attrDef.min, Math.min(maxVal, newValue));
    }

    newState[key] = newValue;

    if (delta !== 0) {
      changes.push({
        attr: key,
        name: attrDef.name,
        icon: attrDef.icon,
        delta,
        oldValue,
        newValue,
        hidden: attrDef.hidden
      });
    }
  }

  // 翻身减1：当 pride 或 reputation 增加超过 +2 时，failures -1（成功翻身减少翻车记录）
  const bigSuccess = changes.some(c =>
    (c.attr === 'pride' || c.attr === 'reputation') && c.delta > 2
  );
  if (bigSuccess && newState.failures > 0) {
    const oldFailures = newState.failures;
    newState.failures = oldFailures - 1;
    changes.push({
      attr: 'failures', name: '翻车', icon: '✕',
      delta: -1, oldValue: oldFailures, newValue: newState.failures, hidden: false
    });
  }

  // 天赋特殊被动（failure_heals_pride, failure_wealth_bonus 等）
  const passiveResult = applySpecialPassives(newState, effects, changes);
  return { state: passiveResult.state, changes: passiveResult.changes };
}

/**
 * 应用天赋特殊被动效果（在常规 applyEffects 之后调用）
 * 处理 failure_heals_pride、failure_wealth_bonus 等非倍率型 special
 */
function applySpecialPassives(state, effects, changes) {
  const specials = state.talentSpecials || [];
  if (!specials.length) return { state, changes };

  const newState = { ...state };
  const newChanges = [...changes];

  // 检测本次是否增加了 failures
  const failuresIncreased = effects && effects.failures && effects.failures > 0;

  // failure_heals_pride: 每次跌倒让理想主义更坚定
  if (failuresIncreased && specials.includes('failure_heals_pride')) {
    const oldPride = newState.pride ?? 5;
    const bonus = 1;
    newState.pride = Math.min(10, oldPride + bonus);
    if (newState.pride !== oldPride) {
      newChanges.push({
        attr: 'pride', name: '理想主义', icon: '★',
        delta: bonus, oldValue: oldPride, newValue: newState.pride, hidden: false
      });
    }
  }

  // failure_wealth_bonus: 每次失败后获得额外财富加成
  if (failuresIncreased && specials.includes('failure_wealth_bonus')) {
    const oldWealth = newState.wealth ?? 5;
    const bonus = 1;
    newState.wealth = Math.min(10, oldWealth + bonus);
    if (newState.wealth !== oldWealth) {
      newChanges.push({
        attr: 'wealth', name: '财富', icon: '¤',
        delta: bonus, oldValue: oldWealth, newValue: newState.wealth, hidden: false
      });
    }
  }

  return { state: newState, changes: newChanges };
}

/**
 * 获取效果倍率（天赋影响）
 * @param {object} state - 当前游戏状态（含 talentSpecials）
 * @param {string} attrKey - 属性名
 * @param {number} value - 原始效果值
 * @returns {number} 倍率
 */
function getMultiplier(state, attrKey, value) {
  let mult = 1;
  const specials = state.talentSpecials || [];

  // === 已有逻辑 ===
  // 翻车惩罚倍率
  if (attrKey === 'failures' && state.failurePenalty) {
    mult *= state.failurePenalty;
  }
  // 成功奖励倍率（对正面效果生效）
  if (state.successBonus && attrKey !== 'failures') {
    if (value > 0) mult *= state.successBonus;
  }

  // === 新增天赋 special 处理 ===

  // fans_loyalty_bonus: 公众信任和名声双倍增长
  if (specials.includes('fans_loyalty_bonus') &&
      (attrKey === 'trust' || attrKey === 'reputation') && value > 0) {
    mult *= 2;
  }

  // reputation_gain_doubled: 名声增长翻倍
  if (specials.includes('reputation_gain_doubled') &&
      attrKey === 'reputation' && value > 0) {
    mult *= 2;
  }

  // trust_gain_bonus: 公众信任增长额外 +1（通过倍率实现，后面 applyEffects 补差）
  if (specials.includes('trust_gain_bonus') &&
      attrKey === 'trust' && value > 0) {
    mult += 1;
  }

  // low_stats_bonus: 劣势状态下获得额外加成（属性 <= 3 时）
  if (specials.includes('low_stats_bonus') && attrKey !== 'failures') {
    const curVal = state[attrKey] ?? 5;
    if (curVal <= 3 && value > 0) {
      mult += 1;
    }
  }

  // all_choices_bonus: 所有选项的正面效果 +1
  if (specials.includes('all_choices_bonus') && value > 0 && attrKey !== 'failures') {
    mult += 1;
  }

  // debt_reduction_bonus: 还债效率提升（花钱更少，wealth 负值时减半消耗）
  if (specials.includes('debt_reduction_bonus') &&
      attrKey === 'wealth' && value < 0) {
    mult *= 0.5;
  }

  // high_risk_high_reward: 高风险选择收益翻倍，代价也翻倍
  if (specials.includes('high_risk_high_reward') && Math.abs(value) >= 2) {
    mult *= 2;
  }

  // late_game_bonus: 后半生阶段（dark/repay/reborn）属性加成额外 +1
  if (specials.includes('late_game_bonus') && value > 0) {
    const lateStages = new Set(['dark', 'repay', 'reborn']);
    if (state.currentStageId && lateStages.has(state.currentStageId)) {
      mult += 1;
    }
  }

  // titan_heart_effect: 压力越高，理想主义加成越大
  if (specials.includes('titan_heart_effect') &&
      attrKey === 'pride' && value > 0) {
    const pressure = state.pressure || 0;
    if (pressure >= 6) mult += 1;
    if (pressure >= 8) mult += 1;
  }

  // reality_distortion_field: 所有正面效果+15%
  if (specials.includes('reality_distortion_field') && value > 0 && attrKey !== 'failures') {
    mult += 0.15;
  }

  // stage_events_bonus: 阶段结算事件效果加成 +20%
  if (specials.includes('stage_events_bonus') && value > 0 && attrKey !== 'failures') {
    const stageFlags = state.flags;
    if (stageFlags && stageFlags.has && stageFlags.has('stage_settlement')) {
      mult += 0.2;
    }
  }

  // product_events_bonus: 产品相关事件效果加成 +20%
  if (specials.includes('product_events_bonus') && value > 0 && attrKey !== 'failures') {
    const stageFlags = state.flags;
    if (stageFlags && stageFlags.has && stageFlags.has('product_event')) {
      mult += 0.2;
    }
  }

  // pressure_recovery: 压力恢复速度加快（压力减少时倍率提升）
  if (specials.includes('pressure_recovery') && attrKey === 'pressure' && value < 0) {
    mult += 1;
  }

  // pressure_gain_halved: 斯多葛派 — 压力增加时倍率减半（压力负面增长减半）
  if (specials.includes('pressure_gain_halved') && attrKey === 'pressure' && value > 0) {
    mult *= 0.5;
  }

  // === 跨周目技能：绝地反击 — 财富≤2 时正面效果 +50% ===
  if (state._lowWealthBoost && value > 0 && attrKey !== 'failures') {
    const curWealth = state.wealth ?? 5;
    if (curWealth <= 2) {
      mult *= state._lowWealthBoost;
    }
  }

  // === 跨周目技能：浴火重生 — 翻车后下个选择的正面效果 +50% ===
  // _comebackBoostActive 由 GameScene.makeChoice 在检测到 failures 增加后置位，
  // 此处消费一次后即失效（仅对下一个选择生效）。
  if (state._comebackBoostActive && state._comebackBoost && value > 0 && attrKey !== 'failures') {
    mult *= state._comebackBoost;
    // 标记已被消费，GameScene.makeChoice 在 applyEffects 返回后清除 _comebackBoostActive
    state._comebackBoostConsumed = true;
  }

  return mult;
}

/**
 * 检查压力崩溃
 * 压力达到上限时，强制触发崩溃事件
 * @param {object} state
 * @returns {object|null} 崩溃事件，或null
 */
export function checkPressureCrash(state) {
  // pressure_crash_halved: 压力崩溃时损失减半（不完全免疫）
  const specials = state.talentSpecials || [];
  const crashHalved = specials.includes('pressure_crash_halved');

  const maxPressure = state.pressureMax || 10;
  if (state.pressure >= maxPressure) {
    if (crashHalved) {
      return {
        id: 'pressure_crash',
        text: '压力到了极限，但钢铁意志让你减轻了伤害。',
        choices: [
          { label: '"勉强撑住！"', effects: { pride: -1, pressure: -5, failures: 1 } },
          { label: '"咬牙坚持！"', effects: { pride: 1, pressure: -3, trust: 1 } }
        ]
      };
    }
    return {
      id: 'pressure_crash',
      text: '你撑不住了。压力已经到了极限，你必须做出选择。',
      choices: [
        { label: '"崩溃就崩溃吧！"', effects: { pride: -2, reputation: -1, pressure: -5, failures: 1 } },
        { label: '"咬牙撑住！"', effects: { pride: 1, pressure: -3, trust: 1 } }
      ]
    };
  }
  return null;
}

/**
 * 检查属性阈值触发
 * 返回所有满足条件的隐藏事件
 * @param {object} state
 * @param {Set} flags - 远期标记
 * @returns {array} 触发的事件列表
 */
export function checkThresholdTriggers(state, flags) {
  const triggers = [];

  // 理想主义极高 → 解锁"天生骄傲"事件
  if (state.pride >= 9 && !flags.has('born_proud_triggered')) {
    triggers.push({
      id: 'born_proud',
      text: '你的理想主义已经到了偏执的程度。有人劝你"现实一点"，但你听不进去——或者说，你不想听进去。',
      effects: { pride: 1, pressure: 1 },
      flag: 'born_proud_triggered'
    });
  }

  // 公众信任极高 → 解锁"人民的罗老师"事件
  if (state.trust >= 9 && !flags.has('peoples_luo_triggered')) {
    triggers.push({
      id: 'peoples_luo',
      text: '你成了"人民的罗老师"。无论你做什么，都有人无条件支持你。但这份信任，也是一份沉重的责任。',
      effects: { reputation: 1, pressure: 1 },
      flag: 'peoples_luo_triggered'
    });
  }

  // 财富归零 → 触发"身无分文"事件
  if (state.wealth <= 0 && !flags.has('penniless_triggered')) {
    triggers.push({
      id: 'penniless',
      text: '你身无分文了。银行卡余额0.00，连一碗泡面都买不起。但你还活着。',
      effects: { pressure: 2, pride: -1 },
      flag: 'penniless_triggered'
    });
  }

  // 翻车3次 → 触发"老赖"事件
  if ((state.failures || 0) >= 3 && !flags.has('deadbeat_triggered')) {
    triggers.push({
      id: 'deadbeat',
      text: '你已经翻车三次了。有人开始叫你"老赖"。你知道你不是，但解释有用吗？',
      effects: { reputation: -2, pressure: 2 },
      flag: 'deadbeat_triggered'
    });
  }


  // 名声极高 → 解锁“众望所归”事件
  if (state.reputation >= 9 && !flags.has('famous_triggered')) {
    triggers.push({
      id: 'famous',
      text: '你的名声如日中天，走到哪里都有人认出你。但名气是把双刃剑。',
      effects: { reputation: 1, pressure: 1 },
      flag: 'famous_triggered'
    });
  }

  // 理想主义极低 → 解锁“现实主义者”事件
  if (state.pride <= 1 && !flags.has('realist_triggered')) {
    triggers.push({
      id: 'realist',
      text: '你已经不再相信什么理想了。活着，赚钱，这就够了。',
      effects: { wealth: 1, pride: -1 },
      flag: 'realist_triggered'
    });
  }

  // 信任极低 → 解锁“众叛亲离”事件
  if (state.trust <= 1 && !flags.has('distrusted_triggered')) {
    triggers.push({
      id: 'distrusted',
      text: '没有人再相信你了。你说的每一句话，都有人质疑。',
      effects: { reputation: -2, pressure: 2 },
      flag: 'distrusted_triggered'
    });
  }

  // 压力中等偏高 → 解锁“焦虑发作”事件
  if (state.pressure >= 6 && !flags.has('anxiety_triggered')) {
    triggers.push({
      id: 'anxiety',
      text: '你开始失眠，开始怀疑自己的每一个决定。',
      effects: { pressure: 1, pride: -1 },
      flag: 'anxiety_triggered'
    });
  }

  // 财富极高 → 解锁“财务自由”事件
  if (state.wealth >= 9 && !flags.has('rich_triggered')) {
    triggers.push({
      id: 'rich',
      text: '你终于不用为钱发愁了。但钱能买到的，真的够吗？',
      effects: { wealth: 1, pressure: -1, pride: -1 },
      flag: 'rich_triggered'
    });
  }

  // 翻车5次 → 解锁“百折不挠”事件
  if ((state.failures || 0) >= 5 && !flags.has('indomitable_triggered')) {
    triggers.push({
      id: 'indomitable',
      text: '你已经翻车五次了。有人叫你“行业冥灯”，但你还站着。',
      effects: { pride: 2, reputation: 1 },
      flag: 'indomitable_triggered'
    });
  }

  // 全属性中等均衡 → 解锁“中庸之道”事件
  if (state.pride >= 4 && state.pride <= 6 &&
      state.wealth >= 4 && state.wealth <= 6 &&
      state.reputation >= 4 && state.reputation <= 6 &&
      (state.failures || 0) <= 1 && !flags.has('moderate_triggered')) {
    triggers.push({
      id: 'moderate',
      text: '你既不偏执，也不妥协。这条路最安全，但也最平庸。',
      effects: { pressure: -1 },
      flag: 'moderate_triggered'
    });
  }

  // 理想+名声双高 → 解锁"意见领袖"事件
  if (state.pride >= 7 && state.reputation >= 7 && !flags.has('born_proud_triggered') && !flags.has('opinion_leader_triggered')) {
    triggers.push({
      id: 'opinion_leader',
      text: '你不只是有理想，你还有话语权。你的每一句话都能引发讨论。',
      effects: { reputation: 1, trust: 1, pressure: 1 },
      flag: 'opinion_leader_triggered'
    });
  }

  // === 新增：跨属性关联触发，让属性之间产生联动 ===

  // 高压力侵蚀信任（压力≥7 且信任≥5 → 信任受损）
  if (state.pressure >= 7 && state.trust >= 5 && !flags.has('stress_erosion_trust_triggered')) {
    triggers.push({
      id: 'stress_erosion_trust',
      text: '高压之下你开始对身边人失去耐心。一次失控的争吵后，你发现信任正在流失。',
      effects: { trust: -1, pressure: 1 },
      flag: 'stress_erosion_trust_triggered'
    });
  }

  // 财富反哺名声（财富≥8 且名声<6 → 用钱刷名）
  if (state.wealth >= 8 && state.reputation < 6 && !flags.has('wealth_buy_fame_triggered')) {
    triggers.push({
      id: 'wealth_buy_fame',
      text: '你开始用钱铺设公众形象——捐款、赞助、慈善晚宴。名声在涨，但你知道这不算真正的认可。',
      effects: { reputation: 2, wealth: -1 },
      flag: 'wealth_buy_fame_triggered'
    });
  }

  // 翻车消耗理想（翻车≥3 且理想≥7 → 理想动摇）
  if ((state.failures || 0) >= 3 && state.pride >= 7 && !flags.has('crack_ideal_triggered')) {
    triggers.push({
      id: 'crack_ideal',
      text: '连续的翻车让你的理想主义出现了裂缝。你开始怀疑，是不是该"务实"一点了。',
      effects: { pride: -2, wealth: 1 },
      flag: 'crack_ideal_triggered'
    });
  }

  // 信任支撑翻车 recovery（信任≥8 且翻车≥2 → 朋友拉一把）
  if (state.trust >= 8 && (state.failures || 0) >= 2 && !flags.has('friend_bailout_triggered')) {
    triggers.push({
      id: 'friend_bailout',
      text: '在你最狼狈的时候，老朋友伸出了手。"翻车了就爬起来，我帮你。"这就是信任的重量。',
      effects: { failures: -1, pressure: -2, trust: -1 },
      flag: 'friend_bailout_triggered'
    });
  }

  return triggers;
}

/**
 * 检查属性联动触发
 * 检测属性组合是否满足特殊触发条件，满足则返回联动事件
 * 每个联动事件每局只触发一次（通过 state.flags 记录）
 * @param {object} state - 当前游戏状态（需含 flags: Set）
 * @returns {object|null} 联动事件，或 null
 */
export function checkComboTriggers(state) {
  const triggers = [
    {
      id: 'combo_idealist_rich',
      condition: (s) => s.pride >= 8 && s.wealth >= 8,
      message: '【理想主义富翁】你的理想主义和财富同时达到巅峰，人们开始称你为"有理想的商人"。',
      effects: { reputation: 2 },
      oncePerGame: true
    },
    {
      id: 'combo_dark_moment',
      condition: (s) => s.pride <= 2 && (s.failures || 0) >= 3,
      message: '【至暗时刻】理想破灭，接连翻车，你陷入了人生的至暗时刻...',
      effects: { pressure: 3 },
      oncePerGame: true
    },
    {
      id: 'combo_charismatic_leader',
      condition: (s) => s.reputation >= 8 && s.trust >= 8,
      message: '【魅力领袖】名声和信任双高，你成为了行业内的精神领袖。',
      effects: { pride: 1, wealth: 1 },
      oncePerGame: true
    },
    {
      id: 'combo_underdog_rise',
      condition: (s) => s.wealth <= 2 && s.pride >= 7,
      message: '【穷且益坚】虽然经济拮据，但你的理想主义精神感染了身边的人。',
      effects: { reputation: 2, trust: 1 },
      oncePerGame: true
    },
    {
      id: 'combo_pressure_explosion',
      condition: (s) => s.pressure >= 8 && s.pride >= 7,
      message: '【压力与坚持】巨大的压力没有压垮你，反而让你的信念更加坚定。',
      effects: { pride: 1 },
      oncePerGame: true
    }
  ];

  for (const trigger of triggers) {
    if (state.flags && state.flags.has(trigger.id)) continue; // oncePerGame
    if (trigger.condition(state)) {
      if (trigger.oncePerGame && state.flags) {
        state.flags.add(trigger.id);
      }
      return trigger;
    }
  }
  return null;
}

/**
 * 检查远期标记后果
 * 某些标记会在特定阶段产生后果
 * @param {string} stageId - 当前阶段
 * @param {Set} flags - 远期标记集合
 * @returns {array} 后果事件列表
 */
export function checkFlagConsequences(stageId, flags) {
  const consequences = [];


  if (stageId === 'youth') {
    if (flags.has('bookworm')) {
      consequences.push({
        id: 'bookworm_consequence',
        text: '你当年欠着钱也要买的那本书，改变了你看世界的方式。',
        effects: { pride: 1, reputation: 1 }
      });
    }
    if (flags.has('fighter')) {
      consequences.push({
        id: 'fighter_consequence',
        text: '你当年打架的事被人翻出来了。有人说你暴力，有人说你有担当。',
        effects: { reputation: -1, pride: 1 }
      });
    }
    if (flags.has('dropout')) {
      consequences.push({
        id: 'dropout_consequence',
        text: '你退学了。没有学历，但你有了自由。有人说你傻，但你知道——学校装不下你的野心。',
        effects: { pride: 1, wealth: -1 }
      });
    }
  }


  if (stageId === 'teacher') {
    if (flags.has('corrupt')) {
      consequences.push({
        id: 'corrupt_consequence',
        text: '你当年收的红包被人举报了。虽然金额不大，但影响很坏。',
        effects: { trust: -2, reputation: -1 }
      });
    }
    if (flags.has('influencer')) {
      consequences.push({
        id: 'influencer_consequence',
        text: '你当年趁热打铁做了网红，现在粉丝量已经很大了。',
        effects: { reputation: 2, wealth: 1 }
      });
    }
    if (flags.has('stayed_xinfang')) {
      consequences.push({
        id: 'stayed_xinfang_consequence',
        text: '你留在了新东方。稳定的收入、体面的生活——但深夜里，你偶尔会想：如果当初走了呢？',
        effects: { wealth: 1, pride: -1 }
      });
    }
    if (flags.has('education_reform')) {
      consequences.push({
        id: 'education_reform_consequence',
        text: '你推动了教育改革，虽然只是一个小小的尝试，但有人因此改变了命运。',
        effects: { trust: 1, pride: 1 }
      });
    }
  }


  if (stageId === 'startup') {
    if (flags.has('all_in')) {
      consequences.push({
        id: 'all_in_consequence',
        text: '你当年借钱也要干下去，现在债务更多了。',
        effects: { wealth: -1, pressure: 2 }
      });
    }
    if (flags.has('sued_big_tech')) {
      consequences.push({
        id: 'sued_big_tech_consequence',
        text: '你告了大厂，但诉讼费花了不少钱，结果也不理想。',
        effects: { wealth: -2, pride: 1 }
      });
    }
    if (flags.has('public_feud')) {
      consequences.push({
        id: 'public_feud_consequence',
        text: '你当年公开怒了那个KOL，现在他粉丝还在黑你。',
        effects: { reputation: -1, pressure: 1 }
      });
    }
    if (flags.has('joined_xiaomi')) {
      consequences.push({
        id: 'joined_xiaomi_consequence',
        text: '你加入了小米，雷军给了你资源和平台。但你的工牌上写的是"产品经理"，不是"CEO"。',
        effects: { wealth: 1, pride: -1 }
      });
    }
    if (flags.has('started_business')) {
      consequences.push({
        id: 'started_business_consequence',
        text: '你选择了创业。没有退路，没有保底，只有你和你的野心。这条路注定不好走。',
        effects: { pride: 1, pressure: 1 }
      });
    }
    if (flags.has('gave_up_hardware')) {
      consequences.push({
        id: 'gave_up_hardware_consequence',
        text: '你放弃了做硬件。及时止损是理性的选择，但每次看到别人的手机，你心里还是会咯噔一下。',
        effects: { wealth: 1, pride: -2 }
      });
    }
    if (flags.has('persist_premium')) {
      consequences.push({
        id: 'persist_premium_consequence',
        text: '你坚持做高端。成本居高不下，供应链叫苦连天，但每一台手机都是你的骄傲。',
        effects: { pride: 1, wealth: -1 }
      });
    }
    if (flags.has('never_compromised')) {
      consequences.push({
        id: 'never_compromised_consequence',
        text: '你从未妥协过。投资人摇头，供应商叹气，但你的用户知道——你做的产品，每一处都是认真的。',
        effects: { pride: 2, pressure: 1 }
      });
    }
    if (flags.has('killed_m1')) {
      consequences.push({
        id: 'killed_m1_consequence',
        text: '你砍掉了M1。"长得像iPhone的东西，我不做。"现金流断了，但你守住了底线。',
        effects: { pride: 2, wealth: -2 }
      });
    }
    if (flags.has('conservative_funding')) {
      consequences.push({
        id: 'conservative_funding_consequence',
        text: '你保守地使用资金，公司活下来了，但也没了当年的锐气。安全，但平庸。',
        effects: { wealth: 1, pride: -1 }
      });
    }
  }


  if (stageId === 'dark') {
    if (flags.has('honest_repay')) {
      consequences.push({
        id: 'honest_repay_dark_consequence',
        text: '你选择了自己还债，这个选择在最黑暗的时刻给了你力量。',
        effects: { trust: 1, pride: 1, pressure: -1 }
      });
    }
    if (flags.has('declared_bankruptcy')) {
      consequences.push({
        id: 'declared_bankruptcy_consequence',
        text: '你申请了破产清算。法律上你没有错，但那些信任你的人——供应商、员工、用户——他们不会原谅你。',
        effects: { wealth: 1, trust: -2, reputation: -1 }
      });
    }
    if (flags.has('became_investor')) {
      consequences.push({
        id: 'became_investor_consequence',
        text: '你从创业者变成了投资人。你终于理解了当年那些拒绝你的人——他们不是不懂你，只是看到了你没看到的风险。',
        effects: { wealth: 2, pride: -1 }
      });
    }
  }

  if (stageId === 'repay') {
    if (flags.has('sold_out')) {
      consequences.push({
        id: 'sold_out_consequence',
        text: '你之前接了那些烂广告，现在后果来了。粉丝们在评论区刷屏："老罗变了，他不值得信任了。"',
        effects: { trust: -1, reputation: -1 }
      });
    }
    if (flags.has('honest_repay')) {
      consequences.push({
        id: 'honest_repay_consequence',
        text: '你之前拒绝了破产清算，选择自己还债。现在，这个选择开始得到回报——越来越多人相信你。',
        effects: { trust: 2, reputation: 1 }
      });
    }
    if (flags.has('banned_fight')) {
      consequences.push({
        id: 'banned_fight_consequence',
        text: '你当年维权被封号，虽然后来解封了，但错过了一段黄金期。',
        effects: { wealth: -1, reputation: 1 }
      });
    }
    if (flags.has('wrote_book')) {
      consequences.push({
        id: 'wrote_book_consequence',
        text: '你写的书出版了。出乎意料地卖得不错，有人说是鸡汤，有人说是真话。但至少，你把经历变成了文字。',
        effects: { reputation: 1, wealth: 1 }
      });
    }
    if (flags.has('became_influencer')) {
      consequences.push({
        id: 'became_influencer_consequence',
        text: '你成了超级网红。流量来了，钱也来了，但有人说："老罗变了，他不再做产品了。"',
        effects: { reputation: 2, wealth: 1, pride: -1 }
      });
    }
    if (flags.has('continued_livestream')) {
      consequences.push({
        id: 'continued_livestream_consequence',
        text: '你继续直播带货。交个朋友越做越大，但你心里清楚——这不是你的终点，只是还债的手段。',
        effects: { wealth: 2, pride: -1 }
      });
    }
    if (flags.has('retired')) {
      consequences.push({
        id: 'retired_consequence',
        text: '你退网了。不再发微博，不再开发布会。世界安静了，你也安静了。',
        effects: { pressure: -2, reputation: -1 }
      });
    }
  }

  if (stageId === 'reborn') {
    if (flags.has('mentor')) {
      consequences.push({
        id: 'mentor_consequence',
        text: '你曾经指导的那个年轻创业者，现在做出了不错的产品。他在发布会上说："感谢罗老师教会我，做产品要有灵魂。"',
        effects: { trust: 1, reputation: 1 }
      });
    }
    if (flags.has('sold_name')) {
      consequences.push({
        id: 'sold_name_consequence',
        text: '你卖了"罗远"这个品牌。现在你只能用新名字做事，但没人认识你了。',
        effects: { reputation: -3, pride: -2 }
      });
    }
    if (flags.has('ai_believer')) {
      consequences.push({
        id: 'ai_believer_consequence',
        text: '你当年相信AI是革命，现在看来你是对的。',
        effects: { wealth: 2, reputation: 1 }
      });
    }
    if (flags.has('comeback_attempt')) {
      consequences.push({
        id: 'comeback_attempt_consequence',
        text: '你当年又干了一票大的，虽然没完全成功，但学到了不少。',
        effects: { pride: 1, wealth: -1 }
      });
    }
    if (flags.has('final_comeback')) {
      consequences.push({
        id: 'final_comeback_consequence',
        text: '你决定最后再做一次。这一次，不是为了证明什么，只是因为你还没死心。',
        effects: { pride: 2, pressure: 2 }
      });
    }
  }

  return consequences;
}

/**
 * 创建初始游戏状态
 * @param {object} talentEffects - 天赋效果
 * @returns {object} 初始状态
 */
export function createInitialState(talentEffects = {}) {
  const base = {
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
    currentStageId: null,
    currentNode: 'intro',
    flags: new Set(),
    triggeredEvents: new Set(),
    history: [],
  };
  return applyEffects(base, talentEffects).state;
}
