/**
 * 全局通知系统
 *
 * 约束：
 * - 同一时间只呈现一条，避免通知互相遮挡与读屏器连续轰炸。
 * - error > warning > success > info；高优先级可抢占并将低优先级放回队列。
 * - 通知先保持一个稳定的播报窗口，再开始自动消失倒计时。
 * - 悬停、焦点进入或页面隐藏时暂停；关闭按钮与 Escape 均可主动关闭。
 */

const TOAST_STYLES = `
.toast-container {
  position: fixed;
  left: 50%;
  bottom: calc(env(safe-area-inset-bottom, 0px) + 80px);
  width: min(420px, calc(100vw - 24px));
  transform: translateX(-50%);
  z-index: 99990;
  pointer-events: none;
  box-sizing: border-box;
}
.toast-container[hidden] {
  display: none;
}
.toast-item {
  width: 100%;
  min-height: 60px;
  padding: 8px 8px 8px 14px;
  color: #e0d0b0;
  background:
    linear-gradient(135deg, rgba(31, 38, 72, 0.98), rgba(14, 20, 44, 0.98));
  border: 1px solid;
  border-left: 4px solid;
  box-shadow:
    0 12px 34px rgba(0, 0, 0, 0.55),
    inset 0 0 0 1px rgba(255, 255, 255, 0.025);
  box-sizing: border-box;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) 44px;
  align-items: center;
  gap: 10px;
  pointer-events: auto;
  opacity: 0;
  transform: translateY(10px) scale(0.97);
  transition: opacity 0.22s ease, transform 0.22s ease;
  font-family: var(--font-pixel, 'Luohammer UI', "Microsoft YaHei", monospace);
  font-size: clamp(12px, 2vw, 14px);
}
.toast-item.show {
  opacity: 1;
  transform: translateY(0) scale(1);
}
.toast-item[data-toast-lifecycle="paused"] {
  box-shadow:
    0 14px 38px rgba(0, 0, 0, 0.62),
    inset 0 0 0 1px rgba(240, 192, 64, 0.13);
}
.toast-icon {
  width: 22px;
  color: var(--toast-accent);
  font-size: clamp(16px, 2.4vw, 19px);
  line-height: 1;
  text-align: center;
}
.toast-content {
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 3px;
}
.toast-kind {
  color: var(--toast-accent);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 1px;
}
.toast-text {
  width: 100%;
  color: #ece5d7;
  line-height: 1.45;
  overflow-wrap: anywhere;
}
.toast-queue-count {
  color: rgba(218, 220, 235, 0.58);
  font-size: 10px;
  letter-spacing: 0.5px;
}
.toast-queue-count[hidden] {
  display: none;
}
.toast-close {
  width: 44px;
  min-width: 44px;
  height: 44px;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: rgba(236, 229, 215, 0.7);
  background: rgba(255, 255, 255, 0.025);
  border: 1px solid rgba(236, 229, 215, 0.18);
  cursor: pointer;
  font: 18px/1 Arial, sans-serif;
  appearance: none;
  touch-action: manipulation;
  transition: color 0.16s ease, border-color 0.16s ease, background 0.16s ease;
}
.toast-close:hover,
.toast-close:focus-visible {
  color: #fff4cf;
  border-color: var(--toast-accent);
  background: rgba(240, 192, 64, 0.1);
  outline: 2px solid var(--toast-accent);
  outline-offset: 2px;
}
@media (max-width: 480px) {
  .toast-container {
    bottom: calc(env(safe-area-inset-bottom, 0px) + 72px);
    width: calc(100vw - 24px);
  }
  .toast-item {
    min-height: 64px;
    padding-left: 12px;
    gap: 8px;
  }
}
@media (prefers-reduced-motion: reduce) {
  .toast-item {
    transition: none;
    transform: none;
  }
}
`;

const TOAST_TYPES = {
  info: {
    color: 'var(--color-info, #5aa9e6)',
    icon: 'ℹ',
    label: '提示',
    priority: 1,
    duration: 3500,
    announcementGrace: 700
  },
  success: {
    color: 'var(--color-success, #53c878)',
    icon: '✓',
    label: '成功',
    priority: 2,
    duration: 3200,
    announcementGrace: 700
  },
  warning: {
    color: 'var(--color-warning, #f0b84b)',
    icon: '⚠',
    label: '注意',
    priority: 3,
    duration: 4800,
    announcementGrace: 900
  },
  error: {
    color: 'var(--color-danger, #df6b6b)',
    icon: '✕',
    label: '错误',
    priority: 4,
    duration: 6500,
    announcementGrace: 1100
  }
};

const EXIT_DURATION = 220;
const MIN_RESUME_DURATION = 300;

