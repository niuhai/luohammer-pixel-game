/**
 * 结局定义
 * 
 * 每个结局的结构：
 * {
 *   id: string,           // 唯一标识
 *   name: string,         // 结局名称
 *   subtitle: string,     // 副标题
 *   desc: string,         // 结局描述
 *   respect: string,      // 尊重点（为什么这个结局值得尊重）
 *   icon: string,         // emoji图标
 *   check: function,      // 触发条件检查函数 (state, flags) => boolean
 *   priority: number,     // 优先级（数字越大越优先匹配）
 *   sceneType: string,    // 结局场景类型
 * }
 */

export const ENDINGS = [
  {
    id: 'legend',
    name: '传奇',
    subtitle: '偏执到底，终成传奇',
    desc: '你从未向现实低头。你赔光了钱，失去了朋友，被全世界嘲笑——但你的名字，写进了历史。不是因为成功，而是因为坚持。',
    respect: '坚持的代价是孤独，但孤独是传奇的门票',
    icon: '★',
    priority: 10,
    sceneType: 'ending',
    check: (state, flags) => state.pride >= 8 && (state.failures || 0) >= 2 && state.wealth < 3
  },
  {
    id: 'tycoon',
    name: '大亨',
    subtitle: '放弃理想，拥抱资本',
    desc: '你终于学会了妥协。钱赚到了，公司上市了，但你偶尔会在深夜想起那个砸冰箱的年轻人。他去了哪里？',
    respect: '现实不是妥协，是另一种清醒',
    icon: '¤',
    priority: 8,
    sceneType: 'ending',
    check: (state, flags) => state.wealth >= 8 && state.pride < 3
  },
  {
    id: 'warrior',
    name: '战士',
    subtitle: '屡败屡战，公众英雄',
    desc: '你输了一次又一次，但每次都站起来了。人们不再嘲笑你，他们开始敬佩你。不是因为成功，而是因为勇气。',
    respect: '跌倒不可怕，站起来才了不起',
    icon: '⚔',
    priority: 9,
    sceneType: 'ending',
    check: (state, flags) => state.pride >= 7 && state.reputation >= 7 && (state.failures || 0) >= 2
  },
  {
    id: 'scapegoat',
    name: '替罪羊',
    subtitle: '众叛亲离',
    desc: '所有人都离开了。员工、朋友、粉丝——一个接一个。你站在空荡荡的办公室里，终于明白：有些仗，一个人打不赢。',
    respect: '有时候不是你做错了，是时代没站在你这边',
    icon: '◇',
    priority: 7,
    sceneType: 'ending',
    check: (state, flags) => state.reputation < 2 && (state.failures || 0) >= 3
  },
  {
    id: 'balance',
    name: '平衡',
    subtitle: '完美人生',
    desc: '理想与现实，你找到了平衡点。没有大起大落，没有惊天动地，但每一步都稳稳当当。这是最难走的路——因为人生没有完美。',
    respect: '最难达成的结局——因为人生没有完美',
    icon: '⚖',
    priority: 12,
    sceneType: 'ending',
    check: (state, flags) => state.pride >= 6 && state.wealth >= 6 && state.reputation >= 6 && state.trust >= 6 && (state.failures || 0) <= 2
  },
  {
    id: 'rational',
    name: '理性',
    subtitle: '看透本质，选择务实',
    desc: '你终于想明白了：理想不是不要，是要不起。你选择了最务实的路，虽然不够浪漫，但至少不会饿死。',
    respect: '理性不是冷血，是另一种勇气',
    icon: '◈',
    priority: 6,
    sceneType: 'ending',
    check: (state, flags) => state.pride >= 5 && state.wealth <= 3 && (state.failures || 0) >= 3
  },
  {
    id: 'supply_chain',
    name: '供应链',
    subtitle: '被现实磨平',
    desc: '你曾经以为自己是例外，后来发现不是。你变成了自己最讨厌的那种人——但至少，你活着。',
    respect: '大多数人的结局，不代表失败',
    icon: '▣',
    priority: 5,
    sceneType: 'ending',
    check: (state, flags) => state.wealth >= 4 && state.pride <= 3 && (state.failures || 0) >= 2
  },
  {
    id: 'talkshow_star',
    name: '脱口秀之星',
    subtitle: '回归表达者本色',
    desc: '你发现，你最擅长的不是做产品，是说话。你回到了舞台，回到了聚光灯下，回到了你最自在的地方。',
    respect: '天生就是说话的人',
    icon: '♪',
    priority: 8,
    sceneType: 'ending',
    check: (state, flags) => state.reputation >= 8 && state.pride >= 5
  },
  {
    id: 'ai_visionary',
    name: 'AI远见者',
    subtitle: '赶上新时代',
    desc: '你终于踩对了时代的节拍。AI浪潮来了，你冲在最前面。这一次，你不再是被时代抛弃的人，而是引领时代的人。',
    respect: '活着就要向前看',
    icon: '▦',
    priority: 7,
    sceneType: 'ending',
    check: (state, flags) => state.wealth >= 7 && state.reputation >= 5 && state.pride <= 4
  },
  {
    id: 'phoenix',
    name: '浴火重生',
    subtitle: '真还传本传',
    desc: '6亿债务，你一分不少地还清了。全世界都在看你的笑话，你用行动堵住了所有人的嘴。这就是真还传。',
    respect: '最老罗的结局——跌到底，再站起来',
    icon: '▲',
    priority: 11,
    sceneType: 'ending',
    check: (state, flags) => state.pride >= 7 && (state.failures || 0) >= 3 && state.wealth >= 4 && flags.has('honest_repay')
  },
  {
    id: 'hermit',
    name: '隐士',
    subtitle: '看破红尘',
    desc: '你选择了退出。不再发微博，不再开发布会，不再和任何人争论。你终于安静了。也许，这才是你一直在寻找的。',
    respect: '放下也是一种选择',
    icon: '▲',
    priority: 9,
    sceneType: 'ending',
    check: (state, flags) => state.pressure <= 0 && flags.has('retired')
  },
  {
    id: 'peace',
    name: '和平',
    subtitle: '平凡但安稳',
    desc: '没有传奇，没有大起大落，但也没有遗憾。你过上了普通人的生活，偶尔想起当年的疯狂，会心一笑。',
    respect: '平凡不是平庸',
    icon: '~',
    priority: 3,
    sceneType: 'ending',
    check: (state, flags) => {
      const attrs = [state.pride, state.wealth, state.reputation, state.trust];
      return attrs.every(a => a >= 3 && a <= 6) && (state.failures || 0) <= 2;
    }
  },
  {
    id: 'survivor',
    name: '幸存者',
    subtitle: '活着就好',
    desc: '你活下来了。仅此而已。但在这个世界上，活着本身就是最大的胜利。',
    respect: '活着本身就是胜利',
    icon: '◈',
    priority: 2,
    sceneType: 'ending',
    check: (state, flags) => (state.failures || 0) >= 4
  },
  {
    id: 'craftsman',
    name: '工匠传奇',
    subtitle: '像素级完美主义',
    desc: '你做到了。你做出了世界上最完美的手机——虽然只有100个人买。但那100个人，和你一样，相信完美是存在的。',
    respect: '极致的代价是极致的孤独',
    icon: '▣',
    priority: 10,
    sceneType: 'ending',
    check: (state, flags) => state.pride >= 9 && flags.has('persist_premium')
  },
  {
    id: 'scholar',
    name: '延边教师',
    subtitle: '书香人生',
    desc: '你听从父母安排读完大学，成为一名英语老师。平淡但安稳，你偶尔会想：如果当年退学了会怎样？',
    respect: '人生的分岔路口，选择了稳妥就意味着放弃了可能',
    icon: '▤',
    priority: 3,
    sceneType: 'ending',
    check: (state, flags) => state.pride <= 2 && state.wealth >= 2 && state.wealth <= 4 && !flags.has('started_business')
  },
  {
    id: 'ordinary',
    name: '平凡之路',
    subtitle: '延边大叔',
    desc: '你折腾累了，找了份稳定工作。摆摊、打工、偶尔教书。日子一天天过去，你成为了一个普通但快乐的人。',
    respect: '不是每个人都要改变世界，有些人只是想平安地度过一生',
    icon: '▣',
    priority: 2,
    sceneType: 'ending',
    check: (state, flags) => state.pride <= 2 && state.wealth <= 3 && state.reputation <= 2
  },
  {
    id: 'comfort',
    name: '新东方之光',
    subtitle: '舒适区',
    desc: '你留在了新东方，年薪五六十万，有房有车有粉丝。你成了最好的英语老师之一，但不再折腾了。',
    respect: '舒适区里有舒适区的代价——你永远不会知道自己能走多远',
    icon: '▤',
    priority: 3,
    sceneType: 'ending',
    check: (state, flags) => state.wealth >= 4 && state.pride <= 3 && flags.has('stayed_xinfang')
  },
  {
    id: 'xiaomi',
    name: '小米产品经理',
    subtitle: '借势起飞',
    desc: '你加入了小米，成为雷军的得力助手。你没有创立自己的公司，但你参与了国产手机的崛起。',
    respect: '站在巨人肩膀上，你看到了更远的风景——但那终究不是你自己的山',
    icon: '▦',
    priority: 4,
    sceneType: 'ending',
    check: (state, flags) => flags.has('joined_xiaomi') && state.wealth >= 3 && state.pride <= 3
  },
  {
    id: 'retreat',
    name: '知难而退',
    subtitle: '提前离场',
    desc: 'Smartisan OS 发布会失败后，你放弃做硬件，回到英语培训行业。你成了一名成功的教育创业者，但再也没有碰过手机。',
    respect: '放弃不是软弱，有时候是对现实最清醒的认知',
    icon: '◄',
    priority: 3,
    sceneType: 'ending',
    check: (state, flags) => state.pride <= 2 && state.wealth >= 2 && flags.has('gave_up_hardware')
  },
  {
    id: 'bankrupt_early',
    name: '理想殉道者',
    subtitle: 'M1拒绝妥协',
    desc: '你不愿意发布一款"长得像 iPhone"的产品，砍掉了 M1。锤子科技现金流断裂，公司破产。你负债千万，但你说："至少我没抄。"',
    respect: '宁为玉碎，不为瓦全——但玉碎之后，就没有然后了',
    icon: '♥',
    priority: 4,
    sceneType: 'ending',
    check: (state, flags) => state.pride >= 5 && state.wealth <= 1 && flags.has('killed_m1')
  },
  {
    id: 'escape',
    name: '破产清算',
    subtitle: '理性离场',
    desc: '你按公司法申请破产清算，个人只承担了担保部分。法律上你没有错——但那些信任你的供应商、员工、用户，永远记住了这一天。',
    respect: '合法的不一定合情。理性选择背后，是多少人的失望',
    icon: '▣',
    priority: 3,
    sceneType: 'ending',
    check: (state, flags) => state.pride <= 2 && state.reputation <= 2 && flags.has('declared_bankruptcy')
  },
  {
    id: 'moderate_success',
    name: '稳健派',
    subtitle: '成都十亿',
    desc: '你接受成都10亿投资，但保守使用资金，all in 下一代手机，不做TNT。坚果手机销量稳步增长，公司盈利。你成了一个正常的、成功的 CEO——但再也没有那个砸冰箱的激情了。',
    respect: '成熟意味着学会克制。但克制的代价，是失去棱角',
    icon: '▦',
    priority: 4,
    sceneType: 'ending',
    check: (state, flags) => state.wealth >= 5 && state.pride <= 4 && flags.has('conservative_funding')
  },
  {
    id: 'anchor',
    name: '直播一哥',
    subtitle: '交个朋友',
    desc: '债还完了，你选择继续直播带货。交个朋友成为了业内头部MCN，你成为了中国最好的带货主播之一。有人说你"堕落了"，但你知道——你只是在赚钱。',
    respect: '能放下身段赚钱，本身就是一种了不起的能力',
    icon: '▦',
    priority: 4,
    sceneType: 'ending',
    check: (state, flags) => state.wealth >= 4 && state.pride <= 3 && flags.has('continued_livestream')
  },
  {
    id: 'comeback',
    name: '真还传·第二部',
    subtitle: '永不言弃',
    desc: '你决定最后再做一次硬件——一款真正属于未来的智能硬件。你再次举债，再次组建团队，再次站在发布会舞台上。有人说你疯了，你说："我只是还没死心。"',
    respect: '他倒下过无数次，但每一次他都站了起来——带着更大的野心',
    icon: '▲',
    priority: 5,
    sceneType: 'ending',
    check: (state, flags) => state.pride >= 6 && state.reputation >= 5 && flags.has('final_comeback')
  },
  {
    id: 'educator',
    name: '教育改革家',
    subtitle: '改变一代人',
    desc: '你放弃了科技创业，回到教育行业。但这次不是培训学校——你创办了一所真正不一样的学校。没有考试，没有排名，只有对知识的热爱和对人的尊重。',
    respect: '教育不是灌满一桶水，而是点燃一把火',
    icon: '▤',
    priority: 5,
    sceneType: 'ending',
    check: (state, flags) => state.trust >= 5 && state.reputation >= 4 && flags.has('education_reform')
  },
  {
    id: 'writer',
    name: '畅销书作家',
    subtitle: '文字的力量',
    desc: '你把所有经历写成了一本书。它不是自传，而是一部关于理想主义者的寓言。出乎意料地，这本书成了年度畅销书，被翻译成二十多种语言。',
    respect: '笔比锤子更有力——至少不会砸坏冰箱',
    icon: '✎',
    priority: 5,
    sceneType: 'ending',
    check: (state, flags) => state.pride >= 4 && state.reputation >= 4 && flags.has('wrote_book')
  },
  {
    id: 'influencer',
    name: '超级网红',
    subtitle: '流量之王',
    desc: '你成了全网粉丝最多的KOL。每条微博转发过万，每场直播观看破亿。你不再需要做产品——你自己就是最大的产品。',
    respect: '当你的声音能被一亿人听到，你说的每一句话都是产品',
    icon: '✦',
    priority: 4,
    sceneType: 'ending',
    check: (state, flags) => state.reputation >= 6 && state.wealth >= 4 && flags.has('became_influencer')
  },
  {
    id: 'mentor',
    name: '创业导师',
    subtitle: '薪火相传',
    desc: '你不再自己创业，而是成了年轻创业者的导师。你用自己踩过的坑照亮别人的路。你的学员中有人做出了独角兽，有人在纳斯达克敲钟。',
    respect: '一个人走得快，一群人走得远',
    icon: '◈',
    priority: 5,
    sceneType: 'ending',
    check: (state, flags) => state.trust >= 5 && state.reputation >= 4 && flags.has('mentor')
  },
  {
    id: 'idealist',
    name: '理想国',
    subtitle: '永不妥协',
    desc: '你一辈子都没有妥协过。产品不够完美就不发布，投资人要求你做你不认同的事就拒绝。你没有成为最成功的企业家，但你是唯一一个从未背叛自己的人。',
    respect: '世界上只有一种英雄主义——认清生活真相后依然热爱它',
    icon: '◆',
    priority: 5,
    sceneType: 'ending',
    check: (state, flags) => state.pride >= 8 && state.wealth <= 3 && flags.has('never_compromised')
  },
  {
    id: 'venture_capitalist',
    name: '投资人',
    subtitle: '站在另一边',
    desc: '你从创业者变成了投资人。你投了50个项目，其中3个成了独角兽。你终于理解了当年那些拒绝你的投资人——他们不是不懂你，只是看到了你没看到的风险。',
    respect: '最好的复仇是成功，最好的成功是帮助别人成功',
    icon: '▣',
    priority: 4,
    sceneType: 'ending',
    check: (state, flags) => state.wealth >= 5 && state.reputation >= 3 && flags.has('became_investor')
  },
  {
    id: 'tech_blogger',
    name: '数码博主',
    subtitle: '评测界的相声演员',
    desc: '你放下了做产品的执念，拿起手机、相机和那张停不下来的嘴，成为了一名数码博主。你的评测不像评测，像单口相声——厂商一边怕你一边求你，粉丝说"看老罗评测比看发布会还爽"。你不再需要赌上身家去做硬件，你只需要对别人的产品指指点点。',
    respect: '做不了改变世界的产品，就做一面照妖镜',
    icon: '▦',
    priority: 3,
    sceneType: 'ending',
    check: (state, flags) => flags.has('became_tech_blogger')
  },
  {
    id: 'rights_fighter',
    name: '维权斗士',
    subtitle: '大厂克星',
    desc: '你没有选择和解，也没有选择沉默。从西门子冰箱到某大厂虚假宣传，你一场接一场地打维权官司，把自己活成了消费者心中最硬的靠山。你赢了一些，输了一些，赔了不少律师费，但你说："有些事，总得有人做。"',
    respect: '一个人对抗巨头是傻，一群人袖手旁观是冷漠',
    icon: '⚖',
    priority: 3,
    sceneType: 'ending',
    check: (state, flags) => flags.has('public_feud_champion')
  },
  {
    id: 'monk',
    name: '出家',
    subtitle: '法号志恒',
    desc: '你把钱捐了大半，把微博停了，把发布会的话筒交了出去，只身走进了一座山里的寺庙。你法号"志恒"——志向的志，恒心的恒。晨钟暮鼓里，你偶尔也会想起砸冰箱的那个下午，但不再心动。',
    respect: '不是不爱了，是终于知道：彪悍的人生不需要解释',
    icon: '◯',
    priority: 3,
    sceneType: 'ending',
    check: (state, flags) => flags.has('became_monk')
  },
  {
    id: 'returns',
    name: '罗老师回来了',
    subtitle: '全成就彩蛋',
    desc: '你本以为自己已经说完了一切，直到某天深夜，你打开了尘封多年的硬盘。里面存着新东方课堂的录音、牛博网被拔线的截图、锤子T1发布会的后台视频、砸冰箱时碎玻璃的反光灯斑、直播间里那条"真还传"的弹幕截图……你忽然意识到，这一路上的每一个成就、每一次翻车、每一句金句，都是同一个人在不同年纪留下的脚印。',
    respect: '重要的不是回来多少次，而是每次出去之后，都还记得回来的路',
    icon: '◄',
    priority: 6,
    sceneType: 'ending',
    // 跨周目技能「真·归来」解锁后，_unlockedEndings 包含 'ending_returns_alt' 时也可触发
    check: (state, flags) => flags.has('luo_teacher_returns') ||
      (Array.isArray(state._unlockedEndings) && state._unlockedEndings.includes('ending_returns_alt'))
  },
  {
    id: 'philanthropist',
    name: '罗老师基金会',
    subtitle: '教育之光',
    desc: '你还清了债，拒绝了所有高溢价的商业代言。你用剩下的钱和名声创办了一个教育基金，专门资助那些和你当年一样读不起书、但还不肯认输的孩子。十年后，一个受助学生考上了北大，她在采访里说："是罗老师让我相信，穷不是命，认输才是。"',
    respect: '真正的骄傲，不是一个人站着，而是帮更多人站起来',
    icon: '✦',
    priority: 3,
    sceneType: 'ending',
    check: (state, flags) => flags.has('philanthropy_champion')
  }
];

