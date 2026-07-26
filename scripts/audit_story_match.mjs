/**
 * 文案 ↔ 场景/人物匹配度审计
 *
 * 检查项：
 *  A. 文案地点词 vs sceneType（文案说"咖啡馆"，背景是不是咖啡馆）
 *  B. actSub 年份 vs stage.period 范围 + character 字段 vs stage 推导名
 *  C. 流程完善性：next 断链 / 自环 / sceneType 未注册资源
 *  D. 立绘时期：actSub 年份 ≥2016（老罗 44 岁+）但节点落在非中年立绘阶段
 *
 * 用法：node scripts/audit_story_match.mjs [--json]
 */
import { STORY } from '../src/data/story/index.js';
import { STAGES, getStageByNodeId } from '../src/data/stages.js';
import { SCENE_ASSETS } from '../src/config.js';
import { STAGE_POSE_GROUPS, MIDDLE_AGE_YEAR, extractNodeYear, resolvePoseStageKey } from '../src/systems/CharacterPoseResolver.js';

// ── 地点词 → 允许的 sceneType 集合（空数组 = 游戏里根本没有这个场景）──
const PLACE_RULES = [
  { kw: ['咖啡馆', '咖啡店', '咖啡厅', '星巴克', '瑞幸'], scenes: ['cafe'], label: '咖啡馆' },
  { kw: ['教室', '课堂'], scenes: ['classroom', 'classroom_night', 'lecture'], label: '教室' },
  { kw: ['讲台', '讲座', '大课'], scenes: ['lecture', 'classroom', 'stage'], label: '讲台' },
  { kw: ['实验室', '研发中心'], scenes: ['lab'], label: '实验室' },
  { kw: ['直播间', '上链接', '环形灯'], scenes: ['livestream', 'livestream_first'], label: '直播间' },
  { kw: ['鸟巢', '体育馆'], scenes: ['stage_arena'], label: '鸟巢/体育馆' },
  { kw: ['脱口秀', '开放麦'], scenes: ['talkshow', 'stage'], label: '脱口秀舞台' },
  { kw: ['法院', '法庭'], scenes: ['court'], label: '法院' },
  { kw: ['医院', '病房', '诊所'], scenes: [], label: '医院' },
  { kw: ['出租屋', '卧室', '宿舍'], scenes: ['rental'], label: '住所' },
  { kw: ['高铁站', '机场', '飞机上', '收费站'], scenes: [], label: '交通工具/枢纽' },
  { kw: ['工厂', '车间', '产线'], scenes: ['factory', 'factory_door'], label: '工厂' },
  { kw: ['仓库'], scenes: [], label: '仓库' },
  { kw: ['酒店'], scenes: [], label: '酒店' },
  { kw: ['餐厅', '饭店', '火锅店', '烧烤'], scenes: [], label: '餐厅' },
];

// ── 已审定的场景代理白名单：游戏无该场景，用最接近的现有场景代理，附理由 ──
const SCENE_PROXY_ALLOWLIST = new Map([
  ['act7_sharklet_pitch', '医院采购部办公室 → office_busy 代理（室内办公场景，比 lab 研发场景更贴合）'],
]);

// ── 已审定的首句冲突白名单：首句虽提到其他地点，但属人生蒙太奇/修辞，当前场景正确 ──
const SCENE_CONFLICT_ALLOWLIST = new Map([
  ['act9_final', '首句为「从延边街头…到直播间」的人生回顾蒙太奇，ending 场景正确'],
]);

const VALID_SCENE_TYPES = new Set(SCENE_ASSETS.map(a => a.type));
const EARLY_STAGES = new Set(['youth', 'teacher', 'startup']); // 与 GameScene._resolveCharacterName 一致

const issues = { A_sceneConflict: [], A_sceneMissing: [], B_timeStage: [], B_charName: [], B_spriteAge: [], C_brokenNext: [], C_selfLoop: [], C_sceneUnregistered: [], C_fieldMissing: [], I_bodyMention: [] };

