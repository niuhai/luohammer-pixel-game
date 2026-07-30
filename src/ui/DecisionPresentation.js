export const DECISION_STAT_LABELS = Object.freeze({
  pride: '理想',
  wealth: '财富',
  reputation: '名声',
  failures: '翻车',
  pressure: '压力',
  trust: '信任'
});

const COST_STATS = new Set(['failures', 'pressure']);

export function escapeDecisionText(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function describeDecisionEffects(effects = {}, options = {}) {
  const { directionOnly = false } = options;
  return Object.entries(effects)
    .filter(([, value]) => typeof value === 'number' && value !== 0)
    .map(([key, value]) => {
      const label = DECISION_STAT_LABELS[key] || key;
      const beneficial = COST_STATS.has(key) ? value < 0 : value > 0;
      return {
        key,
        label,
        value,
        beneficial,
        tone: beneficial ? 'positive' : 'negative',
        direction: value > 0 ? 'up' : 'down',
        text: directionOnly
          ? `${label}${value > 0 ? '↑' : '↓'}`
          : `${label} ${value > 0 ? '+' : ''}${value}`
      };
    });
}

export function summarizeDecisionEffects(effects = {}, options = {}) {
  return describeDecisionEffects(effects, options)
    .map(effect => effect.text)
    .join(' · ');
}

export function buildCheckSnapshot(check, state = {}) {
  const rawValue = Number(state[check.attr]) || 0;
  const bonusSources = [];

  if (state._reputationCheckBonus && (Number(state.reputation) || 0) >= 7) {
    bonusSources.push({
      label: '一呼百应',
      value: Number(state._reputationCheckBonus) || 0
    });
  }
  if (
    Array.isArray(state.talentSpecials) &&
    state.talentSpecials.includes('trust_check_bonus') &&
    (Number(state.trust) || 0) >= 5
  ) {
    bonusSources.push({ label: '人脉编织者', value: 1 });
  }
  if (state._achievementHunter) {
    bonusSources.push({ label: '成就猎人', value: 1 });
  }

  const bonus = bonusSources.reduce((total, source) => total + source.value, 0);
  const value = rawValue + bonus;
  const target = Number(check.min) || 0;
  return {
    attr: check.attr,
    attrLabel: DECISION_STAT_LABELS[check.attr] || check.attr,
    rawValue,
    bonus,
    bonusSources,
    value,
    target,
    passed: value >= target,
    gap: Math.max(0, target - value)
  };
}

export function buildCheckOutcomePreview(check = {}) {
  return {
    success: summarizeDecisionEffects(check.successEffects, { directionOnly: true }),
    fail: summarizeDecisionEffects(check.failEffects, { directionOnly: true })
  };
}

function classifyVisibleEffects(effects = {}) {
  const described = describeDecisionEffects(effects);
  const hasBenefit = described.some(effect => effect.beneficial);
  const hasCost = described.some(effect => !effect.beneficial);
  if (hasBenefit && hasCost) return 'mixed';
  if (hasBenefit) return 'good';
  if (hasCost) return 'bad';
  return 'unknown';
}

const ALIGNMENT_RESULT_LABELS = Object.freeze({
  good: '向好',
  bad: '向坏',
  mixed: '有得有失',
  unknown: '走向未明'
});

/**
 * 以玩家当前可见的数值信息判断选择方向。
 * 不把收益与代价抵消称为“中性”，也不把无数据称为确定结论。
 */
export function buildChoiceAlignmentInsight(choice = {}) {
  if (choice.check) {
    const successType = classifyVisibleEffects(choice.check.successEffects);
    const failType = classifyVisibleEffects(choice.check.failEffects);
    return {
      type: 'split',
      label: '检定分叉',
      basis: `成功${ALIGNMENT_RESULT_LABELS[successType]} · 失败${ALIGNMENT_RESULT_LABELS[failType]}`,
      scope: '仅据可见结果'
    };
  }

  const type = classifyVisibleEffects(choice.effects);
  if (type === 'good') {
    return {
      type,
      label: ALIGNMENT_RESULT_LABELS[type],
      basis: '当前只有可见收益',
      scope: '仅据即时数值'
    };
  }
  if (type === 'bad') {
    return {
      type,
      label: ALIGNMENT_RESULT_LABELS[type],
      basis: '当前只有可见代价',
      scope: '仅据即时数值'
    };
  }
  if (type === 'mixed') {
    return {
      type,
      label: ALIGNMENT_RESULT_LABELS[type],
      basis: '可见收益与代价并存',
      scope: '仅据即时数值'
    };
  }
  return {
    type,
    label: ALIGNMENT_RESULT_LABELS[type],
    basis: '没有可见的即时数值',
    scope: '叙事后果仍未知'
  };
}
