import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ChoiceSystem } from '../../src/systems/ChoiceSystem.js';

function createScene(state = {}) {
  return {
    state,
    input: {
      keyboard: {
        on: vi.fn(),
        off: vi.fn()
      }
    },
    dialog: {
      notifyChoicesVisible: vi.fn(),
      getDialogHeight: () => 120
    },
    vibrate: vi.fn()
  };
}

beforeEach(() => {
  document.body.innerHTML = `
    <div id="ui-overlay"></div>
    <div id="ui-choices"></div>
    <div id="choice-flash"></div>
  `;
  vi.stubGlobal('requestAnimationFrame', callback => {
    callback();
    return 1;
  });
  vi.stubGlobal('matchMedia', () => ({ matches: false }));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

describe('ChoiceSystem - 同局支线防重复', () => {
  it('存在可用新出口时锁定已经历支线', () => {
    const scene = createScene({
      history: [{ nodeId: 'side_story', choiceLabel: '看过支线' }],
      flags: new Set()
    });
    const system = new ChoiceSystem(scene);

    system.show([
      { label: '再看一次支线', next: 'side_story' },
      { label: '继续主线', next: 'main_story' }
    ], vi.fn());

    const buttons = [...document.querySelectorAll('.ui-choice-btn')];
    expect(buttons[0].disabled).toBe(true);
    expect(buttons[0].textContent).toContain('这段经历已完成');
    expect(buttons[1].disabled).toBe(false);
  });

  it('没有可用新出口时不误锁最后通路', () => {
    const scene = createScene({
      history: [
        { nodeId: 'side_story', choiceLabel: '看过支线' },
        { nodeId: 'main_story', choiceLabel: '看过主线' }
      ],
      flags: new Set()
    });
    const system = new ChoiceSystem(scene);

    system.show([
      { label: '返回支线', next: 'side_story' },
      { label: '返回主线', next: 'main_story' }
    ], vi.fn());

    const buttons = [...document.querySelectorAll('.ui-choice-btn')];
    expect(buttons.every(button => !button.disabled)).toBe(true);
  });

  it('键盘快捷键不能绕过已完成支线锁', () => {
    const onChoice = vi.fn();
    const scene = createScene({
      history: [{ nodeId: 'side_story', choiceLabel: '看过支线' }],
      flags: new Set()
    });
    const system = new ChoiceSystem(scene);
    const choices = [
      { label: '再看一次支线', next: 'side_story' },
      { label: '继续主线', next: 'main_story' }
    ];

    system.show(choices, onChoice);
    const keyHandler = scene.input.keyboard.on.mock.calls[0][1];
    keyHandler({ key: 'a' });
    expect(onChoice).not.toHaveBeenCalled();

    keyHandler({ key: 'b' });
    expect(onChoice).toHaveBeenCalledOnce();
    expect(onChoice).toHaveBeenCalledWith(choices[1]);
  });

  it('长按显示完整影响且松手不会误触选择', () => {
    vi.useFakeTimers();
    const onChoice = vi.fn();
    const scene = createScene({ history: [], flags: new Set() });
    const system = new ChoiceSystem(scene);
    const choice = {
      label: '押上一切继续',
      next: 'next',
      effects: { pride: 2, pressure: 1, failures: 1 }
    };

    system.show([choice], onChoice);
    const button = document.querySelector('.ui-choice-btn');
    button.dispatchEvent(new Event('touchstart', { bubbles: true }));
    vi.advanceTimersByTime(500);

    const preview = document.querySelector('.choice-preview');
    expect(preview).not.toBeNull();
    expect(preview.parentElement).toBe(document.body);
    expect(preview.textContent).toContain('理想+2');
    expect(preview.textContent).toContain('压力+1');
    expect(preview.textContent).toContain('翻车+1');

    button.dispatchEvent(new Event('touchend', { bubbles: true }));
    button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(onChoice).not.toHaveBeenCalled();

    button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(onChoice).toHaveBeenCalledOnce();
  });

  it('新选项出现时取消旧退场计时器，不会误清空当前选择', () => {
    vi.useFakeTimers();
    const scene = createScene({ history: [], flags: new Set() });
    const system = new ChoiceSystem(scene);

    system.show([{ label: '旧选择', next: 'old' }], vi.fn());
    system.hide();
    vi.advanceTimersByTime(100);
    system.show([{ label: '新选择', next: 'new' }], vi.fn());
    vi.advanceTimersByTime(200);

    expect(document.querySelector('#ui-choices').classList.contains('visible')).toBe(true);
    expect(document.querySelector('.ui-choice-btn').textContent).toContain('新选择');
  });

  it('销毁时立即清理预览、退场计时器和 DOM', () => {
    vi.useFakeTimers();
    const scene = createScene({ history: [], flags: new Set() });
    const system = new ChoiceSystem(scene);

    system.show([{ label: '查看影响', next: 'next', effects: { wealth: -1 } }], vi.fn());
    const button = document.querySelector('.ui-choice-btn');
    button.dispatchEvent(new Event('touchstart', { bubbles: true }));
    vi.advanceTimersByTime(500);
    expect(document.querySelector('.choice-preview')).not.toBeNull();

    system.destroy();
    vi.runAllTimers();

    expect(document.querySelector('.choice-preview')).toBeNull();
    expect(document.querySelector('#ui-choices').children).toHaveLength(0);
    expect(scene.input.keyboard.off).toHaveBeenCalled();
  });
});
