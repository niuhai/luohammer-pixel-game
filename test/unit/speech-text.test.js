import { describe, expect, it } from 'vitest';
import {
  extractSpeechHighlights,
  normalizeSpeechText,
  splitSpeechText,
  stripSpeechMarkup
} from '../../src/systems/speech/SpeechText.js';

describe('SpeechText', () => {
  it('移除展示标签但保留引号和标点语气', () => {
    const result = stripSpeechMarkup('<p>他说："<b>再试一次！</b>"</p>');
    expect(result).toBe('他说："再试一次！"');
  });

  it('金句模式只提取显式高亮内容', () => {
    const result = extractSpeechHighlights('普通叙述。<b>第一句。</b>过渡。<b>第二句！</b>');
    expect(result).toBe('第一句。第二句！');
  });

  it('规范化常见比例、百分数和英文缩写', () => {
    const result = normalizeSpeechText('AI检定 6/10，增长20%，CEO确认。');
    expect(result).toContain('A I');
    expect(result).toContain('6比10');
    expect(result).toContain('百分之20');
    expect(result).toContain('C E O');
  });

  it('优先按自然标点把长文拆为安全短句', () => {
    const text = '这是第一句话，用来验证朗读分段不会一次塞入过长文本。'.repeat(10);
    const chunks = splitSpeechText(text);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every(chunk => chunk.length <= 80)).toBe(true);
    expect(chunks.join('')).toBe(text);
  });
});
