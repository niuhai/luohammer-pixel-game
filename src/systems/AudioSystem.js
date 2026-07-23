// 模块级共享 AudioContext，避免场景切换时反复创建/关闭 ctx 触发 Chrome 限制（~6 个）
let _sharedCtx = null;
let _sharedMasterGain = null;

/**
 * 配音预设：通过 rate/pitch/voiceFilter 组合模拟不同朗读风格。
 *
 * 浏览器 TTS 仅能调用系统已安装语音，跨浏览器兼容性策略：
 * 1. 优先匹配原生男女声 voice name（覆盖微软/苹果/谷歌主流语音）
 * 2. 匹配失败时，将中文 voice 列表按名称排序后"前半视为男声、后半视为女声"分桶
 * 3. 若只有 1 个中文 voice，则完全依赖 rate/pitch 差异（差异已加大到 ±0.4）
 */
export const VOICE_PRESETS = {
  luo_style: {
    key: 'luo_style',
    label: '★罗永浩风格·中低音男声',
    desc: '中低音调、稍慢语速、有节奏停顿，模仿罗永浩演讲风格',
    rate: 0.85,          // 匹配到语音时的语速
    pitch: 0.80,         // 匹配到语音时的音调
    rateNoMatch: 0.78,   // 无匹配时的替代值
    pitchNoMatch: 0.65,
    gender: 'male',
    voiceFilter: (v) => v.lang && v.lang.startsWith('zh') && /kangkang|yunyang|liangliang|^yun$|male|男/i.test(v.name)
  },
  broadcast: {
    key: 'broadcast',
    label: '播音腔·沉稳男声',
    desc: '更低音调、更慢语速，类似新闻播报',
    rate: 0.78,
    pitch: 0.72,
    rateNoMatch: 0.72,
    pitchNoMatch: 0.60,
    gender: 'male',
    voiceFilter: (v) => v.lang && v.lang.startsWith('zh') && /kangkang|yunyang|liangliang|^yun$|male|男/i.test(v.name)
  },
  warm_female: {
    key: 'warm_female',
    label: '温和女声·叙事',
    desc: '中音调、稍慢语速，适合剧情朗读',
    rate: 0.92,
    pitch: 1.08,
    rateNoMatch: 0.90,
    pitchNoMatch: 1.20,
    gender: 'female',
    voiceFilter: (v) => v.lang && v.lang.startsWith('zh') && /huihui|yaoyao|tingting|hanhan|xiaoxiao|female|女/i.test(v.name)
  },
  young_female: {
    key: 'young_female',
    label: '明快女声·日常',
    desc: '稍高音调、正常语速，适合轻快场景',
    rate: 1.0,
    pitch: 1.15,
    rateNoMatch: 1.0,
    pitchNoMatch: 1.30,
    gender: 'female',
    voiceFilter: (v) => v.lang && v.lang.startsWith('zh') && /huihui|yaoyao|tingting|hanhan|xiaoxiao|female|女/i.test(v.name)
  },
  custom: {
    key: 'custom',
    label: '自定义音频·用户导入',
    desc: '播放用户导入的录音文件（非 TTS）。适合测试自己录制的配音效果',
    rate: 1.0,
    pitch: 1.0,
    rateNoMatch: 1.0,
    pitchNoMatch: 1.0,
    gender: null,
    voiceFilter: null
  }
};

const VOICE_PRESET_KEY = 'luohammer_voice_preset';

/**
 * Edge TTS 神经语音映射（微软免费在线 TTS，效果更好、男女分明）
 * 格式: zh-CN-{Name}Neural
 * 可在 https://tts.travisvn.com/ 试听所有语音
 */
const EDGE_TTS_VOICES = {
  luo_style: 'zh-CN-YunxiNeural',       // 云希 - 男声，自然流畅，适合演讲风格
  broadcast: 'zh-CN-YunjianNeural',     // 云健 - 男声，沉稳有力，适合播报
  warm_female: 'zh-CN-XiaoxiaoNeural',   // 晓晓 - 女声，温暖亲切
  young_female: 'zh-CN-XiaoyiNeural'     // 晓伊 - 女声，年轻明快
};

