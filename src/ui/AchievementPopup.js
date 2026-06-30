// 隐藏成就定义
// score 字段：成就积分。普通10 / 稀有25 / 隐藏50 / 特殊100。
// 未显式声明 score 的隐藏成就默认 50；普通成就默认 10。
export const HIDDEN_ACHIEVEMENTS = {
  parallel_universe: { name: '平行宇宙', icon: '◯', desc: '跨周目在同一节点选择不同选项3次以上', score: 50 },
  luo_possessed:     { name: '老罗附体', icon: '☠', desc: '理想主义属性达到9', score: 50 },
  speedrunner:       { name: '速通玩家', icon: '⚡', desc: '60分钟内通关一局游戏', score: 50 },
  try_again_billion: { name: '再来亿次', icon: '↻', desc: '累计游玩5次以上，且每次选择不同天赋', score: 50 },
  social_butterfly:  { name: '社交达人', icon: '◈', desc: '单局触发5次以上随机事件', score: 50 },
  easter_egg:        { name: '彩蛋猎人', icon: '◊', desc: '解锁1个隐藏结局', score: 50 },
  // ===== 新增隐藏成就 =====
  pressure_cooker:   { name: '压力锅', icon: '◉', desc: '压力值达到上限但未崩溃（需钢铁意志天赋）', score: 50 },
  zero_to_hero:      { name: '从零到英雄', icon: '▲', desc: '财富属性从0升到8以上', score: 50 },
  trust_fall:        { name: '信任崩塌', icon: '♥', desc: '公众信任属性降到0', score: 50 },
  all_rounder:       { name: '全能选手', icon: '★', desc: '理想/财富/名声/信任四项同时达到6以上', score: 50 },
  dark_horse:        { name: '黑马', icon: '◇', desc: '通关时四项属性均值低于4，且达成非默认结局', score: 50 },
  collector:         { name: '成就收藏家', icon: '▣', desc: '解锁50个以上成就（含至少5个隐藏）', score: 100 },
  phoenix_rise:      { name: '涅槃重生', icon: '▲', desc: '翻车4次后仍达成好结局', score: 50 },
  contrarian_path:   { name: '逆向人生', icon: '↺', desc: '全程选择理想主义加成最低的选项', score: 50 },
  debt_free_speed:   { name: '光速还债', icon: '¤', desc: '从至暗阶段到真还传阶段结束前还清所有债务', score: 50 },
  perfect_run:       { name: '完美人生', icon: '★', desc: '单局游戏翻车不超过1次', score: 50 }
};

