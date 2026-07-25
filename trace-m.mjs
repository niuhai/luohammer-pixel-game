import { STORY } from './src/data/story/index.js';
import { ENDINGS } from './src/data/endings.js';
import { applyEffects, createInitialState, checkThresholdTriggers, checkComboTriggers, ATTRIBUTES } from './src/data/effects.js';

function simulateCheck(choice, state) {
  const check = choice.check;
  const attrValue = state[check.attr] || 0;
  const passed = attrValue >= check.min;
  const effects = passed ? (check.successEffects || {}) : (check.failEffects || {});
  const nextNode = passed ? check.successNext : check.failNext;
  return { effects, nextNode, passed };
}

function isChoiceAvailable(choice, state, flags) {
  if (choice.requires) { for (const [k, v] of Object.entries(choice.requires)) { if ((state[k] || 0) < v) return false; } }
  if (choice.requiresFlags) { for (const f of choice.requiresFlags) { if (!flags.has(f)) return false; } }
  if (choice.maxAttr) { for (const [k, v] of Object.entries(choice.maxAttr)) { if ((state[k] || 0) > v) return false; } }
  return true;
}

const mStrategy = (choices) => {
  const retiredChoice = choices.find(c => c.flag === 'retired');
  if (retiredChoice) return choices.indexOf(retiredChoice);
  const retireNext = choices.find(c => c.next === 'act7_retire');
  if (retireNext) return choices.indexOf(retireNext);
  const paybackNext = choices.find(c => c.next === 'act7_payback');
  if (paybackNext) return choices.indexOf(paybackNext);
  // 排除直接结束游戏的选项，避免提前离场（retired 除外已在上面处理）
  const nonEnding = choices.filter(c => !c.next || !c.next.startsWith('ending_'));
  const pool = nonEnding.length > 0 ? nonEnding : choices;
  // 优先选 pride 降低选项（确保抵达 act7_retire 时 pride<=5，retired 选项可选）
  const prideReduceChoice = pool.find(c => (c.effects && (c.effects.pride || 0) < 0));
  if (prideReduceChoice) return choices.indexOf(prideReduceChoice);
  // 主动选 pressure 降低选项
  const pressureReduceChoice = pool.find(c => (c.effects && (c.effects.pressure || 0) < 0));
  if (pressureReduceChoice) return choices.indexOf(pressureReduceChoice);
  // 默认选第一个非结束选项
  return choices.indexOf(pool[0]);
};

let state = createInitialState({});
const flags = new Set();
let nodeId = 'intro';
let steps = 0;
const maxSteps = 200;
const visitedNodes = new Set();
const seenStates = new Map();

while (nodeId && steps < maxSteps) {
  const node = STORY[nodeId];
  if (!node) { console.log('NODE_NOT_FOUND:' + nodeId); break; }
  const stateSignature = [nodeId, ...Object.keys(ATTRIBUTES).sort().map(key => key + ':' + (state[key] ?? 0)), 'flags:' + [...flags].sort().join(',')].join('|');
  if (seenStates.has(stateSignature)) { console.log('LOOP at step ' + steps + ' node ' + nodeId); break; }
  seenStates.set(stateSignature, steps);
  visitedNodes.add(nodeId);

  const triggers = checkThresholdTriggers(state, flags);
  for (const t of triggers) { if (t.flag) flags.add(t.flag); if (t.effects) { const r = applyEffects(state, t.effects); state = r.state; } }
  const combo = checkComboTriggers({ ...state, flags });
  if (combo) { flags.add(combo.id); if (combo.effects) { const r = applyEffects(state, combo.effects); state = r.state; } }

  if (!node.choices || node.choices.length === 0) { console.log('NO_CHOICES at ' + nodeId + ' step ' + steps); break; }
  let available = node.choices.filter(c => isChoiceAvailable(c, state, flags));
  if (available.length === 0) { console.log('NO_AVAILABLE_CHOICE at ' + nodeId + ' step ' + steps); break; }
  const unvisitedAvailable = available.filter(choice => choice.allowRepeat || !choice.next || !visitedNodes.has(choice.next));
  if (unvisitedAvailable.length > 0) available = unvisitedAvailable;

  const idx = mStrategy(available);
  const choice = available[idx];
  const choiceLabel = choice.label ? choice.label.slice(0, 50) : '(no label)';
  console.log('[' + steps + '] ' + nodeId + ' -> ' + choice.next + ' | ' + choiceLabel);

  const effects = choice.effects || {};
  const r = applyEffects(state, effects);
  state = r.state;
  if (choice.flag) flags.add(choice.flag);
  const postTriggers = checkThresholdTriggers(state, flags);
  for (const t of postTriggers) { if (t.flag) flags.add(t.flag); if (t.effects) { const r2 = applyEffects(state, t.effects); state = r2.state; } }

  const nextNode = choice.next;
  if (nextNode && nextNode.startsWith('ending_')) { console.log('ENDING_BRANCH: ' + nextNode + ' state:' + JSON.stringify({ pride: state.pride, wealth: state.wealth, pressure: state.pressure, flags: [...flags] })); break; }
  if (choice.check) { const cr = simulateCheck(choice, state); const r2 = applyEffects(state, cr.effects); state = r2.state; nodeId = cr.nextNode; }
  else { nodeId = nextNode; }
  steps++;
}
console.log('FINAL: pride=' + state.pride + ' wealth=' + state.wealth + ' rep=' + state.reputation + ' pressure=' + state.pressure + ' trust=' + state.trust + ' flags:' + [...flags].join(','));
const matched = ENDINGS.filter(e => { try { return e.check(state, flags); } catch (err) { return false; } }).sort((a, b) => b.priority - a.priority);
console.log('MATCHED: ' + matched.map(e => e.id + '(p' + e.priority + ')').join(', '));
