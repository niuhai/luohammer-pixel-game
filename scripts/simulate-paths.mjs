/**
 * 全路径属性模拟脚本
 *
 * 目的：验证玩家从初始状态出发，沿不同策略路径走到终章时，
 *      属性实际落在什么范围，能否触达各结局阈值。
 *
 * 策略：
 *   1. 复用 effects.js 的 applyEffects，确保模拟值与游戏内一致
 *   2. 用 BFS/DFS 枚举从 'intro' 出发的所有可达节点路径
 *   3. 因路径数可能爆炸，限制为"贪心策略"模拟：
 *      - 策略A：始终选第 1 个选项（默认路径）
 *      - 策略B：始终选最后 1 个选项（替代路径）
 *      - 策略C：贪心 pride（每节点选 pride 增益最大的选项）
 *      - 策略D：贪心 wealth（每节点选 wealth 增益最大的选项）
 *      - 策略E：贪心 reputation
 *      - 策略F：贪心 balance（选 |各项绝对值和| 最大的选项，模拟"关键选择"）
 *   4. 每条路径记录：经过节点数、终章属性、触发的结局
 *
 * 运行: node scripts/simulate-paths.mjs
 */

import { STORY } from '../src/data/story/index.js';
import { ENDINGS } from '../src/data/endings.js';
import { applyEffects, createInitialState, checkThresholdTriggers, checkComboTriggers, ATTRIBUTES } from '../src/data/effects.js';
import { getStageByNodeId } from '../src/data/stages.js';

// 模拟 check 机制（假设检定总是通过，取 successEffects 和 successNext）
function simulateCheck(choice, state) {
  const check = choice.check;
  const attrValue = state[check.attr] || 0;
  const passed = attrValue >= check.min;
  const effects = passed ? (check.successEffects || {}) : (check.failEffects || {});
  const nextNode = passed ? check.successNext : check.failNext;
  return { effects, nextNode, passed };
}

// 选择策略
const strategies = {
  'A_默认第一项': (choices) => 0,
  'B_末项替代': (choices) => choices.length - 1,
  'C_贪心pride': (choices) => {
    let best = 0, bestVal = -Infinity;
    choices.forEach((c, i) => {
      const v = (c.effects && c.effects.pride) || 0;
      if (v > bestVal) { bestVal = v; best = i; }
    });
    return best;
  },
  'D_贪心wealth': (choices) => {
    let best = 0, bestVal = -Infinity;
    choices.forEach((c, i) => {
      const v = (c.effects && c.effects.wealth) || 0;
      if (v > bestVal) { bestVal = v; best = i; }
    });
    return best;
  },
  'E_贪心reputation': (choices) => {
    let best = 0, bestVal = -Infinity;
    choices.forEach((c, i) => {
      const v = (c.effects && c.effects.reputation) || 0;
      if (v > bestVal) { bestVal = v; best = i; }
    });
    return best;
  },
  'F_关键选择最大化': (choices) => {
    let best = 0, bestVal = -Infinity;
    choices.forEach((c, i) => {
      if (!c.effects) { if (0 > bestVal) { bestVal = 0; best = i; } return; }
      const v = Object.values(c.effects).reduce((s, x) => s + Math.abs(x), 0);
      if (v > bestVal) { bestVal = v; best = i; }
    });
    return best;
  },
  'G_贪心failures': (choices) => {
    let best = 0, bestVal = -Infinity;
    choices.forEach((c, i) => {
      const v = (c.effects && c.effects.failures) || 0;
      if (v > bestVal) { bestVal = v; best = i; }
    });
    return best;
  },
  'H_低pride高wealth': (choices) => {
    let best = 0, bestVal = -Infinity;
    choices.forEach((c, i) => {
      const e = c.effects || {};
      const v = (e.wealth || 0) * 2 - (e.pride || 0);
      if (v > bestVal) { bestVal = v; best = i; }
    });
    return best;
  },
  'I_高pride低wealth': (choices) => {
    let best = 0, bestVal = -Infinity;
    choices.forEach((c, i) => {
      const e = c.effects || {};
      const v = (e.pride || 0) * 2 + (e.failures || 0) - (e.wealth || 0);
      if (v > bestVal) { bestVal = v; best = i; }
    });
    return best;
  },
  'J_随机_种子7': (choices) => Math.floor(Math.random() * choices.length),
  'K_随机_种子42': (choices) => Math.floor(Math.random() * choices.length),
  'L_随机_种子99': (choices) => Math.floor(Math.random() * choices.length),
  // 隐士路径：优先推进到 act7_payback，再退网到 act7_retire，再选 retired
  'M_隐士路径': (choices) => {
    const retiredChoice = choices.find(c => c.flag === 'retired');
    if (retiredChoice) return choices.indexOf(retiredChoice);
    const retireNext = choices.find(c => c.next === 'act7_retire');
    if (retireNext) return choices.indexOf(retireNext);
    const paybackNext = choices.find(c => c.next === 'act7_payback');
    if (paybackNext) return choices.indexOf(paybackNext);
    return 0;
  },
};

