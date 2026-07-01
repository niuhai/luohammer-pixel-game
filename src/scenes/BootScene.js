import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config.js';
import { SaveSystem } from '../systems/SaveSystem.js';
import { AudioSystem, VOICE_PRESETS } from '../systems/AudioSystem.js';
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

    // "配音试听"按钮：弹出预设选择面板，供用户试听并切换配音风格
    const createVoicePreviewBtn = () => {
      const btn = document.createElement('button');
      btn.className = 'ui-boot-btn';
      const currentPreset = this.audio.getVoicePresetKey();
      btn.textContent = `♪ 配音试听（${VOICE_PRESETS[currentPreset].label}）`;
      btn.addEventListener('click', () => this._showVoicePreviewPanel(btn));
      return btn;
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

      buttonsEl.appendChild(createVoicePreviewBtn());

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

      buttonsEl.appendChild(createVoicePreviewBtn());

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
            // 打字完成后语音播报金句（force=true，无视 narration 开关）
            if (!quoteSpoken && this.audio) {
              quoteSpoken = true;
              this.audio.speak(quoteText, { force: true });
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
    });
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

    // 容器
    const panel = document.createElement('div');
    panel.className = 'ui-voice-panel';
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
      'z-index: 10000',
      'color: #f0e0a0',
      'font-family: "Press Start 2P", "Microsoft YaHei", monospace',
      'box-shadow: 0 8px 40px rgba(0,0,0,0.6)'
    ].join(';');

    // 标题
    const title = document.createElement('div');
    title.textContent = '♪ 配音试听';
    title.style.cssText = 'font-size: 16px; color: #f0c040; text-align: center; margin-bottom: 4px; letter-spacing: 1px;';
    panel.appendChild(title);

    const subtitle = document.createElement('div');
    subtitle.textContent = '点击「试听」听效果，满意后点「应用」';
    subtitle.style.cssText = 'font-size: 11px; color: #9a8a6a; text-align: center; margin-bottom: 14px; line-height: 1.5;';
    panel.appendChild(subtitle);

    // 预设列表
    presets.forEach(preset => {
      const row = document.createElement('div');
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
      name.style.cssText = 'font-size: 13px; color: #f0c040; font-weight: 700; margin-bottom: 3px;';
      name.textContent = (preset.key === currentKey ? '★ ' : '') + preset.label;
      left.appendChild(name);

      const desc = document.createElement('div');
      desc.style.cssText = 'font-size: 10px; color: #9a8a6a; line-height: 1.4;';
      desc.textContent = preset.desc;
      left.appendChild(desc);

      // 实际匹配到的 voice 信息（让用户看到系统真实匹配结果，便于诊断"男声变女声"问题）
      const voiceInfo = this.audio.getMatchedVoiceInfo(preset.key);
      const matchedEl = document.createElement('div');
      matchedEl.style.cssText = 'font-size: 9px; margin-top: 4px; line-height: 1.4;';
      const genderLabel = voiceInfo.isMale === true ? '男声' :
                          voiceInfo.isMale === false ? '女声' : '未知';
      const expectLabel = voiceInfo.expectMale ? '期望男声' : '期望女声';
      const matchedOk = voiceInfo.matched &&
                        ((voiceInfo.expectMale && voiceInfo.isMale === true) ||
                         (!voiceInfo.expectMale && voiceInfo.isMale === false));
      matchedEl.style.color = matchedOk ? '#7ad07a' : '#e07050';
      matchedEl.textContent = `→ ${voiceInfo.voiceName} [${genderLabel}/${expectLabel}${voiceInfo.matched ? '/匹配' : '/回退'}]`;
      left.appendChild(matchedEl);

      row.appendChild(left);

      // 右侧：按钮组
      const btnGroup = document.createElement('div');
      btnGroup.style.cssText = 'display: flex; gap: 6px; flex-shrink: 0;';

      const previewBtn = document.createElement('button');
      previewBtn.textContent = '试听';
      previewBtn.style.cssText = [
        'background: transparent',
        'border: 1px solid rgba(240, 192, 64, 0.5)',
        'color: #f0c040',
        'padding: 5px 10px',
        'font-size: 11px',
        'border-radius: 3px',
        'cursor: pointer',
        'font-family: inherit'
      ].join(';');
      previewBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.audio.previewVoicePreset(preset.key);
      });
      btnGroup.appendChild(previewBtn);

      const applyBtn = document.createElement('button');
      applyBtn.textContent = preset.key === currentKey ? '已应用' : '应用';
      applyBtn.disabled = preset.key === currentKey;
      applyBtn.style.cssText = [
        'background: rgba(240, 192, 64, 0.85)',
        'border: none',
        'color: #1a1208',
        'padding: 5px 10px',
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
          triggerBtn.textContent = `♪ 配音试听（${VOICE_PRESETS[preset.key].label}）`;
        }
        try { toast(`已应用：${preset.label}`); } catch(e) {}
      });
      btnGroup.appendChild(applyBtn);

      row.appendChild(btnGroup);
      panel.appendChild(row);
    });

    // 关闭按钮
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '关闭';
    closeBtn.style.cssText = [
      'display: block',
      'margin: 14px auto 0',
      'background: transparent',
      'border: 1px solid rgba(154, 138, 106, 0.5)',
      'color: #9a8a6a',
      'padding: 6px 24px',
      'font-size: 11px',
      'border-radius: 3px',
      'cursor: pointer',
      'font-family: inherit'
    ].join(';');
    closeBtn.addEventListener('click', () => this._voicePanelCleanup());
    panel.appendChild(closeBtn);

    // === 自定义音频导入区 ===
    const importSection = document.createElement('div');
    importSection.style.cssText = 'margin: 14px 0 6px; padding-top: 10px; border-top: 1px dashed rgba(154, 138, 106, 0.3);';
    importSection.innerHTML = `
      <div style="font-size: 11px; color: var(--color-gold, #f0c040); margin-bottom: 4px;">♪ 自定义音频导入</div>
      <div style="font-size: 9px; color: #9a8a6a; line-height: 1.5; margin-bottom: 8px;">
        导入你录制的音频文件（mp3/wav/ogg/m4a，≤2MB）。<br>
        导入后选择"自定义音频"预设，所有语音将播放该音频（非 TTS）。<br>
        <span style="color: #e07050;">注意：浏览器无法用少量样本克隆声音，每段文本需单独录制。</span>
      </div>
    `;
    panel.appendChild(importSection);

    // 隐藏文件选择器
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'audio/*,.mp3,.wav,.ogg,.m4a,.aac';
    fileInput.style.display = 'none';
    panel.appendChild(fileInput);

    const importBtn = document.createElement('button');
    importBtn.textContent = this.audio.hasCustomVoice() ? '♪ 重新导入音频' : '♪ 导入音频文件';
    importBtn.style.cssText = 'background: rgba(120, 80, 30, 0.6); color: #f0c040; border: 1px solid #c09830; padding: 8px 12px; font-size: 11px; cursor: pointer; margin-right: 8px; font-family: inherit;';
    importBtn.addEventListener('click', () => fileInput.click());
    panel.appendChild(importBtn);

    fileInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const result = await this.audio.importCustomVoice(file);
      if (result.ok) {
        importBtn.textContent = '♪ 重新导入音频';
        const status = document.createElement('div');
        status.style.cssText = 'font-size: 10px; color: #7ad07a; margin-top: 6px;';
        status.textContent = `✓ 导入成功：${file.name}（${(file.size/1024).toFixed(1)}KB）。选择"自定义音频"预设试听。`;
        panel.appendChild(status);
        // 同步刷新已存在的 custom 预设行（如果已渲染）
      } else {
        const err = document.createElement('div');
        err.style.cssText = 'font-size: 10px; color: #e07050; margin-top: 6px;';
        err.textContent = `✗ ${result.error}`;
        panel.appendChild(err);
      }
    });

    // 清除按钮（仅在已导入时显示）
    if (this.audio.hasCustomVoice()) {
      const clearBtn = document.createElement('button');
      clearBtn.textContent = '清除';
      clearBtn.style.cssText = 'background: rgba(120, 30, 30, 0.4); color: #e07050; border: 1px solid #803030; padding: 8px 12px; font-size: 11px; cursor: pointer; font-family: inherit;';
      clearBtn.addEventListener('click', () => {
        this.audio.clearCustomVoice();
        importBtn.textContent = '♪ 导入音频文件';
        const status = document.createElement('div');
        status.style.cssText = 'font-size: 10px; color: #9a8a6a; margin-top: 6px;';
        status.textContent = '已清除自定义音频';
        panel.appendChild(status);
      });
      panel.appendChild(clearBtn);
    }

    // === 系统可用中文语音调试区（帮助用户了解为什么男声可能匹配到女声）===
    const zhVoices = this.audio.listSystemZhVoices();
    if (zhVoices.length > 0) {
      const debugTitle = document.createElement('div');
      debugTitle.textContent = `系统可用中文语音（${zhVoices.length} 个）`;
      debugTitle.style.cssText = 'font-size: 10px; color: #9a8a6a; margin: 14px 0 6px; padding-top: 10px; border-top: 1px dashed rgba(154, 138, 106, 0.3);';
      panel.appendChild(debugTitle);

      zhVoices.forEach(v => {
        const vRow = document.createElement('div');
        vRow.style.cssText = 'font-size: 9px; color: #7a6a5a; padding: 2px 0; line-height: 1.4;';
        const gLabel = v.isMale === true ? '男' : v.isMale === false ? '女' : '?';
        vRow.textContent = `· [${gLabel}] ${v.name} (${v.lang})`;
        panel.appendChild(vRow);
      });

      if (zhVoices.every(v => v.isMale !== true)) {
        const warn = document.createElement('div');
        warn.style.cssText = 'font-size: 9px; color: #e07050; margin-top: 6px; line-height: 1.5;';
        warn.textContent = '⚠ 你的系统未检测到中文男声 voice。男声预设将回退到默认女声，仅通过调低音调/语速模拟。';
        panel.appendChild(warn);
      }
    }

    document.body.appendChild(panel);

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
      if (e.code === 'Escape') this._voicePanelCleanup();
    };
    window.addEventListener('keydown', onKey);

    this._voicePanelCleanup = () => {
      window.removeEventListener('pointerdown', onOutsideClick);
      window.removeEventListener('keydown', onKey);
      if (panel.parentNode) panel.parentNode.removeChild(panel);
      this._voicePanelCleanup = null;
    };
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
