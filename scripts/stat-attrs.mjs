/**
 * 属性净偏移统计脚本
 *
 * 统计每个属性在所有 choices 中的净偏移（正负向之和）
 * 用于指导 T73 削弱属性极化任务
 */

import { STORY } from '../src/data/story/index.js';
import { ATTRIBUTES } from '../src/data/effects.js';

const stats = {};
Object.keys(ATTRIBUTES).forEach(key => {
  stats[key] = { positive: 0, negative: 0, neutral: 0, netSum: 0, positiveCount: 0, negativeCount: 0 };
});

let totalChoices = 0;
let purePositiveChoices = 0;  // 所有 effects 都是正数
let pureNegativeChoices = 0;  // 所有 effects 都是负数
let mixedChoices = 0;

for (const [nodeId, node] of Object.entries(STORY)) {
  if (!node.choices) continue;
  for (const choice of node.choices) {
    if (!choice.effects) continue;
    totalChoices++;

    const values = Object.values(choice.effects).filter(v => typeof v === 'number');
    const allPositive = values.every(v => v > 0);
    const allNegative = values.every(v => v < 0);

    if (allPositive && values.length > 0) purePositiveChoices++;
    else if (allNegative && values.length > 0) pureNegativeChoices++;
    else if (values.some(v => v > 0) && values.some(v => v < 0)) mixedChoices++;

    for (const [attr, val] of Object.entries(choice.effects)) {
      if (typeof val !== 'number') continue;
      if (!stats[attr]) continue;
      stats[attr].netSum += val;
      if (val > 0) { stats[attr].positiveCount++; stats[attr].positive += val; }
      else if (val < 0) { stats[attr].negativeCount++; stats[attr].negative += val; }
      else stats[attr].neutral++;
    }
  }
}

console.log('=== 属性净偏移统计 ===\n');
console.log(`总 choices 数: ${totalChoices}`);
console.log(`纯正面 choices: ${purePositiveChoices} (${(purePositiveChoices/totalChoices*100).toFixed(1)}%)`);
console.log(`纯负面 choices: ${pureNegativeChoices} (${(pureNegativeChoices/totalChoices*100).toFixed(1)}%)`);
console.log(`混合 choices: ${mixedChoices} (${(mixedChoices/totalChoices*100).toFixed(1)}%)`);
console.log('');

console.log('属性'.padEnd(15) + '净偏移'.padStart(8) + '正向数'.padStart(8) + '负向数'.padStart(8) + '正和'.padStart(8) + '负和'.padStart(8) + '正负比'.padStart(10));
for (const [attr, s] of Object.entries(stats)) {
  const ratio = s.negative !== 0 ? (s.positive / Math.abs(s.negative)).toFixed(2) : '∞';
  console.log(
    attr.padEnd(15) +
    String(s.netSum).padStart(8) +
    String(s.positiveCount).padStart(8) +
    String(s.negativeCount).padStart(8) +
    String(s.positive).padStart(8) +
    String(s.negative).padStart(8) +
    ratio.padStart(10)
  );
}

// 识别极化最严重的属性
console.log('\n=== 极化诊断 ===');
const sorted = Object.entries(stats).sort((a, b) => b[1].netSum - a[1].netSum);
console.log('净偏移排序（高→低）:');
sorted.forEach(([attr, s]) => {
  const severity = s.netSum > 100 ? '严重正偏' : s.netSum > 50 ? '中度正偏' : s.netSum < -50 ? '中度负偏' : '平衡';
  console.log(`  ${attr.padEnd(15)} 净偏移=${s.netSum.toString().padStart(5)}  ${severity}`);
});
