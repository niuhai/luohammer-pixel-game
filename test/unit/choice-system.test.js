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
    expect(document.querySelector('.ui-choices-more')).not.toBeNull();

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

  it('把确定性检定表达为当前值、差距和真实结果路径', () => {
    const scene = createScene({
      reputation: 4,
      trust: 5,
      talentSpecials: ['trust_check_bonus'],
      _showCheckInfo: true,
      history: [],
      flags: new Set()
    });
    const system = new ChoiceSystem(scene);

    system.show([{
      label: '公开回应',
      next: 'next',
      check: {
        attr: 'reputation',
        min: 6,
        successEffects: { trust: 1 },
        failEffects: { reputation: -2, pressure: 3 }
      }
    }], vi.fn());

    const hint = document.querySelector('.choice-check-hint');
    expect(hint.textContent.replace(/\s+/g, ' ').trim()).toContain('名声检定 5 / 6 还差 1');
    expect(hint.textContent).toContain('基础 4 + 加成 1');
    expect(hint.textContent).toContain('成功 信任↑');
    expect(hint.textContent).toContain('失败 名声↓ · 压力↑');
    expect(hint.textContent).not.toContain('成功率');
  });

  it('把命运之眼的结论、依据和可见范围放回选项正文', () => {
    const scene = createScene({
      _showAlignment: true,
      history: [],
      flags: new Set()
    });
    const system = new ChoiceSystem(scene);

    system.show([
      {
        label: '接受期限换取继续供货',
        next: 'tradeoff',
        effects: { trust: 2, pressure: 2 }
      },
      {
        label: '把答案留到以后',
        next: 'unknown',
        flag: 'future_story'
      }
    ], vi.fn());

    const alignments = [...document.querySelectorAll('.choice-alignment')];
    expect(alignments).toHaveLength(2);
    expect(alignments[0].classList.contains('alignment-mixed')).toBe(true);
    expect(alignments[0].querySelector('.choice-alignment-verdict').textContent)
      .toBe('有得有失');
    expect(alignments[0].querySelector('.choice-alignment-basis').textContent)
      .toContain('收益与代价并存');
    expect(alignments[1].classList.contains('alignment-unknown')).toBe(true);
    expect(alignments[1].querySelector('.choice-alignment-verdict').textContent)
      .toBe('走向未明');
    expect(alignments.every(alignment =>
      alignment.closest('.ui-choice-text')
    )).toBe(true);
    expect(alignments[1].getAttribute('aria-label')).toContain('叙事后果仍未知');
  });

  it('把先见之明的即时变化呈现为带收益代价语义的独立芯片', () => {
    const scene = createScene({
      _autoPreview: true,
      _showAlignment: true,
      history: [],
      flags: new Set()
    });
    const system = new ChoiceSystem(scene);

    system.show([{
      label: '押上全部筹码',
      next: 'all_in',
      effects: {
        pride: 1,
        wealth: -2,
        trust: 2,
        pressure: 2,
        failures: 1
      }
    }], vi.fn());

    const preview = document.querySelector('.choice-auto-preview');
    const tokens = [...document.querySelectorAll('.choice-effect-token')];
    expect(preview.closest('.ui-choice-text')).not.toBeNull();
    expect(preview.querySelector('.choice-effect-source').textContent).toContain('先见之明');
    expect(preview.querySelector('.choice-effect-scope').textContent).toBe('即时影响');
    expect(tokens.map(token => token.textContent.trim())).toEqual([
      '理想 +1',
      '财富 -2',
      '信任 +2',
      '压力 +2',
      '翻车 +1'
    ]);
    expect(tokens.map(token => token.dataset.tone)).toEqual([
      'positive',
      'negative',
      'positive',
      'negative',
      'negative'
    ]);
    expect(preview.getAttribute('aria-label')).toContain('即时影响');
    expect(document.querySelectorAll('.choice-alignment')).toHaveLength(1);
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

  it('把技能选项呈现为来源、路线和得失，不叠加通用导向标签', () => {
    const scene = createScene({
      _showAlignment: true,
      _autoPreview: true,
      history: [],
      flags: new Set()
    });
    const system = new ChoiceSystem(scene);

    system.show([{
      label: '以圆滑方式应对，留有余地',
      next: 'installment',
      effects: { trust: 1, pressure: 1 },
      talentChoice: {
        id: 'well_connected',
        name: '八面玲珑',
        kind: '协商路径',
        route: '避开名声检定 · 沿「分期还款」继续',
        benefit: '信任 +1',
        tradeoff: '压力 +1'
      }
    }], vi.fn());

    const button = document.querySelector('.ui-choice-btn');
    expect(button.classList.contains('talent-choice')).toBe(true);
    expect(button.dataset.talentSource).toBe('well_connected');
    expect(button.querySelector('.choice-talent-badge').textContent).toContain('八面玲珑');
    expect(button.querySelector('.choice-talent-route').textContent).toContain('名声检定');
    expect(button.querySelector('.choice-talent-benefit').textContent).toBe('信任 +1');
    expect(button.querySelector('.choice-talent-tradeoff').textContent).toBe('压力 +1');
    expect(button.querySelector('.choice-alignment')).toBeNull();
    expect(button.querySelector('.choice-auto-preview')).toBeNull();
    expect(document.querySelector('.ui-choices-more')).toBeNull();
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
