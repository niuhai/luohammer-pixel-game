import { describe, expect, test } from 'vitest';
import { resolveStageAwarePose } from '../../src/systems/CharacterPoseResolver.js';

describe('resolveStageAwarePose', () => {
  test('少年期始终使用少年立绘', () => {
    expect(resolveStageAwarePose('youth', 'angry', 'sitting')).toBe('young');
    expect(resolveStageAwarePose('youth', 'depressed', 'standing')).toBe('young');
  });

  test('新东方和创业期保留同年龄组内的动作与情绪', () => {
    expect(resolveStageAwarePose('teacher', 'angry', 'speaking')).toBe('angry');
    expect(resolveStageAwarePose('startup', 'happy', 'standing')).toBe('happy');
    expect(resolveStageAwarePose('startup', null, 'sitting')).toBe('sitting');
  });

  test('舞台期收到成熟期情绪时回退到同年龄场景姿态', () => {
    expect(resolveStageAwarePose('teacher', 'depressed', 'speaking')).toBe('speaking');
    expect(resolveStageAwarePose('startup', 'livestream', 'middle')).toBe('standing');
  });

  test('成熟期仅使用成熟年龄组立绘', () => {
    expect(resolveStageAwarePose('dark', 'depressed', 'standing')).toBe('depressed');
    expect(resolveStageAwarePose('repay', 'livestream', 'sitting')).toBe('livestream');
    expect(resolveStageAwarePose('reborn', 'happy', 'speaking')).toBe('middle');
  });

  test('未知阶段保持有效请求并安全处理无效姿态', () => {
    expect(resolveStageAwarePose(undefined, 'angry', 'standing')).toBe('angry');
    expect(resolveStageAwarePose(undefined, 'excited', 'sitting')).toBe('sitting');
    expect(resolveStageAwarePose(undefined, null, 'missing')).toBe('standing');
  });
});