/** Edge TTS 速率映射（转换为百分比字符串） */
const EDGE_TTS_RATE_MAP = {
  luo_style: '-15%',
  broadcast: '-25%',
  warm_female: '-10%',
  young_female: 'default'
};

/** Edge TTS 库实例（懒加载） */
const _edgeTTSInstance = null;

export class AudioSystem {
  constructor(scene) {
    this.scene = scene;
    this.ctx = null;
    this.enabled = true;
    this.masterVolume = 0.6;       // 主音量 0~1
    this.sfxVolume = 0.7;          // 音效音量比例
    this.bgmVolume = 0.25;         // 背景音乐音量比例（低于音效）
    this.lastTypewriterTime = 0;
    this.typewriterPhase = 0;
    this._bgmGain = null;          // BGM增益节点
    this._bgmPlaying = false;
    this._bgmType = null;
    this._masterGain = null;       // 主增益节点，所有音效统一经过
    this._bgmTimer = null;
    this._lastHoverTime = 0;       // 防止hover音效过于频繁
    this._narrationEnabled = true; // 剧情朗读默认开启
    this._cachedVoices = [];       // 缓存TTS语音列表
    this._ttsResumeTimer = null;   // Chrome长文本bug修复定时器
    this._customAudioUrl = null;  // 自定义音频 Blob URL
    this._customAudioEl = null;   // 自定义音频 <audio> 元素
    this._pendingSpeechEndCallbacks = []; // 朗读结束回调队列（用于剧情自动推进同步）
    // 当前配音预设（持久化到 localStorage），默认为罗永浩风格（推荐）
    this._voicePresetKey = 'luo_style';
    /** 是否使用 Edge TTS（在线神经语音，效果更好、男女分明） */
    this._useEdgeTTS = true;
    /** Edge TTS 朗读结束回调 */
    this._edgeTTSEndCallbacks = [];
    try {
      const saved = localStorage.getItem('luohammer_audio');
      if (saved !== null) this.enabled = saved === 'true';
      const vol = localStorage.getItem('luohammer_volume');
      if (vol !== null) this.masterVolume = Math.max(0, Math.min(1, parseFloat(vol)));
      const narr = localStorage.getItem('luohammer_narration');
      if (narr !== null) this._narrationEnabled = narr === 'true';
      const preset = localStorage.getItem(VOICE_PRESET_KEY);
      if (preset && VOICE_PRESETS[preset]) this._voicePresetKey = preset;
      // 读取 Edge TTS 开关偏好
      const edge = localStorage.getItem('luohammer_edge_tts');
      if (edge !== null) this._useEdgeTTS = edge === 'true';
    } catch(e) {}
    // 预加载TTS语音列表
    this._initVoices();
    // 恢复已存的自定义音频（刷新后仍可用）
    try {
      const savedBase64 = localStorage.getItem('luohammer_custom_voice');
      const savedType = localStorage.getItem('luohammer_custom_voice_type') || 'audio/mpeg';
      if (savedBase64) this._loadCustomAudio(savedBase64, savedType);
    } catch(e) {}
  }

  _initVoices() {
    if (!window.speechSynthesis) return;
    const loadVoices = () => {
      this._cachedVoices = window.speechSynthesis.getVoices();
    };
    loadVoices();
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }

  _getCtx() {
    if (!_sharedCtx) {
      _sharedCtx = new (window.AudioContext || window.webkitAudioContext)();
      // 创建共享主增益节点，所有音效统一经过此节点控制
      _sharedMasterGain = _sharedCtx.createGain();
      _sharedMasterGain.gain.setValueAtTime(this.masterVolume, _sharedCtx.currentTime);
      _sharedMasterGain.connect(_sharedCtx.destination);
    }
    // 当前实例引用共享 ctx（便于实例方法访问）
    this.ctx = _sharedCtx;
    this._masterGain = _sharedMasterGain;
    // 同步主音量（用户可能修改了设置）
    try {
      _sharedMasterGain.gain.setValueAtTime(this.masterVolume, _sharedCtx.currentTime);
    } catch(e) {}
    // 确保AudioContext处于运行状态（浏览器自动暂停策略）
    if (_sharedCtx.state === 'suspended') {
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

  /** 实际音量 = 主音量 × 类型比例 */
  _sfxVol(v) { return v * this.sfxVolume; }
  _bgmVol(v) { return v * this.bgmVolume; }

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
    this._playTone(1100, 0.025, 'square', 0.04);
  }

  // ============================================================
  // 用户操作
  // ============================================================

  /**
   * 选择/确认 —— 清脆的两声上行（"叮—咚"）。
   */
  playChoice() {
    this._playTone(660, 0.07);
    setTimeout(() => this._playTone(990, 0.09), 55);
  }

  /**
   * 天赋选中 —— 闪亮的确认音，带回响。
   */
  playTalentSelect() {
    this._playTone(880, 0.08, 'triangle', 0.1);
    setTimeout(() => this._playTone(1100, 0.06, 'triangle', 0.08), 60);
    setTimeout(() => this._playTone(1320, 0.15, 'sine', 0.06), 120);
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
   */
  async unlock() {
    if (!this.enabled) return;
    try {
      const ctx = this._getCtx();
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }
    } catch (e) {}
  }

  // ============================================================
  // 正面事件
  // ============================================================

  /**
   * 成就解锁 —— 经典大三和弦琶音（C-E-G），上行渐强。
   */
  playAchievement() {
    this._playTone(523, 0.09);  // C5
    setTimeout(() => this._playTone(659, 0.09), 90); // E5
    setTimeout(() => this._playTone(784, 0.09), 180); // G5
    setTimeout(() => this._playTone(1047, 0.18), 270); // C6
  }

  /**
   * 稀有成就 —— 更华丽的琶音 + 高音闪烁。
   */
  playAchievementRare() {
    this._playTone(523, 0.08, 'triangle', 0.1);   // C5
    setTimeout(() => this._playTone(659, 0.08, 'triangle', 0.1), 70);  // E5
    setTimeout(() => this._playTone(784, 0.08, 'triangle', 0.1), 140); // G5
    setTimeout(() => this._playTone(1047, 0.08, 'triangle', 0.1), 210); // C6
    setTimeout(() => this._playTone(1319, 0.12, 'sine', 0.08), 280);   // E6
    setTimeout(() => this._playTone(1568, 0.25, 'sine', 0.07), 360);   // G6 闪耀收尾
  }

  /**
   * 传说成就 —— 史诗级全音阶上行 + 和弦收尾。
   */
  playAchievementLegendary() {
    const notes = [523, 587, 659, 784, 880, 1047, 1175, 1319];
    notes.forEach((freq, i) => {
      setTimeout(() => this._playTone(freq, 0.1, 'triangle', 0.08 + i * 0.005), i * 60);
    });
    // 和弦收尾
    setTimeout(() => {
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
    setTimeout(() => this._playTone(base * 1.5, 0.12, 'triangle', 0.06), 60);
  }

  /**
   * 阶段结算 —— 号角般的上行三音，庄重感。
   */
  playStageSettlement() {
    this._playTone(330, 0.15, 'triangle', 0.09);  // E4
    setTimeout(() => this._playTone(440, 0.15, 'triangle', 0.09), 150); // A4
    setTimeout(() => this._playTone(660, 0.3, 'triangle', 0.1), 300);   // E5 长音
  }

  /**
   * 历史对照 —— 怀旧的回响音，像老唱片。
   */
  playHistoryCard() {
    this._playTone(440, 0.12, 'sine', 0.06);
    setTimeout(() => this._playTone(392, 0.15, 'sine', 0.05), 120);
    setTimeout(() => this._playTone(349, 0.2, 'sine', 0.04), 250);  // 渐弱回响
  }

  /**
   * 随机事件 —— 意外的叮咚，带点俏皮。
   */
  playRandomEvent() {
    this._playTone(784, 0.06, 'square', 0.07);  // G5 短促
    setTimeout(() => this._playTone(988, 0.06, 'square', 0.07), 80); // B5
    setTimeout(() => this._playTone(1175, 0.12, 'triangle', 0.06), 160); // D6
  }

  /**
   * 阈值触发/隐藏事件 —— 神秘的泛音。
   */
  playThresholdTrigger() {
    this._playTone(660, 0.15, 'sine', 0.06);
    setTimeout(() => this._playTone(880, 0.12, 'sine', 0.05), 100);
    setTimeout(() => this._playTone(1100, 0.2, 'sine', 0.04), 200);
  }

  /**
   * 远期后果回响 —— 低沉的回声。
   */
  playConsequence() {
    this._playTone(262, 0.2, 'triangle', 0.07);  // C4
    setTimeout(() => this._playTone(220, 0.25, 'triangle', 0.05), 180); // A3 回响
  }

  // ============================================================
  // 结局
  // ============================================================

  /**
   * 结局（默认）—— 庄严的下行音阶。
   */
  playEnding() {
    this._playTone(523, 0.18, 'triangle', 0.09);
    setTimeout(() => this._playTone(392, 0.18, 'triangle', 0.09), 180);
    setTimeout(() => this._playTone(330, 0.2, 'triangle', 0.09), 360);
    setTimeout(() => this._playTone(262, 0.4, 'triangle', 0.1), 540);
  }

  /**
   * 传奇结局 —— 辉煌的上行音阶 + 大三和弦。
   */
  playEndingLegendary() {
    const scale = [262, 330, 392, 523, 659, 784, 1047];
    scale.forEach((freq, i) => {
      setTimeout(() => this._playTone(freq, 0.12, 'triangle', 0.08 + i * 0.003), i * 80);
    });
    setTimeout(() => {
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
    setTimeout(() => this._playTone(392, 0.25, 'triangle', 0.07), 200); // G4
    setTimeout(() => this._playTone(311, 0.3, 'sawtooth', 0.05), 400);  // Eb4 小调
    setTimeout(() => this._playTone(262, 0.5, 'sawtooth', 0.04), 600);  // C4 低沉收尾
  }

  /**
   * 平和结局 —— 温暖的大三和弦，缓慢。
   */
  playEndingPeaceful() {
    this._playTone(262, 0.3, 'sine', 0.06);  // C4
    setTimeout(() => this._playTone(330, 0.3, 'sine', 0.06), 150); // E4
    setTimeout(() => this._playTone(392, 0.4, 'sine', 0.06), 300); // G4
    setTimeout(() => {
      this._playTone(523, 0.5, 'sine', 0.05);  // C5
      this._playTone(659, 0.5, 'sine', 0.04);  // E5
    }, 500);
  }

  /**
   * 场景过渡 —— 短促低频下滑。
   */
  playTransition() {
    this._playTone(300, 0.12, 'sine', 0.07);
    setTimeout(() => this._playTone(220, 0.15, 'sine', 0.06), 100);
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
    setTimeout(() => this._playTone(base * 0.75, 0.14, 'sawtooth', 0.06), 70);
  }

  /**
   * 翻车（压力崩溃/大失败）—— 噪音 + 下行锯齿。
   */
  playCrash() {
    this._playNoise(0.3, 0.12);
    setTimeout(() => this._playTone(180, 0.25, 'sawtooth', 0.08), 120);
    setTimeout(() => this._playTone(90, 0.35, 'sawtooth', 0.06), 260);
  }

  /**
   * 压力警告 —— 紧张的低频脉冲，像心跳加速。
   */
  playPressureWarning() {
    for (let i = 0; i < 3; i++) {
      setTimeout(() => {
        this._playTone(110, 0.08, 'sawtooth', 0.06);
        setTimeout(() => this._playTone(120, 0.06, 'sawtooth', 0.05), 50);
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
   * @param {string} type 'menu' | 'gameplay' | 'ending_legendary' | 'ending_tragic' | 'ending_peaceful' | 'ending_default'
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
        this._bgmVol(0.15), ctx.currentTime + 1.5
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
      case 'gameplay_hopeful':
        // 还债/新生：温暖上扬的正弦波，带节奏感
        return [
          [{freq:262,dur:0.3,type:'sine',vol:0.06},{freq:131,dur:0.3,type:'triangle',vol:0.03}],
          {freq:0,dur:0.15},
          [{freq:330,dur:0.3,type:'sine',vol:0.06},{freq:165,dur:0.3,type:'triangle',vol:0.03}],
          {freq:0,dur:0.15},
          [{freq:392,dur:0.35,type:'sine',vol:0.07},{freq:196,dur:0.35,type:'triangle',vol:0.03}],
          {freq:0,dur:0.2},
          [{freq:330,dur:0.3,type:'sine',vol:0.05},{freq:165,dur:0.3,type:'triangle',vol:0.03}],
          {freq:0,dur:0.15},
          [{freq:262,dur:0.4,type:'sine',vol:0.05},{freq:131,dur:0.4,type:'triangle',vol:0.03}],
          {freq:0,dur:0.3},
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

    const ctx = this._getCtx();
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
              this._bgmVol(0.15), ctx2.currentTime + fadeSec
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
          this._bgmVol(0.15), this._getCtx().currentTime
        );
      } catch(e) {}
    }
  }

  // ============================================================
  // 开关
  // ============================================================

  toggle() {
    this.enabled = !this.enabled;
    try { localStorage.setItem('luohammer_audio', this.enabled.toString()); } catch(e) {}
    if (!this.enabled) {
      this.stopBGM();
    } else {
      this._playTone(880, 0.05, 'sine', 0.08);
    }
  }

  // ============================================================
  // 剧情朗读（Web Speech API TTS）
  // ============================================================

  /**
   * 朗读文本。使用浏览器内置 speechSynthesis API。
   * 自动选择中文语音，调整语速和音调以适配叙事风格。
   * 朗读参数优先级：opts > 当前 voicePreset > 默认值。
   * @param {string} text - 要朗读的文本
   * @param {object} opts - { rate, pitch, voiceName, force } force=true 时无视 _narrationEnabled 开关强制朗读（用于试听）
   */
  speak(text, opts = {}) {
    // force=true 时绕过 narrationEnabled 开关（供试听按钮使用）
    const force = opts.force === true;
    if (!this.enabled) return;
    if (!force && !this._narrationEnabled) return;
    if (!text) return;

    // === 自定义音频预设：播放用户导入的音频文件而非 TTS ===
    if (this._voicePresetKey === 'custom' && this._customAudioUrl) {
      this._playCustomAudio();
      return;
    }

    if (!window.speechSynthesis) return;

    // 停止上一段朗读
    window.speechSynthesis.cancel();
    if (this._ttsResumeTimer) {
      clearInterval(this._ttsResumeTimer);
      this._ttsResumeTimer = null;
    }

    // 清理文本：去掉引号、特殊符号，分段避免长文本被截断
    const cleanText = text
      .replace(/[「」""''《》]/g, '')
      .replace(/\n+/g, '，')
      .replace(/—{2,}/g, '——')
      .trim();

    if (!cleanText) return;

    // 加载当前配音预设参数（opts 可覆盖）
    const preset = VOICE_PRESETS[this._voicePresetKey] || VOICE_PRESETS.luo_style;

    const utter = new SpeechSynthesisUtterance(cleanText);
    utter.lang = 'zh-CN';

    // === 语音选择策略 ===
    const voices = this._cachedVoices.length > 0 ? this._cachedVoices : window.speechSynthesis.getVoices();
    const zhVoices = voices
      .filter(v => v.lang && v.lang.toLowerCase().startsWith('zh'))
      .sort((a, b) => a.name.localeCompare(b.name)); // 稳定排序，便于分桶

    let chosenVoice = null;

    // 1. 优先按 voiceFilter 精确匹配
    if (preset.voiceFilter && zhVoices.length > 0) {
      chosenVoice = zhVoices.find(v => preset.voiceFilter(v));
    }

    // 2. 分桶策略：多个中文 voice 时，按 gender 选前半/后半
    if (!chosenVoice && zhVoices.length >= 2 && preset.gender) {
      const mid = Math.floor(zhVoices.length / 2);
      const bucket = preset.gender === 'male' ? zhVoices.slice(0, mid) : zhVoices.slice(mid);
      if (bucket.length > 0) {
        chosenVoice = bucket[0];
      }
    }

    // 3. 最终回退：任意中文 voice
    if (!chosenVoice && zhVoices.length > 0) {
      chosenVoice = zhVoices[0];
    }

    // === 应用 pitch/rate：匹配成功用温和值，否则用极端值做补偿 ===
    const voiceMatched = chosenVoice !== null;
    if (opts.rate != null) {
      utter.rate = opts.rate;
    } else {
      utter.rate = voiceMatched ? preset.rate : (preset.rateNoMatch ?? preset.rate);
    }
    if (opts.pitch != null) {
      utter.pitch = opts.pitch;
    } else {
      utter.pitch = voiceMatched ? preset.pitch : (preset.pitchNoMatch ?? preset.pitch);
    }
    utter.volume = this.masterVolume * 0.9;

    if (chosenVoice) utter.voice = chosenVoice;

    // 显式指定 voiceName 时覆盖（向后兼容 opts.voiceName）
    if (opts.voiceName) {
      const v = voices.find(v => v.name === opts.voiceName);
      if (v) utter.voice = v;
    }

    // Chrome长文本bug修复：每10秒resume一次防止朗读停止
    utter.onstart = () => {
      this._ttsResumeTimer = setInterval(() => {
        if (window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
          window.speechSynthesis.pause();
          window.speechSynthesis.resume();
        }
      }, 10000);
    };
    utter.onend = () => {
      if (this._ttsResumeTimer) {
        clearInterval(this._ttsResumeTimer);
        this._ttsResumeTimer = null;
      }
      this._flushSpeechEndCallbacks();
    };
    utter.onerror = () => {
      if (this._ttsResumeTimer) {
        clearInterval(this._ttsResumeTimer);
        this._ttsResumeTimer = null;
      }
      // 出错也要触发回调，避免剧情卡死
      this._flushSpeechEndCallbacks();
    };

    window.speechSynthesis.speak(utter);
  }

  /**
   * 注册一次性回调：当前 TTS 朗读结束后触发。
   * 用于剧情自动推进同步：打字完成后若 TTS 仍在朗读，注册此回调等其结束再推进。
   * 若当前没有朗读，回调立即触发。
   * @param {function} cb
   */
  onceSpeechEnd(cb) {
    if (typeof cb !== 'function') return;
    if (!this.isSpeaking() && !this._isCustomAudioPlaying()) {
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

  _isCustomAudioPlaying() {
    return this._customAudioEl && !this._customAudioEl.paused && !this._customAudioEl.ended;
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

    // custom 预设：返回自定义音频状态而非 TTS voice 信息
    if (targetKey === 'custom') {
      return {
        matched: this.hasCustomVoice(),
        voiceName: this.hasCustomVoice() ? '已导入自定义音频' : '未导入音频',
        voiceLang: '',
        isMale: null,
        expectMale: false
      };
    }

    const voices = this._cachedVoices.length > 0 ? this._cachedVoices :
                   (window.speechSynthesis ? window.speechSynthesis.getVoices() : []);

    let chosen = null;
    let matched = false;
    if (preset.voiceFilter && voices.length > 0) {
      chosen = voices.find(v => preset.voiceFilter(v));
      if (chosen) matched = true;
    }
    if (!chosen) {
      // 回退：任意中文 voice
      chosen = voices.find(v => v.lang && v.lang.startsWith('zh')) ||
              voices.find(v => v.name && v.name.includes('Chinese')) ||
              voices.find(v => v.name && v.name.includes('中文'));
    }

    // 判断实际 voice 性别（基于 voice name 关键词）
    let isMale = null;
    if (chosen) {
      const name = chosen.name || '';
      if (/kangkang|yunyang|liangliang|^yun$|male|男/i.test(name)) isMale = true;
      else if (/huihui|yaoyao|tingting|hanhan|xiaoxiao|female|女/i.test(name)) isMale = false;
    }

    return {
      matched,                                          // 是否精确匹配到预设期望的 voice
      voiceName: chosen ? chosen.name : '(无中文语音)',
      voiceLang: chosen ? (chosen.lang || '') : '',
      isMale,                                           // 实际 voice 的性别推断
      expectMale: preset.voiceFilter ? /kangkang|yunyang|liangliang|^yun$|male|男/i.test(preset.voiceFilter.toString()) : false
    };
  }

  /**
   * 获取系统所有中文 voice 列表（供调试面板显示）
   * @returns {Array<{name: string, lang: string, isMale: boolean|null}>}
   */
  listSystemZhVoices() {
    const voices = this._cachedVoices.length > 0 ? this._cachedVoices :
                   (window.speechSynthesis ? window.speechSynthesis.getVoices() : []);
    const zh = voices.filter(v => v.lang && v.lang.startsWith('zh'));
    return zh.map(v => {
      let isMale = null;
      const name = v.name || '';
      if (/kangkang|yunyang|liangliang|^yun$|male|男/i.test(name)) isMale = true;
      else if (/huihui|yaoyao|tingting|hanhan|xiaoxiao|female|女/i.test(name)) isMale = false;
      return { name, lang: v.lang || '', isMale };
    });
  }

  stopSpeaking() {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    if (this._ttsResumeTimer) {
      clearInterval(this._ttsResumeTimer);
      this._ttsResumeTimer = null;
    }
    // 同步停止自定义音频播放
    if (this._customAudioEl) {
      try { this._customAudioEl.pause(); this._customAudioEl.currentTime = 0; } catch(e) {}
    }
  }

  /**
   * 导入自定义音频文件作为配音源
   * @param {File} file - 用户上传的音频文件（mp3/wav/ogg/m4a 等）
   * @returns {Promise<{ok: boolean, error?: string}>}
   */
  async importCustomVoice(file) {
    if (!file) return { ok: false, error: '未选择文件' };
    // 限制文件大小 2MB（localStorage 存 base64 约 2.7MB 上限）
    const MAX_SIZE = 2 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      return { ok: false, error: `文件过大（${(file.size/1024/1024).toFixed(2)}MB），请控制在 2MB 以内` };
    }
    try {
      // 读取为 base64 存入 localStorage（刷新后仍可用）
      const base64 = await this._fileToBase64(file);
      localStorage.setItem('luohammer_custom_voice', base64);
      localStorage.setItem('luohammer_custom_voice_type', file.type || 'audio/mpeg');
      // 立即加载到内存
      this._loadCustomAudio(base64, file.type || 'audio/mpeg');
      return { ok: true };
    } catch(e) {
      return { ok: false, error: '导入失败：' + (e.message || String(e)) };
    }
  }

  /**
   * 从 localStorage 恢复自定义音频
   */
  _loadCustomAudio(base64, type) {
    if (!base64) {
      this._customAudioUrl = null;
      this._customAudioEl = null;
      return;
    }
    // 释放旧的 URL
    if (this._customAudioUrl) {
      try { URL.revokeObjectURL(this._customAudioUrl); } catch(e) {}
    }
    // base64 → Blob → Object URL
    try {
      const byteString = atob(base64.split(',')[1] || base64);
      const mime = type || (base64.match(/^data:([^;]+);/) || [])[1] || 'audio/mpeg';
      const ab = new ArrayBuffer(byteString.length);
      const ia = new Uint8Array(ab);
      for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
      const blob = new Blob([ab], { type: mime });
      this._customAudioUrl = URL.createObjectURL(blob);
      this._customAudioEl = new Audio(this._customAudioUrl);
      this._customAudioEl.volume = this.masterVolume * 0.9;
    } catch(e) {
      console.warn('[AudioSystem] loadCustomAudio failed:', e);
      this._customAudioUrl = null;
      this._customAudioEl = null;
    }
  }

  /**
   * 播放自定义音频（speak 的替代实现）
   */
  _playCustomAudio() {
    if (!this._customAudioEl) return;
    try {
      this._customAudioEl.pause();
      this._customAudioEl.currentTime = 0;
      this._customAudioEl.volume = this.masterVolume * 0.9;
      // 监听 ended 事件触发待处理回调（与 TTS utter.onend 行为一致）
      const onEnded = () => {
        this._customAudioEl.removeEventListener('ended', onEnded);
        this._flushSpeechEndCallbacks();
      };
      this._customAudioEl.addEventListener('ended', onEnded);
      this._customAudioEl.play().catch(e => {
        console.warn('[AudioSystem] 自定义音频播放失败:', e);
        // 播放失败也触发回调，避免剧情卡死
        this._flushSpeechEndCallbacks();
      });
    } catch(e) {
      console.warn('[AudioSystem] playCustomAudio error:', e);
      this._flushSpeechEndCallbacks();
    }
  }

  /**
   * 判断是否已导入自定义音频
   */
  hasCustomVoice() {
    return !!this._customAudioEl;
  }

  /**
   * 清除自定义音频
   */
  clearCustomVoice() {
    if (this._customAudioUrl) {
      try { URL.revokeObjectURL(this._customAudioUrl); } catch(e) {}
    }
    this._customAudioUrl = null;
    this._customAudioEl = null;
    try {
      localStorage.removeItem('luohammer_custom_voice');
      localStorage.removeItem('luohammer_custom_voice_type');
    } catch(e) {}
  }

  _fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('文件读取失败'));
      reader.readAsDataURL(file);
    });
  }

  /**
   * 是否正在朗读
   */
  isSpeaking() {
    return window.speechSynthesis && window.speechSynthesis.speaking;
  }

  /**
   * 开关剧情朗读
   */
  toggleNarration() {
    this._narrationEnabled = !this._narrationEnabled;
    try {
      localStorage.setItem('luohammer_narration', this._narrationEnabled.toString());
    } catch(e) {}
    if (!this._narrationEnabled) {
      this.stopSpeaking();
    }
    return this._narrationEnabled;
  }

  /**
   * 朗读是否开启
   */
  isNarrationEnabled() {
    return this._narrationEnabled;
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
      case 'teacher':
      case 'startup':
        return 'gameplay';
      case 'dark':
        return 'gameplay_dark';
      case 'repay':
      case 'reborn':
        return 'gameplay_hopeful';
      default:
        return 'gameplay';
    }
  }

  /**
   * 清理资源（场景销毁时调用）
   */
  destroy() {
    // 标记已销毁，阻止定时器回调继续触发
    this.enabled = false;
    this._narrationEnabled = false;
    this.stopBGM();
    this.stopSpeaking();
    // 注意：不 close 共享 AudioContext（避免场景切换时反复创建/关闭触发 Chrome 限制）
    // 仅清理本实例引用；共享 ctx 由模块级 _sharedCtx 保留，页面卸载时自动释放
    this.ctx = null;
    this._masterGain = null;
  }
}