function normalizeType(type) {
  return Object.prototype.hasOwnProperty.call(TOAST_TYPES, type) ? type : 'info';
}

function normalizeShowArgs(type, durationOrOptions) {
  let resolvedType = type;
  let options = {};
  if (type && typeof type === 'object') {
    options = type;
    resolvedType = options.type || 'info';
  } else if (durationOrOptions && typeof durationOrOptions === 'object') {
    options = durationOrOptions;
  } else if (typeof durationOrOptions === 'number') {
    options = { duration: durationOrOptions };
  }
  resolvedType = normalizeType(resolvedType);
  const config = TOAST_TYPES[resolvedType];
  return {
    type: resolvedType,
    duration: options.duration ?? config.duration,
    priority: options.priority ?? config.priority,
    dismissible: options.dismissible !== false,
    announcementGrace: options.announcementGrace ?? config.announcementGrace
  };
}

export class ToastSystem {
  constructor() {
    this._container = null;
    this._queue = [];
    this._active = null;
    this._sequence = 0;
    this._styleInjected = false;
    this._destroyed = false;
    this._activeTimers = new Set();
    this._visibilityBound = false;
    this._viewportBound = false;
    this._onVisibilityChange = () => {
      if (document.hidden) this._pauseActive('document-hidden');
      else this._resumeActive('document-hidden');
    };
    this._onViewportChange = () => this._updatePlacement();
    this._init();
  }

  _init() {
    if (typeof document === 'undefined' || this._destroyed) return;

    if (!document.getElementById('toast-system-style')) {
      const style = document.createElement('style');
      style.id = 'toast-system-style';
      style.textContent = TOAST_STYLES;
      document.head.appendChild(style);
    }
    this._styleInjected = true;

    if (!this._container?.isConnected) {
      this._container = document.querySelector('.toast-container');
      if (!this._container) {
        this._container = document.createElement('div');
        this._container.className = 'toast-container';
        this._container.hidden = true;
        this._container.setAttribute('aria-label', '游戏通知');
        document.body.appendChild(this._container);
      }
    }

    if (!this._visibilityBound) {
      document.addEventListener('visibilitychange', this._onVisibilityChange);
      this._visibilityBound = true;
    }
    if (!this._viewportBound) {
      window.addEventListener('resize', this._onViewportChange);
      window.addEventListener('orientationchange', this._onViewportChange);
      this._viewportBound = true;
    }
    this._syncContainerState();
  }

  /**
   * @param {string} message
   * @param {'info'|'success'|'warning'|'error'|object} type
   * @param {number|object} durationOrOptions
   * @returns {{id: number, dismiss: Function}|null}
   */
  showToast(message, type = 'info', durationOrOptions) {
    if (this._destroyed) return null;
    this._init();
    const text = String(message ?? '').trim();
    if (!text) return null;

    const normalized = normalizeShowArgs(type, durationOrOptions);
    const duplicate = this._findDuplicate(text, normalized.type);
    if (duplicate) {
      duplicate.count += 1;
      duplicate.duration = Math.max(duplicate.duration, normalized.duration);
      if (duplicate === this._active) {
        duplicate.remaining = duplicate.duration;
        this._updateActiveText();
        if (!duplicate.announcementTimer && duplicate.pauseReasons.size === 0) {
          this._startAutoClose(duplicate);
        }
      }
      this._syncContainerState();
      return this._createHandle(duplicate.id);
    }

    const item = {
      id: ++this._sequence,
      sequence: this._sequence,
      message: text,
      count: 1,
      ...normalized
    };
    this._queue.push(item);
    this._sortQueue();

    if (this._active && item.priority > this._active.priority) {
      this._preemptActive();
    } else {
      this._processQueue();
    }
    this._syncContainerState();
    return this._createHandle(item.id);
  }

  info(message, durationOrOptions) {
    return this.showToast(message, 'info', durationOrOptions);
  }

  success(message, durationOrOptions) {
    return this.showToast(message, 'success', durationOrOptions);
  }

  warning(message, durationOrOptions) {
    return this.showToast(message, 'warning', durationOrOptions);
  }

  error(message, durationOrOptions) {
    return this.showToast(message, 'error', durationOrOptions);
  }

  dismiss(id) {
    if (this._active?.id === id) {
      this._dismissActive('api');
      return true;
    }
    const index = this._queue.findIndex(item => item.id === id);
    if (index < 0) return false;
    this._queue.splice(index, 1);
    this._syncContainerState();
    return true;
  }

  clear() {
    this._queue = [];
    if (this._active) this._dismissActive('clear');
    else this._syncContainerState();
  }

  _createHandle(id) {
    return { id, dismiss: () => this.dismiss(id) };
  }

