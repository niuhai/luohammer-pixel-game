import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DialogSystem } from '../../src/systems/DialogSystem.js';

beforeEach(() => {
  localStorage.clear();
  document.body.innerHTML = `
    <div id="ui-overlay">
      <div id="ui-dialog">
        <div class="ui-dialog-header">
          <div id="ui-dialog-name"></div>
          <div class="ui-dialog-reading-controls" role="group">
            <button id="ui-dialog-auto"></button>
            <button id="ui-dialog-speed"></button>
          </div>
        </div>
        <div id="ui-dialog-text"></div>
        <button id="ui-dialog-continue" type="button"></button>
      </div>
      <div id="ui-choices"></div>
      <div id="dialog-touch-layer"></div>
    </div>
  `;
});

afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe('DialogSystem - choice focus handoff', () => {
  it('does not swallow native Enter or Space while choices are visible', () => {
    const scene = {
      state: {},
      vibrate: vi.fn(),
      isGameplayInputBlocked: () => false
    };
    const system = new DialogSystem(scene);
    const advance = vi.fn();
    system._onDialogClick = advance;
    document.getElementById('ui-choices').classList.add('visible');

    const enterEvent = new KeyboardEvent('keydown', {
      key: 'Enter',
      bubbles: true,
      cancelable: true
    });
    document.dispatchEvent(enterEvent);
    expect(advance).not.toHaveBeenCalled();
    expect(enterEvent.defaultPrevented).toBe(false);

    document.getElementById('ui-choices').classList.remove('visible');
    const spaceEvent = new KeyboardEvent('keydown', {
      key: ' ',
      code: 'Space',
      bubbles: true,
      cancelable: true
    });
    document.dispatchEvent(spaceEvent);
    expect(advance).toHaveBeenCalledOnce();
    expect(spaceEvent.defaultPrevented).toBe(true);

    system.destroy();
  });

  it('exposes auto-play, speed and seen-node state as separate controls', () => {
    const scene = {
      state: {},
      vibrate: vi.fn(),
      isGameplayInputBlocked: () => false
    };
    const system = new DialogSystem(scene);
    const auto = document.getElementById('ui-dialog-auto');
    const speed = document.getElementById('ui-dialog-speed');

    expect(auto.textContent).toBe('自动 · 关');
    expect(auto.getAttribute('aria-pressed')).toBe('false');
    expect(auto.getAttribute('aria-label')).toContain('已关闭');
    expect(speed.textContent).toBe('中速');
    expect(speed.dataset.speed).toBe('medium');

    auto.click();
    expect(auto.textContent).toBe('自动 · 开');
    expect(auto.getAttribute('aria-pressed')).toBe('true');

    speed.click();
    expect(speed.textContent).toBe('快速');
    expect(speed.dataset.speed).toBe('fast');

    system._isSeenNode = true;
    system._updateSeenBadge();
    const badge = document.querySelector('.ui-dialog-seen-badge');
    expect(badge.textContent).toContain('已读快进');
    expect(badge.parentElement).toBe(
      document.querySelector('.ui-dialog-reading-controls')
    );

    system.destroy();
  });

  it('exposes one semantic continue action whose state follows the reading flow', () => {
    const scene = {
      state: {},
      vibrate: vi.fn(),
      isGameplayInputBlocked: () => false
    };
    const system = new DialogSystem(scene);
    const control = document.getElementById('ui-dialog-continue');

    system._segments = ['第一段', '第二段'];
    system._segmentIndex = 0;
    system._inSegmentMode = true;
    system._isLastSegment = false;
    system._showTextDirect('罗永浩', '第一段', null);

    expect(control.tagName).toBe('BUTTON');
    expect(control.hidden).toBe(false);
    expect(control.dataset.state).toBe('typing');
    expect(control.textContent).toContain('显示全文');

    system.skipTyping();
    expect(control.dataset.state).toBe('next-segment');
    expect(control.textContent).toContain('1/2');
    expect(control.getAttribute('aria-label')).toContain('共 2 段');

    system._isLastSegment = true;
    system._autoPlay = false;
    system._updateContinueHint();
    expect(control.dataset.state).toBe('continue');

    system._autoPlay = true;
    system._updateContinueHint();
    expect(control.dataset.state).toBe('auto');

    system.notifyChoicesVisible(true);
    expect(control.hidden).toBe(true);
    system.destroy();
  });

  it('lets native controls consume Enter and Space without double advancing', () => {
    const scene = {
      state: {},
      vibrate: vi.fn(),
      isGameplayInputBlocked: () => false
    };
    const system = new DialogSystem(scene);
    const control = document.getElementById('ui-dialog-continue');
    const auto = document.getElementById('ui-dialog-auto');
    const advance = vi.fn();
    system._onDialogClick = advance;

    control.hidden = false;
    control.focus();
    control.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Enter',
      bubbles: true,
      cancelable: true
    }));
    control.click();
    expect(advance).toHaveBeenCalledOnce();

    advance.mockClear();
    auto.focus();
    auto.dispatchEvent(new KeyboardEvent('keydown', {
      key: ' ',
      code: 'Space',
      bubbles: true,
      cancelable: true
    }));
    auto.click();
    expect(advance).not.toHaveBeenCalled();

    system.destroy();
  });
});
