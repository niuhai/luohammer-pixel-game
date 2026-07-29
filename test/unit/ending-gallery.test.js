// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ENDINGS } from '../../src/data/endings.js';
import { showEndingGallery } from '../../src/ui/EndingGallery.js';

describe('EndingGallery', () => {
  beforeEach(() => {
    document.body.innerHTML = '<button id="gallery-trigger">打开结局图鉴</button>';
    document.getElementById('gallery-trigger').focus();
    vi.stubGlobal('requestAnimationFrame', callback => {
      callback();
      return 1;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  it('暴露收集语义并让已解锁结局可展开、可用方向键浏览', () => {
    const seenEndings = ['legend', 'tycoon', 'tech_blogger'];
    showEndingGallery({ seenEndings });

    const overlay = document.getElementById('ui-ending-gallery-overlay');
    const progress = overlay.querySelector('.ui-ending-gallery-progress');
    const grid = overlay.querySelector('#ui-ending-gallery-grid');
    const toggles = [...grid.querySelectorAll(
      '.ui-ending-gallery-card-toggle'
    )];
    const locked = grid.querySelector('.ui-ending-gallery-card-locked');

    expect(progress.getAttribute('role')).toBe('progressbar');
    expect(progress.getAttribute('aria-valuenow')).toBe('3');
    expect(progress.getAttribute('aria-valuemax')).toBe(
      String(ENDINGS.length)
    );
    expect(grid.getAttribute('role')).toBe('list');
    expect(toggles).toHaveLength(seenEndings.length);
    expect(toggles[0].tagName).toBe('BUTTON');
    expect(document.activeElement).toBe(toggles[0]);
    expect(locked.getAttribute('role')).toBe('listitem');
    expect(locked.getAttribute('aria-label')).toContain('未解锁');

    toggles[0].click();
    const detail = overlay.querySelector('.ui-ending-gallery-detail');
    expect(detail.hidden).toBe(false);
    expect(toggles[0].getAttribute('aria-expanded')).toBe('true');
    expect(detail.textContent).toContain(ENDINGS[0].desc);
    expect(detail.textContent).toContain(ENDINGS[0].respect);

    toggles[0].dispatchEvent(new KeyboardEvent('keydown', {
      key: 'ArrowRight',
      bubbles: true
    }));
    expect(document.activeElement).toBe(toggles[1]);
  });

  it('Escape 先收起详情，再关闭弹窗并归还焦点', () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    const trigger = document.getElementById('gallery-trigger');
    showEndingGallery({ seenEndings: ['legend'], onClose });

    const overlay = document.getElementById('ui-ending-gallery-overlay');
    const toggle = overlay.querySelector('.ui-ending-gallery-card-toggle');
    toggle.click();
    expect(overlay.querySelector('.ui-ending-gallery-detail').hidden).toBe(
      false
    );

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(overlay.isConnected).toBe(true);
    expect(overlay.querySelector('.ui-ending-gallery-detail').hidden).toBe(
      true
    );
    expect(document.activeElement).toBe(toggle);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    vi.advanceTimersByTime(250);
    expect(document.getElementById('ui-ending-gallery-overlay')).toBeNull();
    expect(document.activeElement).toBe(trigger);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
