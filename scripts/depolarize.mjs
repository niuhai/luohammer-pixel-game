/**
 * 属性极化自动削弱脚本（文件级，不依赖模块导入）
 *
 * 目标：把纯正面（只加 pride/reputation，无其他属性代价）的 choices
 *      自动改成"有得有失"，减少 pride/reputation 净偏移。
 *
 * 规则：
 *  1. 只处理 effects 中所有非零数值同号且为正的选择（纯正面）
 *  2. 只处理包含 pride>=2 或 reputation>=2 的选择
 *  3. 在 effects 中追加一个代价属性：
 *     - 如果 choice 没有 pressure → 加 pressure: 1（消耗心力）
 *     - 如果已有 pressure 但没有 wealth → 加 wealth: -1（消耗金钱）
 *     - 如果已有 pressure 和 wealth → 不加
 *  4. 不修改任何 next、label、flag、requires、sceneType、text
 *  5. 不修改已经有"achievement"的 choices（这些是里程碑，保持纯粹）
 *  6. 不修改 next 指向 ending_xxx 的 choices
 *  7. 不修改 next 指向 ending_xxx 的 choices
 *
 * 运行: node scripts/depolarize.mjs --dry-run
 *       node scripts/depolarize.mjs --apply
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const storyDir = path.resolve(__dirname, '../src/data/story');

const files = fs.readdirSync(storyDir).filter(f => f.endsWith('.js'));

const dryRun = process.argv.includes('--dry-run') || process.argv.length === 2;
const apply = process.argv.includes('--apply');

let totalChanges = 0;
let totalPrideDelta = 0;
let totalRepDelta = 0;
let totalCostDelta = 0;

const changes = [];

for (const file of files) {
  const filePath = path.join(storyDir, file);
  const content = fs.readFileSync(filePath, 'utf-8');
  let newContent = content;
  let fileChanges = 0;

  // 正则匹配 effects: { ... } 对象（支持多行，非贪婪）
  const effectsRegex = /effects:\s*\{[\s\S]*?\}/g;
  const matches = [...content.matchAll(effectsRegex)];

  for (const match of matches) {
    const fullMatch = match[0];
    const startIdx = match.index;

    // 跳过已经有 achievement 的 choice（往前找 achievement 关键字）
    const contextBefore = content.slice(Math.max(0, startIdx - 400), startIdx);
    if (contextBefore.includes('achievement:')) continue;

    // 跳过 next: 'ending_xxx'
    if (contextBefore.includes("next: 'ending_")) continue;

    // 解析 effects
    const inner = fullMatch.replace(/effects:\s*\{/, '').replace(/\}$/, '');
    const pairs = {};
    const pairRegex = /(\w+):\s*(-?\d+)/g;
    let m;
    while ((m = pairRegex.exec(inner)) !== null) {
      pairs[m[1]] = parseInt(m[2]);
    }

    const numericValues = Object.entries(pairs).filter(([k]) => k !== 'icon' && k !== 'achievement');
    const allPositive = numericValues.length > 0 && numericValues.every(([k, v]) => v > 0);
    const hasPrideHigh = (pairs.pride || 0) >= 2;
    const hasRepHigh = (pairs.reputation || 0) >= 2;

    if (!allPositive || (!hasPrideHigh && !hasRepHigh)) continue;

    // 决定追加什么代价
    let costAttr = null;
    let costVal = 0;
    if (!('pressure' in pairs)) {
      costAttr = 'pressure';
      costVal = 1;
    } else if (!('wealth' in pairs)) {
      costAttr = 'wealth';
      costVal = -1;
    } else {
      continue; // 已有 pressure 和 wealth，不加
    }

    // 追加代价字段
    const insertPos = fullMatch.lastIndexOf('}');
    const newEffects = fullMatch.slice(0, insertPos) + `, ${costAttr}: ${costVal}` + fullMatch.slice(insertPos);

    fileChanges++;
    totalChanges++;
    totalPrideDelta += pairs.pride || 0;
    totalRepDelta += pairs.reputation || 0;
    totalCostDelta += costVal;

    // 记录修改（用于报告）
    const labelMatch = contextBefore.match(/label:\s*([`'"])([^`'"]*?)\1/);
    const nodeIdMatch = content.slice(0, startIdx).match(/(\w+):\s*\{/g);
    const nodeId = nodeIdMatch ? nodeIdMatch[nodeIdMatch.length - 1].replace(/:\s*\{$/, '') : 'unknown';
    changes.push({
      file,
      nodeId,
      label: labelMatch ? labelMatch[2].slice(0, 40) : '(无label)',
      old: fullMatch,
      new: newEffects,
      costAttr,
      costVal
    });

    if (apply) {
      // 只替换第一次出现的位置
      const relativeStart = startIdx;
      newContent = newContent.slice(0, relativeStart) + newEffects + newContent.slice(relativeStart + fullMatch.length);
    }
  }

  if (apply && fileChanges > 0) {
    fs.writeFileSync(filePath, newContent, 'utf-8');
  }
}

console.log(`=== 属性极化削弱 ${dryRun ? '[DRY-RUN]' : apply ? '[APPLIED]' : ''} ===\n`);
console.log(`扫描文件数: ${files.length}`);
console.log(`建议修改数: ${totalChanges}`);
console.log(`涉及 pride 总增幅: ${totalPrideDelta}`);
console.log(`涉及 reputation 总增幅: ${totalRepDelta}`);
console.log(`新增代价总值: ${totalCostDelta}`);

console.log('\n=== 修改清单（前 30 条）===');
changes.slice(0, 30).forEach((c, i) => {
  console.log(`${i + 1}. ${c.file} / ${c.nodeId}`);
  console.log(`   label: ${c.label}`);
  console.log(`   + ${c.costAttr}: ${c.costVal}`);
});

if (changes.length > 30) {
  console.log(`\n... 还有 ${changes.length - 30} 条未显示`);
}

if (dryRun) {
  console.log('\n这是 dry-run，未修改文件。');
  console.log('确认后运行: node scripts/depolarize.mjs --apply');
}
