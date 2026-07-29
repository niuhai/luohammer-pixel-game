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
      getDialogHeight: () => 120,
      requestFocusOnNextShow: vi.fn()
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
    keyHandler({ key: '1' });
    expect(onChoice).not.toHaveBeenCalled();

    keyHandler({ key: '2' });
    expect(onChoice).toHaveBeenCalledOnce();
    expect(onChoice).toHaveBeenCalledWith(choices[1]);
  });

  it('八个选项均显示明确数字并可用对应数字键选择', () => {
    const onChoice = vi.fn();
    const scene = createScene({ history: [], flags: new Set() });
    const system = new ChoiceSystem(scene);
    const choices = Array.from({ length: 8 }, (_, index) => ({
      label: `选择 ${index + 1}`,
      next: `node_${index + 1}`
    }));

    system.show(choices, onChoice);
    const markers = [...document.querySelectorAll('.marker-icon')].map(el => el.textContent);
    const buttons = [...document.querySelectorAll('.ui-choice-btn')];

    expect(markers).toEqual(['1', '2', '3', '4', '5', '6', '7', '8']);
    expect(document.querySelector('#ui-choices').textContent).not.toContain('?');
    expect(buttons[7].getAttribute('aria-keyshortcuts')).toBe('8');

    const keyHandler = scene.input.keyboard.on.mock.calls[0][1];
    keyHandler({ key: 'a' });
    expect(onChoice).not.toHaveBeenCalled();

    keyHandler({ key: '8' });
    expect(onChoice).toHaveBeenCalledOnce();
    expect(onChoice).toHaveBeenCalledWith(choices[7]);
  });

  it('全屏模态层打开时忽略后台数字键选择', () => {
    const onChoice = vi.fn();
    const scene = createScene({ history: [], flags: new Set() });
    scene.isGameplayInputBlocked = () => true;
    const system = new ChoiceSystem(scene);

    system.show([{ label: '后台选择', next: 'next' }], onChoice);
    const keyHandler = scene.input.keyboard.on.mock.calls[0][1];
    keyHandler({ key: '1' });

    expect(onChoice).not.toHaveBeenCalled();
    expect(document.querySelector('.ui-choice-btn').disabled).toBe(false);
  });

  it('进入选择态时给出行动提示并聚焦第一个可选按钮', () => {
    const scene = createScene({ pride: 1, history: [], flags: new Set() });
    const system = new ChoiceSystem(scene);

    system.show([
      { label: '锁定方向', next: 'locked', requires: { pride: 3 } },
      { label: '可选方向', next: 'open' }
    ], vi.fn());

    const choices = document.querySelector('#ui-choices');
    const buttons = [...document.querySelectorAll('.ui-choice-btn')];
    expect(choices.getAttribute('role')).toBe('group');
    expect(choices.getAttribute('aria-label')).toContain('1 项可选');
    expect(document.querySelector('.ui-choice-context').textContent).toContain('做出你的选择');
    expect(document.activeElement).toBe(buttons[1]);
  });

  it('方向键跳过锁定项移动焦点，退场后请求归还剧情焦点', () => {
    const scene = createScene({ pride: 3, history: [], flags: new Set() });
    const system = new ChoiceSystem(scene);

    system.show([
      { label: '方向一', next: 'one' },
      { label: '锁定方向', next: 'locked', requires: { pride: 5 } },
      { label: '方向三', next: 'three' }
    ], vi.fn());

    const buttons = [...document.querySelectorAll('.ui-choice-btn')];
    expect(document.activeElement).toBe(buttons[0]);
    const keyHandler = scene.input.keyboard.on.mock.calls[0][1];
    const preventDefault = vi.fn();
    keyHandler({ key: 'ArrowDown', preventDefault });
    expect(preventDefault).toHaveBeenCalledOnce();
    expect(document.activeElement).toBe(buttons[2]);

    system.hide(true);
    expect(scene.dialog.requestFocusOnNextShow).toHaveBeenCalledOnce();
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
