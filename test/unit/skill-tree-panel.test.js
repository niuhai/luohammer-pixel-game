import { beforeEach, describe, expect, it } from 'vitest';
import { ALL_SKILLS } from '../../src/data/skillTree.js';
import { MetaProgression } from '../../src/systems/MetaProgression.js';
import {
  getSkillPurchaseState,
  getSkillTreeOpportunity
} from '../../src/ui/SkillTreePanel.js';

const skill = skillId => ALL_SKILLS.find(candidate => candidate.id === skillId);

beforeEach(() => {
  localStorage.clear();
});

describe('SkillTreePanel - 技能购买状态说明', () => {
  it('区分经验不足与可解锁，并显示消费后的余额', () => {
    const meta = new MetaProgression();

    expect(getSkillPurchaseState(meta, skill('tough_mind'))).toMatchObject({
      kind: 'insufficient',
      label: '还差 1 EXP',
      reason: '需要 1 EXP · 当前 0 EXP'
    });

    meta.addExp(3);
    expect(getSkillPurchaseState(meta, skill('tough_mind'))).toMatchObject({
      kind: 'available',
      label: '可解锁 · 1 EXP',
      reason: '解锁后剩余 2 EXP',
      available: true
    });
  });

  it('解释未满足的前置技能', () => {
    const meta = new MetaProgression();
    meta.addExp(10);

    expect(getSkillPurchaseState(meta, skill('iron_will'))).toMatchObject({
      kind: 'prerequisite',
      label: '前置未满足',
      reason: '需先解锁「抗压体质」'
    });
  });

  it('解释已解锁与互斥分支锁定状态', () => {
    const meta = new MetaProgression();
    meta.unlockSkill('tough_mind');
    meta.unlockSkill('iron_will');
    meta.unlockSkill('phoenix');
    meta.unlockSkill('survival_instinct');

    expect(getSkillPurchaseState(meta, skill('survival_instinct'))).toMatchObject({
      kind: 'unlocked',
      label: '已解锁',
      reason: '永久生效'
    });
    expect(getSkillPurchaseState(meta, skill('mountain_calm'))).toMatchObject({
      kind: 'excluded',
      label: '分支已锁',
      reason: '已选择「绝境逢生」'
    });
  });

  it('汇总结局页当前可购买数量与最近的经验差额', () => {
    const meta = new MetaProgression();
    expect(getSkillTreeOpportunity(meta)).toMatchObject({
      kind: 'insufficient',
      count: 0,
      title: '距离下一项还差 1 EXP',
      detail: '下一项「抗压体质」需要 1 EXP'
    });

    meta.unlockSkill('tough_mind');
    meta.unlockSkill('iron_will');
    meta.unlockSkill('phoenix');
    meta.addExp(5);
    expect(getSkillTreeOpportunity(meta)).toMatchObject({
      kind: 'available',
      count: 5,
      title: '5 项技能可解锁',
      detail: '可从「绝境逢生」开始'
    });
  });
});
