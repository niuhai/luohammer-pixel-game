import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AudioSystem } from '../../src/systems/AudioSystem.js';

const ORIGINAL_CREATE_OBJECT_URL = Object.getOwnPropertyDescriptor(URL, 'createObjectURL');
const ORIGINAL_REVOKE_OBJECT_URL = Object.getOwnPropertyDescriptor(URL, 'revokeObjectURL');

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
    if (ORIGINAL_CREATE_OBJECT_URL) {
      Object.defineProperty(URL, 'createObjectURL', ORIGINAL_CREATE_OBJECT_URL);
    } else {
      delete URL.createObjectURL;
    }
    if (ORIGINAL_REVOKE_OBJECT_URL) {
      Object.defineProperty(URL, 'revokeObjectURL', ORIGINAL_REVOKE_OBJECT_URL);
    } else {
      delete URL.revokeObjectURL;
    }
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

  it('场景关闭会释放自定义音频 Blob URL 与 ended 监听器', async () => {
    class FakeAudio extends EventTarget {
      constructor(src) {
        super();
        this.src = src;
        this.paused = true;
        this.ended = false;
        this.currentTime = 0;
        this.volume = 1;
        this.pause = vi.fn(() => { this.paused = true; });
        this.play = vi.fn(async () => { this.paused = false; });
      }
    }

    vi.stubGlobal('Audio', FakeAudio);
    const createObjectURL = vi.fn(() => 'blob:voice-preview');
    const revokeObjectURL = vi.fn();
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectURL });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revokeObjectURL });
    localStorage.setItem('luohammer_custom_voice', 'data:audio/mpeg;base64,QQ==');
    localStorage.setItem('luohammer_custom_voice_type', 'audio/mpeg');

    const events = new SceneEvents();
    const audio = new AudioSystem({ events });
    const audioEl = audio._customAudioEl;
    const removeListener = vi.spyOn(audioEl, 'removeEventListener');
    audio._voicePresetKey = 'custom';
    audio.speak('试听', { force: true });
    await Promise.resolve();

    events.emit('shutdown');

    expect(audioEl.pause).toHaveBeenCalled();
    expect(removeListener).toHaveBeenCalledWith('ended', expect.any(Function));
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:voice-preview');
    expect(audio._customAudioEl).toBeNull();
    expect(audio._customAudioUrl).toBeNull();
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
