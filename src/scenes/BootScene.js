import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, ENDING_PRESENTATION_MAP } from '../config.js';
import { SaveSystem } from '../systems/SaveSystem.js';
import { AudioSystem, NARRATION_MODES, VOICE_PRESETS } from '../systems/AudioSystem.js';
import { MetaProgression } from '../systems/MetaProgression.js';
import { toast } from '../systems/ToastSystem.js';
import {
  hideGameLoading,
  showGameLoadingError
} from '../ui/GameLoadingUI.js';
import {
  announceAudioState,
  getAudioControlState,
  getSpeechSupportState,
  getVoiceSettingsAriaLabel,
  getVoiceSettingsTriggerText
} from '../ui/AudioControlState.js';

// 金句池：每次进入标题画面随机选一条
const QUOTES = [
  '彪悍的人生不需要解释',
  '通过干干净净地赚钱让人相信干干净净地赚钱是可能的',
  '不被嘲笑的梦想是不值得去实现的',
  '永远年轻，永远热泪盈眶',
  '我不是为了输赢，我就是认真'
];

export class BootScene extends Phaser.Scene {
  constructor() { super('BootScene'); }

  preload() {
    // 角色图片由 DOM overlay 的 <img> 标签加载，无需 Canvas preload
  }

  create() {
    this._launchingGameplay = false;
    // 背景音乐系统（在用户首次交互后才会真正播放，避免浏览器自动播放策略拦截）
    this.audio = new AudioSystem(this);

    const save = new SaveSystem(this);

    // 静音/音量按钮
    this._createSoundToggle();

    // 首次点击/触摸后解锁音频上下文并启动标题 BGM
    this._setupAudioUnlock();

    // === 背景：由 DOM overlay 全权负责，Canvas 仅填充纯黑底层 ===
    const bg = this.add.graphics();
    bg.fillStyle(0x0a0a0a, 1);
    bg.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // === DOM overlay 渲染标题、角色、按钮 ===
    const overlay = document.getElementById('ui-boot-overlay');
    const buttonsEl = document.getElementById('ui-boot-buttons');
    const bootShell = window.__luohammerBootShell;
    buttonsEl.innerHTML = '';
    const hasAnySave = save.hasAnySave();
    overlay.classList.toggle('returning-player', hasAnySave);
    buttonsEl.classList.toggle('is-returning', hasAnySave);

    // 尽早显示 overlay，确保即使后续按钮创建出错也不会黑屏
    overlay.classList.add('visible');

    // === 显示历史成就积分（如果 > 0） ===
    const meta = new MetaProgression();
    const totalScore = meta.getAchievementScore();
    if (totalScore > 0) {
      const scoreEl = document.createElement('div');
      scoreEl.className = 'ui-boot-score-display';
      scoreEl.textContent = `成就积分 · ${totalScore}`;
      buttonsEl.appendChild(scoreEl);
    }

    // "回顾开场"按钮：已看过开场（introSeen）时显示
    const introSeen = save.isIntroSeen();
    const createIntroBtn = () => {
      const introBtn = document.createElement('button');
      introBtn.className = 'ui-boot-btn';
      introBtn.textContent = '回顾开场';
      introBtn.addEventListener('click', () => {
        this.audio.fadeOutBGM(0.5);
        overlay.classList.remove('visible');
        this.scene.start('IntroScene', { returnToBoot: true });
      });
      return introBtn;
    };

    // “朗读设置”按钮：选择内容模式、真实系统语音与朗读风格
    const createVoicePreviewBtn = () => {
      const btn = document.createElement('button');
      btn.id = 'ui-boot-voice-settings';
      btn.type = 'button';
      btn.className = 'ui-boot-btn';
      btn.textContent = getVoiceSettingsTriggerText(this.audio);
      btn.setAttribute('aria-label', getVoiceSettingsAriaLabel(this.audio));
      btn.setAttribute('aria-haspopup', 'dialog');
      btn.setAttribute('aria-controls', 'ui-boot-voice-panel');
      btn.setAttribute('aria-expanded', 'false');
      btn.addEventListener('click', () => this._showVoicePreviewPanel(btn));
      return btn;
    };

    // "结局图鉴"按钮：已有结局记录时显示
    const createEndingGalleryBtn = () => {
      const endingIds = Object.keys(ENDING_PRESENTATION_MAP);
      const seenEndings = new Set(meta.getSeenEndings());
      const unlocked = endingIds.filter(id => seenEndings.has(id)).length;
      if (unlocked === 0) return null;
      const btn = document.createElement('button');
      btn.className = 'ui-boot-btn';
      btn.textContent = `▤ 结局图鉴 ${unlocked}/${endingIds.length}`;
      this._attachLazyPanelAction(btn, {
        load: () => import('../ui/EndingGallery.js'),
        open: ({ showEndingGallery }) => showEndingGallery({
          seenEndings: meta.getSeenEndings(),
          audio: this.audio
        })
      });
      return btn;
    };

    if (hasAnySave) {
      // "继续游戏"：仅在自动存档存在时显示（继续最近一次自动存档）
      if (save.hasSave()) {
        const continueBtn = document.createElement('button');
        continueBtn.className = 'ui-boot-btn ui-boot-btn-primary ui-boot-return-continue';
        continueBtn.textContent = '继续游戏';
        continueBtn.addEventListener('click', () => {
          const state = save.load();
          // 存档校验失败（节点改名/数据损坏）：提示用户而非静默进入新游戏
          if (!state) {
            try { this.audio.playError(); } catch (e) {}
            try { toast.error('存档已损坏或不兼容当前版本，请重新开始', 3500); } catch (e) {}
            return;
          }
          try { this.audio.playChoice(); } catch (e) {}
          this._startGameplay(overlay, { state }, continueBtn);
        });
        buttonsEl.appendChild(continueBtn);
      }

      // "存档管理"：任意存档存在时显示，打开存档/读档面板
      const manageBtn = document.createElement('button');
      manageBtn.className = 'ui-boot-btn ui-boot-return-secondary';
      manageBtn.textContent = '存档管理';
      this._attachLazyPanelAction(manageBtn, {
        load: () => import('../ui/SaveLoadPanel.js'),
        open: ({ showSaveLoadPanel }) => showSaveLoadPanel({
          mode: 'manage',
          saveSystem: save,
          audio: this.audio,
          onLoad: (slotId, state) => {
            this._startGameplay(overlay, { state });
          }
        })
      });
      buttonsEl.appendChild(manageBtn);

      const newGameBtn = document.createElement('button');
      newGameBtn.className = 'ui-boot-btn ui-boot-return-secondary ui-boot-btn-danger';
      newGameBtn.textContent = '新游戏';
      newGameBtn.setAttribute('aria-label', '开始新游戏');
      let newGameConfirmTimer = null;
      const resetNewGameConfirmation = () => {
        if (!newGameBtn.isConnected) return;
        newGameBtn.removeAttribute('data-confirming');
        newGameBtn.classList.remove('confirming');
        newGameBtn.textContent = '新游戏';
        newGameBtn.setAttribute('aria-label', '开始新游戏');
        newGameBtn.title = '开始新游戏';
        newGameConfirmTimer = null;
      };
      const armNewGameConfirmation = () => {
        newGameBtn.setAttribute('data-confirming', 'true');
        newGameBtn.classList.add('confirming');
        newGameBtn.textContent = '确认重新开始';
        newGameBtn.setAttribute('aria-label', '再次点击确认重新开始，并清除当前自动存档');
        newGameBtn.title = '再次点击将清除当前自动存档；手动存档不受影响';
        newGameConfirmTimer?.remove(false);
        newGameConfirmTimer = this.time.delayedCall(3_200, resetNewGameConfirmation);
        try {
          toast.warning('再次点击确认重新开始；手动存档不会被清除', 3000);
        } catch (e) {}
      };
      newGameBtn.addEventListener('click', () => {
        if (newGameBtn.getAttribute('data-confirming') !== 'true') {
          armNewGameConfirmation();
          return;
        }
        newGameConfirmTimer?.remove(false);
        newGameConfirmTimer = null;
        save.clear();
        try { this.audio.playChoice(); } catch (e) {}
        this.audio.fadeOutBGM(0.5);
        overlay.classList.remove('visible');
        this.scene.start('IntroScene', { returnToBoot: false });
      });
      newGameBtn.addEventListener('keydown', (event) => {
        if (event.key !== 'Escape' ||
            newGameBtn.getAttribute('data-confirming') !== 'true') return;
        event.preventDefault();
        event.stopPropagation();
        newGameConfirmTimer?.remove(false);
        resetNewGameConfirmation();
      });
      newGameBtn.addEventListener('blur', () => {
        if (newGameBtn.getAttribute('data-confirming') !== 'true') return;
        newGameConfirmTimer?.remove(false);
        resetNewGameConfirmation();
      });
      resetNewGameConfirmation();
      buttonsEl.appendChild(newGameBtn);

      const morePanel = document.createElement('div');
      morePanel.className = 'ui-boot-more-panel';
      morePanel.id = 'ui-boot-more-panel';
      morePanel.hidden = true;
      if (introSeen) morePanel.appendChild(createIntroBtn());

      const galleryBtn = document.createElement('button');
      galleryBtn.className = 'ui-boot-btn';
      galleryBtn.textContent = '成就图鉴';
      this._attachLazyPanelAction(galleryBtn, {
        load: () => import('../ui/AchievementGallery.js'),
        open: ({ showAchievementGallery }) => showAchievementGallery({ audio: this.audio })
      });
      morePanel.appendChild(galleryBtn);

      morePanel.appendChild(createVoicePreviewBtn());

      const endingGalleryBtn = createEndingGalleryBtn();
      if (endingGalleryBtn) morePanel.appendChild(endingGalleryBtn);

      const moreBtn = document.createElement('button');
      moreBtn.className = 'ui-boot-btn ui-boot-more-toggle';
      moreBtn.id = 'ui-boot-more-toggle';
      moreBtn.type = 'button';
      moreBtn.setAttribute('aria-expanded', 'false');
      moreBtn.setAttribute('aria-controls', morePanel.id);
      const updateMoreLabel = (expanded) => {
        moreBtn.textContent = expanded
          ? '收起更多选项'
          : `更多选项 · ${morePanel.querySelectorAll('button').length}`;
      };
      updateMoreLabel(false);
      moreBtn.addEventListener('click', () => {
        const expanded = moreBtn.getAttribute('aria-expanded') === 'true';
        moreBtn.setAttribute('aria-expanded', String(!expanded));
        morePanel.hidden = expanded;
        if (!expanded) {
          morePanel.querySelectorAll('.ui-boot-btn').forEach((button, index) => {
            button.style.animationDelay = `${index * 45}ms`;
          });
        }
        updateMoreLabel(!expanded);
      });
      buttonsEl.appendChild(moreBtn);
      buttonsEl.appendChild(morePanel);
    } else {
      const startBtn = document.createElement('button');
      startBtn.className = 'ui-boot-btn ui-boot-btn-primary';
      startBtn.textContent = '开始游戏';
      startBtn.addEventListener('click', () => {
        // R91：首次交互已在 pointerdown 解锁音频，点击补确认音（FTUE 第一个听觉反馈）
        try { this.audio.playChoice(); } catch (e) {}
        this.audio.fadeOutBGM(0.5);
        overlay.classList.remove('visible');
        this.scene.start('IntroScene', { returnToBoot: false });
      });

      buttonsEl.appendChild(startBtn);

      if (introSeen) buttonsEl.appendChild(createIntroBtn());

      const galleryBtn = document.createElement('button');
      galleryBtn.className = 'ui-boot-btn';
      galleryBtn.textContent = '成就图鉴';
      this._attachLazyPanelAction(galleryBtn, {
        load: () => import('../ui/AchievementGallery.js'),
        open: ({ showAchievementGallery }) => showAchievementGallery({ audio: this.audio })
      });
      buttonsEl.appendChild(galleryBtn);

      buttonsEl.appendChild(createVoicePreviewBtn());

      const endingGalleryBtn = createEndingGalleryBtn();
      if (endingGalleryBtn) buttonsEl.appendChild(endingGalleryBtn);
    }

    // R28-T2: 标题按钮 stagger 入场——每个按钮延迟 70ms 出现，营造高级感
    // 跳过成就积分展示（非按钮），仅对 .ui-boot-btn 设置 animation-delay
    const bootBtns = buttonsEl.querySelectorAll('.ui-boot-btn');
    bootBtns.forEach((btn, i) => {
      // 主按钮（开始/继续）作为第一个，无延迟；后续按钮每个 +70ms
      const delay = i * 70;
      btn.style.animationDelay = `${delay}ms`;
      // 主按钮的呼吸灯也需要相应延迟（入场 0.5s 后开始呼吸）
      if (btn.classList.contains('ui-boot-btn-primary')) {
        btn.style.animationDelay = `${delay}ms, ${delay + 500}ms`;
      }
      // R91：桌面端悬停轻音（80ms 节流；移动端无 hover 不触发）
      btn.addEventListener('mouseenter', () => {
        try { this.audio.playHover(); } catch (e) {}
      });
    });

    // === 隐藏调试开关 + DEBUG 标识 ===
    this._setupDebugToggle(overlay);

    // 确保标题画面使用场景图作为沉浸式背景（不显示人物立绘）
    const bootCharEl = document.getElementById('ui-boot-character');
    if (bootCharEl && !bootCharEl.currentSrc) {
      bootCharEl.src = 'assets/characters/scene-stage-v2-1440.webp';
    }

    // === 玩法指引卡片：首次自动展开，之后折叠；点击可切换 ===
    this._setupGuide();

    // === 打字机效果：金句逐字显示（从金句池随机选取） ===
    this._typewriterCleanup = null;
    const quoteEl = document.getElementById('ui-boot-quote');
    if (quoteEl) {
      const quoteText = bootShell?.quote ||
        QUOTES[Math.floor(Math.random() * QUOTES.length)];
      const reducedMotion = typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (bootShell?.visibleAt) {
        // 标题壳已经交付完整金句，不在引擎接管时清空并重新逐字播放。
        quoteEl.textContent = quoteText;
        this._typewriterCleanup = () => this.audio?.stopSpeaking();
      } else if (reducedMotion) {
        // 减少动态效果模式直接呈现完整金句，不能只把 CSS 动画压短后仍逐字等待。
        quoteEl.textContent = quoteText;
        this.audio?.speak(quoteText, {
          kind: 'intro',
          highlightText: quoteText,
          mood: 'reflective'
        });
        this._typewriterCleanup = () => this.audio?.stopSpeaking();
      } else {
        quoteEl.innerHTML = '<span class="ui-boot-quote-cursor"></span>';
        let charIndex = 0;
        const cursorEl = quoteEl.querySelector('.ui-boot-quote-cursor');
        let quoteSpoken = false;
        const timer = this.time.addEvent({
          delay: 120,
          loop: true,
          callback: () => {
            if (charIndex < quoteText.length) {
              const span = document.createElement('span');
              span.textContent = quoteText[charIndex];
              quoteEl.insertBefore(span, cursorEl);
              charIndex++;
            } else {
              timer.remove();
              // 标题金句遵循用户朗读模式；关闭时保持安静，不再强制越过设置。
              if (!quoteSpoken && this.audio) {
                quoteSpoken = true;
                this.audio.speak(quoteText, {
                  kind: 'intro',
                  highlightText: quoteText,
                  mood: 'reflective'
                });
              }
              // 打字完成后光标再闪几秒后消失
              this.time.delayedCall(3000, () => {
                if (cursorEl) cursorEl.style.display = 'none';
              });
            }
          }
        });
        this._typewriterCleanup = () => {
          timer.remove();
          // 离开标题画面时停止金句朗读
          if (this.audio) this.audio.stopSpeaking();
        };
      }
    }

    // === 移动端竖屏提示：由 main.js setupGlobalOrientationHint 全局统一负责 ===
    // （R90：删除本场景重复绑定——两处 update() 逻辑不一致（场景版缺 innerWidth<768
    // 检查）且 dismiss 状态各自闭包，双事件源写同一 DOM class 存在竞态）

    // === PWA：标题画面提供"安装到桌面"入口，不主动弹窗打扰首次体验 ===
    this._createInstallPrompt();

    // === 同步 overlay 与 Phaser canvas 尺寸/位置（窗口模式适配） ===
    this._syncOverlayToCanvas(overlay);

    overlay.dataset.bootPhase = 'engine';
    bootShell?.markEngineReady?.();
    const pendingShellIntent = bootShell?.consumeIntent?.();
    const primaryBtn = buttonsEl.querySelector('.ui-boot-btn-primary');
    const allButtons = [...buttonsEl.querySelectorAll('.ui-boot-btn')];
    const intentTarget = pendingShellIntent?.action === 'manage'
      ? allButtons.find(button => button.textContent.trim() === '存档管理')
      : pendingShellIntent
        ? primaryBtn
        : null;
    const active = document.activeElement;
    const focusTarget = intentTarget || primaryBtn;
    if (
      overlay.classList.contains('visible') &&
      focusTarget &&
      (pendingShellIntent || !active || active === document.body || !overlay.contains(active))
    ) {
      // buttonsEl.innerHTML 会移除壳按钮；必须在同一 JS 任务内把焦点交给新按钮，
      // 不能留下一个 requestAnimationFrame 的 body 焦点窗口吞掉 Enter/Space。
      focusTarget.focus({ preventScroll: true });
    }

    // main.js 据此立刻撤下首屏 Loading；此时标题、按钮与尺寸均已就绪。
    this.game.events.emit('boot-ui-ready');
    if (intentTarget) requestAnimationFrame(() => intentTarget.click());
    if (this.scene.settings.data?.gameplayLoadFailed === true) {
      const titleFocusTarget = primaryBtn || buttonsEl.querySelector('button');
      showGameLoadingError(
        '主游戏代码没有完成加载，本次进度未受影响',
        {
          actionLabel: '重新加载游戏',
          dismissLabel: '先回标题',
          // ESM 模块图会缓存失败状态；完整重载是可预测且不会重复使用坏模块的重试。
          onRetry: () => window.location.reload(),
          onDismiss: () => {
            hideGameLoading();
            requestAnimationFrame(() => {
              titleFocusTarget?.focus({ preventScroll: true });
            });
          }
        }
      );
    }

    // Hide overlay when scene is shutdown
    this.events.on('shutdown', () => {
      overlay.classList.remove('visible');
      this._cleanupGuide();
      if (this._typewriterCleanup) {
        this._typewriterCleanup();
        this._typewriterCleanup = null;
      }
      // 关闭配音试听面板（若仍开着）
      if (this._voicePanelCleanup) {
        this._voicePanelCleanup();
        this._voicePanelCleanup = null;
      }
      // 清理 overlay 同步
      if (this._overlayResizeObserver) {
        this._overlayResizeObserver.disconnect();
        this._overlayResizeObserver = null;
      }
      if (this._overlayResizeHandler) {
        window.removeEventListener('resize', this._overlayResizeHandler);
        this._overlayResizeHandler = null;
      }
      // 停止场景上所有补间与计时器
      this.tweens.killAll();
      this.time.removeAllEvents();
      // 移除启动画面静音按钮，避免与游戏主界面按钮冲突
      if (this._soundToggleBtn && this._soundToggleBtn.parentNode) {
        this._soundToggleBtn.parentNode.removeChild(this._soundToggleBtn);
        this._soundToggleBtn = null;
      }
      // 清理调试开关相关元素与计时器
      if (this._debugClickTimer) {
        clearTimeout(this._debugClickTimer);
        this._debugClickTimer = null;
      }
      if (this._debugZone && this._debugZone.parentNode) {
        this._debugZone.parentNode.removeChild(this._debugZone);
        this._debugZone = null;
      }
      if (this._debugBadge && this._debugBadge.parentNode) {
        this._debugBadge.parentNode.removeChild(this._debugBadge);
        this._debugBadge = null;
      }
    });
  }

