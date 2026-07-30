import { describe, expect, it } from 'vitest';
import { calculateExpGain } from '../../src/data/skillTree.js';

const endingState = {
  currentNode: 'ending_scholar',
  progress: 95,
  achievements: []
};

describe('技能树 EXP 结算', () => {
  it('使用场景已判定的新结局状态发放首次结局奖励', () => {
    expect(calculateExpGain(endingState, {
      id: 'ending_scholar',
      isNew: true
    })).toBe(4);
    expect(calculateExpGain(endingState, {
      id: 'ending_scholar',
      isNew: false
    })).toBe(3);
  });

  it('兼容旧调用方式中的 seenEndings 判断', () => {
    expect(calculateExpGain({
      ...endingState,
      seenEndings: []
    }, {
      id: 'ending_scholar'
    })).toBe(4);
    expect(calculateExpGain({
      ...endingState,
      seenEndings: ['ending_scholar']
    }, {
      id: 'ending_scholar'
    })).toBe(3);
  });
});