const allNodeIds = new Set(Object.keys(STORY));

for (const [id, node] of Object.entries(STORY)) {
  if (!node || typeof node !== 'object') continue;
  const stage = getStageByNodeId(id);
  const text = node.text || '';
  // 首句 = 到第一个句末标点为止（场景设定句），而非固定 80 字符
  const firstSentEnd = text.search(/[。！？!?\n]/);
  const firstSentence = firstSentEnd === -1 ? text : text.slice(0, firstSentEnd + 1);

  // ── A. 地点词 vs sceneType ──
  if (node.sceneType) {
    for (const rule of PLACE_RULES) {
      const hit = rule.kw.find(k => text.includes(k));
      if (!hit) continue;
      const inFirst = rule.kw.some(k => firstSentence.includes(k));
      if (rule.scenes.length === 0) {
        // 游戏无此场景：文案若把该地点当作"当前所在"（首句命中），提示场景缺失
        if (inFirst && !SCENE_PROXY_ALLOWLIST.has(id)) {
          issues.A_sceneMissing.push({ id, hit: rule.label, sceneType: node.sceneType, snippet: firstSentence.slice(0, 50) });
        }
      } else if (!rule.scenes.includes(node.sceneType)) {
        const item = { id, hit: `${rule.label}(${hit})`, sceneType: node.sceneType, where: inFirst ? '首句' : '正文', snippet: (inFirst ? firstSentence : text.slice(Math.max(0, text.indexOf(hit) - 20), text.indexOf(hit) + 30)).replace(/\n/g, ' ') };
        if (inFirst && !SCENE_CONFLICT_ALLOWLIST.has(id)) {
          // 首句即场景设定句：地点词与背景不符是真冲突
          issues.A_sceneConflict.push(item);
        } else {
          // 正文提及多为回忆杀/对比修辞（"想起鸟巢""没有五千人"），仅作提示
          issues.I_bodyMention.push(item);
        }
      }
    }
  }

  // ── B. 年份 vs stage.period（取 actSub 最后一个 4 位年份，避开价格数字误命中）──
  const year = extractNodeYear(node.actSub);
  if (year != null && stage) {
    const [pStart, pEnd] = stage.period.split('-').map(Number);
    if (year < pStart || year > pEnd) {
      issues.B_timeStage.push({ id, actSub: node.actSub, year, stage: stage.id, period: stage.period });
    }
    // D. 立绘时期：≥2016（44 岁+）但按运行时同款规则解析后的立绘池仍无 middle
    const poseStageKey = resolvePoseStageKey(stage.id, year);
    const posePool = STAGE_POSE_GROUPS[poseStageKey];
    if (year >= MIDDLE_AGE_YEAR && posePool && !posePool.includes('middle')) {
      issues.B_spriteAge.push({ id, actSub: node.actSub, year, stage: stage.id, note: `解析立绘池=${poseStageKey} 无 middle，44 岁+仍用青年立绘` });
    }
  }

  // ── B2. character 字段 vs stage+年份 推导名（与 GameScene._resolveCharacterName 同款规则）──
  if (stage && node.character) {
    let expect;
    if (!EARLY_STAGES.has(stage.id)) expect = '老罗';
    else if (stage.id === 'startup' && year != null && year >= MIDDLE_AGE_YEAR) expect = '老罗';
    else expect = '小罗';
    if (node.character !== expect) {
      issues.B_charName.push({ id, character: node.character, expect, stage: stage.id, actSub: node.actSub });
    }
  }

  // ── C. 流程完善性 ──
  const nexts = [];
  for (const c of node.choices || []) {
    if (c.next) nexts.push(c.next);
    if (c.check) { if (c.check.successNext) nexts.push(c.check.successNext); if (c.check.failNext) nexts.push(c.check.failNext); }
  }
  if (node.next) nexts.push(node.next);
  for (const n of nexts) {
    if (!allNodeIds.has(n)) issues.C_brokenNext.push({ id, next: n });
    else if (n === id) issues.C_selfLoop.push({ id });
  }
  if (!node.sceneType) issues.C_fieldMissing.push({ id, field: 'sceneType' });
  else if (!VALID_SCENE_TYPES.has(node.sceneType)) issues.C_sceneUnregistered.push({ id, sceneType: node.sceneType });
  // character 仅对话渲染节点需要；结局节点走专属结算屏，不适用
  if (!node.isEnding && !node.character) issues.C_fieldMissing.push({ id, field: 'character' });
}

