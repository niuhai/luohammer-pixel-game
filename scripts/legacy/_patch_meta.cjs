// 临时补丁脚本：为 MetaProgression.js 添加结局触发统计方法
const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'src', 'systems', 'MetaProgression.js');
let src = fs.readFileSync(file, 'utf8');
const before = src;

function replaceOnce(label, find, insert, where = 'after') {
  if (src.indexOf(find) === -1) {
    throw new Error(`[PATCH] 找不到锚点: ${label}\n  锚点: ${JSON.stringify(find).slice(0, 120)}`);
  }
  if (where === 'after') {
    src = src.replace(find, find + insert);
  } else if (where === 'before') {
    src = src.replace(find, insert + find);
  } else if (where === 'replace') {
    src = src.replace(find, insert);
  }
  console.log('  [OK] ' + label);
}

// 在 STORAGE_KEY 定义之后添加结局统计的 localStorage key
replaceOnce(
  'add ending stats key',
  "const STORAGE_KEY = 'luohammer_meta_progress';",
  "\nconst ENDING_STATS_KEY = 'luohammer_ending_stats';"
);

// 在 reset() 方法之前添加 getEndingStats 和 recordEndingStat 方法
const newMethods = `
  // === 结局触发统计（调试用） ===
  /**
   * 获取各结局的触发次数统计
   * 数据持久化在 localStorage（key: luohammer_ending_stats）
   * @returns {Object<string, number>} { endingId: count, ... }
   */
  getEndingStats() {
    try {
      const raw = localStorage.getItem(ENDING_STATS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          return parsed;
        }
      }
    } catch (e) {}
    return {};
  }

  /**
   * 记录一次结局触发（次数 +1）
   * @param {string} endingId - 结局ID
   */
  recordEndingStat(endingId) {
    if (!endingId) return;
    const stats = this.getEndingStats();
    stats[endingId] = (stats[endingId] || 0) + 1;
    try {
      localStorage.setItem(ENDING_STATS_KEY, JSON.stringify(stats));
    } catch (e) {}
  }

  /**
   * 清空结局触发统计（调试用）
   */
  clearEndingStats() {
    try {
      localStorage.removeItem(ENDING_STATS_KEY);
    } catch (e) {}
  }

`;

replaceOnce(
  'add ending stats methods',
  '  /**\n   * 重置所有进度（调试用）\n   */\n  reset() {',
  newMethods,
  'before'
);

if (src === before) {
  throw new Error('[PATCH] 未发生任何替换');
}

fs.writeFileSync(file, src, 'utf8');
console.log('[PATCH] MetaProgression.js 修改完成');
