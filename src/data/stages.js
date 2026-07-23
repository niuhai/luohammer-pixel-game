/**
 * 阶段定义
 * 
 * 每个阶段的结构：
 * {
 *   id: string,           // 阶段ID
 *   name: string,         // 阶段名称
 *   period: string,       // 时间段
 *   sceneType: string,    // 默认场景类型
 *   nodes: [string],      // 该阶段的主线节点ID列表
 *   randomEventChance: number, // 每个节点触发随机事件的概率 (0-1)
 *   settlement: {         // 阶段结算规则
 *     text: string,       // 结算描述
 *     checks: [           // 属性检查
 *       { attr: string, min: number, max: number, result: string, effects: object }
 *     ]
 *   }
 * }
 */

export const STAGES = [
  {
    id: 'youth',
    name: '延边少年',
    period: '1972-1989',
    sceneType: 'classroom',
    nodes: ['intro', 'act0_childhood', 'act0_b', 'act0_street', 'act0_korea', 'act0_gre', 'act0_dad', 'act0_rebel', 'act0_bookstore', 'act0_fail1', 'act0_fail2', 'act0_fail3', 'act0_korea_life', 'act0_grandma', 'act0_mother', 'act0_neighbor', 'act0_confusion', 'act0_reading', 'act0_identity', 'act0_grandma_story', 'act0_first_love', 'act0_night_reading'],
    randomEventChance: 0.2,
    settlement: {
      text: '少年时代结束了。你从延边的小城出发，带着一身反骨和满腔热血。',
      checks: [
        { attr: 'pride', min: 7, max: 10, result: '你的理想主义已经刻进骨子里了。', effects: { trust: 1 } },
        { attr: 'wealth', min: 0, max: 2, result: '你穷得叮当响，但你不在乎。', effects: { pride: 1 } },
        { attr: 'reputation', min: 0, max: 3, result: '你默默无闻，但暗流涌动。', effects: { pressure: 1 } },
        { attr: 'pressure', min: 5, max: 10, result: '你已经开始感受到生活的重压。', effects: { pride: -1 } },
        { attr: 'failures', min: 1, max: 99, result: '你已经尝到了失败的滋味。', effects: { pressure: 1 } },
      ]
    }
  },
  {
    id: 'teacher',
    name: '新东方名师',
    period: '2000-2006',
    sceneType: 'lecture',
    nodes: ['act1_first', 'act1_second', 'act1_a', 'act1_quotes', 'act1_fame', 'act1_resign', 'act1_preputation', 'act1_nerve', 'act1_yu', 'act1_quote1', 'act1_quote2', 'act1_conflict', 'act1_dilemma', 'act1_last_class'],
    randomEventChance: 0.25,
    settlement: {
      text: '新东方时代结束了。你从无名小卒变成了"老罗"，但你知道这还不是终点。',
      checks: [
        { attr: 'reputation', min: 7, max: 10, result: '你已经是网红了，但网红不是你的终点。', effects: { pride: 1 } },
        { attr: 'pressure', min: 7, max: 10, result: '你快撑不住了，但辞职的念头越来越强。', effects: { pressure: 2 } },
        { attr: 'wealth', min: 6, max: 10, result: '你赚到了第一桶金，但钱不是你的追求。', effects: { pride: -1 } },
        { attr: 'trust', min: 7, max: 10, result: '学生和家长都信任你，这是最珍贵的。', effects: { reputation: 1 } },
        { attr: 'pride', min: 0, max: 3, result: '你学会了妥协，但妥协的代价是失去了自己。', effects: { pressure: 1 } },
      ]
    }
  },
  {
    id: 'startup',
    name: '锤子科技',
    period: '2012-2018',
    sceneType: 'office',
    nodes: ['act2_a', 'act2_censor1', 'act2_fight', 'act2_launch', 'act2_writer', 'act2_b', 'act2_down', 'act2_censor2', 'act2_gone', 'act2_school', 'act2_student', 'act2_poster', 'act2_dream', 'act_fridge_start', 'act_fridge_plan', 'act_fridge_discover', 'act_fridge_smash', 'act_fridge_fight', 'act_fridge_theater', 'act_fridge_media', 'act_fridge_hammer', 'act_fridge_weibo', 'act_fang_start', 'act_fang_tweet', 'act_fang_report', 'act_fang_attack', 'act_fang_evidence', 'act_fang_court', 'act3_a', 'act3_lei', 'act3_lei_chat', 'act3_register', 'act3_investor', 'act3_tangyan', 'act3_b', 'act3_os_night', 'act3_rom', 'act3_team', 'act3_crossroads', 'act3_review', 'act4_a', 'act4_launch', 'act4_wangziru', 'act4_price', 'act4_yield', 'act4_if', 'act4_songri', 'act4_factory', 'act4_zhongtian', 'act4_b', 'act4_wait', 'act4_rival', 'act4_rescue', 'act5_a', 'act5_alibaba', 'act5_people', 'act5_m1', 'act5_abandon', 'act5_qianchen', 'act5_nutpro', 'act5_chengdu', 'act5_b', 'act6_a', 'act6_bird', 'act6_tnt_dev', 'act6_cashflow', 'act6_debt_grow', 'act6_layoff', 'act6_crash'],
    randomEventChance: 0.35,
    settlement: {
      text: '锤子时代结束了。你做了手机，做了TNT，做了所有你想做的事——但市场不买账。',
      checks: [
        { attr: 'pride', min: 8, max: 10, result: '你从未妥协，但代价是6亿债务。', effects: { pressure: 3 } },
        { attr: 'wealth', min: 0, max: 2, result: '你赔光了所有钱，但你还有理想。', effects: { failures: 1 } },
        { attr: 'trust', min: 7, max: 10, result: '你的用户依然相信你，这是最珍贵的。', effects: { reputation: 1 } },
        { attr: 'reputation', min: 0, max: 3, result: '你的名声跌到了谷底，“行业冥灯”的称号不胫而走。', effects: { pressure: 2 } },
        { attr: 'pressure', min: 7, max: 10, result: '你快被压力压垮了，但你还撑着。', effects: { pride: 1 } },
        { attr: 'failures', min: 3, max: 99, result: '你已经翻车三次了，但锤子还在。', effects: { trust: -1 } },
      ]
    }
  },
  {
    id: 'dark',
    name: '至暗时刻',
    period: '2018-2020',
    sceneType: 'court',
    nodes: ['act6_supplier', 'act6_supplier_detail', 'act6_guarantee', 'act6_debt', 'act6_night', 'act6_office_empty', 'act6_lawyer', 'act6_bytedance', 'act7_smoke', 'act7_vape_ban', 'act7_shark', 'act7_vape_launch', 'act7_sharklet', 'act7_sharklet_pitch', 'act7_sharklet_fail', 'act7_meme', 'act7_restrict', 'act6_phone_call', 'act6_old_friend', 'act6_restriction_notice', 'act6_daughter', 'act6_supplier_oldwang', 'act6_mirror', 'act6_midnight_walk', 'act6_creditor_call', 'act6_self_doubt'],
    randomEventChance: 0.3,
    settlement: {
      text: '至暗时刻。6亿债务压在肩上，限制消费令贴在身上，全世界都在看你的笑话。',
      checks: [
        { attr: 'pressure', min: 8, max: 10, result: '你快要崩溃了，但你不能倒下。', effects: { pride: -1 } },
        { attr: 'pride', min: 7, max: 10, result: '你依然骄傲，这是你唯一的武器。', effects: { trust: 1 } },
        { attr: 'wealth', min: 0, max: 1, result: '你身无分文，6亿债务像一座山。', effects: { pressure: 3 } },
        { attr: 'trust', min: 0, max: 3, result: '没有人再相信你了，连你自己都开始怀疑。', effects: { pride: -1 } },
        { attr: 'failures', min: 4, max: 99, result: '你已经翻车四次了，但你还站着。', effects: { reputation: -1 } },
      ]
    }
  },
  {
    id: 'repay',
    name: '真还传',
    period: '2020-2022',
    sceneType: 'livestream',
    nodes: ['act7_sign', 'act7_lamp', 'act7_first_live', 'act7_contract', 'act7_first_stream', 'act7_b', 'act7_jimi', 'act7_stream_daily', 'act7_apologize', 'act7_talkshow', 'act7_debt_first', 'act7_debt_half', 'act7_debt_interest', 'act7_debt_progress', 'act7_payback', 'act7_retire_reason', 'act7_retire_post', 'act7_retire_day1', 'act7_retire', 'act7_low_viewers', 'act7_quality_issue', 'act7_first_100m', 'act7_reunion', 'act7_warm_moment', 'act7_health', 'act7_first_paycheck', 'act7_haters', 'act7_milestone_100m'],
    randomEventChance: 0.25,
    settlement: {
      text: '真还传。你用直播还了4亿，用脱口秀赢得了尊重，用行动证明了"欠债还钱"。',
      checks: [
        { attr: 'trust', min: 7, max: 10, result: '公众信任你了，这是无价的。', effects: { reputation: 1 } },
        { attr: 'wealth', min: 5, max: 10, result: '你终于不再为钱发愁了。', effects: { pressure: -2 } },
        { attr: 'pride', min: 7, max: 10, result: '你依然骄傲，这是你还债的动力。', effects: { trust: 1 } },
        { attr: 'failures', min: 3, max: 99, result: '你翻车多次，但每一次都让你更强大。', effects: { pressure: 1 } },
        { attr: 'reputation', min: 0, max: 3, result: '你的名声还没恢复，但你在努力。', effects: { pressure: 1 } },
      ]
    }
  },
  {
    id: 'reborn',
    name: '新的十字路口',
    period: '2022-2025',
    sceneType: 'podcast',
    nodes: ['act8_thinred', 'act8_a', 'act8_ar_dream', 'act8_funding', 'act8_ar_fail', 'act8_team_build', 'act8_ar_vision', 'act8_ar_apple', 'act8_ai', 'act8_j1', 'act8_market', 'act8_layoff', 'act8_podcast', 'act8_podcast_ep1', 'act8_podcast_ep2', 'act8_podcast_guest', 'act8_podcast_ep3', 'act8_spring', 'act8_spring_detail', 'act8_spring_preputation', 'act8_spring_stage', 'act8_liang', 'act8_qieting', 'act8_reflect', 'act8_b', 'act9_reflect', 'act9_choice', 'act9_legacy', 'act9_final'],
    randomEventChance: 0.2,
    settlement: {
      text: '新的十字路口。AR梦碎、AI转型、播客重启——你还在折腾，还在选择。',
      checks: [
        { attr: 'pride', min: 7, max: 10, result: '你依然是个理想主义者，这可能是你最大的武器。', effects: { pressure: 1 } },
        { attr: 'wealth', min: 7, max: 10, result: '你终于有了资本，但资本是手段不是目的。', effects: { pride: -1 } },
        { attr: 'trust', min: 7, max: 10, result: '公众重新信任你了，这是你用真还传换来的。', effects: { reputation: 1 } },
        { attr: 'pressure', min: 7, max: 10, result: '你还在焦虑，还在折腾，但这就是你。', effects: { pride: 1 } },
      ]
    }
  }
];

/**
 * 根据节点ID查找所属阶段
 */
export function getStageByNodeId(nodeId) {
  for (const stage of STAGES) {
    if (stage.nodes.includes(nodeId)) return stage;
  }
  return null;
}

/**
 * 获取当前阶段
 */
export function getCurrentStage(state) {
  const nodeId = state.currentNode;
  return getStageByNodeId(nodeId);
}
