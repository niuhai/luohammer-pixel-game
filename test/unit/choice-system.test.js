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
});