// 所有已知成就的完整定义（普通成就从 story choices 中整理）
export const ALL_ACHIEVEMENTS = {
  // 普通成就（来自 story choices）
  rebel_youth       : { name: '叛逆少年', icon: '♪', desc: '在序章选择从延边二中退学，走上叛逆之路。' },
  street_uni        : { name: '社会大学', icon: '◄', desc: '高中退学后选择混社会，把街头当作真正的课堂。' },
  stall_guerrilla   : { name: '地摊游击队', icon: '◄', desc: '摆地摊被城管驱赶后，换个地方继续和城管打游击。' },
  skewer_master     : { name: '烤串大师', icon: '◊', desc: '在延边夜市把烤串练成一门手艺，相信干啥都能成。' },
  ten_k_letter      : { name: '万字求职信', icon: '✉', desc: '破釜沉舟只投新东方，用万字求职信打动俞敏洪。' },
  three_tries       : { name: '三试不退', icon: '▲', desc: '新东方试讲两次失败后，仍坚持争取第三次机会。' },
  born_lecturer     : { name: '天生讲师', icon: '♪', desc: '通过新东方试讲，正式成为GRE讲师。' },
  quote_guru        : { name: '语录教父', icon: '♪', desc: '把课堂段子打磨成招牌语录，成为“老罗语录”源头。' },
  education_light   : { name: '教育之光', icon: '▤', desc: '在新东方时期选择投身教育改革。' },
  last_lesson       : { name: '最后一课', icon: '★', desc: '辞去新东方工作，向讲台和学生告别。' },
  idealist          : { name: '理想主义者', icon: '▲', desc: '离开新东方后创办牛博网，投身理想主义写作平台。' },
  no_compromise     : { name: '不妥协', icon: '⚔', desc: '牛博网面临压力时拒绝删帖，守住内容底线。' },
  copywriter_god    : { name: '文案之神', icon: '✎', desc: '在牛博网写下西门子冰箱维权檄文，一战封神。' },
  rights_fighter    : { name: '维权斗士', icon: '◉', desc: '决定向西门子维权，为消费者讨要说法。' },
  rational_rights   : { name: '理性维权者', icon: '⚖', desc: '选择走法律途径，起诉西门子。' },
  smash_fridge      : { name: '砸冰箱', icon: '◆', desc: '在西门子总部当众砸冰箱，把维权变成公共事件。' },
  hammer_inspire    : { name: '锤子灵感', icon: '✦', desc: '从砸冰箱的锤子中获得灵感，决定用它命名手机品牌。' },
  iron_hammer       : { name: '铁锤罗', icon: '▣', desc: '组织更大规模的砸冰箱活动，把维权推向高潮。' },
  hammer_born       : { name: '锤子诞生', icon: '▦', desc: '正式宣布公司名为“锤子科技”。' },
  just_do_it        : { name: '不要怂就是干', icon: '▲', desc: '决定自己创业做手机，900万也敢注册公司。' },
  makeshift_team    : { name: '草台班子', icon: '◉', desc: '带着英语老师和设计师，硬着头皮组队做手机。' },
  crossroad         : { name: '十字路口', icon: '✚', desc: '在“科技与人文”的十字路口，选择两者都要。' },
  product_proof     : { name: '产品力证明', icon: '✦', desc: '拿到融资后全力投入Smartisan T1研发。' },
  gongsun_hao       : { name: '公孙浩', icon: '◇', desc: '坚持T1售价不低于2500，死撑高端定位。' },
  if_gold           : { name: 'iF金奖', icon: '★', desc: '借iF设计金奖之势为产品和品牌造势。', score: 25 },
  never_compromise  : { name: '永不妥协', icon: '◆', desc: '宁可公司倒闭，也不发布不够完美的产品。' },
  supply_chain_killer: { name: '供应链杀手', icon: '✕', desc: '因供应链问题与富士康决裂，另寻出路。' },
  t2_rescue         : { name: 'T2抢救', icon: '▣', desc: '在T2艰难上市后，坚持让它留在牌桌上。' },
  iron_ceo          : { name: '铁腕CEO', icon: '▣', desc: '进行人事换血，引入能打硬仗的新鲜血液。' },
  endure_humiliation: { name: '忍辱负重', icon: '◉', desc: '为了生存向现实低头，承受外界的嘲讽。' },
  capital_power     : { name: '资本的力量', icon: '▣', desc: '接受成都10亿投资，用资本为公司续命。' },
  anti_fake         : { name: '打假打假者', icon: '▤', desc: '实名举报方舟子，公开对峙“打假者”。' },
  fight_to_end      : { name: '死磕到底', icon: '⚖', desc: '对方舟子索赔案追查到底，不肯和解。' },
  last_stand        : { name: '背水一战', icon: '▦', desc: '在鸟巢发布会上押注TNT，孤注一掷。' },
  quiet             : { name: '安静！', icon: '◉', desc: 'TNT演示现场要求观众“安静”，造就名场面。' },
  real_man          : { name: '真·汉子', icon: '▣', desc: '面对6亿债务选择不破产，个人扛下还款责任。' },
  industry_curse    : { name: '行业冥灯', icon: '☠', desc: '连续在多个风口踩雷，被调侃为“行业冥灯”。' },
  let_go_pride      : { name: '放下身段', icon: '◄', desc: '签约抖音直播带货，弯下腰卖货还债。' },
  make_friend       : { name: '交个朋友', icon: '◈', desc: '认真做带货主播，成立“交个朋友”直播间。' },
  word_power        : { name: '文字的力量', icon: '✎', desc: '选择把人生经历写成一本书。' },
  first_payment     : { name: '第一笔', icon: '¤', desc: '直播带货还清第一笔大额债务。' },
  traffic_king      : { name: '流量之王', icon: '▦', desc: '在短视频与直播时代成为顶级流量。' },
  talkshow_king     : { name: '脱口秀之王', icon: '♪', desc: '在脱口秀舞台上大放异彩，回归表达者本色。' },
  true_repay        : { name: '真还传', icon: '¤', desc: '通过直播等方式开始偿还巨额债务。' },
  true_repay_final  : { name: '真还传·终章', icon: '▤', desc: '还清全部债务，完成“真还传”。' },
  last_idealist     : { name: '最后的理想主义者', icon: '✦', desc: '在创业末期仍坚持理想主义底色。' },
  hermit            : { name: '归隐山林', icon: '▲', desc: '选择退出江湖，去大理隐居。' },
  ai_prophet        : { name: 'AI先知', icon: '▦', desc: '在AI浪潮中继续押注科技未来。' },
  pass_torch        : { name: '薪火相传', icon: '◈', desc: '从创业者转型为创业导师，帮助年轻人少走弯路。' },
  podcast_king      : { name: '播客之王', icon: '♪', desc: '坚持做播客，把表达变成新阵地。' },
  let_go_obsession  : { name: '放下执念', icon: '~', desc: '选择AI软件+播客+稳步前进，不再孤注一掷。' },
  never_give_up     : { name: '永不言弃', icon: '▲', desc: '决定最后再做一次硬件，重新冲锋。' },
  reconcile         : { name: '与世界和解', icon: '~', desc: '选择放下对抗，以平和心态结束这一章。' },
  debt_free         : { name: '无债一身轻', icon: '¤', desc: '扛下6亿债务后终于还清，信用重生。' },
  comeback_king     : { name: '东山再起', icon: '♔', desc: '在低谷后重新创业，试图王者归来。' },
  idealist_forever  : { name: '永远的理想主义者', icon: '★', desc: '无论成败，始终未改理想主义底色。' },
  pragmatist        : { name: '现实主义者', icon: '◈', desc: '在关键节点选择最务实、最理性的出路。' },
  digital_blogger   : { name: '数码博主', icon: '▦', desc: '选择成为数码博主，用嘴继续战斗。' },
  monk_name         : { name: '法号志恒', icon: '◯', desc: '看破红尘，选择出家修行。' },
  luo_returns       : { name: '罗老师回来了', icon: '◄', desc: '集齐砸冰箱、真还传、天生骄傲等标志后选择回归。' },
  luo_foundation    : { name: '罗老师基金会', icon: '✦', desc: '选择投身公益，用影响力资助贫困学生。' },
  // ===== 新增普通成就（元游戏/里程碑/探索类） =====
  first_steps       : { name: '迈出第一步', icon: '◇', desc: '完成序章，正式踏上创业之路。' },
  stage_2           : { name: '初露锋芒', icon: '✦', desc: '进入第二阶段，在新东方站稳脚跟。' },
  stage_3           : { name: '锋芒毕露', icon: '⚡', desc: '进入第三阶段，成为公众人物。' },
  stage_4           : { name: '锤子精神', icon: '▣', desc: '进入第四阶段，创办锤子科技。' },
  stage_5           : { name: '风雨飘摇', icon: '~', desc: '进入第五阶段，在困境中挣扎求存。' },
  stage_6           : { name: '真还传·序', icon: '▤', desc: '进入第六阶段，开始偿还巨额债务。' },
  ending_explorer   : { name: '结局探索者', icon: '◄', desc: '累计解锁5个不同结局。' },
  ending_master     : { name: '结局大师', icon: '★', desc: '累计解锁10个不同结局。', score: 25 },
  ending_completionist: { name: '全结局收集', icon: '♔', desc: '解锁全部35个结局。', score: 100 },
  high_idealist     : { name: '理想主义之巅', icon: '▲', desc: '理想主义属性达到10。', score: 25 },
  tycoon_wannabe    : { name: '小富即安', icon: '¤', desc: '财富属性达到8。', score: 25 },
  famous            : { name: '家喻户晓', icon: '▦', desc: '名声属性达到9。', score: 25 },
  trusted           : { name: '深得人心', icon: '◈', desc: '公众信任属性达到9。', score: 25 },
  failure_king      : { name: '翻车之王', icon: '✕', desc: '单局游戏翻车3次以上。' },
  comeback          : { name: '王者归来', icon: '♔', desc: '在属性低谷后重新崛起到高位。', score: 25 },
  korea_survivor    : { name: '韩国打工人', icon: '◈', desc: '在韩国打工期间熬过最艰难的日子。' },
  english_master    : { name: '英语大师', icon: '✎', desc: '在新东方成为顶级讲师。' },
  blog_pioneer      : { name: '博客先驱', icon: '◯', desc: '创办牛博网，成为互联网意见领袖。' },
  hammer_fan        : { name: '锤粉', icon: '▦', desc: '连续两次选择支持锤子产品线。' },
  livestream_star   : { name: '直播新星', icon: '♪', desc: '首次尝试直播带货并获得成功。' },
  debt_reducer      : { name: '还债进行时', icon: '✕', desc: '债务减少超过50%。' },
  multi_talent      : { name: '多面手', icon: '◉', desc: '同时选中两个不同稀有度的天赋。' },
  rare_finder       : { name: '欧皇', icon: '◊', desc: '天赋选择时抽到传说级天赋。' },
  // 隐藏成就


  ...HIDDEN_ACHIEVEMENTS
};

