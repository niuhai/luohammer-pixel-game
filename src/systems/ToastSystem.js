/**
 * 全局 Toast 通知系统
 *
 * 设计要点：
 * - 动态创建 DOM 与 CSS，无需在 index.html 中预定义
 * - 固定底部居中、像素风样式，与项目整体视觉一致
 * - 优先级队列：error > warning > success > info，同级 FIFO，间隔 100ms（R025）
 * - 4 种类型（info / success / warning / error），各自配色与图标
 * - 淡入淡出 0.3s，默认 3s 自动消失，可配置；点击/Escape/Enter/Space 可提前关闭
 * - 悬停或聚焦期间暂停消失倒计时，离开后用剩余时间恢复（R025 可访问生命周期）
 * - 同屏最多 3 条，溢出在队列等待；对话框/选项可见时自动锚定到其上方（R025）
 */

const TOAST_STYLES = `
.toast-container {
  position: fixed;
  bottom: calc(env(safe-area-inset-bottom, 0px) + 80px);
  left: 50%;
  transform: translateX(-50%);
  z-index: 99990;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  pointer-events: none;
}
.toast-item {
  background: #16213e;
  border: 1px solid;
  border-left: 3px solid;
  padding: 10px 20px;
  max-width: min(90vw, 400px);
  pointer-events: auto;
  cursor: pointer;
  opacity: 0;
  transform: translateY(10px) scale(0.95);
  transition: opacity 0.3s, transform 0.3s;
  font-family: var(--font-pixel);
  font-size: clamp(12px, 2vw, 14px);
  color: #e0d0b0;
  display: flex;
  align-items: center;
  gap: 8px;
  box-sizing: border-box;
  box-shadow: 0 4px 16px rgba(0,0,0,0.4);
}
.toast-item.show {
  opacity: 1;
  transform: translateY(0) scale(1);
}
.toast-icon {
  font-size: clamp(14px, 2.2vw, 16px);
  flex-shrink: 0;
}
.toast-text {
  flex: 1;
  min-width: 0;
  word-break: break-word;
}
`;

const TOAST_TYPES = {
  info:    { color: 'var(--color-info)', icon: 'ℹ' },
  success: { color: 'var(--color-success)', icon: '✓' },
  warning: { color: 'var(--color-warning)', icon: '⚠' },
  error:   { color: 'var(--color-danger)', icon: '✕' }
};

const DEFAULT_DURATION = 3000;
const QUEUE_INTERVAL = 100;
// R025：跨场景通知优先级——错误 > 警告 > 成功 > 提示；同级保持 FIFO
const TOAST_PRIORITY = { error: 3, warning: 2, success: 1, info: 0 };
// R025：同屏可见上限，防止突发通知铺满屏幕遮挡操作区
const MAX_VISIBLE = 3;
// R025：恢复消失倒计时时的最小剩余时间，避免 hover 掠过即闪退
const MIN_RESUME_MS = 300;

export class ToastSystem {
  constructor() {
    this._container = null;
    this._queue = [];
    this._processing = false;
    this._styleInjected = false;
    this._destroyed = false;
    // R20 P2-004：跟踪所有 pending setTimeout，destroy 时批量清理
    this._activeTimers = new Set();
    this._init();
  }

  /**
   * 注入 CSS 样式并创建容器
   */
  _init() {
    if (typeof document === 'undefined') return;

    // 注入样式（只注入一次）
    if (!this._styleInjected && !document.getElementById('toast-system-style')) {
      const style = document.createElement('style');
      style.id = 'toast-system-style';
      style.textContent = TOAST_STYLES;
      document.head.appendChild(style);
      this._styleInjected = true;
    }

    // 创建容器（只创建一次）
    if (!this._container) {
      this._container = document.querySelector('.toast-container');
      if (!this._container) {
        this._container = document.createElement('div');
        this._container.className = 'toast-container';
        document.body.appendChild(this._container);
      }
    }
  }