  /**
   * 标题页次级面板按需加载：悬停/键盘聚焦时预热，点击时给出明确忙碌反馈。
   */
  _attachLazyPanelAction(button, { load, open }) {
    let modulePromise = null;
    const loadModule = () => {
      if (!modulePromise) {
        modulePromise = load().catch(error => {
          modulePromise = null;
          throw error;
        });
      }
      return modulePromise;
    };
    const preload = () => {
      loadModule().catch(() => {
        // 点击时会重试并呈现可见错误；预热失败不打断标题页。
      });
    };
    button.addEventListener('pointerenter', preload, { once: true });
    button.addEventListener('focus', preload, { once: true });
    button.addEventListener('click', async () => {
      if (button.disabled) return;
      const originalText = button.textContent;
      button.disabled = true;
      button.setAttribute('aria-busy', 'true');
      button.textContent = '正在打开…';
      try {
        const module = await loadModule();
        open(module);
      } catch (error) {
        console.error('[BootScene] 面板资源加载失败:', error);
        try { this.audio.playError(); } catch (e) {}
        try { toast.error('面板加载失败，请检查网络后重试', 3000); } catch (e) {}
        requestAnimationFrame(() => button.focus({ preventScroll: true }));
      } finally {
        button.disabled = false;
        button.removeAttribute('aria-busy');
        button.textContent = originalText;
      }
    });
  }

