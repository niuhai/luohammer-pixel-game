/**
 * 天赋系统
 * 
 * 每个天赋的结构：
 * {
 *   id: string,           // 唯一标识
 *   name: string,         // 显示名称
 *   desc: string,         // 描述
 *   icon: string,         // emoji图标
 *   rarity: 'common'|'rare'|'legendary',  // 稀有度
 *   effects: {            // 初始效果
 *     pride?: number,
 *     wealth?: number,
 *     reputation?: number,
 *     pressure?: number,
 *     trust?: number,
 *     pressureMax?: number,   // 压力上限调整
 *     failurePenalty?: number, // 翻车惩罚倍率
 *     successBonus?: number,   // 成功奖励倍率
 *   },
 *   special?: string,     // 特殊效果描述（由引擎解读）
 * }
 */

export const TALENT_OFFER_COUNT = 5;
export const TALENT_PICK_COUNT = 2;

/** 稀有度权重按“稀有度分类”计算，而不是给池中每一张卡重复加权。 */
export const TALENT_RARITY_WEIGHTS = Object.freeze({
  common: 60,
  rare: 30,
  legendary: 10
});

/** 天赋特殊效果 key → 玩家可见文案。效果实现与 UI 共用此处，避免口径漂移。 */
export const TALENT_SPECIAL_LABELS = Object.freeze({
  all_in: '正面收益与翻车记录同时翻倍',
  random_events_bias_positive: '随机事件更容易出现好结果',
  failure_heals_pride: '每次翻车后理想主义 +1',
  fans_loyalty_bonus: '公众信任和名声的正收益翻倍',
  low_stats_bonus: '属性不高于 3 时，该属性的正收益翻倍',
  debt_reduction_bonus: '财富损失减半',
  stage_events_bonus: '公开舞台阶段获得名声或信任时额外 +1',
  product_events_bonus: '产品创业阶段获得公众信任时额外 +1',
  reality_distortion_field: '单项正收益达到 +2 时，再额外 +1',
  high_risk_high_reward: '绝对值达到 2 的收益与代价翻倍',
  late_game_bonus: '后半生阶段的正收益额外 +1',
  reputation_gain_doubled: '名声正收益翻倍',
  pressure_recovery: '每个阶段结束自动降低 2 点压力',
  failure_wealth_bonus: '每次翻车后财富 +1',
  trust_gain_bonus: '公众信任正收益额外 +1',
  replay_bonus: '多周目游戏初始基础属性额外 +1',
  all_choices_bonus: '每项正面属性变化额外 +1',
  titan_heart_effect: '压力越高，理想主义正收益越强',
  pressure_crash_halved: '压力崩溃时属性损失减半',
  pressure_gain_halved: '压力增长减半',
  trust_check_bonus: '信任不低于 5 时，属性检定 +1',
  achievement_hunter_bonus: '每解锁一个成就，当前最低基础属性 +1（每局最多 5 次）'
});

