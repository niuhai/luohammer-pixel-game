/**
 * 降低高幅度属性脚本
 *
 * T73 核心改动：
 *  1. 把所有 pride >= 3 的 effects 降 1（如 +3→+2, +5→+4）
 *  2. 把所有 reputation >= 3 的 effects 降 1
 *  3. 对纯正面且 pride>=2 或 reputation>=2 的 choices 追加代价（同 depolarize）
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

let totalChanges = 0;
let prideReducedCount = 0;
let repReducedCount = 0;
let depolarizeCount = 0;
let totalPrideReduced = 0;
let totalRepReduced = 0;

const changes = [];

for (const file of files) {
  const filePath = path.join(storyDir, file);
  const content = fs.readFileSync(filePath, 'utf-8');
  let newContent = content;
  let fileChanges = 0;

  const effectsRegex = /effects:\s*\{[\s\S]*?\}/g;
  const matches = [...content.matchAll(effectsRegex)];

  // 从后往前处理，避免替换时 index 偏移
  for (let i = matches.length - 1; i >= 0; i--) {
    const match = matches[i];
    const fullMatch = match[0];
    const startIdx = match.index;

    const contextBefore = content.slice(Math.max(0, startIdx - 400), startIdx);
    if (contextBefore.includes('achievement:')) continue;
    if (contextBefore.includes("next: 'ending_")) continue;

    let newEffectsStr = fullMatch;
    let modified = false;

    // 1. 降低 pride >= 3
    newEffectsStr = newEffectsStr.replace(/pride:\s*(\d+)/g, (m, num) => {
      const val = parseInt(num);
      if (val >= 3) {
        modified = true;
        prideReducedCount++;
        totalPrideReduced++;
        return `pride: ${val - 1}`;
      }
      return m;
    });

    // 2. 降低 reputation >= 3
    newEffectsStr = newEffectsStr.replace(/reputation:\s*(\d+)/g, (m, num) => {
      const val = parseInt(num);
      if (val >= 3) {
        modified = true;
        repReducedCount++;
        totalRepReduced++;
        return `reputation: ${val - 1}`;
      }
      return m;
    });

    // 3. depolarize：解析当前 effects，如果是纯正面且有 pride>=2 或 rep>=2，追加代价
    const inner = newEffectsStr.replace(/effects:\s*\{/, '').replace(/\}$/, '');
    const pairs = {};
    const pairRegex = /(\w+):\s*(-?\d+)/g;
    let mm;
    while ((mm = pairRegex.exec(inner)) !== null) {
      pairs[mm[1]] = parseInt(mm[2]);
    }

    const numericValues = Object.entries(pairs).filter(([k]) => k !== 'icon' && k !== 'achievement');
    const allPositive = numericValues.length > 0 && numericValues.every(([k, v]) => v > 0);
    const hasPrideHigh = (pairs.pride || 0) >= 2;
    const hasRepHigh = (pairs.reputation || 0) >= 2;

    if (allPositive && (hasPrideHigh || hasRepHigh)) {
      let costAttr = null;
      let costVal = 0;
      if (!('pressure' in pairs)) {
        costAttr = 'pressure';
        costVal = 1;
      } else if (!('wealth' in pairs)) {
        costAttr = 'wealth';
        costVal = -1;
      }

      if (costAttr) {
        const insertPos = newEffectsStr.lastIndexOf('}');
        newEffectsStr = newEffectsStr.slice(0, insertPos) + `, ${costAttr}: ${costVal}` + newEffectsStr.slice(insertPos);
        modified = true;
        depolarizeCount++;
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

console.log(`=== 高幅度属性降低 ${dryRun ? '[DRY-RUN]' : apply ? '[APPLIED]' : ''} ===\n`);
console.log(`扫描文件数: ${files.length}`);
console.log(`修改 effects 数: ${totalChanges}`);
console.log(`  pride 降低次数: ${prideReducedCount}，总降幅: ${totalPrideReduced}`);
console.log(`  reputation 降低次数: ${repReducedCount}，总降幅: ${totalRepReduced}`);
console.log(`  depolarize 追加代价数: ${depolarizeCount}`);
console.log(`预计 pride 净偏移减少: ~${totalPrideReduced + Math.floor(depolarizeCount * 0.5)}`);
console.log(`预计 reputation 净偏移减少: ~${totalRepReduced + Math.floor(depolarizeCount * 0.3)}`);

console.log('\n=== 修改清单（前 40 条）===');
changes.slice(0, 40).forEach((c, i) => {
  console.log(`${i + 1}. ${c.file} / ${c.nodeId}`);
  console.log(`   label: ${c.label}`);
  console.log(`   old: ${c.old}`);
  console.log(`   new: ${c.new}`);
});

if (changes.length > 40) {
  console.log(`\n... 还有 ${changes.length - 40} 条未显示`);
}

if (dryRun) {
  console.log('\n这是 dry-run，未修改文件。');
  console.log('确认后运行: node scripts/reduce-high-attrs.cjs --apply');
}
