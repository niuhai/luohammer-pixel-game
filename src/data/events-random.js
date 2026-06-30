/**
 * 随机事件池
 *
 * 每个随机事件的结构：
 * {
 *   id: string,           // 唯一标识
 *   stage: string,        // 所属阶段：youth/teacher/startup/dark/repay/reborn
 *   trigger: {            // 触发条件（属性阈值）
 *     pride?: [min, max],     // 理想主义范围
 *     wealth?: [min, max],   // 财富范围
 *     reputation?: [min, max], // 名声范围
 *     failures?: number,     // 翻车次数最小值
 *     pressure?: [min, max],  // 压力范围
 *     trust?: [min, max],     // 公众信任范围
 *   },
 *   weight: number,       // 权重（越高越容易触发）
 *   text: string,         // 事件描述
 *   choices: [             // 2个选项
 *     {
 *       label: string,
 *       effects: { pride?, wealth?, reputation?, pressure?, trust?, fail? },
 *       effectVariance?: { ... }, // 效果随机波动，与 effects 叠加
 *       flag?: string,     // 远期标记
 *     },
 *     {
 *       label: string,
 *       effects: { ... },
 *       effectVariance?: { ... },
 *       flag?: string,
 *     }
 *   ],
 *   onceOnly: boolean,    // 是否只触发一次
 *   hidden?: boolean,     // 是否为隐藏事件（触发条件更苛刻，通常需要特定 flag）
 *   requiresFlags?: string[], // 必须全部拥有的远期标记
 *   blocksFlags?: string[],   // 必须全部没有的远期标记
 *   rarity?: 'common' | 'rare' | 'legendary', // 稀有度，legendary 需要额外判定
 *   crossStage?: boolean, // 是否跨阶段（任意阶段都可能触发）
 * }
 */

