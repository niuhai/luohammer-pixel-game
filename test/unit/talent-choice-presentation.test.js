import { describe, expect, it } from 'vitest';
import { STORY } from '../../src/data/story.js';
import { buildWellConnectedChoice } from '../../src/ui/TalentChoicePresentation.js';

describe('八面玲珑协商路径', () => {
  const state = {
    reputation: 4,
    trust: 5,
    pressure: 8,
    flags: new Set()
  };

  it('只在有检定或门槛的关键抉择中生成技能路径', () => {
    const ordinary = [
      { label: '继续听', next: 'listen' },
      { label: '结束谈话', next: 'leave' }
    ];
    expect(buildWellConnectedChoice(ordinary, state)).toBeNull();

    const critical = [
      {
        label: '公开承诺',
        check: { attr: 'reputation', min: 7, successNext: 'yes', failNext: 'no' }
      },
      { label: '“先争取三个月缓冲，再按比例还款”', next: 'installment' }
    ];
    const result = buildWellConnectedChoice(critical, state, {
      context: '供应商围堵'
    });

    expect(result).toMatchObject({
      label: '以圆滑方式应对，留有余地',
      next: 'installment',
      effects: { trust: 1, pressure: 1 },
      talentChoice: {
        id: 'well_connected',
        name: '八面玲珑',
        context: '供应商围堵',
        avoidedRisk: '名声检定',
        routeLabel: '先争取三个月缓冲，再按比例还款',
        benefit: '信任 +1',
        tradeoff: '压力 +1'
      }
    });
    expect(result.talentChoice.route).toContain('避开名声检定');
  });

  it('没有当前可用的非检定出口时不生成死路', () => {
    const choices = [
      {
        label: '接受检定',
        check: { attr: 'trust', min: 6, successNext: 'yes', failNext: 'no' }
      },
      {
        label: '尚未解锁的出口',
        next: 'locked',
        requires: { reputation: 8 }
      }
    ];

    expect(buildWellConnectedChoice(choices, state)).toBeNull();
  });

  it('跳过不可用出口并沿第一个安全分支继续', () => {
    const choices = [
      { label: '高压检定', check: { attr: 'pressure', min: 3 } },
      { label: '锁定路线', next: 'locked', requiresFlags: ['missing'] },
      { label: '可用路线', next: 'safe' }
    ];

    const result = buildWellConnectedChoice(choices, state);
    expect(result.next).toBe('safe');
    expect(result.talentChoice.route).toContain('可用路线');
  });

  it('对完整故事只缩小到关键节点且每条生成结果都有明确去向', () => {
    const nodesWithChoices = Object.values(STORY).filter(node => node.choices?.length);
    const generated = nodesWithChoices
      .map(node => buildWellConnectedChoice(node.choices, state, { context: node.actSub }))
      .filter(Boolean);

    expect(generated.length).toBeGreaterThan(0);
    expect(generated.length).toBeLessThan(nodesWithChoices.length);
    expect(generated.every(choice =>
      typeof choice.next === 'string' && choice.next.length > 0
    )).toBe(true);
  });
});