export const TALENTS = [
  // ===== 普通 (common) =====
  {
    id: 'silver_tongue',
    name: '嘴炮王者',
    desc: '"我这个人就是嘴欠"',
    icon: '♪',
    rarity: 'common',
    effects: { pride: 2, reputation: 1 }
  },
  {
    id: 'stubborn',
    name: '偏执狂',
    desc: '"工匠精神就是死磕"',
    icon: '▣',
    rarity: 'common',
    effects: { pride: 2, pressure: 2 }
  },
  {
    id: 'social_butterfly',
    name: '社交达人',
    desc: '"朋友多了路好走"',
    icon: '◈',
    rarity: 'common',
    effects: { reputation: 2, wealth: 1 }
  },
  {
    id: 'thick_skin',
    name: '厚脸皮',
    desc: '"被骂习惯了"',
    icon: '◉',
    rarity: 'common',
    effects: { pressureMax: 3 }
  },
  {
    id: 'business_sense',
    name: '商业嗅觉',
    desc: '"闻到钱的味道"',
    icon: '◈',
    rarity: 'common',
    effects: { wealth: 2, pride: -1 }
  },
  {
    id: 'bookworm',
    name: '书虫',
    desc: '"书是最好的老师"',
    icon: '▤',
    rarity: 'common',
    effects: { pride: 1, trust: 1 }
  },
  {
    id: 'street_smart',
    name: '江湖老手',
    desc: '"社会大学博士后"',
    icon: '▦',
    rarity: 'common',
    effects: { wealth: 1, pressureMax: 2 }
  },
  {
    id: 'dreamer',
    name: '理想主义者',
    desc: '"不被嘲笑的梦想不值得实现"',
    icon: '✦',
    rarity: 'common',
    effects: { pride: 3, wealth: -1, pressure: 1 }
  },
  {
    id: 'pragmatist',
    name: '务实派',
    desc: '"先活下来再说"',
    icon: '▦',
    rarity: 'common',
    effects: { wealth: 2, pride: -2 }
  },
  {
    id: 'lucky',
    name: '锦鲤体质',
    desc: '"运气也是实力"',
    icon: '≈',
    rarity: 'common',
    effects: { trust: 1, reputation: 1 },
    special: 'random_events_bias_positive'
  },

  // ===== 稀有 (rare) =====
  {
    id: 'all_in',
    name: '孤注一掷',
    desc: '"all in！"',
    icon: '◊',
    rarity: 'rare',
    effects: { failurePenalty: 2, successBonus: 2 }
  },
  {
    id: 'phoenix',
    name: '浴火重生',
    desc: '"每次跌倒都让我更强"',
    icon: '▲',
    rarity: 'rare',
    effects: { pride: 1, trust: 1 },
    special: 'failure_heals_pride'
  },
  {
    id: 'cult_leader',
    name: '教主气质',
    desc: '"他们不是粉丝，是信徒"',
    icon: '♔',
    rarity: 'rare',
    effects: { reputation: 3, trust: 2, pressure: 1 },
    special: 'fans_loyalty_bonus'
  },
  {
    id: 'underdog',
    name: '弱者逆袭',
    desc: '"全世界都不看好我"',
    icon: '◇',
    rarity: 'rare',
    effects: { pride: 2, pressureMax: 2 },
    special: 'low_stats_bonus'
  },
  {
    id: 'comeback_king',
    name: '东山再起',
    desc: '"史玉柱第二"',
    icon: '↻',
    rarity: 'rare',
    effects: { trust: 2, reputation: 1 },
    special: 'debt_reduction_bonus'
  },

  // ===== 传说 (legendary) =====
  {
    id: 'luo_himself',
    name: '老罗附体',
    desc: '"天生骄傲，但也容易翻车"',
    icon: '⚡',
    rarity: 'legendary',
    effects: { pride: 1, wealth: 1, reputation: 1, trust: 1, pressureMax: 1 }
  },
  {
    id: 'iron_will',
    name: '钢铁意志',
    desc: '"6亿债务也压不垮我，但也会受伤"',
    icon: '▣',
    rarity: 'legendary',
    effects: { pressureMax: 5, pride: 2 },
    special: 'pressure_crash_halved'
  },
  // ===== 新增普通 (common) =====
  {
    id: 'copywriter',
    name: '文案鬼才',
    desc: '"一块钱听八次课"',
    icon: '✎',
    rarity: 'common',
    effects: { reputation: 2, pride: 1 }
  },
  {
    id: 'night_owl',
    name: '夜猫子',
    desc: '"凌晨三点灵感最旺"',
    icon: '◐',
    rarity: 'common',
    effects: { pride: 1, pressure: 1, trust: 1 }
  },
  {
    id: 'contrarian',
    name: '逆向思维',
    desc: '"大家都做的我不做"',
    icon: '↻',
    rarity: 'common',
    effects: { pride: 2, reputation: -1, wealth: 1 }
  },
  {
    id: 'self_deprecating',
    name: '自嘲达人',
    desc: '"我这个人最大的优点就是不要脸"',
    icon: '☺',
    rarity: 'common',
    effects: { reputation: 1, pressureMax: 2, pride: -1 }
  },
  {
    id: 'workaholic',
    name: '工作狂',
    desc: '"007是福报"',
    icon: '▣',
    rarity: 'common',
    effects: { wealth: 2, pressure: 2, trust: 1, pressureMax: 1 }
  },
  {
    id: 'fan_magnet',
    name: '吸粉体质',
    desc: '"他们不是粉丝，是朋友"',
    icon: '◈',
    rarity: 'common',
    effects: { reputation: 2, trust: 1, wealth: -1 }
  },
  {
    id: 'tightwad',
    name: '铁公鸡',
    desc: '"省到就是赚到"',
    icon: '◈',
    rarity: 'common',
    effects: { wealth: 3, reputation: -1, trust: -1, pressureMax: 1 }
  },

  // ===== 新增稀有 (rare) =====
  {
    id: 'showman',
    name: '表演型人格',
    desc: '"人越多我越兴奋"',
    icon: '◉',
    rarity: 'rare',
    effects: { reputation: 2, pride: 2, pressure: 2 },
    special: 'stage_events_bonus'
  },
  {
    id: 'debt_warrior',
    name: '还债战士',
    desc: '"6亿？我来还！"',
    icon: '⚔',
    rarity: 'rare',
    effects: { pride: 2, trust: 2, wealth: -2 },
    special: 'debt_reduction_bonus'
  },
  {
    id: 'product_whisperer',
    name: '产品低语者',
    desc: '"我能听见用户在哭"',
    icon: '◈',
    rarity: 'rare',
    effects: { pride: 2, trust: 1, reputation: 1 },
    special: 'product_events_bonus'
  },
  {
    id: 'resilience',
    name: '百折不挠',
    desc: '"跌倒99次，第100次还是站起来"',
    icon: '▣',
    rarity: 'rare',
    effects: { pressureMax: 3, pride: 1, trust: 1 },
    special: 'failure_heals_pride'
  },
  {
    id: 'networker',
    name: '人脉编织者',
    desc: '"认识谁，比知道什么更重要"',
    icon: '◈',
    rarity: 'rare',
    effects: { reputation: 1, trust: 2 },
    special: 'trust_check_bonus'
  },
  {
    id: 'stoic',
    name: '斯多葛派',
    desc: '"命运的鞭子打来，我面不改色"',
    icon: '◇',
    rarity: 'rare',
    effects: { pressureMax: 4, pride: 1 },
    special: 'pressure_gain_halved'
  },

  // ===== 新增传说 (legendary) =====
  {
    id: 'reality_distortion',
    name: '现实扭曲力场',
    desc: '"不是现实改变了你，是你改变了现实"',
    icon: '◯',
    rarity: 'legendary',
    effects: { pride: 2, reputation: 2, trust: 0, pressureMax: 2 },
    special: 'reality_distortion_field'
  },
  {
    id: 'true_repayment',
    name: '真还传',
    desc: '"我欠的，我一定还"',
    icon: '¤',
    rarity: 'legendary',
    effects: { trust: 3, pride: 2, reputation: 2, wealth: -1 },
    special: 'debt_reduction_bonus'
  },

  // ===== 扩充普通 (common) =====
  {
    id: 'keyboard_warrior',
    name: '键盘侠',
    desc: '"在网上我谁都不怕"',
    icon: '▦',
    rarity: 'common',
    effects: { pride: 1, reputation: 1, trust: 1 }
  },
  {
    id: 'gambler',
    name: '赌徒心态',
    desc: '"赢了会所嫩模，输了下海干活"',
    icon: '◊',
    rarity: 'common',
    effects: { wealth: 2, trust: -1 },
    special: 'high_risk_high_reward'
  },
  {
    id: 'perfectionist',
    name: '完美主义',
    desc: '"差一点都不行"',
    icon: '◆',
    rarity: 'common',
    effects: { pride: 2, pressure: 2, wealth: -1 }
  },
  {
    id: 'smooth_talker',
    name: '嘴甜',
    desc: '"见人三分笑，话到嘴边留三分"',
    icon: '☺',
    rarity: 'common',
    effects: { reputation: 1, trust: 1, pride: -1 }
  },
  {
    id: 'lone_wolf',
    name: '独狼',
    desc: '"一个人也能成事"',
    icon: '◇',
    rarity: 'common',
    effects: { pride: 2, reputation: -1, trust: 1 }
  },
  {
    id: 'adapter',
    name: '变色龙',
    desc: '"什么环境都能活"',
    icon: '◈',
    rarity: 'common',
    effects: { pressureMax: 2, wealth: 1, pride: -1 }
  },
  {
    id: 'mentor_soul',
    name: '人生导师',
    desc: '"走过的弯路都是财富"',
    icon: '◈',
    rarity: 'common',
    effects: { trust: 2, pride: 1 }
  },
  {
    id: 'risk_taker',
    name: '冒险家',
    desc: '"不冒险才是最大的冒险"',
    icon: '▲',
    rarity: 'common',
    effects: { pride: 2, wealth: 1, pressure: 1 }
  },

  // ===== 扩充稀有 (rare) =====
  {
    id: 'second_wind',
    name: '第二春',
    desc: '"四十岁才是真正的开始"',
    icon: '✿',
    rarity: 'rare',
    effects: { pride: 1, wealth: 1, trust: 1 },
    special: 'late_game_bonus'
  },
  {
    id: 'media_darling',
    name: '媒体宠儿',
    desc: '"记者最爱的采访对象"',
    icon: '▦',
    rarity: 'rare',
    effects: { reputation: 3, trust: 1, pride: 1 },
    special: 'reputation_gain_doubled'
  },
  {
    id: 'zen_master',
    name: '佛系心态',
    desc: '"随缘吧"',
    icon: '◯',
    rarity: 'rare',
    effects: { pressureMax: 4, pride: -1 },
    special: 'pressure_recovery'
  },
  {
    id: 'serial_entrepreneur',
    name: '连续创业者',
    desc: '"失败了？那就再来一个项目"',
    icon: '↻',
    rarity: 'rare',
    effects: { wealth: 1, pride: 2, pressureMax: 1 },
    special: 'failure_wealth_bonus'
  },
  {
    id: 'charisma_aura',
    name: '魅力光环',
    desc: '"走进房间所有人都看你"',
    icon: '✦',
    rarity: 'rare',
    effects: { reputation: 2, trust: 2, pride: 1 },
    special: 'trust_gain_bonus'
  },

  // ===== 扩充传说 (legendary) =====
  {
    id: 'time_traveler',
    name: '时间旅者',
    desc: '"如果重来一次，我还是会做同样的选择"',
    icon: '⌛',
    rarity: 'legendary',
    effects: { pride: 2, trust: 2, reputation: 1, wealth: 1 },
    special: 'replay_bonus'
  },
  {
    id: 'crossroads_master',
    name: '十字路口之主',
    desc: '"每个路口都是机会，每个选择都是命运"',
    icon: '✚',
    rarity: 'legendary',
    effects: { pride: 1, wealth: 1, reputation: 1, trust: 1, pressureMax: 3 },
    special: 'all_choices_bonus'
  },
  {
    id: 'titan_heart',
    name: '巨人之心',
    desc: '"我可能被打倒，但我永远不会被打败"',
    icon: '♥',
    rarity: 'legendary',
    effects: { pride: 3, pressureMax: 4, trust: 2 },
    special: 'titan_heart_effect'
  },
  {
    id: 'achievement_hunter',
    name: '成就猎人',
    desc: '"每解锁一个成就，当前最低的基础属性 +1（每局最多5次）"',
    icon: '★',
    rarity: 'legendary',
    effects: { pride: 1, wealth: 1, reputation: 1, trust: 1 },
    special: 'achievement_hunter_bonus',
    unlockId: 'achievement_hunter'
  }
];