/**
 * 组合成就定义
 * 当玩家同时满足 requires 中的成就组合，或满足 condition 函数时解锁。
 * requires 中的名称必须匹配现有成就的 name 字段。
 */
export const COMBO_ACHIEVEMENTS = [
  {
    id: 'combo_rebel_fridge',
    name: '叛逆之路',
    desc: '同时拥有"叛逆少年"和"砸冰箱"成就',
    requires: ['叛逆少年', '砸冰箱'],
    score: 50,
    icon: '▲'
  },
  {
    id: 'combo_speaker_entrepreneur',
    name: '从讲师到企业家',
    desc: '同时拥有"天生讲师"和"锤子诞生"成就',
    requires: ['天生讲师', '锤子诞生'],
    score: 50,
    icon: '♪'
  },
  {
    id: 'combo_fall_rise',
    name: '跌倒与崛起',
    desc: '同时拥有"背水一战"和"真还传"成就',
    requires: ['背水一战', '真还传'],
    score: 50,
    icon: '▲'
  },
  {
    id: 'combo_collector_half',
    name: '半收集者',
    desc: '解锁35个普通成就',
    requires: null,
    condition: (ctx) => ctx.normalCount >= 35,
    score: 100,
    icon: '▤'
  },
  {
    id: 'combo_hidden_master',
    name: '隐藏大师',
    desc: '解锁10个隐藏成就',
    requires: null,
    condition: (ctx) => ctx.hiddenCount >= 10,
    score: 100,
    icon: '◉'
  },
  {
    id: 'combo_all_ender',
    name: '全结局达成',
    desc: '解锁全部35个结局',
    requires: null,
    condition: (ctx) => ctx.endingCount >= 35,
    score: 200,
    icon: '♔'
  },
  {
    id: 'combo_idealist_pragmatist',
    name: '理想与现实',
    desc: '同时拥有"永远的理想主义者"和"现实主义者"成就',
    requires: ['永远的理想主义者', '现实主义者'],
    score: 50,
    icon: '⚖'
  },
  {
    id: 'combo_zero_hero',
    name: '从零到英雄',
    desc: '同时拥有"背水一战"和"涅槃重生"成就',
    requires: ['背水一战', '涅槃重生'],
    score: 50,
    icon: '◇'
  },
  // ===== 任务要求新增的组合成就（requires 使用成就 ID） =====
  {
    id: 'combo_rebel_to_hammer',
    name: '从叛逆到锤子',
    icon: '▣',
    desc: '同时拥有「叛逆少年」和「锤子诞生」',
    requires: ['rebel_youth', 'hammer_born'],
    score: 30
  },
  {
    id: 'combo_idealist_to_debt',
    name: '理想主义的代价',
    icon: '¤',
    desc: '同时拥有「理想主义者」和「背水一战」',
    requires: ['idealist', 'last_stand'],
    score: 30
  },
  {
    id: 'combo_smash_to_court',
    name: '从砸冰箱到法庭',
    icon: '⚖',
    desc: '同时拥有「砸冰箱」和「死磕到底」',
    requires: ['smash_fridge', 'fight_to_end'],
    score: 30
  },
  {
    id: 'combo_full_journey',
    name: '完整人生路',
    icon: '✦',
    desc: '同时拥有「叛逆少年」「天生讲师」「锤子诞生」「背水一战」',
    requires: ['rebel_youth', 'born_lecturer', 'hammer_born', 'last_stand'],
    score: 100,
    hidden: true
  }
];