  /**
   * 显示 Toast
   * @param {string} message 消息内容
   * @param {string} type 类型：info | success | warning | error
   * @param {number} duration 持续时间（毫秒），默认 3000
   */
  showToast(message, type = 'info', duration = DEFAULT_DURATION) {
    if (this._destroyed) return;
    this._init();
    // R025：按优先级插入（同级 FIFO，插到第一个更低优先级之前）
    const item = { message, type, duration };
    const pri = TOAST_PRIORITY[type] ?? TOAST_PRIORITY.info;
    let idx = this._queue.length;
    for (let i = 0; i < this._queue.length; i++) {
      const qPri = TOAST_PRIORITY[this._queue[i].type] ?? TOAST_PRIORITY.info;
      if (qPri < pri) { idx = i; break; }
    }
    this._queue.splice(idx, 0, item);
    this._processQueue();
  }

  info(message, duration) {
    this.showToast(message, 'info', duration);
  }

  success(message, duration) {
    this.showToast(message, 'success', duration);
  }

  warning(message, duration) {
    this.showToast(message, 'warning', duration);
  }

  error(message, duration) {
    this.showToast(message, 'error', duration);
  }

  /**
   * 处理队列：按优先级依次显示 Toast，每个间隔 100ms
   * R025：同屏可见数达 MAX_VISIBLE 时暂停出队，有关闭空位再继续
   */
  _processQueue() {
    if (this._processing) return;
    if (this._queue.length === 0) return;
    if (this._visibleCount() >= MAX_VISIBLE) return;

    this._updateAnchor();
    this._processing = true;
    const item = this._queue.shift();
    this._renderToast(item);

    // 等当前 Toast 渲染后，间隔 100ms 处理下一个（R23 P1-3：纳入 _activeTimers 跟踪）
    this._trackedTimeout(() => {
      this._processing = false;
      if (this._queue.length > 0) {
        this._processQueue();
      }
    }, QUEUE_INTERVAL);
  }

  /** 当前同屏可见 Toast 数 */
  _visibleCount() {
    return this._container ? this._container.childElementCount : 0;
  }

  /**
   * R025：避让核心操作区——对话框/选项面板可见时，把 Toast 锚定到其上方，
   * 不再固定 bottom:80px（会压在对白文字上）；两者都隐藏时回到默认 80px。
   */
  _updateAnchor() {
    if (!this._container || typeof document === 'undefined') return;
    let offset = 80;
    const choices = document.getElementById('ui-choices');
    const dialog = document.getElementById('ui-dialog');
    const visible = (el) => !!(el && el.classList.contains('visible') && el.offsetHeight > 0);
    if (visible(choices)) {
      offset = Math.max(offset, Math.ceil(choices.getBoundingClientRect().height) + 12);
    } else if (visible(dialog)) {
      offset = Math.max(offset, Math.ceil(dialog.getBoundingClientRect().height) + 12);
    }
    this._container.style.bottom = `calc(env(safe-area-inset-bottom, 0px) + ${offset}px)`;
  }

  /**
   * 安全注册原生 setTimeout 并跟踪引用，destroy 时自动清理
   * R23 P1-3：与 DialogSystem/GameScene 的 _trackedTimeout 模式一致
   * @param {Function} fn 回调函数
   * @param {number} delay 延迟毫秒
   * @returns {number} setTimeout id
   */
  _trackedTimeout(fn, delay) {
    const id = setTimeout(() => {
      this._activeTimers.delete(id);
      try { fn(); } catch (e) { /* 容器已销毁时静默忽略 */ }
    }, delay);
    this._activeTimers.add(id);
    return id;
  }

