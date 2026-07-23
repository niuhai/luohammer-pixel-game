/**
 * T73 属性平衡脚本
 *
 * 对 pride/reputation 净偏移过高的文件进行自动削弱。
 * 策略：
 *  1. 针对 pride 净偏移 > 10 或 reputation 净偏移 > 15 的文件
 *  2. 在这些文件中，对 pride == 2 且没有明显代价的 effects，交替执行：
 *     - 50% 概率：pride 2 → 1
 *     - 50% 概率：追加 pressure: 1
 *  3. 对 reputation == 2 且没有明显代价的 effects，交替执行：
 *     - 50% 概率：reputation 2 → 1
 *     - 50% 概率：追加 wealth: -1
 *
 * "明显代价"定义：effects 中已经包含 pressure、wealth 为负、或其他属性为负
 *
 * 不改 next、label、flag、requires、sceneType、text
 * 不修改 achievement/ending_xxx 相关的 choices
 */

const fs = require('fs');
const path = require('path');

const storyDir = path.resolve(__dirname, '../src/data/story');
const files = fs.readdirSync(storyDir).filter(f => f.endsWith('.js'));

const dryRun = process.argv.includes('--dry-run') || process.argv.length === 2;
const apply = process.argv.includes('--apply');

// 目标文件：pride 净偏移 > 10 或 reputation 净偏移 > 15
const targetFiles = new Set([
  '1_act0.js', '4_fridge.js', '5_fang.js', '10_act7.js', '11_act8.js', '12_act9.js'
]);

let totalChanges = 0;
let prideReduceCount = 0;
let repReduceCount = 0;
let pressureCostCount = 0;
let wealthCostCount = 0;

const changes = [];

function hasCost(pairs) {
  // 已经有压力、财富负向、或其他属性负向，视为有代价
  if (pairs.pressure && pairs.pressure > 0) return true;
  if (pairs.wealth && pairs.wealth < 0) return true;
  // 其他属性有负值
  for (const [k, v] of Object.entries(pairs)) {
    if (['pride', 'reputation', 'failures', 'icon', 'achievement'].includes(k)) continue;
    if (v < 0) return true;
  }
  return false;
}

for (const file of files) {
  if (!targetFiles.has(file)) continue;

  const filePath = path.join(storyDir, file);
  const content = fs.readFileSync(filePath, 'utf-8');
  let newContent = content;
  let fileChanges = 0;

  const effectsRegex = /effects:\s*\{[\s\S]*?\}/g;
  const matches = [...content.matchAll(effectsRegex)];

  // 从后往前处理
  for (let i = matches.length - 1; i >= 0; i--) {
    const match = matches[i];
    const fullMatch = match[0];
    const startIdx = match.index;

    const contextBefore = content.slice(Math.max(0, startIdx - 400), startIdx);
    if (contextBefore.includes("next: 'ending_")) continue;

    // 解析当前 effects
    const inner = fullMatch.replace(/effects:\s*\{/, '').replace(/\}$/, '');
    const pairs = {};
    const pairRegex = /(\w+):\s*(-?\d+)/g;
    let mm;
    while ((mm = pairRegex.exec(inner)) !== null) {
      pairs[mm[1]] = parseInt(mm[2]);
    }

    if (hasCost(pairs)) continue; // 已经有代价，跳过

    let newEffectsStr = fullMatch;
    let modified = false;

    // 处理 pride == 2
    if (pairs.pride === 2) {
      if (fileChanges % 2 === 0) {
        // 降低幅度
        newEffectsStr = newEffectsStr.replace(/pride:\s*2/, 'pride: 1');
        modified = true;
        prideReduceCount++;
      } else {
        // 追加 pressure 代价
        const insertPos = newEffectsStr.lastIndexOf('}');
        newEffectsStr = newEffectsStr.slice(0, insertPos) + ', pressure: 1' + newEffectsStr.slice(insertPos);
        modified = true;
        pressureCostCount++;
      }
    }

    // 处理 reputation == 2（重新解析，因为上面可能改了 newEffectsStr）
    const inner2 = newEffectsStr.replace(/effects:\s*\{/, '').replace(/\}$/, '');
    const pairs2 = {};
    const pairRegex2 = /(\w+):\s*(-?\d+)/g;
    let mm2;
    while ((mm2 = pairRegex2.exec(inner2)) !== null) {
      pairs2[mm2[1]] = parseInt(mm2[2]);
    }

    if (!hasCost(pairs2) && pairs2.reputation === 2) {
      if (fileChanges % 2 === 0) {
        newEffectsStr = newEffectsStr.replace(/reputation:\s*2/, 'reputation: 1');
        modified = true;
        repReduceCount++;
      } else {
        const insertPos = newEffectsStr.lastIndexOf('}');
        newEffectsStr = newEffectsStr.slice(0, insertPos) + ', wealth: -1' + newEffectsStr.slice(insertPos);
        modified = true;
        wealthCostCount++;
      }
    }

    if (modified) {
      fileChanges++;
      totalChanges++;

      const labelMatch = contextBefore.match(/label:\s*([`'"])([^`'"]*?)\1/);
      const nodeIdMatch = content.slice(0, startIdx).match(/(\w+):\s*\{/g);
      const nodeId = nodeIdMatch ? nodeIdMatch[nodeIdMatch.length - 1].replace(/:\s*\{$/, '') : 'unknown';
      changes.push({
        file,
        nodeId,
        label: labelMatch ? labelMatch[2].slice(0, 40) : '(无label)',
        old: fullMatch,
        new: newEffectsStr
      });

      if (apply) {
        newContent = newContent.slice(0, startIdx) + newEffectsStr + newContent.slice(startIdx + fullMatch.length);
      }
    }
  }

  if (apply && fileChanges > 0) {
    fs.writeFileSync(filePath, newContent, 'utf-8');
  }
}

console.log(`=== T73 属性平衡 ${dryRun ? '[DRY-RUN]' : apply ? '[APPLIED]' : ''} ===\n`);
console.log(`目标文件数: ${targetFiles.size}`);
console.log(`修改 effects 数: ${totalChanges}`);
console.log(`  pride 2→1: ${prideReduceCount}`);
console.log(`  reputation 2→1: ${repReduceCount}`);
console.log(`  追加 pressure: ${pressureCostCount}`);
console.log(`  追加 wealth -1: ${wealthCostCount}`);
console.log(`预计 pride 净偏移减少: ~${prideReduceCount + pressureCostCount}`);
console.log(`预计 reputation 净偏移减少: ~${repReduceCount + wealthCostCount}`);

console.log('\n=== 修改清单（前 50 条）===');
changes.slice(0, 50).forEach((c, i) => {
  console.log(`${i + 1}. ${c.file} / ${c.nodeId}`);
  console.log(`   label: ${c.label}`);
  console.log(`   old: ${c.old}`);
  console.log(`   new: ${c.new}`);
});

if (changes.length > 50) {
  console.log(`\n... 还有 ${changes.length - 50} 条未显示`);
}

if (dryRun) {
  console.log('\n这是 dry-run，未修改文件。');
  console.log('确认后运行: node scripts/t73-balance.cjs --apply');
}
