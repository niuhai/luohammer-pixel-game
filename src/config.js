export const GAME_WIDTH = 800;
export const GAME_HEIGHT = 500;
export const PIXEL_SCALE = 2;
export const GRID = 4;

export const UI_COLORS = {
  panelBg: 0x12122a,
  panelBgLight: 0x1a1a32,
  cornerDecor: 0xf0c040,
  scanline: 0xf0c040,
  outline: 0x0a0a0a,
  glow: 0xf0c040,
  border: 0x1a1a2e,
  accent: 0xf0c040,
  highlight: 0xf0c040,
  text: 0xe8d5a3,
  textDim: 0x9a8a6a,
  dialogueBg: 0x1a1a2e,
  dialogueBorder: 0xf0c040,
  button: 0x2a2a4e,
  buttonHover: 0xf0c040,
  success: 0x40c040,
  danger: 0xe04040
};

export const FONTS = {
  pixel: '"Microsoft YaHei", "PingFang SC", "Heiti SC", "Noto Sans SC", sans-serif',
  chinese: '"Microsoft YaHei", "PingFang SC", "Heiti SC", "Noto Sans SC", sans-serif',
  body: '"Microsoft YaHei", "PingFang SC", "Heiti SC", "Noto Sans SC", sans-serif',
  mono: '"Courier New", "Microsoft YaHei", monospace'
};

/**
 * 角色名称 → 颜色映射。
 * 对话系统（DialogSystem）读取 characterName，在此表里查到对应颜色，
 * 用来给名字文字上色 —— 玩家一眼就能知道是谁在说话。
 * 未在表里匹配到的角色名 → 默认使用金色（主强调色）。
 */
export const CHARACTER_COLORS = {
  // === 主角 ===
  '罗远': 0xf0c040,      // 主角 — 金色（主强调色）
  '罗远(少年)': 0xc8e0ff, // 少年时期 — 淡蓝
  '罗远(创业者)': 0xffa060, // 创业时期 — 橙色（热血）
  '罗远(主播)': 0xff6b9d,  // 直播时期 — 粉色（热门）

  // === 关键 NPC ===
  '父亲': 0x8aa8d8,        // 权威 — 冷蓝灰
  '母亲': 0xd8a8a8,        // 温暖 — 暖粉灰
  '老师': 0x8ac8a8,        // 教育 — 绿色
  '校长': 0x8aa8d8,

  // === 新东方时期 ===
  '学生': 0x9a9ac8,        // 普通学生 — 紫灰
  '同事': 0xa8c8e8,

  // === 锤子/创业时期 ===
  '合伙人': 0xffc040,       // 创业伙伴 — 暖金
  '投资人': 0x40c8c8,       // 投资人 — 青金
  '员工': 0xc8a888,         // 员工 — 暖棕
  '工程师': 0xa8b8d8,       // 工程师 — 灰蓝

  // === 直播时期 ===
  '观众': 0xff9060,         // 观众 — 暖橙
  '粉丝': 0xff88cc,         // 粉丝 — 粉

  // === 法庭/特殊时期 ===
  '法官': 0x8888c8,         // 法官 — 深紫灰（权威）
  '律师': 0xa8a8c8,
  '对手': 0xe06060,         // 对手 — 红色（警告）

  // === 系统文本 ===
  '旁白': 0x9a8a6a,         // 旁白叙述 — 暗金色（不抢戏）
  '叙事者': 0x9a8a6a,
  '系统': 0x60c0ff,        // 系统消息 — 亮蓝
  '阶段结算': 0xf0c040,     // 结算 — 金色（强调）
  '往事回响': 0x8080e0,     // 历史对照卡片 — 紫蓝
  '⚠ 压力崩溃': 0xe04040,  // 压力崩溃 — 红色
  '✦ 隐藏事件': 0xffaa40,   // 隐藏事件 — 亮橙金

  // 兜底：默认金色
  '__default__': 0xf0c040
};

/**
 * 根据角色名查颜色（含模糊匹配）。
 * 找不到时返回默认金色。
 * @param {string} name 角色名
 * @returns {number} Phaser 颜色值（十六进制）
 */
export function getCharacterColor(name) {
  if (!name) return CHARACTER_COLORS.__default__;
  // 精确匹配
  if (CHARACTER_COLORS[name] !== undefined) return CHARACTER_COLORS[name];
  // 模糊匹配：角色名包含关键字时用对应颜色
  if (name.includes('罗远')) return 0xf0c040;
  if (name.includes('父亲') || name.includes('妈妈')) return 0xd8a8a8;
  if (name.includes('老师') || name.includes('校长')) return 0x8ac8a8;
  if (name.includes('法官') || name.includes('律师')) return 0x8888c8;
  if (name.includes('阶段') || name.includes('结算')) return 0xf0c040;
  if (name.includes('往事') || name.includes('历史') || name.includes('对照')) return 0x8080e0;
  if (name.includes('崩溃') || name.includes('翻车')) return 0xe04040;
  if (name.includes('隐藏') || name.includes('成就') || name.includes('✦')) return 0xffaa40;
  return CHARACTER_COLORS.__default__;
}