export const RANDOM_EVENTS = [
  // ===== 少年期 (youth) =====
  {
    id: 'youth_bookstore',
    stage: 'youth',
    trigger: { pride: [3, 10] },
    weight: 3,
    text: '你在地摊上淘到一本绝版书，摊主开价50块——你口袋里只有30。他说"买不起别碰"。',
    choices: [
      { label: '"书我一定要！先欠着，下次还你"', effects: { pride: 1, wealth: -1 }, flag: 'bookworm' },
      { label: '"算了，记下书名去图书馆找"', effects: { reputation: 1 } }
    ],
    onceOnly: true
  },
  {
    id: 'youth_fight',
    stage: 'youth',
    trigger: { pride: [5, 10] },
    weight: 2,
    text: '你看到街边有人欺负弱小，对方有三个人。你一个人。',
    choices: [
      { label: '"打不过也要打！"', effects: { pride: 2, reputation: 1, pressure: 1 }, flag: 'fighter' },
      { label: '"先记住长相，以后再算账"', effects: { pride: -1, pressure: 1 } }
    ],
    onceOnly: true
  },
  {
    id: 'youth_gamble',
    stage: 'youth',
    trigger: { wealth: [0, 3] },
    weight: 2,
    text: '朋友拉你去赌一把，说"稳赚不赔"。你看了看自己瘪瘪的钱包。',
    choices: [
      { label: '"赌一把！反正也没啥可输的"', effects: { wealth: 2, pride: -1, failures: 1, trust: -1 }, flag: 'gambler' },
      { label: '"不赌。穷也不能靠运气"', effects: { pride: 1 } }
    ],
    onceOnly: true
  },

  // ===== 新东方期 (teacher) =====
  {
    id: 'teacher_student_gift',
    stage: 'teacher',
    trigger: { reputation: [5, 10] },
    weight: 3,
    text: '一个学生家长偷偷塞给你一个红包，说"请多关照我家孩子"。金额不小。',
    choices: [
      { label: '"收下吧，大家都是这样"', effects: { wealth: 3, trust: -1 }, flag: 'corrupt' },
      { label: '"不好意思，我不收这个"', effects: { pride: 1, trust: 1, reputation: 1 } }
    ],
    onceOnly: true
  },
  {
    id: 'teacher_sick',
    stage: 'teacher',
    trigger: { pressure: [6, 10] },
    weight: 4,
    text: '你连续讲课一个月没休息，嗓子已经说不出话了。明天还有三场课。',
    choices: [
      { label: '"吃药顶着！学生等着呢"', effects: { pressure: 2, reputation: 1, wealth: 1 } },
      { label: '"请假休息，身体要紧"', effects: { pressure: -2, wealth: -1 } }
    ],
    onceOnly: false
  },
  {
    id: 'teacher_viral',
    stage: 'teacher',
    trigger: { reputation: [4, 10] },
    weight: 2,
    text: '你的一段课堂视频被传到网上，播放量暴涨。有人夸你"中国最好的英语老师"，也有人骂你"哗众取宠"。',
    choices: [
      { label: '"趁热打铁！我要做网红"', effects: { reputation: 2, pride: -1 }, flag: 'influencer' },
      { label: '"安心教书，别被流量绑架"', effects: { pride: 1, trust: 1 } }
    ],
    onceOnly: true
  },

  // ===== 创业期 (startup) =====
  {
    id: 'startup_investor_pullout',
    stage: 'startup',
    trigger: { wealth: [0, 4] },
    weight: 4,
    text: '投资人突然打来电话："抱歉，我们决定撤资。"原因不明。你的现金流只够撑两个月。',
    choices: [
      { label: '"自己借钱也要干下去！"', effects: { wealth: -2, pressure: 3, pride: 2 }, flag: 'all_in' },
      { label: '"赶紧找新投资人，降低估值也行"', effects: { wealth: -1, pride: -1, reputation: 1 } }
    ],
    onceOnly: false
  },
  {
    id: 'startup_employee_quit',
    stage: 'startup',
    trigger: { pressure: [5, 10] },
    weight: 3,
    text: '核心工程师递了辞呈，说"我受不了了，天天加班到凌晨"。他手里握着关键模块。',
    choices: [
      { label: '"加薪留人！他走了项目就完了"', effects: { wealth: -2, pressure: -1 } },
      { label: '"走就走，公司不能被一个人绑架"', effects: { pride: 1, pressure: 2, trust: -1 } }
    ],
    onceOnly: false
  },
  {
    id: 'startup_copycat',
    stage: 'startup',
    trigger: { reputation: [5, 10] },
    weight: 3,
    text: '大厂发布了一款和你几乎一模一样的产品，但价格只有你的一半。你的用户开始流失。',
    choices: [
      { label: '"告他们！抄袭必须付出代价"', effects: { pride: 2, wealth: -1, pressure: 2 }, flag: 'sued_big_tech' },
      { label: '"打不过就差异化，做他们做不到的"', effects: { pride: 1, wealth: -1 } }
    ],
    onceOnly: true
  },
  {
    id: 'startup_product_hit',
    stage: 'startup',
    trigger: { pride: [4, 10], reputation: [3, 10] },
    weight: 2,
    text: '你的产品意外爆火了！订单量是预期的10倍，但产能跟不上，用户开始投诉发货慢。',
    choices: [
      { label: '"先保证质量，宁可少卖也不能砸招牌"', effects: { reputation: 2, wealth: 1, pride: 1, trust: 1 } },
      { label: '"赶紧扩大产能！机会不等人"', effects: { wealth: 2, reputation: -1, pressure: 2 } }
    ],
    onceOnly: true
  },
  {
    id: 'startup_bad_review',
    stage: 'startup',
    trigger: { reputation: [3, 8] },
    weight: 3,
    text: '知名KOL发了一条差评视频，说你的产品"就是个笑话"。视频播放量500万。',
    choices: [
      { label: '"公开怼回去！他根本没用过"', effects: { pride: 2, reputation: -1, pressure: 1 }, flag: 'public_feud' },
      { label: '"默默改进产品，用实力说话"', effects: { pride: -1, trust: 1 } }
    ],
    onceOnly: true
  },

  // ===== 至暗期 (dark) =====
  {
    id: 'dark_debt_collector',
    stage: 'dark',
    trigger: { wealth: [0, 3], pressure: [5, 10] },
    weight: 5,
    text: '债主带着人堵在公司门口，喊"老罗还钱！"员工吓得不敢上班。你站在窗边，看着楼下那群人。',
    choices: [
      { label: '"出去面对！欠债还钱天经地义"', effects: { pressure: 2, trust: 1, pride: 1 } },
      { label: '"从后门走，先避一避"', effects: { pressure: -1, pride: -2, reputation: -1 } }
    ],
    onceOnly: false
  },
  {
    id: 'dark_family',
    stage: 'dark',
    trigger: { pressure: [7, 10] },
    weight: 3,
    text: '妻子打来电话，孩子在学校被同学嘲笑"你爸是老赖"。电话那头，她哭了。',
    choices: [
      { label: '"我一定会还清的，再给我一点时间"', effects: { pressure: 2, pride: 1 } },
      { label: '"……对不起"', effects: { pressure: 3, pride: -1 } }
    ],
    onceOnly: true
  },
  {
    id: 'dark_escape_offer',
    stage: 'dark',
    trigger: { wealth: [0, 3] },
    weight: 2,
    text: '有人给你出主意：申请破产清算，按公司法你个人不用还这6亿。律师说"合法合规"。',
    choices: [
      { label: '"不！欠的钱我自己还！"', effects: { pride: 3, pressure: 2, trust: 2 }, flag: 'honest_repay' },
      { label: '"……让我想想"', effects: { pressure: -1, pride: -1 } }
    ],
    onceOnly: true
  },

  // ===== 还债期 (repay) =====
  {
    id: 'repay_bad_ad',
    stage: 'repay',
    trigger: { wealth: [0, 5] },
    weight: 4,
    text: '一个明显是割韭菜的产品找你带货，开价500万。你知道这东西不靠谱，但你真的很需要钱。',
    choices: [
      { label: '"接！先还债再说，以后再洗白"', effects: { wealth: 8, trust: -2, reputation: -1, pride: -2 }, flag: 'sold_out' },
      { label: '"不接！再穷也不能坑人"', effects: { pride: 2, trust: 2, wealth: -1 } }
    ],
    onceOnly: false
  },
  {
    id: 'repay_fan_help',
    stage: 'repay',
    trigger: { trust: [5, 10] },
    weight: 3,
    text: '粉丝自发组织帮你宣传直播间，不收一分钱。他们说"老罗，我们信你"。',
    choices: [
      { label: '"谢谢你们！我一定不会让你们失望"', effects: { trust: 2, reputation: 1, pressure: 1 } },
      { label: '"别帮我了，我怕连累你们"', effects: { pride: 1, trust: 1 } }
    ],
    onceOnly: true
  },
  {
    id: 'repay_banned',
    stage: 'repay',
    trigger: { reputation: [3, 8] },
    weight: 2,
    text: '直播间突然被封，理由是"内容违规"。你不知道是哪个竞争对手搞的鬼。',
    choices: [
      { label: '"发声明维权！不能忍"', effects: { reputation: -2, pride: 2, pressure: 2 }, flag: 'banned_fight' },
      { label: '"换平台，不跟他们纠缠"', effects: { reputation: -1, wealth: -1 } }
    ],
    onceOnly: true
  },
  {
    id: 'repay_investor_comeback',
    stage: 'repay',
    trigger: { wealth: [3, 8], trust: [5, 10] },
    weight: 2,
    text: '一个投资人主动找上门："老罗，我看好你。要不要再干一票大的？"',
    choices: [
      { label: '"干！这次我一定行！"', effects: { wealth: 2, pride: 1, pressure: 2 }, flag: 'comeback_attempt' },
      { label: '"先把债还完，再说其他的"', effects: { trust: 1, pressure: -1 } }
    ],
    onceOnly: true
  },

  // ===== 新生期 (reborn) =====
  {
    id: 'reborn_ai_opportunity',
    stage: 'reborn',
    trigger: { wealth: [4, 10] },
    weight: 3,
    text: 'AI浪潮来了。你看到机会，但你也看到风险——上次做AR就亏了不少。',
    choices: [
      { label: '"这次不一样！AI是真正的革命"', effects: { wealth: -1, pride: 1 }, flag: 'ai_believer' },
      { label: '"稳一点，先观察再入局"', effects: { wealth: 1, pride: -1 } }
    ],
    onceOnly: true
  },
  {
    id: 'reborn_retirement_offer',
    stage: 'reborn',
    trigger: { pressure: [0, 4] },
    weight: 2,
    text: '有人出高价买你的品牌和IP，条件是你以后不能再以"罗远"的名义做任何商业活动。',
    choices: [
      { label: '"不卖！老罗这两个字是我的命"', effects: { pride: 3, wealth: -2 } },
      { label: '"可以考虑……毕竟也折腾够了"', effects: { wealth: 3, pride: -2, pressure: -2 }, flag: 'sold_name' }
    ],
    onceOnly: true
  },
  {
    id: 'reborn_mentor',
    stage: 'reborn',
    trigger: { reputation: [6, 10], trust: [5, 10] },
    weight: 2,
    text: '一个年轻创业者找到你："老罗，我想做手机，你能教我吗？"他眼里的光，像极了当年的你。',
    choices: [
      { label: '"来吧，我把我踩过的坑都告诉你"', effects: { trust: 1, reputation: 1, pride: 1 }, flag: 'mentor' },
      { label: '"别做手机！听我一句劝"', effects: { pride: -1, trust: 1 } }
    ],
    onceOnly: true
  },

  // ===== 少年期 (youth) 新增 =====
  {
    id: 'youth_sick_mother',
    stage: 'youth',
    trigger: { pride: [3, 10], wealth: [0, 3], pressure: [4, 10] },
    weight: 2,
    text: '母亲住院了。医生说手术费要两万，家里翻箱倒柜只凑出八千。隔壁王叔拍着胸脯说，只要你去他建材店帮忙看半年店，钱他先垫上——但你知道他那个店卖劣质水管给乡下人。',
    choices: [
      { label: '"先救命再说，以后的事以后想。"', effects: { wealth: 2, pride: -1, pressure: -2 }, flag: 'youth_compromise' },
      { label: '"我去找别的办法，不能帮着坑人。"', effects: { pride: 2, pressure: 3, wealth: -1 } }
    ],
    onceOnly: true
  },
  {
    id: 'youth_cheat_exam',
    stage: 'youth',
    trigger: { pride: [0, 6], reputation: [0, 4], pressure: [5, 10] },
    weight: 3,
    text: '期末考试，前排同学的答案就摊在桌角。你这道大题完全不会，挂科的话又要被叫家长。监考老师正背过身擦黑板，三秒钟的事。',
    choices: [
      { label: '"就这一次，下不为例。"', effects: { reputation: 1, pride: -2, pressure: -2 } },
      { label: '"宁可挂科也不抄。"', effects: { pride: 2, reputation: -1, pressure: 1 } }
    ],
    onceOnly: false
  },
  {
    id: 'youth_friend_stolen',
    stage: 'youth',
    trigger: { pride: [2, 8], reputation: [0, 5] },
    weight: 2,
    text: '最好的朋友偷了书店的磁带，被老板堵在门口。他吓坏了，用眼神求你——你只要说"他是我带来的"，老板看在你常来买书的份上可能放人。但你最恨偷东西。',
    choices: [
      { label: '"他是我兄弟，我替他赔。"', effects: { wealth: -1, reputation: 1, pride: -1 } },
      { label: '"你自己做的事自己担着。"', effects: { pride: 2, reputation: -1 } }
    ],
    onceOnly: false
  },
  {
    id: 'youth_reading_habit',
    stage: 'youth',
    trigger: { pride: [4, 10], wealth: [0, 4] },
    weight: 4,
    text: '旧书摊上淘到一本翻烂了的《了不起的盖茨比》，扉页有人用铅笔写着"梦想不值钱，但没有它更穷"。你蹲在路边一口气读了三十页，摊主催你买不买——五块钱，够你吃两天午饭。',
    choices: [
      { label: '"买了，饿两顿算什么。"', effects: { pride: 2, wealth: -1, pressure: 1 }, flag: 'youth_bookworm' },
      { label: '"先不买，记住这感觉就行。"', effects: { pressure: 1 } }
    ],
    onceOnly: true
  },
  {
    id: 'youth_bully_stand',
    stage: 'youth',
    trigger: { pride: [3, 10], reputation: [0, 5] },
    weight: 3,
    text: '校门口，三个高年级的围住班上最矮小的同学搜口袋。周围二十多个人看着，没人出声。你的拳头在发抖——上次打架被停课的事，你爸到现在还拿皮带抽你。',
    choices: [
      { label: '"放开他！要搜搜我的！"', effects: { pride: 3, reputation: 2, pressure: 2 }, flag: 'youth_fighter' },
      { label: '"先忍着，回头找老师。"', effects: { pressure: 2, pride: -1 } }
    ],
    onceOnly: true
  },
  {
    id: 'youth_drop_debate',
    stage: 'youth',
    trigger: { pride: [5, 10], wealth: [0, 3], pressure: [5, 10] },
    weight: 2,
    text: '班主任把你叫到办公室："你成绩全班倒数，还整天看闲书。你爸在工地搬砖供你读书，你对得起他吗？"你攥着校服下摆，心里清楚自己不是读书的料，但退学——你连退路都没有。',
    choices: [
      { label: '"我退学，出去闯。学校不适合我。"', effects: { pride: 3, pressure: -1, wealth: -1 }, flag: 'youth_dropout' },
      { label: '"再熬熬吧，至少混个毕业证。"', effects: { pressure: 2, pride: -1 } }
    ],
    onceOnly: true
  },
  {
    id: 'youth_first_love',
    stage: 'youth',
    trigger: { pride: [2, 8], pressure: [0, 5] },
    weight: 3,
    text: '她递给你一封信，粉色的信封，上面画了只小猫。你心跳得像擂鼓。但她爸是镇上开厂的，你家住筒子楼。她约你周末去公园，你知道你那双破球鞋配不上她。',
    choices: [
      { label: '"去！穿什么不重要，重要的是人。"', effects: { pride: 1, pressure: -1 } },
      { label: '"算了，别耽误人家。"', effects: { pride: -1, pressure: 2 } }
    ],
    onceOnly: false
  },
  {
    id: 'youth_sell_goods',
    stage: 'youth',
    trigger: { wealth: [0, 3], pride: [0, 6] },
    weight: 4,
    text: '表哥从南方带回来一箱电子表，五块钱进，卖十五。他让你去学校卖，说"学生钱最好赚"。你看了看那些表——走时倒还准，就是壳子是塑料的，看着像地摊货。',
    choices: [
      { label: '"卖就卖，总比没钱强。"', effects: { wealth: 2, pride: -1, reputation: -1 } },
      { label: '"这东西坑人，我不干。"', effects: { pride: 1, wealth: -1 } }
    ],
    onceOnly: false
  },
  {
    id: 'youth_dad_fight',
    stage: 'youth',
    trigger: { pride: [4, 10], pressure: [3, 10] },
    weight: 3,
    text: '饭桌上，你说了句"我不想考大学"，筷子飞过来砸在你额头上。你爸红着脖子吼："你以为你是谁？老子搬了二十年砖，就指望你出人头地！"你妈在旁边抹眼泪，不敢说话。',
    choices: [
      { label: '"我就是我，不是你的指望！"', effects: { pride: 3, pressure: 3, trust: -1 }, flag: 'youth_rebel' },
      { label: '"……我知道了。"', effects: { pressure: 2, pride: -2 } }
    ],
    onceOnly: true
  },
  {
    id: 'youth_writing_talent',
    stage: 'youth',
    trigger: { pride: [3, 10], reputation: [0, 4] },
    weight: 2,
    text: '校报编辑看了你写的作文，眼睛亮了："这篇写得太好了！投市里的征文比赛吧，一等奖有五百块奖金。"但你写的是你爸在工地受伤的事——你不确定他想不想让别人看到。',
    choices: [
      { label: '"投！真实的故事才有力量。"', effects: { reputation: 2, wealth: 1, pride: 1 }, flag: 'youth_writer' },
      { label: '"算了，家里的事不想让人看笑话。"', effects: { pride: -1, pressure: 1 } }
    ],
    onceOnly: true
  },
  {
    id: 'youth_temp_job',
    stage: 'youth',
    trigger: { wealth: [0, 3], pressure: [3, 10] },
    weight: 5,
    text: '暑假，你在饭馆后厨洗碗。老板娘是个胖子，总嫌你慢，动不动就拿勺子敲盆。一天下来手泡得发白，腰疼得直不起来。晚上数工钱，一天十五块。你盯着那几张皱巴巴的纸币，第一次觉得——钱真难挣。',
    choices: [
      { label: '"再苦也得干，没钱寸步难行。"', effects: { wealth: 1, pressure: 1, pride: 1 } },
      { label: '"不干了，这种日子不是人过的。"', effects: { pride: 1, wealth: -1 } }
    ],
    onceOnly: false
  },
  {
    id: 'youth_neighbor_help',
    stage: 'youth',
    trigger: { pride: [2, 8], wealth: [0, 5] },
    weight: 3,
    text: '楼下独居的张奶奶摔了腿，买菜都成问题。你每天放学帮她跑一趟菜市场，她总要多给你五块钱跑腿费。你妈说"拿着吧，人家诚心给的"。但你觉得怪怪的——帮忙要钱，那叫帮忙吗？',
    choices: [
      { label: '"钱不要了，您歇着就行。"', effects: { pride: 2, wealth: -1, trust: 1 }, flag: 'youth_kindness' },
      { label: '"拿就拿吧，反正她也不缺这点。"', effects: { wealth: 1, pride: -1 } }
    ],
    onceOnly: true
  },
  {
    id: 'youth_radio_night',
    stage: 'youth',
    trigger: { pride: [4, 10], pressure: [0, 6] },
    weight: 4,
    text: '深夜，你缩在被窝里听收音机。电台里一个声音在说："人这辈子，最怕的不是失败，是从没为自己活过。"窗外月光照进来，你盯着天花板上的裂纹，突然觉得心里有什么东西被点亮了。',
    choices: [
      { label: '"总有一天，我要活成自己想活的样子。"', effects: { pride: 2, pressure: -1 } },
      { label: '"想这些有什么用，先活着再说。"', effects: { pressure: 1 } }
    ],
    onceOnly: false
  },
  {
    id: 'youth_class_divide',
    stage: 'youth',
    trigger: { pride: [3, 10], wealth: [0, 3], reputation: [0, 4] },
    weight: 2,
    text: '班里组织春游，每人交三十。你口袋里只有十五。班长当着全班的面问："还有谁没交？"二十多双眼睛看过来。你低着头，感觉后脖颈发烫。',
    choices: [
      { label: '"我没钱，不去了。"', effects: { pride: 2, reputation: -1, pressure: 1 } },
      { label: '"我……忘带了，明天交。"', effects: { pressure: 2, pride: -1 } }
    ],
    onceOnly: false
  },
  {
    id: 'youth_gamble_risk',
    stage: 'youth',
    trigger: { wealth: [0, 3], pride: [0, 5], pressure: [4, 10] },
    weight: 3,
    text: '发小拉你去地下游戏厅，说有人靠抓娃娃机上的漏洞，一晚上赢了八百。"稳赚的，就看你敢不敢。"你看着他那双发光的眼睛，又摸了摸口袋里仅剩的二十块——这是你这周全部的饭钱。',
    choices: [
      { label: '"搏一把，穷日子我过够了！"', effects: { wealth: 2, pride: -1, pressure: -1 }, flag: 'youth_gambler' },
      { label: '"不碰，这种钱来得快去得更快。"', effects: { pride: 1, pressure: 1 } }
    ],
    onceOnly: true
  },

  // ===== 新东方期 (teacher) 新增 =====
  {
    id: 'teacher_textbook_bribe',
    stage: 'teacher',
    trigger: { wealth: [0, 4], reputation: [3, 8] },
    weight: 3,
    text: '出版社的业务员请你吃饭，说只要你在课上推荐他们的教材，每本返你二十块。你翻了翻样书——内容粗糙，错题不少，但封面印着"名师推荐"四个大字。',
    choices: [
      { label: '"推就推吧，反正学生也不一定买。"', effects: { wealth: 2, trust: -1, pride: -1 }, flag: 'teacher_shady' },
      { label: '"这书误人子弟，我不推。"', effects: { pride: 2, wealth: -1 } }
    ],
    onceOnly: true
  },
  {
    id: 'teacher_student_cry',
    stage: 'teacher',
    trigger: { pride: [3, 10], pressure: [3, 8] },
    weight: 4,
    text: '课后，一个女生红着眼眶来找你："老师，我爸说我再考不上就让我去工厂。"她的模拟考成绩离线差二十分，你心里清楚——她不是不努力，是底子太薄。',
    choices: [
      { label: '"我每天多给你补一小时，不收钱。"', effects: { pride: 2, pressure: 1, trust: 1 }, flag: 'teacher_caring' },
      { label: '"你尽力就好，考不上也不是世界末日。"', effects: { pressure: -1, pride: -1 } }
    ],
    onceOnly: true
  },
  {
    id: 'teacher_colleague_steal',
    stage: 'teacher',
    trigger: { reputation: [4, 10], pride: [3, 10] },
    weight: 2,
    text: '你花了两周写的教案，被隔壁组的老张原封不动拿去用了，还署了自己的名字在内部评比里拿了奖。你拿着打印稿对峙，他笑着说"大家互相借鉴嘛"。',
    choices: [
      { label: '"去举报！这是抄袭！"', effects: { pride: 2, reputation: 1, pressure: 2 } },
      { label: '"算了，下次留个心眼。"', effects: { pressure: 1, pride: -1 } }
    ],
    onceOnly: true
  },
  {
    id: 'teacher_overtime',
    stage: 'teacher',
    trigger: { pressure: [5, 10], wealth: [0, 5] },
    weight: 5,
    text: '排课表出来了——你被安排了每天六节课，连轴转。教务处说"能者多劳"。你看了看工资条，课时费一分没涨。',
    choices: [
      { label: '"忍了，多上课多拿课时费。"', effects: { wealth: 1, pressure: 2, pride: -1 } },
      { label: '"找教务处谈，这不合理。"', effects: { pressure: 1, pride: 2, reputation: -1 } }
    ],
    onceOnly: false
  },
  {
    id: 'teacher_famous_invite',
    stage: 'teacher',
    trigger: { reputation: [6, 10], pride: [4, 10] },
    weight: 2,
    text: '一家知名培训机构开出三倍薪水挖你，但要求你签竞业协议——两年内不能在任何平台讲英语。你看了看新东方的工牌，又看了看那份合同。',
    choices: [
      { label: '"跳！人往高处走。"', effects: { wealth: 3, pride: -1, trust: -1 }, flag: 'teacher_jump' },
      { label: '"不走，这里有我的学生。"', effects: { pride: 2, trust: 1 } }
    ],
    onceOnly: true
  },
  {
    id: 'teacher_management_push',
    stage: 'teacher',
    trigger: { pressure: [4, 10], reputation: [3, 8] },
    weight: 3,
    text: '校长把你叫去："老罗，你课讲得好，来当教务主任吧。"你心里清楚——当主任就不是讲课了，是开会、写报告、搞关系。但工资翻倍。',
    choices: [
      { label: '"当！讲台随时能上，机会不等人。"', effects: { wealth: 2, pride: -1, pressure: 2 } },
      { label: '"不当，我只想教书。"', effects: { pride: 2, wealth: -1 } }
    ],
    onceOnly: true
  },
  {
    id: 'teacher_side_business',
    stage: 'teacher',
    trigger: { wealth: [0, 4], pride: [2, 8] },
    weight: 3,
    text: '周末，朋友拉你一起开个培训班，专教考研英语。你出名气，他出场地，五五分。但新东方的合同上白纸黑字写着——在职期间不得兼职。',
    choices: [
      { label: '"偷偷干，谁查得着？"', effects: { wealth: 2, pride: -1, pressure: 1 }, flag: 'teacher_moonlight' },
      { label: '"不冒这个险，合同就是合同。"', effects: { pride: 1, wealth: -1 } }
    ],
    onceOnly: true
  },
  {
    id: 'teacher_student_plagiarize',
    stage: 'teacher',
    trigger: { pride: [4, 10], reputation: [3, 8] },
    weight: 2,
    text: '你最得意的学生交了一篇作文，写得极好——好到你搜了一下，发现大段抄袭自网上文章。他低着头说："老师，我妈说考不上就别回家了。"',
    choices: [
      { label: '"这次算你零分，但我不上报。"', effects: { pride: 1, trust: -1 } },
      { label: '"上报，规矩就是规矩。"', effects: { pride: 2, reputation: 1, pressure: 1 } }
    ],
    onceOnly: false
  },
  {
    id: 'teacher_burnout',
    stage: 'teacher',
    trigger: { pressure: [7, 10], pride: [0, 5] },
    weight: 4,
    text: '凌晨三点，你坐在出租屋的地板上，面前是明天要讲的课件。你已经连续失眠一周了。手机里是妻子发来的消息："你什么时候回来？"你不知道她问的是哪个回来。',
    choices: [
      { label: '"辞职吧，命比工作重要。"', effects: { pressure: -3, wealth: -2, pride: -1 } },
      { label: '"再撑撑，不能让学生失望。"', effects: { pressure: 2, pride: 1 } }
    ],
    onceOnly: false
  },
  {
    id: 'teacher_rich_student',
    stage: 'teacher',
    trigger: { wealth: [0, 4], pride: [2, 8] },
    weight: 3,
    text: '班里来了个富二代，开保时捷来上课。课后他递给你一张卡："老师，我爸说想请您做我的私人辅导。"卡里是半年工资。你看了看自己骑了三年的自行车。',
    choices: [
      { label: '"接，有钱不赚是傻子。"', effects: { wealth: 3, pride: -1, trust: -1 } },
      { label: '"不接，一视同仁是我的原则。"', effects: { pride: 2, wealth: -1 } }
    ],
    onceOnly: true
  },
  {
    id: 'teacher_speech_censor',
    stage: 'teacher',
    trigger: { pride: [5, 10], reputation: [4, 10] },
    weight: 2,
    text: '你在课上讲了一段关于独立思考的话，学生录了视频发到网上。学校领导找你谈话："以后上课注意措辞，别讲那些敏感话题。"你看着领导那张笑脸，胃里一阵翻涌。',
    choices: [
      { label: '"我说的每句话都站得住脚，不改。"', effects: { pride: 3, pressure: 2, reputation: -1 }, flag: 'teacher_defiant' },
      { label: '"好吧，我注意。"', effects: { pressure: 1, pride: -2 } }
    ],
    onceOnly: true
  },
  {
    id: 'teacher_old_friend',
    stage: 'teacher',
    trigger: { pride: [3, 10], wealth: [0, 5] },
    weight: 3,
    text: '老同学聚会，当年成绩不如你的都开上了宝马。有人拍你肩膀："还在教书呢？一个月多少？"你端着啤酒杯，笑了笑没说话。账单来了，AA制，你掏钱的时候手有点抖。',
    choices: [
      { label: '"教书怎么了？我活得坦荡。"', effects: { pride: 2, pressure: 1 } },
      { label: '"也许该换个活法了……"', effects: { pride: -1, pressure: 2 } }
    ],
    onceOnly: false
  },
  {
    id: 'teacher_resign_letter',
    stage: 'teacher',
    trigger: { pride: [6, 10], pressure: [5, 10] },
    weight: 2,
    text: '你写好了辞职信，信封就放在抽屉里。窗外是北京灰蒙蒙的天。你想起刚来新东方那天，对着镜子练了一百遍开场白。现在——你只想走出去。',
    choices: [
      { label: '"交！世界那么大，我不信没我容身的地方。"', effects: { pride: 3, pressure: -1, wealth: -2 }, flag: 'teacher_resign' },
      { label: '"再等等，至少把学期上完。"', effects: { pressure: 1, pride: -1 } }
    ],
    onceOnly: true
  },
  {
    id: 'teacher_group_class',
    stage: 'teacher',
    trigger: { reputation: [4, 10], pressure: [3, 8] },
    weight: 4,
    text: '学校让你开一个五百人的大课，说"你的名气能招满"。你习惯小班互动，五百人的教室——你连最后一排的脸都看不清。但课时费是小班的五倍。',
    choices: [
      { label: '"开！人多力量大，正好练练气场。"', effects: { wealth: 2, reputation: 1, pressure: 1 } },
      { label: '"不开，大课教不出真东西。"', effects: { pride: 2, wealth: -1 } }
    ],
    onceOnly: false
  },
  {
    id: 'teacher_parent_complaint',
    stage: 'teacher',
    trigger: { reputation: [3, 8], pressure: [4, 10] },
    weight: 3,
    text: '家长群炸了。一个家长截图你在课上说的"考试不是唯一出路"，@你："你这是在误人子弟！"群里一半人附和，一半人沉默。你打了一段话又删了，打了又删了。',
    choices: [
      { label: '"我说的没错，考试确实不是唯一出路。"', effects: { pride: 2, reputation: -1, pressure: 1 } },
      { label: '"抱歉，我措辞不当。"', effects: { pressure: -1, pride: -2 } }
    ],
    onceOnly: false
  },

  // ===== 创业期 (startup) 新增 =====
  {
    id: 'startup_supply_betrayal',
    stage: 'startup',
    trigger: { wealth: [0, 5], pressure: [4, 10] },
    weight: 3,
    text: '供应商突然涨价30%，你签的合同里有个模糊条款被他钻了空子。他笑着说"市场行情嘛"。你的库存只够卖一周，换供应商至少要两个月。',
    choices: [
      { label: '"认了，先保证不断货。"', effects: { wealth: -2, pressure: 1, pride: -1 } },
      { label: '"告他！合同就是合同！"', effects: { pride: 2, pressure: 2, wealth: -1 } }
    ],
    onceOnly: false
  },
  {
    id: 'startup_gamble_vision',
    stage: 'startup',
    trigger: { pride: [5, 10], wealth: [2, 8] },
    weight: 2,
    text: '你看到了一个全新的技术方向，但需要全部身家押注。合伙人反对："太冒险了，我们现在的产品还能活。"你盯着白板上画的路线图，手心在出汗。',
    choices: [
      { label: '"全押！不做第一就没意义。"', effects: { wealth: -2, pride: 2, pressure: 3 }, flag: 'startup_allin' },
      { label: '"听合伙人的，稳扎稳打。"', effects: { pride: -1, pressure: -1 } }
    ],
    onceOnly: true
  },
  {
    id: 'startup_design_vs_engineer',
    stage: 'startup',
    trigger: { pressure: [4, 10], pride: [3, 10] },
    weight: 4,
    text: '设计团队和工程团队吵翻了。设计师说"这个交互是灵魂"，工程师说"这功能做不出来"。两边都看着你，等你拍板。产品上线倒计时还有两周。',
    choices: [
      { label: '"听设计的，做不到就加班做到！"', effects: { pride: 1, pressure: 3, trust: -1 } },
      { label: '"听工程的，先上线再迭代。"', effects: { pressure: -1, pride: -1 } }
    ],
    onceOnly: false
  },
  {
    id: 'startup_media_circus',
    stage: 'startup',
    trigger: { reputation: [5, 10], pressure: [3, 8] },
    weight: 3,
    text: '一篇爆料文章说你公司"数据造假"，其实只是统计口径不同。但热搜已经上了，评论区全是骂声。公关团队问你要不要发律师函。',
    choices: [
      { label: '"发律师函！造谣必须付出代价！"', effects: { pride: 2, reputation: -1, pressure: 2 } },
      { label: '"发声明澄清就好，别把事闹大。"', effects: { pressure: -1, pride: -1, trust: 1 } }
    ],
    onceOnly: false
  },
  {
    id: 'startup_quality_gate',
    stage: 'startup',
    trigger: { pride: [4, 10], reputation: [3, 8] },
    weight: 3,
    text: '质检报告出来了——良品率只有85%。行业平均是95%。你看了看仓库里堆着的一万件货，再看了看账上只够发两个月工资的余额。销毁这批货，公司可能撑不到下一批。',
    choices: [
      { label: '"销毁！砸招牌的事我不干。"', effects: { pride: 2, wealth: -2, trust: 2 } },
      { label: '"先卖，后续批次再改进。"', effects: { wealth: 1, pride: -2, trust: -1 } }
    ],
    onceOnly: true
  },
  {
    id: 'startup_cofounder_split',
    stage: 'startup',
    trigger: { pressure: [5, 10], pride: [4, 10] },
    weight: 2,
    text: '联合创始人找你摊牌："方向我不同意，要么听我的，要么我走。"他手里握着40%的股份和核心客户资源。会议室的空调嗡嗡响，你盯着他看了很久。',
    choices: [
      { label: '"你走，公司我来扛。"', effects: { pride: 3, pressure: 3, wealth: -1 }, flag: 'startup_solo' },
      { label: '"好，听你的，公司最重要。"', effects: { pride: -2, pressure: -1 } }
    ],
    onceOnly: true
  },
  {
    id: 'startup_cash_bet',
    stage: 'startup',
    trigger: { wealth: [0, 4], pressure: [6, 10] },
    weight: 4,
    text: '账上只剩最后三百万，够撑两个月。有两个选择：砍掉一半业务线苟活，或者把钱全砸进一个新品发布会赌一把翻身。财务总监说"我建议保守"。',
    choices: [
      { label: '"赌！不拼一把永远起不来！"', effects: { wealth: -1, pressure: 3, pride: 2 }, flag: 'startup_cash_bet' },
      { label: '"砍业务，活着才有希望。"', effects: { wealth: 1, pressure: -1, pride: -1 } }
    ],
    onceOnly: true
  },
  {
    id: 'startup_launch_nightmare',
    stage: 'startup',
    trigger: { pressure: [6, 10], reputation: [4, 10] },
    weight: 3,
    text: '发布会前夜，服务器崩了。技术团队通宵抢修，凌晨五点告诉你"最多恢复70%"。发布会八点开始，已经卖了三千张票，媒体全到了。',
    choices: [
      { label: '"照常开！70%也比没有强！"', effects: { pressure: 2, reputation: -1, pride: 1 } },
      { label: '"延期，我不能拿半成品上台。"', effects: { pride: 1, reputation: -2, pressure: 1 } }
    ],
    onceOnly: true
  },
  {
    id: 'startup_patent_troll',
    stage: 'startup',
    trigger: { wealth: [2, 8], reputation: [3, 10] },
    weight: 2,
    text: '一封律师函寄到公司：某专利公司说你侵犯了他们的"滑动解锁"专利，索赔两千万。你查了查——这家公司没有产品，只靠起诉赚钱。',
    choices: [
      { label: '"应诉！这种流氓不能惯着！"', effects: { wealth: -1, pride: 2, pressure: 2 } },
      { label: '"和解，打官司太耗精力了。"', effects: { wealth: -2, pressure: -1, pride: -1 } }
    ],
    onceOnly: false
  },
  {
    id: 'startup_fan_preorder',
    stage: 'startup',
    trigger: { trust: [5, 10], reputation: [5, 10] },
    weight: 3,
    text: '粉丝自发组织预售，一天下了五千单。你感动得差点掉泪——但产能只够供两千。超出的订单要等两个月，你知道等两个月的用户会变成最愤怒的黑粉。',
    choices: [
      { label: '"只接两千单，剩下的退款道歉。"', effects: { trust: 2, wealth: -1, pride: 1 } },
      { label: '"全接！加班加点赶出来！"', effects: { wealth: 2, pressure: 3, trust: -1 } }
    ],
    onceOnly: true
  },
  {
    id: 'startup_poaching_war',
    stage: 'startup',
    trigger: { pressure: [4, 10], wealth: [2, 8] },
    weight: 3,
    text: '大厂HR直接挖你三个核心工程师，开双倍工资加期权。你知道他们不是真需要这三个人——他们只是想让你项目延期。工程师们拿着offer来找你谈。',
    choices: [
      { label: '"匹配薪资！不能让他们得逞！"', effects: { wealth: -2, pressure: -1 } },
      { label: '"留不住就不留，靠情怀绑人不长久。"', effects: { pressure: 2, pride: 1 } }
    ],
    onceOnly: false
  },
  {
    id: 'startup_material_lie',
    stage: 'startup',
    trigger: { pride: [3, 10], reputation: [4, 10] },
    weight: 2,
    text: '供应链经理偷偷告诉你：宣传页上写的"航空级铝合金"，实际用的是普通铝材。成本差了三倍。他说"行业都这么干，没人查"。',
    choices: [
      { label: '"改宣传！我不能骗人！"', effects: { pride: 2, reputation: 1, wealth: -1 } },
      { label: '"先不说，等产品站稳脚跟再说。"', effects: { wealth: 1, pride: -2, trust: -1 }, flag: 'startup_white_lie' }
    ],
    onceOnly: true
  },
  {
    id: 'startup_viral_marketing',
    stage: 'startup',
    trigger: { reputation: [3, 8], pressure: [2, 8] },
    weight: 4,
    text: '营销团队提了个方案：拍一条"翻车"视频，假装产品出问题引发讨论，再反转证明产品好。你听了方案，觉得有点意思，但总觉得哪里不对。',
    choices: [
      { label: '"拍！营销就是注意力经济。"', effects: { reputation: 2, trust: -1, pressure: 1 }, flag: 'startup_viral' },
      { label: '"不拍，靠套路赢来的用户不长久。"', effects: { pride: 1, trust: 1 } }
    ],
    onceOnly: true
  },

  // ===== 至暗期 (dark) 新增 =====
  {
    id: 'dark_consumption_ban',
    stage: 'dark',
    trigger: { wealth: [0, 2], pressure: [5, 10] },
    weight: 4,
    text: '法院下达限制消费令，你成了"老赖"。不能坐飞机、不能住星级酒店、不能高消费。你站在火车站售票窗口前，看着绿皮车的时刻表——去深圳要坐二十六个小时。',
    choices: [
      { label: '"坐就坐，二十六小时我熬得住。"', effects: { pressure: 1, pride: 1 } },
      { label: '"让助理先去，我远程参与。"', effects: { pressure: -1, pride: -1 } }
    ],
    onceOnly: true
  },
  {
    id: 'dark_creditor_door',
    stage: 'dark',
    trigger: { wealth: [0, 3], pressure: [6, 10] },
    weight: 5,
    text: '凌晨两点，门铃响了。透过猫眼，你看到两个纹身男站在门口。"罗总，我们老板说再不还钱，就来你家坐坐。"你妻子抱着孩子站在卧室门口，脸色惨白。',
    choices: [
      { label: '"开门，我跟他们谈。"', effects: { pressure: 2, pride: 1, trust: 1 } },
      { label: '"报警，然后从阳台走。"', effects: { pressure: -1, pride: -1 } }
    ],
    onceOnly: true
  },
  {
    id: 'dark_friend_betrays',
    stage: 'dark',
    trigger: { trust: [0, 4], pride: [2, 8] },
    weight: 3,
    text: '你最信任的合伙人拿着客户名单跳槽去了对手公司，还带走了两个核心员工。他走之前发了条朋友圈："良禽择木而栖。"你盯着屏幕，手指在发抖。',
    choices: [
      { label: '"告他！竞业协议不是摆设！"', effects: { pride: 2, pressure: 2, wealth: -1 } },
      { label: '"算了，留住的人才是真的。"', effects: { pressure: 1, pride: -1 } }
    ],
    onceOnly: true
  },
  {
    id: 'dark_health_alarm',
    stage: 'dark',
    trigger: { pressure: [7, 10], wealth: [0, 4] },
    weight: 4,
    text: '体检报告出来了——高血压、脂肪肝、胃溃疡。医生说"你必须休息"。你笑了笑，把报告塞进抽屉。下午还有三场谈判，每一场都关乎能不能还上下一笔债。',
    choices: [
      { label: '"先休息一周，身体垮了什么都没了。"', effects: { pressure: -2, wealth: -1, pride: -1 } },
      { label: '"没时间休息，债不会等我。"', effects: { pressure: 2, pride: 1 } }
    ],
    onceOnly: false
  },
  {
    id: 'dark_cyber_violence',
    stage: 'dark',
    trigger: { reputation: [0, 4], pressure: [5, 10] },
    weight: 3,
    text: '网上有人扒出你的家庭住址，P了你女儿的照片发在论坛上。评论区全是叫好声。你妻子哭着说"能不能别再上网了"。你关掉手机，手还在抖。',
    choices: [
      { label: '"报警维权，不能让这些人得逞！"', effects: { pride: 2, pressure: 2, trust: 1 } },
      { label: '"忍了，别再激怒他们。"', effects: { pressure: -1, pride: -2 } }
    ],
    onceOnly: true
  },
  {
    id: 'dark_wife_collapses',
    stage: 'dark',
    trigger: { pressure: [8, 10], pride: [0, 5] },
    weight: 3,
    text: '妻子在超市晕倒了，医生说是长期焦虑导致的。她醒来第一句话是"家里还有多少钱"。你握着她的手，说不出话。病床旁边的椅子上，放着催债律师函。',
    choices: [
      { label: '"我会想办法，你只管休息。"', effects: { pressure: 2, pride: 1 } },
      { label: '"对不起，是我连累了你。"', effects: { pressure: 1, pride: -2 } }
    ],
    onceOnly: true
  },
  {
    id: 'dark_asset_hide',
    stage: 'dark',
    trigger: { wealth: [0, 3], pride: [0, 5] },
    weight: 2,
    text: '律师私下建议你把剩余资产转移到家人名下，"这样债权人就追不到"。他说"很多人这么做"。你看着窗外灰蒙蒙的天，想起自己说过的话——"欠债还钱，天经地义"。',
    choices: [
      { label: '"不转！我说了要还就一定还！"', effects: { pride: 3, pressure: 1, trust: 2 } },
      { label: '"先转一部分，留条后路。"', effects: { wealth: 1, pride: -2, trust: -1 }, flag: 'dark_asset_hide' }
    ],
    onceOnly: true
  },
  {
    id: 'dark_livestream_offer',
    stage: 'dark',
    trigger: { wealth: [0, 3], reputation: [3, 8] },
    weight: 4,
    text: '一个直播平台找上门："老罗，来带货吧，以你的口才，一个月至少赚几百万。"你看了看合同——提成比例很低，但确实来钱快。你想起那堆催款单。',
    choices: [
      { label: '"干！先还债，面子以后再捡。"', effects: { wealth: 2, pressure: -1, pride: -1 } },
      { label: '"让我想想，我不想变成纯卖货的。"', effects: { pride: 1, pressure: 1 } }
    ],
    onceOnly: true
  },
  {
    id: 'dark_unpaid_staff',
    stage: 'dark',
    trigger: { wealth: [0, 2], pressure: [6, 10] },
    weight: 5,
    text: '三个月没发工资了。前台小姑娘红着眼说"我房租都交不起了"。你翻了翻账本，连下个月的电费都成问题。二十多个人等着你发工资，你连自己下顿饭在哪都不知道。',
    choices: [
      { label: '"借钱也要先发工资，他们跟着我不容易。"', effects: { wealth: -1, pressure: 2, trust: 2 } },
      { label: '"先发一半，剩下的我尽快想办法。"', effects: { pressure: 1, trust: -1 } }
    ],
    onceOnly: false
  },
  {
    id: 'dark_midnight_thoughts',
    stage: 'dark',
    trigger: { pressure: [8, 10], pride: [0, 4] },
    weight: 3,
    text: '凌晨四点，你坐在阳台上，脚下是二十三楼。风很大，吹得你头发乱飞。手机里是妻子发来的消息："你在哪？"你看了看栏杆，又看了看手机。',
    choices: [
      { label: '"回屋。日子再难也得过。"', effects: { pressure: -1, pride: 1 } },
      { label: '"让我一个人待会儿……"', effects: { pressure: 2, pride: -1 } }
    ],
    onceOnly: true
  },
  {
    id: 'dark_stranger_kindness',
    stage: 'dark',
    trigger: { pride: [0, 5], pressure: [5, 10] },
    weight: 2,
    text: '面馆老板认出了你，没收你的面钱。他说"老罗，我信你，你一定能还上的"。你端着那碗面，鼻子突然酸了。面汤的热气模糊了视线。',
    choices: [
      { label: '"谢谢，我一定不会让你失望。"', effects: { pride: 2, pressure: -1, trust: 1 }, flag: 'dark_stranger_faith' },
      { label: '"……谢谢。"', effects: { pressure: -1 } }
    ],
    onceOnly: true
  },
  {
    id: 'dark_court_humiliation',
    stage: 'dark',
    trigger: { reputation: [0, 4], pressure: [6, 10] },
    weight: 3,
    text: '法庭上，对方律师把你过去发的每条微博都打印出来当证据，一条条念。你坐在被告席上，听着自己说过的话被断章取义，旁听席上有人在偷笑。',
    choices: [
      { label: '"我说的每句话我都认，但请别断章取义！"', effects: { pride: 2, pressure: 2, reputation: -1 } },
      { label: '"沉默。让律师去应对。"', effects: { pressure: -1, pride: -1 } }
    ],
    onceOnly: true
  },
  {
    id: 'dark_sell_house',
    stage: 'dark',
    trigger: { wealth: [0, 3], pressure: [5, 10] },
    weight: 4,
    text: '中介说你的房子现在卖只能卖七成价。"市场不好，你急卖就是这个价。"你看了看客厅墙上女儿画的画——她画的是一家人住在城堡里。',
    choices: [
      { label: '"卖！还债比房子重要。"', effects: { wealth: 2, pressure: -1, pride: 1 } },
      { label: '"再等等，也许能找到别的办法。"', effects: { pressure: 2, wealth: -1 } }
    ],
    onceOnly: true
  },
  {
    id: 'dark_old_friend_condition',
    stage: 'dark',
    trigger: { trust: [0, 4], wealth: [0, 3] },
    weight: 2,
    text: '老朋友愿意借你一笔钱度过难关，但条件是——你必须在公开场合感谢他，并帮他公司站台宣传。他说"这不过分吧？"',
    choices: [
      { label: '"借！面子值几个钱，活下去最重要。"', effects: { wealth: 2, pride: -2, pressure: -1 }, flag: 'dark_owed_favor' },
      { label: '"不借，我不想欠人情。"', effects: { pride: 2, pressure: 1 } }
    ],
    onceOnly: true
  },
  {
    id: 'dark_glimmer_of_hope',
    stage: 'dark',
    trigger: { pressure: [4, 10], pride: [2, 8] },
    weight: 3,
    text: '一个粉丝给你发了一封长信，说你的产品改变了他的人生。他附了一张照片——他穿着你公司的T恤，站在自己新开的店门口。你盯着那张照片看了很久，嘴角不自觉地往上翘。',
    choices: [
      { label: '"这就是我还在坚持的原因。"', effects: { pride: 2, pressure: -2 } },
      { label: '"一个人改变不了什么……"', effects: { pressure: 1, pride: -1 } }
    ],
    onceOnly: true
  },

  // ===== 还债期 (repay) 新增 =====
  {
    id: 'repay_late_night_live',
    stage: 'repay',
    trigger: { pressure: [5, 10], wealth: [0, 5] },
    weight: 4,
    text: '凌晨一点，直播间还有两万人。你已经连播了六个小时，嗓子像含了砂纸。运营说"再播一小时，流量还在涨"。你看了看桌上的润喉糖，又看了看还债进度条——还差三千万。',
    choices: [
      { label: '"播！每一单都是还债的子弹。"', effects: { wealth: 2, pressure: 2, pride: 1 } },
      { label: '"下播，身体不是铁打的。"', effects: { pressure: -2, wealth: -1 } }
    ],
    onceOnly: false
  },
  {
    id: 'repay_fake_product',
    stage: 'repay',
    trigger: { wealth: [0, 4], trust: [3, 8] },
    weight: 3,
    text: '选品团队推荐了一款"爆款"面膜，利润率高达60%。你试了一片，感觉一般。查了成分表——和市面上十块钱一片的没什么区别，但定价九十九。',
    choices: [
      { label: '"不上！这东西坑人。"', effects: { pride: 2, trust: 2, wealth: -1 } },
      { label: '"上吧，先赚钱还债要紧。"', effects: { wealth: 2, trust: -2, pride: -2 }, flag: 'repay_sellout' }
    ],
    onceOnly: true
  },
  {
    id: 'repay_rival_poach',
    stage: 'repay',
    trigger: { trust: [4, 10], reputation: [4, 10] },
    weight: 3,
    text: '竞争对手开出双倍薪水挖你的运营团队核心成员。他走了，你的直播间效率至少降一半。他来找你谈的时候，眼神里带着愧疚。',
    choices: [
      { label: '"匹配薪资，你不能走。"', effects: { wealth: -2, pressure: -1 } },
      { label: '"去吧，人各有志。"', effects: { pressure: 2, pride: 1 } }
    ],
    onceOnly: false
  },
  {
    id: 'repay_old_friend_debt',
    stage: 'repay',
    trigger: { wealth: [2, 8], pride: [3, 10] },
    weight: 2,
    text: '你欠了老同学五十万，他从来没催过。今天他打电话来，说女儿要出国留学，想问问你能不能先还一部分。你看了看账上——刚够还他，但还了之后下个月的货款就没着落了。',
    choices: [
      { label: '"还！欠朋友的比欠银行的更重。"', effects: { wealth: -2, pride: 2, trust: 2 } },
      { label: '"先还一半，剩下的下个月。"', effects: { wealth: -1, pride: -1, pressure: 1 } }
    ],
    onceOnly: true
  },
  {
    id: 'repay_platform_bully',
    stage: 'repay',
    trigger: { reputation: [3, 8], pressure: [4, 10] },
    weight: 3,
    text: '平台突然改规则，你的佣金比例从15%降到8%。客服说"新政策，所有人一样"。但你知道，同级别主播的佣金没变——他们只是想逼你签独家。',
    choices: [
      { label: '"签独家，至少佣金能恢复。"', effects: { wealth: 1, pride: -2, pressure: -1 }, flag: 'repay_platform_bind' },
      { label: '"不签，大不了多平台发展。"', effects: { pride: 2, pressure: 1, wealth: -1 } }
    ],
    onceOnly: true
  },
  {
    id: 'repay_family_sacrifice',
    stage: 'repay',
    trigger: { pressure: [5, 10], wealth: [0, 5] },
    weight: 4,
    text: '妻子说她把嫁妆卖了，凑了三十万。"先还债吧，嫁妆以后再买。"她笑着说，但你看到她眼角有泪。那对金镯子是她妈妈留给她的。',
    choices: [
      { label: '"不收！我自己的债自己还。"', effects: { pride: 2, pressure: 2 } },
      { label: '"……谢谢。我一定加倍还你。"', effects: { wealth: 2, pressure: -1, pride: -1 } }
    ],
    onceOnly: true
  },
  {
    id: 'repay_charity_trick',
    stage: 'repay',
    trigger: { trust: [4, 10], reputation: [5, 10] },
    weight: 2,
    text: '一家慈善机构找你合作直播义卖，说"既做公益又涨粉"。但你查了他们的财务——管理费占了70%，真正到受助人手里的不到三成。',
    choices: [
      { label: '"不合作，这哪是慈善。"', effects: { pride: 2, trust: 1 } },
      { label: '"合作吧，至少名义上是好事。"', effects: { reputation: 1, trust: -1, pride: -1 } }
    ],
    onceOnly: true
  },
  {
    id: 'repay_snitch_offer',
    stage: 'repay',
    trigger: { wealth: [0, 3], pressure: [5, 10] },
    weight: 2,
    text: '有人出价一千万，让你在直播中"无意"提到某个品牌。不是广告，是"种草"。你看了那个品牌的产品——质量很差，但营销预算充足。',
    choices: [
      { label: '"不干，我的信誉不是卖的。"', effects: { pride: 2, trust: 1 } },
      { label: '"干，一千万能还不少债。"', effects: { wealth: 3, trust: -2, pride: -2 }, flag: 'repay_stealth_ad' }
    ],
    onceOnly: true
  },
  {
    id: 'repay_fan_gift',
    stage: 'repay',
    trigger: { trust: [5, 10], pressure: [3, 8] },
    weight: 3,
    text: '一个粉丝寄来一箱自家种的水果，附了封信："老罗，你不用回信，我就想让你知道有人挺你。"你拆开箱子，苹果上还带着露水。你咬了一口，甜的。',
    choices: [
      { label: '"在直播里感谢他，让更多人看到这份善意。"', effects: { trust: 1, reputation: 1, pressure: -1 } },
      { label: '"默默收下，不想消费别人的善意。"', effects: { pride: 1, pressure: -1 } }
    ],
    onceOnly: false
  },
  {
    id: 'repay_contract_trap',
    stage: 'repay',
    trigger: { wealth: [0, 4], reputation: [3, 8] },
    weight: 3,
    text: 'MCN机构递来一份合同，签约费五百万。但你仔细看条款——未来三年的所有收入归他们，你只拿固定工资。律师说"这基本是卖身契"。',
    choices: [
      { label: '"不签，自由比钱重要。"', effects: { pride: 2, wealth: -1 } },
      { label: '"签，先拿到五百万还债。"', effects: { wealth: 3, pride: -2, pressure: -1 }, flag: 'repay_sold' }
    ],
    onceOnly: true
  },
  {
    id: 'repay_small_victory',
    stage: 'repay',
    trigger: { pride: [3, 10], trust: [4, 10] },
    weight: 3,
    text: '今天还清了第一笔小额债务——一百二十万。你在还债清单上划掉那一行的时候，手在抖。旁边还剩三十多行。但至少，少了一行。',
    choices: [
      { label: '"继续，一行一行划掉。"', effects: { pride: 2, pressure: -1 } },
      { label: '"还有那么多……什么时候是个头。"', effects: { pressure: 2, pride: -1 } }
    ],
    onceOnly: true
  },

  // ===== 新生期 (reborn) 新增 =====
  {
    id: 'reborn_health_warning',
    stage: 'reborn',
    trigger: { pressure: [3, 10], wealth: [4, 10] },
    weight: 3,
    text: '体检报告上多了几个红色指标。医生严肃地说："你的身体透支太严重了，再不改变生活方式，后果很严重。"你想起那些熬夜直播的夜晚，和无数杯浓咖啡。',
    choices: [
      { label: '"从今天开始改变，身体是本钱。"', effects: { pressure: -2, pride: 1 }, flag: 'reborn_health_wake' },
      { label: '"知道了，但事业刚起步，停不下来。"', effects: { pressure: 1 } }
    ],
    onceOnly: true
  },
  {
    id: 'reborn_old_partner_return',
    stage: 'reborn',
    trigger: { trust: [4, 10], pride: [3, 10] },
    weight: 2,
    text: '当年创业时的合伙人找上门："老罗，我有个新项目，要不要一起？"上次合作，他中途退出留你一个人扛。但这次他带来的技术确实前沿。',
    choices: [
      { label: '"再信他一次，人都会成长。"', effects: { trust: 1, wealth: -1, pressure: 1 }, flag: 'reborn_second_chance' },
      { label: '"不了，一次背叛就够了。"', effects: { pride: 2, pressure: -1 } }
    ],
    onceOnly: true
  },
  {
    id: 'reborn_daughter_dream',
    stage: 'reborn',
    trigger: { pride: [3, 10], pressure: [0, 5] },
    weight: 3,
    text: '女儿画了一幅画：爸爸站在舞台上，下面全是鼓掌的人。她说"爸爸，你以后还会做手机吗？"你看着那幅画，喉咙发紧。',
    choices: [
      { label: '"会的，爸爸答应你。"', effects: { pride: 2, pressure: 1 } },
      { label: '"也许吧，先做好眼前的事。"', effects: { pressure: -1 } }
    ],
    onceOnly: true
  },
  {
    id: 'reborn_biography_offer',
    stage: 'reborn',
    trigger: { reputation: [5, 10], trust: [4, 10] },
    weight: 2,
    text: '出版社想给你出自传，预付版税两百万。编辑说"你的故事太传奇了"。你翻了翻提纲——从退学少年到负债六亿再到翻身，每一段都像刀子。',
    choices: [
      { label: '"写！我的故事也许能帮到别人。"', effects: { wealth: 2, reputation: 1, pride: 1 }, flag: 'reborn_biography' },
      { label: '"不写，过去的事不想再翻。"', effects: { pride: 1 } }
    ],
    onceOnly: true
  },
  {
    id: 'reborn_investment_trap',
    stage: 'reborn',
    trigger: { wealth: [5, 10], pride: [2, 8] },
    weight: 3,
    text: '一个"稳赚不赔"的投资项目找上门，年化收益号称40%。你看了看材料——包装精美，但底层逻辑经不起推敲。你想起自己当年也被类似的PPT骗过。',
    choices: [
      { label: '"不投，我吃过亏不会再上当。"', effects: { pride: 2, wealth: -1 } },
      { label: '"投一点试试水，万一是真的呢？"', effects: { wealth: -2, pride: -1, pressure: 1 }, flag: 'reborn_greedy' }
    ],
    onceOnly: true
  },
  {
    id: 'reborn_industry_invitation',
    stage: 'reborn',
    trigger: { reputation: [6, 10], wealth: [4, 10] },
    weight: 2,
    text: '行业峰会邀请你做主题演讲，台下坐着你曾经的对手和嘲笑过你的人。你站在后台，看着演讲稿上"失败与重生"四个字。',
    choices: [
      { label: '"讲！让他们看看我还站着。"', effects: { reputation: 2, pride: 2, pressure: 1 } },
      { label: '"低调点，别再树敌了。"', effects: { pressure: -1, pride: -1 } }
    ],
    onceOnly: true
  },
  {
    id: 'reborn_old_enemy_olive_branch',
    stage: 'reborn',
    trigger: { pride: [3, 10], reputation: [5, 10] },
    weight: 2,
    text: '当年在社交媒体上骂你最凶的那个大V，突然私信你："老罗，咱们合作吧，流量共享。"你看着这条消息，想起他当年那些恶毒的评论。',
    choices: [
      { label: '"合作，过去的就过去了。"', effects: { reputation: 1, wealth: 1, pride: -1 } },
      { label: '"不了，有些人不值得原谅。"', effects: { pride: 2, reputation: -1 } }
    ],
    onceOnly: true
  },
  {
    id: 'reborn_community_call',
    stage: 'reborn',
    trigger: { trust: [5, 10], pride: [3, 10] },
    weight: 3,
    text: '老家的镇长打来电话，说想请你回去给年轻人做个分享。"你是我们镇的骄傲。"你想起当年从那个小镇走出去的时候，邻居们都说"这孩子没出息"。',
    choices: [
      { label: '"回去！让他们看看，没出息的孩子也能站起来。"', effects: { pride: 2, reputation: 1, pressure: -1 } },
      { label: '"算了，不想回去了。"', effects: { pressure: -1 } }
    ],
    onceOnly: true
  },
  {
    id: 'reborn_tech_crossroads',
    stage: 'reborn',
    trigger: { wealth: [5, 10], pride: [4, 10] },
    weight: 2,
    text: 'AI时代来了，你有两个选择：做AI硬件，或者做AI软件服务。硬件是你一直的梦想，但风险巨大；软件服务来钱快，但离你的理想越来越远。',
    choices: [
      { label: '"做硬件！我一辈子都在追那个梦。"', effects: { pride: 2, wealth: -1, pressure: 2 }, flag: 'reborn_hardware_dream' },
      { label: '"做软件，先活下来再谈理想。"', effects: { wealth: 2, pride: -1 } }
    ],
    onceOnly: true
  },
  {
    id: 'reborn_legacy_question',
    stage: 'reborn',
    trigger: { pride: [5, 10], reputation: [6, 10] },
    weight: 2,
    text: '记者问你："你希望后人怎么记住你？"你愣了一下。是"那个做手机失败的人"？还是"那个还清了六亿债务的人"？还是别的什么？',
    choices: [
      { label: '"一个一直在折腾、从未放弃的人。"', effects: { pride: 2, reputation: 1 } },
      { label: '"不重要，活着的人不需要墓志铭。"', effects: { pressure: -1 } }
    ],
    onceOnly: false
  },
  {
    id: 'reborn_health_lifestyle',
    stage: 'reborn',
    trigger: { pressure: [0, 4], wealth: [4, 10] },
    weight: 3,
    text: '你开始跑步了。每天早上六点，绕着小区跑三公里。邻居们从窗户里看着你——那个曾经负债六亿的人，现在穿着运动服在晨光里慢跑。你喘着粗气，但嘴角是翘的。',
    choices: [
      { label: '"坚持跑，身体是革命的本钱。"', effects: { pressure: -2, pride: 1 } },
      { label: '"跑两天得了，哪有时间天天跑。"', effects: { pressure: 1 } }
    ],
    onceOnly: false
  },
  {
    id: 'reborn_family_time',
    stage: 'reborn',
    trigger: { pressure: [0, 5], pride: [3, 10] },
    weight: 4,
    text: '女儿学校开家长会，你第一次参加。老师介绍你的时候说"这是某某的爸爸"，没提你是谁。你坐在小椅子上，看着女儿冲你笑，觉得这辈子最对的事就是来了。',
    choices: [
      { label: '"以后每次都来，什么都没有这个重要。"', effects: { pressure: -2, pride: 1, trust: 1 }, flag: 'reborn_family_first' },
      { label: '"尽量来吧，工作也很忙。"', effects: { pressure: 1 } }
    ],
    onceOnly: true
  },
  {
    id: 'reborn_teaching_offer',
    stage: 'reborn',
    trigger: { reputation: [5, 10], trust: [5, 10] },
    weight: 2,
    text: '一所大学邀请你去做客座教授，教创业课。没有工资，但能影响一批年轻人。你想起当年在新东方站讲台的日子，和那些亮晶晶的眼睛。',
    choices: [
      { label: '"去！教书是我最纯粹的时候。"', effects: { pride: 2, trust: 1, reputation: 1 } },
      { label: '"没时间，我现在太忙了。"', effects: { pressure: 1 } }
    ],
    onceOnly: true
  },
  {
    id: 'reborn_brand_deal',
    stage: 'reborn',
    trigger: { wealth: [4, 10], reputation: [5, 10] },
    weight: 3,
    text: '国际品牌想请你做代言人，开价八位数。但合同里有一条：你不能在公开场合发表任何"争议性言论"。你看了看那条条款——这基本等于让你闭嘴。',
    choices: [
      { label: '"不签，我的嘴不是用来替别人说话的。"', effects: { pride: 3, wealth: -2 } },
      { label: '"签，八位数不是小数目。"', effects: { wealth: 3, pride: -2, pressure: -1 }, flag: 'reborn_silenced' }
    ],
    onceOnly: true
  },
  {
    id: 'reborn_reflection_mirror',
    stage: 'reborn',
    trigger: { pride: [3, 10], pressure: [0, 5] },
    weight: 3,
    text: '你站在镜子前，看着里面的自己——头发白了一半，眼角的皱纹深了，但眼神还是亮的。你想起二十年前那个站在地摊前翻书的少年，想起十年前站在讲台上的老师，想起五年前站在废墟里的创业者。',
    choices: [
      { label: '"我还在，就够了。"', effects: { pride: 2, pressure: -2 } },
      { label: '"还不够，我还能走更远。"', effects: { pride: 1, pressure: 1 } }
    ],
    onceOnly: false
  },

  // ===== T37 新增 =====
  {
    id: 'youth_friend_asks_help',
    stage: 'youth',
    trigger: { pride: [2, 8], reputation: [0, 5], pressure: [3, 8] },
    weight: 3,
    text: '发小半夜敲开你家门，脸上带着淤青。他说自己跟人打架惹了麻烦，求你替他顶一句谎，就一句——"当时他跟我在一起"。你看着他，想起小时候他分你半块橡皮的情分。',
    choices: [
      { label: '"帮你撒谎？不行，但我会陪你面对。"', effects: { pride: 1, pressure: 1 } },
      { label: '"……就这一次，下不为例。"', effects: { reputation: -1, pride: -1, pressure: -1 }, flag: 'youth_liar' }
    ],
    onceOnly: true
  },
  {
    id: 'teacher_investor_visit',
    stage: 'teacher',
    trigger: { reputation: [5, 10], pride: [4, 10] },
    weight: 2,
    text: '课后，一个西装革履的人递上名片："罗老师，我听了您三节课。您的表达力和个人魅力，非常适合做知识付费。我们公司想投您。"你看了看那张名片，又看了看讲台上的粉笔灰。',
    choices: [
      { label: '"我对钱没兴趣，我只对教书感兴趣。"', effects: { pride: 2, wealth: -1 } },
      { label: '"聊聊看，也许这是条新路。"', effects: { wealth: 1, pride: -1, pressure: 1 } }
    ],
    onceOnly: true
  },
  {
    id: 'teacher_body_alarm',
    stage: 'teacher',
    trigger: { pressure: [6, 10], pride: [3, 8] },
    weight: 4,
    text: '讲到一半，你眼前突然发黑，扶住讲台才没栽下去。学生吓得不敢出声。下课后你量了血压——高得吓人。妻子发来消息："去医院。"明天还有四节课。',
    choices: [
      { label: '"撑完这周再说，课不能停。"', effects: { pressure: 2, reputation: 1, pride: 1 } },
      { label: '"马上去医院，命比课重要。"', effects: { pressure: -2, wealth: -1 } }
    ],
    onceOnly: false
  },
  {
    id: 'startup_quality_crisis',
    stage: 'startup',
    trigger: { reputation: [4, 10], wealth: [2, 8] },
    weight: 3,
    text: '凌晨，社交媒体上开始疯传一组照片：有用户称你的产品充电时发热严重，边框烫到可以煎蛋。评论区已经炸锅，"老罗这次又翻车"的热搜在往上爬。你手里握着那台同批次的样机，手心是凉的。',
    choices: [
      { label: '"立刻召回同批次，公开道歉。"', effects: { wealth: -2, trust: 2, pride: 1 } },
      { label: '"先让公关压热度，等技术报告。"', effects: { reputation: -2, wealth: 1, trust: -1 }, flag: 'startup_pr_cover' }
    ],
    onceOnly: true
  },
  {
    id: 'dark_media_spy',
    stage: 'dark',
    trigger: { reputation: [2, 8], pressure: [5, 10] },
    weight: 3,
    text: '你下楼买烟，发现对面停着一辆陌生的面包车，车窗贴着黑膜。第二天，网上出现你妻子送孩子上学的照片，标题是"老赖的日常生活"。记者把麦克风伸到你面前："罗总，什么时候还钱？"',
    choices: [
      { label: '"接受采访，正面回应。"', effects: { reputation: 1, pressure: 2, pride: 1 } },
      { label: '"一言不发，护着家人走。"', effects: { pressure: -1, pride: -1, trust: 1 } }
    ],
    onceOnly: false
  },
  {
    id: 'repay_fan_letter',
    stage: 'repay',
    trigger: { trust: [5, 10], pressure: [4, 10] },
    weight: 3,
    text: '下播后，助理递来一摞信。其中一封字迹歪歪扭扭："老罗，我买你带的货不是因为便宜，是因为你说过不坑人。我现在还在还房贷，但我会一直支持你。别让我们失望。"你盯着那行字，看了很久。',
    choices: [
      { label: '"把信收好，这是比债更重的责任。"', effects: { trust: 1, pride: 1, pressure: -1 }, flag: 'repay_fan_promise' },
      { label: '"越是这样，越不能让他们输。"', effects: { pressure: 1, pride: 1, wealth: -1 } }
    ],
    onceOnly: true
  },
  {
    id: 'repay_livestream_fail',
    stage: 'repay',
    trigger: { reputation: [4, 10], pressure: [5, 10] },
    weight: 4,
    text: '直播间里，你正滔滔不绝介绍一款耳机，口误把竞品名字喊了出来。弹幕瞬间爆炸："老罗叛变了！""收钱了！"运营在镜头外拼命打手势，脸都白了。',
    choices: [
      { label: '"自嘲圆场：看，我是真没稿子。"', effects: { reputation: 1, pride: 1, pressure: -1 } },
      { label: '"立刻下播，避免继续发酵。"', effects: { reputation: -1, pressure: -1, wealth: -1 } }
    ],
    onceOnly: false
  },
  {
    id: 'reborn_ai_hallucination',
    stage: 'reborn',
    trigger: { reputation: [5, 10], pride: [4, 10] },
    weight: 3,
    text: '一个AI平台发布了一段"罗远最新专访"，视频里"你"侃侃而谈，说了大量你从未说过的话，甚至"承认"当年某次失败是骗局。热搜爆了，网友开始引用那段采访攻击你。',
    choices: [
      { label: '"发长文辟谣，必要时起诉平台。"', effects: { pride: 2, pressure: 2, reputation: 1 }, flag: 'reborn_fights_ai_fake' },
      { label: '"一笑置之，假的真不了。"', effects: { pressure: -1, reputation: -1 } }
    ],
    onceOnly: true
  },

  // ===== T60 新增 =====
  {
    id: 'teacher_niubowang',
    stage: 'teacher',
    trigger: { pride: [4, 10], reputation: [4, 10] },
    weight: 2,
    text: '一个搞互联网的朋友找你："老罗，咱们办个博客吧，不删帖、说真话，就叫牛博网怎么样？"你看了看讲台上刚发下来的工资条，又看了看窗外。',
    choices: [
      { label: '"办！真话比课时费值钱。"', effects: { pride: 2, reputation: 1, wealth: -1, pressure: 1 }, flag: 'niubowang_founder' },
      { label: '"先教书吧，饭都吃不饱谈什么理想。"', effects: { pride: -1, wealth: 1 } }
    ],
    onceOnly: true
  },
  {
    id: 'startup_fang_debate',
    stage: 'startup',
    trigger: { reputation: [5, 10], pressure: [4, 10] },
    weight: 2,
    text: '方舟子突然发微博质疑你的学历背景，评论区瞬间被点燃。媒体记者全挤到公司楼下，等着你出来说一句。',
    choices: [
      { label: '"正面回应，用事实说话。"', effects: { reputation: 1, pride: 1, pressure: 2 }, flag: 'fought_fang' },
      { label: '"不回应，产品会说话。"', effects: { pressure: -1, reputation: -1 } }
    ],
    onceOnly: true
  },
  {
    id: 'reborn_farewell_speech',
    stage: 'reborn',
    trigger: { trust: [6, 10], reputation: [6, 10] },
    weight: 2,
    text: '一所普通二本大学邀请你做毕业演讲，没有出场费，经费只够报销火车票。学生们给你写了封信："罗老师，我们买不起您带的货，但想亲耳听您说一次别认输。"',
    choices: [
      { label: '"去！有些话值得免费说。"', effects: { trust: 2, reputation: 1, pride: 1 } },
      { label: '"让团队报个价，我的时间也是成本。"', effects: { wealth: 1, trust: -1, pride: -1 } }
    ],
    onceOnly: true
  },

  // ===== 隐藏 / 稀有 / 连锁事件 =====
  {
    id: 'hidden_youth_meteor',
    stage: 'youth',
    trigger: { pride: [7, 10], pressure: [0, 4] },
    weight: 1,
    rarity: 'legendary',
    text: '深夜，你躺在屋顶上看流星。一颗特别亮的划过，你下意识闭上眼睛许愿。睁开眼时，你发现自己在笑——不是为了钱，不是为了面子，只是因为你还相信点什么。',
    choices: [
      { label: '"我要做一件让世界记住的事。"', effects: { pride: 3, pressure: 1 }, flag: 'hidden_stargazer' },
      { label: '"……算了，睡觉吧。"', effects: { pressure: -1 } }
    ],
    onceOnly: true,
    hidden: true
  },
  {
    id: 'hidden_teacher_prophecy',
    stage: 'teacher',
    trigger: { reputation: [7, 10], pride: [6, 10] },
    weight: 1,
    rarity: 'rare',
    requiresFlags: ['hidden_stargazer'],
    text: '课后，一个学生拦住你："罗老师，我昨晚梦见您站在一个特别大的舞台上，下面几万人。您说\'我不是来教英语的，我是来改变世界的\'。"你愣了一下——这话，你自己都没敢说出来。',
    choices: [
      { label: '"也许有一天，我真的会站上去。"', effects: { pride: 2, reputation: 1, pressure: 1 }, flag: 'hidden_prophecy' },
      { label: '"别做梦了，回去背单词。"', effects: { reputation: -1 } }
    ],
    onceOnly: true,
    hidden: true
  },
  {
    id: 'hidden_startup_angel',
    stage: 'startup',
    trigger: { wealth: [0, 3], pride: [6, 10] },
    weight: 1,
    rarity: 'legendary',
    requiresFlags: ['hidden_prophecy'],
    text: '一个神秘投资人约你喝咖啡，他不问你估值，只问了一个问题："如果给你十个亿，你会做出什么？"你滔滔不绝讲了两个小时。他听完只说了一句："下周打款。"你至今不知道他是谁。',
    choices: [
      { label: '"这份信任，我不能辜负。"', effects: { wealth: 3, pride: 2, pressure: 2, trust: 2 }, flag: 'hidden_angel_investor' },
      { label: '"十个亿？我得再想想。"', effects: { wealth: 1, pride: -1 } }
    ],
    onceOnly: true,
    hidden: true
  },
  {
    id: 'hidden_dark_mysterious_helper',
    stage: 'dark',
    trigger: { wealth: [0, 2], pressure: [7, 10] },
    weight: 1,
    rarity: 'rare',
    blocksFlags: ['dark_asset_hide'],
    text: '你最落魄的时候，收到一封没有署名的邮件。附件是一份债务重组方案，详细到每一条法律条款。邮件正文只有一句话："你当年帮过我，现在我还你。"你翻遍通讯录，想不起是谁。',
    choices: [
      { label: '" whoever you are, thank you."', effects: { pressure: -3, trust: 2, pride: 1 }, flag: 'hidden_mysterious_help' },
      { label: '"不敢相信无缘无故的善意。"', effects: { pressure: -1, trust: -1 } }
    ],
    onceOnly: true,
    hidden: true
  },
  {
    id: 'hidden_repay_lottery_ticket',
    stage: 'repay',
    trigger: { wealth: [0, 3], pressure: [5, 10] },
    weight: 1,
    rarity: 'legendary',
    text: '粉丝送你一张彩票，说"老罗，中了就能少还点"。你随手塞进抽屉，差点忘了。开奖那天，助理尖叫着冲进办公室——你中了五百万。你盯着那串数字，手抖得点不着烟。',
    choices: [
      { label: '"全部用于还债，一分不留。"', effects: { wealth: 3, trust: 3, pride: 2, pressure: -3 }, flag: 'hidden_lottery_repay' },
      { label: '"留一部分应急，剩下的还债。"', effects: { wealth: 2, pressure: -2, trust: 1 } }
    ],
    onceOnly: true,
    hidden: true,
    effectVariance: { wealth: [0, 2] }
  },
  {
    id: 'hidden_reborn_time_capsule',
    stage: 'reborn',
    trigger: { pride: [5, 10], pressure: [0, 5] },
    weight: 1,
    rarity: 'rare',
    requiresFlags: ['hidden_stargazer'],
    text: '搬家时翻出少年时埋的铁盒。里面有张纸条，上面是你十七岁的字迹："罗远，不管将来多惨，都不准变成自己讨厌的人。"你看了很久，眼眶有点酸。',
    choices: [
      { label: '"我没变。"', effects: { pride: 3, pressure: -2, trust: 1 }, flag: 'hidden_kept_promise' },
      { label: '"……也许变了一点。"', effects: { pride: -1, pressure: -1 } }
    ],
    onceOnly: true,
    hidden: true
  },
  {
    id: 'rare_crossroad_stranger',
    stage: 'youth',
    crossStage: true,
    trigger: { pride: [4, 10], reputation: [0, 6] },
    weight: 1,
    rarity: 'rare',
    text: '一个陌生老头在火车站拦住你，说你"眉间有股不服输的劲"。他递给你一张泛黄的名片："年轻时有难处，可以找我。"你低头看了眼名片，再抬头时，人已经消失在人群里。',
    choices: [
      { label: '"收下名片，也许真有用。"', effects: { pride: 1, reputation: 1 }, flag: 'rare_stranger_card' },
      { label: '"江湖骗子，不理他。"', effects: { pride: 1 } }
    ],
    onceOnly: true
  },
  {
    id: 'rare_lucky_break',
    stage: 'startup',
    crossStage: true,
    trigger: { wealth: [0, 4], pressure: [5, 10] },
    weight: 1,
    rarity: 'rare',
    text: '公司账上快没钱了，你准备宣布裁员。就在这时，一个被你忘记的旧客户突然打来尾款——数目不大，但刚好够撑过这个月。办公室鸦雀无声，你握着手机，觉得命运偶尔也讲点道理。',
    choices: [
      { label: '"这是天意，我不能倒下。"', effects: { wealth: 2, pressure: -2, pride: 1 }, flag: 'rare_lucky_break' },
      { label: '"运气而已，不能依赖。"', effects: { pressure: -1, pride: 1 } }
    ],
    onceOnly: false,
    effectVariance: { wealth: [-1, 2], pressure: [-1, 0] }
  },
  {
    id: 'rare_tabloid_truth',
    stage: 'dark',
    crossStage: true,
    trigger: { reputation: [0, 4], pressure: [6, 10] },
    weight: 1,
    rarity: 'rare',
    text: '一家小报想采访你，标题都想好了："罗远：从理想主义到欠债六亿"。记者说："你放心，我们不洗白，也不抹黑，只记录事实。"你看着她的眼睛，判断不出真假。',
    choices: [
      { label: '"接受，事实比辩解有力。"', effects: { reputation: 2, trust: 1, pressure: 1 }, flag: 'rare_truth_interview' },
      { label: '"不接受，我现在说什么都会被曲解。"', effects: { pressure: -1, reputation: -1 } }
    ],
    onceOnly: true
  },
  {
    id: 'chain_youth_bookseller',
    stage: 'youth',
    trigger: { wealth: [0, 4], pride: [3, 10] },
    weight: 3,
    requiresFlags: ['bookworm'],
    text: '那个书摊老板认出你了。他说："上次欠我那本书的钱，不要了。但有个条件——你以后出名了，得回来告诉我，那本书值不值。"你笑了笑，没说话。',
    choices: [
      { label: '"一定回来。"', effects: { pride: 2, trust: 1, wealth: 1 }, flag: 'chain_bookseller_debt' },
      { label: '"二十块我现在就能还你。"', effects: { wealth: -1, pride: 1 } }
    ],
    onceOnly: true
  },
  {
    id: 'chain_startup_old_savior',
    stage: 'startup',
    trigger: { wealth: [0, 4], pressure: [5, 10] },
    weight: 2,
    requiresFlags: ['chain_bookseller_debt'],
    text: '公司最危难时，一个穿着朴素的中年男人来到前台，说是你"债主"。你下楼一看——是当年那个书摊老板。他掏出一张卡："我这些年攒了八十万，你先拿去用。"',
    choices: [
      { label: '"这钱我借，一定还。"', effects: { wealth: 2, trust: 2, pressure: -2, pride: 1 }, flag: 'chain_bookseller_saved' },
      { label: '"不能拿您的养老钱。"', effects: { pride: 2, trust: 1 } }
    ],
    onceOnly: true
  },
  {
    id: 'chain_repay_reunion',
    stage: 'repay',
    trigger: { wealth: [3, 8], trust: [5, 10] },
    weight: 2,
    requiresFlags: ['chain_bookseller_saved'],
    text: '你还清最后一笔私人债务那天，书摊老板来了。你递给他一个信封，里面是八十万加利息。他没接，只说："你当年说那本书值，我现在信了——不是书值，是人值。"',
    choices: [
      { label: '"是您先信我的。"', effects: { trust: 3, pride: 2, pressure: -2 }, flag: 'chain_debt_honored' },
      { label: '"钱您必须拿着。"', effects: { wealth: -1, trust: 2 } }
    ],
    onceOnly: true
  },
  {
    id: 'chain_dark_fighter_recognition',
    stage: 'dark',
    trigger: { reputation: [2, 6], pride: [5, 10] },
    weight: 2,
    requiresFlags: ['fighter'],
    text: '当年那个被你从 bully 手里救下的同学，现在成了一名律师。他主动联系你："老罗，我免费帮你处理债务纠纷。你当年帮我一次，我还你一辈子。"',
    choices: [
      { label: '"当年那架没白打。"', effects: { trust: 2, pressure: -1, pride: 1 }, flag: 'chain_fighter_recognition' },
      { label: '"不用免费，该多少是多少。"', effects: { pride: 2, wealth: -1 } }
    ],
    onceOnly: true
  },
  {
    id: 'random_fortune_cookie',
    stage: 'teacher',
    crossStage: true,
    trigger: { pressure: [3, 10] },
    weight: 2,
    rarity: 'common',
    text: '中午吃外卖，附赠的幸运饼干里夹着一张纸条："你即将面临一个重大选择，听从内心。"你笑了笑，把纸条塞进钱包——后来它在你最低落的时候掉了出来。',
    choices: [
      { label: '"留着，当个念想。"', effects: { pressure: -1, pride: 1 } },
      { label: '"扔了，命运不靠纸条。"', effects: { pride: 1 } }
    ],
    onceOnly: true
  }
];

