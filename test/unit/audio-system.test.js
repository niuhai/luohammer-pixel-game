import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AudioSystem, NARRATION_MODES, VOICE_PRESETS } from '../../src/systems/AudioSystem.js';

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
  class FakeSpeechSynthesisUtterance {
    constructor(text) {
      this.text = text;
      this.lang = '';
      this.rate = 1;
      this.pitch = 1;
      this.volume = 1;
      this.voice = null;
      this.onstart = null;
      this.onend = null;
      this.onerror = null;
    }
  }
  Object.defineProperty(window, 'SpeechSynthesisUtterance', {
    configurable: true,
    value: FakeSpeechSynthesisUtterance
  });

  const synth = {
    speaking: false,
    paused: false,
    current: null,
    spoken: [],
    getVoices: vi.fn(getVoices),
    addEventListener: vi.fn((type, handler) => {
      if (type === 'voiceschanged') listeners.add(handler);
    }),
    removeEventListener: vi.fn((type, handler) => {
      if (type === 'voiceschanged') listeners.delete(handler);
    }),
    cancel: vi.fn(() => {
      const current = synth.current;
      synth.current = null;
      synth.speaking = false;
      current?.onerror?.({ error: 'canceled' });
    }),
    speak: vi.fn(utterance => {
      synth.current = utterance;
      synth.spoken.push(utterance);
      synth.speaking = true;
      utterance.onstart?.();
    }),
    pause: vi.fn(),
    resume: vi.fn(),
    dispatchVoicesChanged: () => {
      for (const handler of [...listeners]) handler();
    },
    finishCurrent: () => {
      const current = synth.current;
      if (!current) return;
      synth.current = null;
      synth.speaking = false;
      current.onend?.();
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
    delete window.SpeechSynthesisUtterance;
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

  it('朗读预设保持四种克制且明确的系统语音风格', () => {
    expect(Object.keys(VOICE_PRESETS)).toEqual([
      'luo_style',
      'broadcast',
      'warm_female',
      'young_female'
    ]);
    expect(Object.values(VOICE_PRESETS).map(preset => preset.label)).toEqual([
      '沉稳演讲',
      '纪录旁白',
      '温和叙事',
      '明快讲述'
    ]);
    expect(Object.values(VOICE_PRESETS).every(preset => preset.pitch >= 0.9 && preset.pitch <= 1.1)).toBe(true);
  });

  it('区分系统朗读不支持、默认语音降级和中文语音就绪', () => {
    delete window.speechSynthesis;
    delete window.SpeechSynthesisUtterance;
    const unsupported = new AudioSystem({ events: new SceneEvents() });
    expect(unsupported.getSpeechSupportInfo()).toMatchObject({
      state: 'unsupported',
      supported: false,
      canPreview: false,
      hasChineseVoice: false
    });
    unsupported.destroy();

    installSpeechSynthesis(() => []);
    const fallback = new AudioSystem({ events: new SceneEvents() });
    expect(fallback.getSpeechSupportInfo()).toMatchObject({
      state: 'default-fallback',
      supported: true,
      canPreview: true,
      hasChineseVoice: false
    });
    fallback.destroy();

    installSpeechSynthesis(() => [{ name: '普通话', lang: 'zh-CN' }]);
    const ready = new AudioSystem({ events: new SceneEvents() });
    expect(ready.getSpeechSupportInfo()).toMatchObject({
      state: 'ready',
      supported: true,
      canPreview: true,
      hasChineseVoice: true
    });
    ready.destroy();
  });

  it('新用户默认只朗读富文本中的金句', () => {
    const synth = installSpeechSynthesis(() => [{ name: '普通话', lang: 'zh-CN', localService: true }]);
    const audio = new AudioSystem({ events: new SceneEvents() });

    expect(audio.getNarrationMode()).toBe(NARRATION_MODES.highlights.key);
    expect(audio.speak('普通叙述。这是一句金句。后续叙述。', {
      richText: '普通叙述。<b>这是一句金句。</b>后续叙述。'
    })).toBe(true);
    expect(synth.spoken).toHaveLength(1);
    expect(synth.spoken[0].text).toBe('这是一句金句。');

    synth.finishCurrent();
    audio.destroy();
  });

  it('完整模式把长文本拆成短句队列并按顺序播放', () => {
    const synth = installSpeechSynthesis(() => [{ name: '普通话', lang: 'zh-CN' }]);
    const audio = new AudioSystem({ events: new SceneEvents() });
    audio.setNarrationMode('full');
    const text = '第一段讲述人生的选择与代价，需要保持清晰自然的停顿。'.repeat(8);

    expect(audio.speak(text)).toBe(true);
    while (synth.current) synth.finishCurrent();

    expect(synth.spoken.length).toBeGreaterThan(1);
    expect(synth.spoken.every(utterance => utterance.text.length <= 80)).toBe(true);
    expect(audio.isSpeaking()).toBe(false);
    audio.destroy();
  });

  it('旧朗读 cancel 后迟到的结束事件不会冲掉新会话回调', () => {
    const synth = installSpeechSynthesis(() => [{ name: '普通话', lang: 'zh-CN' }]);
    const audio = new AudioSystem({ events: new SceneEvents() });
    audio.setNarrationMode('full');
    audio.speak('旧的一段剧情。');
    const oldUtterance = synth.current;

    audio.speak('新的一段剧情。');
    const finished = vi.fn();
    audio.onceSpeechEnd(finished);
    oldUtterance.onend?.();
    expect(finished).not.toHaveBeenCalled();

    synth.finishCurrent();
    expect(finished).toHaveBeenCalledOnce();
    audio.destroy();
  });

  it('总静音会立即停止正在进行的朗读', async () => {
    const synth = installSpeechSynthesis(() => [{ name: '普通话', lang: 'zh-CN' }]);
    const audio = new AudioSystem({ events: new SceneEvents() });
    audio.setNarrationMode('full');
    audio.speak('正在朗读的剧情。');

    expect(audio.isSpeaking()).toBe(true);
    await audio.toggle();
    expect(audio.enabled).toBe(false);
    expect(audio.isSpeaking()).toBe(false);
    expect(synth.cancel).toHaveBeenCalled();
    audio.destroy();
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