export const COLORS = {
  bg: 0x0a0a0a,
  panel: 0x1a1a2e,
  border: 0x1a1a2e,
  text: 0xe8d5a3,
  textDim: 0x9a8a6a,
  accent: 0xf0c040,
  danger: 0xe04040,
  success: 0x40c040,
  highlight: 0xf0c040,
  dark: 0x0d0d1a,
  classroom: { wall: 0x3a3a5e, floor: 0x2a2a3e, board: 0x2a5a2a, desk: 0x5a4a3a, highlight: 0x6a7a9a },
  lecture: { wall: 0x3a3a5e, floor: 0x4a3a2a, stage: 0x5a4a3a, screen: 0x2a2a3e, highlight: 0x7a8aaa },
  office: { wall: 0x3a3a5e, floor: 0x4a4a5e, desk: 0x5a4a3a, monitor: 0x2a2a3e, highlight: 0x6a7a9a },
  stage: { wall: 0x1a1a3a, floor: 0x3a3a5e, screen: 0x2a2a3e, spotlight: 0xf0c040, highlight: 0xf0c040 },
  livestream: { wall: 0x3a3a5e, floor: 0x2a2a3e, desk: 0x5a4a3a, ring: 0xf0c040, highlight: 0xf0c040 },
  lab: { wall: 0x3a3a5e, floor: 0x4a4a5e, table: 0x5a5a6e, glow: 0x60b0ff, highlight: 0x60b0ff },
  podcast: { wall: 0x3a2a4e, floor: 0x2a2a3e, desk: 0x5a4a3a, mic: 0xaaaaaa, highlight: 0xaaaaaa },
  street: { sky: 0x2a2a4e, ground: 0x4a4a4a, building: 0x3a3a5e, sign: 0xf0c040, highlight: 0xf0c040 },
  fridge_smash: { wall: 0x2a2a3a, floor: 0x3a3a3a, fridge: 0xe8e8e8, logo: 0x2a5a8a, ground: 0x4a4a4a, crowd: 0x3a3a5e, highlight: 0x2a5a8a },
  talkshow: { wall: 0x1a1a2a, floor: 0x2a2a3a, stage: 0x3a2a2a, spotlight: 0xf0c040, curtain: 0xaa2a2a, audience: 0x2a2a3e, highlight: 0xf0c040 },
  court: { wall: 0x3a3a4e, floor: 0x4a3a2a, bench: 0x5a4a3a, dock: 0x4a3a2a, flag: 0xc04040, bar: 0x5a4a3a, highlight: 0xc04040 },
  ending: { bg: 0x0a0a1a, glow: 0xf0c040, highlight: 0xf0c040 },
  character: {
    skin: 0xf0c8a0,
    hair: 0x1a1a1a,
    glasses: 0x1a1a1a,
    glassesLens: 0x2a2a4e,
    shirt: 0x1a1a1a,
    pants: 0x2a2a3e,
    shoes: 0x0a0a0a,
    youngShirt: 0x2a3a5a
  }
};

export const SCENE_TYPES = {
  CLASSROOM: 'classroom',
  LECTURE: 'lecture',
  OFFICE: 'office',
  STAGE: 'stage',
  LIVESTREAM: 'livestream',
  LAB: 'lab',
  PODCAST: 'podcast',
  STREET: 'street',
  FRIDGE_SMASH: 'fridge_smash',
  TALKSHOW: 'talkshow',
  COURT: 'court',
  ENDING: 'ending',
  // 场景变体（同一场景的不同氛围/时期，图片已在 SCENE_ASSETS 注册）
  OFFICE_EMPTY: 'office_empty',     // 人去楼空的夜晚办公室（裁员/倒闭期）
  OFFICE_DARK: 'office_dark',       // 雨夜债务深夜的办公桌（债务危机期）
  STREET_NIGHT: 'street_night',     // 深夜街道（落魄/迷茫期）
  OFFICE_BUSY: 'office_busy',       // 白天忙碌创业办公室（创业上升期）
  LIVESTREAM_FIRST: 'livestream_first', // 首播简陋直播间（首播青涩期）
  STREET_DAY: 'street_day',         // 90年代小城白天老街（延边摆摊期）
  STAGE_ARENA: 'stage_arena',       // 巨型体育馆（鸟巢TNT发布会）
  CLASSROOM_NIGHT: 'classroom_night', // 深夜教室（苦学/夜读期）
  OFFICE_DAY: 'office_day',          // 白天明亮办公室（新东方/日常办公期）
  CAFE: 'cafe',                     // 白天咖啡馆（融资谈判/会面期）
  FACTORY: 'factory',               // 手机代工厂产线（供应链生死期）
  FACTORY_DOOR: 'factory_door',     // 工厂门口铁锁封条（供应商暴雷期）
  RENTAL: 'rental'                  // 破旧出租屋（北漂苦学期）
};

