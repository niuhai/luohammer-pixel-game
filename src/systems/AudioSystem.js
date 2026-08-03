import {
  extractSpeechHighlights,
  normalizeSpeechText,
  splitSpeechText
} from './speech/SpeechText.js';

// 模块级共享 AudioContext，避免场景切换时反复创建/关闭 ctx 触发 Chrome 限制（~6 个）
let _sharedCtx = null;
let _sharedMasterGain = null;
// P0 崩溃防护：Web Audio 构造失败标记（旧 WebView/受限环境），避免反复尝试构造
let _ctxConstructFailed = false;

// R91：页面可见性与共享音频链路联动——切后台挂起 Web Audio + 暂停 TTS，
// 回前台恢复。模块级只注册一次；读取模块级 _sharedCtx，不依赖具体场景实例。
let _visibilityHandlerInstalled = false;
function _installVisibilityHandler() {
  if (_visibilityHandlerInstalled || typeof document === 'undefined') return;
  _visibilityHandlerInstalled = true;
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      try { if (_sharedCtx && _sharedCtx.state === 'running') _sharedCtx.suspend(); } catch(e) {}
      try {
        if (window.speechSynthesis && window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
          window.speechSynthesis.pause();
        }
      } catch(e) {}
    } else {
      try { if (_sharedCtx && _sharedCtx.state === 'suspended') _sharedCtx.resume(); } catch(e) {}
      try {
        if (window.speechSynthesis && window.speechSynthesis.paused) window.speechSynthesis.resume();
      } catch(e) {}
    }
  });
}

/**
 * 朗读风格：通过克制的 rate/pitch 差异调整节奏，不再把同一系统声音
 * 包装成四种固定“音色”。实际发声者始终来自用户设备安装的中文语音。
 *
 * 浏览器 TTS 仅能调用系统已安装语音，跨浏览器兼容性策略：
 * 1. 优先匹配原生男女声 voice name（覆盖微软/苹果/谷歌主流语音）
 * 2. 用户可直接选择实际系统语音；未选择时按语言、是否本地和已知名称打分
 * 3. pitch 控制在自然范围内，主要通过分句、语速和停顿形成风格差异
 */
export const VOICE_PRESETS = {
  luo_style: {
    key: 'luo_style',
    label: '沉稳演讲',
    desc: '稍慢语速、克制音调，适合人物金句与关键剧情',
    rate: 0.84,
    pitch: 0.94,
    pauseMs: 90,
    gender: 'male',
    voiceFilter: (v) => v.lang && v.lang.startsWith('zh') && /kangkang|yunyang|liangliang|^yun$|male|男/i.test(v.name)
  },
  broadcast: {
    key: 'broadcast',
    label: '纪录旁白',
    desc: '稳定、清晰、留有停顿，适合完整剧情叙述',
    rate: 0.76,
    pitch: 0.98,
    pauseMs: 120,
    gender: 'male',
    voiceFilter: (v) => v.lang && v.lang.startsWith('zh') && /kangkang|yunyang|liangliang|^yun$|male|男/i.test(v.name)
  },
  warm_female: {
    key: 'warm_female',
    label: '温和叙事',
    desc: '自然柔和、稍慢语速，适合平静和低落场景',
    rate: 0.95,
    pitch: 1.05,
    pauseMs: 45,
    gender: 'female',
    voiceFilter: (v) => v.lang && v.lang.startsWith('zh') && /huihui|yaoyao|tingting|hanhan|xiaoxiao|female|女/i.test(v.name)
  },
  young_female: {
    key: 'young_female',
    label: '明快讲述',
    desc: '语速轻快、音调自然，适合日常和高光场景',
    rate: 1.08,
    pitch: 1.08,
    pauseMs: 20,
    gender: 'female',
    voiceFilter: (v) => v.lang && v.lang.startsWith('zh') && /huihui|yaoyao|tingting|hanhan|xiaoxiao|female|女/i.test(v.name)
  }
};

const VOICE_PRESET_KEY = 'luohammer_voice_preset';
const VOICE_NAME_KEY = 'luohammer_voice_name';
const NARRATION_MODE_KEY = 'luohammer_narration_mode';

export const NARRATION_MODES = {
  off: {
    key: 'off',
    label: '关闭',
    shortLabel: '朗读关',
    desc: '不朗读任何内容'
  },
  highlights: {
    key: 'highlights',
    label: '金句',
    shortLabel: '金句',
    desc: '只朗读剧情中的高亮金句'
  },
  full: {
    key: 'full',
    label: '完整',
    shortLabel: '全文',
    desc: '朗读全部剧情、序章与结局'
  },
  accessible: {
    key: 'accessible',
    label: '无障碍',
    shortLabel: '无障碍',
    desc: '在完整朗读基础上追加选项和系统信息'
  }
};

const NARRATION_MODE_ORDER = ['off', 'highlights', 'full', 'accessible'];

const MOOD_SPEECH_ADJUSTMENTS = {
  angry: { rate: 1.10, pitch: 1.01 },
  depressed: { rate: 0.84, pitch: 0.97 },
  happy: { rate: 1.05, pitch: 1.02 },
  excited: { rate: 1.08, pitch: 1.03 },
  tense: { rate: 0.94, pitch: 0.98 },
  reflective: { rate: 0.86, pitch: 0.97 }
};

export class AudioSystem {
  constructor(scene) {
    this.scene = scene;
    this.ctx = null;
    this.enabled = true;
    this.masterVolume = 0.6;       // 主音量 0~1
    this.sfxVolume = 0.7;          // 音效音量比例
    this.bgmVolume = 0.35;         // 背景音乐音量比例（略低于音效，避免被盖过）
    this.lastTypewriterTime = 0;
    this.typewriterPhase = 0;
    this._bgmGain = null;          // BGM增益节点
    this._bgmPlaying = false;
    this._bgmType = null;
    this._masterGain = null;       // 主增益节点，所有音效统一经过
    this._bgmTimer = null;
    this._fadeOutTimer = null;
    this._crossfadeTimer = null;
    this._sfxTimers = new Set();   // 多音符 SFX 延迟任务，场景关闭时统一取消
    this._destroyed = false;
    this._lastHoverTime = 0;       // 防止hover音效过于频繁
    this._narrationMode = 'highlights'; // 新用户默认只听金句，避免长篇剧情拖沓
    this._lastNarrationMode = 'highlights';
    this._narrationEnabled = true; // 兼容旧调用，由 narrationMode 同步
    this._cachedVoices = [];       // 缓存TTS语音列表
    this._voiceName = '';          // 用户手选的真实系统语音；空字符串表示自动
    this._voiceChangeHandler = null;
    this._previousVoiceChangeHandler = null;
    this._ttsResumeTimer = null;   // Chrome长文本bug修复定时器
    this._pendingSpeechEndCallbacks = []; // 朗读结束回调队列（用于剧情自动推进同步）
    this._speechGeneration = 0;    // 朗读会话代号，隔离 cancel 后迟到的 onend/onerror
    this._speechQueue = [];        // 短句队列，避免单个超长 SpeechSynthesisUtterance
    this._speechActive = false;
    this._speechPauseTimer = null;
    this._activeSpeechUtterance = null;
    this._speechDucked = false;    // 朗读时压低 BGM，结束后恢复
    this._sceneShutdownHandler = null;
    // 当前配音预设（持久化到 localStorage），默认使用沉稳男声
    this._voicePresetKey = 'luo_style';
    try {
      const saved = localStorage.getItem('luohammer_audio');
      if (saved !== null) this.enabled = saved === 'true';
      const vol = localStorage.getItem('luohammer_volume');
      if (vol !== null) this.masterVolume = Math.max(0, Math.min(1, parseFloat(vol)));
      const savedMode = localStorage.getItem(NARRATION_MODE_KEY);
      const legacyNarration = localStorage.getItem('luohammer_narration');
      if (savedMode && NARRATION_MODES[savedMode]) {
        this._narrationMode = savedMode;
      } else if (legacyNarration !== null) {
        // 旧用户保持原有行为：旧“开”迁移为完整朗读，旧“关”迁移为关闭。
        this._narrationMode = legacyNarration === 'true' ? 'full' : 'off';
      }
      this._narrationEnabled = this._narrationMode !== 'off';
      if (this._narrationEnabled) this._lastNarrationMode = this._narrationMode;
      const preset = localStorage.getItem(VOICE_PRESET_KEY);
      if (preset && VOICE_PRESETS[preset]) this._voicePresetKey = preset;
      this._voiceName = localStorage.getItem(VOICE_NAME_KEY) || '';
    } catch(e) {}
    // 预加载TTS语音列表
    this._initVoices();
    // R91：模块级可见性联动（仅首个实例注册一次）
    _installVisibilityHandler();

    // AudioSystem 自己持有的浏览器资源必须跟随场景关闭。
    // 统一在此绑定，覆盖 Scene 提前 return、异常兜底等调用方来不及手动 destroy 的路径。
    if (this.scene?.events?.once) {
      this._sceneShutdownHandler = () => this.destroy();
      this.scene.events.once('shutdown', this._sceneShutdownHandler);
    }
  }