/**
 * 按稀有度随机抽取N个天赋
 * @param {number} count - 抽取数量
 * @param {object} options - 选项
 * @param {boolean} options.guaranteeRare - 是否保底至少一个稀有
 * @param {string[]} options.unlockedTalentIds - 已解锁的特殊天赋 ID
 * @returns {array} 天赋对象数组
 */
export function drawTalents(count = TALENT_OFFER_COUNT, options = {}) {
  const unlockedTalentIds = new Set(options.unlockedTalentIds || []);
  const pool = TALENTS.filter(talent => !talent.unlockId || unlockedTalentIds.has(talent.unlockId));
  const result = [];
  const usedSpecials = new Set();

  const takeTalent = (talent) => {
    if (!talent) return;
    result.push(talent);
    if (talent.special) usedSpecials.add(talent.special);
    const index = pool.indexOf(talent);
    if (index >= 0) pool.splice(index, 1);
  };

  const pickFrom = (candidates) => {
    if (!candidates.length) return null;
    return candidates[Math.floor(Math.random() * candidates.length)];
  };

  const pickByRarity = () => {
    // 同一手牌尽量避免出现相同 special 家族，防止两个选择不叠加却没有提示。
    let candidates = pool.filter(talent => !talent.special || !usedSpecials.has(talent.special));
    if (candidates.length === 0) candidates = pool;

    const availableRarities = Object.keys(TALENT_RARITY_WEIGHTS)
      .filter(rarity => candidates.some(talent => talent.rarity === rarity));
    if (availableRarities.length === 0) return null;

    const totalWeight = availableRarities.reduce(
      (total, rarity) => total + TALENT_RARITY_WEIGHTS[rarity],
      0
    );
    let roll = Math.random() * totalWeight;
    let selectedRarity = availableRarities[availableRarities.length - 1];
    for (const rarity of availableRarities) {
      roll -= TALENT_RARITY_WEIGHTS[rarity];
      if (roll <= 0) {
        selectedRarity = rarity;
        break;
      }
    }
    return pickFrom(candidates.filter(talent => talent.rarity === selectedRarity));
  };

  // 保底槽固定从 rare 抽取；传说仍走正常 10% 权重，避免保底反而让传说泛滥。
  if (options.guaranteeRare && count > 1) {
    const rarePool = pool.filter(talent => talent.rarity === 'rare');
    const fallbackPool = pool.filter(talent => talent.rarity === 'legendary');
    takeTalent(pickFrom(rarePool.length > 0 ? rarePool : fallbackPool));
  }

  // 剩余槽位先按稀有度分类加权，再在对应分类内均匀抽卡。
  while (result.length < count && pool.length > 0) {
    takeTalent(pickByRarity());
  }

  // 保底只保证内容，不暴露固定卡位；否则玩家会很快学会“第一张必稀有”并跳过阅读。
  for (let index = result.length - 1; index > 0; index--) {
    const target = Math.floor(Math.random() * (index + 1));
    [result[index], result[target]] = [result[target], result[index]];
  }

  return result;
}

