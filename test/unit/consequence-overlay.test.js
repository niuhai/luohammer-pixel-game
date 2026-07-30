import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConsequenceOverlay } from '../../src/ui/ConsequenceOverlay.js';

function mountConsequenceDom() {
  document.body.innerHTML = `
    <button id="before-consequence">原焦点</button>
    <div id="ui-consequence-overlay" aria-hidden="true">
      <section class="ui-consequence-card" tabindex="-1">
        <span id="ui-consequence-kicker"></span>
        <span id="ui-consequence-progress" class="ui-consequence-progress" hidden></span>
        <h2 id="ui-consequence-title"></h2>
        <div id="ui-consequence-cause" class="ui-consequence-cause" hidden></div>
        <p id="ui-consequence-narrative"></p>
        <div id="ui-consequence-mitigation" hidden></div>
        <div id="ui-consequence-effects" hidden></div>
        <div id="ui-consequence-choices"></div>
        <div id="ui-consequence-result" hidden></div>
        <span id="ui-consequence-hint"></span>
        <button id="ui-consequence-continue" type="button" hidden>确认</button>
      </section>
    </div>
  `;
}

function createScene() {
  return {
    vibrate: vi.fn()
  };
}

beforeEach(() => {
  mountConsequenceDom();
  vi.stubGlobal('requestAnimationFrame', callback => {
    callback();
    return 1;
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

describe('ConsequenceOverlay', () => {
  it('把压力原因、精确代价、恢复选择和落地结果连成同一条链', () => {
    const onContinue = vi.fn();
    const overlay = new ConsequenceOverlay(createScene());
    document.getElementById('before-consequence').focus();

    overlay.showDecision({
      title: '压力到达极限',
      cause: '压力 10 / 上限 10 · 已达崩溃线',
      narrative: '你必须决定怎样重新站稳。',
      choices: [
        {
          label: '承认崩溃，停下来整理',
          effects: { pride: -2, reputation: -1, pressure: -5, failures: 1 }
        },
        {
          label: '咬牙撑住',
          effects: { pressure: -3 }
        }
      ],
      onSelect: choice => ({
        choiceLabel: choice.label,
        effects: choice.effects,
        beforeState: {
          pride: 6,
          reputation: 5,
          pressure: 10,
          failures: 1
        },
        afterState: {
          pride: 4,
          reputation: 4,
          pressure: 5,
          failures: 2
        },
        onContinue
      })
    });

    const root = document.getElementById('ui-consequence-overlay');
    const choices = [...document.querySelectorAll('.ui-consequence-choice')];
    expect(root.getAttribute('role')).toBe('dialog');
    expect(root.getAttribute('aria-modal')).toBe('true');
    expect(root.getAttribute('data-consequence-stage')).toBe('decision');
    expect(document.getElementById('ui-consequence-cause').textContent)
      .toContain('已达崩溃线');
    expect(document.querySelectorAll('.ui-consequence-effect')).toHaveLength(5);
    expect(document.activeElement).toBe(choices[0]);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
    expect(document.activeElement).toBe(choices[1]);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: '1' }));

    expect(root.getAttribute('data-consequence-stage')).toBe('result');
    expect(root.textContent).toContain('承认崩溃');
    expect(document.querySelector('.ui-consequence-pressure-transition').textContent)
      .toContain('10');
    expect(document.querySelector('.ui-consequence-pressure-transition').textContent)
      .toContain('5');
    expect(document.activeElement).toBe(document.getElementById('ui-consequence-continue'));

    const continueButton = document.getElementById('ui-consequence-continue');
    continueButton.click();
    continueButton.click();
    expect(onContinue).toHaveBeenCalledOnce();
  });

  it('阈值事件显示独立标题、触发条件、队列进度，并只确认一次', () => {
    const onContinue = vi.fn();
    const overlay = new ConsequenceOverlay(createScene());

    overlay.showNotice({
      title: '高压正在侵蚀信任',
      cause: '压力 7 ≥ 触发线 7，且信任 5 ≥ 5',
      narrative: '一次失控的争吵后，你发现信任正在流失。',
      effects: { trust: -1, pressure: 1 },
      progress: { current: 2, total: 3 },
      onContinue
    });

    const root = document.getElementById('ui-consequence-overlay');
    expect(root.getAttribute('data-consequence-stage')).toBe('notice');
    expect(document.getElementById('ui-consequence-title').textContent)
      .toBe('高压正在侵蚀信任');
    expect(document.getElementById('ui-consequence-progress').textContent)
      .toBe('隐藏事件 2 / 3');
    expect(document.querySelectorAll('.ui-consequence-effect')).toHaveLength(2);

    const continueButton = document.getElementById('ui-consequence-continue');
    continueButton.click();
    continueButton.click();
    expect(onContinue).toHaveBeenCalledOnce();
  });

  it('技能介入可同时预览属性、限量资源和替代分支结果', () => {
    const overlay = new ConsequenceOverlay(createScene());

    overlay.showDecision({
      title: '不死鸟可以截断这次崩溃',
      cause: '压力 10 / 上限 10 · 剩余复活 1 次',
      choices: [
        {
          label: '消耗机会，立即复活',
          previewEffects: { pressure: -7 },
          note: '复活机会 1 → 0 · 跳过本次崩溃惩罚',
          tone: 'positive',
          _useRevive: true
        },
        {
          label: '保留机会，承受本次崩溃',
          note: '复活机会保持 1 次 · 进入 2 个崩溃恢复方案',
          tone: 'warning',
          _useRevive: false
        }
      ],
      onSelect: choice => ({
        title: '不死鸟已消耗，跳过崩溃',
        choiceLabel: choice.label,
        effects: { pressure: -7 },
        beforeState: { pressure: 10 },
        afterState: { pressure: 3 },
        extraTransitions: [
          { key: 'resource', label: '复活机会', before: 1, after: 0 }
        ]
      })
    });

    const choices = [...document.querySelectorAll('.ui-consequence-choice')];
    expect(choices[0].classList.contains('tone-positive')).toBe(true);
    expect(choices[1].classList.contains('tone-warning')).toBe(true);
    expect(document.querySelectorAll('.ui-consequence-choice-note')).toHaveLength(2);
    expect(choices[0].getAttribute('aria-label')).toContain('压力 -7');
    expect(choices[0].getAttribute('aria-label')).toContain('复活机会 1 → 0');

    choices[0].click();
    expect(document.getElementById('ui-consequence-overlay').dataset.consequenceStage)
      .toBe('result');
    expect(document.querySelector('.ui-consequence-pressure-transition').textContent)
      .toContain('10');
    expect(document.querySelector('.ui-consequence-resource-transition').textContent)
      .toContain('复活机会');
    expect(document.querySelector('.ui-consequence-resource-transition').textContent)
      .toContain('0');
  });

  it('所有动态文案都以文本语义渲染，不执行注入内容', () => {
    const overlay = new ConsequenceOverlay(createScene());

    overlay.showDecision({
      title: '<img src=x onerror=alert(1)>',
      cause: '<script>bad()</script>',
      narrative: '<b>不是标签</b>',
      choices: [
        {
          label: '<img src=x>',
          effects: { pressure: -1 }
        }
      ]
    });

    expect(document.querySelector('#ui-consequence-overlay img')).toBeNull();
    expect(document.querySelector('#ui-consequence-overlay script')).toBeNull();
    expect(document.getElementById('ui-consequence-title').textContent)
      .toContain('<img');
    expect(document.querySelector('.ui-consequence-choice-label').textContent)
      .toBe('<img src=x>');
  });
});
