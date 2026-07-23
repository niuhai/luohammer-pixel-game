import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AudioSystem, VOICE_PRESETS } from '../../src/systems/AudioSystem.js';

class SceneEvents {
  constructor() {
    this.listeners = new Map();
  }

  once(type, handler) {
    const wrapped = (...args) => {
      this.off(type, wrapped);
      handler(...args);
    };
    this.listeners.set(type, wrapped);
  }

  off(type, handler) {
    if (!handler || this.listeners.get(type) === handler) {
      this.listeners.delete(type);
    }
  }

  emit(type) {
    this.listeners.get(type)?.();
  }
}

function installSpeechSynthesis(getVoices = () => []) {
  const listeners = new Set();
  const synth = {
    speaking: false,
    paused: false,
    getVoices: vi.fn(getVoices),
    addEventListener: vi.fn((type, handler) => {
      if (type === 'voiceschanged') listeners.add(handler);
    }),
    removeEventListener: vi.fn((type, handler) => {
      if (type === 'voiceschanged') listeners.delete(handler);
    }),
    cancel: vi.fn(),
    speak: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    dispatchVoicesChanged: () => {
      for (const handler of [...listeners]) handler();
    }
  };
  Object.defineProperty(window, 'speechSynthesis', {
    configurable: true,
    value: synth
  });
  return synth;
}

describe('AudioSystem - 跨场景生命周期', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    installSpeechSynthesis();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    delete window.speechSynthesis;
  });

  it('场景 shutdown 会取消多音符尾音并移除语音监听器', () => {
    const events = new SceneEvents();
    const scene = { events };
    const audio = new AudioSystem(scene);
    const tone = vi.spyOn(audio, '_playTone').mockImplementation(() => {});
    const synth = window.speechSynthesis;

    audio.playAchievementRare();
    expect(tone).toHaveBeenCalledOnce();
    expect(audio._sfxTimers.size).toBe(5);

    events.emit('shutdown');
    vi.advanceTimersByTime(1000);

    expect(tone).toHaveBeenCalledOnce();
    expect(audio._sfxTimers.size).toBe(0);
    expect(synth.removeEventListener).toHaveBeenCalledWith(
      'voiceschanged',
      expect.any(Function)
    );
    expect(audio.scene).toBeNull();
  });

  it('销毁旧场景不会移除新场景自己的 voiceschanged 监听器', () => {
    let voices = [{ name: '旧语音', lang: 'zh-CN' }];
    const synth = installSpeechSynthesis(() => voices);
    const first = new AudioSystem({ events: new SceneEvents() });
    const second = new AudioSystem({ events: new SceneEvents() });

    first.destroy();
    voices = [{ name: '新语音', lang: 'zh-CN' }];
    synth.dispatchVoicesChanged();

    expect(first.getVoiceList().map(v => v.name)).toEqual(['旧语音']);
    expect(second.getVoiceList().map(v => v.name)).toEqual(['新语音']);
  });

  it('配音预设保持四种明确且可辨识的系统语音风格', () => {
    expect(Object.keys(VOICE_PRESETS)).toEqual([
      'luo_style',
      'broadcast',
      'warm_female',
      'young_female'
    ]);
    expect(Object.values(VOICE_PRESETS).map(preset => preset.label)).toEqual([
      '沉稳男声·演讲',
      '播音腔·沉稳男声',
      '温和女声·叙事',
      '明快女声·日常'
    ]);
  });

  it('六个人生阶段映射到六套可辨识且有效的 BGM 动机', () => {
    const audio = new AudioSystem({ events: new SceneEvents() });
    const stageIds = ['youth', 'teacher', 'startup', 'dark', 'repay', 'reborn'];
    const expectedTypes = [
      'gameplay_youth',
      'gameplay_teacher',
      'gameplay_startup',
      'gameplay_dark',
      'gameplay_repay',
      'gameplay_reborn'
    ];
    const types = stageIds.map(stageId => audio.getBGMTypeForStage(stageId));
    const patterns = types.map(type => audio._getBGMPattern(type));

    expect(types).toEqual(expectedTypes);
    expect(new Set(types).size).toBe(stageIds.length);
    expect(new Set(patterns.map(pattern => JSON.stringify(pattern))).size).toBe(stageIds.length);

    for (const pattern of patterns) {
      const notes = pattern.flatMap(step => Array.isArray(step) ? step : [step]);
      expect(pattern.length).toBeGreaterThanOrEqual(8);
      expect(notes.some(note => note.freq > 0)).toBe(true);
      expect(notes.every(note => Number.isFinite(note.dur) && note.dur > 0)).toBe(true);
      expect(notes.reduce((duration, note) => duration + note.dur, 0)).toBeGreaterThan(1.5);
    }

    audio.destroy();
  });
});