const SPECIAL_ARCHETYPES = Object.freeze({
  random_events_bias_positive: 'fortune',
  failure_heals_pride: 'resilience',
  fans_loyalty_bonus: 'influence',
  low_stats_bonus: 'resilience',
  debt_reduction_bonus: 'business',
  stage_events_bonus: 'influence',
  product_events_bonus: 'craft',
  trust_check_bonus: 'trust',
  pressure_gain_halved: 'resilience',
  pressure_crash_halved: 'resilience',
  pressure_recovery: 'resilience',
  reality_distortion_field: 'vision',
  high_risk_high_reward: 'risk',
  late_game_bonus: 'growth',
  reputation_gain_doubled: 'influence',
  failure_wealth_bonus: 'business',
  trust_gain_bonus: 'trust',
  replay_bonus: 'growth',
  all_choices_bonus: 'vision',
  titan_heart_effect: 'resilience',
  achievement_hunter_bonus: 'growth'
});

const ARCHETYPE_INFO = Object.freeze({
  vision: { name: '理想', same: '理想过载' },
  business: { name: '生存', same: '生存本能' },
  influence: { name: '表达', same: '舞台中心' },
  trust: { name: '信用', same: '信用同盟' },
  resilience: { name: '韧性', same: '不倒之身' },
  risk: { name: '冒险', same: '命运赌徒' },
  craft: { name: '产品', same: '产品信仰' },
  fortune: { name: '机运', same: '命运眷顾' },
  growth: { name: '成长', same: '越战越强' }
});