  _initVoices() {
    if (!window.speechSynthesis) return;
    const loadVoices = () => {
      this._cachedVoices = window.speechSynthesis.getVoices();
    };
    loadVoices();
    this._voiceChangeHandler = loadVoices;
    if (typeof window.speechSynthesis.addEventListener === 'function') {
      window.speechSynthesis.addEventListener('voiceschanged', loadVoices);
    } else if (window.speechSynthesis.onvoiceschanged !== undefined) {
      this._previousVoiceChangeHandler = window.speechSynthesis.onvoiceschanged;
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }

  /**
   * 注册多音符音效中的延迟任务。回调执行后自动移除引用，
   * 场景 shutdown 时全部取消，避免上一场景的尾音串到下一场景。
   */
  _scheduleSfx(fn, delay) {
    if (this._destroyed) return null;
    const timer = setTimeout(() => {
      this._sfxTimers.delete(timer);
      if (this._destroyed) return;
      try { fn(); } catch(e) {}
    }, delay);
    this._sfxTimers.add(timer);
    return timer;
  }

  /**
   * 获取共享 AudioContext。
   * P0 崩溃防护：在不支持 Web Audio 的环境（旧 WebView/受限浏览器）构造会抛 TypeError，
   * 此处捕获并返回 null — 调用方需判空（有 try-catch 的调用方会自然捕获 null 引用错误）。
   * @returns {AudioContext|null}
   */
  _getCtx() {
    if (!_sharedCtx) {
      if (_ctxConstructFailed) return null;
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) throw new Error('Web Audio API unavailable');
        _sharedCtx = new AC();
        // 创建共享主增益节点，所有音效统一经过此节点控制
        _sharedMasterGain = _sharedCtx.createGain();
        _sharedMasterGain.gain.setValueAtTime(this.masterVolume, _sharedCtx.currentTime);
        _sharedMasterGain.connect(_sharedCtx.destination);
      } catch (e) {
        _ctxConstructFailed = true;
        _sharedCtx = null;
        _sharedMasterGain = null;
        this.ctx = null;
        this._masterGain = null;
        console.warn('[AudioSystem] AudioContext 不可用，音频功能已降级为静默:', e);
        return null;
      }
    }
    // 当前实例引用共享 ctx（便于实例方法访问）
    this.ctx = _sharedCtx;
    this._masterGain = _sharedMasterGain;
    // 同步主音量（用户可能修改了设置）
    try {
      _sharedMasterGain.gain.setValueAtTime(this.masterVolume, _sharedCtx.currentTime);
    } catch(e) {}
    // 确保AudioContext处于运行状态（浏览器自动暂停策略）
    // R91：页面隐藏时不主动 resume——可见性处理器已在后台刻意 suspend，
    // 此处若唤醒会导致 BGM 在用户切走后继续发声。
    if (_sharedCtx.state === 'suspended'
        && !(typeof document !== 'undefined' && document.hidden)) {
      _sharedCtx.resume();
    }
    return _sharedCtx;
  }

  /**
   * 获取所有可用的中文 TTS 语音列表（用于诊断）
   * @returns {Array<{name: string, lang: string, isMale: boolean}>}
   */
  getVoiceList() {
    const voices = this._cachedVoices.length > 0
      ? this._cachedVoices
      : (window.speechSynthesis?.getVoices() || []);

    return voices
      .filter(v => v.lang && v.lang.toLowerCase().startsWith('zh'))
      .map(v => ({
        name: v.name,
        lang: v.lang,
        isMale: this._isMaleVoice(v.name)
      }));
  }

  /**
   * 当前设备的系统朗读能力。区分“浏览器根本不支持”和“没有中文语音但可用默认
   * 语音”，避免 UI 把不可试听误报成会使用默认声音。
   */
  getSpeechSupportInfo() {
    const supported = Boolean(
      typeof window !== 'undefined' &&
      window.speechSynthesis &&
      typeof window.SpeechSynthesisUtterance === 'function'
    );
    if (!supported) {
      return {
        state: 'unsupported',
        supported: false,
        canPreview: false,
        hasChineseVoice: false,
        label: '当前浏览器不支持系统朗读',
        detail: '朗读偏好会保留；换用支持系统语音的浏览器或设备后生效'
      };
    }
    const hasChineseVoice = this.getVoiceList().length > 0;
    if (!hasChineseVoice) {
      return {
        state: 'default-fallback',
        supported: true,
        canPreview: true,
        hasChineseVoice: false,
        label: '未检测到中文系统语音',
        detail: '将尝试使用设备默认语音；可在系统设置中安装中文语音'
      };
    }
    return {
      state: 'ready',
      supported: true,
      canPreview: true,
      hasChineseVoice: true,
      label: '中文系统朗读可用',
      detail: '完全使用当前设备的中文系统语音，不上传文本'
    };
  }

  /**
   * 猜测语音是男声还是女声（启发式）
   */
  _isMaleVoice(name) {
    if (!name) return null;
    const lower = name.toLowerCase();
    // 明确男声标识
    if (/kangkang|yunyang|liangliang|yunxi|yunjian|male|男/.test(lower)) return true;
    // 明确女声标识
    if (/huihui|yaoyao|tingting|hanhan|xiaoxiao|yating|female|女/.test(lower)) return false;
    // 无法判断
    return null;
  }

  /**
   * 用户手动选择设备上的真实系统语音。空值恢复自动选择。
   */
  setVoiceName(name = '') {
    this._voiceName = String(name || '');
    try { localStorage.setItem(VOICE_NAME_KEY, this._voiceName); } catch(e) {}
    return this._voiceName;
  }

  getVoiceName() {
    return this._voiceName;
  }

  /**
   * 统一的语音选择器：用户手选 > 风格已知名称 > zh-CN 本地语音 >
   * 默认中文语音。不会再通过排序位置猜测性别。
   */
  _selectVoice(preset, explicitVoiceName = '') {
    const voices = this._cachedVoices.length > 0
      ? this._cachedVoices
      : (window.speechSynthesis?.getVoices() || []);
    const zhVoices = voices.filter(v => {
      const lang = (v.lang || '').toLowerCase();
      return lang.startsWith('zh') || /chinese|中文|普通话|国语/i.test(v.name || '');
    });

    const requestedName = explicitVoiceName || this._voiceName;
    if (requestedName) {
      const selected = voices.find(v => v.name === requestedName);
      if (selected) return { voice: selected, matched: true, source: 'user' };
    }

    if (preset?.voiceFilter) {
      const matched = zhVoices.find(v => preset.voiceFilter(v));
      if (matched) return { voice: matched, matched: true, source: 'preset' };
    }

    const scored = zhVoices
      .map((voice, index) => {
        const lang = (voice.lang || '').toLowerCase();
        let score = 0;
        if (lang === 'zh-cn' || lang === 'zh-hans-cn') score += 50;
        else if (lang.startsWith('zh-cn') || lang.includes('hans')) score += 35;
        else if (lang.startsWith('zh')) score += 20;
        if (voice.localService) score += 8;
        if (voice.default) score += 6;
        return { voice, score, index };
      })
      .sort((a, b) => b.score - a.score || a.index - b.index);

    return {
      voice: scored[0]?.voice || null,
      matched: false,
      source: scored.length > 0 ? 'automatic' : 'default'
    };
  }

  /** 实际音量 = 主音量 × 类型比例 */
  _sfxVol(v) { return v * this.sfxVolume; }
  _bgmVol(v) { return v * this.bgmVolume; }

  _getBGMTargetVolume() {
    return this._bgmVol(this._speechDucked ? 0.045 : 0.15);
  }

  /**
   * 系统 TTS 无法接入 Web Audio 混音图，因此通过压低程序化 BGM 为人声让位。
   */
  _setSpeechDucking(ducked) {
    this._speechDucked = Boolean(ducked);
    if (!this._bgmGain || !this._bgmPlaying) return;
    try {
      const ctx = this._getCtx();
      const gain = this._bgmGain.gain;
      gain.cancelScheduledValues(ctx.currentTime);
      gain.setValueAtTime(gain.value, ctx.currentTime);
      gain.linearRampToValueAtTime(
        this._getBGMTargetVolume(),
        ctx.currentTime + (this._speechDucked ? 0.16 : 0.32)
      );
    } catch(e) {}
  }

  /**
   * 基础合成器：按频率/时长/波形/音量出一个音。
   * 加入轻微的 envelop（attack/decay），避免爆音。
   * 所有音效统一经过 _masterGain 控制。
   */
  _playTone(freq, duration, type = 'square', volume = 0.15) {
    if (!this.enabled) return;
    try {
      const ctx = this._getCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      const v = this._sfxVol(volume);
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(v, ctx.currentTime + 0.003);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(this._masterGain || ctx.destination);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + duration + 0.02);
    } catch(e) {}
  }

  /**
   * 带频率滑动的音调（用于滑音效果）
   */
  _playSlide(startFreq, endFreq, duration, type = 'square', volume = 0.12) {
    if (!this.enabled) return;
    try {
      const ctx = this._getCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(startFreq, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(endFreq, ctx.currentTime + duration);
      const v = this._sfxVol(volume);
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(v, ctx.currentTime + 0.005);
      gain.gain.setValueAtTime(v, ctx.currentTime + duration * 0.6);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(this._masterGain || ctx.destination);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + duration + 0.02);
    } catch(e) {}
  }

  /**
   * 噪音（用于翻车/负面事件）——短暂白噪声，快速衰减。
   */
  _playNoise(duration = 0.2, volume = 0.08) {
    if (!this.enabled) return;
    try {
      const ctx = this._getCtx();
      const bufferSize = Math.floor(ctx.sampleRate * duration);
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
      }
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      const gain = ctx.createGain();
      const v = this._sfxVol(volume);
      gain.gain.setValueAtTime(v, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      src.connect(gain);
      gain.connect(this._masterGain || ctx.destination);
      src.start(ctx.currentTime);
    } catch(e) {}
  }

  // ============================================================
  // 对话相关
  // ============================================================

  /**
   * 打字机音效：每打 2-3 个字响一下，两档音高交替（像机械键盘敲击）。
   */
  playTypewriterChar() {
    if (!this.enabled) return;
    const now = performance.now();
    if (now - this.lastTypewriterTime < 60) return;
    this.lastTypewriterTime = now;
    this.typewriterPhase = 1 - this.typewriterPhase;
    const freq = this.typewriterPhase === 0 ? 900 : 650;
    this._playTone(freq, 0.018, 'square', 0.05);
  }

  /**
   * 对话点击继续/跳过打字 —— 轻微的"嗒"声，比打字机音稍响。
   */
  playDialogAdvance() {
    if (!this.enabled) return;
    const now = performance.now();
    if (now - (this.lastAdvanceTime || 0) < 120) return; // 节流：长按快进/AUTO 模式不炸音
    this.lastAdvanceTime = now;
    this._playTone(1100, 0.025, 'square', 0.04);
  }

  /**
   * 按钮悬停（桌面端）—— 极轻的高频短音，鼠标扫过选项的触觉化反馈。
   * 80ms 节流：快速划过一排按钮时不连发。移动端无 hover 不会触发。
   */
  playHover() {
    if (!this.enabled) return;
    const now = performance.now();
    if (now - this._lastHoverTime < 80) return;
    this._lastHoverTime = now;
    this._playTone(1400, 0.03, 'sine', 0.028);
  }

  // ============================================================
  // 用户操作
  // ============================================================

  /**
   * 选择/确认 —— 清脆的两声上行（"叮—咚"）。
   */
  playChoice() {
    this._playTone(660, 0.07);
    this._scheduleSfx(() => this._playTone(990, 0.09), 55);
  }

  /**
   * 天赋选中 —— 闪亮的确认音，带回响。
   */
  playTalentSelect() {
    this._playTone(880, 0.08, 'triangle', 0.1);
    this._scheduleSfx(() => this._playTone(1100, 0.06, 'triangle', 0.08), 60);
    this._scheduleSfx(() => this._playTone(1320, 0.15, 'sine', 0.06), 120);
  }

  /**
   * 开场动画：中心节点（"此刻的你"）亮起 —— 低音心跳般的"嗡"。
   */
  playIntroHeart() {
    if (!this.enabled) return;
    this._playTone(65, 0.8, 'sine', 0.09);   // C2
    this._scheduleSfx(() => this._playTone(131, 0.7, 'sine', 0.05), 80);
  }

  /**
   * 开场动画：一条光轨开始延伸 —— 轻微上行的 slide，像光被拉出去。
   */
  playIntroPath() {
    if (!this.enabled) return;
    this._playSlide(520, 780, 0.18, 'sine', 0.035);
  }

  /**
   * 开场动画：远端节点点亮。音高随 index 沿五声音阶上行，情绪逐星抬升。
   * @param {number} index 第几个被点亮的节点（0 起）
   */
  playIntroNode(index = 0) {
    if (!this.enabled) return;
    const scale = [523, 587, 659, 784, 880, 1047]; // C5 D5 E5 G5 A5 C6
    const freq = scale[Math.min(index, scale.length - 1)];
    this._playTone(freq, 0.22, 'triangle', 0.06);
    this._scheduleSfx(() => this._playTone(freq * 2, 0.3, 'sine', 0.035), 70);
  }

  /**
   * 开场动画：流星划过 —— 高频向低频的柔和 slide，像光掠过耳边。
   */
  playIntroMeteor() {
    if (!this.enabled) return;
    this._playSlide(1600, 500, 0.5, 'sine', 0.022);
  }

  /**
   * 开场动画终局：金色波前从中心涌出 —— 上行琶音星光齐明 + 低音暖垫托底。
   */
  playIntroFinale() {
    if (!this.enabled) return;
    const notes = [523, 659, 784, 1047]; // C5 E5 G5 C6
    notes.forEach((f, i) => {
      this._scheduleSfx(() => this._playTone(f, 0.4, 'triangle', 0.05), i * 90);
    });
    this._playTone(131, 1.4, 'sine', 0.045);
  }

  playIntroIgnite() {
    if (!this.enabled) return;
    this._playTone(55, 1.1, 'sine', 0.11);
    this._scheduleSfx(() => this._playTone(110, 0.9, 'sine', 0.06), 60);
    this._playSlide(900, 2400, 0.32, 'sine', 0.028);
    this._scheduleSfx(() => this._playTone(2093, 0.35, 'sine', 0.035), 200);
  }

  playIntroImpact(dim = false) {
    if (!this.enabled) return;
    const base = dim ? 1180 : 1760;
    const vol = dim ? 0.02 : 0.038;
    [0, 1, 2].forEach(i => {
      this._scheduleSfx(
        () => this._playTone(base * Math.pow(0.82, i), 0.14, 'triangle', vol),
        i * 55
      );
    });
  }

  playIntroConverge() {
    if (!this.enabled) return;
    const notes = [1047, 880, 784, 659, 523];
    notes.forEach((f, i) => {
      this._scheduleSfx(() => this._playTone(f, 0.3, 'triangle', 0.04), i * 70);
    });
    this._playSlide(1400, 500, 0.5, 'sine', 0.022);
  }

  playIntroBurst() {
    if (!this.enabled) return;
    this._playTone(49, 1.3, 'sine', 0.13);
    this._scheduleSfx(() => this._playTone(98, 1.0, 'sine', 0.07), 70);
    this._playSlide(600, 3200, 0.55, 'sine', 0.03);
    this._scheduleSfx(() => this._playTone(2637, 0.5, 'sine', 0.03), 320);
  }

  /**
   * 音频上下文是否已解锁。
   */
  isUnlocked() {
    if (!this.enabled) return false;
    try {
      const ctx = this._getCtx();
      return ctx.state === 'running';
    } catch (e) {
      return false;
    }
  }

  /**
   * 解锁音频上下文（浏览器自动暂停策略）。
   * @returns {Promise<boolean>} 解锁后 ctx 是否处于 running 状态
   */
  async unlock() {
    if (!this.enabled) return false;
    try {
      const ctx = this._getCtx();
      if (!ctx) return false;
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }
      return ctx.state === 'running';
    } catch (e) {
      return false;
    }
  }

  // ============================================================
  // 正面事件
  // ============================================================

  /**
   * 成就解锁 —— 经典大三和弦琶音（C-E-G），上行渐强。
   */
  playAchievement() {
    this._playTone(523, 0.09);  // C5
    this._scheduleSfx(() => this._playTone(659, 0.09), 90); // E5
    this._scheduleSfx(() => this._playTone(784, 0.09), 180); // G5
    this._scheduleSfx(() => this._playTone(1047, 0.18), 270); // C6
  }

  /**
   * 稀有成就 —— 更华丽的琶音 + 高音闪烁。
   */
  playAchievementRare() {
    this._playTone(523, 0.08, 'triangle', 0.1);   // C5
    this._scheduleSfx(() => this._playTone(659, 0.08, 'triangle', 0.1), 70);  // E5
    this._scheduleSfx(() => this._playTone(784, 0.08, 'triangle', 0.1), 140); // G5
    this._scheduleSfx(() => this._playTone(1047, 0.08, 'triangle', 0.1), 210); // C6
    this._scheduleSfx(() => this._playTone(1319, 0.12, 'sine', 0.08), 280);   // E6
    this._scheduleSfx(() => this._playTone(1568, 0.25, 'sine', 0.07), 360);   // G6 闪耀收尾
  }

  /**
   * 传说成就 —— 史诗级全音阶上行 + 和弦收尾。
   */
  playAchievementLegendary() {
    const notes = [523, 587, 659, 784, 880, 1047, 1175, 1319];
    notes.forEach((freq, i) => {
      this._scheduleSfx(() => this._playTone(freq, 0.1, 'triangle', 0.08 + i * 0.005), i * 60);
    });
    // 和弦收尾
    this._scheduleSfx(() => {
      this._playTone(1047, 0.3, 'sine', 0.07);  // C6
      this._playTone(1319, 0.3, 'sine', 0.06);  // E6
      this._playTone(1568, 0.4, 'sine', 0.06);  // G6
    }, notes.length * 60 + 50);
  }

  /**
   * 属性上升 —— 单音向上滑。
   */
  playStatUp(amount = 5) {
    const base = 520 + Math.min(amount, 20) * 10;
    this._playTone(base, 0.08, 'triangle', 0.08);
    this._scheduleSfx(() => this._playTone(base * 1.5, 0.12, 'triangle', 0.06), 60);
  }

  /**
   * 阶段结算 —— 号角般的上行三音，庄重感。
   */
  playStageSettlement() {
    this._playTone(330, 0.15, 'triangle', 0.09);  // E4
    this._scheduleSfx(() => this._playTone(440, 0.15, 'triangle', 0.09), 150); // A4
    this._scheduleSfx(() => this._playTone(660, 0.3, 'triangle', 0.1), 300);   // E5 长音
  }

  /**
   * 历史对照 —— 怀旧的回响音，像老唱片。
   */
  playHistoryCard() {
    this._playTone(440, 0.12, 'sine', 0.06);
    this._scheduleSfx(() => this._playTone(392, 0.15, 'sine', 0.05), 120);
    this._scheduleSfx(() => this._playTone(349, 0.2, 'sine', 0.04), 250);  // 渐弱回响
  }

  /**
   * 随机事件 —— 意外的叮咚，带点俏皮。
   */
  playRandomEvent() {
    this._playTone(784, 0.06, 'square', 0.07);  // G5 短促
    this._scheduleSfx(() => this._playTone(988, 0.06, 'square', 0.07), 80); // B5
    this._scheduleSfx(() => this._playTone(1175, 0.12, 'triangle', 0.06), 160); // D6
  }

  /**
   * 阈值触发/隐藏事件 —— 神秘的泛音。
   */
  playThresholdTrigger() {
    this._playTone(660, 0.15, 'sine', 0.06);
    this._scheduleSfx(() => this._playTone(880, 0.12, 'sine', 0.05), 100);
    this._scheduleSfx(() => this._playTone(1100, 0.2, 'sine', 0.04), 200);
  }

  /**
   * 远期后果回响 —— 低沉的回声。
   */
  playConsequence() {
    this._playTone(262, 0.2, 'triangle', 0.07);  // C4
    this._scheduleSfx(() => this._playTone(220, 0.25, 'triangle', 0.05), 180); // A3 回响
  }

  // ============================================================
  // 结局
  // ============================================================

  /**
   * 结局（默认）—— 庄严的下行音阶。
   */
  playEnding() {
    this._playTone(523, 0.18, 'triangle', 0.09);
    this._scheduleSfx(() => this._playTone(392, 0.18, 'triangle', 0.09), 180);
    this._scheduleSfx(() => this._playTone(330, 0.2, 'triangle', 0.09), 360);
    this._scheduleSfx(() => this._playTone(262, 0.4, 'triangle', 0.1), 540);
  }

  /**
   * 传奇结局 —— 辉煌的上行音阶 + 大三和弦。
   */
  playEndingLegendary() {
    const scale = [262, 330, 392, 523, 659, 784, 1047];
    scale.forEach((freq, i) => {
      this._scheduleSfx(() => this._playTone(freq, 0.12, 'triangle', 0.08 + i * 0.003), i * 80);
    });
    this._scheduleSfx(() => {
      this._playTone(1047, 0.4, 'sine', 0.08);
      this._playTone(1319, 0.4, 'sine', 0.07);
      this._playTone(1568, 0.5, 'sine', 0.07);
    }, scale.length * 80 + 60);
  }

  /**
   * 悲剧结局 —— 下行小调，凄凉。
   */
  playEndingTragic() {
    this._playTone(440, 0.25, 'triangle', 0.08);   // A4
    this._scheduleSfx(() => this._playTone(392, 0.25, 'triangle', 0.07), 200); // G4
    this._scheduleSfx(() => this._playTone(311, 0.3, 'sawtooth', 0.05), 400);  // Eb4 小调
    this._scheduleSfx(() => this._playTone(262, 0.5, 'sawtooth', 0.04), 600);  // C4 低沉收尾
  }

  /**
   * 平和结局 —— 温暖的大三和弦，缓慢。
   */
  playEndingPeaceful() {
    this._playTone(262, 0.3, 'sine', 0.06);  // C4
    this._scheduleSfx(() => this._playTone(330, 0.3, 'sine', 0.06), 150); // E4
    this._scheduleSfx(() => this._playTone(392, 0.4, 'sine', 0.06), 300); // G4
    this._scheduleSfx(() => {
      this._playTone(523, 0.5, 'sine', 0.05);  // C5
      this._playTone(659, 0.5, 'sine', 0.04);  // E5
    }, 500);
  }

  /**
   * 场景过渡 —— 短促低频下滑。
   */
  playTransition() {
    this._playTone(300, 0.12, 'sine', 0.07);
    this._scheduleSfx(() => this._playTone(220, 0.15, 'sine', 0.06), 100);
  }

  // ============================================================
  // 负面事件
  // ============================================================

  /**
   * 属性下降 —— 单音向下滑。
   */
  playStatDown(amount = 5) {
    const base = 440 - Math.min(amount, 20) * 8;
    this._playTone(base, 0.1, 'sawtooth', 0.07);
    this._scheduleSfx(() => this._playTone(base * 0.75, 0.14, 'sawtooth', 0.06), 70);
  }

  /**
   * 翻车（压力崩溃/大失败）—— 噪音 + 下行锯齿。
   */
  playCrash() {
    this._playNoise(0.3, 0.12);
    this._scheduleSfx(() => this._playTone(180, 0.25, 'sawtooth', 0.08), 120);
    this._scheduleSfx(() => this._playTone(90, 0.35, 'sawtooth', 0.06), 260);
  }

  /**
   * 压力警告 —— 紧张的低频脉冲，像心跳加速。
   */
  playPressureWarning() {
    for (let i = 0; i < 3; i++) {
      this._scheduleSfx(() => {
        this._playTone(110, 0.08, 'sawtooth', 0.06);
        this._scheduleSfx(() => this._playTone(120, 0.06, 'sawtooth', 0.05), 50);
      }, i * 180);
    }
  }

  /**
   * 错误/无效操作 —— 简短的"嘟"。
   */
  playError() {
    this._playTone(220, 0.1, 'square', 0.08);
  }

  // ============================================================
  // 背景音乐（简约8-bit循环）
  // ============================================================

  /**
   * 开始背景音乐循环。
   * @param {string} type 菜单、六个人生阶段或结局情绪对应的 BGM 类型
   */
  startBGM(type = 'menu') {
    if (!this.enabled) return;
    this.stopBGM();
    this._bgmType = type;

    try {
      const ctx = this._getCtx();
      this._bgmGain = ctx.createGain();
      this._bgmGain.gain.setValueAtTime(0, ctx.currentTime);
      this._bgmGain.connect(this._masterGain || ctx.destination);

      const patterns = this._getBGMPattern(type);
      this._bgmPlaying = true;
      this._playBGMLoop(patterns);

      // 渐入
      this._bgmGain.gain.linearRampToValueAtTime(
        this._getBGMTargetVolume(), ctx.currentTime + 1.5
      );
    } catch(e) {}
  }

  /**
   * 获取BGM音符模式。
   * 每个时间步是一个"和弦组"：可以是单个音符对象，也可以是音符对象数组（数组内所有音符同时发声）。
   * 休止符用 {freq:0, dur:x} 表示。
   */
  _getBGMPattern(type) {
    switch(type) {
      case 'intro':
        // 开场星图：稀疏高音正弦如星光点缀，低音长音 pad 铺出深空感
        return [
          [{freq:131,dur:0.9,type:'sine',vol:0.035}],   // C3 pad
          [{freq:1047,dur:0.5,type:'sine',vol:0.028}],  // C6 星光
          {freq:0,dur:0.3},
          [{freq:1319,dur:0.4,type:'sine',vol:0.024}],  // E6
          {freq:0,dur:0.4},
          [{freq:98,dur:0.9,type:'sine',vol:0.03}],     // G2 pad
          [{freq:784,dur:0.45,type:'sine',vol:0.026}],  // G5
          {freq:0,dur:0.35},
          [{freq:1568,dur:0.5,type:'sine',vol:0.018}],  // G6
          {freq:0,dur:0.5},
        ];
      case 'menu':
        // 主界面：缓慢的方波循环，旋律+低音八度和弦伴奏
        return [
          [{freq:262,dur:0.35,type:'square',vol:0.10},{freq:131,dur:0.35,type:'triangle',vol:0.05}],
          {freq:0,dur:0.1},
          [{freq:330,dur:0.35,type:'square',vol:0.09},{freq:165,dur:0.35,type:'triangle',vol:0.04}],
          {freq:0,dur:0.1},
          [{freq:392,dur:0.35,type:'square',vol:0.09},{freq:196,dur:0.35,type:'triangle',vol:0.04}],
          {freq:0,dur:0.1},
          [{freq:523,dur:0.45,type:'square',vol:0.07},{freq:262,dur:0.45,type:'triangle',vol:0.04}],
          {freq:0,dur:0.25},
          [{freq:392,dur:0.3,type:'square',vol:0.08},{freq:196,dur:0.3,type:'triangle',vol:0.04}],
          {freq:0,dur:0.1},
          [{freq:330,dur:0.3,type:'square',vol:0.08},{freq:165,dur:0.3,type:'triangle',vol:0.04}],
          {freq:0,dur:0.1},
          [{freq:262,dur:0.4,type:'square',vol:0.07},{freq:131,dur:0.4,type:'triangle',vol:0.04}],
          {freq:0,dur:0.4},
        ];
      case 'gameplay':
        // 游戏进行中：沉稳的脉动低音+偶尔高音点缀
        return [
          {freq:131,dur:0.3,type:'triangle',vol:0.04},
          {freq:0,dur:0.2},
          {freq:165,dur:0.25,type:'triangle',vol:0.03},
          {freq:0,dur:0.2},
          [{freq:196,dur:0.3,type:'triangle',vol:0.04},{freq:262,dur:0.2,type:'sine',vol:0.02}],
          {freq:0,dur:0.25},
          {freq:165,dur:0.25,type:'triangle',vol:0.03},
          {freq:0,dur:0.2},
          {freq:131,dur:0.35,type:'triangle',vol:0.04},
          {freq:0,dur:0.4},
        ];
      case 'gameplay_youth':
        // 青年：明亮、留白较多的五声音阶，保留尚未定型的轻盈感
        return [
          [{freq:262,dur:0.22,type:'square',vol:0.055},{freq:131,dur:0.22,type:'triangle',vol:0.025}],
          {freq:0,dur:0.10},
          {freq:294,dur:0.18,type:'square',vol:0.05},
          {freq:330,dur:0.22,type:'triangle',vol:0.05},
          {freq:0,dur:0.12},
          {freq:392,dur:0.28,type:'square',vol:0.05},
          {freq:330,dur:0.18,type:'triangle',vol:0.045},
          {freq:294,dur:0.18,type:'triangle',vol:0.04},
          {freq:262,dur:0.30,type:'sine',vol:0.04},
          {freq:0,dur:0.38}
        ];
      case 'gameplay_teacher':
        // 教师：钟声般的正弦波与规整低音，克制、稳定，像一节课的节拍
        return [
          [{freq:196,dur:0.42,type:'sine',vol:0.045},{freq:98,dur:0.42,type:'triangle',vol:0.025}],
          {freq:0,dur:0.18},
          {freq:247,dur:0.36,type:'sine',vol:0.045},
          {freq:0,dur:0.18},
          [{freq:220,dur:0.42,type:'sine',vol:0.045},{freq:110,dur:0.42,type:'triangle',vol:0.025}],
          {freq:0,dur:0.18},
          {freq:262,dur:0.46,type:'sine',vol:0.04},
          {freq:0,dur:0.46}
        ];
      case 'gameplay_startup':
        // 创业：短促脉冲与上行点音，节奏更密，表现发布会和现金流的推进感
        return [
          [{freq:131,dur:0.16,type:'square',vol:0.045},{freq:262,dur:0.11,type:'triangle',vol:0.035}],
          {freq:0,dur:0.08},
          {freq:165,dur:0.16,type:'square',vol:0.045},
          {freq:196,dur:0.16,type:'square',vol:0.05},
          {freq:0,dur:0.08},
          [{freq:147,dur:0.16,type:'square',vol:0.045},{freq:330,dur:0.11,type:'triangle',vol:0.035}],
          {freq:175,dur:0.16,type:'square',vol:0.045},
          {freq:220,dur:0.20,type:'square',vol:0.05},
          {freq:0,dur:0.22},
          {freq:196,dur:0.16,type:'triangle',vol:0.04},
          {freq:165,dur:0.24,type:'triangle',vol:0.04},
          {freq:0,dur:0.28}
        ];
      case 'ending_legendary':
        // 传奇结局：辉煌的三角波+八度低音和弦
        return [
          [{freq:523,dur:0.35,type:'triangle',vol:0.10},{freq:262,dur:0.35,type:'sine',vol:0.04}],
          [{freq:659,dur:0.35,type:'triangle',vol:0.10},{freq:330,dur:0.35,type:'sine',vol:0.04}],
          [{freq:784,dur:0.35,type:'triangle',vol:0.10},{freq:392,dur:0.35,type:'sine',vol:0.04}],
          [{freq:1047,dur:0.5,type:'triangle',vol:0.08},{freq:523,dur:0.5,type:'sine',vol:0.04}],
          {freq:0,dur:0.3},
          {freq:784,dur:0.3,type:'triangle',vol:0.08},
          {freq:659,dur:0.3,type:'triangle',vol:0.08},
          {freq:523,dur:0.5,type:'triangle',vol:0.08},
          {freq:0,dur:0.5},
        ];
      case 'ending_tragic':
        // 悲剧结局：低沉锯齿波下行+低八度
        return [
          [{freq:220,dur:0.5,type:'sawtooth',vol:0.06},{freq:110,dur:0.5,type:'triangle',vol:0.03}],
          {freq:0,dur:0.2},
          [{freq:196,dur:0.5,type:'sawtooth',vol:0.05},{freq:98,dur:0.5,type:'triangle',vol:0.03}],
          {freq:0,dur:0.2},
          {freq:175,dur:0.6,type:'sawtooth',vol:0.05},
          {freq:0,dur:0.4},
          {freq:165,dur:0.7,type:'sawtooth',vol:0.04},
          {freq:0,dur:0.6},
        ];
      case 'ending_peaceful':
        // 平和结局：温暖正弦波和弦
        return [
          [{freq:262,dur:0.5,type:'sine',vol:0.07},{freq:131,dur:0.5,type:'sine',vol:0.03}],
          {freq:330,dur:0.5,type:'sine',vol:0.06},
          {freq:392,dur:0.6,type:'sine',vol:0.06},
          {freq:0,dur:0.3},
          {freq:330,dur:0.4,type:'sine',vol:0.06},
          {freq:262,dur:0.6,type:'sine',vol:0.05},
          {freq:0,dur:0.5},
        ];
      case 'gameplay_dark':
        // 至暗时刻：低沉压抑的锯齿波下行，缓慢节奏
        return [
          [{freq:110,dur:0.6,type:'sawtooth',vol:0.05},{freq:55,dur:0.6,type:'triangle',vol:0.03}],
          {freq:0,dur:0.3},
          [{freq:98,dur:0.6,type:'sawtooth',vol:0.04},{freq:49,dur:0.6,type:'triangle',vol:0.03}],
          {freq:0,dur:0.3},
          {freq:87,dur:0.8,type:'sawtooth',vol:0.04},
          {freq:0,dur:0.5},
          [{freq:98,dur:0.5,type:'sawtooth',vol:0.04},{freq:49,dur:0.5,type:'triangle',vol:0.03}],
          {freq:0,dur:0.4},
        ];
      case 'gameplay_repay':
        // 还债：低音持续向前，高音只小幅上扬，坚定但仍背着重量
        return [
          [{freq:110,dur:0.30,type:'triangle',vol:0.045},{freq:220,dur:0.22,type:'sine',vol:0.035}],
          {freq:0,dur:0.12},
          [{freq:123,dur:0.30,type:'triangle',vol:0.045},{freq:247,dur:0.22,type:'sine',vol:0.035}],
          {freq:0,dur:0.12},
          [{freq:131,dur:0.34,type:'triangle',vol:0.05},{freq:262,dur:0.24,type:'sine',vol:0.04}],
          {freq:0,dur:0.16},
          {freq:147,dur:0.30,type:'triangle',vol:0.045},
          {freq:165,dur:0.34,type:'triangle',vol:0.045},
          {freq:147,dur:0.28,type:'sine',vol:0.04},
          {freq:0,dur:0.32}
        ];
      case 'gameplay_reborn':
        // 重生：宽音程、明亮三和弦和更长尾音，形成终于抬头的舒展感
        return [
          [{freq:262,dur:0.36,type:'sine',vol:0.055},{freq:131,dur:0.36,type:'triangle',vol:0.025}],
          {freq:330,dur:0.30,type:'sine',vol:0.055},
          [{freq:392,dur:0.40,type:'sine',vol:0.06},{freq:196,dur:0.40,type:'triangle',vol:0.025}],
          {freq:0,dur:0.18},
          [{freq:523,dur:0.46,type:'triangle',vol:0.055},{freq:262,dur:0.46,type:'sine',vol:0.03}],
          {freq:392,dur:0.30,type:'sine',vol:0.05},
          {freq:330,dur:0.30,type:'sine',vol:0.05},
          [{freq:262,dur:0.50,type:'sine',vol:0.05},{freq:165,dur:0.50,type:'triangle',vol:0.025}],
          {freq:0,dur:0.42}
        ];
      case 'ending_default':
        // 默认结局：中性偏庄重，三角波+低八度
        return [
          [{freq:262,dur:0.4,type:'triangle',vol:0.07},{freq:131,dur:0.4,type:'triangle',vol:0.03}],
          {freq:0,dur:0.15},
          {freq:294,dur:0.4,type:'triangle',vol:0.06},
          {freq:0,dur:0.15},
          [{freq:262,dur:0.5,type:'triangle',vol:0.06},{freq:131,dur:0.5,type:'triangle',vol:0.03}],
          {freq:0,dur:0.4},
        ];
      default:
        return this._getBGMPattern('menu');
    }
  }

  /**
   * 播放一组和弦音符（数组内所有音符同时发声）。
   * 返回这组音符的时长（取最长的dur）。
   */
  _playChordNotes(ctx, notes, startTime) {
    let maxDur = 0;
    const noteArr = Array.isArray(notes) ? notes : [notes];
    for (const p of noteArr) {
      if (!p.freq || p.freq <= 0) continue;
      const osc = ctx.createOscillator();
      const noteGain = ctx.createGain();
      osc.type = p.type || 'square';
      osc.frequency.setValueAtTime(p.freq, startTime);
      const v = this._bgmVol(p.vol || 0.1);
      noteGain.gain.setValueAtTime(0, startTime);
      noteGain.gain.linearRampToValueAtTime(v, startTime + 0.01);
      noteGain.gain.setValueAtTime(v, startTime + p.dur * 0.7);
      noteGain.gain.exponentialRampToValueAtTime(0.001, startTime + p.dur);
      osc.connect(noteGain);
      noteGain.connect(this._bgmGain);
      osc.start(startTime);
      osc.stop(startTime + p.dur + 0.05);
      if (p.dur > maxDur) maxDur = p.dur;
    }
    // 如果是休止符（freq=0），取其dur
    if (maxDur === 0 && noteArr.length === 1 && noteArr[0].freq === 0) {
      maxDur = noteArr[0].dur;
    }
    return maxDur;
  }

  /**
   * 循环播放BGM音符序列。
   * 使用AudioContext精确时间调度而非setTimeout控制音序，
   * setTimeout仅用于调度下一轮循环，并提前0.3s调度防止衔接间隙。
   */
  _playBGMLoop(patterns) {
    if (!this._bgmPlaying || !this._bgmGain) return;

    // P0 崩溃防护：本方法由 setTimeout 递归调度，回调中异常无法被外层捕获，
    // _getCtx() 可能返回 null（Web Audio 不可用），必须显式判空并停止 BGM
    const ctx = this._getCtx();
    if (!ctx) { this._bgmPlaying = false; return; }
    // R91：ctx 非 running（页面后台被 suspend / 中断）时不排音符——
    // suspend 期间 currentTime 冻结，照排会让多个循环堆在同一时刻，
    // 恢复可见性瞬间齐响。改为低频轮询，待恢复后下一轮自然接上。
    if (ctx.state !== 'running') {
      this._bgmTimer = setTimeout(() => {
        if (this._bgmPlaying) this._playBGMLoop(patterns);
      }, 500);
      return;
    }
    // 从当前时间稍微前一点开始，但因为Web Audio会自动处理过去的时间，直接从+0.05s开始
    let t = ctx.currentTime + 0.05;
    let totalDur = 0;

    for (const step of patterns) {
      const dur = this._playChordNotes(ctx, step, t);
      t += dur;
      totalDur += dur;
    }

    // 在下一轮结束前0.3s调度下一次循环，避免因setTimeout节流产生间隙
    // （osc停止后自动断开，不需要手动持有引用）
    const delayMs = Math.max(100, (totalDur - 0.3) * 1000);
    this._bgmTimer = setTimeout(() => {
      if (this._bgmPlaying) {
        this._playBGMLoop(patterns);
      }
    }, delayMs);
  }

  /**
   * 停止背景音乐
   */
  stopBGM() {
    this._bgmPlaying = false;
    this._bgmType = null;
    if (this._bgmTimer) {
      clearTimeout(this._bgmTimer);
      this._bgmTimer = null;
    }
    // 清理 crossfade 定时器（避免场景销毁后定时器触发导致"幽灵 BGM"）
    if (this._crossfadeTimer) {
      clearTimeout(this._crossfadeTimer);
      this._crossfadeTimer = null;
    }
    // 清理 fadeOut 定时器
    if (this._fadeOutTimer) {
      clearTimeout(this._fadeOutTimer);
      this._fadeOutTimer = null;
    }
    // 不再持有osc引用，通过将bgmGain立即设为0来静音正在播放的音符
    // （osc会在1个pattern周期内自然结束，不会泄漏）
    if (this._bgmGain) {
      try {
        this._bgmGain.gain.cancelScheduledValues(this._getCtx().currentTime);
        this._bgmGain.gain.setValueAtTime(0, this._getCtx().currentTime);
        this._bgmGain.disconnect();
      } catch(e) {}
      this._bgmGain = null;
    }
  }

  /**
   * BGM渐出
   */
  fadeOutBGM(duration = 1.0) {
    if (!this._bgmGain || !this._bgmPlaying) return;
    // 清理之前可能存在的 fadeOut 定时器，避免场景切换时泄漏
    if (this._fadeOutTimer) {
      clearTimeout(this._fadeOutTimer);
      this._fadeOutTimer = null;
    }
    try {
      const ctx = this._getCtx();
      this._bgmGain.gain.cancelScheduledValues(ctx.currentTime);
      this._bgmGain.gain.setValueAtTime(this._bgmGain.gain.value, ctx.currentTime);
      this._bgmGain.gain.linearRampToValueAtTime(0, ctx.currentTime + duration);
      this._fadeOutTimer = setTimeout(() => {
        this._fadeOutTimer = null;
        this.stopBGM();
      }, duration * 1000 + 100);
    } catch(e) {
      this.stopBGM();
    }
  }

  // ============================================================
  // 场景切换音量渐变
  // ============================================================

  /**
   * 场景切换：fade out 100ms → 停止 → 切换后 fade in 100ms
   * 用法：audio.crossfadeBGM('menu', 100)
   * @param {string} nextType 下一首BGM类型
   * @param {number} fadeMs 渐变时长（毫秒），默认100ms
   */
  crossfadeBGM(nextType, fadeMs = 100) {
    const fadeSec = fadeMs / 1000;
    if (!this._bgmPlaying || !this._bgmGain) {
      // 当前没有BGM在播放，直接开始新的
      this.startBGM(nextType);
      return;
    }
    try {
      const ctx = this._getCtx();
      // 先渐出当前BGM
      this._bgmGain.gain.cancelScheduledValues(ctx.currentTime);
      this._bgmGain.gain.setValueAtTime(this._bgmGain.gain.value, ctx.currentTime);
      this._bgmGain.gain.linearRampToValueAtTime(0, ctx.currentTime + fadeSec);
      // 清理上一个 crossfade 定时器（避免叠加触发）
      if (this._crossfadeTimer) {
        clearTimeout(this._crossfadeTimer);
        this._crossfadeTimer = null;
      }
      // 渐出完成后停止并开始新BGM
      this._crossfadeTimer = setTimeout(() => {
        this._crossfadeTimer = null;
        this.startBGM(nextType);
        // 新BGM的渐入由 startBGM 内部的 1.5s 渐入处理，
        // 这里额外加速：覆盖为 fadeMs 渐入
        if (this._bgmGain && this._bgmPlaying) {
          try {
            const ctx2 = this._getCtx();
            this._bgmGain.gain.cancelScheduledValues(ctx2.currentTime);
            this._bgmGain.gain.setValueAtTime(0, ctx2.currentTime);
            this._bgmGain.gain.linearRampToValueAtTime(
              this._getBGMTargetVolume(), ctx2.currentTime + fadeSec
            );
          } catch(e) {}
        }
      }, fadeMs + 50);
    } catch(e) {
      this.stopBGM();
      this.startBGM(nextType);
    }
  }

  // ============================================================
  // 音量控制
  // ============================================================

  /**
   * 设置主音量
   */
  setMasterVolume(v) {
    this.masterVolume = Math.max(0, Math.min(1, v));
    try { localStorage.setItem('luohammer_volume', this.masterVolume.toString()); } catch(e) {}
    // 实时更新主增益节点
    if (this._masterGain) {
      try {
        this._masterGain.gain.setValueAtTime(this.masterVolume, this._getCtx().currentTime);
      } catch(e) {}
    }
    // 实时更新BGM音量
    if (this._bgmGain && this._bgmPlaying) {
      try {
        this._bgmGain.gain.setValueAtTime(
          this._getBGMTargetVolume(), this._getCtx().currentTime
        );
      } catch(e) {}
    }
  }

  // ============================================================
  // 开关
  // ============================================================

  async toggle() {
    this.enabled = !this.enabled;
    try { localStorage.setItem('luohammer_audio', this.enabled.toString()); } catch(e) {}
    if (!this.enabled) {
      this.stopBGM();
      this.stopSpeaking();
    } else {
      await this.unlock();
      this._playTone(880, 0.05, 'sine', 0.08);
    }
    return this.enabled;
  }

  // ============================================================
  // 剧情朗读（Web Speech API TTS）
  // ============================================================

  /**
   * 朗读文本。正文先按朗读模式筛选，再拆成短句队列依次交给系统 TTS。
   * 朗读参数优先级：opts > 情绪调整 > 当前 voicePreset。
   * @param {string} text - 要朗读的文本
   * @param {object} opts
   * @param {number} [opts.rate]
   * @param {number} [opts.pitch]
   * @param {string} [opts.voiceName]
   * @param {string} [opts.richText] - 保留 <b> 的剧情文本，供金句模式提取
   * @param {string} [opts.highlightText] - 非 <b> 场景显式指定的金句
   * @param {string} [opts.kind='story'] - story/intro/ending/choices/preview
   * @param {string} [opts.mood] - angry/depressed/happy/excited/tense/reflective
   * @param {boolean} [opts.enqueue=false] - 追加到当前队列，不打断正在朗读的内容
   * @param {boolean} [opts.force=false] - 仅用于用户主动点击的试听
   * @returns {boolean} 是否成功进入朗读队列
   */
  speak(text, opts = {}) {
    const force = opts.force === true;
    if (!this.enabled || !text || !window.speechSynthesis) return false;

    const speechText = this._resolveNarrationText(text, opts, force);
    if (!speechText) return false;

    const chunks = splitSpeechText(speechText);
    if (chunks.length === 0) return false;

    const settings = this._buildSpeechSettings(opts);
    const queueItems = chunks.map(chunk => ({ text: chunk, settings }));

    if (opts.enqueue === true && this._speechActive) {
      this._speechQueue.push(...queueItems);
      return true;
    }

    // 新剧情替换旧剧情：旧 utterance 的迟到事件会被 generation 隔离。
    this._cancelSpeech({ notify: false });
    const generation = ++this._speechGeneration;
    this._speechQueue = queueItems;
    this._speechActive = true;
    this._setSpeechDucking(true);
    this._speakNextChunk(generation);
    return true;
  }

  _resolveNarrationText(text, opts, force) {
    if (force) return normalizeSpeechText(text);

    const mode = this._narrationMode;
    const kind = opts.kind || 'story';
    if (mode === 'off') return '';
    if (kind === 'choices' && mode !== 'accessible') return '';

    if (mode === 'highlights') {
      if (kind === 'choices') return '';
      const explicitHighlight = opts.highlightText != null
        ? opts.highlightText
        : extractSpeechHighlights(opts.richText || '');
      return normalizeSpeechText(explicitHighlight);
    }

    return normalizeSpeechText(text);
  }

  _buildSpeechSettings(opts) {
    const preset = VOICE_PRESETS[this._voicePresetKey] || VOICE_PRESETS.luo_style;
    const mood = MOOD_SPEECH_ADJUSTMENTS[opts.mood] || { rate: 1, pitch: 1 };
    const selected = this._selectVoice(preset, opts.voiceName || '');
    const baseRate = opts.rate != null ? Number(opts.rate) : preset.rate * mood.rate;
    const basePitch = opts.pitch != null ? Number(opts.pitch) : preset.pitch * mood.pitch;

    return {
      rate: Math.max(0.72, Math.min(1.18, Number.isFinite(baseRate) ? baseRate : 0.9)),
      pitch: Math.max(0.90, Math.min(1.10, Number.isFinite(basePitch) ? basePitch : 1)),
      pauseMs: Math.max(0, Math.min(180, Number.isFinite(preset.pauseMs) ? preset.pauseMs : 0)),
      volume: Math.max(0, Math.min(1, this.masterVolume * 0.9)),
      voice: selected.voice
    };
  }

  _createUtterance(text, settings) {
    const Utterance = window.SpeechSynthesisUtterance || globalThis.SpeechSynthesisUtterance;
    if (typeof Utterance !== 'function') return null;
    const utterance = new Utterance(text);
    utterance.lang = 'zh-CN';
    utterance.rate = settings.rate;
    utterance.pitch = settings.pitch;
    utterance.volume = settings.volume;
    if (settings.voice) utterance.voice = settings.voice;
    return utterance;
  }

  _clearTTSResumeTimer() {
    if (!this._ttsResumeTimer) return;
    clearInterval(this._ttsResumeTimer);
    this._ttsResumeTimer = null;
  }

  _clearSpeechPauseTimer() {
    if (!this._speechPauseTimer) return;
    clearTimeout(this._speechPauseTimer);
    this._speechPauseTimer = null;
  }

  _speakNextChunk(generation) {
    if (generation !== this._speechGeneration || !this._speechActive || this._destroyed) return;
    const item = this._speechQueue.shift();
    if (!item) {
      this._finishSpeechSession(generation);
      return;
    }

    const utterance = this._createUtterance(item.text, item.settings);
    if (!utterance) {
      this._finishSpeechSession(generation);
      return;
    }

    this._activeSpeechUtterance = utterance;
    let settled = false;
    const advance = () => {
      if (settled) return;
      settled = true;
      this._clearTTSResumeTimer();
      if (generation !== this._speechGeneration || this._activeSpeechUtterance !== utterance) return;
      this._activeSpeechUtterance = null;
      const pauseMs = Number(item.settings.pauseMs) || 0;
      if (pauseMs > 0) {
        this._clearSpeechPauseTimer();
        this._speechPauseTimer = setTimeout(() => {
          this._speechPauseTimer = null;
          this._speakNextChunk(generation);
        }, pauseMs);
      } else {
        this._speakNextChunk(generation);
      }
    };

    utterance.onstart = () => {
      if (generation !== this._speechGeneration) return;
      // 短句通常不需要唤醒；较长语音块仍保留 Chrome 防暂停保护。
      if (item.text.length >= 48) {
        this._clearTTSResumeTimer();
        this._ttsResumeTimer = setInterval(() => {
          if (generation !== this._speechGeneration) return;
          if (window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
            window.speechSynthesis.pause();
            window.speechSynthesis.resume();
          }
        }, 8000);
      }
    };
    utterance.onend = advance;
    utterance.onerror = advance;

    try {
      window.speechSynthesis.speak(utterance);
    } catch(e) {
      advance();
    }
  }

  _finishSpeechSession(generation) {
    if (generation !== this._speechGeneration) return;
    this._clearTTSResumeTimer();
    this._clearSpeechPauseTimer();
    this._activeSpeechUtterance = null;
    this._speechQueue = [];
    this._speechActive = false;
    this._setSpeechDucking(false);
    this._flushSpeechEndCallbacks();
  }

  _cancelSpeech({ notify = true } = {}) {
    const hadSpeech = this._speechActive || this._speechQueue.length > 0 || this._activeSpeechUtterance;
    this._speechGeneration++;
    this._speechQueue = [];
    this._speechActive = false;
    this._activeSpeechUtterance = null;
    this._clearTTSResumeTimer();
    this._clearSpeechPauseTimer();
    if (window.speechSynthesis) {
      try { window.speechSynthesis.cancel(); } catch(e) {}
    }
    this._setSpeechDucking(false);
    if (notify && hadSpeech) this._flushSpeechEndCallbacks();
    else if (!notify) this._pendingSpeechEndCallbacks = [];
  }

  /**
   * 注册一次性回调：当前 TTS 朗读结束后触发。
   * 用于剧情自动推进同步：打字完成后若 TTS 仍在朗读，注册此回调等其结束再推进。
   * 若当前没有朗读，回调立即触发。
   * @param {function} cb
   */
  onceSpeechEnd(cb) {
    if (typeof cb !== 'function') return;
    if (!this.isSpeaking()) {
      // 当前无朗读，立即触发
      try { cb(); } catch(e) {}
      return;
    }
    this._pendingSpeechEndCallbacks.push(cb);
  }

  _flushSpeechEndCallbacks() {
    const cbs = this._pendingSpeechEndCallbacks.splice(0);
    cbs.forEach(cb => {
      try { cb(); } catch(e) {}
    });
  }

  /**
   * 设置配音预设并持久化。供"配音试听"UI 调用。
   * @param {string} key - VOICE_PRESETS 的 key
   * @returns {boolean} 是否设置成功
   */
  setVoicePreset(key) {
    if (!VOICE_PRESETS[key]) return false;
    this._voicePresetKey = key;
    try {
      localStorage.setItem(VOICE_PRESET_KEY, key);
    } catch(e) {}
    return true;
  }

  /**
   * 获取当前配音预设 key
   */
  getVoicePresetKey() {
    return this._voicePresetKey;
  }

  /**
   * 获取当前配音预设对象
   */
  getVoicePreset() {
    return VOICE_PRESETS[this._voicePresetKey] || VOICE_PRESETS.luo_style;
  }

  /**
   * 试听指定预设：用一段标准文本朗读一遍。
   * @param {string} [key] - 预设 key，不传则试听当前预设
   */
  previewVoicePreset(key) {
    const targetKey = key || this._voicePresetKey;
    if (!VOICE_PRESETS[targetKey]) return;
    // 临时切换到目标预设试听
    const prev = this._voicePresetKey;
    this._voicePresetKey = targetKey;
    this.speak('人生总会有很多选择，在不同的路口，你会怎么选？', { force: true });
    // 试听不持久化（除非用户点"应用"）
    this._voicePresetKey = prev;
  }

  /**
   * 查询指定预设实际匹配到的 voice 信息（供 UI 显示，让用户看到真实匹配结果）。
   * @param {string} [key] - 预设 key，不传则查询当前预设
   * @returns {{ matched: boolean, voiceName: string, voiceLang: string, isMale: boolean|null }}
   */
  getMatchedVoiceInfo(key) {
    const targetKey = key || this._voicePresetKey;
    const preset = VOICE_PRESETS[targetKey] || VOICE_PRESETS.luo_style;
    const selected = this._selectVoice(preset);
    const chosen = selected.voice;

    // 判断实际 voice 性别（基于 voice name 关键词）
    const isMale = chosen ? this._isMaleVoice(chosen.name) : null;

    return {
      matched: selected.matched,
      voiceName: chosen ? chosen.name : '(无中文语音)',
      voiceLang: chosen ? (chosen.lang || '') : '',
      isMale,
      source: selected.source,
      expectMale: preset.gender === 'male'
    };
  }

  stopSpeaking(options = {}) {
    this._cancelSpeech({ notify: options.notify !== false });
  }

  /**
   * 是否正在朗读
   */
  isSpeaking() {
    return this._speechActive || this._speechQueue.length > 0;
  }

  /**
   * 兼容旧开关：关闭时恢复最近一次非关闭模式，开启时切到关闭。
   */
  toggleNarration() {
    const nextMode = this._narrationMode === 'off'
      ? (this._lastNarrationMode || 'highlights')
      : 'off';
    this.setNarrationMode(nextMode);
    return this._narrationEnabled;
  }

  setNarrationMode(mode) {
    if (!NARRATION_MODES[mode]) return this._narrationMode;
    this._narrationMode = mode;
    this._narrationEnabled = mode !== 'off';
    if (this._narrationEnabled) this._lastNarrationMode = mode;
    try {
      localStorage.setItem(NARRATION_MODE_KEY, mode);
      localStorage.setItem('luohammer_narration', String(this._narrationEnabled));
    } catch(e) {}
    if (!this._narrationEnabled) this.stopSpeaking();
    return this._narrationMode;
  }

  cycleNarrationMode() {
    const index = NARRATION_MODE_ORDER.indexOf(this._narrationMode);
    const next = NARRATION_MODE_ORDER[(index + 1) % NARRATION_MODE_ORDER.length];
    return this.setNarrationMode(next);
  }

  getNarrationMode() {
    return this._narrationMode;
  }

  getNarrationModeInfo() {
    return NARRATION_MODES[this._narrationMode] || NARRATION_MODES.highlights;
  }

  /**
   * 朗读是否开启
   */
  isNarrationEnabled() {
    return this._narrationMode !== 'off';
  }

  // ============================================================
  // 阶段与 BGM 映射
  // ============================================================

  /**
   * 根据阶段 ID 返回对应 BGM 类型。
   */
  getBGMTypeForStage(stageId) {
    switch (stageId) {
      case 'youth':
        return 'gameplay_youth';
      case 'teacher':
        return 'gameplay_teacher';
      case 'startup':
        return 'gameplay_startup';
      case 'dark':
        return 'gameplay_dark';
      case 'repay':
        return 'gameplay_repay';
      case 'reborn':
        return 'gameplay_reborn';
      default:
        return 'gameplay';
    }
  }

  /**
   * 清理资源（场景销毁时调用）
   */
  destroy() {
    if (this._destroyed) return;
    this._destroyed = true;

    if (this._sceneShutdownHandler && this.scene?.events?.off) {
      this.scene.events.off('shutdown', this._sceneShutdownHandler);
    }
    this._sceneShutdownHandler = null;

    for (const timer of this._sfxTimers) {
      clearTimeout(timer);
    }
    this._sfxTimers.clear();

    if (window.speechSynthesis && this._voiceChangeHandler) {
      if (typeof window.speechSynthesis.removeEventListener === 'function') {
        window.speechSynthesis.removeEventListener('voiceschanged', this._voiceChangeHandler);
      } else if (window.speechSynthesis.onvoiceschanged === this._voiceChangeHandler) {
        window.speechSynthesis.onvoiceschanged = this._previousVoiceChangeHandler;
      }
    }
    this._voiceChangeHandler = null;
    this._previousVoiceChangeHandler = null;

    // 标记禁用，阻止正在竞争的音频回调继续触发
    this.enabled = false;
    this._narrationEnabled = false;
    this._narrationMode = 'off';
    this.stopBGM();
    this.stopSpeaking({ notify: false });
    this._pendingSpeechEndCallbacks = [];
    // 注意：不 close 共享 AudioContext（避免场景切换时反复创建/关闭触发 Chrome 限制）
    // 仅清理本实例引用；共享 ctx 由模块级 _sharedCtx 保留，页面卸载时自动释放
    this.ctx = null;
    this._masterGain = null;
    this.scene = null;
  }
}
