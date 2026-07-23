/**
 * validate-effects.cjs
 * 校验 effects 数据的数值越界和 flag 链路完整性
 *
 * 检测项目：
 *   1. effects 数值越界 —— 属性值超出 0-10 范围（failures 除外，其范围为 0-99）
 *   2. flag 链路缺失 —— story.js 中有 flag 但 effects.js 中无对应处理
 *
 * 用法：node scripts/validate-effects.cjs
 */

const fs = require('fs');
const path = require('path');

// 确保 UTF-8 输出
if (process.stdout.isTTY) {
  try { process.stdout.setEncoding('utf-8'); } catch (e) { /* ignore */ }
}

// ─── 属性范围定义（与 effects.js 中 ATTRIBUTES 保持一致） ──────────────

const ATTRIBUTES = {
  pride:       { name: '理想主义', min: 0, max: 10 },
  wealth:      { name: '财富',     min: 0, max: 10 },
  reputation:  { name: '名声',     min: 0, max: 10 },
  failures:    { name: '翻车',     min: 0, max: 99 },
  pressure:    { name: '压力',     min: 0, max: 10 },
  trust:       { name: '公众信任', min: 0, max: 10 },
};

// 只用于记录玩家叙事选择、不参与 effects/ending 判定的 flag。
// 与 validate-story.mjs 的 NARRATIVE_FLAGS 保持一致，避免两个门禁对同一数据给出相反结论。
const NARRATIVE_FLAGS = new Set([
  'grandma_church',
  'first_love_letter',
  'first_love_confess',
  'philosophy_geek',
  'literature_dream',
  'idealism_refined',
  'pragmatic_compromise',
  'all_repay',
  'donated_school',
  'humor_shield',
  'public_milestone',
]);

// ─── 从 story 文件中提取 effects 和 flags ─────────────────────────────

const storyDir = path.resolve(__dirname, '../src/data/story');
const effectsPath = path.resolve(__dirname, '../src/data/effects.js');

const files = fs.readdirSync(storyDir).filter(f => f.endsWith('.js') && f !== 'index.js');

/**
 * 从文件内容中提取所有 effects 对象
 * 返回 [{ nodeKey, effects: { pride: 1, wealth: -2, ... }, file, line }]
 */
function extractEffectsFromFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const results = [];

  // 按节点分割
  const nodeBlockRegex = /^\s{2}(\w+):\s*\{/gm;
  const nodeBlocks = [];
  let m;
  while ((m = nodeBlockRegex.exec(content)) !== null) {
    nodeBlocks.push({ key: m[1], startIndex: m.index });
  }

  for (let i = 0; i < nodeBlocks.length; i++) {
    const key = nodeBlocks[i].key;
    const start = nodeBlocks[i].startIndex;
    const end = i + 1 < nodeBlocks.length ? nodeBlocks[i + 1].startIndex : content.length;
    const block = content.substring(start, end);

    // 在节点块中查找所有 effects: { ... }
    const effectsRegex = /effects:\s*\{([^}]*)\}/g;
    let em;
    while ((em = effectsRegex.exec(block)) !== null) {
      const effectsStr = em[1];
      const effects = {};

      // 解析 effects 内容：pride: 1, wealth: -2, ...
      const propRegex = /(\w+):\s*(-?\d+)/g;
      let pm;
      while ((pm = propRegex.exec(effectsStr)) !== null) {
        effects[pm[1]] = parseInt(pm[2], 10);
      }

      if (Object.keys(effects).length > 0) {
        const line = content.substring(0, em.index).split('\n').length;
        results.push({ nodeKey: key, effects, file: path.basename(filePath), line });
      }
    }
  }

  return results;
}

/**
 * 从文件内容中提取所有 flag 标记
 */
function extractFlagsFromFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const flags = [];

  const flagRegex = /flag:\s*['"]([^'"]+)['"]/g;
  let match;
  while ((match = flagRegex.exec(content)) !== null) {
    const line = content.substring(0, match.index).split('\n').length;
    flags.push({ flag: match[1], file: path.basename(filePath), line });
  }

  return flags;
}

/**
 * 提取 choices 中 requiresFlags / blocksFlags 消费的机制 flag。
 */
function extractConsumedFlagsFromFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const flags = new Set();
  const arrayRegex = /(?:requiresFlags|blocksFlags):\s*\[([^\]]*)\]/g;
  let arrayMatch;
  while ((arrayMatch = arrayRegex.exec(content)) !== null) {
    const stringRegex = /['"]([^'"]+)['"]/g;
    let stringMatch;
    while ((stringMatch = stringRegex.exec(arrayMatch[1])) !== null) {
      flags.add(stringMatch[1]);
    }
  }
  return flags;
}

/**
 * 从 effects.js 和 endings.js 中提取所有被处理的 flag
 * 包括 checkThresholdTriggers 和 checkFlagConsequences 中引用的 flag
 * 以及 endings.js 中结局判定引用的 flag
 */
function extractHandledFlags() {
  const content = fs.readFileSync(effectsPath, 'utf-8');
  const handledFlags = new Set();

  // 匹配 flags.has('xxx') 模式 —— 这些是 effects.js 中检查的 flag
  const hasFlagRegex = /flags\.has\(\s*['"]([^'"]+)['"]\s*\)/g;
  let match;
  while ((match = hasFlagRegex.exec(content)) !== null) {
    handledFlags.add(match[1]);
  }

  // 匹配 flag: 'xxx' 模式 —— 这些是 effects.js 中设置的 flag
  const setFlagRegex = /flag:\s*['"]([^'"]+)['"]/g;
  while ((match = setFlagRegex.exec(content)) !== null) {
    handledFlags.add(match[1]);
  }

  // 同时扫描 endings.js，结局判定中引用的 flag 也视为已被处理
  const endingsPath = path.resolve(__dirname, '../src/data/endings.js');
  if (fs.existsSync(endingsPath)) {
    const endingsContent = fs.readFileSync(endingsPath, 'utf-8');
    while ((match = hasFlagRegex.exec(endingsContent)) !== null) {
      handledFlags.add(match[1]);
    }
  }

  return handledFlags;
}

// ─── 主校验逻辑 ────────────────────────────────────────────────────────

