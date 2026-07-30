import { describe, expect, it } from 'vitest';
import {
  buildChoiceAlignmentInsight,
  buildCheckOutcomePreview,
  buildCheckSnapshot,
  describeDecisionEffects,
  escapeDecisionText,
  summarizeDecisionEffects
} from '../../src/ui/DecisionPresentation.js';

describe('DecisionPresentation', () => {
  it('用方向和收益语义统一表达属性变化', () => {
    const effects = describeDecisionEffects({
      pride: 2,
      wealth: -1,
      pressure: -2,
      failures: 1
    });

    expect(effects.map(effect => effect.text)).toEqual([
      '理想 +2',
      '财富 -1',
      '压力 -2',
      '翻车 +1'
    ]);
    expect(effects.map(effect => effect.tone)).toEqual([
      'positive',
      'negative',
      'positive',
      'negative'
    ]);
    expect(summarizeDecisionEffects(
      { reputation: 2, pressure: 3 },
      { directionOnly: true }
    )).toBe('名声↑ · 压力↑');
  });

  it('检定预览与实际加成共用同一份确定性计算', () => {
    const snapshot = buildCheckSnapshot(
      { attr: 'reputation', min: 9 },
      {
        reputation: 7,
        trust: 5,
        _reputationCheckBonus: 1,
        talentSpecials: ['trust_check_bonus'],
        _achievementHunter: true
      }
    );

    expect(snapshot).toMatchObject({
      rawValue: 7,
      bonus: 3,
      value: 10,
      target: 9,
      passed: true,
      gap: 0
    });
    expect(snapshot.bonusSources.map(source => source.label)).toEqual([
      '一呼百应',
      '人脉编织者',
      '成就猎人'
    ]);
  });

  it('结果预览不再伪造概率，并安全转义叙事文本', () => {
    expect(buildCheckOutcomePreview({
      successEffects: { trust: 1 },
      failEffects: { reputation: -2, pressure: 3 }
    })).toEqual({
      success: '信任↑',
      fail: '名声↓ · 压力↑'
    });
    expect(escapeDecisionText('<img onerror="x">&')).toBe(
      '&lt;img onerror=&quot;x&quot;&gt;&amp;'
    );
  });

  it('把可见收益、代价、未知和检定分叉分开表达', () => {
    expect(buildChoiceAlignmentInsight({
      effects: { trust: 2, pressure: -1 }
    })).toMatchObject({
      type: 'good',
      label: '向好',
      basis: '当前只有可见收益'
    });
    expect(buildChoiceAlignmentInsight({
      effects: { trust: 2, pressure: 2 }
    })).toMatchObject({
      type: 'mixed',
      label: '有得有失',
      basis: '可见收益与代价并存'
    });
    expect(buildChoiceAlignmentInsight({ flag: 'future_story' })).toMatchObject({
      type: 'unknown',
      label: '走向未明',
      basis: '没有可见的即时数值'
    });
    expect(buildChoiceAlignmentInsight({
      check: {
        successEffects: { trust: 2 },
        failEffects: { reputation: -2, pressure: 2 }
      }
    })).toEqual({
      type: 'split',
      label: '检定分叉',
      basis: '成功向好 · 失败向坏',
      scope: '仅据可见结果'
    });
  });
});
