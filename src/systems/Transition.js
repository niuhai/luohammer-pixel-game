import { GAME_WIDTH, GAME_HEIGHT, UI_COLORS } from '../config.js';

export class Transition {
  constructor(scene) {
    this.scene = scene;

    // ---- 基础遮罩层（原 fade 用） ----
    this.overlay = scene.add.rectangle(
      GAME_WIDTH / 2, GAME_HEIGHT / 2,
      GAME_WIDTH, GAME_HEIGHT,
      0x000000, 0
    ).setDepth(1000).setScrollFactor(0);

    this.active = false;

    // ---- CRT 效果层 ----
    // 白光闪烁层
    this.crtFlash = scene.add.rectangle(
      GAME_WIDTH / 2, GAME_HEIGHT / 2,
      GAME_WIDTH, GAME_HEIGHT,
      0xffffff, 0
    ).setDepth(1001).setScrollFactor(0);

    // 扫描线层（用 Graphics 绘制）
    this.scanlineGfx = scene.add.graphics().setDepth(1002).setScrollFactor(0);
    this.scanlineGfx.setVisible(false);

    // ---- 像素块擦除层 ----
    this.wipeGfx = scene.add.graphics().setDepth(1003).setScrollFactor(0);
    this.wipeGfx.setVisible(false);

    // ---- CRT 关机收缩矩形 ----
    this.crtShutter = scene.add.rectangle(
      GAME_WIDTH / 2, GAME_HEIGHT / 2,
      GAME_WIDTH, GAME_HEIGHT,
      0x000000, 0
    ).setDepth(1004).setScrollFactor(0);
  }

  // ===================================================================
  //  原 API 兼容：fade 仍可用
  // ===================================================================

  /**
   * 原有淡入淡出转场（保持向后兼容）
   */
  play(onMidpoint, onComplete) {
    if (this.active) return;
    this.active = true;

    this.scene.tweens.add({
      targets: this.overlay,
      alpha: 1,
      duration: 250,
      ease: 'Linear',
      onComplete: () => {
        if (onMidpoint) onMidpoint();
        this.scene.tweens.add({
          targets: this.overlay,
          alpha: 0,
          duration: 250,
          ease: 'Linear',
          onComplete: () => {
            this.active = false;
            if (onComplete) onComplete();
          }
        });
      }
    });
  }

  // ===================================================================
  //  CRT 关机效果
  //  白光闪烁 → 画面水平收缩成一条亮线 → 亮线缩短消失 → 全黑
  // ===================================================================

  /**
   * CRT 关机动画
   * @param {Function} onComplete - 动画完成回调
   * @param {Object} [opts] - 配置项
   * @param {number} [opts.flashDuration=80] - 白光闪烁时长 ms
   * @param {number} [opts.shrinkDuration=220] - 收缩时长 ms
   * @param {number} [opts.lineDuration=120] - 亮线消失时长 ms
   */
  crtOff(onComplete, opts = {}) {
    if (this.active) return;
    this.active = true;

    const flashDur = opts.flashDuration || 80;
    const shrinkDur = opts.shrinkDuration || 220;
    const lineDur = opts.lineDuration || 120;

    // Step 1: 白光闪烁
    this.crtFlash.setAlpha(0.9);
    this.scene.tweens.add({
      targets: this.crtFlash,
      alpha: 0,
      duration: flashDur,
      ease: 'Linear',
      onComplete: () => {
        // Step 2: 画面收缩成水平亮线
        this.crtShutter.setAlpha(1);
        this.crtShutter.setSize(GAME_WIDTH, GAME_HEIGHT);
        this.crtShutter.setPosition(GAME_WIDTH / 2, GAME_HEIGHT / 2);

        this.scene.tweens.add({
          targets: this.crtShutter,
          scaleX: 1,
          scaleY: { from: 1, to: 0.005 },
          duration: shrinkDur,
          ease: 'Quad.easeIn',
          onComplete: () => {
            // Step 3: 亮线缩短消失
            this.scene.tweens.add({
              targets: this.crtShutter,
              scaleX: { from: 1, to: 0 },
              duration: lineDur,
              ease: 'Quad.easeIn',
              onComplete: () => {
                // 确保全黑
                this.overlay.setAlpha(1);
                this.crtShutter.setAlpha(0);
                this.crtShutter.setScale(1, 1);
                this.active = false;
                if (onComplete) onComplete();
              }
            });
          }
        });
      }
    });
  }