const COMBINATION_TITLES = Object.freeze({
  'business:trust': '信用生意',
  'business:vision': '理想与面包',
  'craft:vision': '产品原教旨',
  'influence:resilience': '越挫越红',
  'influence:vision': '理想布道者',
  'resilience:risk': '绝境赌徒',
  'resilience:vision': '不灭理想',
  'trust:vision': '有原则的理想家',
  'business:influence': '流量生意',
  'craft:trust': '用户信徒'
});

/**
 * 获取天赋的主要玩法倾向。未声明 special 的数值天赋按最高正向初始属性归类。
 */
export function getTalentArchetype(talent) {
  if (!talent) return 'growth';
  if (talent.special && SPECIAL_ARCHETYPES[talent.special]) {
    return SPECIAL_ARCHETYPES[talent.special];
  }
  const candidates = [
    ['resilience', talent.effects.pressureMax || 0],
    ['trust', talent.effects.trust || 0],
    ['influence', talent.effects.reputation || 0],
    ['business', talent.effects.wealth || 0],
    ['vision', talent.effects.pride || 0]
  ];
  candidates.sort((a, b) => b[1] - a[1]);
  return candidates[0][1] > 0 ? candidates[0][0] : 'growth';
}

/**
 * 将两张天赋组合成一个玩家可记忆、可分享的人生底色。
 */
export function getTalentCombination(talents) {
  if (!Array.isArray(talents) || talents.length < TALENT_PICK_COUNT) return null;
  const selected = talents.slice(0, TALENT_PICK_COUNT);
  const archetypes = selected.map(getTalentArchetype).sort();
  const [first, second] = archetypes;
  const firstInfo = ARCHETYPE_INFO[first] || ARCHETYPE_INFO.growth;
  const secondInfo = ARCHETYPE_INFO[second] || ARCHETYPE_INFO.growth;
  const key = `${first}:${second}`;
  const title = first === second
    ? firstInfo.same
    : (COMBINATION_TITLES[key] || `${firstInfo.name}与${secondInfo.name}`);
  return {
    id: key,
    title,
    desc: `${selected[0].name} × ${selected[1].name}，共同塑造这一局的人生底色。`,
    archetypes
  };
}