/**
 * 根据成就名查找成就定义
 */
export function findAchievementDef(name) {
  for (const def of Object.values(ALL_ACHIEVEMENTS)) {
    if (def.name === name) return def;
  }
  // 也在组合成就中查找
  for (const def of COMBO_ACHIEVEMENTS) {
    if (def.name === name) return def;
  }
  return null;
}

/**
 * 判断是否是隐藏成就
 */
export function isHiddenAchievement(name) {
  for (const def of Object.values(HIDDEN_ACHIEVEMENTS)) {
    if (def.name === name) return true;
  }
  return false;
}

/**
 * 判断是否是组合成就
 */
export function isComboAchievement(name) {
  return COMBO_ACHIEVEMENTS.some(def => def.name === name);
}

/**
 * 根据成就名获取积分：
 * - 显式声明 score 字段则直接返回
 * - 隐藏成就默认 50
 * - 普通成就默认 10
 * - 组合成就返回其 score
 * @param {string} name - 成就名称
 * @returns {number}
 */
export function getAchievementScore(name) {
  // 先在普通/隐藏成就中查找
  for (const def of Object.values(ALL_ACHIEVEMENTS)) {
    if (def.name === name) {
      if (typeof def.score === 'number') return def.score;
      return isHiddenAchievement(name) ? 50 : 10;
    }
  }
  // 组合成就
  for (const def of COMBO_ACHIEVEMENTS) {
    if (def.name === name) {
      return def.score || 50;
    }
  }
  return 0;
}

/**
 * 计算已解锁成就列表的总积分。
 * 遍历已解锁成就列表，对每个成就查找其 score（普通成就默认10，隐藏默认50，特殊100）。
 * 同时累加已解锁组合成就的积分。
 *
 * @param {Array<string|object>} unlockedList - 已解锁成就列表，元素可以是成就名称字符串或包含 name 字段的对象
 * @returns {number} 总积分
 */