/**
 * 结局模糊提示映射表
 *
 * 提示原则：
 * - 不直接透露结局名称
 * - 给出触发条件的模糊暗示
 * - 激励玩家尝试不同的选择路径
 */
export const ENDING_HINTS = {
  legend: '偏执到底，哪怕赔光失去一切也要坚持',
  tycoon: '放下骄傲，拥抱资本',
  warrior: '屡败屡战，终成公众英雄',
  scapegoat: '众叛亲离的至暗时刻',
  balance: '所有属性均衡且从不翻车——最难走的路',
  rational: '经历多次失败后，选择最务实的路',
  supply_chain: '被现实磨平棱角',
  talkshow_star: '回归表达者本色',
  ai_visionary: '赶上新时代的浪潮',
  phoenix: '真还传——跌到底，再站起来',
  hermit: '压力归零，选择退出',
  peace: '平凡但安稳的人生',
  survivor: '活着本身就是胜利',
  craftsman: '像素级完美主义，极致的孤独',
  scholar: '不创业，安分读书',
  ordinary: '折腾累了，回归平凡',
  comfort: '留在舒适区，不再折腾',
  xiaomi: '加入大公司，借势起飞',
  retreat: '知难而退，放弃硬件',
  bankrupt_early: '坚持理想，不顾现实',
  escape: '破产清算，理性离场',
  moderate_success: '保守用钱，稳健经营',
  anchor: '继续直播带货之路',
  comeback: '最后再做一次硬件',
  educator: '回到教育行业，但不止于培训',
  writer: '把经历写成文字',
  influencer: '成为流量之王',
  mentor: '做年轻人的引路人',
  idealist: '永不妥协的理想主义者',
  venture_capitalist: '从创业者变成投资人',
  tech_blogger: '放下做产品的执念',
  rights_fighter: '为大厂维权',
  monk: '看破红尘',
  returns: '集齐真还传+精品路线+最终反思',
  philanthropist: '用财富回馈教育',
};

/**
 * 根据游戏状态匹配结局
 * @param {object} state - 游戏状态
 * @param {Set} flags - 远期标记集合
 * @returns {object|null} 匹配的结局，优先级最高的
 */
export function matchEnding(state, flags) {
  const matched = ENDINGS
    .filter(e => e.check(state, flags))
    .sort((a, b) => b.priority - a.priority);
  return matched.length > 0 ? matched[0] : null;
}