/**
 * 场景资产配置（集中定义）。
 * GameScene.preload 遍历这个表来加载图片；
 * PixelRenderer.drawBackground 用同样的表做 sprite key 映射。
 * 加一个新场景？只要在这里加一行。
 */
export const SCENE_ASSETS = [
  { key: 'bg-classroom',  url: 'assets/characters/scene-classroom-v2.webp',  type: 'classroom' },
  { key: 'bg-office',     url: 'assets/characters/scene-office-v2.webp',     type: 'office' },
  { key: 'bg-stage',      url: 'assets/characters/scene-stage-v2.webp',      type: 'stage' },
  { key: 'bg-lab',        url: 'assets/characters/scene-lab-v2.webp',        type: 'lab' },
  { key: 'bg-podcast',    url: 'assets/characters/scene-podcast-v2.webp',    type: 'podcast' },
  { key: 'bg-lecture',    url: 'assets/characters/scene-lecture-v2.webp',    type: 'lecture' },
  { key: 'bg-livestream', url: 'assets/characters/scene-livestream-v2.webp', type: 'livestream' },
  { key: 'bg-street',     url: 'assets/characters/scene-street-v2.webp',     type: 'street' },
  { key: 'bg-fridge_smash', url: 'assets/characters/scene-fridge_smash-v2.webp', type: 'fridge_smash' },
  { key: 'bg-talkshow',   url: 'assets/characters/scene-talkshow-v2.webp',   type: 'talkshow' },
  { key: 'bg-court',      url: 'assets/characters/scene-court-v2.webp',      type: 'court' },
  { key: 'bg-ending',     url: 'assets/characters/scene-ending-v2.webp',     type: 'ending' },
  // 场景变体（氛围增强）
  { key: 'bg-office_empty',  url: 'assets/characters/scene-office_empty-v2.webp',  type: 'office_empty' },
  { key: 'bg-street_night',  url: 'assets/characters/scene-street_night-v2.webp',  type: 'street_night' },
  { key: 'bg-office_dark',   url: 'assets/characters/scene-office_dark-v2.webp',   type: 'office_dark' },
  { key: 'bg-office_busy',   url: 'assets/characters/scene-office_busy-v2.webp',   type: 'office_busy' },
  { key: 'bg-livestream_first', url: 'assets/characters/scene-livestream_first-v2.webp', type: 'livestream_first' },
  { key: 'bg-street_day',    url: 'assets/characters/scene-street_day-v2.webp',    type: 'street_day' },
  { key: 'bg-stage_arena',   url: 'assets/characters/scene-stage_arena-v2.webp',   type: 'stage_arena' },
  { key: 'bg-classroom_night', url: 'assets/characters/scene-classroom_night-v2.webp', type: 'classroom_night' },
  { key: 'bg-office_day',    url: 'assets/characters/scene-office_day-v2.webp',    type: 'office_day' },
  // R050 质量门禁：四张专属图尚未达到发布标准时，优先复用语义最近的合格背景，
  // 绝不把生成失败白图或扁平矢量稿暴露给玩家。后续专属重绘只需替换 url。
  { key: 'bg-cafe',          url: 'assets/characters/scene-cafe-v2.webp',          type: 'cafe' },
  { key: 'bg-factory',       url: 'assets/characters/scene-factory-v2.webp',       type: 'factory' },
  { key: 'bg-factory_door',  url: 'assets/characters/scene-factory_door-v2.webp',  type: 'factory_door' },
  { key: 'bg-rental',        url: 'assets/characters/scene-rental-v2.webp',        type: 'rental' },
  // 结局专属插图
  { key: 'bg-ending-legend',   url: 'assets/characters/ending-legend-v3.webp',   type: 'ending-legend' },
  { key: 'bg-ending-phoenix',  url: 'assets/characters/ending-phoenix-v3.webp',  type: 'ending-phoenix' },
  { key: 'bg-ending-returns',  url: 'assets/characters/ending-returns-v3.webp',  type: 'ending-returns' },
  { key: 'bg-ending-peace',    url: 'assets/characters/ending-peace-v3.webp',    type: 'ending-peace' },
  { key: 'bg-ending-monk',     url: 'assets/characters/ending-monk-v2.webp',     type: 'ending-monk' }
];

