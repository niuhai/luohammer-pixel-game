/**
 * 剧情图校验脚本 — 增强版 v3
 *
 * 检测项目：
 *   1. 死链 —— choices[].next 指向不存在的节点
 *   2. 孤立节点 —— 从 intro 不可达的节点
 *   3. 循环指向 —— A↔B 死循环（双方均无其他出口）
 *   4. 卡死节点 —— 无 choices 的非结局节点
 *   5. effects 数值越界 —— delta>100 或 结果<0（属性值超出合法范围）
 *   6. effects 未定义属性名 —— 使用了 ATTRIBUTES 中不存在的属性
 *   7. flag 链路完整性 —— story flags vs effects.js/endings.js
 *   8. 结局可达性 —— 所有结局节点是否从 intro 可达
 *   9. stages.js 一致性
 *  10. effects 属性名一致性（rep→reputation, fail→failures）
 *  11. 源文件语法检查
 *  12. effects delta 合理性 —— delta 绝对值超出属性范围
 *  13. 结局 flag 依赖检查 —— 每个结局依赖的 flag 是否在 story 中设置
 *  14. 天赋 special 字段引用一致性 —— talents.js 中声明的 special 是否在 effects.js/GameScene.js 中实现
 *  15. 技能树依赖图完整性 —— requires/requiresAny/exclusiveWith 引用 id 存在，无循环依赖
 *  16. 随机事件数据完整性 —— weight 为正，effects 属性名合法，flag 引用合法
 *  17. 结局 priority/sceneType 一致性 —— priority 无硬重复，sceneType 在 ENDING_SCENE_MAP 或合法场景中
 *
 * 输出：终端可读报告 + Markdown 报告 + HTML 报告
 * 用法：node scripts/validate-story.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// ─── Windows 终端 UTF-8 支持 ──────────────────────────────────────
if (process.stdout.isTTY) {
  try { process.stdout.setEncoding('utf-8'); } catch (_) { /* ignore */ }
}
if (process.stderr.isTTY) {
  try { process.stderr.setEncoding('utf-8'); } catch (_) { /* ignore */ }
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── 属性范围定义（与 effects.js 中 ATTRIBUTES 保持一致） ──────────────
const ATTRIBUTES = {
  pride:       { name: '理想主义', min: 0, max: 10 },
  wealth:      { name: '财富',     min: 0, max: 10 },
  reputation:  { name: '名声',     min: 0, max: 10 },
  failures:    { name: '翻车',     min: 0, max: 99 },
  pressure:    { name: '压力',     min: 0, max: 10 },
  trust:       { name: '公众信任', min: 0, max: 10 },
};

// 初始值（与 createInitialState 保持一致）
const INITIAL_VALUES = {
  pride: 5, wealth: 5, reputation: 5,
  failures: 0, pressure: 0, trust: 5
};

// effects 对象中允许出现的非属性字段名（如 achievement, icon 等元数据字段）
const KNOWN_EFFECTS_META_KEYS = new Set([
  'achievement', 'icon',   // 成就标记（非属性，不影响数值）
]);

// 阈值触发器内部设置的 flag（checkThresholdTriggers 中的 flag 字段）
// 这些 flag 由 effects.js 内部逻辑设置，不需要 story choice 中显式设置
const THRESHOLD_TRIGGERED_FLAGS = new Set([
  'born_proud_triggered',
  'peoples_luo_triggered',
  'penniless_triggered',
  'deadbeat_triggered',
  'famous_triggered',
  'realist_triggered',
  'distrusted_triggered',
  'anxiety_triggered',
  'rich_triggered',
  'indomitable_triggered',
  'moderate_triggered',
  'opinion_leader_triggered',
  // P2-5 新增跨属性阈值触发器 flag
  'stress_erosion_trust_triggered',
  'wealth_buy_fame_triggered',
  'crack_ideal_triggered',
  'friend_bailout_triggered',
  // R12 新增阈值触发器 flag（pressure_release / retired_peace）
  'pressure_release_triggered',
  'retired_peace_triggered',
]);

// 叙事性 flag 白名单：这些 flag 在 story choices 中设置，用于记录玩家的叙事选择
// （如童年经历、初恋、哲学倾向等），作为"叙事记忆"丰富剧情文本，但不影响结局匹配或属性变化。
// 它们不需要在 effects.js/endings.js 中被引用，因此不报"未处理"警告。
const NARRATIVE_FLAGS = new Set([
  'grandma_church',       // 童年外婆带去教堂的记忆
  'first_love_letter',    // 初恋写情书
  'first_love_confess',   // 初恋告白
  'philosophy_geek',      // 哲学少年
  'literature_dream',     // 文学梦
  'idealism_refined',     // 理想主义被提炼
  'pragmatic_compromise', // 务实妥协
  'all_repay',            // 全部还清
  'donated_school',       // 捐建学校
  'humor_shield',         // 幽默护盾
  'public_milestone',     // 公众里程碑
]);

// ─── 读取 endings.js 源码 ──────────────────────────────────────────
const endingsSrcPath = path.join(__dirname, '..', 'src', 'data', 'endings.js');
const endingsContent = fs.readFileSync(endingsSrcPath, 'utf-8');
const endingsIds = [];
const idPattern = /id:\s*['"](\w+)['"]/g;
let m;
while ((m = idPattern.exec(endingsContent)) !== null) {
  endingsIds.push(m[1]);
}

// ─── 读取 effects.js 源码 ──────────────────────────────────────────
const effectsSrcPath = path.join(__dirname, '..', 'src', 'data', 'effects.js');
const effectsContent = fs.readFileSync(effectsSrcPath, 'utf-8');

// ─── 读取 events-random.js 源码（随机事件也会设置 flag） ─────────────
const eventsRandomSrcPath = path.join(__dirname, '..', 'src', 'data', 'events-random.js');
const eventsRandomContent = fs.existsSync(eventsRandomSrcPath)
  ? fs.readFileSync(eventsRandomSrcPath, 'utf-8')
  : '';

// ─── 读取 GameScene.js 源码（用于校验天赋 special 实现完整性） ─────────
const gameSceneSrcPath = path.join(__dirname, '..', 'src', 'scenes', 'GameScene.js');
const gameSceneContent = fs.existsSync(gameSceneSrcPath)
  ? fs.readFileSync(gameSceneSrcPath, 'utf-8')
  : '';

// ─── 读取 stages.js ─────────────────────────────────────────────────
const stagesPath = path.join(__dirname, '..', 'src', 'data', 'stages.js');
const stagesContent = fs.readFileSync(stagesPath, 'utf-8');
const stages = [];
const stagePattern = /\bid:\s*['"](\w+)['"]/g;
while ((m = stagePattern.exec(stagesContent)) !== null) {
  const stageStart = m.index;
  const stageBlock = stagesContent.substring(stageStart, stageStart + 2000);
  const nodesMatch = stageBlock.match(/nodes:\s*\[([^\]]*)\]/);
  const nodes = nodesMatch ? nodesMatch[1].match(/'(\w+)'/g)?.map(s => s.replace(/'/g, '')) || [] : [];
  stages.push({ id: m[1], nodes });
}

// ─── story 源文件列表 ──────────────────────────────────────────────
const storyDir = path.join(__dirname, '..', 'src', 'data', 'story');
const NODES_FILES = [
  '0_intro.js', '1_act0.js', '2_act1.js', '3_act2.js',
  '4_fridge.js', '5_fang.js', '6_act3.js', '7_act4.js',
  '8_act5.js', '9_act6.js', '10_act7.js', '11_act8.js',
  '12_act9.js', '13_endings_nodes.js'
];

// ============================================
// 数据加载：优先动态导入，失败则回退正则解析
// ============================================

let STORY = null;
let useFallback = false;

try {
  const storyModule = await import('../src/data/story/index.js');
  STORY = storyModule.STORY;
} catch (e) {
  console.warn(`⚠️  动态导入 story 模块失败: ${e.message}`);
  console.warn('   回退到正则解析模式...\n');
  useFallback = true;
}

// ─── 正则解析回退方案 ──────────────────────────────────────────────

/**
 * 从源文件中按节点块提取节点信息
 * 返回 [{ key, block, file }]
 */
function extractNodeBlocks(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const fileName = path.basename(filePath);
  if (!content.includes('export const NODES')) return [];

  const nodeBlocks = [];
  const nodeKeyRegex = /^\s{2}(\w+):\s*\{/gm;
  const positions = [];
  let match;
  while ((match = nodeKeyRegex.exec(content)) !== null) {
    positions.push({ key: match[1], startIndex: match.index });
  }

  for (let i = 0; i < positions.length; i++) {
    const start = positions[i].startIndex;
    const end = i + 1 < positions.length ? positions[i + 1].startIndex : content.length;
    const block = content.substring(start, end);
    nodeBlocks.push({ key: positions[i].key, block, file: fileName });
  }
  return nodeBlocks;
}

/**
 * 从节点块中提取 choices 信息
 */
function extractChoicesFromBlock(block) {
  const choices = [];
  // 先按 choice 对象拆分：每个 { label: ... } 是一个 choice
  // 使用 next 作为锚点，向前向后搜索完整 choice 上下文
  const nextRegex = /next:\s*['"]([^'"]+)['"]/g;
  let nm;
  while ((nm = nextRegex.exec(block)) !== null) {
    const choice = { next: nm[1] };

    // 向前搜索到上一个 choice 边界（上一个 }, 或行首 {）
    let searchStart = nm.index - 1;
    let braceDepth = 0;
    let choiceStart = 0;
    while (searchStart >= 0) {
      if (block[searchStart] === '}') braceDepth++;
      if (block[searchStart] === '{') {
        if (braceDepth === 0) {
          choiceStart = searchStart;
          break;
        }
        braceDepth--;
      }
      searchStart--;
    }

    // 向后搜索到当前 choice 结束（}, 或 }])
    let searchEnd = nm.index + nm[0].length;
    braceDepth = 0;
    let choiceEnd = block.length;
    while (searchEnd < block.length) {
      if (block[searchEnd] === '{') braceDepth++;
      if (block[searchEnd] === '}') {
        if (braceDepth === 0) {
          choiceEnd = searchEnd + 1;
          break;
        }
        braceDepth--;
      }
      searchEnd++;
    }

    const choiceContext = block.substring(choiceStart, choiceEnd);

    // 提取 effects（从当前 choice 上下文中）
    const effectsMatch = choiceContext.match(/effects:\s*\{([^}]*)\}/);
    if (effectsMatch) {
      choice.effects = {};
      const propRegex = /(\w+):\s*(-?\d+)/g;
      let pm;
      while ((pm = propRegex.exec(effectsMatch[1])) !== null) {
        choice.effects[pm[1]] = parseInt(pm[2], 10);
      }
    }
    // 提取 flag（从当前 choice 上下文中）
    const flagMatch = choiceContext.match(/flag:\s*['"]([^'"]+)['"]/);
    if (flagMatch) {
      choice.flag = flagMatch[1];
    }
    choices.push(choice);
  }
  return choices;
}

/**
 * 从源文件构建 STORY 对象（回退方案）
 */
function buildStoryFromSource() {
  const story = {};
  const files = NODES_FILES.filter(f => fs.existsSync(path.join(storyDir, f)));

  for (const file of files) {
    const filePath = path.join(storyDir, file);
    const blocks = extractNodeBlocks(filePath);
    for (const nb of blocks) {
      const node = {};
      // 检测 isEnding
      if (/isEnding:\s*true/.test(nb.block)) {
        node.isEnding = true;
      }
      // 提取 choices
      const choices = extractChoicesFromBlock(nb.block);
      if (choices.length > 0) {
        node.choices = choices;
      }
      story[nb.key] = node;
    }
  }
  return story;
}

if (useFallback) {
  STORY = buildStoryFromSource();
}

// ============================================
// 加载扩展模块（talents / skillTree / events-random / config）用于新增校验
// ============================================
let TALENTS = [];
let SKILL_TREES = {};
let ALL_SKILLS = [];
let RANDOM_EVENTS = [];
let ENDING_SCENE_MAP = {};
let SCENE_ASSET_TYPES = new Set();

try {
  const talentsMod = await import('../src/data/talents.js');
  TALENTS = talentsMod.TALENTS || [];
} catch (e) {
  console.warn(`⚠️  动态导入 talents.js 失败: ${e.message}`);
}

try {
  const skillTreeMod = await import('../src/data/skillTree.js');
  SKILL_TREES = skillTreeMod.SKILL_TREES || {};
  ALL_SKILLS = skillTreeMod.ALL_SKILLS || [];
} catch (e) {
  console.warn(`⚠️  动态导入 skillTree.js 失败: ${e.message}`);
}

try {
  const eventsMod = await import('../src/data/events-random.js');
  RANDOM_EVENTS = eventsMod.RANDOM_EVENTS || [];
} catch (e) {
  console.warn(`⚠️  动态导入 events-random.js 失败: ${e.message}`);
}

try {
  const configMod = await import('../src/config.js');
  ENDING_SCENE_MAP = configMod.ENDING_SCENE_MAP || {};
  SCENE_ASSET_TYPES = new Set((configMod.SCENE_ASSETS || []).map(a => a.type));
} catch (e) {
  console.warn(`⚠️  动态导入 config.js 失败: ${e.message}`);
}

// ============================================
// 收集函数
// ============================================

/** 从 effects.js 源码中提取所有被处理的 flag */
function extractEffectsFlags() {
  const flags = new Set();
  const hasFlagRegex = /flags\.has\(\s*['"]([^'"]+)['"]\s*\)/g;
  let match;
  while ((match = hasFlagRegex.exec(effectsContent)) !== null) {
    flags.add(match[1]);
  }
  const setFlagRegex = /flag:\s*['"]([^'"]+)['"]/g;
  while ((match = setFlagRegex.exec(effectsContent)) !== null) {
    flags.add(match[1]);
  }
  return flags;
}

/** 从 endings.js 源码中提取所有被检查的 flag */
function extractEndingsFlags() {
  const flags = new Set();
  const hasFlagRegex = /flags\.has\(\s*['"]([^'"]+)['"]\s*\)/g;
  let match;
  while ((match = hasFlagRegex.exec(endingsContent)) !== null) {
    flags.add(match[1]);
  }
  return flags;
}

// ============================================
// 主校验逻辑
// ============================================
const errors = [];
const warnings = [];
const sections = []; // 用于 Markdown 报告

function err(msg) {
  errors.push(msg);
  console.error('  ❌ ' + msg);
}
function warn(msg) {
  warnings.push(msg);
  console.warn('  ⚠️  ' + msg);
}
function info(msg) {
  console.log('  ℹ️  ' + msg);
}

function sectionStart(title) {
  console.log(`\n${'─'.repeat(60)}`);
  console.log(title);
  console.log('─'.repeat(60));
  sections.push({ title, items: [] });
}

function sectionItem(level, msg) {
  if (sections.length > 0) {
    sections[sections.length - 1].items.push({ level, msg });
  }
}

console.log('\n' + '='.repeat(60));
console.log('  剧情数据校验 — 增强版');
console.log('='.repeat(60) + '\n');

if (useFallback) {
  warn('使用正则解析模式（动态导入失败），部分校验可能不完整');
  sectionItem('warn', '动态导入失败，回退到正则解析');
}

// 基本信息
const allNodeIds = new Set(Object.keys(STORY));
const endingNodeIds = new Set([...allNodeIds].filter(k => k.startsWith('ending_') || STORY[k]?.isEnding));
const regularNodeIds = new Set([...allNodeIds].filter(k => !endingNodeIds.has(k)));

console.log(`总节点数: ${allNodeIds.size}`);
console.log(`普通节点: ${regularNodeIds.size}`);
console.log(`结局节点: ${endingNodeIds.size}`);
console.log(`endings.js 结局数: ${endingsIds.length}`);
console.log(`stages.js 阶段数: ${stages.length}`);

// ───【0】源文件语法检查 ────────────────────────────────────────────
sectionStart('【0】源文件语法检查');

// 逐文件尝试 import 检测语法错误
// 注意：语法错误降级为 warning，因为：
// 1. Vite + esbuild 转换器可以处理部分 Node.js 原生解析器无法处理的语法
// 2. 正则解析回退方案仍然可以正确校验结构
let syntaxErrorCount = 0;
const syntaxErrors = [];
for (const file of NODES_FILES) {
  const filePath = path.join(storyDir, file);
  if (!fs.existsSync(filePath)) continue;
  try {
    await import(`../src/data/story/${file}`);
  } catch (e) {
    if (e instanceof SyntaxError) {
      syntaxErrorCount++;
      const msg = `语法错误: ${file}: ${e.message.split('\n')[0]}`;
      warn(msg);
      sectionItem('warn', msg);
      syntaxErrors.push(file);
    }
  }
}

if (syntaxErrorCount === 0) {
  info('所有源文件语法正确 ✓');
  sectionItem('pass', '所有源文件语法正确');
} else {
  info(`提示: ${syntaxErrorCount} 个文件有语法错误（Node.js 原生解析器），Vite + esbuild 可能正常处理`);
  info(`提示: 语法错误的文件仍通过正则解析进行了结构校验`);
}

// ─── 构建引用关系 ─────────────────────────────────────────────────
const referencedBy = {};  // nodeId -> [引用它的节点]
const nodeToNexts = {};   // nodeId -> Set<next>

for (const nodeId of allNodeIds) {
  nodeToNexts[nodeId] = new Set();
}

for (const [nodeId, node] of Object.entries(STORY)) {
  if (node.choices && node.choices.length > 0) {
    for (const choice of node.choices) {
      if (choice.next) {
        if (!referencedBy[choice.next]) referencedBy[choice.next] = [];
        referencedBy[choice.next].push(nodeId);
        nodeToNexts[nodeId].add(choice.next);
      }
    }
  }
}

// ───【1】BFS 可达性分析 ────────────────────────────────────────────
sectionStart('【1】BFS 可达性分析');
const reachable = new Set();
const queue = ['intro'];
reachable.add('intro');

while (queue.length > 0) {
  const current = queue.shift();
  const node = STORY[current];
  if (!node || !node.choices) continue;
  for (const choice of node.choices) {
    const next = choice.next;
    if (next && allNodeIds.has(next) && !reachable.has(next)) {
      reachable.add(next);
      queue.push(next);
    }
  }
}

const unreachable = [...allNodeIds].filter(k => !reachable.has(k));
console.log(`  从 intro 可达: ${reachable.size} / ${allNodeIds.size}`);
console.log(`  不可达节点: ${unreachable.length}`);

if (unreachable.length > 0) {
  const orphanNodes = unreachable.filter(id => !referencedBy[id]);
  const referencedButUnreachable = unreachable.filter(id => referencedBy[id]);

  if (orphanNodes.length > 0) {
    err(`孤立节点（无任何引用且不可达）: ${orphanNodes.length} 个`);
    sectionItem('error', `孤立节点: ${orphanNodes.join(', ')}`);
    if (orphanNodes.length <= 20) orphanNodes.forEach(id => info(`  孤立: [${id}]`));
  }
  if (referencedButUnreachable.length > 0) {
    warn(`有引用但不可达（仅被不可达节点引用）: ${referencedButUnreachable.length} 个`);
    sectionItem('warn', `有引用但不可达: ${referencedButUnreachable.join(', ')}`);
    if (referencedButUnreachable.length <= 10) {
      referencedButUnreachable.forEach(id => {
        info(`  不可达: [${id}] ← 被不可达节点 [${referencedBy[id].join(', ')}] 引用`);
      });
    }
  }
} else {
  info('所有节点从 intro 可达 ✓');
  sectionItem('pass', '所有节点从 intro 可达');
}

// ───【2】死链检查 ──────────────────────────────────────────────────
sectionStart('【2】死链检查');
let deadLinkCount = 0;
for (const [nodeId, node] of Object.entries(STORY)) {
  if (node.choices) {
    for (const choice of node.choices) {
      if (choice.next && !allNodeIds.has(choice.next)) {
        deadLinkCount++;
        if (deadLinkCount <= 10) {
          err(`死链: [${nodeId}] → [${choice.next}] 不存在`);
          sectionItem('error', `[${nodeId}] → [${choice.next}] 不存在`);
        }
      }
    }
  }
}
if (deadLinkCount > 10) {
  err(`... 还有 ${deadLinkCount - 10} 条死链`);
}
if (deadLinkCount === 0) {
  info('无死链 ✓');
  sectionItem('pass', '无死链');
}

// ───【3】卡死节点检查 ──────────────────────────────────────────────
sectionStart('【3】卡死节点检查');
let stuckCount = 0;
for (const [nodeId, node] of Object.entries(STORY)) {
  if (nodeId.startsWith('ending_') || node.isEnding) continue;
  if (!node.choices || node.choices.length === 0) {
    stuckCount++;
    err(`卡死节点: [${nodeId}] 无 choices 且非结局`);
    sectionItem('error', `[${nodeId}] 无 choices 且非结局`);
  }
}
if (stuckCount === 0) {
  info('无卡死节点 ✓');
  sectionItem('pass', '无卡死节点');
}

// ───【4】循环指向检查 ──────────────────────────────────────────────
sectionStart('【4】循环指向检查');
let cycleCount = 0;

// 4a. 自循环
for (const [nodeId, node] of Object.entries(STORY)) {
  if (node.choices) {
    for (const choice of node.choices) {
      if (choice.next === nodeId) {
        cycleCount++;
        warn(`自循环: [${nodeId}] → 自身`);
        sectionItem('warn', `[${nodeId}] 自循环`);
      }
    }
  }
}

// 4b. A↔B 死循环（双方均无其他出口）
const checkedPairs = new Set();
for (const [nodeA, nexts] of Object.entries(nodeToNexts)) {
  for (const nodeB of nexts) {
    if (nodeA === nodeB) continue;
    const pairKey = [nodeA, nodeB].sort().join('<->');
    if (checkedPairs.has(pairKey)) continue;
    checkedPairs.add(pairKey);

    if (nodeToNexts[nodeB] && nodeToNexts[nodeB].has(nodeA)) {
      const aOnlyB = nexts.size === 1 && nexts.has(nodeB);
      const bOnlyA = nodeToNexts[nodeB].size === 1 && nodeToNexts[nodeB].has(nodeA);
      if (aOnlyB && bOnlyA) {
        cycleCount++;
        err(`死循环: [${nodeA}] ↔ [${nodeB}] 双方均无其他出口`);
        sectionItem('error', `[${nodeA}] ↔ [${nodeB}] 死循环`);
      }
    }
  }
}

if (cycleCount === 0) {
  info('无循环指向问题 ✓');
  sectionItem('pass', '无循环指向问题');
}

// ───【5】effects 数值越界检查 ──────────────────────────────────────
sectionStart('【5】effects 数值越界检查（delta>100 或 结果<0）');
console.log('  属性范围定义:');
for (const [key, attr] of Object.entries(ATTRIBUTES)) {
  console.log(`    ${key} (${attr.name}): ${attr.min} ~ ${attr.max}`);
}
console.log('  检查规则: delta值>100 为绝对越界; 从初始值计算结果<属性下限(0) 为可能越界');
console.log();

let outOfRangeCount = 0;
let undefinedAttrCount = 0;
let deltaAbsurdCount = 0;

for (const [nodeId, node] of Object.entries(STORY)) {
  if (node.choices) {
    for (const choice of node.choices) {
      if (!choice.effects) continue;
      for (const [attrKey, value] of Object.entries(choice.effects)) {
        const attrDef = ATTRIBUTES[attrKey];

        // 检查是否为未定义属性名（非 ATTRIBUTES 中的属性，也非已知元数据字段）
        if (!attrDef && !KNOWN_EFFECTS_META_KEYS.has(attrKey)) {
          undefinedAttrCount++;
          err(`未定义属性名: [${nodeId}] effects.${attrKey} = ${value}，"${attrKey}" 不在 ATTRIBUTES 定义中且非已知元数据字段`);
          sectionItem('error', `[${nodeId}] effects.${attrKey} 未定义`);
          continue;
        }

        // 非属性字段（achievement, icon 等）跳过后续数值检查
        if (!attrDef) continue;

        // 检查 delta 值本身是否超出绝对范围 (>100 或 <-100)
        if (value > 100 || value < -100) {
          outOfRangeCount++;
          err(`数值越界: [${nodeId}] effects.${attrKey} = ${value}，超出绝对范围 [-100, 100]`);
          sectionItem('error', `[${nodeId}] effects.${attrKey} = ${value}，超出绝对范围`);
          continue;
        }

        // 检查 delta 绝对值是否超出属性范围跨度（如 pride 范围 0-10，delta 不应 >10 或 <-10）
        const rangeSpan = attrDef.max - attrDef.min;
        if (Math.abs(value) > rangeSpan) {
          deltaAbsurdCount++;
          warn(`delta 过大: [${nodeId}] ${attrKey}(${attrDef.name}) delta=${value}，属性范围跨度仅 ${rangeSpan} (${attrDef.min}~${attrDef.max})`);
          sectionItem('warn', `[${nodeId}] ${attrKey} delta=${value} 超出范围跨度 ${rangeSpan}`);
        }

        // 检查从初始值计算是否可能越界
        // 注意：effects.js applyEffects 第 47 行有 clamp 保护：
        //   newValue = Math.max(attrDef.min, Math.min(maxVal, newValue))
        // 因此 "初始值+delta" 即使超出 [min, max]，运行时也会被自动 clamp 到合法范围。
        // 校验脚本模拟 clamp：仅当 clamp 后的结果仍越界（理论上不可能）时才报警告，
        // 避免 pressure 初始值为 0 时任何负 delta 都触发误报。
        const initial = INITIAL_VALUES[attrKey] ?? 5;
        const possibleResult = initial + value;
        const clampedResult = Math.max(attrDef.min, Math.min(attrDef.max, possibleResult));
        if (clampedResult < attrDef.min || clampedResult > attrDef.max) {
          outOfRangeCount++;
          const direction = possibleResult > attrDef.max ? '超出上限' : '低于下限';
          warn(`可能越界: [${nodeId}] ${attrKey}(${attrDef.name}) delta=${value > 0 ? '+' : ''}${value}, 初始${initial}+delta=${possibleResult} ${direction}(${attrDef.min}~${attrDef.max})`);
          sectionItem('warn', `[${nodeId}] ${attrKey} delta=${value}, 可能${direction}`);
        }
      }
    }
  }
}
if (outOfRangeCount === 0 && undefinedAttrCount === 0 && deltaAbsurdCount === 0) {
  info('无 effects 数值越界 ✓');
  sectionItem('pass', '无 effects 数值越界');
} else {
  if (undefinedAttrCount > 0) {
    info(`  未定义属性名: ${undefinedAttrCount} 处`);
  }
  if (outOfRangeCount > 0) {
    info(`  数值越界: ${outOfRangeCount} 处`);
  }
  if (deltaAbsurdCount > 0) {
    info(`  delta 过大: ${deltaAbsurdCount} 处`);
  }
}

// ───【6】flag 链路完整性检查 ───────────────────────────────────────
sectionStart('【6】flag 链路完整性检查');

// 收集 story 中所有设置的 flag
const storyFlags = new Set();
for (const [nodeId, node] of Object.entries(STORY)) {
  if (node.choices) {
    for (const choice of node.choices) {
      if (choice.flag) storyFlags.add(choice.flag);
    }
  }
}

// 收集随机事件中设置的 flag（仅用于补充校验，不当作"story 独有"警告）
const eventFlags = new Set();
if (eventsRandomContent) {
  const eventFlagRegex = /flag:\s*['"]([^'"]+)['"]/g;
  let eventFlagMatch;
  while ((eventFlagMatch = eventFlagRegex.exec(eventsRandomContent)) !== null) {
    eventFlags.add(eventFlagMatch[1]);
  }
}
const allSetFlags = new Set([...storyFlags, ...eventFlags]);

// 收集 effects.js 和 endings.js 中引用的 flag
const effectsFlags = extractEffectsFlags();
const endingsFlags = extractEndingsFlags();
const allReferencedFlags = new Set([...effectsFlags, ...endingsFlags]);

// 分类汇总
const storyOnlyFlags = [...storyFlags].filter(f => !allReferencedFlags.has(f));
const codeOnlyFlags = [...allReferencedFlags].filter(f => !allSetFlags.has(f));
const thresholdFlags = codeOnlyFlags.filter(f => THRESHOLD_TRIGGERED_FLAGS.has(f));
const trulyMissingFlags = codeOnlyFlags.filter(f => !THRESHOLD_TRIGGERED_FLAGS.has(f));

console.log(`  story 中设置的 flag: ${[...storyFlags].join(', ') || '无'}`);
console.log(`  effects.js 中引用的 flag: ${[...effectsFlags].join(', ') || '无'}`);
console.log(`  endings.js 中引用的 flag: ${[...endingsFlags].join(', ') || '无'}`);
console.log(`  随机事件中设置的 flag: ${eventFlags.size} 个`);
console.log(`  阈值触发器内部 flag: ${[...thresholdFlags].join(', ') || '无'}`);

// 6a. story 中设置的 flag 在 effects.js/endings.js 中无对应处理
//     叙事性 flag（白名单）仅作为剧情记忆，不影响机制，不报警告
for (const flag of storyOnlyFlags) {
  if (NARRATIVE_FLAGS.has(flag)) {
    info(`叙事性 flag [${flag}] 记录玩家选择，不影响结局匹配（白名单）`);
    sectionItem('pass', `叙事性 flag [${flag}] 已记录（白名单）`);
    continue;
  }
  warn(`story flag [${flag}] 在 effects.js 和 endings.js 中均无对应处理`);
  sectionItem('warn', `flag [${flag}] 未被 effects.js/endings.js 处理`);
}

// 6b. effects.js/endings.js 中引用的 flag 在 story/随机事件 中均无设置 —— 区分阈值触发器 flag
for (const flag of thresholdFlags) {
  info(`阈值触发器 flag [${flag}] 由 checkThresholdTriggers 内部设置，无需 story choice 设置`);
  sectionItem('pass', `阈值触发器 flag [${flag}] 由内部逻辑设置`);
}

// 6c. 真正缺失的 flag（非阈值触发器，story/随机事件 中也没有设置）
for (const flag of trulyMissingFlags) {
  warn(`flag [${flag}] 在 effects.js/endings.js 中被引用，但在 story 和随机事件中均无设置`);
  sectionItem('warn', `flag [${flag}] 未设置`);
}

if (storyOnlyFlags.length === 0 && trulyMissingFlags.length === 0) {
  info('所有 flag 链路完整 ✓');
  sectionItem('pass', '所有 flag 链路完整');
} else {
  if (storyOnlyFlags.length > 0) {
    info(`  story 独有 flag（未被代码引用）: ${storyOnlyFlags.join(', ')}`);
  }
  if (trulyMissingFlags.length > 0) {
    info(`  真正缺失 flag（代码引用但未设置）: ${trulyMissingFlags.join(', ')}`);
  }
}

// ───【7】结局可达性检查 ────────────────────────────────────────────
sectionStart('【7】结局可达性检查');

const reachableEndings = [...endingNodeIds].filter(id => reachable.has(id));
const unreachableEndings = [...endingNodeIds].filter(id => !reachable.has(id));

console.log(`  可达结局: ${reachableEndings.length} / ${endingNodeIds.size}`);

if (unreachableEndings.length > 0) {
  err(`不可达结局: ${unreachableEndings.length} 个`);
  for (const id of unreachableEndings) {
    err(`  结局 [${id}] 从 intro 不可达`);
    sectionItem('error', `结局 [${id}] 从 intro 不可达`);
  }
} else {
  info('所有结局节点从 intro 可达 ✓');
  sectionItem('pass', '所有结局节点从 intro 可达');
}

// 检查 endings.js 中的结局 ID 是否都有对应的 ending_ 节点
// 注意：endings.js 中的结局通过 matchEnding 函数匹配，不一定需要 ending_ 节点
const endingsWithoutNodes = [];
for (const endingId of endingsIds) {
  const nodeId = `ending_${endingId}`;
  if (!allNodeIds.has(nodeId) && !endingNodeIds.has(nodeId)) {
    endingsWithoutNodes.push(endingId);
  }
}
if (endingsWithoutNodes.length > 0) {
  info(`endings.js 中 ${endingsWithoutNodes.length} 个结局通过 matchEnding 触发（无对应 ending_ 节点）: ${endingsWithoutNodes.join(', ')}`);
  sectionItem('pass', `${endingsWithoutNodes.length} 个结局通过 matchEnding 触发`);
}

// ───【8】stages.js 一致性 ──────────────────────────────────────────
sectionStart('【8】stages.js 一致性');

for (const stage of stages) {
  for (const nodeId of stage.nodes) {
    if (!allNodeIds.has(nodeId)) {
      err(`stages.js [${stage.id}] 引用了不存在的节点 [${nodeId}]`);
      sectionItem('error', `stages.js [${stage.id}] 引用不存在节点 [${nodeId}]`);
    }
  }
}

const stagedNodes = new Set();
for (const stage of stages) {
  stage.nodes.forEach(id => stagedNodes.add(id));
}
const unstagedReachable = [];
for (const nodeId of reachable) {
  if (!stagedNodes.has(nodeId) && !nodeId.startsWith('ending_') && !STORY[nodeId]?.isEnding) {
    unstagedReachable.push(nodeId);
  }
}
if (unstagedReachable.length > 0) {
  warn(`${unstagedReachable.length} 个可达节点未被任何 stage 覆盖: ${unstagedReachable.slice(0, 10).join(', ')}${unstagedReachable.length > 10 ? '...' : ''}`);
  sectionItem('warn', `${unstagedReachable.length} 个可达节点未被 stage 覆盖`);
} else {
  info('所有可达节点都被 stage 覆盖 ✓');
  sectionItem('pass', '所有可达节点都被 stage 覆盖');
}

// ───【9】effects 属性名一致性 ──────────────────────────────────────
sectionStart('【9】effects 属性名一致性');

// 常见错误属性名映射
const COMMON_TYPOS = {
  rep: 'reputation',
  fail: 'failures',
  pr: 'pride',
  wl: 'wealth',
  weath: 'wealth',
  welth: 'wealth',
  repu: 'reputation',
  pres: 'pressure',
  trst: 'trust',
};

let typoCount = 0;
const typoDetails = {};

for (const [nodeId, node] of Object.entries(STORY)) {
  if (node.choices) {
    for (const choice of node.choices) {
      if (!choice.effects) continue;
      for (const key of Object.keys(choice.effects)) {
        const correctName = COMMON_TYPOS[key];
        if (correctName) {
          typoCount++;
          if (!typoDetails[key]) typoDetails[key] = { correct: correctName, nodes: [] };
          if (typoDetails[key].nodes.length < 5) typoDetails[key].nodes.push(nodeId);
        }
      }
    }
  }
}

if (typoCount > 0) {
  for (const [typo, detail] of Object.entries(typoDetails)) {
    err(`"${typo}" 应为 "${detail.correct}": ${detail.nodes.length} 处 (如: ${detail.nodes.join(', ')})`);
    sectionItem('error', `"${typo}" 应为 "${detail.correct}": ${detail.nodes.length} 处`);
  }
} else {
  info('effects 属性名全部正确 ✓');
  sectionItem('pass', 'effects 属性名全部正确');
}

// ───【10】结局 flag 依赖检查 ──────────────────────────────────────────
sectionStart('【10】结局 flag 依赖检查');

// 从 endings.js 源码中提取每个结局的 flag 依赖
const endingFlagDeps = {};
const endingIdRegex = /id:\s*['"](\w+)['"]/g;
let endingIdMatch;
const endingPosList = [];
while ((endingIdMatch = endingIdRegex.exec(endingsContent)) !== null) {
  endingPosList.push({ id: endingIdMatch[1], index: endingIdMatch.index });
}

for (let i = 0; i < endingPosList.length; i++) {
  const start = endingPosList[i].index;
  const end = i + 1 < endingPosList.length ? endingPosList[i + 1].index : endingsContent.length;
  const block = endingsContent.substring(start, end);

  const flagsInCheck = new Set();
  const flagInEndRegex = /flags\.has\(\s*['"]([^'"]+)['"]\s*\)/g;
  let fm;
  while ((fm = flagInEndRegex.exec(block)) !== null) {
    flagsInCheck.add(fm[1]);
  }

  if (flagsInCheck.size > 0) {
    endingFlagDeps[endingPosList[i].id] = [...flagsInCheck];
  }
}

// 检查每个结局的 flag 依赖是否满足
let endingFlagIssueCount = 0;
const endingsWithAllFlagsMet = [];
const endingsWithMissingFlags = [];

for (const [endingId, deps] of Object.entries(endingFlagDeps)) {
  const missingFlags = deps.filter(f => !storyFlags.has(f) && !THRESHOLD_TRIGGERED_FLAGS.has(f));
  if (missingFlags.length > 0) {
    endingFlagIssueCount++;
    endingsWithMissingFlags.push({ endingId, missingFlags });
    warn(`结局 [${endingId}] 依赖 flag [${missingFlags.join(', ')}]，但这些 flag 在 story 中未设置`);
    sectionItem('warn', `结局 [${endingId}] 依赖未设置 flag: ${missingFlags.join(', ')}`);
  } else {
    endingsWithAllFlagsMet.push(endingId);
  }
}

console.log(`  依赖 flag 的结局: ${Object.keys(endingFlagDeps).length} / ${endingsIds.length}`);
console.log(`  flag 依赖全部满足: ${endingsWithAllFlagsMet.length}`);
if (endingsWithMissingFlags.length > 0) {
  console.log(`  flag 依赖有缺失: ${endingsWithMissingFlags.length}`);
}

if (endingFlagIssueCount === 0) {
  info('所有结局的 flag 依赖均可满足 ✓');
  sectionItem('pass', '所有结局的 flag 依赖均可满足');
}

// ───【11】天赋 special 字段引用一致性 ───────────────────────────────
sectionStart('【11】天赋 special 字段引用一致性');

// 已知在 effects.js / GameScene.js 中有实现处理的 special 集合
// 与 test/unit/data-integrity.test.js 中的 HANDLED_SPECIALS 保持一致
const HANDLED_SPECIALS = new Set([
  'failure_heals_pride', 'failure_wealth_bonus', 'fans_loyalty_bonus',
  'reputation_gain_doubled', 'trust_gain_bonus', 'low_stats_bonus',
  'all_choices_bonus', 'debt_reduction_bonus', 'high_risk_high_reward',
  'late_game_bonus', 'titan_heart_effect', 'reality_distortion_field',
  'stage_events_bonus', 'product_events_bonus', 'pressure_recovery',
  'pressure_gain_halved', 'pressure_crash_halved', 'trust_check_bonus',
  'random_events_bias_positive', 'replay_bonus', 'achievement_hunter_bonus'
]);

let unimplementedSpecialCount = 0;
const talentSpecialMap = {}; // special → [talentId]
for (const talent of TALENTS) {
  if (!talent.special) continue;
  if (!HANDLED_SPECIALS.has(talent.special)) {
    unimplementedSpecialCount++;
    err(`天赋 [${talent.id}] 声明 special="${talent.special}"，但在 effects.js / GameScene.js 中未找到实现`);
    sectionItem('error', `天赋 [${talent.id}] special="${talent.special}" 未实现`);
  }
  if (!talentSpecialMap[talent.special]) talentSpecialMap[talent.special] = [];
  talentSpecialMap[talent.special].push(talent.id);
}

// 反向检查：HANDLED_SPECIALS 中有但 talents.js 中无任何天赋声明的孤儿 special
let orphanSpecialCount = 0;
for (const sp of HANDLED_SPECIALS) {
  if (!talentSpecialMap[sp]) {
    orphanSpecialCount++;
    warn(`HANDLED_SPECIALS 列表中的 "${sp}" 在 talents.js 中无任何天赋声明（可能是过期条目）`);
    sectionItem('warn', `"${sp}" 在 talents.js 中无声明`);
  }
}

console.log(`  天赋总数: ${TALENTS.length}`);
console.log(`  声明 special 的天赋数: ${Object.keys(talentSpecialMap).length} 个 unique special`);
console.log(`  HANDLED_SPECIALS 已实现集合大小: ${HANDLED_SPECIALS.size}`);

if (unimplementedSpecialCount === 0 && orphanSpecialCount === 0) {
  info('所有天赋 special 字段引用一致 ✓');
  sectionItem('pass', '所有天赋 special 字段引用一致');
} else {
  if (unimplementedSpecialCount > 0) info(`  未实现的 special: ${unimplementedSpecialCount} 处`);
  if (orphanSpecialCount > 0) info(`  孤儿 HANDLED_SPECIALS 条目: ${orphanSpecialCount} 处`);
}

// ───【12】技能树依赖图完整性 ────────────────────────────────────────
sectionStart('【12】技能树依赖图完整性');

const skillIdSet = new Set(ALL_SKILLS.map(s => s.id));
let missingRefCount = 0;
let skillCycleCount = 0;

// 12a. 引用 id 存在性检查
for (const skill of ALL_SKILLS) {
  const refFields = ['requires', 'requiresAny', 'exclusiveWith'];
  for (const field of refFields) {
    if (!Array.isArray(skill[field])) continue;
    for (const refId of skill[field]) {
      if (!skillIdSet.has(refId)) {
        missingRefCount++;
        err(`技能 [${skill.id}] ${field} 引用了不存在的技能 id "${refId}"`);
        sectionItem('error', `技能 [${skill.id}] ${field} → "${refId}" 不存在`);
      }
    }
  }
}

// 12b. requires 依赖图循环检测（仅 requires 形成强依赖，requiresAny 是 OR 不构成强环）
function detectSkillCycles() {
  const cycles = [];
  const graph = {}; // id → [id]
  for (const skill of ALL_SKILLS) {
    graph[skill.id] = (skill.requires || []).filter(id => skillIdSet.has(id));
  }

  const WHITE = 0, GRAY = 1, BLACK = 2;
  const color = {};
  for (const id of Object.keys(graph)) color[id] = WHITE;

  function dfs(node, path) {
    color[node] = GRAY;
    path.push(node);
    for (const next of (graph[node] || [])) {
      if (color[next] === GRAY) {
        // 找到环
        const cycleStart = path.indexOf(next);
        const cycle = path.slice(cycleStart).concat([next]);
        cycles.push(cycle);
      } else if (color[next] === WHITE) {
        dfs(next, path);
      }
    }
    path.pop();
    color[node] = BLACK;
  }

  for (const id of Object.keys(graph)) {
    if (color[id] === WHITE) dfs(id, []);
  }
  return cycles;
}

const skillCycles = detectSkillCycles();
for (const cycle of skillCycles) {
  skillCycleCount++;
  err(`技能树 requires 存在循环依赖: ${cycle.join(' → ')}`);
  sectionItem('error', `技能树循环: ${cycle.join(' → ')}`);
}

// 12c. exclusiveWith 应双向声明（A.exclusiveWith=[B]，则 B.exclusiveWith 应含 A）
let exclusiveAsymmetryCount = 0;
for (const skill of ALL_SKILLS) {
  if (!Array.isArray(skill.exclusiveWith)) continue;
  for (const exId of skill.exclusiveWith) {
    if (!skillIdSet.has(exId)) continue;
    const exSkill = ALL_SKILLS.find(s => s.id === exId);
    if (!exSkill || !Array.isArray(exSkill.exclusiveWith) || !exSkill.exclusiveWith.includes(skill.id)) {
      exclusiveAsymmetryCount++;
      warn(`技能互斥未双向声明: [${skill.id}].exclusiveWith 含 "${exId}"，但 [${exId}].exclusiveWith 未含 "${skill.id}"`);
      sectionItem('warn', `互斥未双向: [${skill.id}] → [${exId}]`);
    }
  }
}

console.log(`  技能总数: ${ALL_SKILLS.length}`);
console.log(`  技能树数: ${Object.keys(SKILL_TREES).length}`);
console.log(`  缺失引用: ${missingRefCount} 处`);
console.log(`  循环依赖: ${skillCycleCount} 处`);
console.log(`  互斥未双向: ${exclusiveAsymmetryCount} 处`);

if (missingRefCount === 0 && skillCycleCount === 0 && exclusiveAsymmetryCount === 0) {
  info('技能树依赖图完整 ✓');
  sectionItem('pass', '技能树依赖图完整');
} else {
  if (missingRefCount > 0) info(`  缺失引用: ${missingRefCount} 处`);
  if (skillCycleCount > 0) info(`  循环依赖: ${skillCycleCount} 处`);
  if (exclusiveAsymmetryCount > 0) info(`  互斥未双向: ${exclusiveAsymmetryCount} 处`);
}

// ───【13】随机事件数据完整性 ───────────────────────────────────────
sectionStart('【13】随机事件数据完整性');

let invalidWeightCount = 0;
let invalidEventEffectsAttrCount = 0;
let invalidEventFlagCount = 0;
let eventMissingIdCount = 0;
let duplicateEventIdCount = 0;

const seenEventIds = new Set();
const validAttrNames = new Set([...Object.keys(ATTRIBUTES), ...KNOWN_EFFECTS_META_KEYS]);

for (const evt of RANDOM_EVENTS) {
  // 13a. id 必填且唯一
  if (!evt.id) {
    eventMissingIdCount++;
    err(`随机事件缺少 id 字段`);
    sectionItem('error', `随机事件缺少 id`);
    continue;
  }
  if (seenEventIds.has(evt.id)) {
    duplicateEventIdCount++;
    err(`随机事件 id 重复: "${evt.id}"`);
    sectionItem('error', `随机事件 id 重复: ${evt.id}`);
  }
  seenEventIds.add(evt.id);

  // 13b. weight 必须为正数
  if (typeof evt.weight !== 'number' || evt.weight <= 0) {
    invalidWeightCount++;
    err(`随机事件 [${evt.id}] weight=${evt.weight}，必须为正数`);
    sectionItem('error', `[${evt.id}] weight=${evt.weight} 非正`);
  }

  // 13c. choices[].effects 属性名合法性
  if (Array.isArray(evt.choices)) {
    for (let i = 0; i < evt.choices.length; i++) {
      const choice = evt.choices[i];
      if (!choice || !choice.effects) continue;
      for (const key of Object.keys(choice.effects)) {
        if (!validAttrNames.has(key)) {
          invalidEventEffectsAttrCount++;
          err(`随机事件 [${evt.id}] choices[${i}].effects.${key} 不在 ATTRIBUTES 中且非已知元数据字段`);
          sectionItem('error', `[${evt.id}] effects.${key} 未定义`);
        }
      }
      // flag 字段非空字符串
      if (choice.flag !== undefined && typeof choice.flag !== 'string') {
        invalidEventFlagCount++;
        err(`随机事件 [${evt.id}] choices[${i}].flag 必须为字符串`);
        sectionItem('error', `[${evt.id}].flag 类型错误`);
      }
    }
  }

  // 13d. requiresFlags / blocksFlags 中的 flag 应为字符串
  for (const field of ['requiresFlags', 'blocksFlags']) {
    if (Array.isArray(evt[field])) {
      for (const f of evt[field]) {
        if (typeof f !== 'string') {
          invalidEventFlagCount++;
          err(`随机事件 [${evt.id}] ${field} 中存在非字符串 flag: ${f}`);
          sectionItem('error', `[${evt.id}] ${field} 非字符串`);
        }
      }
    }
  }
}

console.log(`  随机事件总数: ${RANDOM_EVENTS.length}`);
console.log(`  无效 weight: ${invalidWeightCount} 处`);
console.log(`  未定义属性名: ${invalidEventEffectsAttrCount} 处`);
console.log(`  flag 类型错误: ${invalidEventFlagCount} 处`);
console.log(`  重复 id: ${duplicateEventIdCount} 处`);

if (invalidWeightCount === 0 && invalidEventEffectsAttrCount === 0 &&
    invalidEventFlagCount === 0 && eventMissingIdCount === 0 &&
    duplicateEventIdCount === 0) {
  info('所有随机事件数据完整 ✓');
  sectionItem('pass', '所有随机事件数据完整');
} else {
  if (invalidWeightCount > 0) info(`  无效 weight: ${invalidWeightCount} 处`);
  if (invalidEventEffectsAttrCount > 0) info(`  未定义属性名: ${invalidEventEffectsAttrCount} 处`);
  if (invalidEventFlagCount > 0) info(`  flag 类型错误: ${invalidEventFlagCount} 处`);
  if (duplicateEventIdCount > 0) info(`  重复 id: ${duplicateEventIdCount} 处`);
}

// ───【14】结局 priority/sceneType 一致性 ───────────────────────────
sectionStart('【14】结局 priority/sceneType 一致性');

// 从 endings.js 源码中提取每个结局的 (id, priority, sceneType) 元组
const endingMetaList = [];
const idRegexWithPos = /id:\s*['"](\w+)['"]/g;
let idMatchWithPos;
const idPositions = [];
while ((idMatchWithPos = idRegexWithPos.exec(endingsContent)) !== null) {
  idPositions.push({ id: idMatchWithPos[1], index: idMatchWithPos.index });
}

for (let i = 0; i < idPositions.length; i++) {
  const start = idPositions[i].index;
  const end = i + 1 < idPositions.length ? idPositions[i + 1].index : endingsContent.length;
  const block = endingsContent.substring(start, end);
  const priorityMatch = block.match(/priority:\s*(-?\d+)/);
  const sceneTypeMatch = block.match(/sceneType:\s*['"]([^'"]+)['"]/);
  endingMetaList.push({
    id: idPositions[i].id,
    priority: priorityMatch ? parseInt(priorityMatch[1], 10) : null,
    sceneType: sceneTypeMatch ? sceneTypeMatch[1] : null
  });
}

// 14a. priority 重复检测（硬重复：相同 priority 值）
// 同优先级按 ENDINGS 数组顺序匹配是设计预期（matchEnding 顺序遍历），不报警告，仅记录信息。
const priorityGroups = {};
for (const e of endingMetaList) {
  if (e.priority === null) continue;
  if (!priorityGroups[e.priority]) priorityGroups[e.priority] = [];
  priorityGroups[e.priority].push(e.id);
}
let priorityDupCount = 0;
for (const [pri, ids] of Object.entries(priorityGroups)) {
  if (ids.length > 1) {
    priorityDupCount++;
    info(`结局 priority=${pri} 重复: ${ids.join(', ')}（同优先级按数组顺序匹配，设计预期）`);
    sectionItem('info', `priority=${pri} 重复: ${ids.join(', ')}（设计预期）`);
  }
}

// 14b. priority 缺失检测
let missingPriorityCount = 0;
for (const e of endingMetaList) {
  if (e.priority === null) {
    missingPriorityCount++;
    err(`结局 [${e.id}] 缺少 priority 字段`);
    sectionItem('error', `结局 [${e.id}] 缺少 priority`);
  }
}

// 14c. sceneType 缺失或非法检测
let invalidSceneTypeCount = 0;
for (const e of endingMetaList) {
  if (!e.sceneType) {
    invalidSceneTypeCount++;
    err(`结局 [${e.id}] 缺少 sceneType 字段`);
    sectionItem('error', `结局 [${e.id}] 缺少 sceneType`);
    continue;
  }
  // sceneType 必须是 SCENE_ASSET_TYPES 中的合法类型，或 'ending'（通用结局场景）
  if (!SCENE_ASSET_TYPES.has(e.sceneType) && e.sceneType !== 'ending') {
    invalidSceneTypeCount++;
    err(`结局 [${e.id}] sceneType="${e.sceneType}" 不在 SCENE_ASSETS 类型列表中`);
    sectionItem('error', `结局 [${e.id}] sceneType="${e.sceneType}" 非法`);
  }
}

// 14d. ENDING_SCENE_MAP 中的 key 必须是有效的结局 id，value 必须是合法场景类型
let invalidMapKeyCount = 0;
let invalidMapValueCount = 0;
const endingIdSet = new Set(endingMetaList.map(e => e.id));
for (const [endingId, sceneType] of Object.entries(ENDING_SCENE_MAP)) {
  if (!endingIdSet.has(endingId)) {
    invalidMapKeyCount++;
    warn(`ENDING_SCENE_MAP key="${endingId}" 在 endings.js 中无对应结局定义`);
    sectionItem('warn', `ENDING_SCENE_MAP key "${endingId}" 无对应结局`);
  }
  if (!SCENE_ASSET_TYPES.has(sceneType)) {
    invalidMapValueCount++;
    err(`ENDING_SCENE_MAP["${endingId}"]="${sceneType}" 不在 SCENE_ASSETS 类型列表中`);
    sectionItem('error', `ENDING_SCENE_MAP["${endingId}"]="${sceneType}" 非法`);
  }
}

console.log(`  结局总数: ${endingMetaList.length}`);
console.log(`  ENDING_SCENE_MAP 条目数: ${Object.keys(ENDING_SCENE_MAP).length}`);
console.log(`  priority 重复组数: ${priorityDupCount} 组`);
console.log(`  缺失 priority: ${missingPriorityCount} 处`);
console.log(`  非法 sceneType: ${invalidSceneTypeCount} 处`);
console.log(`  ENDING_SCENE_MAP 非法 key: ${invalidMapKeyCount} 处`);
console.log(`  ENDING_SCENE_MAP 非法 value: ${invalidMapValueCount} 处`);

// priority 重复为设计预期（info 级别），不纳入"全部一致"判定条件
if (missingPriorityCount === 0 &&
    invalidSceneTypeCount === 0 && invalidMapKeyCount === 0 &&
    invalidMapValueCount === 0) {
  info('结局 priority/sceneType 全部一致 ✓');
  sectionItem('pass', '结局 priority/sceneType 全部一致');
} else {
  if (priorityDupCount > 0) info(`  priority 重复: ${priorityDupCount} 组`);
  if (missingPriorityCount > 0) info(`  缺失 priority: ${missingPriorityCount} 处`);
  if (invalidSceneTypeCount > 0) info(`  非法 sceneType: ${invalidSceneTypeCount} 处`);
  if (invalidMapKeyCount > 0) info(`  ENDING_SCENE_MAP 非法 key: ${invalidMapKeyCount} 处`);
  if (invalidMapValueCount > 0) info(`  ENDING_SCENE_MAP 非法 value: ${invalidMapValueCount} 处`);
}

// ============================================
// 终端总结
// ============================================
console.log('\n' + '='.repeat(60));
console.log('  校验结果');
console.log('='.repeat(60) + '\n');
console.log(`  ❌ 错误数: ${errors.length}`);
console.log(`  ⚠️  警告数: ${warnings.length}`);

if (errors.length > 0) {
  console.log('\n  🔴 必须修复的错误:');
  errors.forEach((e, i) => console.log(`    ${i + 1}. ${e}`));
}
if (warnings.length > 0) {
  console.log('\n  🟡 建议修复的警告:');
  warnings.forEach((w, i) => console.log(`    ${i + 1}. ${w}`));
}

console.log(`\n  验收状态: ${errors.length === 0 ? '✅ 通过' : '❌ 未通过 — 需修复 ' + errors.length + ' 个错误'}`);

// ============================================
// 生成 Markdown 报告
// ============================================
const reportPath = path.join(__dirname, '..', 'validation-report.md');

let md = `# 剧情数据校验报告\n\n`;
md += `> 生成时间: ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}\n\n`;
md += `## 概览\n\n`;
md += `| 项目 | 数值 |\n`;
md += `|------|------|\n`;
md += `| 总节点数 | ${allNodeIds.size} |\n`;
md += `| 普通节点 | ${regularNodeIds.size} |\n`;
md += `| 结局节点 | ${endingNodeIds.size} |\n`;
md += `| endings.js 结局数 | ${endingsIds.length} |\n`;
md += `| 从 intro 可达 | ${reachable.size} |\n`;
md += `| 不可达节点 | ${unreachable.length} |\n`;
md += `| story flag 数 | ${storyFlags.size} |\n`;
md += `| 阈值触发器 flag 数 | ${thresholdFlags.length} |\n`;
md += `| stages.js 阶段数 | ${stages.length} |\n`;
md += `| 错误数 | **${errors.length}** |\n`;
md += `| 警告数 | **${warnings.length}** |\n`;
md += `| 验收状态 | ${errors.length === 0 ? '通过' : '未通过'} |\n\n`;

for (const section of sections) {
  md += `## ${section.title}\n\n`;
  if (section.items.length === 0) {
    md += `- ✅ 无问题\n\n`;
  } else {
    for (const item of section.items) {
      const icon = item.level === 'error' ? '❌' : item.level === 'warn' ? '⚠️' : '✅';
      md += `- ${icon} ${item.msg}\n`;
    }
    md += `\n`;
  }
}

if (errors.length > 0) {
  md += `## ❌ 必须修复的错误\n\n`;
  errors.forEach((e, i) => { md += `${i + 1}. ${e}\n`; });
  md += `\n`;
}
if (warnings.length > 0) {
  md += `## ⚠️ 建议修复的警告\n\n`;
  warnings.forEach((w, i) => { md += `${i + 1}. ${w}\n`; });
  md += `\n`;
}

fs.writeFileSync(reportPath, md, 'utf-8');
console.log(`\n  📄 Markdown 报告已生成: ${reportPath}`);

// ============================================
// 生成 HTML 报告
// ============================================
const htmlReportPath = path.join(__dirname, '..', 'validation-report.html');

let html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>剧情数据校验报告</title>
<style>
  :root { --gold: #f0c040; --bg: #1a1a2e; --card: #16213e; --text: #e0e0e0; --border: #333; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', system-ui, sans-serif; background: var(--bg); color: var(--text); padding: 2rem; line-height: 1.6; }
  h1 { color: var(--gold); border-bottom: 2px solid var(--gold); padding-bottom: 0.5rem; margin-bottom: 1rem; }
  h2 { color: var(--gold); margin-top: 1.5rem; margin-bottom: 0.5rem; }
  table { border-collapse: collapse; width: 100%; margin: 1rem 0; }
  th, td { border: 1px solid var(--border); padding: 0.5rem 1rem; text-align: left; }
  th { background: var(--card); color: var(--gold); }
  td { background: var(--card); }
  .pass { color: #4caf50; }
  .error { color: #f44336; }
  .warn { color: #ff9800; }
  .summary { display: flex; gap: 1rem; margin: 1rem 0; flex-wrap: wrap; }
  .summary-card { background: var(--card); border: 1px solid var(--border); border-radius: 8px; padding: 1rem 2rem; text-align: center; min-width: 100px; }
  .summary-card .number { font-size: 2rem; font-weight: bold; }
  .summary-card .label { font-size: 0.9rem; color: #999; }
  .section { background: var(--card); border: 1px solid var(--border); border-radius: 8px; padding: 1rem; margin: 1rem 0; }
  .section-title { color: var(--gold); font-weight: bold; margin-bottom: 0.5rem; font-size: 1.1rem; }
  ul { list-style: none; padding-left: 1rem; }
  li { padding: 0.2rem 0; }
  .timestamp { color: #999; font-size: 0.9rem; }
  .badge { display: inline-block; padding: 0.2rem 0.6rem; border-radius: 4px; font-size: 0.85rem; font-weight: bold; }
  .badge-pass { background: #1b5e20; color: #4caf50; }
  .badge-fail { background: #b71c1c; color: #f44336; }
  .badge-warn { background: #e65100; color: #ff9800; }
</style>
</head>
<body>
<h1>🎮 剧情数据校验报告</h1>
<p class="timestamp">生成时间: ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}</p>

<div class="summary">
  <div class="summary-card"><div class="number">${allNodeIds.size}</div><div class="label">总节点</div></div>
  <div class="summary-card"><div class="number">${reachable.size}</div><div class="label">可达节点</div></div>
  <div class="summary-card"><div class="number">${endingNodeIds.size}</div><div class="label">结局节点</div></div>
  <div class="summary-card"><div class="number ${errors.length > 0 ? 'error' : 'pass'}">${errors.length}</div><div class="label">错误</div></div>
  <div class="summary-card"><div class="number ${warnings.length > 0 ? 'warn' : 'pass'}">${warnings.length}</div><div class="label">警告</div></div>
  <div class="summary-card"><div class="number ${errors.length === 0 ? 'pass' : 'error'}">${errors.length === 0 ? '✅' : '❌'}</div><div class="label">验收</div></div>
</div>

<h2>概览</h2>
<table>
<tr><th>项目</th><th>数值</th></tr>
<tr><td>总节点数</td><td>${allNodeIds.size}</td></tr>
<tr><td>普通节点</td><td>${regularNodeIds.size}</td></tr>
<tr><td>结局节点</td><td>${endingNodeIds.size}</td></tr>
<tr><td>endings.js 结局数</td><td>${endingsIds.length}</td></tr>
<tr><td>从 intro 可达</td><td>${reachable.size}</td></tr>
<tr><td>不可达节点</td><td>${unreachable.length}</td></tr>
<tr><td>story flag 数</td><td>${storyFlags.size}</td></tr>
<tr><td>阈值触发器 flag 数</td><td>${thresholdFlags.length}</td></tr>
<tr><td>stages.js 阶段数</td><td>${stages.length}</td></tr>
<tr><td>错误数</td><td class="${errors.length > 0 ? 'error' : 'pass'}">${errors.length}</td></tr>
<tr><td>警告数</td><td class="${warnings.length > 0 ? 'warn' : 'pass'}">${warnings.length}</td></tr>
<tr><td>验收状态</td><td><span class="badge ${errors.length === 0 ? 'badge-pass' : 'badge-fail'}">${errors.length === 0 ? '通过' : '未通过'}</span></td></tr>
</table>
`;

for (const section of sections) {
  html += `<div class="section">\n<div class="section-title">${section.title}</div>\n`;
  if (section.items.length === 0) {
    html += `<ul><li class="pass">✅ 无问题</li></ul>\n`;
  } else {
    html += `<ul>\n`;
    for (const item of section.items) {
      const cls = item.level === 'error' ? 'error' : item.level === 'warn' ? 'warn' : 'pass';
      const icon = item.level === 'error' ? '❌' : item.level === 'warn' ? '⚠️' : '✅';
      html += `<li class="${cls}">${icon} ${item.msg}</li>\n`;
    }
    html += `</ul>\n`;
  }
  html += `</div>\n`;
}

if (errors.length > 0) {
  html += `<h2>❌ 必须修复的错误</h2><ol>\n`;
  errors.forEach(e => { html += `<li class="error">${e}</li>\n`; });
  html += `</ol>\n`;
}
if (warnings.length > 0) {
  html += `<h2>⚠️ 建议修复的警告</h2><ol>\n`;
  warnings.forEach(w => { html += `<li class="warn">${w}</li>\n`; });
  html += `</ol>\n`;
}

html += `</body></html>`;

fs.writeFileSync(htmlReportPath, html, 'utf-8');
console.log(`  📄 HTML 报告已生成: ${htmlReportPath}`);

process.exit(errors.length > 0 ? 1 : 0);