  /** 确保懒加载的主游戏场景就绪后再切场，慢网下保留标题反馈而不是进入黑屏。 */
  async _startGameplay(overlay, data, triggerBtn = null) {
    if (this._launchingGameplay) return;
    this._launchingGameplay = true;
    const originalText = triggerBtn?.textContent || '';
    if (triggerBtn) {
      triggerBtn.disabled = true;
      triggerBtn.textContent = '正在进入…';
    }
    try {
      const ensureScenes = this.registry.get('ensureGameplayScenes');
      if (typeof ensureScenes === 'function') await ensureScenes();
      if (this.audio) this.audio.fadeOutBGM(0.5);
      if (overlay) overlay.classList.remove('visible');
      this.scene.start('GameScene', data);
    } catch (error) {
      console.error('[BootScene] 主游戏资源加载失败:', error);
      this._launchingGameplay = false;
      if (triggerBtn) {
        triggerBtn.disabled = false;
        triggerBtn.textContent = originalText;
      }
      try { this.audio.playError(); } catch (e) {}
      try { toast.error('游戏资源加载失败，请检查网络后重试', 3500); } catch (e) {}
    }
  }

  /**
   * 配音试听面板：列出所有预设，每项提供「试听」+「应用」按钮。
   * - 试听：用该预设朗读一段标准示例文本，不持久化
   * - 应用：将该预设写入 localStorage 并设为当前预设
   * 面板采用 DOM overlay 实现，与 BootScene 视觉风格一致。
   * @param {HTMLElement} triggerBtn - 触发按钮，用于面板关闭后回写标签
   */
  _showVoicePreviewPanel(triggerBtn) {
    // 若已存在则关闭
    if (this._voicePanelCleanup) {
      this._voicePanelCleanup();
      return;
    }

    const presets = Object.values(VOICE_PRESETS);
    const currentKey = this.audio.getVoicePresetKey();
    const speechSupport = getSpeechSupportState(this.audio);
    const getCurrentDeviceVoiceLabel = () => {
      if (!speechSupport.supported) return '浏览器不支持系统朗读';
      const explicitVoiceName = this.audio.getVoiceName();
      if (explicitVoiceName) return explicitVoiceName;
      const matchedInfo = this.audio.getMatchedVoiceInfo(currentKey);
      if (matchedInfo?.voiceName && !/无中文语音/.test(matchedInfo.voiceName)) {
        return matchedInfo.voiceName;
      }
      return '当前使用浏览器默认语音';
    };
    const previousFocus = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : triggerBtn;
    if (triggerBtn) {
      triggerBtn.textContent = getVoiceSettingsTriggerText(this.audio);
      triggerBtn.setAttribute('aria-label', getVoiceSettingsAriaLabel(this.audio));
      triggerBtn.setAttribute('aria-expanded', 'true');
    }

    // 容器
    const panel = document.createElement('div');
    panel.id = 'ui-boot-voice-panel';
    panel.className = 'ui-voice-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-labelledby', 'ui-boot-voice-title');
    panel.setAttribute('aria-describedby', 'ui-boot-voice-support');
    panel.style.cssText = [
      'position: fixed',
      'top: 50%', 'left: 50%',
      'transform: translate(-50%, -50%)',
      'background: rgba(20, 16, 8, 0.97)',
      'border: 2px solid rgba(240, 192, 64, 0.5)',
      'border-radius: 8px',
      'padding: 18px 22px',
      'max-width: 90vw',
      'width: 420px',
      'max-height: 85vh',
      'overflow-y: auto',
      'overscroll-behavior: contain',
      'z-index: 100000',
      'color: var(--color-text-primary)',
      'font-family: "Press Start 2P", "Microsoft YaHei", monospace',
      'box-shadow: 0 0 0 100vmax rgba(0,0,0,0.82), 0 18px 60px rgba(0,0,0,0.78)'
    ].join(';');