// 检查 requires/requiresFlags/maxAttr
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

// 模拟一条路径
function simulatePath(strategyName, choiceFn) {
  let state = createInitialState({});
  const flags = new Set();
  let nodeId = 'intro';
  let steps = 0;
  const maxSteps = 200;
  const pathTrace = [];
  const endingFlags = new Set();

  while (nodeId && steps < maxSteps) {
    const node = STORY[nodeId];
    if (!node) {
      pathTrace.push({ step: steps, nodeId, event: 'NODE_NOT_FOUND' });
      break;
    }

    // 处理 flag consequences（阶段切换时）
    const stage = getStageByNodeId ? getStageByNodeId(nodeId) : null;
    if (stage) {
      // 简化：不重复触发同阶段后果
    }

    // 阈值触发（一次性）
    const triggers = checkThresholdTriggers(state, flags);
    for (const t of triggers) {
      if (t.flag) flags.add(t.flag);
      if (t.effects) {
        const r = applyEffects(state, t.effects);
        state = r.state;
      }
    }

    // 联动触发
    const combo = checkComboTriggers({ ...state, flags });
    if (combo) {
      flags.add(combo.id);
      if (combo.effects) {
        const r = applyEffects(state, combo.effects);
        state = r.state;
      }
    }

    if (!node.choices || node.choices.length === 0) {
      pathTrace.push({ step: steps, nodeId, event: 'NO_CHOICES' });
      break;
    }

    // 过滤可选 choices
    const available = node.choices.filter(c => isChoiceAvailable(c, state, flags));
    if (available.length === 0) {
      pathTrace.push({ step: steps, nodeId, event: 'NO_AVAILABLE_CHOICE' });
      break;
    }

    const idx = choiceFn(available);
    const choice = available[idx];

    // 应用 effects
    const effects = choice.effects || {};
    const r = applyEffects(state, effects);
    state = r.state;

    // 处理 flag
    if (choice.flag) flags.add(choice.flag);

    // 选择后阈值触发（与 GameScene.makeChoice 一致：flag 设置后立即检查阈值事件）
    const postTriggers = checkThresholdTriggers(state, flags);
    for (const t of postTriggers) {
      if (t.flag) flags.add(t.flag);
      if (t.effects) {
        const r2 = applyEffects(state, t.effects);
        state = r2.state;
      }
    }

    // 处理 ending 标记（next 以 ending_ 开头）
    const nextNode = choice.next;
    if (nextNode && nextNode.startsWith('ending_')) {
      endingFlags.add(nextNode);
      pathTrace.push({ step: steps, nodeId, choice: choice.label?.slice(0, 20), event: 'ENDING_BRANCH', nextNode });
      break;
    }

    // 处理 check
    if (choice.check) {
      const checkResult = simulateCheck(choice, state);
      const r2 = applyEffects(state, checkResult.effects);
      state = r2.state;
      nodeId = checkResult.nextNode;
      pathTrace.push({ step: steps, nodeId, choice: choice.label?.slice(0, 20), event: 'CHECK', passed: checkResult.passed });
    } else {
      nodeId = nextNode;
      pathTrace.push({ step: steps, nodeId, choice: choice.label?.slice(0, 20) });
    }

    steps++;
  }

  // 匹配结局
  const matchedEndings = ENDINGS
    .filter(e => {
      try { return e.check(state, flags); } catch (err) { return false; }
    })
    .sort((a, b) => b.priority - a.priority);

  return {
    strategy: strategyName,
    steps,
    finalState: { ...state, flags: [...flags] },
    matchedEnding: matchedEndings[0] || null,
    allMatchedEndings: matchedEndings.map(e => `${e.id}(p${e.priority})`),
    endingBranch: [...endingFlags],
    pathTrace
  };
}

