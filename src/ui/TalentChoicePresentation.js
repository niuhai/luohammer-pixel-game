import { DECISION_STAT_LABELS } from './DecisionPresentation.js';

const WELL_CONNECTED_EFFECTS = Object.freeze({
  trust: 1,
  pressure: 1
});

function hasOwnEntries(value) {
  return Boolean(value && typeof value === 'object' && Object.keys(value).length > 0);
}

function hasDecisionGate(choice) {
  return Boolean(
    choice?.check ||
    hasOwnEntries(choice?.requires) ||
    hasOwnEntries(choice?.maxAttr) ||
    Array.isArray(choice?.requiresFlags) && choice.requiresFlags.length > 0
  );
}

function meetsDecisionGate(choice, state) {
  for (const [key, minimum] of Object.entries(choice?.requires || {})) {
    if (Number(state?.[key] || 0) < Number(minimum)) return false;
  }
  for (const [key, maximum] of Object.entries(choice?.maxAttr || {})) {
    if (Number(state?.[key] || 0) > Number(maximum)) return false;
  }
  const flags = state?.flags instanceof Set
    ? state.flags
    : new Set(Array.isArray(state?.flags) ? state.flags : []);
  return (choice?.requiresFlags || []).every(flag => flags.has(flag));
}

function normalizeRouteLabel(label, maximumLength = 24) {
  const normalized = String(label || '')
    .replace(/[“”"'「」]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (normalized.length <= maximumLength) return normalized;
  return `${normalized.slice(0, maximumLength - 1)}…`;
}

function describeAvoidedRisk(choices, state) {
  const checkChoice = choices.find(choice => choice?.check);
  if (checkChoice) {
    const attr = checkChoice.check.attr;
    return `${DECISION_STAT_LABELS[attr] || attr || '属性'}检定`;
  }

  const gatedChoice = choices.find(choice =>
    hasDecisionGate(choice) && !meetsDecisionGate(choice, state)
  );
  if (gatedChoice?.requires) {
    const [attr] = Object.keys(gatedChoice.requires);
    return `${DECISION_STAT_LABELS[attr] || attr || '属性'}门槛`;
  }
  if (gatedChoice?.maxAttr) {
    const [attr] = Object.keys(gatedChoice.maxAttr);
    return `${DECISION_STAT_LABELS[attr] || attr || '属性'}上限`;
  }
  if (gatedChoice?.requiresFlags?.length) return '经历门槛';
  return '高风险路线';
}

/**
 * 为“八面玲珑”构建一条可解释、可安全跳转的协商路径。
 *
 * 只有原选择包含检定或门槛，且存在当前可用的非检定出口时才注入。
 * 这样既兑现“关键节点多一个选择”，也不会生成 next 缺失的死路。
 */
export function buildWellConnectedChoice(choices, state = {}, context = {}) {
  if (!Array.isArray(choices) || !choices.some(hasDecisionGate)) return null;

  const fallback = choices.find(choice =>
    choice?.next &&
    !choice.check &&
    meetsDecisionGate(choice, state)
  );
  if (!fallback) return null;

  const avoidedRisk = describeAvoidedRisk(choices, state);
  const routeLabel = normalizeRouteLabel(fallback.label);
  return {
    label: '以圆滑方式应对，留有余地',
    next: fallback.next,
    effects: { ...WELL_CONNECTED_EFFECTS },
    talentChoice: {
      id: 'well_connected',
      name: '八面玲珑',
      kind: '协商路径',
      context: String(context.context || '').trim(),
      avoidedRisk,
      routeLabel,
      route: `避开${avoidedRisk} · 沿「${routeLabel}」继续`,
      benefit: '信任 +1',
      tradeoff: '压力 +1'
    }
  };
}
