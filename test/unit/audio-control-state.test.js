// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  announceAudioState,
  getAudioControlState,
  getSpeechSupportState,
  getVoiceSettingsAriaLabel,
  getVoiceSettingsTriggerText
} from '../../src/ui/AudioControlState.js';

function createAudio(overrides = {}) {
  return {
    enabled: true,
    getNarrationModeInfo: () => ({
      key: 'full',
      label: '完整',
      shortLabel: '全文',
      desc: '朗读全部剧情'
    }),
    getVoicePreset: () => ({
      key: 'warm_female',
      label: '温和叙事'
    }),
    getSpeechSupportInfo: () => ({
      state: 'ready',
      supported: true,
      canPreview: true,
      hasChineseVoice: true,
      label: '中文系统朗读可用',
      detail: '使用当前设备语音'
    }),
    ...overrides
  };
}

describe('AudioControlState', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('requestAnimationFrame', callback => {
      callback();
      return 1;
    });
    document.body.innerHTML = `
      <div id="ui-audio-status" role="status" aria-live="polite"></div>
    `;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
  });

  it('所有入口使用“pressed 等于开启”的同一声音语义', () => {
    const enabled = getAudioControlState(createAudio());
    const muted = getAudioControlState(createAudio({ enabled: false }));

    expect(enabled.sound).toMatchObject({
      enabled: true,
      label: '开启',
      ariaPressed: 'true'
    });
    expect(enabled.sound.ariaLabel).toContain('声音：开启');
    expect(muted.sound).toMatchObject({
      enabled: false,
      label: '静音',
      ariaPressed: 'false'
    });
    expect(muted.sound.ariaLabel).toContain('声音：静音');
  });

  it('标题朗读入口同时呈现模式与风格', () => {
    const audio = createAudio();
    expect(getVoiceSettingsTriggerText(audio)).toBe(
      '♪ 朗读设置 · 完整 / 温和叙事'
    );
    expect(getVoiceSettingsAriaLabel(audio)).toBe(
      '朗读设置：完整，温和叙事'
    );
  });

  it('共享 live region 可重复播报设置结果', () => {
    expect(announceAudioState('声音已静音')).toBe(true);
    expect(document.getElementById('ui-audio-status').textContent)
      .toBe('声音已静音');
  });

  it('旧探针或精简音频对象缺少能力方法时保持可用降级', () => {
    expect(getSpeechSupportState({})).toMatchObject({
      state: 'ready',
      supported: true,
      canPreview: true
    });
  });
});
