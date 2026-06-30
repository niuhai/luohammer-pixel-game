import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config.js';
import { SaveSystem } from '../systems/SaveSystem.js';
import { AudioSystem } from '../systems/AudioSystem.js';
import { showAchievementGallery } from '../ui/AchievementGallery.js';
import { showEndingGallery, getEndingProgress } from '../ui/EndingGallery.js';
import { showSaveLoadPanel } from '../ui/SaveLoadPanel.js';
import { MetaProgression } from '../systems/MetaProgression.js';
import { toast } from '../systems/ToastSystem.js';

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
    buttonsEl.innerHTML = '';

    // === 显示历史成就积分（如果 > 0） ===
    const meta = new MetaProgression();
    const totalScore = meta.getAchievementScore();
    if (totalScore > 0) {
      const scoreEl = document.createElement('div');
      scoreEl.className = 'ui-boot-score-display';
      scoreEl.style.cssText = 'text-align: center; color: #f0c040; font-size: 13px; font-weight: 700; padding: 6px 12px; margin-bottom: 8px; border: 1px solid rgba(240,192,64,0.3); border-radius: 4px; background: rgba(240,192,64,0.06); letter-spacing: 1px;';
      scoreEl.textContent = `★ 成就积分：${totalScore}`;
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

    // "结局图鉴"按钮：已有结局记录时显示
    const createEndingGalleryBtn = () => {
      const progress = getEndingProgress();
      if (progress.unlocked === 0) return null;
      const btn = document.createElement('button');
      btn.className = 'ui-boot-btn';
      btn.textContent = `▤ 结局图鉴 ${progress.unlocked}/${progress.total}`;
      btn.addEventListener('click', () => {
        showEndingGallery();
      });
      return btn;
    };

    if (save.hasAnySave()) {
      // "继续游戏"：仅在自动存档存在时显示（继续最近一次自动存档）
      if (save.hasSave()) {
        const continueBtn = document.createElement('button');
        continueBtn.className = 'ui-boot-btn ui-boot-btn-primary';
        continueBtn.textContent = '继续游戏';
        continueBtn.addEventListener('click', () => {
          const state = save.load();
          this.audio.fadeOutBGM(0.5);
          overlay.classList.remove('visible');
          this.scene.start('GameScene', { state });
        });
        buttonsEl.appendChild(continueBtn);
      }

      // "存档管理"：任意存档存在时显示，打开存档/读档面板
      const manageBtn = document.createElement('button');
      manageBtn.className = 'ui-boot-btn';
      manageBtn.textContent = '存档管理';
      manageBtn.addEventListener('click', () => {
        showSaveLoadPanel({
          mode: 'manage',
          saveSystem: save,
          onLoad: (slotId, state) => {
            this.audio.fadeOutBGM(0.5);
            overlay.classList.remove('visible');
            this.scene.start('GameScene', { state });
          }
        });
      });
      buttonsEl.appendChild(manageBtn);

      const newGameBtn = document.createElement('button');
      newGameBtn.className = 'ui-boot-btn';
      newGameBtn.textContent = '新游戏';
      newGameBtn.addEventListener('click', () => {
        save.clear();
        this.audio.fadeOutBGM(0.5);
        overlay.classList.remove('visible');
        this.scene.start('IntroScene', { returnToBoot: false });
      });
      buttonsEl.appendChild(newGameBtn);
      if (introSeen) buttonsEl.appendChild(createIntroBtn());

      const galleryBtn = document.createElement('button');
      galleryBtn.className = 'ui-boot-btn';
      galleryBtn.textContent = '成就图鉴';
      galleryBtn.addEventListener('click', () => showAchievementGallery());
      buttonsEl.appendChild(galleryBtn);

      const endingGalleryBtn = createEndingGalleryBtn();
      if (endingGalleryBtn) buttonsEl.appendChild(endingGalleryBtn);
    } else {
      const startBtn = document.createElement('button');
      startBtn.className = 'ui-boot-btn ui-boot-btn-primary';
      startBtn.textContent = '开始游戏';
      startBtn.addEventListener('click', () => {
        this.audio.fadeOutBGM(0.5);
        overlay.classList.remove('visible');
        this.scene.start('IntroScene', { returnToBoot: false });
      });

      buttonsEl.appendChild(startBtn);

      if (introSeen) buttonsEl.appendChild(createIntroBtn());

      const galleryBtn = document.createElement('button');
      galleryBtn.className = 'ui-boot-btn';
      galleryBtn.textContent = '成就图鉴';
      galleryBtn.addEventListener('click', () => showAchievementGallery());
      buttonsEl.appendChild(galleryBtn);

      const endingGalleryBtn = createEndingGalleryBtn();
      if (endingGalleryBtn) buttonsEl.appendChild(endingGalleryBtn);
    }

    overlay.classList.add('visible');
    overlay.classList.add('visible');

    // === 隐藏调试开关 + DEBUG 标识 ===
    this._setupDebugToggle(overlay);

    // 确保标题画面使用场景图作为沉浸式背景（不显示人物立绘）
    const bootCharEl = document.getElementById('ui-boot-character');
    if (bootCharEl) bootCharEl.src = 'assets/characters/scene-stage-v2.jpg';

    // === 玩法指引卡片：首次自动展开，之后折叠；点击可切换 ===
    this._setupGuide();

    // === 打字机效果：金句逐字显示（从金句池随机选取） ===
    this._typewriterCleanup = null;
    const quoteEl = document.getElementById('ui-boot-quote');
    if (quoteEl) {
      const quoteText = QUOTES[Math.floor(Math.random() * QUOTES.length)];
      quoteEl.innerHTML = '<span class="ui-boot-quote-cursor"></span>';
      let charIndex = 0;
      const cursorEl = quoteEl.querySelector('.ui-boot-quote-cursor');
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
            // 打字完成后光标再闪几秒后消失
            this.time.delayedCall(3000, () => {
              if (cursorEl) cursorEl.style.display = 'none';
            });
          }
        }
      });
      this._typewriterCleanup = () => {
        timer.remove();
      };
    }

    // === 移动端竖屏提示：横屏优先，竖屏时暂停场景并显示提示 ===
    this._setupOrientationHint();

    // === PWA：标题画面提供"安装到桌面"入口，不主动弹窗打扰首次体验 ===
    this._createInstallPrompt();

    // === 同步 overlay 与 Phaser canvas 尺寸/位置（窗口模式适配） ===
    this._syncOverlayToCanvas(overlay);

    // Hide overlay when scene is shutdown
    this.events.on('shutdown', () => {
      overlay.classList.remove('visible');
      if (this._typewriterCleanup) {
        this._typewriterCleanup();
        this._typewriterCleanup = null;
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
    });
  }

  /**
   * 玩法指引卡片：首次访问自动展开，之后默认折叠；点击切换。
   * 折叠状态存 localStorage，跨会话保留用户偏好。
   */
  _setupGuide() {
    const guide = document.getElementById('ui-boot-guide');
    const toggle = document.getElementById('ui-boot-guide-toggle');
    if (!guide || !toggle) return;

    const GUIDE_SEEN_KEY = 'luohammer_guide_seen';
    let seen = false;
    try { seen = localStorage.getItem(GUIDE_SEEN_KEY) === '1'; } catch (e) {}

    // 首次访问展开，否则折叠
    if (seen) guide.classList.add('collapsed');

    toggle.addEventListener('click', (e) => {
      e.stopPropagation();
      guide.classList.toggle('collapsed');
      try { localStorage.setItem(GUIDE_SEEN_KEY, '1'); } catch (err) {}
    });

    // 标记已看过（即使没点，展开状态下 2 秒后也标记）
    try { localStorage.setItem(GUIDE_SEEN_KEY, '1'); } catch (e) {}
  }

  /**
   * 同步 overlay 与 Phaser canvas 的位置和尺寸。
   * 窗口模式下 Phaser canvas 会缩放并居中，overlay 必须跟随。
   */
  _syncOverlayToCanvas(overlay) {
    if (!overlay) return;

    const canvas = this.game.canvas;

    const sync = () => {
      const rect = canvas.getBoundingClientRect();
      overlay.style.position = 'absolute';
      overlay.style.top = rect.top + 'px';
      overlay.style.left = rect.left + 'px';
      overlay.style.width = rect.width + 'px';
      overlay.style.height = rect.height + 'px';
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
      btn.id = 'ui-boot-sound-toggle';
      btn.setAttribute('aria-label', '切换音效');
      btn.style.cssText = `
        position: absolute;
        top: 12px;
        right: 12px;
        width: 44px;
        height: 44px;
        line-height: 44px;
        padding: 0;
        border: 1px solid #f0c040;
        border-radius: 4px;
        background: rgba(0, 0, 0, 0.6);
        color: #f0c040;
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
    });
  }

  /**
   * 更新静音按钮图标
   */
  _updateSoundToggleIcon() {
    if (this._soundToggleBtn) {
      this._soundToggleBtn.textContent = this.audio.enabled ? '♪' : '✕';
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
   * 移动端竖屏提示：检测屏幕方向，竖屏时显示提示并暂停场景，横屏时恢复。
   * 用户点击"继续竖屏游玩"后，不再强制弹出提示。
   */
  _setupOrientationHint() {
    const hint = document.getElementById('rotate-hint');
    if (!hint) return;

    const isPortrait = () => window.matchMedia('(orientation: portrait)').matches;
    let userDismissed = false;
    let resizeHandler = null;
    let orientationHandler = null;

    const update = () => {
      if (userDismissed) return;
      if (isPortrait()) {
        hint.classList.remove('hidden');
        this.scene.pause();
      } else {
        hint.classList.add('hidden');
        this.scene.resume();
      }
    };

    const dismissBtn = document.getElementById('rotate-hint-dismiss');
    if (dismissBtn) {
      dismissBtn.addEventListener('click', () => {
        userDismissed = true;
        hint.classList.add('hidden');
        this.scene.resume();
      }, { once: true });
    }

    update();
    window.addEventListener('resize', resizeHandler = update);
    window.addEventListener('orientationchange', orientationHandler = update);

    this.events.on('shutdown', () => {
      if (resizeHandler) window.removeEventListener('resize', resizeHandler);
      if (orientationHandler) window.removeEventListener('orientationchange', orientationHandler);
      resizeHandler = null;
      orientationHandler = null;
    });
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
      btn.style.cssText = `
        position: absolute;
        top: 12px;
        left: 12px;
        padding: 0 14px;
        height: 40px;
        line-height: 38px;
        border: 1px solid #f0c040;
        border-radius: 4px;
        background: rgba(0, 0, 0, 0.6);
        color: #f0c040;
        font-size: 14px;
        font-weight: 700;
        cursor: pointer;
        z-index: 10;
        user-select: none;
        display: none;
        font-family: 'Luohammer UI', "Microsoft YaHei", "PingFang SC", sans-serif;
      `;
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

  /**
   * 场景关闭时清理资源，防止内存泄漏
   */
  shutdown() {
    if (this.audio) {
      this.audio.destroy();
      this.audio = null;
    }
    this.tweens.killAll();
    this.time.removeAllEvents();
    if (this._typewriterCleanup) {
      this._typewriterCleanup();
      this._typewriterCleanup = null;
    }
    // 移除启动画面静音按钮，避免与游戏主界面按钮冲突
    if (this._soundToggleBtn && this._soundToggleBtn.parentNode) {
      this._soundToggleBtn.parentNode.removeChild(this._soundToggleBtn);
      this._soundToggleBtn = null;
    }
    // 清理调试开关相关元素
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
  }
}