    // 标题
    const title = document.createElement('div');
    title.id = 'ui-boot-voice-title';
    title.textContent = '♪ 朗读设置';
    title.style.cssText = 'font-size: 16px; color: var(--color-gold); text-align: center; margin-bottom: 4px; letter-spacing: 1px;';
    panel.appendChild(title);

    const subtitle = document.createElement('div');
    subtitle.textContent = '选择朗读内容、设备语音和讲述风格';
    subtitle.style.cssText = 'font-size: 11px; color: var(--color-text-secondary); text-align: center; margin-bottom: 6px; line-height: 1.5;';
    panel.appendChild(subtitle);

    // 纯本地系统语音：不依赖预生成音频或云端服务。
    const ttsNote = document.createElement('div');
    ttsNote.id = 'ui-boot-voice-support';
    ttsNote.className = 'ui-voice-support';
    ttsNote.dataset.support = speechSupport.state;
    ttsNote.setAttribute('role', 'status');
    ttsNote.textContent = `${speechSupport.label} · ${speechSupport.detail}`;
    ttsNote.style.cssText = [
      'font-size: 10px',
      `color: ${speechSupport.supported
        ? 'var(--color-text-secondary)'
        : 'var(--color-warning)'}`,
      'text-align: center',
      'margin-bottom: 14px',
      'padding: 8px 10px',
      'border: 1px solid rgba(240, 192, 64, 0.22)',
      'background: rgba(240, 192, 64, 0.05)',
      'line-height: 1.55'
    ].join(';');
    panel.appendChild(ttsNote);

