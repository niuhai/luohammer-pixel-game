// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initializeBootShell } from '../../src/bootShell.js';

function renderShellDom() {
  document.body.innerHTML = `
    <div id="app-loading"></div>
    <main class="ui-boot-overlay" id="ui-boot-overlay">
      <div id="ui-boot-quote"></div>
      <div class="ui-boot-guide"></div>
      <div class="ui-boot-buttons" id="ui-boot-buttons"></div>
    </main>
  `;
}

describe('BootShell', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    delete window.__luohammerBootShell;
    renderShellDom();
    vi.stubGlobal('requestAnimationFrame', callback => {
      callback();
      return 1;
    });
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    localStorage.clear();
    delete window.__luohammerBootShell;
    document.body.innerHTML = '';
  });

  it('在引擎加载前交付可聚焦主操作，并立即反馈已收到开始意图', async () => {
    const loadEngine = vi.fn().mockResolvedValue({});
    const state = initializeBootShell({ loadEngine, scheduleEngine: false });
    const overlay = document.getElementById('ui-boot-overlay');
    const primary = overlay.querySelector('.ui-boot-shell-primary');

    expect(overlay.classList.contains('visible')).toBe(true);
    expect(overlay.dataset.bootPhase).toBe('shell');
    expect(primary.textContent).toBe('开始游戏');
    expect(primary.disabled).toBe(false);
    expect(document.activeElement).toBe(primary);
    expect(document.getElementById('app-loading')).toBeNull();
    expect(state.interactiveAt).toBeGreaterThanOrEqual(state.visibleAt);
    expect(state.engineRequestedAt).toBeNull();

    primary.click();
    expect(primary.disabled).toBe(true);
    expect(primary.getAttribute('aria-busy')).toBe('true');
    expect(primary.textContent).toContain('正在准备开场');
    expect(state.intent.action).toBe('start');
    expect(state.requestReason).toBe('intent');
    await state.enginePromise;
    expect(loadEngine).toHaveBeenCalledTimes(1);
  });

  it('在完整 SaveSystem 接管前区分自动存档和仅手动存档入口', () => {
    localStorage.setItem('luohammer_save', '{"currentNode":"start"}');
    initializeBootShell({ loadEngine: vi.fn(), scheduleEngine: false });
    expect(document.querySelector('.ui-boot-shell-primary').textContent)
      .toBe('继续游戏');
    expect(window.__luohammerBootShell.hasAutoSave).toBe(true);

    delete window.__luohammerBootShell;
    localStorage.clear();
    renderShellDom();
    localStorage.setItem('luohammer_save_slots', JSON.stringify({
      slot1: { state: { currentNode: 'start' } }
    }));
    initializeBootShell({ loadEngine: vi.fn(), scheduleEngine: false });
    expect(document.querySelector('.ui-boot-shell-primary').textContent)
      .toBe('存档管理');
    expect(window.__luohammerBootShell.hasAnySave).toBe(true);
    expect(window.__luohammerBootShell.hasAutoSave).toBe(false);
  });

  it('引擎加载失败后恢复主操作并允许原意图重试', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const loadEngine = vi.fn()
      .mockRejectedValueOnce(new Error('network interrupted'))
      .mockResolvedValueOnce({});
    const state = initializeBootShell({ loadEngine, scheduleEngine: false });
    const primary = document.querySelector('.ui-boot-shell-primary');

    primary.click();
    const firstAttempt = state.enginePromise;
    await expect(firstAttempt).rejects.toThrow('network interrupted');
    expect(state.intent).toBeNull();
    expect(primary.disabled).toBe(false);
    expect(primary.textContent).toBe('开始游戏');
    expect(document.getElementById('ui-boot-shell-status').textContent)
      .toContain('请重试');

    primary.click();
    await state.enginePromise;
    expect(loadEngine).toHaveBeenCalledTimes(2);
    expect(state.intent.action).toBe('start');
    expect(consoleError).toHaveBeenCalledTimes(1);
  });

  it('在按钮可能被引擎接管前于 keydown 锁定键盘意图', async () => {
    const loadEngine = vi.fn().mockResolvedValue({});
    const state = initializeBootShell({ loadEngine, scheduleEngine: false });
    const primary = document.querySelector('.ui-boot-shell-primary');

    const event = new KeyboardEvent('keydown', {
      key: 'Enter',
      bubbles: true,
      cancelable: true
    });
    primary.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(state.intent?.action).toBe('start');
    expect(primary.disabled).toBe(true);
    expect(primary.getAttribute('aria-busy')).toBe('true');
    await state.enginePromise;
  });
});
