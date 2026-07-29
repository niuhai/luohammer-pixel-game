import { describe, expect, it } from 'vitest';
import {
  incrementRound,
  parseSettlementArgs,
  parseIterationState,
  parseVerificationCost,
  priorityScore,
  selectNextItem,
  settleRunRecord,
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

  it('settles the authoritative round state instead of leaving stale markers', () => {
    const settlement = parseSettlementArgs([
      '--outcome=IMPROVED',
      '--value=V2',
      '--evidence-grade=E1',
      '--guardrails=PASS',
      '--counterevidence=尚无真实目标用户数据',
      '--capability-delta=SEED：新增结构化结算断言',
      '--verification-cost=6m',
      '--decision=CONTINUE',
      '--summary=结算字段现在由机器强制'
    ]);
    const settled = settleRunRecord(
      '# R005\n\n- 状态：ACTIVE\n\n## 结算\n\n- Outcome：PENDING\n',
      {
        ...settlement,
        automationEvidence: '.iteration/ui/evidence/R005-verify.json',
        visualEvidence: ['.iteration/ui/evidence/R005/after.png'],
        closedAt: '2026-07-29T00:00:00.000Z'
      }
    );
    expect(settled).toContain('- 状态：CLOSED');
    expect(settled).toContain('- Outcome：IMPROVED');
    expect(settled).toContain('- 价值结算：V2');
    expect(settled).toContain('- 证据等级：E1');
    expect(settled).toContain('- 关键护栏：PASS');
    expect(settled).toContain('- 验证成本：360s');
    expect(settled).not.toContain('ACTIVE');
    expect(settled).not.toContain('PENDING');
  });

  it('normalizes verification cost into seconds', () => {
    expect(parseVerificationCost('90s')).toBe(90);
    expect(parseVerificationCost('6m')).toBe(360);
    expect(parseVerificationCost('1.5h')).toBe(5400);
  });

  it('rejects incomplete, contradictory or inflated settlements', () => {
    const base = [
      '--outcome=IMPROVED',
      '--value=V2',
      '--evidence-grade=E1',
      '--guardrails=PASS',
      '--counterevidence=尚无真实目标用户数据',
      '--capability-delta=NONE：本轮只有一次性结果',
      '--verification-cost=6m',
      '--decision=CONTINUE',
      '--summary=有效改善'
    ];

    expect(() => parseSettlementArgs(
      base.filter(arg => !arg.startsWith('--counterevidence='))
    )).toThrow('counterevidence');
    expect(() => parseSettlementArgs(
      base.map(arg => arg === '--guardrails=PASS' ? '--guardrails=FAIL' : arg)
    )).toThrow('关键护栏 PASS');
    expect(() => parseSettlementArgs(
      base.map(arg => arg === '--value=V2' ? '--value=V3' : arg)
    )).toThrow('V3 必须由 E2');
    expect(() => parseSettlementArgs(
      base.map(arg => arg === '--capability-delta=NONE：本轮只有一次性结果'
        ? '--capability-delta=新增了一个测试'
        : arg)
    )).toThrow('SEED/PROVEN/COMPOUNDING/NONE');
  });
});
