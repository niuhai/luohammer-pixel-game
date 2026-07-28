import { describe, expect, it } from 'vitest';
import {
  incrementRound,
  parseIterationState,
  priorityScore,
  selectNextItem,
  verificationLevelMeets
} from '../../scripts/ui-iteration.mjs';

describe('UI continuous iteration mechanism', () => {
  it('reads the cycle and next round from iteration state', () => {
    expect(parseIterationState('cycle: demo\nround_next: R005\n')).toEqual({
      cycle: 'demo',
      roundNext: 'R005'
    });
  });

  it('prioritizes eligible queued work by impact, confidence and effort', () => {
    const selected = selectNextItem([
      { id: 'done', status: 'done', impact: 5, confidence: 5, effort: 1 },
      { id: 'frozen', status: 'frozen', impact: 5, confidence: 5, effort: 1 },
      { id: 'slow', status: 'queued', impact: 5, confidence: 4, effort: 4 },
      { id: 'best', status: 'queued', impact: 5, confidence: 4, effort: 2 }
    ]);

    expect(selected.id).toBe('best');
    expect(priorityScore(selected)).toBe(10);
  });

  it('does not activate work whose dependencies are incomplete', () => {
    const selected = selectNextItem([
      { id: 'base', status: 'queued', impact: 2, confidence: 2, effort: 2 },
      {
        id: 'blocked',
        status: 'queued',
        impact: 5,
        confidence: 5,
        effort: 1,
        dependsOn: ['base']
      }
    ]);

    expect(selected.id).toBe('base');
  });

  it('increments padded round numbers and compares verification levels', () => {
    expect(incrementRound('R005')).toBe('R006');
    expect(verificationLevelMeets('L3', 'L2')).toBe(true);
    expect(verificationLevelMeets('L1', 'L2')).toBe(false);
  });
});