  // ===================================================================
  //  CRT 开机效果
  //  全黑 → 中央亮线出现 → 亮线垂直展开 → 扫描线从上到下展开 → 画面显现
  // ===================================================================

  /**
   * CRT 开机动画
   * @param {Function} onComplete - 动画完成回调
   * @param {Object} [opts] - 配置项
   * @param {number} [opts.lineDuration=120] - 亮线出现时长 ms
   * @param {number} [opts.expandDuration=250] - 垂直展开时长 ms
   * @param {number} [opts.scanlineDuration=300] - 扫描线展开时长 ms
   */
  crtOn(onComplete, opts = {}) {
    if (this.active) return;
    this.active = true;

    const lineDur = opts.lineDuration || 120;
    const expandDur = opts.expandDuration || 250;
    const scanDur = opts.scanlineDuration || 300;

    // 前提：overlay 是全黑的（alpha=1）
    // Step 1: 中央亮线出现
    this.crtShutter.setSize(GAME_WIDTH, 2);
    this.crtShutter.setPosition(GAME_WIDTH / 2, GAME_HEIGHT / 2);
    this.crtShutter.setScale(0, 1);
    this.crtShutter.setAlpha(1);

    this.scene.tweens.add({
      targets: this.crtShutter,
      scaleX: { from: 0, to: 1 },
      duration: lineDur,
      ease: 'Quad.easeOut',
      onComplete: () => {
        // Step 2: 亮线垂直展开成全屏
        this.scene.tweens.add({
          targets: this.crtShutter,
          scaleY: { from: 1, to: GAME_HEIGHT / 2 },
          duration: expandDur,
          ease: 'Quad.easeOut',
          onUpdate: () => {
            // 亮线展开时同步降低黑遮罩
            const progress = this.crtShutter.scaleY / (GAME_HEIGHT / 2);
            this.overlay.setAlpha(1 - progress);
          },
          onComplete: () => {
            this.crtShutter.setAlpha(0);
            this.crtShutter.setScale(1, 1);
            this.overlay.setAlpha(0);

            // Step 3: 扫描线从上到下展开
            this._drawScanlines(0);
            this.scanlineGfx.setVisible(true);

            this.scene.tweens.add({
              targets: this,
              _scanlineProgress: { from: 0, to: 1 },
              duration: scanDur,
              ease: 'Linear',
              onUpdate: (tw, target) => {
                this._drawScanlines(target._scanlineProgress);
              },
              onComplete: () => {
                this.scanlineGfx.setVisible(false);
                this.scanlineGfx.clear();
                this._scanlineProgress = 0;
                this.active = false;
                if (onComplete) onComplete();
              }
            });
          }
        });
      }
    });
  }

  /**
   * 绘制扫描线效果（从上到下逐渐消失）
   * @param {number} progress - 0~1，0=全屏扫描线，1=扫描线全部消失
   */
  _drawScanlines(progress) {
    this.scanlineGfx.clear();
    const lineGap = 3;
    const totalLines = Math.ceil(GAME_HEIGHT / lineGap);
    const visibleLines = Math.ceil(totalLines * (1 - progress));

    for (let i = 0; i < visibleLines; i++) {
      const y = i * lineGap;
      this.scanlineGfx.fillStyle(0x000000, 0.25);
      this.scanlineGfx.fillRect(0, y, GAME_WIDTH, 1);
    }
  }

  // ===================================================================
  //  像素块擦除转场
  //  画面被随机像素块逐渐覆盖（擦除），然后反向擦除显现新画面
  // ===================================================================