// 主函数
console.log('=== 罗的十字路口 · 全路径属性模拟 ===\n');
console.log(`初始状态: pride=5, wealth=5, reputation=5, failures=0, pressure=0, trust=5\n`);
console.log(`结局阈值参考:`);
ENDINGS.forEach(e => {
  const src = e.check.toString().slice(0, 80);
  console.log(`  [${e.priority}] ${e.id.padEnd(20)} ${src}`);
});
console.log('');

const results = [];
for (const [name, fn] of Object.entries(strategies)) {
  console.log(`--- 运行策略: ${name} ---`);
  try {
    const r = simulatePath(name, fn);
    results.push(r);
    const s = r.finalState;
    console.log(`  步数: ${r.steps}`);
    console.log(`  最终属性: pride=${s.pride} wealth=${s.wealth} rep=${s.reputation} fail=${s.failures} pressure=${s.pressure} trust=${s.trust}`);
    console.log(`  结局分支: ${r.endingBranch.length ? r.endingBranch.join(',') : '(无 - 走到 final 由 matchEnding 判定)'}`);
    console.log(`  匹配结局: ${r.matchedEnding ? r.matchedEnding.id + ' (' + r.matchedEnding.name + ')' : '【无任何结局匹配】'}`);
    if (r.allMatchedEndings.length > 1) {
      console.log(`  全部匹配: ${r.allMatchedEndings.join(' | ')}`);
    }
    console.log('');
  } catch (err) {
    console.log(`  模拟出错: ${err.message}\n${err.stack}\n`);
  }
}

// 汇总
console.log('=== 汇总 ===');
console.log('策略'.padEnd(20) + 'pride'.padStart(6) + 'wealth'.padStart(6) + 'rep'.padStart(6) + 'fail'.padStart(6) + 'pres'.padStart(6) + 'trust'.padStart(6) + '  结局');
results.forEach(r => {
  const s = r.finalState;
  console.log(
    r.strategy.padEnd(20) +
    String(s.pride).padStart(6) +
    String(s.wealth).padStart(6) +
    String(s.reputation).padStart(6) +
    String(s.failures).padStart(6) +
    String(s.pressure).padStart(6) +
    String(s.trust).padStart(6) +
    '  ' + (r.matchedEnding ? r.matchedEnding.id : 'NONE')
  );
});

// 阈值差距分析
console.log('\n=== 阈值差距分析（最接近但未达成的结局）===');
results.forEach(r => {
  const s = r.finalState;
  const gaps = [];
  ENDINGS.forEach(e => {
    if (r.allMatchedEndings.includes(e.id + '(p' + e.priority + ')')) return;
    // 简化：检查属性类条件（不含 flags）
    const src = e.check.toString();
    const attrChecks = [];
    const m = src.match(/state\.(\w+)\s*([<>=!]+)\s*(\d+)/g);
    if (m) {
      m.forEach(match => {
        const mm = match.match(/state\.(\w+)\s*([<>=!]+)\s*(\d+)/);
        if (mm) attrChecks.push({ attr: mm[1], op: mm[2], target: parseInt(mm[3]) });
      });
    }
    // 找差距最小的属性
    let minGap = Infinity;
    let gapInfo = null;
    attrChecks.forEach(c => {
      const cur = s[c.attr] || 0;
      if (c.op.includes('>') && cur < c.target) {
        const gap = c.target - cur;
        if (gap < minGap) { minGap = gap; gapInfo = `${c.attr} ${cur}/${c.target} (差${gap})`; }
      }
      if (c.op.includes('<') && cur > c.target) {
        const gap = cur - c.target;
        if (gap < minGap) { minGap = gap; gapInfo = `${c.attr} ${cur}/${c.target} (超${gap})`; }
      }
    });
    if (gapInfo && minGap <= 3) {
      gaps.push(`  ${e.id}: ${gapInfo}`);
    }
  });
  if (gaps.length) {
    console.log(`\n[${r.strategy}] 最接近的未达成结局:`);
    gaps.slice(0, 3).forEach(g => console.log(g));
  }
});
