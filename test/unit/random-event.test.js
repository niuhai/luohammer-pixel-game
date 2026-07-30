import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RandomEventSystem } from '../../src/systems/RandomEventSystem.js';

const EVENT = {
  id: 'test_event',
  title: '命运插曲',
  text: '罗远站在十字路口。',
  rarity: 'rare',
  choices: [
    { label: '向左走', effects: { pride: 1 }, flag: 'went_left' },
    { label: '向右走', effects: { pressure: -1 } }
  ]
};

function mountRandomEventDom() {
  document.body.innerHTML = `
    <button id="before-event">原焦点</button>
    <div id="ui-random-event-overlay">
      <h2 id="ui-random-event-title"></h2>
      <p id="ui-random-event-body"></p>
      <div id="ui-random-event-choices"></div>
    </div>
    <div id="ui-random-event-feedback">
      <div id="ui-random-event-feedback-event"></div>
      <h2 id="ui-random-event-feedback-title"></h2>
      <div id="ui-random-event-feedback-choice"></div>
      <div id="ui-random-event-feedback-list"></div>
      <button id="ui-random-event-feedback-continue">继续旅程</button>
    </div>
  `;
}

function createScene() {
  return {
    state: { currentNode: 'intro_1', talentSpecials: [] },
    input: {
      keyboard: {
        on: vi.fn(),
        off: vi.fn()
      }
    }
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  mountRandomEventDom();
  vi.stubGlobal('requestAnimationFrame', (callback) => {
    callback();
    return 1;
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

describe('RandomEventSystem - 决策模态框', () => {
  it('预知未来先展示事件轮廓，确认后再交接到真实选择', () => {
    const scene = createScene();
    scene.state._showEventOmen = true;
    const system = new RandomEventSystem(scene);

    system._presentEvent(EVENT);

    const overlay = document.getElementById('ui-random-event-overlay');
    const reveal = document.querySelector('.ui-random-event-omen-reveal');
    expect(overlay.dataset.eventStage).toBe('omen');
    expect(document.getElementById('ui-random-event-title').textContent).toContain(EVENT.title);
    expect(document.getElementById('ui-random-event-body').textContent).toContain('尚未发生');
    expect(document.querySelectorAll('.ui-random-event-omen-impact')).toHaveLength(2);
    expect(document.querySelectorAll('.ui-random-event-choice-btn')).toHaveLength(0);
    expect(document.activeElement).toBe(reveal);

    reveal.click();

    const choices = [...document.querySelectorAll('.ui-random-event-choice-btn')];
    expect(overlay.dataset.eventStage).toBe('decision');
    expect(document.getElementById('ui-random-event-title').textContent).toBe(EVENT.title);
    expect(document.querySelector('.ui-random-event-omen-summary')).toBeNull();
    expect(choices).toHaveLength(2);
    expect(document.activeElement).toBe(choices[0]);
  });

  it('提供对读屏和键盘友好的模态语义与原生按钮', () => {
    const previousFocus = document.getElementById('before-event');
    previousFocus.focus();
    const scene = createScene();
    const system = new RandomEventSystem(scene);

    system._showEvent(EVENT);

    const overlay = document.getElementById('ui-random-event-overlay');
    const buttons = [...document.querySelectorAll('.ui-random-event-choice-btn')];
    expect(overlay.getAttribute('role')).toBe('dialog');
    expect(overlay.getAttribute('aria-modal')).toBe('true');
    expect(overlay.getAttribute('aria-labelledby')).toBe('ui-random-event-title');
    expect(buttons).toHaveLength(2);
    expect(buttons.every((button) => button.tagName === 'BUTTON')).toBe(true);
    expect(buttons.every((button) => button.type === 'button')).toBe(true);
    expect(buttons[0].getAttribute('aria-label')).toContain('向左走');
    expect(buttons[0].getAttribute('aria-label')).toContain('理想↑');
    expect(document.querySelectorAll('.ui-random-event-choice-impact')).toHaveLength(2);
    expect(buttons[0].getAttribute('aria-keyshortcuts')).toBe('1');
    expect(buttons[1].getAttribute('aria-keyshortcuts')).toBe('2');
    expect([...document.querySelectorAll('.ui-random-event-choice-marker')].map(el => el.textContent))
      .toEqual(['1', '2']);
    expect(document.activeElement).toBe(buttons[0]);
    expect(buttons[0].style.outline).toContain('2px');

    buttons[1].focus();
    const keyHandler = scene.input.keyboard.on.mock.calls[0][1];
    const tabEvent = { key: 'Tab', repeat: false, shiftKey: false, preventDefault: vi.fn() };
    keyHandler(tabEvent);
    expect(tabEvent.preventDefault).toHaveBeenCalledOnce();
    expect(document.activeElement).toBe(buttons[0]);
  });

  it('只响应数字键，不再与自动播放快捷键冲突', () => {
    const system = new RandomEventSystem(createScene());
    const selectChoice = vi.spyOn(system, '_selectChoice');
    system._showEvent(EVENT);
    const keyHandler = system.scene.input.keyboard.on.mock.calls[0][1];

    keyHandler({ key: 'a', repeat: false });
    expect(selectChoice).not.toHaveBeenCalled();

    const numericEvent = { key: '2', repeat: false, preventDefault: vi.fn() };
    keyHandler(numericEvent);
    expect(numericEvent.preventDefault).toHaveBeenCalledOnce();
    expect(selectChoice).toHaveBeenCalledOnce();
    expect(selectChoice).toHaveBeenCalledWith(EVENT.choices[1], EVENT);
  });

  it('动画结束与超时兜底竞争时只结算一次', () => {
    const complete = vi.fn();
    const system = new RandomEventSystem(createScene());
    system.onComplete = complete;
    vi.spyOn(system, '_showFeedback').mockImplementation((_effects, callback) => callback());
    system._showEvent(EVENT);

    document.querySelector('.ui-random-event-choice-btn').click();
    vi.advanceTimersByTime(400);

    const lateAnimation = new Event('animationend');
    Object.defineProperty(lateAnimation, 'animationName', { value: 'randomEventFadeOut' });
    document.getElementById('ui-random-event-overlay').dispatchEvent(lateAnimation);

    expect(system._showFeedback).toHaveBeenCalledTimes(1);
    expect(complete).toHaveBeenCalledTimes(1);
    expect(complete).toHaveBeenCalledWith(
      expect.objectContaining({ pride: expect.any(Number) }),
      'went_left',
      'test_event'
    );
  });

  it('选择未声明波动时继承事件级波动配置', () => {
    const system = new RandomEventSystem(createScene());
    const feedback = vi.spyOn(system, '_showFeedback').mockImplementation(() => {});
    const event = {
      ...EVENT,
      effectVariance: { pride: [2, 2] }
    };

    system._showEvent(event);
    document.querySelector('.ui-random-event-choice-btn').click();
    vi.advanceTimersByTime(400);

    expect(feedback).toHaveBeenCalledWith(
      expect.objectContaining({ pride: 3 }),
      expect.any(Function),
      expect.objectContaining({ choiceLabel: '向左走' })
    );
  });

  it('结果保留选择上下文并等待显式确认后只推进一次', () => {
    const complete = vi.fn();
    const system = new RandomEventSystem(createScene());

    system._showFeedback(
      { pride: 1, pressure: -2 },
      complete,
      { eventTitle: '命运插曲', choiceLabel: '向左走' }
    );

    const feedback = document.getElementById('ui-random-event-feedback');
    const continueButton = document.getElementById('ui-random-event-feedback-continue');
    expect(feedback.getAttribute('role')).toBe('dialog');
    expect(feedback.getAttribute('aria-modal')).toBe('true');
    expect(feedback.textContent).toContain('向左走');
    expect(feedback.textContent).toContain('理想');
    expect(feedback.textContent).toContain('+1');
    expect(document.activeElement).toBe(continueButton);

    vi.runAllTimers();
    expect(complete).not.toHaveBeenCalled();
    continueButton.click();
    continueButton.click();
    expect(complete).toHaveBeenCalledOnce();
    expect(feedback.classList.contains('visible')).toBe(false);
  });

  it('hide 会取消未完成反馈，场景销毁后不再回调', () => {
    const complete = vi.fn();
    const system = new RandomEventSystem(createScene());

    system._showFeedback({ pride: 1, pressure: -2 }, complete);
    expect(document.getElementById('ui-random-event-feedback').getAttribute('aria-label'))
      .toContain('理想 +1');

    system.hide();
    vi.runAllTimers();

    expect(complete).not.toHaveBeenCalled();
    expect(document.getElementById('ui-random-event-feedback').classList.contains('visible')).toBe(false);
    expect(document.getElementById('ui-random-event-feedback').hasAttribute('aria-label')).toBe(false);
  });
});
