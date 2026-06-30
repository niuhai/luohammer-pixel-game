import { getCharacterColor } from '../config.js';
import { SaveSystem } from './SaveSystem.js';

const SETTINGS_KEY = 'luohammer_dialog_settings';
const TYPING_SPEEDS = [120, 75, 40];          // 每字间隔 ms：慢 / 中 / 快
const TYPING_SPEED_LABELS = ['慢', '中', '快'];

export class DialogSystem {
  // === 长文本拆分阈值 ===
  static SPLIT_MIN_LENGTH = 150;  // 超过此字数才拆分
  static SPLIT_TARGET_MIN = 100;  // 每段最少字数
  static SPLIT_TARGET_MAX = 150;  // 每段最多字数

  constructor(scene) {
    this.scene = scene;
    this.isTyping = false;
    this.typingTimer = null;
    this.fullText = '';
    this.currentIndex = 0;
    this.onComplete = null;
    this.audio = null;
    this.hintTween = null;
    // === 打字机累积时间（替代逐字 delayedCall，减少定时器创建开销）===
    this._typingAccum = 0;
    this._typingInterval = 30; // 每字间隔 ms
    this._typingActive = false;
    // === 多段叙事状态 ===
    this._segments = null;       // 拆分后的段落数组，null 表示不拆分
    this._segmentIndex = 0;      // 当前段落索引
    this._finalOnComplete = null; // 最后一段完成后的回调
    // === 自动播放状态（T28）：默认开启，仅控制文字是否自动逐字打出 ===
    this._settings = this._loadSettings();
    this._autoPlay = this._settings.autoPlay;
    this._typingSpeedIdx = this._settings.typingSpeedIdx;
    this._typingInterval = TYPING_SPEEDS[this._typingSpeedIdx];
    // === Hook 系统：外部可以在这些时机插入回调 ===
    this.hooks = {
      onTextStart: null,     // 开始打字时 (characterName, text) => void
      onTextComplete: null,  // 文字打完时 (characterName, text) => void
      onChoice: null,        // 用户点击继续时 (characterName, text) => void
      onShow: null,          // 对话框显示时
      onHide: null           // 对话框隐藏时
    };

    // DOM elements
    this.el = document.getElementById('ui-dialog');
    this.nameEl = document.getElementById('ui-dialog-name');
    this.textEl = document.getElementById('ui-dialog-text');
    this.continueEl = document.getElementById('ui-dialog-continue');
    this.autoBtn = document.getElementById('ui-dialog-auto');
    this.overlayEl = document.getElementById('ui-overlay');

    // 选择面板引用（用于计算对话框上移距离）
    this.choicesEl = document.getElementById('ui-choices');

    // 使用 AbortController 管理 DOM 事件监听器，确保 destroy 时能移除
    this._abortController = new AbortController();
    const signalOpts = { signal: this._abortController.signal };

    // Click handler for advancing text
    this._onDialogClick = () => {
      if (this.isTyping) {
        this.skipTyping();
      } else if (this._segments && this._segmentIndex < this._segments.length - 1) {
        // === 多段叙事：点击继续显示下一段 ===
        if (this.hooks.onChoice) {
          try { this.hooks.onChoice(this.currentCharacterName, this.fullText); } catch(e) {}
        }
        this._stopPulse();
        this._segmentIndex++;
        this._showSegment(this._segmentIndex);
      } else if (this.onComplete) {
        // === Hook: onChoice — 用户点击继续 ===
        if (this.hooks.onChoice) {
          try { this.hooks.onChoice(this.currentCharacterName, this.fullText); } catch(e) {}
        }
        const cb = this.onComplete;
        this.onComplete = null;
        this._stopPulse();
        cb();
      }
    };
    this.el.addEventListener('click', () => {
      if (this.scene && typeof this.scene.vibrate === 'function') this.scene.vibrate(12);
      this._onDialogClick();
    }, signalOpts);

    // 下半屏点击捕获层：与对话框同步显示/隐藏，扩展移动端点击热区
    this.touchLayer = document.getElementById('dialog-touch-layer');
    if (this.touchLayer) {
      this.touchLayer.addEventListener('click', () => {
        if (this.scene && typeof this.scene.vibrate === 'function') this.scene.vibrate(12);
        this._onDialogClick();
      }, signalOpts);
    }

    // === 自动播放开关按钮（T28）===
    if (this.autoBtn) {
      this.autoBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this._toggleAutoPlay();
      }, signalOpts);
    }

    // === 自动播放 & 速度快捷键（T28） ===
    this._keyHandler = (e) => {
      const key = e.key.toLowerCase();
      if (key === 'a') {
        e.preventDefault();
        this._toggleAutoPlay();
      } else if (key === 's') {
        e.preventDefault();
        this._cycleTypingSpeed();
      } else if (key === ' ' || key === 'enter' || e.code === 'Space') {
        e.preventDefault();
        if (this.scene && typeof this.scene.vibrate === 'function') this.scene.vibrate(12);
        this._onDialogClick();
      }
    };
    this._keyAbortController = new AbortController();
    document.addEventListener('keydown', this._keyHandler, { signal: this._keyAbortController.signal });

    // 初始化 UI 状态
    this._applyAutoPlayState();

    // === 移动端手势支持（左滑回退 / 右滑继续）===
    this._setupGestures();
  }

  /**
   * 设置 Hook 回调
   * @param {string} name - hook 名称 (onTextStart/onTextComplete/onChoice/onShow/onHide)
   * @param {function|null} fn - 回调函数，传 null 清除
   */
  setHook(name, fn) {
    if (this.hooks && Object.prototype.hasOwnProperty.call(this.hooks, name)) {
      this.hooks[name] = fn;
    }
  }

  /**
   * 设置移动端手势支持（左滑回退、右滑继续）
   * - 只在触摸设备上启用
   * - 使用 passive: true，不阻止默认行为
   * - 监听器通过 _abortController 管理，destroy 时自动移除
   */
  _setupGestures() {
    if (!('ontouchstart' in window)) return;

    // 附加到下半屏点击层和对话框本身，覆盖完整滑动区域
    const targets = [this.touchLayer, this.el].filter(Boolean);
    if (targets.length === 0) return;

    const SWIPE_THRESHOLD = 50; // 最小滑动距离（px）
    const SWIPE_TIME = 500;     // 最大滑动时间（ms）

    targets.forEach((target) => {
      let startX = 0, startY = 0, startTime = 0;

      target.addEventListener('touchstart', (e) => {
        if (this._isChoicesVisible()) return;
        const touch = e.touches[0];
        startX = touch.clientX;
        startY = touch.clientY;
        startTime = Date.now();
      }, { signal: this._abortController.signal, passive: true });

      target.addEventListener('touchend', (e) => {
        if (this._isChoicesVisible()) return;
        const touch = e.changedTouches[0];
        const dx = touch.clientX - startX;
        const dy = touch.clientY - startY;
        const dt = Date.now() - startTime;

        if (dt > SWIPE_TIME) return; // 太慢不算滑动

        if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > SWIPE_THRESHOLD) {
          if (this.scene && typeof this.scene.vibrate === 'function') this.scene.vibrate(10);
          if (dx > 0) {
            this._onSwipeRight();
          } else {
            this._onSwipeLeft();
          }
        }
      }, { signal: this._abortController.signal, passive: true });
    });
  }

  /**
   * 判断选项面板是否可见（可见时禁用滑动手势）
   */
  _isChoicesVisible() {
    const choicesEl = document.getElementById('ui-choices');
    return choicesEl && choicesEl.classList.contains('visible');
  }

  /**
   * 右滑：等同于点击对话框
   * - 打字中：完成打字
   * - 打字完成：继续下一段 / 触发 onComplete
   */
  _onSwipeRight() {
    this._onDialogClick();
  }

  /**
   * 左滑：多段叙事模式下回退到上一段
   * - 仅在打字完成后生效
   * - 已经是第一段时不响应
   * - 回退时不恢复属性，只重新显示上一段文字
   */
  _onSwipeLeft() {
    if (this.isTyping) return;
    if (this._segments && this._segmentIndex > 0) {
      this._stopPulse();
      this._segmentIndex--;
      this._showSegment(this._segmentIndex);
    }
  }

  /**
   * 从 localStorage 读取用户偏好
   */
  _loadSettings() {
    try {
      const raw = window.localStorage.getItem(SETTINGS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (typeof parsed.autoPlay === 'boolean' &&
            typeof parsed.typingSpeedIdx === 'number' &&
            parsed.typingSpeedIdx >= 0 &&
            parsed.typingSpeedIdx < TYPING_SPEEDS.length) {
          return { autoPlay: parsed.autoPlay, typingSpeedIdx: parsed.typingSpeedIdx };
        }
      }
    } catch (e) {}
    return { autoPlay: true, typingSpeedIdx: 1 };
  }

  /**
   * 保存用户偏好到 localStorage
   */
  _saveSettings() {
    try {
      window.localStorage.setItem(SETTINGS_KEY, JSON.stringify({
        autoPlay: this._autoPlay,
        typingSpeedIdx: this._typingSpeedIdx
      }));
    } catch (e) {}
  }

  /**
   * 将长文本按自然断句拆分为多段
   * 规则：按句号/感叹号/问号/换行符断句，每段 100-150 字，不在词中间断
   * 短文本（<150字）返回 null，表示不需要拆分
   * @param {string} text - 原始文本
   * @returns {string[]|null} 拆分后的段落数组，或 null
   */
  static splitLongText(text) {
    if (!text || text.length <= DialogSystem.SPLIT_MIN_LENGTH) {
      return null;
    }

    // 第一步：按换行符预拆分（换行是天然的段落边界）
    const lines = text.split(/\n/);
    const preSegments = [];
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed) preSegments.push(trimmed);
    }

    // 第二步：对每个预段按自然断句符号拆分为句子
    // 句号、感叹号、问号（中英文都支持），保留分隔符在句子末尾
    const sentences = [];
    for (const seg of preSegments) {
      // 使用更健壮的正则：匹配非断句符号的字符序列，后跟可选的断句符号
      const regex = /[^。！？!?\.]+[。！？!?\.]*/g;
      let match;
      while ((match = regex.exec(seg)) !== null) {
        const s = match[0].trim();
        if (s) sentences.push(s);
      }
      // 如果正则没匹配到任何内容（极端情况），将整段作为一个句子
      if (sentences.length === 0 || sentences[sentences.length - 1] !== seg.trim()) {
        // 检查是否有遗漏的文本
        const matched = (seg.match(/[^。！？!?\.]+[。！？!?\.]*/g) || []).join('');
        const remainder = seg.replace(/[^。！？!?\.]+[。！？!?\.]*/g, '').trim();
        if (remainder) sentences.push(remainder);
      }
    }

    if (sentences.length === 0) return null;

    // 第三步：将句子合并为段落，每段目标 100-150 字
    const segments = [];
    let current = '';

    for (const sentence of sentences) {
      // 如果当前段为空，直接加入
      if (current.length === 0) {
        current = sentence;
        continue;
      }

      // 如果加入这句后仍在目标最大范围内，合并
      if (current.length + sentence.length <= DialogSystem.SPLIT_TARGET_MAX) {
        current += sentence;
      } else {
        // 当前段已达到或超过目标最小长度，保存当前段
        if (current.length >= DialogSystem.SPLIT_TARGET_MIN) {
          segments.push(current);
          current = sentence;
        } else {
          // 当前段还不够长，继续合并（即使超过最大长度）
          current += sentence;
        }
      }
    }

    // 处理最后一段
    if (current.length > 0) {
      // 如果只有一段且不超过阈值，不拆分
      if (segments.length === 0 && current.length <= DialogSystem.SPLIT_MIN_LENGTH) {
        return null;
      }
      segments.push(current);
    }

    // 如果拆分后只有一段，不需要拆分
    if (segments.length <= 1) return null;

    return segments;
  }

  /**
   * 注册 Hook —— 在文字事件发生时回调。
   * @param {'onTextStart'|'onTextComplete'|'onChoice'|'onShow'|'onHide'} hookName
   * @param {Function} callback
   */
  on(hookName, callback) {
    if (this.hooks[hookName] !== undefined) {
      this.hooks[hookName] = callback;
    }
  }

  show(characterName, text, onComplete, mood = null) {
    // Lazy-init audio reference
    if (!this.audio && this.scene.audio) {
      this.audio = this.scene.audio;
    }

    // === 当前节点情绪（用于打字速度调整）===
    this._currentMood = mood;

    // === 快进已读节点 ===
    const currentNodeId = this.scene.state && this.scene.state.currentNode;
    this._isSeenNode = currentNodeId ? SaveSystem.isNodeSeen(currentNodeId) : false;
    // 显示/隐藏"已读·快进中"角标
    this._updateSeenBadge();

    // 清理 HTML 标签
    let cleanText = (text || '').replace(/<b>/g, '').replace(/<\/b>/g, '');
    cleanText = cleanText.replace(/<\/p><p>/g, '\n').replace(/<p>/g, '').replace(/<\/p>/g, '');

    // === 尝试拆分长文本 ===
    const segments = DialogSystem.splitLongText(cleanText);

    if (segments) {
      // 长文本：进入多段叙事模式
      this._segments = segments;
      this._segmentIndex = 0;
      this._finalOnComplete = onComplete;
      this.currentCharacterName = characterName;
      this._showSegment(0);
      return;
    }

    // 短文本：原有逻辑不变
    this._segments = null;
    this._segmentIndex = 0;
    this._finalOnComplete = null;
    this._inSegmentMode = false;
    this._isLastSegment = false;
    this._showTextDirect(characterName, cleanText, onComplete);
  }

  /**
   * 显示多段叙事中的某一段
   * 切换段落时：旧文字向上滑出 + 新文字从下方滑入。
   * 打字机通过 textContent 逐字追加，opacity/transform 的过渡不会干扰逐字显示。
   * @param {number} index - 段落索引
   */
  _showSegment(index) {
    const segmentText = this._segments[index];
    if (!segmentText) return;
    const isLast = index === this._segments.length - 1;
    this._segmentIndex = index;

    // 最后一段直接使用原始回调（点击一次即触发），非最后一段不需要 onComplete（由点击事件的多段逻辑处理）
    const segmentOnComplete = isLast ? this._finalOnComplete : null;

    // 标记正在多段叙事中，供 _updateContinueHint 使用
    this._inSegmentMode = true;
    this._isLastSegment = isLast;

    // 旧文字向上滑出
    this.textEl.style.transition = 'opacity 0.15s ease-out, transform 0.15s ease-out';
    this.textEl.style.opacity = '0';
    this.textEl.style.transform = 'translateY(-8px)';

    // 150ms 后替换文字并从下方滑入
    setTimeout(() => {
      this._showTextDirect(this.currentCharacterName, segmentText, segmentOnComplete);
      // _showTextDirect 会设置 opacity:1、transition:none 并清空 textContent，
      // 同时启动打字机（若自动播放开启，首字已追加到 textContent）。
      // 现在重置为透明并下移，准备滑入（字符已在 textContent 中，但不可见）。
      this.textEl.style.transition = 'none';
      this.textEl.style.opacity = '0';
      this.textEl.style.transform = 'translateY(8px)';

      // 下一帧滑入（与打字同时进行，不干扰逐字显示）
      requestAnimationFrame(() => {
        this.textEl.style.transition = 'opacity 0.2s ease-out, transform 0.2s ease-out';
        this.textEl.style.opacity = '1';
        this.textEl.style.transform = 'translateY(0)';
      });
    }, 150);
  }

  /**
   * 直接显示一段文本（原有 show 的核心逻辑）
   */
  _showTextDirect(characterName, text, onComplete) {
    // === 根据角色名设置颜色 ===
    const nameColor = getCharacterColor(characterName);
    const cssColor = '#' + nameColor.toString(16).padStart(6, '0');

    // 角色名切换：先淡出 → 切换文字与颜色 → 淡入；同名仅更新颜色
    if (this.nameEl.textContent !== (characterName || '')) {
      this.nameEl.style.transition = 'opacity 0.15s ease-out';
      this.nameEl.style.opacity = '0';
      setTimeout(() => {
        this.nameEl.textContent = characterName || '';
        this.nameEl.style.color = cssColor;
        this.nameEl.style.opacity = '1';
      }, 150);
    } else {
      this.nameEl.style.color = cssColor;
    }

    // 名字下方装饰线颜色
    this.nameEl.style.setProperty('--name-color', cssColor);
    // Update the ::after pseudo-element color via inline style workaround
    this.nameEl.style.borderBottom = '2px solid ' + cssColor;

    this.fullText = text;
    this.textEl.textContent = '';
    // 确保文字可见（防止残留的 opacity:0/transform 样式导致文字不可见或错位）
    this.textEl.style.opacity = '1';
    this.textEl.style.transition = 'none';
    this.textEl.style.transform = '';
    this.onComplete = onComplete || null;
    this.currentIndex = 0;
    this.currentCharacterName = characterName;
    this.isTyping = true;
    this._typingAccum = 0;
    // === 情绪化打字速度：初始化动态字符延迟 ===
    this._currentCharDelay = this._getMoodBaseInterval();
    // 自动播放开启时，才让打字机自己跑；关闭时等待用户点击
    this._typingActive = this._autoPlay;
    this.el.classList.remove('hiding');
    this.el.classList.add('visible');
    this.continueEl.style.display = 'none';
    this._stopPulse();

    // 重置对话框位置（选项未显示时在底部）
    this._updateDialogPosition();

    // 显示下半屏点击捕获层，扩展移动端点击热区
    if (this.touchLayer) this.touchLayer.classList.add('visible');

    // === Hook: onTextStart — 开始打字前 ===
    if (this.hooks.onTextStart) {
      try { this.hooks.onTextStart(characterName, text); } catch(e) {}
    }
    // === Hook: onShow ===
    if (this.hooks.onShow) {
      try { this.hooks.onShow(characterName, text); } catch(e) {}
    }

    // 自动播放模式下立即显示第一个字，然后由 update 驱动后续打字
    if (this._autoPlay) {
      this._advanceTyping();
      // === 根据刚打出的字符重新计算下次延迟（标点停顿）===
      if (this.isTyping) {
        this._currentCharDelay = this._calculateCharDelay();
      }
    }
  }

  /**
   * 选项面板状态变化时更新对话框提示
   * 通过 CSS 变量 --dialog-height 动态同步对话框实际高度，避免选项重叠。
   */
  _updateDialogPosition() {
    if (!this.choicesEl || !this.el) return;

    const choicesVisible = this.choicesEl.classList.contains('visible');
    if (choicesVisible) {
      // 选项显示时隐藏"点击继续"提示
      this.continueEl.style.display = 'none';
      this._stopPulse();
    }

    // 更新对话框实际高度到 CSS 变量，供选项定位使用
    this._updateDialogHeightVar();
  }

  /**
   * 将对话框实际高度同步到 CSS 变量 --dialog-height
   * 选项面板通过 var(--dialog-height) 动态定位，避免与对话框重叠
   */
  _updateDialogHeightVar() {
    if (!this.el || !this.overlayEl) return;
    const height = this.el.offsetHeight || 0;
    this.overlayEl.style.setProperty('--dialog-height', height + 'px');
  }

  /**
   * 获取对话框当前实际高度（像素）
   * @returns {number} 对话框 offsetHeight
   */
  getDialogHeight() {
    return this.el ? this.el.offsetHeight : 0;
  }

  /**
   * 通知对话框选项面板状态变化（由 ChoiceSystem 调用）
   */
  notifyChoicesVisible(visible) {
    this._updateDialogPosition();
  }

  /**
   * 每帧更新打字机效果（由 GameScene.update 调用）
   * 替代逐字 delayedCall，减少定时器创建开销
   */
  update(time, delta) {
    if (!this._typingActive || !this.isTyping) return;

    // 防御：限制单帧最大 delta，避免标签页切到后台后回来时一次性打出大量字符
    const clampedDelta = Math.min(delta, 100);

    this._typingAccum += clampedDelta;
    // 已读节点快进：安全上限提高到20，打字速度极快
    let safetyMax = this._isSeenNode ? 20 : 5;
    while (this._typingAccum >= this._currentCharDelay && this.isTyping && safetyMax > 0) {
      this._typingAccum -= this._currentCharDelay;
      this._advanceTyping();
      safetyMax--;
      // === 情绪化打字速度：根据刚打出的字符重新计算下次延迟 ===
      if (this.isTyping) {
        this._currentCharDelay = this._calculateCharDelay();
      }
    }
    // 如果安全上限触发但仍有剩余累积时间，丢弃多余累积（避免下一帧爆发）
    if (safetyMax === 0) {
      this._typingAccum = 0;
    }
  }

  /**
   * 根据当前情绪和刚打出的标点符号计算下次字符延迟
   * @returns {number} 延迟毫秒数
   */
  _calculateCharDelay() {
    // 已读节点：快速打字（25ms/字）+ 缩短的标点停顿，保留打字机氛围
    if (this._isSeenNode) {
      let fastDelay = 25;
      if (this.currentIndex > 0 && this.currentIndex <= this.fullText.length) {
        const ch = this.fullText[this.currentIndex - 1];
        const prevCh = this.currentIndex > 1 ? this.fullText[this.currentIndex - 2] : '';
        if (ch === '。') fastDelay += 120;
        else if (ch === '，') fastDelay += 50;
        else if (ch === '！' || ch === '!') fastDelay += 40;
        else if (ch === '.' || ch === '…') {
          if (prevCh !== '.' && prevCh !== '…') fastDelay += 200;
        }
      }
      return fastDelay;
    }
    let delay = this._getMoodBaseInterval();
    if (this.currentIndex > 0 && this.currentIndex <= this.fullText.length) {
      const ch = this.fullText[this.currentIndex - 1];
      const prevCh = this.currentIndex > 1 ? this.fullText[this.currentIndex - 2] : '';
      if (ch === '。') {
        delay += 200;
      } else if (ch === '，') {
        delay += 100;
      } else if (ch === '！' || ch === '!') {
        delay += 50;
      } else if (ch === '.' || ch === '…') {
        // 只在省略号序列开始时加延迟，避免"..."重复加400ms
        if (prevCh !== '.' && prevCh !== '…') delay += 400;
      }
    }
    return Math.max(delay, 1);
  }

  /**
   * 根据当前情绪获取基础打字间隔
   * @returns {number} 基础间隔毫秒数
   */
  _getMoodBaseInterval() {
    const fastSpeed = TYPING_SPEEDS[2]; // 40ms
    const slowSpeed = TYPING_SPEEDS[0]; // 120ms
    const mood = this._currentMood;
    if (mood === 'angry') return fastSpeed * 0.7;
    if (mood === 'depressed') return slowSpeed * 1.5;
    if (mood === 'happy') return this._typingInterval;
    // 无显式mood时从文本推断
    if (this.fullText) {
      if (this.fullText.includes('！') || this.fullText.includes('!')) return fastSpeed * 0.7;
      if (this.fullText.includes('...') || this.fullText.includes('……')) return slowSpeed * 1.5;
    }
    return this._typingInterval;
  }

  /**
   * 推进一个字符的打字
   */
  _advanceTyping() {
    if (this.currentIndex >= this.fullText.length) {
      this.finishTyping();
      return;
    }
    this.currentIndex++;
    this.textEl.textContent = this.fullText.substring(0, this.currentIndex);

    // === 打字机音效：标点必响，非标点每2字响一下 ===
    if (this.audio && this.audio.playTypewriterChar) {
      const ch = this.fullText[this.currentIndex - 1];
      const isPunctuation = '。！？，,.！？、；：…—'.includes(ch);
      if (isPunctuation || this.currentIndex % 2 === 0) {
        this.audio.playTypewriterChar();
      }
    }
  }

  skipTyping() {
    this._typingActive = false;
    if (this.typingTimer) this.typingTimer.remove();
    this.textEl.textContent = this.fullText;
    this.finishTyping();
  }

  finishTyping() {
    this.isTyping = false;
    this._typingActive = false;
    // === 关键词高亮：打字完成后将文本中的关键词用金色高亮显示 ===
    this._applyKeywordHighlight();
    this.continueEl.style.display = 'block';
    this._startPulse();
    this._updateContinueHint();
    // 打字完成后更新对话框高度变量，确保选项定位准确
    this._updateDialogHeightVar();
    // === Hook: onTextComplete — 整段文字打完 ===
    if (this.hooks.onTextComplete) {
      try { this.hooks.onTextComplete(this.currentCharacterName, this.fullText); } catch(e) {}
    }
    // === 已读节点多段叙事：自动推进到下一段 ===
    if (this._isSeenNode && this._segments && this._segmentIndex < this._segments.length - 1) {
      setTimeout(() => {
        if (!this.isTyping && this._segments) {
          this._segmentIndex++;
          this._showSegment(this._segmentIndex);
        }
      }, 300);
      return;
    }
    // === 已读节点最后一段：打完后短暂等待再自动触发 onComplete（显示选项）===
    if (this._isSeenNode && this.onComplete) {
      setTimeout(() => {
        if (!this.isTyping && this.onComplete) {
          const cb = this.onComplete;
          this.onComplete = null;
          cb();
        }
      }, 400);
    }
    // === 自动播放：文字显示完整后绝不自动推进剧情，等待用户点击继续 ===
  }

  /**
   * 关键词高亮：将打字完成的文本中的关键词包裹在 <span class="keyword-highlight"> 中
   * 用 innerHTML 替换 textContent，实现金色高亮效果
   */
  _applyKeywordHighlight() {
    if (!this.fullText || !this.textEl) return;
    // 先转义 HTML 特殊字符，防止 XSS 或破坏 DOM 结构
    let text = this.fullText
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    const keywords = ['6亿', '理想主义', '锤子', '真还传', '十字路口', '老罗', '翻车', '崩溃', '梦想', '骄傲'];
    // 构建正则：按长度降序匹配，避免短关键词覆盖长关键词的子串
    const sortedKeywords = [...keywords].sort((a, b) => b.length - a.length);
    const pattern = sortedKeywords.map(kw => kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
    const regex = new RegExp(`(${pattern})`, 'g');
    text = text.replace(regex, '<span class="keyword-highlight">$1</span>');
    this.textEl.innerHTML = text;
  }

  /**
   * 切换自动播放开关（T28）
   */
  _toggleAutoPlay() {
    this._autoPlay = !this._autoPlay;
    this._saveSettings();
    this._applyAutoPlayState();

    // 切换时若正在打字，实时暂停/恢复
    if (this.isTyping) {
      this._typingActive = this._autoPlay;
    }

    this._updateContinueHint();
  }

  /**
   * 循环切换打字速度档位（T28）
   */
  _cycleTypingSpeed() {
    this._typingSpeedIdx = (this._typingSpeedIdx + 1) % TYPING_SPEEDS.length;
    this._typingInterval = TYPING_SPEEDS[this._typingSpeedIdx];
    this._saveSettings();
    this._applyAutoPlayState();
  }

  /**
   * 更新自动播放按钮与提示文案（T28）
   */
  _applyAutoPlayState() {
    if (this.autoBtn) {
      this.autoBtn.textContent = this._autoPlay
        ? `AUTO · ${TYPING_SPEED_LABELS[this._typingSpeedIdx]}`
        : 'AUTO';
      this.autoBtn.classList.toggle('active', this._autoPlay);
    }
    this._updateContinueHint();
  }

  /**
   * 更新「继续」提示文字（根据自动播放状态和多段叙事状态显示不同文案）
   */
  _updateContinueHint() {
    const isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
    const hint = isTouchDevice ? '点击继续 ▶' : '空格 / 点击继续 ▶';
    // 多段叙事中间段：显示"点击继续"提示
    if (this._inSegmentMode && !this._isLastSegment) {
      this.continueEl.textContent = hint;
      return;
    }
    // 多段叙事最后一段或普通文本
    if (this._autoPlay) {
      this.continueEl.textContent = isTouchDevice ? '自动播放中...点击继续 ▶' : '自动播放中...空格/点击继续 ▶';
    } else {
      this.continueEl.textContent = hint;
    }
  }

  _startPulse() {
    this._stopPulse();
    this.continueEl.classList.add('pulse');
  }

  _stopPulse() {
    this.continueEl.classList.remove('pulse');
  }

  hide() {
    // === Hook: onHide ===
    if (this.hooks.onHide) {
      try { this.hooks.onHide(); } catch(e) {}
    }
    this._typingActive = false;

    if (this.el.classList.contains('visible') && !this.el.classList.contains('hiding')) {
      // 先播放消失动画，结束后再清理状态
      this.el.classList.add('hiding');
      this._onHideAnimationEnd = (e) => {
        if (e.animationName === 'dialogOut') {
          this.el.removeEventListener('animationend', this._onHideAnimationEnd);
          this._onHideAnimationEnd = null;
          this._finishHide();
        }
      };
      this.el.addEventListener('animationend', this._onHideAnimationEnd);
      return;
    }

    this._finishHide();
  }

  /**
   * 完成隐藏后的状态清理
   */
  _finishHide() {
    this.el.classList.remove('visible', 'hiding');
    if (this.touchLayer) this.touchLayer.classList.remove('visible');
    this.continueEl.style.display = 'none';
    this._stopPulse();
    this._updateSeenBadge(true);
    this.onComplete = null;
    // 清理多段叙事状态
    this._segments = null;
    this._segmentIndex = 0;
    this._finalOnComplete = null;
    this._inSegmentMode = false;
    this._isLastSegment = false;
    // 恢复文本透明度与位置
    this.textEl.style.opacity = '';
    this.textEl.style.transition = '';
    this.textEl.style.transform = '';
    if (this.typingTimer) this.typingTimer.remove();
    // 重置位置
    this.el.style.bottom = '0px';
    // 对话框隐藏时重置高度变量
    if (this.overlayEl) {
      this.overlayEl.style.setProperty('--dialog-height', '0px');
    }
  }

  /**
   * 已读节点快进角标：在对话框右上角显示"已读·快进中"，提示玩家这是有意加速而非 bug
   * @param {boolean} forceHide - 强制隐藏（用于对话框 hide 时）
   */
  _updateSeenBadge(forceHide = false) {
    if (!this.el) return;
    let badge = this.el.querySelector('.ui-dialog-seen-badge');
    const shouldShow = !forceHide && this._isSeenNode;
    if (shouldShow) {
      if (!badge) {
        badge = document.createElement('div');
        badge.className = 'ui-dialog-seen-badge';
        badge.textContent = '◈ 已读·快进中';
        this.el.appendChild(badge);
      }
      badge.style.display = 'block';
    } else if (badge) {
      badge.style.display = 'none';
    }
  }

  isShown() {
    return this.el.classList.contains('visible');
  }

  /**
   * 显示「历史真相」按钮
   * 在选择完成后、下一节点加载前出现，点击后展示 historyNote
   * @param {string} historyNote - 历史真相文本
   * @param {Function} onContinue - 关闭按钮/继续后的回调
   */
  showHistoryNoteButton(historyNote, onContinue) {
    this._historyNote = historyNote;
    this._historyNoteContinue = onContinue;
    this._historyNoteConsumed = false; // 防止 onContinue 被多次调用

    // 清理之前的自动消失计时器
    if (this._historyNoteTimer) {
      clearTimeout(this._historyNoteTimer);
      this._historyNoteTimer = null;
    }

    // 查找或创建按钮容器
    let container = document.getElementById('ui-history-note-area');
    if (!container) {
      container = document.createElement('div');
      container.id = 'ui-history-note-area';
      container.className = 'ui-history-note-area interactive';
      container.innerHTML = `
        <div class="ui-history-note-btn" id="ui-history-note-btn">
          <span class="corner-deco tl"></span><span class="corner-deco tr"></span>
          <span class="corner-deco bl"></span><span class="corner-deco br"></span>
          <span class="ui-history-note-icon">▤</span>
          <span class="ui-history-note-label">历史真相</span>
        </div>
        <div class="ui-history-note-skip" id="ui-history-note-skip">跳过 ▶</div>
      `;
      const overlay = document.getElementById('ui-overlay');
      if (overlay) overlay.appendChild(container);
    }

    container.style.display = 'flex';
    // 重置淡出动画状态
    container.classList.remove('fading-out');

    // 绑定「历史真相」按钮
    const btn = document.getElementById('ui-history-note-btn');
    if (btn) {
      btn.onclick = () => {
        // 点击按钮查看历史真相时，清除自动消失计时器
        if (this._historyNoteTimer) {
          clearTimeout(this._historyNoteTimer);
          this._historyNoteTimer = null;
        }
        this._showHistoryNoteOverlay(historyNote);
      };
    }

    // 绑定「跳过」按钮
    const skipBtn = document.getElementById('ui-history-note-skip');
    if (skipBtn) {
      skipBtn.onclick = () => {
        this._consumeHistoryNoteContinue();
      };
    }

    this._historyNoteArea = container;

    // 3秒后自动消失（如果玩家没点击）
    this._historyNoteTimer = setTimeout(() => {
      if (!this._historyNoteConsumed) {
        // 添加淡出动画
        if (container && container.style.display !== 'none') {
          container.classList.add('fading-out');
          // 淡出动画结束后真正隐藏
          setTimeout(() => {
            this._consumeHistoryNoteContinue();
          }, 400);
        }
      }
      this._historyNoteTimer = null;
    }, 3000);
  }

  /**
   * 隐藏「历史真相」按钮区域
   */
  hideHistoryNoteButton() {
    // 清理自动消失计时器
    if (this._historyNoteTimer) {
      clearTimeout(this._historyNoteTimer);
      this._historyNoteTimer = null;
    }
    const container = document.getElementById('ui-history-note-area');
    if (container) {
      container.classList.remove('fading-out');
      container.style.display = 'none';
    }
    this._historyNoteArea = null;
  }

  /**
   * 安全地消费 onContinue 回调（防止多次调用）
   */
  _consumeHistoryNoteContinue() {
    if (this._historyNoteConsumed) return;
    this._historyNoteConsumed = true;
    this.hideHistoryNoteButton();
    // 同时关闭可能打开的 overlay
    const overlay = document.getElementById('ui-history-note-overlay');
    if (overlay) overlay.classList.remove('visible');
    if (this._historyNoteContinue) {
      const cb = this._historyNoteContinue;
      this._historyNoteContinue = null;
      cb();
    }
  }

  /**
   * 显示 historyNote DOM overlay（半透明遮罩 + 居中卡片）
   * @param {string} text - historyNote 文本
   */
  _showHistoryNoteOverlay(text) {
    let overlay = document.getElementById('ui-history-note-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'ui-history-note-overlay';
      overlay.className = 'ui-history-note-overlay';
      overlay.innerHTML = `
        <div class="ui-history-note-card">
          <div class="ui-history-note-header">
            <span class="ui-history-note-header-icon">▤</span>
            <span class="ui-history-note-title">历史真相</span>
          </div>
          <div class="ui-history-note-body" id="ui-history-note-body"></div>
          <div class="ui-history-note-footer">
            <button class="ui-history-note-close" id="ui-history-note-close">继续前行 ▶</button>
          </div>
        </div>
      `;
      const uiOverlay = document.getElementById('ui-overlay');
      if (uiOverlay) uiOverlay.appendChild(overlay);
    }

    const bodyEl = document.getElementById('ui-history-note-body');
    if (bodyEl) bodyEl.textContent = text || '';

    overlay.classList.add('visible');

    const closeBtn = document.getElementById('ui-history-note-close');
    if (closeBtn) {
      closeBtn.onclick = () => {
        this._consumeHistoryNoteContinue();
      };
    }
  }

  /**
   * 销毁资源，防止内存泄漏
   */
  destroy() {
    // 停止打字机
    this._typingActive = false;
    if (this.typingTimer) {
      this.typingTimer.remove();
      this.typingTimer = null;
    }
    // 停止提示动画
    this._stopPulse();
    // 清理多段叙事状态
    this._segments = null;
    this._segmentIndex = 0;
    this._finalOnComplete = null;
    this._inSegmentMode = false;
    this._isLastSegment = false;
    // 恢复文本透明度与位置
    if (this.textEl) {
      this.textEl.style.opacity = '';
      this.textEl.style.transition = '';
      this.textEl.style.transform = '';
    }
    // 清理历史真相按钮和 overlay
    this.hideHistoryNoteButton();
    const overlay = document.getElementById('ui-history-note-overlay');
    if (overlay) overlay.classList.remove('visible');
    this._historyNoteContinue = null;
    // 隐藏下半屏点击捕获层
    if (this.touchLayer) this.touchLayer.classList.remove('visible');
    // 移除 DOM 事件监听器（通过 AbortController 一次性移除所有）
    if (this._abortController) {
      this._abortController.abort();
      this._abortController = null;
    }
    // 移除键盘快捷键监听
    if (this._keyAbortController) {
      this._keyAbortController.abort();
      this._keyAbortController = null;
    }
    // 移除对话框隐藏动画监听并清理可见状态
    if (this._onHideAnimationEnd) {
      if (this.el) this.el.removeEventListener('animationend', this._onHideAnimationEnd);
      this._onHideAnimationEnd = null;
    }
    if (this.el) this.el.classList.remove('visible', 'hiding');
    this.onComplete = null;
    this._typingActive = false;
    this.scene = null;
  }
}