  _findDuplicate(message, type) {
    if (this._active?.message === message && this._active.type === type &&
        !this._active.closing) {
      return this._active;
    }
    return this._queue.find(item => item.message === message && item.type === type) || null;
  }

  _sortQueue() {
    this._queue.sort((left, right) =>
      right.priority - left.priority || left.sequence - right.sequence
    );
  }

  _preemptActive() {
    const active = this._active;
    if (!active || active.closing) return;
    const resumed = {
      id: active.id,
      sequence: active.sequence,
      message: active.message,
      count: active.count,
      type: active.type,
      duration: Math.max(800, active.remaining ?? active.duration),
      priority: active.priority,
      dismissible: active.dismissible,
      announcementGrace: 0
    };
    this._queue.push(resumed);
    this._sortQueue();
    this._dismissActive('preempted');
  }

  _processQueue() {
    if (this._destroyed || this._active || this._queue.length === 0) {
      this._syncContainerState();
      return;
    }
    this._sortQueue();
    this._renderToast(this._queue.shift());
  }

  _renderToast(item) {
    const config = TOAST_TYPES[item.type];
    this._updatePlacement();
    const element = document.createElement('div');
    element.className = 'toast-item';
    element.dataset.toastId = String(item.id);
    element.dataset.toastType = item.type;
    element.dataset.toastLifecycle = 'announcing';
    element.setAttribute('role', item.type === 'error' ? 'alert' : 'status');
    element.setAttribute('aria-live', item.type === 'error' ? 'assertive' : 'polite');
    element.setAttribute('aria-atomic', 'true');
    element.style.setProperty('--toast-accent', config.color);
    element.style.borderColor = config.color;
    element.style.borderLeftColor = config.color;

    const icon = document.createElement('span');
    icon.className = 'toast-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = config.icon;

    const content = document.createElement('span');
    content.className = 'toast-content';
    const kind = document.createElement('span');
    kind.className = 'toast-kind';
    kind.textContent = config.label;
    const text = document.createElement('span');
    text.className = 'toast-text';
    const queueCount = document.createElement('span');
    queueCount.className = 'toast-queue-count';
    queueCount.hidden = true;
    queueCount.setAttribute('aria-hidden', 'true');
    content.append(kind, text, queueCount);

    const closeButton = document.createElement('button');
    closeButton.type = 'button';
    closeButton.className = 'toast-close';
    closeButton.textContent = '×';
    closeButton.setAttribute('aria-label', `关闭${config.label}通知：${item.message}`);
    closeButton.hidden = !item.dismissible;

    element.append(icon, content, closeButton);
    this._container.appendChild(element);
    this._active = {
      ...item,
      element,
      textElement: text,
      queueCountElement: queueCount,
      closeButton,
      remaining: Math.max(0, Number(item.duration) || 0),
      startedAt: null,
      autoCloseTimer: null,
      announcementTimer: null,
      pauseReasons: new Set(),
      closing: false
    };

    element.addEventListener('mouseenter', () => this._pauseActive('hover'));
    element.addEventListener('mouseleave', () => this._resumeActive('hover'));
    element.addEventListener('pointerenter', () => this._pauseActive('hover'));
    element.addEventListener('pointerleave', () => this._resumeActive('hover'));
    element.addEventListener('focusin', () => this._pauseActive('focus'));
    element.addEventListener('focusout', event => {
      if (!element.contains(event.relatedTarget)) this._resumeActive('focus');
    });
    element.addEventListener('keydown', event => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      this._dismissActive('escape');
    });
    closeButton.addEventListener('click', event => {
      event.stopPropagation();
      this._dismissActive('button');
    });