  /**
   * 像素块擦除转场
   * @param {Function} onMidpoint - 中点回调（画面完全被遮住时）
   * @param {Function} onComplete - 完成回调
   * @param {Object} [opts] - 配置项
   * @param {number} [opts.blockSize=20] - 像素块大小
   * @param {number} [opts.wipeInDuration=400] - 擦入时长 ms
   * @param {number} [opts.wipeOutDuration=400] - 擦出时长 ms
   * @param {number} [opts.color=0x000000] - 擦除块颜色
   */
  pixelWipe(onMidpoint, onComplete, opts = {}) {
    if (this.active) return;
    this.active = true;

    const blockSize = opts.blockSize || 20;
    const wipeInDur = opts.wipeInDuration || 400;
    const wipeOutDur = opts.wipeOutDuration || 400;
    const color = opts.color !== undefined ? opts.color : 0x000000;

    // 生成所有像素块的位置
    const cols = Math.ceil(GAME_WIDTH / blockSize);
    const rows = Math.ceil(GAME_HEIGHT / blockSize);
    const blocks = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        blocks.push({
          x: c * blockSize,
          y: r * blockSize,
          // 随机延迟让擦除有"散开"感
          delay: Math.random()
        });
      }
    }
    // 按延迟排序
    blocks.sort((a, b) => a.delay - b.delay);

    // 擦入：逐步绘制像素块
    this.wipeGfx.clear();
    this.wipeGfx.setVisible(true);
    this.wipeGfx.setAlpha(1);

    let wipeInElapsed = 0;
    const wipeInTimer = this.scene.time.addEvent({
      delay: 16,
      loop: true,
      callback: () => {
        wipeInElapsed += 16;
        const progress = Math.min(wipeInElapsed / wipeInDur, 1);
        const count = Math.floor(progress * blocks.length);

        this.wipeGfx.clear();
        this.wipeGfx.fillStyle(color, 1);
        for (let i = 0; i < count; i++) {
          const b = blocks[i];
          this.wipeGfx.fillRect(b.x, b.y, blockSize, blockSize);
        }

        if (progress >= 1) {
          wipeInTimer.remove();
          // 全部遮住，执行中点回调
          if (onMidpoint) onMidpoint();

          // 擦出：反向逐步移除像素块
          let wipeOutElapsed = 0;
          const wipeOutTimer = this.scene.time.addEvent({
            delay: 16,
            loop: true,
            callback: () => {
              wipeOutElapsed += 16;
              const progress = Math.min(wipeOutElapsed / wipeOutDur, 1);
              const count = Math.floor(progress * blocks.length);

              this.wipeGfx.clear();
              this.wipeGfx.fillStyle(color, 1);
              // 从后往前移除
              for (let i = count; i < blocks.length; i++) {
                const b = blocks[i];
                this.wipeGfx.fillRect(b.x, b.y, blockSize, blockSize);
              }

              if (progress >= 1) {
                wipeOutTimer.remove();
                this.wipeGfx.clear();
                this.wipeGfx.setVisible(false);
                this.active = false;
                if (onComplete) onComplete();
              }
            }
          });
        }
      }
    });
  }

  // ===================================================================
  //  阶段转场（stageTransition）：CRT 关机 → 中点 → CRT 开机
  //  用于大场景切换（如章节切换）
  // ===================================================================

  /**
   * 阶段转场：CRT 关机 + 开机组合效果
   * @param {Function} onMidpoint - 中点回调（黑屏时切换场景内容）
   * @param {Function} onComplete - 完成回调
   * @param {Object} [opts] - 配置项（透传给 crtOff/crtOn）
   */
  stageTransition(onMidpoint, onComplete, opts = {}) {
    if (this.active) return;

    // CRT 关机
    this.crtOff(() => {
      if (onMidpoint) onMidpoint();

      // 短暂停顿让黑屏有"关机感"
      this.scene.time.delayedCall(150, () => {
        // CRT 开机
        this.crtOn(() => {
          if (onComplete) onComplete();
        }, opts);
      });
    }, opts);
  }

  // ===================================================================
  //  屏幕震动（通过 camera shake 实现，不影响 UI 层）
  // ===================================================================

  /**
   * 屏幕震动
   * @param {number} intensity - 震动强度（像素）
   * @param {number} duration - 震动时长 ms
   */
  shake(intensity = 4, duration = 200) {
    this.scene.cameras.main.shake(duration, intensity / 1000);
  }

  /**
   * 翻车强震动 (8px, 300ms)
   */
  shakeHard() {
    this.shake(8, 300);
  }

  /**
   * 重大选择轻微震动 (2px, 100ms)
   */
  shakeLight() {
    this.shake(2, 100);
  }

  /**
   * 销毁资源，防止内存泄漏
   */
  destroy() {
    // 销毁所有 Graphics 和 Rectangle 对象
    if (this.scanlineGfx) { this.scanlineGfx.destroy(); this.scanlineGfx = null; }
    if (this.wipeGfx) { this.wipeGfx.destroy(); this.wipeGfx = null; }
    if (this.overlay) { this.overlay.destroy(); this.overlay = null; }
    if (this.crtFlash) { this.crtFlash.destroy(); this.crtFlash = null; }
    if (this.crtShutter) { this.crtShutter.destroy(); this.crtShutter = null; }
    this.scene = null;
  }
}
