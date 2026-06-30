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
    effects: { failurePenalty: 0.5, successBonus: 2 }
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
    desc: '"成就越多，实力越强（解锁30个成就解锁）"',
    icon: '★',
    rarity: 'legendary',
    effects: { pride: 1, wealth: 1, reputation: 1, trust: 1 },
    special: 'achievement_hunter_bonus'
  }
];

/**
 * 按稀有度随机抽取N个天赋
 * @param {number} count - 抽取数量
 * @param {object} options - 选项
 * @param {boolean} options.guaranteeRare - 是否保底至少一个稀有
 * @returns {array} 天赋对象数组
 */
export function drawTalents(count = 3, options = {}) {
  const pool = [...TALENTS];
  const result = [];

  // 稀有度权重：common 60%, rare 30%, legendary 10%
  const rarityWeights = { common: 60, rare: 30, legendary: 10 };

  // 如果保底稀有，先抽一个稀有/传说
  if (options.guaranteeRare && count > 1) {
    const rarePool = pool.filter(t => t.rarity !== 'common');
    const rareWeights = rarePool.map(t => rarityWeights[t.rarity]);
    const totalW = rareWeights.reduce((a, b) => a + b, 0);
    let roll = Math.random() * totalW;
    for (let i = 0; i < rarePool.length; i++) {
      roll -= rareWeights[i];
      if (roll <= 0) {
        result.push(rarePool[i]);
        pool.splice(pool.indexOf(rarePool[i]), 1);
        break;
      }
    }
  }

  // 剩余按权重抽取
  while (result.length < count && pool.length > 0) {
    const weights = pool.map(t => rarityWeights[t.rarity]);
    const totalW = weights.reduce((a, b) => a + b, 0);
    let roll = Math.random() * totalW;
    for (let i = 0; i < pool.length; i++) {
      roll -= weights[i];
      if (roll <= 0) {
        result.push(pool[i]);
        pool.splice(i, 1);
        break;
      }
    }
  }

  return result;
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
  state.talentSpecials = talents.map(t => t.special).filter(Boolean);
  for (const talent of talents) {
    const e = talent.effects;
    if (e.pride) state.pride = (state.pride || 5) + e.pride;
    if (e.wealth) state.wealth = (state.wealth || 5) + e.wealth;
    if (e.reputation) state.reputation = (state.reputation || 5) + e.reputation;
    if (e.pressure) state.pressure = (state.pressure || 0) + e.pressure;
    if (e.trust) state.trust = (state.trust || 5) + e.trust;
    if (e.pressureMax) state.pressureMax = (state.pressureMax || 10) + e.pressureMax;
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
