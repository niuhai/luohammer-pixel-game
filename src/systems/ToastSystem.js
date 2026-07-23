/**
 * 全局 Toast 通知系统
 *
 * 设计要点：
 * - 动态创建 DOM 与 CSS，无需在 index.html 中预定义
 * - 固定底部居中、像素风样式，与项目整体视觉一致
 * - 支持队列：多个 Toast 依次显示，每个间隔 100ms
 * - 4 种类型（info / success / warning / error），各自配色与图标
 * - 淡入淡出 0.3s，默认 3s 自动消失，可配置；点击可提前关闭
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

export class ToastSystem {
  constructor() {
    this._container = null;
    this._queue = [];
    this._processing = false;
    this._styleInjected = false;
    this._destroyed = false;
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
    this._queue.push({ message, type, duration });
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
   * 处理队列：依次显示 Toast，每个间隔 100ms
   */
  _processQueue() {
    if (this._processing) return;
    if (this._queue.length === 0) return;

    this._processing = true;
    const item = this._queue.shift();
    this._renderToast(item);

    // 等当前 Toast 渲染后，间隔 100ms 处理下一个
    setTimeout(() => {
      this._processing = false;
      if (this._queue.length > 0) {
        this._processQueue();
      }
    }, QUEUE_INTERVAL);
  }

  /**
   * 渲染单个 Toast 元素
   */
  _renderToast({ message, type, duration }) {
    const config = TOAST_TYPES[type] || TOAST_TYPES.info;

    const item = document.createElement('div');
    item.className = 'toast-item';
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

    let closed = false;
    const close = () => {
      if (closed) return;
      closed = true;
      item.classList.remove('show');
      // 等淡出动画结束后移除节点
      setTimeout(() => {
        if (item.parentNode) {
          item.parentNode.removeChild(item);
        }
      }, 300);
    };

    // 点击提前关闭
    item.addEventListener('click', close);

    this._container.appendChild(item);

    // 触发淡入（下一帧，确保 transition 生效）
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        item.classList.add('show');
      });
    });

    // 自动消失
    const autoCloseTimer = setTimeout(close, duration || DEFAULT_DURATION);

    // 点击时清除自动定时器，避免重复触发
    item.addEventListener('click', () => {
      clearTimeout(autoCloseTimer);
    });
  }

  /**
   * 销毁 Toast 系统：清空队列并移除容器
   */
  destroy() {
    this._destroyed = true;
    this._queue = [];
    if (this._container && this._container.parentNode) {
      this._container.parentNode.removeChild(this._container);
    }
    this._container = null;
  }
}

// 全局单例
export const toast = new ToastSystem();

export default toast;
