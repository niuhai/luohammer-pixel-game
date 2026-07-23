/**
 * T75 验证脚本：F 策略路径分析 + flag-based 结局可达性检查
 *
 * 1. 打印 F 策略的完整路径，确认是否为"故意失败"路径
 * 2. 检查所有 flag-based 结局的 flag 设置点是否存在
 * 3. 统计结局覆盖情况
 *
 * 运行: node scripts/verify-t75.mjs
 */

import { STORY } from '../src/data/story/index.js';
import { ENDINGS } from '../src/data/endings.js';
import { applyEffects, createInitialState, checkThresholdTriggers, checkComboTriggers } from '../src/data/effects.js';

// F 策略：关键选择最大化
function fStrategy(choices) {
  let best = 0, bestVal = -Infinity;
  choices.forEach((c, i) => {
    if (!c.effects) { if (0 > bestVal) { bestVal = 0; best = i; } return; }
    const v = Object.values(c.effects).reduce((s, x) => s + Math.abs(x), 0);
    if (v > bestVal) { bestVal = v; best = i; }
  });
  return best;
}

function isChoiceAvailable(choice, state, flags) {
  if (choice.requires) {
    for (const [k, v] of Object.entries(choice.requires)) {
      if ((state[k] || 0) < v) return false;
    }
  }
  if (choice.requiresFlags) {
    for (const f of choice.requiresFlags) {
      if (!flags.has(f)) return false;
    }
  }
  if (choice.maxAttr) {
    for (const [k, v] of Object.entries(choice.maxAttr)) {
      if ((state[k] || 0) > v) return false;
    }
  }
  return true;
}

// 1. F 策略完整路径
console.log('=== F 策略（关键选择最大化）完整路径 ===\n');
{
  let state = createInitialState({});
  const flags = new Set();
  let nodeId = 'intro';
  let steps = 0;
  const maxSteps = 200;

  while (nodeId && steps < maxSteps) {
    const node = STORY[nodeId];
    if (!node) { console.log(`  [${steps}] NODE_NOT_FOUND: ${nodeId}`); break; }

    const triggers = checkThresholdTriggers(state, flags);
    for (const t of triggers) {
      if (t.flag) flags.add(t.flag);
      if (t.effects) { const r = applyEffects(state, t.effects); state = r.state; }
    }

    if (!node.choices || node.choices.length === 0) {
      console.log(`  [${steps}] ${nodeId} (act ${node.act}) NO_CHOICES`);
      break;
    }

    const available = node.choices.filter(c => isChoiceAvailable(c, state, flags));
    if (available.length === 0) {
      console.log(`  [${steps}] ${nodeId} (act ${node.act}) NO_AVAILABLE_CHOICE`);
      break;
    }

    const idx = fStrategy(available);
    const choice = available[idx];
    const effects = choice.effects || {};
    const r = applyEffects(state, effects);
    state = r.state;
    if (choice.flag) flags.add(choice.flag);

    const postTriggers = checkThresholdTriggers(state, flags);
    for (const t of postTriggers) {
      if (t.flag) flags.add(t.flag);
      if (t.effects) { const r2 = applyEffects(state, t.effects); state = r2.state; }
    }

    const nextNode = choice.next;
    console.log(`  [${steps}] ${nodeId} (act ${node.act}) → 选: ${choice.label.slice(0, 40)} → next: ${nextNode}`);
    console.log(`        effects: ${JSON.stringify(effects)} | flag: ${choice.flag || '-'}`);

    if (nextNode && nextNode.startsWith('ending_')) {
      console.log(`  [${steps}] ENDING_BRANCH: ${nextNode}`);
      break;
    }

    nodeId = nextNode;
    steps++;
  }

  console.log(`\n  总步数: ${steps + 1}`);
  console.log(`  最终状态: pride=${state.pride} wealth=${state.wealth} rep=${state.reputation} fail=${state.failures} pressure=${state.pressure} trust=${state.trust}`);
  console.log(`  flags: ${[...flags].join(', ')}`);

  const matched = ENDINGS.filter(e => { try { return e.check(state, flags); } catch { return false; } }).sort((a, b) => b.priority - a.priority);
  console.log(`  匹配结局: ${matched.map(e => e.id + '(p' + e.priority + ')').join(', ') || '(无)'}`);
}

// 2. flag-based 结局的 flag 设置点检查
console.log('\n\n=== Flag-based 结局可达性检查 ===\n');

// 收集所有 choice.flag 设置点
const flagSetters = new Map(); // flag → [{nodeId, choiceLabel}]
for (const [nodeId, node] of Object.entries(STORY)) {
  if (!node.choices) continue;
  for (const choice of node.choices) {
    if (choice.flag) {
      if (!flagSetters.has(choice.flag)) flagSetters.set(choice.flag, []);
      flagSetters.get(choice.flag).push({ nodeId, choiceLabel: choice.label?.slice(0, 30) });
    }
  }
}

// 检查每个 flag-based 结局
const flagBasedEndings = ENDINGS.filter(e => {
  const src = e.check.toString();
  return src.includes('flags.has');
});

console.log(`共 ${flagBasedEndings.length} 个 flag-based 结局\n`);

let reachableCount = 0;
let unreachableCount = 0;
for (const ending of flagBasedEndings) {
  const src = ending.check.toString();
  // 提取所有 flags.has('xxx')
  const flags = [...src.matchAll(/flags\.has\(['"](\w+)['"]\)/g)].map(m => m[1]);
  const allFlags = flags.every(f => flagSetters.has(f));

  console.log(`[${ending.id}] priority=${ending.priority}`);
  console.log(`  需要flags: ${flags.join(', ')}`);
  for (const f of flags) {
    const setters = flagSetters.get(f);
    if (setters) {
      console.log(`  ✓ ${f} 可设置 (${setters.length}处): ${setters.map(s => s.nodeId).join(', ')}`);
    } else {
      console.log(`  ✗ ${f} 无设置点！`);
    }
  }

  if (allFlags) {
    console.log(`  → 结局 ${ending.id} flag 可达\n`);
    reachableCount++;
  } else {
    console.log(`  → 结局 ${ending.id} flag 不可达！\n`);
    unreachableCount++;
  }
}

console.log(`\n=== 总结 ===`);
console.log(`Flag-based 结局: ${flagBasedEndings.length}`);
console.log(`flag 可达: ${reachableCount}`);
console.log(`flag 不可达: ${unreachableCount}`);

// 3. 纯属性结局可达性检查
console.log('\n\n=== 纯属性结局（无 flag 依赖）===\n');
const attrOnlyEndings = ENDINGS.filter(e => {
  const src = e.check.toString();
  return !src.includes('flags.has');
});
console.log(`共 ${attrOnlyEndings.length} 个纯属性结局`);
for (const e of attrOnlyEndings) {
  console.log(`  [${e.priority}] ${e.id}: ${e.check.toString().slice(0, 100)}`);
}
