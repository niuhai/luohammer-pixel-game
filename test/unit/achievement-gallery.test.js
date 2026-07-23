import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { showAchievementGallery } from '../../src/ui/AchievementGallery.js';

beforeEach(() => {
  vi.useFakeTimers();
  document.body.innerHTML = '<button id="open-gallery">打开成就</button>';
  vi.stubGlobal('requestAnimationFrame', callback => {
    callback();
    return 1;
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

describe('AchievementGallery - 模态键盘体验', () => {
  it('支持方向键切换标签并维护 ARIA 状态', () => {
    document.getElementById('open-gallery').focus();
    showAchievementGallery();

    const overlay = document.getElementById('ui-achievement-gallery-overlay');
    const tabs = [...overlay.querySelectorAll('[role="tab"]')];
    expect(overlay.getAttribute('role')).toBe('dialog');
    expect(tabs[0].getAttribute('aria-selected')).toBe('true');
    expect(tabs[0].tabIndex).toBe(0);
    expect(tabs[1].tabIndex).toBe(-1);

    tabs[0].focus();
    tabs[0].dispatchEvent(new KeyboardEvent('keydown', {
      key: 'ArrowRight',
      bubbles: true,
      cancelable: true
    }));

    expect(tabs[1].getAttribute('aria-selected')).toBe('true');
    expect(tabs[0].getAttribute('aria-selected')).toBe('false');
    expect(document.activeElement).toBe(tabs[1]);
    expect(overlay.querySelector('[role="tabpanel"]').getAttribute('aria-labelledby'))
      .toBe('ui-achievement-tab-hidden');
  });

  it('Escape 关闭后把焦点还给打开按钮', () => {
    const opener = document.getElementById('open-gallery');
    opener.focus();
    const onClose = vi.fn();
    showAchievementGallery({ onClose });

    document.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Escape',
      bubbles: true,
      cancelable: true
    }));
    vi.advanceTimersByTime(250);

    expect(document.getElementById('ui-achievement-gallery-overlay')).toBeNull();
    expect(document.activeElement).toBe(opener);
    expect(onClose).toHaveBeenCalledOnce();
  });
});
