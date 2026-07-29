import { afterEach, describe, expect, test, vi } from 'vitest';

// Mock Phaser：本测试只验证玩法指引 DOM 交互逻辑，不需要真实 Phaser 运行时
const MockScene = class { constructor() {} };
vi.mock('phaser', () => ({
  default: { Scene: MockScene }
}));

// 动态导入 BootScene，此时 Phaser 已被 mock
const { BootScene } = await import('../../src/scenes/BootScene.js');

function createGuideDom() {
  document.body.innerHTML = `
    <div id="ui-boot-guide" class="ui-boot-guide collapsed">
      <button id="ui-boot-guide-toggle" type="button" aria-expanded="false"
        aria-controls="ui-boot-guide-body">怎么玩</button>
      <div id="ui-boot-guide-body"></div>
    </div>
  `;
}

function createSceneHarness() {
  return Object.create(BootScene.prototype);
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('BootScene 玩法指引', () => {
  test('同步展开语义，并在清理后移除事件所有权', () => {
    createGuideDom();
    const scene = createSceneHarness();
    const guide = document.getElementById('ui-boot-guide');
    const toggle = document.getElementById('ui-boot-guide-toggle');

    scene._setupGuide();
    expect(toggle.getAttribute('aria-expanded')).toBe('false');

    toggle.click();
    expect(guide.classList.contains('collapsed')).toBe(false);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');

    scene._cleanupGuide();
    toggle.click();
    expect(guide.classList.contains('collapsed')).toBe(false);
  });

  test('重复进入标题场景时一次点击只切换一次', () => {
    createGuideDom();
    const firstScene = createSceneHarness();
    const secondScene = createSceneHarness();
    const guide = document.getElementById('ui-boot-guide');
    const toggle = document.getElementById('ui-boot-guide-toggle');

    firstScene._setupGuide();
    secondScene._setupGuide();
    toggle.click();

    expect(guide.classList.contains('collapsed')).toBe(false);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');

    firstScene._cleanupGuide();
    toggle.click();
    expect(guide.classList.contains('collapsed')).toBe(true);

    secondScene._cleanupGuide();
  });
});

describe('BootScene 按需面板', () => {
  test('悬停只预热一次，点击复用模块并呈现加载状态', async () => {
    const scene = createSceneHarness();
    const button = document.createElement('button');
    button.textContent = '成就图鉴';
    document.body.appendChild(button);

    let resolveModule;
    const load = vi.fn(() => new Promise(resolve => {
      resolveModule = resolve;
    }));
    const open = vi.fn();

    scene._attachLazyPanelAction(button, { load, open });
    button.dispatchEvent(new Event('pointerenter'));
    button.dispatchEvent(new Event('pointerenter'));
    expect(load).toHaveBeenCalledTimes(1);

    button.click();
    expect(button.disabled).toBe(true);
    expect(button.getAttribute('aria-busy')).toBe('true');
    expect(button.textContent).toBe('正在打开…');

    const loadedModule = { showAchievementGallery: vi.fn() };
    resolveModule(loadedModule);
    await vi.waitFor(() => expect(open).toHaveBeenCalledWith(loadedModule));

    expect(load).toHaveBeenCalledTimes(1);
    expect(button.disabled).toBe(false);
    expect(button.hasAttribute('aria-busy')).toBe(false);
    expect(button.textContent).toBe('成就图鉴');
  });
});