    const currentVoiceSummary = document.createElement('div');
    currentVoiceSummary.className = 'ui-voice-current-device';
    currentVoiceSummary.setAttribute('role', 'status');
    currentVoiceSummary.style.cssText = [
      'display: flex',
      'align-items: center',
      'justify-content: space-between',
      'gap: 8px',
      'margin-bottom: 14px',
      'padding: 8px 10px',
      'border: 1px solid rgba(92, 129, 171, 0.34)',
      'background: rgba(0, 0, 0, 0.28)',
      'font-size: 10px',
      'line-height: 1.45'
    ].join(';');
    const currentVoiceLabel = document.createElement('span');
    currentVoiceLabel.textContent = '当前设备语音：';
    currentVoiceLabel.style.cssText = 'color: var(--color-text-secondary); white-space: nowrap;';
    const currentVoiceName = document.createElement('span');
    currentVoiceName.textContent = getCurrentDeviceVoiceLabel();
    currentVoiceName.style.cssText = 'min-width: 0; overflow: hidden; color: var(--color-text-primary); font-weight: 700; text-align: right; text-overflow: ellipsis; white-space: nowrap;';
    currentVoiceSummary.append(currentVoiceLabel, currentVoiceName);
    panel.appendChild(currentVoiceSummary);

    const modeTitle = document.createElement('div');
    modeTitle.textContent = '朗读内容';
    modeTitle.style.cssText = 'font-size: 10px; color: var(--color-text-secondary); margin-bottom: 6px;';
    panel.appendChild(modeTitle);