/**
 * 应用天赋效果到初始状态
 * @param {object} baseState - 基础初始状态
 * @param {array} talents - 选中的天赋数组
 * @returns {object} 修改后的状态
 */
export function applyTalentEffects(baseState, talents) {
  const state = { ...baseState };
  // 存储天赋 special 列表，供效果引擎读取
  state.talentSpecials = [...new Set(talents.map(t => t.special).filter(Boolean))];
  state.talentCombo = getTalentCombination(talents);
  for (const talent of talents) {
    const e = talent.effects;
    if (e.pride) state.pride = (state.pride ?? 5) + e.pride;
    if (e.wealth) state.wealth = (state.wealth ?? 5) + e.wealth;
    if (e.reputation) state.reputation = (state.reputation ?? 5) + e.reputation;
    if (e.pressure) state.pressure = (state.pressure ?? 0) + e.pressure;
    if (e.trust) state.trust = (state.trust ?? 5) + e.trust;
    if (e.pressureMax) state.pressureMax = (state.pressureMax ?? 10) + e.pressureMax;
    if (e.failurePenalty) state.failurePenalty = e.failurePenalty;
    if (e.successBonus) state.successBonus = e.successBonus;
  }
  // 钳制属性范围
  state.pride = Math.max(0, Math.min(10, state.pride));
  state.wealth = Math.max(0, Math.min(10, state.wealth));
  state.reputation = Math.max(0, Math.min(10, state.reputation));
  state.trust = Math.max(0, Math.min(10, state.trust));
  state.pressure = Math.max(0, Math.min(state.pressureMax || 10, state.pressure));

  // replay_bonus: 多周目游戏初始属性额外 +1
  if (state.talentSpecials.includes('replay_bonus')) {
    try {
      const playCount = parseInt(localStorage.getItem('luohammer_play_count') || '0', 10);
      if (playCount > 0) {
        state.pride = Math.min(10, state.pride + 1);
        state.wealth = Math.min(10, state.wealth + 1);
        state.reputation = Math.min(10, state.reputation + 1);
        state.trust = Math.min(10, state.trust + 1);
      }
    } catch(e) {}
  }

  return state;
}

export const ACHIEVEMENT_HUNTER_MAX_BONUSES = 5;

const ACHIEVEMENT_HUNTER_ATTRS = [
  { key: 'pride', name: '理想' },
  { key: 'wealth', name: '财富' },
  { key: 'reputation', name: '名声' },
  { key: 'trust', name: '信任' }
];

/**
 * 应用“成就猎人”被动：每次解锁成就时，将当前最低的基础属性 +1。
 * 采用最低属性优先，避免把已经领先的属性继续滚雪球；每局最多触发 5 次。
 *
 * @param {object} baseState 当前游戏状态
 * @returns {{ state: object, applied: boolean, attr?: string, attrName?: string, count?: number, newValue?: number }}
 */
export function applyAchievementHunterBonus(baseState) {
  const specials = baseState.talentSpecials || [];
  if (!specials.includes('achievement_hunter_bonus')) {
    return { state: baseState, applied: false };
  }

  const currentCount = Number.isInteger(baseState.achievementHunterBonusCount)
    ? Math.max(0, baseState.achievementHunterBonusCount)
    : 0;
  if (currentCount >= ACHIEVEMENT_HUNTER_MAX_BONUSES) {
    return { state: baseState, applied: false };
  }

  const candidates = ACHIEVEMENT_HUNTER_ATTRS.filter(({ key }) => (baseState[key] ?? 5) < 10);
  if (candidates.length === 0) {
    return { state: baseState, applied: false };
  }

  const target = candidates.reduce((lowest, candidate) => {
    const lowestValue = baseState[lowest.key] ?? 5;
    const candidateValue = baseState[candidate.key] ?? 5;
    return candidateValue < lowestValue ? candidate : lowest;
  });

  const state = { ...baseState };
  state[target.key] = Math.min(10, (state[target.key] ?? 5) + 1);
  state.achievementHunterBonusCount = currentCount + 1;

  return {
    state,
    applied: true,
    attr: target.key,
    attrName: target.name,
    count: state.achievementHunterBonusCount,
    newValue: state[target.key]
  };
}