export function calculateAchievementScore(unlockedList) {
  if (!Array.isArray(unlockedList)) return 0;
  let total = 0;
  for (const item of unlockedList) {
    const name = typeof item === 'string' ? item : (item && item.name);
    if (!name) continue;
    total += getAchievementScore(name);
  }
  // 累加已解锁组合成就的积分
  const combos = loadComboAchievements();
  for (const combo of combos) {
    total += combo.score || 0;
  }
  return total;
}

/**
 * 从 localStorage 读取已解锁组合成就列表
 */
export function loadComboAchievements() {
  try {
    const raw = localStorage.getItem('luohammer_combo_achievements');
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

/**
 * 保存已解锁组合成就列表到 localStorage
 */
export function saveComboAchievements(list) {
  try {
    localStorage.setItem('luohammer_combo_achievements', JSON.stringify(list));
  } catch (e) {}
}

/**
 * 增量追加一个组合成就到 localStorage
 */
export function addComboAchievementToStorage(combo) {
  const list = loadComboAchievements();
  if (!list.some(a => a.id === combo.id || a.name === combo.name)) {
    list.push({
      id: combo.id,
      name: combo.name,
      icon: combo.icon,
      desc: combo.desc,
      score: combo.score,
      unlockedAt: Date.now()
    });
    saveComboAchievements(list);
  }
}

/**
 * 检查组合成就解锁状态。
 * 遍历 COMBO_ACHIEVEMENTS，根据已解锁成就名称集合和数量上下文判断是否新解锁。
 *
 * @param {object} ctx - 上下文
 * @param {Set<string>|Array<string>} ctx.unlockedNames - 已解锁成就名称集合
 * @param {number} [ctx.normalCount] - 已解锁普通成就数量
 * @param {number} [ctx.hiddenCount] - 已解锁隐藏成就数量
 * @param {number} [ctx.endingCount] - 已解锁结局数量
 * @returns {Array<object>} 本次新解锁的组合成就定义数组
 */
export function checkComboAchievements(ctx) {
  const unlockedNames = ctx.unlockedNames instanceof Set
    ? ctx.unlockedNames
    : new Set(ctx.unlockedNames || []);
  // 构建 ID → name 映射，支持 requires 使用成就 ID（如 'rebel_youth'）
  const idToName = {};
  for (const [id, def] of Object.entries(ALL_ACHIEVEMENTS)) {
    idToName[id] = def.name;
  }
  const already = loadComboAchievements();
  const alreadyIds = new Set(already.map(a => a.id));
  const newlyUnlocked = [];

  for (const combo of COMBO_ACHIEVEMENTS) {
    if (alreadyIds.has(combo.id)) continue;

    let satisfied = false;
    if (Array.isArray(combo.requires) && combo.requires.length > 0) {
      // 支持 requires 中使用成就 ID 或名称：ID 先解析为名称再匹配
      satisfied = combo.requires.every(identifier => {
        const resolvedName = idToName[identifier] || identifier;
        return unlockedNames.has(resolvedName);
      });
    } else if (typeof combo.condition === 'function') {
      try {
        satisfied = !!combo.condition({
          unlockedNames,
          normalCount: ctx.normalCount || 0,
          hiddenCount: ctx.hiddenCount || 0,
          endingCount: ctx.endingCount || 0
        });
      } catch (e) {
        satisfied = false;
      }
    }

    if (satisfied) {
      addComboAchievementToStorage(combo);
      newlyUnlocked.push(combo);
    }
  }

  return newlyUnlocked;
}

/**
 * 从 localStorage 读取已解锁成就列表
 */
export function loadUnlockedAchievements() {
  try {
    const raw = localStorage.getItem('luohammer_achievements');
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

/**
 * 保存已解锁成就列表到 localStorage
 */
export function saveUnlockedAchievements(list) {
  try {
    localStorage.setItem('luohammer_achievements', JSON.stringify(list));
  } catch (e) {}
}

/**
 * 增量追加一个成就到 localStorage
 */
export function addAchievementToStorage(name, icon, isHidden) {
  const list = loadUnlockedAchievements();
  if (!list.some(a => a.name === name)) {
    list.push({ name, icon, isHidden, unlockedAt: Date.now() });
    saveUnlockedAchievements(list);
  }
}

/**
 * 从 localStorage 读取已解锁隐藏结局列表
 */
export function loadUnlockedHiddenEndings() {
  try {
    const raw = localStorage.getItem('luohammer_hidden_endings');
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

/**
 * 保存已解锁隐藏结局列表到 localStorage
 */
export function saveUnlockedHiddenEndings(list) {
  try {
    localStorage.setItem('luohammer_hidden_endings', JSON.stringify(list));
  } catch (e) {}
}

/**
 * 增量追加一个隐藏结局到 localStorage
 */
export function addHiddenEndingToStorage(endingKey) {
  const list = loadUnlockedHiddenEndings();
  if (!list.includes(endingKey)) {
    list.push(endingKey);
    saveUnlockedHiddenEndings(list);
  }
}

/**
 * 从 localStorage 读取所有已解锁结局（含普通+隐藏），用于结局收集成就
 */
export function loadAllUnlockedEndings() {
  try {
    const raw = localStorage.getItem('luohammer_all_endings');
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

/**
 * 增量追加一个结局到 localStorage，返回当前累计解锁数
 */
export function addEndingToStorage(endingKey) {
  const list = loadAllUnlockedEndings();
  if (!list.includes(endingKey)) {
    list.push(endingKey);
    try { localStorage.setItem('luohammer_all_endings', JSON.stringify(list)); } catch (e) {}
  }
  return list.length;
}

// 标记样式是否已注入
let _stylesInjected = false;

/**
 * 动态注入成就弹窗所需的 CSS 样式（只注入一次）
 */
function _injectStyles() {
  if (_stylesInjected) return;
  _stylesInjected = true;

  const style = document.createElement('style');
  style.id = 'achievement-popup-styles';
  style.textContent = `
    .achievement-popup {
      position: fixed;
      top: 15vh;
      left: 50%;
      transform: translateX(-50%) translateY(-200%);
      max-width: min(90vw, 360px);
      width: 320px;
      background: var(--color-bg-panel);
      border: 1px solid var(--color-gold);
      color: var(--color-gold);
      font-family: var(--font-mono), "Courier New", monospace;
      padding: 12px 14px;
      display: flex;
      align-items: flex-start;
      gap: 10px;
      z-index: 9999;
      opacity: 0;
      pointer-events: none;
      box-sizing: border-box;
      transition: transform 0.3s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.3s ease;
    }

    .achievement-popup.hidden-achievement {
      border-color: var(--color-pressure);
      transition: transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.5s ease;
    }

    .achievement-popup.visible {
      opacity: 1;
    }

    .achievement-popup.slide-in {
      transform: translateX(-50%) translateY(0);
    }

    .achievement-popup.slide-out {
      transform: translateX(-50%) translateY(-200%);
      opacity: 0;
    }

    /* 四角 L 形装饰 */
    .achievement-popup-corner {
      position: absolute;
      width: 8px;
      height: 8px;
      border-color: var(--color-gold);
      border-style: solid;
      border-width: 0;
      pointer-events: none;
    }
    .achievement-popup.hidden-achievement .achievement-popup-corner {
      border-color: var(--color-pressure);
    }
    .achievement-popup-corner-tl { top: -1px; left: -1px; border-top-width: 2px; border-left-width: 2px; }
    .achievement-popup-corner-tr { top: -1px; right: -1px; border-top-width: 2px; border-right-width: 2px; }
    .achievement-popup-corner-bl { bottom: -1px; left: -1px; border-bottom-width: 2px; border-left-width: 2px; }
    .achievement-popup-corner-br { bottom: -1px; right: -1px; border-bottom-width: 2px; border-right-width: 2px; }

    .achievement-popup-icon {
      font-size: 28px;
      line-height: 1;
      flex-shrink: 0;
    }

    .achievement-popup-content {
      flex: 1;
      min-width: 0;
    }

    .achievement-popup-label {
      font-size: 8px;
      color: var(--color-text-secondary);
      letter-spacing: 1px;
      margin-bottom: 2px;
    }

    .achievement-popup-name {
      font-size: 13px;
      color: var(--color-gold);
      font-weight: 700;
      margin-bottom: 2px;
      word-wrap: break-word;
    }
    .achievement-popup.hidden-achievement .achievement-popup-name {
      color: var(--color-pressure);
    }

    .achievement-popup-desc {
      font-size: 10px;
      color: var(--color-text-secondary);
      word-wrap: break-word;
      line-height: 1.3;
    }

    /* 闪光条扫光 */
    .achievement-popup-shine {
      position: absolute;
      top: 0;
      left: 0;
      width: 4px;
      height: 100%;
      background: rgba(255, 255, 255, 0.4);
      opacity: 0;
      pointer-events: none;
    }
    .achievement-popup.shine-sweep .achievement-popup-shine {
      animation: achievementShineSweep 0.3s linear forwards;
    }
    .achievement-popup.hidden-achievement.shine-sweep .achievement-popup-shine {
      animation: achievementShineSweep 0.5s linear forwards;
      background: rgba(255, 255, 255, 0.7);
    }
    @keyframes achievementShineSweep {
      0% { left: 0; opacity: 1; }
      100% { left: 100%; opacity: 0; }
    }

    /* 普通成就金色边框光晕脉冲（双脉冲） */
    .achievement-popup.glow {
      animation: achievementBorderGlow 1.1s ease-out forwards;
    }
    @keyframes achievementBorderGlow {
      0% { box-shadow: 0 0 0 0 rgba(240, 192, 64, 0.6); }
      36% { box-shadow: 0 0 8px 2px rgba(240, 192, 64, 0.2); }
      55% { box-shadow: 0 0 8px 2px rgba(240, 192, 64, 0.8); }
      100% { box-shadow: 0 0 0 0 rgba(240, 192, 64, 0); }
    }

    /* 隐藏成就整体闪烁（6次） */
    .achievement-popup.blink {
      animation: achievementBlink 1.2s steps(1, end) forwards;
    }
    @keyframes achievementBlink {
      0% { opacity: 1; }
      16.67% { opacity: 0.4; }
      33.33% { opacity: 1; }
      50% { opacity: 0.4; }
      66.67% { opacity: 1; }
      83.33% { opacity: 0.4; }
      100% { opacity: 1; }
    }

    /* 隐藏成就金色光环扩散 */
    .achievement-golden-ring {
      position: absolute;
      top: 50%;
      left: 50%;
      width: 20px;
      height: 20px;
      border: 2px solid var(--color-gold);
      border-radius: 50%;
      transform: translate(-50%, -50%) scale(1);
      opacity: 0.8;
      pointer-events: none;
      animation: achievementGoldenRing 0.8s cubic-bezier(0.22, 1, 0.36, 1) forwards;
    }
    @keyframes achievementGoldenRing {
      0% { transform: translate(-50%, -50%) scale(1); opacity: 0.8; }
      100% { transform: translate(-50%, -50%) scale(6); opacity: 0; }
    }

    /* 隐藏成就全屏闪光覆盖层 */
    .achievement-flash-overlay {
      position: fixed;
      inset: 0;
      background: rgba(240, 192, 64, 0.7);
      opacity: 0;
      pointer-events: none;
      z-index: 9998;
      transition: opacity 0.15s linear;
    }
    .achievement-flash-overlay.active {
      opacity: 0.7;
    }
  `;
  document.head.appendChild(style);
}

export class AchievementPopup {
  constructor(scene) {
    this.scene = scene;
    this._timers = [];
    this._visible = false;

    _injectStyles();

    // 构建弹窗 DOM
    this.el = document.createElement('div');
    this.el.className = 'achievement-popup';
    this.el.id = 'achievement-popup';
    this.el.innerHTML = `
      <span class="achievement-popup-corner achievement-popup-corner-tl"></span>
      <span class="achievement-popup-corner achievement-popup-corner-tr"></span>
      <span class="achievement-popup-corner achievement-popup-corner-bl"></span>
      <span class="achievement-popup-corner achievement-popup-corner-br"></span>
      <span class="achievement-popup-icon">★</span>
      <div class="achievement-popup-content">
        <div class="achievement-popup-label">成就解锁</div>
        <div class="achievement-popup-name"></div>
        <div class="achievement-popup-desc"></div>
      </div>
      <span class="achievement-popup-shine"></span>
    `;
    document.body.appendChild(this.el);

    this.iconEl = this.el.querySelector('.achievement-popup-icon');
    this.labelEl = this.el.querySelector('.achievement-popup-label');
    this.nameEl = this.el.querySelector('.achievement-popup-name');
    this.descEl = this.el.querySelector('.achievement-popup-desc');

    // 隐藏成就全屏闪光覆盖层
    this.flashOverlay = document.createElement('div');
    this.flashOverlay.className = 'achievement-flash-overlay';
    document.body.appendChild(this.flashOverlay);
  }

  /**
   * 显示成就弹窗
   * @param {string} name - 成就名称
   * @param {string} icon - 成就图标
   * @param {boolean} hidden - 是否是隐藏成就
   */
  show(name, icon, hidden = false) {
    this._clearTimers();
    this._resetState();

    const def = findAchievementDef(name);
    this.iconEl.textContent = icon || '★';
    this.nameEl.textContent = name;
    this.descEl.textContent = def?.desc || '';
    this.labelEl.textContent = hidden ? '隐藏成就解锁' : '成就解锁';
    this.el.classList.toggle('hidden-achievement', !!hidden);

    // DOM 层金色粒子飞散效果（所有成就解锁时触发）
    this._playDOMParticleBurst();

    // 隐藏成就：先播放全屏闪光，再滑入
    if (hidden) {
      this._playFlashEffect(() => {
        this._slideIn(hidden);
      });
    } else {
      this._slideIn(hidden);
    }
  }

  /**
   * 全屏闪光效果（隐藏成就专属）
   */
  _playFlashEffect(onComplete) {
    // 屏幕震动（复用 Phaser 场景的相机震动，不属于弹窗自身的 Phaser 资源）
    if (this.scene && this.scene.cameras && this.scene.cameras.main) {
      try { this.scene.cameras.main.shake(600, 0.008); } catch (e) {}
    }

    // 闪烁 3 次
    let flashCount = 0;
    const maxFlashes = 3;

    const doFlash = () => {
      if (flashCount >= maxFlashes) {
        this.flashOverlay.classList.remove('active');
        if (onComplete) this._addTimer(onComplete, 0);
        return;
      }

      this.flashOverlay.classList.add('active');
      this._addTimer(() => {
        this.flashOverlay.classList.remove('active');
        flashCount++;
        if (flashCount < maxFlashes) {
          this._addTimer(doFlash, 50);
        } else {
          if (onComplete) this._addTimer(onComplete, 0);
        }
      }, 150);
    };

    doFlash();
  }

  /**
   * 从上方滑入动画
   */
  _slideIn(hidden) {
    this._visible = true;
    this.el.classList.add('visible');

    // 触发滑入过渡
    requestAnimationFrame(() => {
      this.el.classList.add('slide-in');
    });

    const slideDuration = hidden ? 500 : 300;

    // 滑入完成后播放特效
    this._addTimer(() => {
      this.el.classList.remove('slide-in');

      if (hidden) {
        // 隐藏成就：整体闪烁 + 金色光环
        this.el.classList.add('blink');
        this._playGoldenRing();
      } else {
        // 普通成就：金色边框光晕脉冲
        this.el.classList.add('glow');
      }

      // 闪光条扫光
      this.el.classList.add('shine-sweep');

      // 3 秒后自动滑出
      this._addTimer(() => {
        this.hide();
      }, 3000);
    }, slideDuration);
  }

  /**
   * 隐藏成就金色光环效果（从弹窗中心向外扩散的金色圆环）
   */
  _playGoldenRing() {
    const ring = document.createElement('div');
    ring.className = 'achievement-golden-ring';
    this.el.appendChild(ring);
    this._addTimer(() => {
      if (ring.parentNode) ring.parentNode.removeChild(ring);
    }, 800);
  }

  /**
   * DOM 层金色粒子飞散效果（使用 CSS animation，不依赖 Phaser 定时器）
   */
  _playDOMParticleBurst() {
    const overlay = document.getElementById('achievement-particles-overlay');
    if (!overlay) return;
    const count = 16;
    const originX = window.innerWidth - 80;
    const originY = 40;
    for (let i = 0; i < count; i++) {
      const p = document.createElement('div');
      p.className = 'achievement-particle';
      const angle = (Math.PI * 2 / count) * i + Math.random() * 0.5;
      const dist = 40 + Math.random() * 80;
      const tx = Math.cos(angle) * dist + 'px';
      const ty = Math.sin(angle) * dist + 'px';
      p.style.left = originX + 'px';
      p.style.top = originY + 'px';
      p.style.setProperty('--tx', tx);
      p.style.setProperty('--ty', ty);
      overlay.appendChild(p);
      const onAnimationEnd = () => {
        if (p.parentNode) p.parentNode.removeChild(p);
        p.removeEventListener('animationend', onAnimationEnd);
      };
      p.addEventListener('animationend', onAnimationEnd);
    }
  }

  /**
   * 隐藏弹窗（淡出 + 上移）
   */
  hide() {
    this._clearTimers();
    this.el.classList.remove('slide-in', 'glow', 'blink', 'shine-sweep');
    this.el.classList.add('slide-out');

    this._addTimer(() => {
      this.el.classList.remove('visible', 'slide-out', 'hidden-achievement');
      this._visible = false;
    }, 300);
  }

  /**
   * 重置弹窗到初始状态
   */
  _resetState() {
    this.el.classList.remove(
      'visible', 'slide-in', 'slide-out', 'hidden-achievement',
      'glow', 'blink', 'shine-sweep'
    );
    // 移除残留的金色光环
    const rings = this.el.querySelectorAll('.achievement-golden-ring');
    rings.forEach(r => r.remove());
    this.flashOverlay.classList.remove('active');
  }

  /**
   * 添加定时器并记录，便于统一清理
   */
  _addTimer(fn, delay) {
    const id = setTimeout(fn, delay);
    this._timers.push(id);
    return id;
  }

  /**
   * 清理所有定时器
   */
  _clearTimers() {
    for (const t of this._timers) {
      clearTimeout(t);
    }
    this._timers = [];
  }

  /**
   * 销毁资源，防止内存泄漏
   */
  destroy() {
    this._clearTimers();
    if (this.el && this.el.parentNode) {
      this.el.parentNode.removeChild(this.el);
    }
    this.el = null;
    if (this.flashOverlay && this.flashOverlay.parentNode) {
      this.flashOverlay.parentNode.removeChild(this.flashOverlay);
    }
    this.flashOverlay = null;
    this.scene = null;
  }
}
