// @vitest-environment jsdom

import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  hideGameLoading,
  isGameLoadingVisible,
  showGameLoadingError,
  showGameLoadingStage,
  updateGameLoadingProgress
} from '../../src/ui/GameLoadingUI.js';

function renderLoadingLayer() {
  document.body.innerHTML = `
    <div id="ui-game-loading" role="region" aria-labelledby="ui-game-loading-title"
      aria-describedby="ui-game-loading-detail" aria-hidden="true" aria-busy="false"
      data-loading-stage="idle" data-progress-mode="indeterminate" hidden>
      <div class="ui-game-loading-card">
        <div class="ui-game-loading-kicker"></div>
        <div class="app-loading-title" id="ui-game-loading-title"></div>
        <div class="ui-game-loading-detail" id="ui-game-loading-detail"></div>
        <div class="ui-game-loading-progress" role="progressbar"
          aria-valuemin="0" aria-valuemax="100"></div>
        <div class="ui-game-loading-meta-label"></div>
        <div class="ui-game-loading-percent"></div>
        <div class="ui-game-loading-fill"></div>
        <div class="ui-game-loading-actions" hidden>
          <button class="ui-game-loading-action" type="button" hidden></button>
          <button class="ui-game-loading-dismiss" type="button" hidden></button>
        </div>
        <div class="ui-game-loading-announcement" role="status"></div>
      </div>
    </div>
  `;
}

describe('GameLoadingUI', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('requestAnimationFrame', callback => {
      callback();
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    renderLoadingLayer();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
  });

  it('初始 HTML 在标题页完全离开视觉与无障碍树', () => {
    const html = fs.readFileSync(path.resolve('index.html'), 'utf8');
    const parsed = new DOMParser().parseFromString(html, 'text/html');
    const loader = parsed.getElementById('ui-game-loading');
    const progress = loader?.querySelector('[role="progressbar"]');

    expect(loader?.hidden).toBe(true);
    expect(loader?.getAttribute('aria-hidden')).toBe('true');
    expect(loader?.getAttribute('aria-busy')).toBe('false');
    expect(loader?.dataset.loadingStage).toBe('idle');
    expect(progress?.getAttribute('aria-valuemin')).toBe('0');
    expect(progress?.getAttribute('aria-valuemax')).toBe('100');
  });

  it('准备阶段只在显式显示时暴露，并使用不确定进度语义', () => {
    const loader = document.getElementById('ui-game-loading');
    const progress = loader.querySelector('[role="progressbar"]');

    expect(isGameLoadingVisible()).toBe(false);
    expect(showGameLoadingStage('preparing')).toBe(true);

    expect(loader.hidden).toBe(false);
    expect(loader.getAttribute('aria-hidden')).toBe('false');
    expect(loader.getAttribute('aria-busy')).toBe('true');
    expect(loader.dataset.loadingStage).toBe('preparing');
    expect(loader.dataset.progressMode).toBe('indeterminate');
    expect(loader.classList.contains('visible')).toBe(true);
    expect(progress.hasAttribute('aria-valuenow')).toBe(false);
    expect(progress.getAttribute('aria-valuetext')).toBe('正在准备游戏内容');
    expect(loader.querySelector('.ui-game-loading-meta-label').textContent)
      .toBe('连接故事与游戏舞台');
    expect(isGameLoadingVisible()).toBe(true);
  });

  it('资源阶段同步真实进度，并只在跨越里程碑时更新播报', () => {
    const loader = document.getElementById('ui-game-loading');
    const progress = loader.querySelector('[role="progressbar"]');
    const announcement = loader.querySelector('.ui-game-loading-announcement');

    showGameLoadingStage('assets', { progress: 0.1 });
    const initialAnnouncement = announcement.textContent;
    updateGameLoadingProgress(0.24);
    expect(announcement.textContent).toBe(initialAnnouncement);

    updateGameLoadingProgress(0.26);
    expect(progress.getAttribute('aria-valuenow')).toBe('26');
    expect(progress.getAttribute('aria-valuetext')).toBe('第一幕资源已准备 26%');
    expect(loader.querySelector('.ui-game-loading-fill').style.width).toBe('26%');
    expect(loader.querySelector('.ui-game-loading-percent').textContent).toBe('26%');
    expect(announcement.textContent).toBe('第一幕资源已准备 26%');

    updateGameLoadingProgress(0.32);
    expect(announcement.textContent).toBe('第一幕资源已准备 26%');
    expect(loader.querySelector('.ui-game-loading-meta-label').textContent)
      .toBe('正在准备第一幕资源');
  });

  it('隐藏时立即退出无障碍树，淡出后再移出布局', () => {
    const loader = document.getElementById('ui-game-loading');
    showGameLoadingStage('assets', { progress: 0.5 });

    hideGameLoading();
    expect(loader.getAttribute('aria-hidden')).toBe('true');
    expect(loader.getAttribute('aria-busy')).toBe('false');
    expect(loader.hidden).toBe(false);
    expect(isGameLoadingVisible()).toBe(false);

    vi.advanceTimersByTime(260);
    expect(loader.hidden).toBe(true);
    expect(loader.dataset.loadingStage).toBe('idle');
  });

  it('错误状态给出可恢复反馈并自动清理', () => {
    const loader = document.getElementById('ui-game-loading');
    showGameLoadingError('资源暂不可用，已返回标题页');

    expect(loader.dataset.loadingStage).toBe('error');
    expect(loader.querySelector('.ui-game-loading-detail').textContent)
      .toBe('资源暂不可用，已返回标题页');
    expect(loader.querySelector('.ui-game-loading-meta-label').textContent)
      .toBe('本次进度未受影响');

    vi.advanceTimersByTime(1600);
    expect(loader.getAttribute('aria-hidden')).toBe('true');
    vi.advanceTimersByTime(260);
    expect(loader.hidden).toBe(true);
  });

  it('代码失败时保持可操作 alertdialog，并把焦点交给明确重试动作', () => {
    const loader = document.getElementById('ui-game-loading');
    const retry = loader.querySelector('.ui-game-loading-action');
    const dismiss = loader.querySelector('.ui-game-loading-dismiss');
    const onRetry = vi.fn();
    const onDismiss = vi.fn();

    showGameLoadingError('主游戏代码没有完成加载', {
      actionLabel: '重新加载游戏',
      dismissLabel: '先回标题',
      onRetry,
      onDismiss
    });

    expect(loader.getAttribute('role')).toBe('alertdialog');
    expect(loader.getAttribute('aria-modal')).toBe('true');
    expect(loader.getAttribute('aria-busy')).toBe('false');
    expect(loader.classList.contains('recoverable')).toBe(true);
    expect(retry.hidden).toBe(false);
    expect(dismiss.hidden).toBe(false);
    expect(document.activeElement).toBe(retry);

    vi.advanceTimersByTime(3000);
    expect(loader.hidden).toBe(false);
    retry.click();
    dismiss.click();
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onDismiss).toHaveBeenCalledTimes(1);

    hideGameLoading({ immediate: true });
    expect(loader.hidden).toBe(true);
    expect(loader.getAttribute('role')).toBe('region');
    expect(loader.hasAttribute('aria-modal')).toBe(false);
  });
});