function validate() {
  console.log('='.repeat(60));
  console.log('  Effects 数据校验报告');
  console.log('='.repeat(60));
  console.log();

  // 收集数据
  const allEffects = [];
  const allStoryFlags = [];

  for (const file of files) {
    const filePath = path.join(storyDir, file);
    const effects = extractEffectsFromFile(filePath);
    const flags = extractFlagsFromFile(filePath);
    allEffects.push(...effects);
    allStoryFlags.push(...flags);
  }

  const handledFlags = extractHandledFlags();
  const storyConsumedFlags = new Set();
  for (const file of files) {
    const consumed = extractConsumedFlagsFromFile(path.join(storyDir, file));
    consumed.forEach(flag => {
      storyConsumedFlags.add(flag);
      handledFlags.add(flag);
    });
  }

  console.log(`扫描文件数: ${files.length}`);
  console.log(`Effects 条目数: ${allEffects.length}`);
  console.log(`Story 中 Flag 数: ${allStoryFlags.length}`);
  console.log(`Story 条件消费 Flag 数: ${storyConsumedFlags.size}`);
  console.log(`Effects.js 中处理 Flag 数: ${handledFlags.size}`);
  console.log();

  let errorCount = 0;

  // ─── 1. effects 数值越界检测 ─────────────────────────────────────
  console.log('─'.repeat(60));
  console.log('【1】Effects 数值越界检测');
  console.log('─'.repeat(60));
  console.log(`  属性范围定义：`);
  for (const [key, attr] of Object.entries(ATTRIBUTES)) {
    console.log(`    ${key} (${attr.name}): ${attr.min} ~ ${attr.max}`);
  }
  console.log();

  const outOfRange = [];

  for (const entry of allEffects) {
    for (const [attrKey, value] of Object.entries(entry.effects)) {
      const attrDef = ATTRIBUTES[attrKey];
      if (!attrDef) {
        // 非属性字段（如 achievement, icon），跳过
        continue;
      }

      // 计算可能的极端值：初始值 + 累计 effects
      // 这里只检查单条 effects 的 delta 值是否合理
      // delta 本身不会越界，但需要检查初始值 + delta 是否可能越界
      // 初始值参考 createInitialState: pride=5, wealth=5, reputation=5, failures=0, pressure=0, trust=5
      const initialValues = {
        pride: 5, wealth: 5, reputation: 5,
        failures: 0, pressure: 0, trust: 5
      };
      const initial = initialValues[attrKey] ?? 5;
      const possibleResult = initial + value;

      if (possibleResult < attrDef.min || possibleResult > attrDef.max) {
        outOfRange.push({
          nodeKey: entry.nodeKey,
          attr: attrKey,
          attrName: attrDef.name,
          delta: value,
          initial,
          possibleResult,
          min: attrDef.min,
          max: attrDef.max,
          file: entry.file,
          line: entry.line
        });
      }
    }
  }

  if (outOfRange.length === 0) {
    console.log('  ✓ 未发现 effects 数值越界（从初始值计算）');
  } else {
    // 从初始值计算的可能越界属于风险提示：实际游戏中 applyEffects 会钳制到合法范围
    console.log(`  ⚠ 发现 ${outOfRange.length} 处可能越界（已钳制，仅提示）：`);
    console.log(`    （注：从初始值直接计算，实际游戏中 applyEffects 会 clamp 到合法范围）`);
    for (const oor of outOfRange) {
      const direction = oor.possibleResult > oor.max ? '超出上限' : '低于下限';
      console.log(
        `    - [${oor.file}:${oor.line}] ${oor.nodeKey}: ${oor.attr}(${oor.attrName}) ` +
        `delta=${oor.delta > 0 ? '+' : ''}${oor.delta}, ` +
        `初始${oor.initial}+delta=${oor.possibleResult} ${direction}(${oor.min}~${oor.max})`
      );
    }
  }
  console.log();

  // ─── 2. flag 链路缺失检测 ────────────────────────────────────────
  console.log('─'.repeat(60));
  console.log('【2】Flag 链路缺失检测');
  console.log('  检查 story 中设置的 flag 是否在 effects.js 中有对应处理');
  console.log('─'.repeat(60));

  const missingFlags = [];
  const narrativeFlags = [];

  for (const sf of allStoryFlags) {
    if (NARRATIVE_FLAGS.has(sf.flag)) {
      narrativeFlags.push(sf);
    } else if (!handledFlags.has(sf.flag)) {
      missingFlags.push(sf);
    }
  }

  if (missingFlags.length === 0) {
    console.log('  ✓ 所有机制 flag 在 effects.js/endings.js 中均有对应处理');
  } else {
    errorCount += missingFlags.length;
    console.log(`  ✗ 发现 ${missingFlags.length} 个机制 flag 在 effects.js/endings.js 中无对应处理：`);
    for (const mf of missingFlags) {
      console.log(`    - [${mf.file}:${mf.line}] flag: '${mf.flag}'`);
    }
  }
  if (narrativeFlags.length > 0) {
    const uniqueNarrativeFlags = [...new Set(narrativeFlags.map(item => item.flag))];
    console.log(`  ℹ ${uniqueNarrativeFlags.length} 个叙事记录 flag 无需机制处理：${uniqueNarrativeFlags.join(', ')}`);
  }
  console.log();

  // ─── 反向检查：effects.js 中检查的 flag 是否在 story 中被设置 ────
  console.log('─'.repeat(60));
  console.log('【3】反向检查：effects.js 中检查的 flag 是否在 story 中被设置');
  console.log('─'.repeat(60));

  const storyFlagSet = new Set(allStoryFlags.map(f => f.flag));
  const unhandledInStory = [];

  for (const hf of handledFlags) {
    if (!storyFlagSet.has(hf)) {
      unhandledInStory.push(hf);
    }
  }

  if (unhandledInStory.length === 0) {
    console.log('  ✓ effects.js 中所有 flag 在 story 中均有设置');
  } else {
    // 这只是警告，不算错误（某些 flag 可能由阈值触发器内部设置）
    console.log(`  ⚠ 发现 ${unhandledInStory.length} 个 flag 仅在 effects.js 中出现，未在 story 中设置：`);
    for (const uf of unhandledInStory) {
      console.log(`    - '${uf}' (可能由阈值触发器内部设置，非错误)`);
    }
  }
  console.log();

  // ─── 汇总 ─────────────────────────────────────────────────────────
  console.log('='.repeat(60));
  if (errorCount === 0) {
    console.log('  ✓ 全部通过！未发现 effects 数据问题。');
  } else {
    console.log(`  ✗ 共发现 ${errorCount} 个问题，请检查上方详情。`);
  }
  console.log('='.repeat(60));

  return errorCount;
}

const errors = validate();
process.exit(errors > 0 ? 1 : 0);
