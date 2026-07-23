// AI 人生复盘系统：本地引擎模式匹配 + 兜底不抛错
import { describe, it, expect } from 'vitest';
import { AIReviewSystem } from '../../src/systems/AIReviewSystem.js';

const mkState = (over = {}) => ({
  pride: 5, wealth: 5, reputation: 5, failures: 1, pressure: 3, trust: 5,
  history: [], ...over
});
const mkEnding = () => ({ title: '★ 传奇·天生骄傲的理想主义者', desc: 'd', quote: 'q', summary: 's' });

describe('AIReviewSystem 本地复盘引擎', () => {
  it('无 API Key 时使用本地引擎且 source=local', async () => {
    const sys = new AIReviewSystem({ state: mkState(), ending: mkEnding(), endingKey: 'legend' });
    expect(sys.isLLMEnabled).toBe(false);
    const { text, source } = await sys.generate();
    expect(source).toBe('local');
    expect(text.length).toBeGreaterThan(30);
  });

  it('高理想+多翻车 → 理想战士模式', async () => {
    const sys = new AIReviewSystem({ state: mkState({ pride: 8, failures: 3 }), ending: mkEnding(), endingKey: 'warrior' });
    const { text } = await sys.generate();
    expect(text).toContain('不妥协');
  });

  it('高财富+低理想 → 务实富人模式', async () => {
    const sys = new AIReviewSystem({ state: mkState({ pride: 2, wealth: 8 }), ending: mkEnding(), endingKey: 'tycoon' });
    const { text } = await sys.generate();
    expect(text).toContain('没有被理想饿死');
  });

  it('压力爆表 → 崩溃模式', async () => {
    const sys = new AIReviewSystem({ state: mkState({ pressure: 9 }), ending: mkEnding(), endingKey: 'default' });
    const { text } = await sys.generate();
    expect(text).toContain('稻草');
  });

  it('平衡属性 → 平衡模式', async () => {
    const sys = new AIReviewSystem({ state: mkState({ pride: 5, wealth: 5, reputation: 5, trust: 5 }), ending: mkEnding(), endingKey: 'balance' });
    const { text } = await sys.generate();
    expect(text).toContain('平衡');
  });

  it('空 state / 缺字段也不抛错', async () => {
    const sys = new AIReviewSystem({ state: {}, ending: {}, endingKey: 'unknown_ending' });
    const { text, source } = await sys.generate();
    expect(source).toBe('local');
    expect(text.length).toBeGreaterThan(10);
  });

  it('结尾收束：高理想给"别弄丢"金句', async () => {
    const sys = new AIReviewSystem({ state: mkState({ pride: 8, failures: 2 }), ending: mkEnding(), endingKey: 'legend' });
    const { text } = await sys.generate();
    expect(text).toContain('十字路口');
  });
});
