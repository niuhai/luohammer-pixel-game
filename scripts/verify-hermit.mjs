/**
 * Hermit 结局可达性专项验证脚本
 *
 * 目的：从 act7_payback 节点开始，模拟玩家选择 act7_retire → retired 选项，
 *      验证 retired flag 设置后触发 retired_peace 阈值事件，
 *      最终在 ending_anchor 节点应用 matchEnding 时能否匹配 hermit 结局。
 *
 * 运行: node scripts/verify-hermit.mjs
 */

import { STORY } from '../src/data/story/index.js';
import { ENDINGS, matchEnding } from '../src/data/endings.js';
import { applyEffects, createInitialState, checkThresholdTriggers } from '../src/data/effects.js';

console.log('=== Hermit 结局可达性验证 ===\n');

// 1. 验证 act7_payback 节点存在且有指向 act7_retire 的选项
const paybackNode = STORY['act7_payback'];
if (!paybackNode) {
  console.log('❌ act7_payback 节点不存在');
  process.exit(1);
}
console.log('✓ act7_payback 节点存在');

const retireChoice = paybackNode.choices.find(c => c.next === 'act7_retire');
if (!retireChoice) {
  console.log('❌ act7_payback 无指向 act7_retire 的选项');
  process.exit(1);
}
console.log('✓ act7_payback 存在指向 act7_retire 的选项:', retireChoice.label.slice(0, 30));

// 2. 验证 act7_retire 节点存在且有 retired flag 选项
const retireNode = STORY['act7_retire'];
if (!retireNode) {
  console.log('❌ act7_retire 节点不存在');
  process.exit(1);
}
console.log('✓ act7_retire 节点存在');

const retiredChoice = retireNode.choices.find(c => c.flag === 'retired');
if (!retiredChoice) {
  console.log('❌ act7_retire 无 retired flag 选项');
  process.exit(1);
}
console.log('✓ act7_retire 存在 retired flag 选项:', retiredChoice.label.slice(0, 30));
console.log('  effects:', JSON.stringify(retiredChoice.effects));

// 3. 模拟：从多种压力水平出发，验证 retired + retired_peace 后能否 pressure ≤ 1
console.log('\n--- 场景模拟：不同 pressure 起点是否都能降达 hermit 条件 ---');

const testCases = [
  { name: '低压力起点 (pressure=2)', initialPressure: 2 },
  { name: '中压力起点 (pressure=5)', initialPressure: 5 },
  { name: '高压力起点 (pressure=8)', initialPressure: 8 },
  { name: '极高压力起点 (pressure=12)', initialPressure: 12 },
];

let allPassed = true;
for (const tc of testCases) {
  console.log(`\n[${tc.name}]`);

  // 构造到达 act7_retire 前的状态
  let state = createInitialState({});
  state.pressure = tc.initialPressure;
  const flags = new Set(['pressure_release_triggered']); // 假设之前已触发过
  // 如果 pressure >= 8，pressure_release 阈值事件会先触发降 -3
  const preTriggers = checkThresholdTriggers(state, flags);
  for (const t of preTriggers) {
    if (t.effects) {
      const r = applyEffects(state, t.effects);
      state = r.state;
    }
    if (t.flag) flags.add(t.flag);
  }
  console.log(`  到达 act7_retire 前 pressure = ${state.pressure}`);

  // 玩家选 retired 选项
  const retiredEffects = retiredChoice.effects;
  const r1 = applyEffects(state, retiredEffects);
  state = r1.state;
  flags.add('retired');
  console.log(`  应用 retired effects (${JSON.stringify(retiredEffects)}) 后 pressure = ${state.pressure}`);
  console.log(`  flags 增加: retired`);

  // retired flag 设置后立即触发阈值事件（与 GameScene.makeChoice 一致）
  const postTriggers = checkThresholdTriggers(state, flags);
  console.log(`  触发的阈值事件数: ${postTriggers.length}`);
  for (const t of postTriggers) {
    console.log(`    - ${t.id}: effects=${JSON.stringify(t.effects || {})}, flag=${t.flag || '(无)'}`);
    if (t.effects) {
      const r2 = applyEffects(state, t.effects);
      state = r2.state;
    }
    if (t.flag) flags.add(t.flag);
  }
  console.log(`  应用阈值事件后 pressure = ${state.pressure}`);

  // 验证 hermit 结局条件
  const hermitEnding = ENDINGS.find(e => e.id === 'hermit');
  console.log(`  hermit 条件: pressure <= 1 (${state.pressure} <= 1 = ${state.pressure <= 1}) && flags.has('retired') (${flags.has('retired')})`);

  const matched = matchEnding(state, flags);
  console.log(`  matchEnding 结果: ${matched ? matched.id + ' (' + matched.name + ')' : '(无匹配)'}`);

  if (matched && matched.id === 'hermit') {
    console.log(`  ✓ 验证通过：匹配到 hermit 结局`);
  } else {
    console.log(`  ✗ 验证失败：未匹配 hermit (实际匹配 ${matched ? matched.id : 'NONE'})`);
    allPassed = false;
  }
}

console.log('\n=== 总结 ===');
if (allPassed) {
  console.log('✅ 所有压力起点测试均能匹配 hermit 结局');
  console.log('✅ hermit 结局路径可达：act7_payback → act7_retire → retired 选项 → retired_peace 阈值事件 → ending_anchor → hermit');
  console.log('✅ 关键降压链：retired effects (-3) + retired_peace 阈值事件 (-6) = 合计 -9');
  console.log('✅ 即使初始 pressure=12，经 pressure_release (-3) + retired (-3) + retired_peace (-6) = -12，最终 pressure=0');
} else {
  console.log('❌ 部分测试未通过，请检查上方输出');
  process.exit(1);
}