/**
 * 根据当前状态筛选可触发的随机事件
 * @param {object} state - 游戏状态
 * @param {string} stage - 当前阶段
 * @param {Set} triggeredEvents - 已触发过的事件ID集合
 * @param {Set} flags - 远期标记集合
 * @returns {array} 可触发的事件列表（带权重）
 */
export function getAvailableEvents(state, stage, triggeredEvents, flags = new Set()) {
  return RANDOM_EVENTS.filter(event => {
    if (!event.crossStage && event.stage !== stage) return false;
    if (event.onceOnly && triggeredEvents.has(event.id)) return false;

    // 隐藏/连锁事件需要特定 flag
    if (event.requiresFlags) {
      for (const f of event.requiresFlags) {
        if (!flags.has(f)) return false;
      }
    }
    if (event.blocksFlags) {
      for (const f of event.blocksFlags) {
        if (flags.has(f)) return false;
      }
    }

    const t = event.trigger || {};
    if (t.pride && (state.pride < t.pride[0] || state.pride > t.pride[1])) return false;
    if (t.wealth && (state.wealth < t.wealth[0] || state.wealth > t.wealth[1])) return false;
    if (t.reputation && (state.reputation < t.reputation[0] || state.reputation > t.reputation[1])) return false;
    if (t.failures && (state.failures || 0) < t.failures) return false;
    if (t.pressure && (state.pressure < t.pressure[0] || state.pressure > t.pressure[1])) return false;
    if (t.trust && (state.trust < t.trust[0] || state.trust > t.trust[1])) return false;
    return true;
  });
}

