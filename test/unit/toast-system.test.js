import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastSystem } from '../../src/systems/ToastSystem.js';

/**
 * R025：跨场景通知的优先级、队列与可访问生命周期
 * 覆盖：优先级插入、同级 FIFO、可见上限、悬停/聚焦暂停恢复、
 *       键盘关闭、对话避让锚定、destroy 定时器清理
 */

function visibleToasts() {
  return [...document.querySelectorAll('.toast-item')];
}

function dispatch(el, type) {
  el.dispatchEvent(new Event(type, { bubbles: true }));
}

beforeEach(() => {
  document.body.innerHTML = `
    <div id="ui-dialog"></div>
    <div id="ui-choices"></div>
  `;
  vi.useFakeTimers();
  vi.stubGlobal('requestAnimationFrame', (cb) => { cb(); return 1; });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

describe('R025 ToastSystem 优先级队列', () => {
  it('error 插队到 info 之前渲染', () => {
    const sys = new ToastSystem();
    sys.info('提示');
    sys.error('错误');
    const items = visibleToasts();
    expect(items[0].dataset.toastType).toBe('error');
    expect(items[0].querySelector('.toast-text').textContent).toBe('错误');
    sys.destroy();
  });

  it('同级保持 FIFO', () => {
    const sys = new ToastSystem();
    sys.warning('警告一');
    sys.warning('警告二');
    const items = visibleToasts();
    expect(items[0].querySelector('.toast-text').textContent).toBe('警告一');
    expect(items[1].querySelector('.toast-text').textContent).toBe('警告二');
    sys.destroy();
  });

  it('同屏最多 3 条，溢出排队，关闭空位后继续出队', () => {
    const sys = new ToastSystem();
    for (let i = 0; i < 5; i++) sys.info(`消息${i}`, 60000);
    vi.advanceTimersByTime(1000); // 队列间隔 100ms 逐条出队
    expect(visibleToasts().length).toBe(3);
    // 关掉第一条 → 300ms 淡出后腾出空位 → 第四条出队
    visibleToasts()[0].dispatchEvent(new MouseEvent('click', { bubbles: true }));
    vi.advanceTimersByTime(400);
    vi.advanceTimersByTime(200);
    const texts = visibleToasts().map((t) => t.querySelector('.toast-text').textContent);
    expect(texts).toContain('消息3');
    sys.destroy();
  });
});

describe('R025 ToastSystem 暂停与恢复', () => {
  it('悬停暂停倒计时，离开后用剩余时间恢复', () => {
    const sys = new ToastSystem();
    sys.info('悬停测试', 1000);
    const item = visibleToasts()[0];
    vi.advanceTimersByTime(400); // 已过 400ms，剩余 600ms
    dispatch(item, 'pointerenter');
    vi.advanceTimersByTime(5000); // 暂停期间远超原定时
    expect(item.parentNode).not.toBeNull(); // 未消失
    dispatch(item, 'pointerleave');
    vi.advanceTimersByTime(599);
    expect(item.parentNode).not.toBeNull();
    vi.advanceTimersByTime(1 + 300); // 剩余 600ms 到期 + 300ms 淡出
    expect(item.parentNode).toBeNull();
    sys.destroy();
  });

  it('聚焦（读屏浏览路径）暂停倒计时，失焦恢复且保底 300ms', () => {
    const sys = new ToastSystem();
    sys.info('聚焦测试', 1000);
    const item = visibleToasts()[0];
    vi.advanceTimersByTime(950); // 剩余 50ms
    dispatch(item, 'focusin');
    vi.advanceTimersByTime(3000);
    expect(item.parentNode).not.toBeNull();
    dispatch(item, 'focusout');
    vi.advanceTimersByTime(299); // 保底 300ms 未到期
    expect(item.parentNode).not.toBeNull();
    vi.advanceTimersByTime(1 + 300);
    expect(item.parentNode).toBeNull();
    sys.destroy();
  });
});

describe('R025 ToastSystem 键盘与角色语义', () => {
  it('可聚焦且 Escape 关闭', () => {
    const sys = new ToastSystem();
    sys.info('键盘测试', 60000);
    const item = visibleToasts()[0];
    expect(item.tabIndex).toBe(0);
    item.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    vi.advanceTimersByTime(300);
    expect(item.parentNode).toBeNull();
    sys.destroy();
  });

  it('error 用 role=alert + assertive，其余 role=status + polite', () => {
    const sys = new ToastSystem();
    sys.error('错误', 60000);
    sys.info('提示', 60000);
    const items = visibleToasts();
    const err = items.find((t) => t.dataset.toastType === 'error');
    const info = items.find((t) => t.dataset.toastType === 'info');
    expect(err.getAttribute('role')).toBe('alert');
    expect(err.getAttribute('aria-live')).toBe('assertive');
    expect(info.getAttribute('role')).toBe('status');
    expect(info.getAttribute('aria-live')).toBe('polite');
    sys.destroy();
  });
});

describe('R025 ToastSystem 避让与生命周期', () => {
  it('对话框可见时锚定到其上方，隐藏后回默认 80px', () => {
    const sys = new ToastSystem();
    const dialog = document.getElementById('ui-dialog');
    dialog.classList.add('visible');
    Object.defineProperty(dialog, 'offsetHeight', { value: 160, configurable: true });
    dialog.getBoundingClientRect = () => ({ height: 160 });
    sys.info('避让测试', 60000);
    const container = document.querySelector('.toast-container');
    expect(container.style.bottom).toContain('172px'); // 160 + 12
    dialog.classList.remove('visible');
    sys.info('回位测试', 60000);
    vi.advanceTimersByTime(200); // 等队列处理第二条
    expect(container.style.bottom).toContain('80px');
    sys.destroy();
  });

  it('destroy 清理全部定时器与容器，后台无空跑', () => {
    const sys = new ToastSystem();
    sys.info('待清理', 60000);
    expect(sys._activeTimers.size).toBeGreaterThan(0);
    sys.destroy();
    expect(sys._activeTimers.size).toBe(0);
    expect(document.querySelector('.toast-container')).toBeNull();
    vi.advanceTimersByTime(70000); // 定时器已清，不应再有 DOM 变化
    expect(visibleToasts().length).toBe(0);
  });
});