// ── 输出报告 ──
const P = (title, arr, fmt) => {
  console.log(`\n${'─'.repeat(60)}\n${title}（${arr.length} 项）`);
  arr.forEach(x => console.log('  ' + fmt(x)));
};

console.log(`共审计节点 ${allNodeIds.size} 个`);
P('A级·文案地点与背景冲突（首句设定地点与场景不符）', issues.A_sceneConflict,
  x => `[${x.id}] 文案提到「${x.hit}」(${x.where})，但 sceneType=${x.sceneType} | ${x.snippet}`);
if (SCENE_CONFLICT_ALLOWLIST.size) {
  console.log(`  （已审定首句例外 ${SCENE_CONFLICT_ALLOWLIST.size} 项：`);
  SCENE_CONFLICT_ALLOWLIST.forEach((reason, id) => console.log(`    [${id}] ${reason}`));
  console.log('  )');
}
P('A级·文案地点游戏内无对应场景（首句即设定在此地）', issues.A_sceneMissing,
  x => `[${x.id}] 首句设定在「${x.hit}」，但 sceneType=${x.sceneType} | ${x.snippet}`);
if (SCENE_PROXY_ALLOWLIST.size) {
  console.log(`  （已审定代理 ${SCENE_PROXY_ALLOWLIST.size} 项，不计入缺失：`);
  SCENE_PROXY_ALLOWLIST.forEach((reason, id) => console.log(`    [${id}] ${reason}`));
  console.log('  )');
}
P('B级·actSub 年份超出 stage 时期范围', issues.B_timeStage,
  x => `[${x.id}] ${x.actSub} → 年份 ${x.year}，但 stage=${x.stage}(${x.period})`);
P('B级·立绘时期可疑（≥2016 年 44 岁+，仍用青年立绘池）', issues.B_spriteAge,
  x => `[${x.id}] ${x.actSub} → stage=${x.stage}，${x.note}`);
P('B级·character 字段与 stage 推导名不一致', issues.B_charName,
  x => `[${x.id}] character='${x.character}'，stage=${x.stage} 应为 '${x.expect}' | ${x.actSub}`);
P('C级·next 断链（目标节点不存在）', issues.C_brokenNext,
  x => `[${x.id}] → '${x.next}'`);
P('C级·自环（next 指向自身，死循环风险）', issues.C_selfLoop,
  x => `[${x.id}]`);
P('C级·sceneType 未在 SCENE_ASSETS 注册', issues.C_sceneUnregistered,
  x => `[${x.id}] sceneType=${x.sceneType}`);
P('C级·必填字段缺失', issues.C_fieldMissing,
  x => `[${x.id}] 缺 ${x.field}`);
P('提示·正文地点提及（多为回忆杀/对比修辞，非当前场景，无需处理）', issues.I_bodyMention,
  x => `[${x.id}] 正文提到「${x.hit}」，sceneType=${x.sceneType}`);

// 提示级不计入待处理合计
const total = Object.entries(issues)
  .filter(([k]) => !k.startsWith('I_'))
  .reduce((s, [, a]) => s + a.length, 0);
console.log(`\n${'═'.repeat(60)}\n合计 ${total} 项待处理（另 ${issues.I_bodyMention.length} 项提示级正文提及）`);