/**
 * 从可触发事件中随机选一个（按权重）
 * 稀有事件需要额外掷骰
 */
export function pickRandomEvent(availableEvents, talentSpecials = []) {
  if (availableEvents.length === 0) return null;

  // 稀有度额外判定
  const eligible = availableEvents.filter(e => checkRarityRoll(e.rarity));
  const pool = eligible.length > 0 ? eligible : availableEvents.filter(e => !e.rarity || e.rarity === 'common');

  // random_events_bias_positive: 提升正面随机事件权重
  const biasPositive = talentSpecials.includes('random_events_bias_positive');
  const getWeight = (e) => biasPositive && isPositiveEvent(e) ? e.weight * 2 : e.weight;

  const totalWeight = pool.reduce((sum, e) => sum + getWeight(e), 0);
  let roll = Math.random() * totalWeight;
  for (const event of pool) {
    roll -= getWeight(event);
    if (roll <= 0) return event;
  }
  return pool[pool.length - 1];
}

/**
 * 判断事件是否为正面事件（至少一个选项净效果为正）
 */
function isPositiveEvent(event) {
  if (!event.choices || !event.choices.length) return false;
  return event.choices.some(choice => {
    if (!choice.effects) return false;
    const e = choice.effects;
    const net = (e.pride || 0) + (e.wealth || 0) +
                (e.reputation || 0) + (e.trust || 0) -
                (e.pressure || 0) - (e.failures || 0);
    return net > 0;
  });
}

/**
 * 稀有度掷骰
 */
function checkRarityRoll(rarity) {
  if (!rarity || rarity === 'common') return true;
  if (rarity === 'rare') return Math.random() < 0.25;
  if (rarity === 'legendary') return Math.random() < 0.08;
  return true;
}

/**
 * 解析效果：支持固定值 + 随机波动区间
 * effectVariance 格式：{ pride: [-1, 2], wealth: [0, 1] }
 * 返回最终 effects 对象
 */
export function resolveRandomEffects(baseEffects = {}, effectVariance = {}) {
  const result = { ...baseEffects };
  for (const [key, range] of Object.entries(effectVariance)) {
    if (!Array.isArray(range) || range.length < 2) continue;
    const [min, max] = range;
    const variance = Math.floor(Math.random() * (max - min + 1)) + min;
    if (variance !== 0) {
      result[key] = (result[key] || 0) + variance;
    }
  }
  return result;
}