  /**
   * 渲染单个 Toast 元素
   * R025 可访问生命周期：
   * - 可聚焦（tabIndex=0），Escape/Enter/Space 关闭
   * - 悬停（pointerenter）或聚焦（focusin）期间暂停自动消失倒计时，
   *   离开后用剩余时间恢复——读屏/细读场景不会"还没读完就消失"
   */
  _renderToast({ message, type, duration }) {
    const config = TOAST_TYPES[type] || TOAST_TYPES.info;

    const item = document.createElement('div');
    item.className = 'toast-item';
    item.dataset.toastType = type;
    item.setAttribute('role', type === 'error' ? 'alert' : 'status');
    item.setAttribute('aria-live', type === 'error' ? 'assertive' : 'polite');
    item.setAttribute('aria-atomic', 'true');
    item.tabIndex = 0;
    item.style.borderColor = config.color;
    // 确保 border-left-color 按类型正确设置（覆盖 border-left 简写重置）
    item.style.borderLeftColor = config.color;

    const icon = document.createElement('span');
    icon.className = 'toast-icon';
    icon.style.color = config.color;
    icon.textContent = config.icon;

    const text = document.createElement('span');
    text.className = 'toast-text';
    text.textContent = message;

    item.appendChild(icon);
    item.appendChild(text);

    // === 自动消失倒计时（可暂停/恢复） ===
    let closed = false;
    let remaining = duration || DEFAULT_DURATION;
    let startedAt = 0;
    let dismissTimer = null;

    const clearDismissTimer = () => {
      if (dismissTimer !== null) {
        clearTimeout(dismissTimer);
        this._activeTimers.delete(dismissTimer);
        dismissTimer = null;
      }
    };

    const close = () => {
      if (closed) return;
      closed = true;
      clearDismissTimer();
      item.classList.remove('show');
      // 等淡出动画结束后移除节点（R23 P1-3：纳入 _activeTimers 跟踪）
      this._trackedTimeout(() => {
        if (item.parentNode) {
          item.parentNode.removeChild(item);
        }
        // R025：腾出可见空位后继续出队
        this._processQueue();
      }, 300);
    };

    const startCountdown = (ms) => {
      clearDismissTimer();
      startedAt = Date.now();
      dismissTimer = this._trackedTimeout(close, ms);
    };

    const pauseCountdown = () => {
      if (closed || dismissTimer === null) return;
      remaining = Math.max(0, remaining - (Date.now() - startedAt));
      clearDismissTimer();
    };

    const resumeCountdown = () => {
      if (closed || dismissTimer !== null) return;
      // R025：恢复时给足最小剩余时间，避免指针/焦点掠过导致闪退
      startCountdown(Math.max(remaining, MIN_RESUME_MS));
    };

    // 悬停暂停 / 离开恢复
    item.addEventListener('pointerenter', pauseCountdown);
    item.addEventListener('pointerleave', resumeCountdown);
    // 聚焦暂停 / 失焦恢复（键盘与读屏浏览共用此路径）
    item.addEventListener('focusin', pauseCountdown);
    item.addEventListener('focusout', resumeCountdown);
    // 点击提前关闭
    item.addEventListener('click', close);
    // 键盘关闭：Escape / Enter / Space
    item.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        close();
      }
    });

    this._container.appendChild(item);

    // 触发淡入（下一帧，确保 transition 生效）
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        item.classList.add('show');
      });
    });

    startCountdown(remaining);
  }

  /**
   * 销毁 Toast 系统：清空队列、清理全部定时器并移除容器
   * R025：补齐 _activeTimers 批量清理（旧实现只摘容器，倒计时仍会在后台空跑）
   */
  destroy() {
    this._destroyed = true;
    this._queue = [];
    for (const id of this._activeTimers) {
      clearTimeout(id);
    }
    this._activeTimers.clear();
    if (this._container && this._container.parentNode) {
      this._container.parentNode.removeChild(this._container);
    }
    this._container = null;
  }
}

// 全局单例
export const toast = new ToastSystem();

if (import.meta.env.DEV && typeof window !== 'undefined') {
  window.__luohammerToastDebug = { ToastSystem, toast };
}

export default toast;