    const modeGroup = document.createElement('div');
    modeGroup.style.cssText = 'display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin-bottom: 14px;';
    Object.values(NARRATION_MODES).forEach(mode => {
      const modeBtn = document.createElement('button');
      const isCurrent = this.audio.getNarrationMode() === mode.key;
      modeBtn.type = 'button';
      modeBtn.textContent = mode.label;
      modeBtn.title = mode.desc;
      modeBtn.setAttribute('aria-pressed', String(isCurrent));
      modeBtn.style.cssText = [
        'min-height: 44px',
        'padding: 8px 4px',
        'font-size: 10px',
        'font-family: inherit',
        'cursor: pointer',
        `color: ${isCurrent ? 'var(--color-bg-dark)' : 'var(--color-gold)'}`,
        `background: ${isCurrent ? 'var(--color-gold)' : 'rgba(240, 192, 64, 0.06)'}`,
        'border: 1px solid rgba(240, 192, 64, 0.35)'
      ].join(';');
      modeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.audio.setNarrationMode(mode.key);
        announceAudioState(`剧情朗读已切换为${mode.label}`);
        this._voicePanelCleanup();
        this._showVoicePreviewPanel(triggerBtn);
      });
      modeGroup.appendChild(modeBtn);
    });
    panel.appendChild(modeGroup);

    const systemVoices = this.audio.getVoiceList();
    const voiceLabel = document.createElement('label');
    voiceLabel.textContent = '设备语音';
    voiceLabel.style.cssText = 'display: block; font-size: 10px; color: var(--color-text-secondary); margin-bottom: 14px;';
    const voiceSelect = document.createElement('select');
    voiceSelect.setAttribute('aria-label', '选择设备上的中文系统语音');
    voiceSelect.disabled = !speechSupport.supported;
    voiceSelect.title = speechSupport.supported ? '' : speechSupport.label;
    voiceSelect.style.cssText = 'display: block; width: 100%; min-height: 44px; margin-top: 6px; padding: 8px; color: var(--color-text-primary); background: rgba(0, 0, 0, 0.45); border: 1px solid rgba(240, 192, 64, 0.35); font-family: inherit; font-size: 10px;';
    const autoOption = document.createElement('option');
    autoOption.value = '';
    autoOption.textContent = systemVoices.length > 0 ? '自动选择（推荐）' : '自动选择（未发现中文语音）';
    voiceSelect.appendChild(autoOption);
    systemVoices.forEach(voice => {
      const option = document.createElement('option');
      option.value = voice.name;
      option.textContent = `${voice.name}${voice.lang ? ` · ${voice.lang}` : ''}`;
      voiceSelect.appendChild(option);
    });
    voiceSelect.value = this.audio.getVoiceName();
    voiceSelect.addEventListener('change', (e) => {
      e.stopPropagation();
      this.audio.setVoiceName(voiceSelect.value);
      currentVoiceName.textContent = getCurrentDeviceVoiceLabel();
      this.audio.previewVoicePreset(this.audio.getVoicePresetKey());
      announceAudioState(voiceSelect.value
        ? `设备语音已切换为${voiceSelect.selectedOptions[0]?.textContent || voiceSelect.value}`
        : '设备语音已恢复自动选择');
    });
    voiceLabel.appendChild(voiceSelect);
    panel.appendChild(voiceLabel);

    const styleTitle = document.createElement('div');
    styleTitle.textContent = '朗读节奏';
    styleTitle.style.cssText = 'font-size: 10px; color: var(--color-text-secondary); margin-bottom: 6px;';
    panel.appendChild(styleTitle);

    // 预设列表
    presets.forEach(preset => {
      const row = document.createElement('div');
      row.className = 'ui-voice-preset';
      row.style.cssText = [
        'display: flex',
        'align-items: center',
        'justify-content: space-between',
        'padding: 10px 12px',
        'margin-bottom: 8px',
        'border: 1px solid rgba(240, 192, 64, 0.18)',
        'border-radius: 4px',
        'background: rgba(240, 192, 64, 0.04)',
        preset.key === currentKey ? 'border-color: rgba(240, 192, 64, 0.7); background: rgba(240, 192, 64, 0.1);' : ''
      ].join(';');

      // 左侧：名称+描述+当前标记
      const left = document.createElement('div');
      left.style.cssText = 'flex: 1; padding-right: 10px;';

      const name = document.createElement('div');
      name.className = 'ui-voice-preset-name';
      name.style.cssText = 'font-size: 13px; color: var(--color-gold); font-weight: 700; margin-bottom: 3px;';
      name.textContent = (preset.key === currentKey ? '★ ' : '') + preset.label;
      left.appendChild(name);

      const desc = document.createElement('div');
      desc.style.cssText = 'font-size: 10px; color: var(--color-text-secondary); line-height: 1.4;';
      desc.textContent = preset.desc;
      left.appendChild(desc);

      // 告知用户当前实际使用的系统语音，避免把预设误解为固定音色。
      const voiceInfo = this.audio.getMatchedVoiceInfo(preset.key);
      const matchedEl = document.createElement('div');
      matchedEl.style.cssText = 'font-size: 9px; margin-top: 4px; line-height: 1.4;';
      matchedEl.style.color = 'var(--color-text-muted)';
      matchedEl.textContent = !speechSupport.supported
        ? '当前浏览器不支持系统朗读'
        : voiceInfo.voiceName === '(无中文语音)'
          ? '未安装中文语音，将尝试设备默认语音'
          : `实际语音：${voiceInfo.voiceName}`;
      left.appendChild(matchedEl);

      row.appendChild(left);

      // 右侧：按钮组
      const btnGroup = document.createElement('div');
      btnGroup.style.cssText = 'display: flex; gap: 6px; flex-shrink: 0;';

      const previewBtn = document.createElement('button');
      previewBtn.type = 'button';
      previewBtn.textContent = '试听';
      previewBtn.disabled = !speechSupport.canPreview;
      previewBtn.title = speechSupport.canPreview ? '试听此朗读风格' : speechSupport.label;
      previewBtn.style.cssText = [
        'background: transparent',
        'border: 1px solid rgba(240, 192, 64, 0.5)',
        'color: var(--color-gold)',
        'min-height: 44px',
        'padding: 8px 10px',
        'font-size: 11px',
        'border-radius: 3px',
        'cursor: pointer',
        'font-family: inherit',
        previewBtn.disabled ? 'opacity: 0.45; cursor: not-allowed' : ''
      ].join(';');
      previewBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.audio.previewVoicePreset(preset.key);
      });
      btnGroup.appendChild(previewBtn);

      const applyBtn = document.createElement('button');
      applyBtn.type = 'button';
      applyBtn.textContent = preset.key === currentKey ? '已应用' : '应用';
      applyBtn.disabled = preset.key === currentKey;
      applyBtn.style.cssText = [
        'background: rgba(240, 192, 64, 0.85)',
        'border: none',
        'color: var(--color-bg-dark)',
        'min-height: 44px',
        'padding: 8px 10px',
        'font-size: 11px',
        'border-radius: 3px',
        'cursor: pointer',
        'font-family: inherit',
        'font-weight: 700',
        applyBtn.disabled ? 'opacity: 0.5; cursor: default;' : ''
      ].join(';');
      applyBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.audio.setVoicePreset(preset.key);
        // 关闭面板并重新打开以刷新"已应用"标记
        this._voicePanelCleanup();
        this._showVoicePreviewPanel(triggerBtn);
        // 同步触发按钮的标签
        if (triggerBtn) {
          triggerBtn.textContent = getVoiceSettingsTriggerText(this.audio);
          triggerBtn.setAttribute('aria-label', getVoiceSettingsAriaLabel(this.audio));
        }
        announceAudioState(`朗读风格已切换为${preset.label}`);
        try { toast.success(`已应用：${preset.label}`); } catch(e) {}
      });
      btnGroup.appendChild(applyBtn);

      row.appendChild(btnGroup);
      panel.appendChild(row);
    });

    // 关闭按钮
    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.textContent = '关闭';
    closeBtn.style.cssText = [
      'display: block',
      'margin: 14px auto 0',
      'background: transparent',
      'border: 1px solid rgba(154, 138, 106, 0.5)',
      'color: var(--color-text-secondary)',
      'min-height: 44px',
      'padding: 8px 24px',
      'font-size: 11px',
      'border-radius: 3px',
      'cursor: pointer',
      'font-family: inherit'
    ].join(';');
    closeBtn.addEventListener('click', () => this._voicePanelCleanup());
    panel.appendChild(closeBtn);

    document.body.appendChild(panel);
    const bootOverlay = document.getElementById('ui-boot-overlay');
    if (bootOverlay) bootOverlay.inert = true;
    const rotateHint = document.getElementById('rotate-hint');
    const rotateHintWasHidden = rotateHint?.classList.contains('hidden') ?? true;
    if (rotateHint) {
      rotateHint.classList.add('hidden');
      rotateHint.setAttribute('aria-hidden', 'true');
    }

    // 点击面板外部关闭
    const onOutsideClick = (e) => {
      if (panel.contains(e.target)) return;
      this._voicePanelCleanup();
    };
    // 延迟一帧绑定，避免触发按钮的同一 click 立刻关闭面板
    this.time.delayedCall(0, () => {
      window.addEventListener('pointerdown', onOutsideClick);
    });

    // ESC 关闭
    const onKey = (e) => {
      if (e.code === 'Escape') {
        e.preventDefault();
        this._voicePanelCleanup();
        return;
      }
      if (e.key !== 'Tab') return;
      const focusable = [...panel.querySelectorAll(
        'button:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )].filter(element => element.getClientRects().length > 0);
      if (focusable.length === 0) {
        e.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus({ preventScroll: true });
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus({ preventScroll: true });
      } else if (!panel.contains(document.activeElement)) {
        e.preventDefault();
        first.focus({ preventScroll: true });
      }
    };
    window.addEventListener('keydown', onKey);

    this._voicePanelCleanup = () => {
      window.removeEventListener('pointerdown', onOutsideClick);
      window.removeEventListener('keydown', onKey);
      if (panel.parentNode) panel.parentNode.removeChild(panel);
      if (bootOverlay) bootOverlay.inert = false;
      if (rotateHint && !rotateHintWasHidden) {
        rotateHint.classList.remove('hidden');
        rotateHint.setAttribute('aria-hidden', 'false');
      }
      if (triggerBtn) triggerBtn.setAttribute('aria-expanded', 'false');
      this._voicePanelCleanup = null;
      const target = previousFocus?.isConnected ? previousFocus : triggerBtn;
      target?.focus({ preventScroll: true });
    };
    const currentModeButton = [...modeGroup.querySelectorAll('button')]
      .find(button => button.getAttribute('aria-pressed') === 'true');
    (currentModeButton || closeBtn).focus({ preventScroll: true });
  }

  /**
   * 玩法指引卡片：首次访问自动展开，之后默认折叠；点击切换。
   * 折叠状态存 localStorage，跨会话保留用户偏好。
   */
  _setupGuide() {
    const guide = document.getElementById('ui-boot-guide');
    const toggle = document.getElementById('ui-boot-guide-toggle');
    if (!guide || !toggle) return;

    const syncExpandedState = () => {
      toggle.setAttribute('aria-expanded', String(!guide.classList.contains('collapsed')));
    };

    this._guideToggleEl = toggle;
    this._guideToggleHandler = (e) => {
      e.stopPropagation();
      guide.classList.toggle('collapsed');
      syncExpandedState();
    };

    // 标题场景会被重复进入；onclick 保证这个持久 DOM 始终只有一个事件所有者。
    toggle.onclick = this._guideToggleHandler;
    syncExpandedState();
  }

  _cleanupGuide() {
    if (this._guideToggleEl?.onclick === this._guideToggleHandler) {
      this._guideToggleEl.onclick = null;
    }
    this._guideToggleEl = null;
    this._guideToggleHandler = null;
  }

  /**
   * 同步 overlay 与 Phaser canvas 的位置和尺寸。
   * 窗口模式下 Phaser canvas 会缩放并居中，overlay 必须跟随。
   */
  _syncOverlayToCanvas(overlay) {
    if (!overlay) return;

    const canvas = this.game.canvas;

    const sync = () => {
      // overlay 覆盖整个视口，不跟随 canvas 缩放后的尺寸。
      // 原因：canvas 在 FIT+CENTER_BOTH 模式下缩放后高度可能 < 内容总高度
      // （标题+金句+5 按钮 ≈ 394px），若 overlay 跟随 canvas（如 312.5px），
      // flex 居中后按钮顶部会溢出 overlay 到视口外（y 为负），无法点击。
      // 修复：overlay 全屏覆盖，canvas 在背景层渲染场景，UI 在前景层全屏。
      // 用 inset:0 而非 100vw/100vh：100vw 在桌面端含滚动条宽度会横向溢出。
      overlay.style.position = 'fixed';
      overlay.style.inset = '0';
    };

    sync();

    // 用 ResizeObserver 监听 canvas 尺寸变化
    if (typeof ResizeObserver !== 'undefined') {
      this._overlayResizeObserver = new ResizeObserver(sync);
      this._overlayResizeObserver.observe(canvas);
    }

    // 兑容不支持 ResizeObserver 的浏览器
    this._overlayResizeHandler = sync;
    window.addEventListener('resize', sync);
  }

  /**
   * 创建右上角静音/音量切换按钮
   */
  _createSoundToggle() {
    const overlay = document.getElementById('ui-boot-overlay');
    if (!overlay) return;

    let btn = document.getElementById('ui-boot-sound-toggle');
    if (!btn) {
      btn = document.createElement('button');
      btn.type = 'button';
      btn.id = 'ui-boot-sound-toggle';
      btn.style.cssText = `
        position: absolute;
        top: 12px;
        right: 12px;
        width: 44px;
        height: 44px;
        line-height: 44px;
        padding: 0;
        border: 1px solid var(--color-gold);
        border-radius: 4px;
        background: rgba(0, 0, 0, 0.6);
        color: var(--color-gold);
        font-size: 18px;
        text-align: center;
        cursor: pointer;
        z-index: 10;
        user-select: none;
      `;
      overlay.appendChild(btn);
    }
    this._soundToggleBtn = btn;
    this._updateSoundToggleIcon();

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.audio.toggle().then(() => {
        // 若这是首次交互，解锁后启动标题 BGM
        if (this.audio.enabled && !this.audio._bgmPlaying) {
          this.audio.startBGM('menu');
        }
      });
      this._updateSoundToggleIcon();
      announceAudioState(`声音已${this.audio.enabled ? '开启' : '静音'}`);
    });
  }

  /**
   * 更新静音按钮图标
   */
  _updateSoundToggleIcon() {
    if (this._soundToggleBtn) {
      const state = getAudioControlState(this.audio).sound;
      this._soundToggleBtn.textContent = state.icon === '×' ? '✕' : state.icon;
      this._soundToggleBtn.setAttribute('aria-pressed', state.ariaPressed);
      this._soundToggleBtn.setAttribute('aria-label', state.ariaLabel);
      this._soundToggleBtn.title = state.ariaLabel;
    }
  }

  /**
   * 监听首次用户交互，解锁 AudioContext 并播放标题 BGM
   */
  _setupAudioUnlock() {
    if (this._audioUnlockHandler) return;

    const unlockAndPlay = async () => {
      if (this._audioUnlocked) return;
      const ok = await this.audio.unlock();
      this._audioUnlocked = ok;
      if (ok && this.audio.enabled && !this.audio._bgmPlaying) {
        this.audio.startBGM('menu');
      }
    };

    this._audioUnlockHandler = unlockAndPlay;

    // 优先监听 UI 遮罩层，同时保留 window 兜底
    const overlay = document.getElementById('ui-boot-overlay');
    if (overlay) {
      overlay.addEventListener('pointerdown', this._audioUnlockHandler, { once: true });
    }
    window.addEventListener('pointerdown', this._audioUnlockHandler, { once: true });
  }

  /**
   * 创建 PWA "安装到桌面" 按钮。
   * 仅在浏览器报告可安装、且未处于已安装的独立窗口模式时显示，
   * 避免在首次体验时主动弹出浏览器安装横幅。
   */
  _createInstallPrompt() {
    const overlay = document.getElementById('ui-boot-overlay');
    if (!overlay) return;

    // 已处于 PWA 独立窗口或 iOS 主屏模式时无需安装按钮
    if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true) {
      return;
    }

    let btn = document.getElementById('ui-boot-install-btn');
    if (!btn) {
      btn = document.createElement('button');
      btn.id = 'ui-boot-install-btn';
      btn.type = 'button';
      btn.textContent = '安装到桌面';
      btn.setAttribute('aria-label', '安装到桌面');
      // R82 F4：定位/视觉样式迁至 index.html #ui-boot-install-btn（含竖屏左下特判），
      // 此处不再 inline cssText——原 top:12/left:12 与"怎么玩"指南物理重叠
      overlay.appendChild(btn);
    }
    this._installBtn = btn;

    const showIfInstallable = () => {
      if (window.luohammerDeferredPrompt && btn) {
        btn.style.display = 'block';
      }
    };
    showIfInstallable();

    const onBeforeInstall = (e) => {
      e.preventDefault();
      window.luohammerDeferredPrompt = e;
      showIfInstallable();
    };

    const onAppInstalled = () => {
      window.luohammerDeferredPrompt = null;
      if (btn) btn.style.display = 'none';
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onAppInstalled);

    btn.addEventListener('click', async () => {
      const deferredPrompt = window.luohammerDeferredPrompt;
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        window.luohammerDeferredPrompt = null;
        btn.style.display = 'none';
      }
    });

    this.events.on('shutdown', () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onAppInstalled);
      if (btn && btn.parentNode) btn.parentNode.removeChild(btn);
      this._installBtn = null;
    });
  }


  /**
   * 隐藏调试开关：连续点击标题画面右下角 5 次切换调试模式
   * 同时管理 DEBUG 标识的显示
   */
  _setupDebugToggle(overlay) {
    if (!overlay) return;

    // === DEBUG 标识 ===
    let badge = document.getElementById('ui-boot-debug-badge');
    if (!badge) {
      badge = document.createElement('div');
      badge.id = 'ui-boot-debug-badge';
      badge.style.cssText = `
        position: absolute;
        bottom: 8px;
        left: 8px;
        padding: 2px 8px;
        background: rgba(224, 64, 64, 0.85);
        color: #fff;
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 1px;
        border-radius: 3px;
        z-index: 20;
        pointer-events: none;
        display: none;
        font-family: 'Luohammer UI', monospace;
      `;
      badge.textContent = 'DEBUG';
      overlay.appendChild(badge);
    }
    this._debugBadge = badge;
    this._updateDebugBadge();

    // === 隐藏点击区域（右下角 80x80） ===
    let zone = document.getElementById('ui-boot-debug-zone');
    if (!zone) {
      zone = document.createElement('div');
      zone.id = 'ui-boot-debug-zone';
      zone.style.cssText = `
        position: absolute;
        bottom: 0;
        right: 0;
        width: 80px;
        height: 80px;
        z-index: 19;
        cursor: default;
        background: transparent;
      `;
      overlay.appendChild(zone);
    }
    this._debugZone = zone;

    this._debugClickCount = 0;
    this._debugClickTimer = null;

    this._debugClickHandler = () => {
      this._debugClickCount++;
      if (this._debugClickTimer) clearTimeout(this._debugClickTimer);
      this._debugClickTimer = setTimeout(() => {
        this._debugClickCount = 0;
      }, 3000);

      if (this._debugClickCount >= 5) {
        this._debugClickCount = 0;
        if (this._debugClickTimer) {
          clearTimeout(this._debugClickTimer);
          this._debugClickTimer = null;
        }
        this._toggleDebugMode();
      }
    };
    zone.addEventListener('click', this._debugClickHandler);
  }

  /**
   * 切换调试模式
   */
  _toggleDebugMode() {
    const key = 'luohammer_debug';
    let enabled = false;
    try { enabled = localStorage.getItem(key) === '1'; } catch (e) {}
    try {
      if (enabled) {
        localStorage.removeItem(key);
        toast.info('调试模式已关闭');
      } else {
        localStorage.setItem(key, '1');
        toast.success('调试模式已开启\n可在控制台使用 __luohammerDebug 调试命令', 4000);
      }
    } catch (e) {}
    this._updateDebugBadge();
  }

  /**
   * 更新 DEBUG 标识显示
   */
  _updateDebugBadge() {
    if (!this._debugBadge) return;
    let enabled = false;
    try { enabled = localStorage.getItem('luohammer_debug') === '1'; } catch (e) {}
    this._debugBadge.style.display = enabled ? 'block' : 'none';
  }
}