    this._updateActiveText();
    this._syncContainerState();
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (this._active?.id === item.id) element.classList.add('show');
      });
    });

    if (item.announcementGrace > 0) {
      this._active.announcementTimer = this._trackedTimeout(() => {
        if (this._active?.id !== item.id) return;
        this._active.announcementTimer = null;
        if (this._active.pauseReasons.size > 0) {
          this._setLifecycle('paused');
        } else {
          this._startAutoClose(this._active);
        }
      }, item.announcementGrace);
    } else {
      this._startAutoClose(this._active);
    }
  }

  _updateActiveText() {
    if (!this._active) return;
    this._active.textElement.textContent = this._active.count > 1
      ? `${this._active.message}（×${this._active.count}）`
      : this._active.message;
  }

  _syncContainerState() {
    if (!this._container) return;
    this._container.dataset.toastQueueSize = String(this._queue.length);
    this._container.dataset.toastActiveType = this._active?.type || '';
    this._container.hidden = !this._active && this._queue.length === 0;
    if (this._active?.queueCountElement) {
      const count = this._queue.length;
      this._active.queueCountElement.hidden = count === 0;
      this._active.queueCountElement.textContent = count > 0
        ? `随后还有 ${count} 条通知`
        : '';
    }
  }

  _updatePlacement() {
    if (!this._container || typeof window === 'undefined') return;
    const defaultOffset = window.innerWidth <= 480 ? 72 : 80;
    const avoidSelectors = [
      '#ui-dialog.visible',
      '#ui-choices.visible'
    ];
    let avoidHeight = 0;
    for (const selector of avoidSelectors) {
      const element = document.querySelector(selector);
      if (!element) continue;
      const style = getComputedStyle(element);
      if (style.display === 'none' || style.visibility === 'hidden') continue;
      avoidHeight = Math.max(
        avoidHeight,
        element.getBoundingClientRect().height || element.offsetHeight || 0
      );
    }
    const offset = Math.max(defaultOffset, Math.ceil(avoidHeight + 12));
    this._container.style.bottom =
      `calc(env(safe-area-inset-bottom, 0px) + ${offset}px)`;
  }

  _setLifecycle(lifecycle) {
    if (this._active?.element) {
      this._active.element.dataset.toastLifecycle = lifecycle;
    }
  }

  _startAutoClose(active) {
    if (!active || active !== this._active || active.closing) return;
    this._clearTrackedTimer(active.autoCloseTimer);
    active.autoCloseTimer = null;
    if (active.duration === 0) {
      this._setLifecycle('persistent');
      return;
    }
    if (active.pauseReasons.size > 0) {
      this._setLifecycle('paused');
      return;
    }
    this._setLifecycle('timed');
    active.startedAt = Date.now();
    active.remaining = Math.max(MIN_RESUME_DURATION, active.remaining);
    active.autoCloseTimer = this._trackedTimeout(() => {
      if (this._active?.id === active.id) this._dismissActive('timeout');
    }, active.remaining);
  }

  _pauseActive(reason) {
    const active = this._active;
    if (!active || active.closing) return;
    active.pauseReasons.add(reason);
    if (active.autoCloseTimer) {
      const elapsed = Math.max(0, Date.now() - active.startedAt);
      active.remaining = Math.max(0, active.remaining - elapsed);
      this._clearTrackedTimer(active.autoCloseTimer);
      active.autoCloseTimer = null;
    }
    this._setLifecycle('paused');
  }

  _resumeActive(reason) {
    const active = this._active;
    if (!active || active.closing) return;
    active.pauseReasons.delete(reason);
    if (active.pauseReasons.size > 0) return;
    if (active.announcementTimer) {
      this._setLifecycle('announcing');
      return;
    }
    if (active.duration !== 0) {
      active.remaining = Math.max(MIN_RESUME_DURATION, active.remaining);
    }
    this._startAutoClose(active);
  }

  _dismissActive(reason) {
    const active = this._active;
    if (!active || active.closing) return;
    active.closing = true;
    this._clearTrackedTimer(active.autoCloseTimer);
    this._clearTrackedTimer(active.announcementTimer);
    active.autoCloseTimer = null;
    active.announcementTimer = null;
    active.element.dataset.toastDismissReason = reason;
    active.element.dataset.toastLifecycle = 'closing';
    active.element.classList.remove('show');

    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    this._trackedTimeout(() => {
      active.element.remove();
      if (this._active?.id === active.id) this._active = null;
      this._syncContainerState();
      this._processQueue();
    }, reducedMotion ? 0 : EXIT_DURATION);
  }

  _trackedTimeout(fn, delay) {
    const id = setTimeout(() => {
      this._activeTimers.delete(id);
      try { fn(); } catch (e) { /* 页面或场景已退出时静默清理 */ }
    }, Math.max(0, delay));
    this._activeTimers.add(id);
    return id;
  }

  _clearTrackedTimer(id) {
    if (id === null || id === undefined) return;
    clearTimeout(id);
    this._activeTimers.delete(id);
  }

  destroy() {
    this._destroyed = true;
    this._queue = [];
    for (const timer of this._activeTimers) clearTimeout(timer);
    this._activeTimers.clear();
    if (this._visibilityBound && typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this._onVisibilityChange);
    }
    this._visibilityBound = false;
    if (this._viewportBound && typeof window !== 'undefined') {
      window.removeEventListener('resize', this._onViewportChange);
      window.removeEventListener('orientationchange', this._onViewportChange);
    }
    this._viewportBound = false;
    this._active?.element?.remove();
    this._active = null;
    this._container?.remove();
    this._container = null;
  }
}

export const toast = new ToastSystem();

if (import.meta.env.DEV && typeof window !== 'undefined') {
  window.__luohammerToastDebug = { ToastSystem, toast };
}

export default toast;
