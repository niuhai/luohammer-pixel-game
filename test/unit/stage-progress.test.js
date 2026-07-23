import { beforeEach, describe, expect, it } from 'vitest';
import {
  StageProgressSystem,
  getStageProgressModel
} from '../../src/systems/StageProgressSystem.js';

describe('StageProgressSystem - 六阶段人生进度', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="ui-chapter">
        <span id="ui-stage-position"></span>
        <span id="ui-stage-current"></span>
        <div id="ui-stage-rail"></div>
        <div id="ui-progress"><div id="ui-progress-fill"></div></div>
      </div>
    `;
  });

  it('将首尾阶段映射为稳定的 1/6 与 6/6 语义', () => {
    expect(getStageProgressModel('youth', 2)).toMatchObject({
      stageIndex: 0,
      stageNumber: 1,
      stageCount: 6,
      stageName: '延边少年',
      overallProgress: 2
    });
    expect(getStageProgressModel('reborn', 100)).toMatchObject({
      stageIndex: 5,
      stageNumber: 6,
      stageCount: 6,
      stageName: '新的十字路口',
      overallProgress: 100
    });
  });

  it('渲染六段轨道并同步当前、完成和待经历状态', () => {
    const system = new StageProgressSystem();
    system.mount();
    const model = system.update('dark', 64);
    const segments = [...document.querySelectorAll('.ui-stage-segment')];

    expect(model.stageNumber).toBe(4);
    expect(segments).toHaveLength(6);
    expect(segments.filter(segment => segment.classList.contains('completed'))).toHaveLength(3);
    expect(segments.filter(segment => segment.classList.contains('current'))).toHaveLength(1);
    expect(segments.filter(segment => segment.classList.contains('upcoming'))).toHaveLength(2);
    expect(document.getElementById('ui-stage-position').textContent).toBe('第 4 / 6 阶段');
    expect(document.getElementById('ui-stage-current').textContent).toBe('至暗时刻');
    expect(document.getElementById('ui-stage-rail').getAttribute('aria-valuenow')).toBe('4');
    expect(document.getElementById('ui-progress').getAttribute('aria-valuenow')).toBe('64');
    expect(document.getElementById('ui-progress-fill').style.width).toBe('64%');
  });

  it('对未知阶段和越界百分比安全降级', () => {
    const system = new StageProgressSystem();
    system.mount();
    const model = system.update('missing-stage', 180);

    expect(model.stageNumber).toBe(0);
    expect(model.overallProgress).toBe(100);
    expect(document.getElementById('ui-stage-position').textContent).toBe('共 6 阶段');
    expect(document.getElementById('ui-stage-current').textContent).toBe('');
    expect(document.getElementById('ui-progress-fill').style.width).toBe('100%');
  });
});