export const CHARACTER_ASSETS = [
  { key: 'char-reference', url: 'assets/characters/luo-character-reference.webp', pose: 'reference' },
  { key: 'char-standing',   url: 'assets/characters/luo-standing-v4-nobg.webp',   pose: 'standing' },
  { key: 'char-speaking',   url: 'assets/characters/luo-speaking-v4-nobg.webp',   pose: 'speaking' },
  { key: 'char-angry',      url: 'assets/characters/luo-angry-v4-nobg.webp',      pose: 'angry' },
  { key: 'char-depressed',  url: 'assets/characters/luo-depressed-v4-nobg.webp',  pose: 'depressed' },
  { key: 'char-happy',      url: 'assets/characters/luo-happy-v4-nobg.webp',      pose: 'happy' },
  { key: 'char-livestream', url: 'assets/characters/luo-livestream-v4-nobg.webp', pose: 'livestream' },
  { key: 'char-young',      url: 'assets/characters/luo-young-v4-nobg.webp',      pose: 'young' },
  { key: 'char-sitting',    url: 'assets/characters/luo-sitting-v4-nobg.webp',    pose: 'sitting' },
  { key: 'char-middle',     url: 'assets/characters/luo-middle-v4-nobg.webp',     pose: 'middle' }
];

const ENDING_PRESENTATION_PROFILES = Object.freeze({
  triumph: Object.freeze({
    sceneType: 'ending-legend',
    bgmType: 'ending_legendary',
    particleStyle: 'legendary'
  }),
  rebirth: Object.freeze({
    sceneType: 'ending-phoenix',
    bgmType: 'ending_legendary',
    particleStyle: 'legendary'
  }),
  spotlight: Object.freeze({
    sceneType: 'ending-returns',
    bgmType: 'ending_legendary',
    particleStyle: 'legendary'
  }),
  peaceful: Object.freeze({
    sceneType: 'ending-peace',
    bgmType: 'ending_peaceful',
    particleStyle: 'peaceful'
  }),
  withdrawn: Object.freeze({
    sceneType: 'ending-monk',
    bgmType: 'ending_peaceful',
    particleStyle: 'peaceful'
  }),
  unresolved: Object.freeze({
    sceneType: 'ending',
    bgmType: 'ending_tragic',
    particleStyle: 'tragic'
  })
});

/**
 * 35 个可触发结局的统一呈现分类。
 * 背景、BGM 与粒子情绪必须来自同一配置，避免三套硬编码列表彼此漂移。
 */
const ENDING_PROFILE_BY_ID = Object.freeze({
  legend: 'triumph',
  tycoon: 'triumph',
  warrior: 'rebirth',
  scapegoat: 'unresolved',
  balance: 'peaceful',
  rational: 'unresolved',
  supply_chain: 'unresolved',
  talkshow_star: 'spotlight',
  ai_visionary: 'spotlight',
  phoenix: 'rebirth',
  hermit: 'withdrawn',
  peace: 'peaceful',
  survivor: 'rebirth',
  craftsman: 'triumph',
  scholar: 'peaceful',
  ordinary: 'peaceful',
  comfort: 'peaceful',
  xiaomi: 'spotlight',
  retreat: 'peaceful',
  bankrupt_early: 'unresolved',
  escape: 'unresolved',
  moderate_success: 'peaceful',
  anchor: 'spotlight',
  comeback: 'spotlight',
  educator: 'triumph',
  writer: 'spotlight',
  influencer: 'spotlight',
  mentor: 'triumph',
  idealist: 'triumph',
  venture_capitalist: 'triumph',
  tech_blogger: 'spotlight',
  rights_fighter: 'rebirth',
  monk: 'withdrawn',
  returns: 'spotlight',
  philanthropist: 'triumph'
});

export const ENDING_PRESENTATION_MAP = Object.freeze(Object.fromEntries(
  Object.entries(ENDING_PROFILE_BY_ID).map(([endingId, profileId]) => [
    endingId,
    ENDING_PRESENTATION_PROFILES[profileId]
  ])
));

export const ENDING_SCENE_MAP = Object.freeze(Object.fromEntries(
  Object.entries(ENDING_PRESENTATION_MAP).map(([endingId, presentation]) => [
    endingId,
    presentation.sceneType
  ])
));

const DEFAULT_ENDING_PRESENTATION = Object.freeze({
  sceneType: 'ending',
  bgmType: 'ending_peaceful',
  particleStyle: 'neutral'
});

export function getEndingPresentation(endingId) {
  return ENDING_PRESENTATION_MAP[endingId] || DEFAULT_ENDING_PRESENTATION;
}
