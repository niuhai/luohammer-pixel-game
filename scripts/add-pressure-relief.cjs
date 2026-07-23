/**
 * T74 增加 pressure 下降渠道脚本
 *
 * 策略：扫描所有 choices 的 label，如果包含"休息/放松/回家/陪/度假/赢了/庆祝/放下/释然/不干了"等关键词，
 *      且当前 effects 没有 pressure 字段，则追加 pressure: -1。
 *
 * 限制：
 *  - 不修改 next 指向 ending_xxx 的 choices
 *  - 不修改已经有 pressure 字段的 choices
 *  - 每文件最多处理 8 个，避免过度
 */

const fs = require('fs');
const path = require('path');

const storyDir = path.resolve(__dirname, '../src/data/story');
const files = fs.readdirSync(storyDir).filter(f => f.endsWith('.js'));

const dryRun = process.argv.includes('--dry-run') || process.argv.length === 2;
const apply = process.argv.includes('--apply');

// 放松/减压关键词
const reliefKeywords = [
  '休息', '放松', '回家', '陪陪', '度假', '旅游', '旅行', '赢了', '庆祝', '放下', '释然',
  '不干了', '算了', '睡觉', '睡一觉', '喝酒', '陪家人', '陪朋友', '出去走走', '静一静',
  '不管了', '随它去', '退一步', '退一步', '妥协', '接受现实', '认命', '隐居', '大理',
  '退出', '离开', '停下脚步', '歇一歇', '缓冲', '调整心态'
];

let totalChanges = 0;
const changes = [];

for (const file of files) {
  const filePath = path.join(storyDir, file);
  const content = fs.readFileSync(filePath, 'utf-8');
  let newContent = content;
  let fileChanges = 0;

  // 匹配单个 choice 对象：{ label: `...`, next: '...', effects: {...} }
  // 简化：匹配 effects: { ... }，然后往前找 label
  const effectsRegex = /effects:\s*\{[\s\S]*?\}/g;
  const matches = [...content.matchAll(effectsRegex)];

  for (let i = matches.length - 1; i >= 0; i--) {
    if (fileChanges >= 8) break;

    const match = matches[i];
    const fullMatch = match[0];
    const startIdx = match.index;

    // 跳过 ending
    const contextBefore = content.slice(Math.max(0, startIdx - 600), startIdx);
    if (contextBefore.includes("next: 'ending_")) continue;

    // 已经有 pressure 的不处理
    if (/pressure:/.test(fullMatch)) continue;

    // 提取 label
    const labelMatch = contextBefore.match(/label:\s*([`'"])([\s\S]*?)\1/);
    if (!labelMatch) continue;
    const label = labelMatch[2];

    // 检查是否含减压关键词
    const hasRelief = reliefKeywords.some(kw => label.includes(kw));
    if (!hasRelief) continue;

    // 追加 pressure: -1
    const insertPos = fullMatch.lastIndexOf('}');
    const newEffects = fullMatch.slice(0, insertPos) + ', pressure: -1' + fullMatch.slice(insertPos);

    fileChanges++;
    totalChanges++;

    const nodeIdMatch = content.slice(0, startIdx).match(/(\w+):\s*\{/g);
    const nodeId = nodeIdMatch ? nodeIdMatch[nodeIdMatch.length - 1].replace(/:\s*\{$/, '') : 'unknown';
    changes.push({
      file,
      nodeId,
      label: label.slice(0, 50),
      old: fullMatch,
      new: newEffects
    });

    if (apply) {
      newContent = newContent.slice(0, startIdx) + newEffects + newContent.slice(startIdx + fullMatch.length);
    }
  }

  if (apply && fileChanges > 0) {
    fs.writeFileSync(filePath, newContent, 'utf-8');
  }
}

console.log(`=== T74 pressure 减压渠道 ${dryRun ? '[DRY-RUN]' : apply ? '[APPLIED]' : ''} ===\n`);
console.log(`扫描文件数: ${files.length}`);
console.log(`新增 pressure: -1 数量: ${totalChanges}`);

console.log('\n=== 修改清单（前 50 条）===');
changes.slice(0, 50).forEach((c, i) => {
  console.log(`${i + 1}. ${c.file} / ${c.nodeId}`);
  console.log(`   label: ${c.label}`);
  console.log(`   ${c.old} → ${c.new}`);
});

if (changes.length > 50) {
  console.log(`\n... 还有 ${changes.length - 50} 条未显示`);
}

if (dryRun) {
  console.log('\n这是 dry-run，未修改文件。');
  console.log('确认后运行: node scripts/add-pressure-relief.cjs --apply');
}
