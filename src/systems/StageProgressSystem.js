import { STAGES } from '../data/stages.js';

export function getStageProgressModel(stageId, overallProgress = 0, stages = STAGES) {
  const stageIndex = stages.findIndex(stage => stage.id === stageId);
  const safeProgress = Number.isFinite(Number(overallProgress))
    ? Math.max(0, Math.min(100, Number(overallProgress)))
    : 0;

  if (stageIndex < 0) {
    return {
      stageId: null,
      stageIndex: -1,
      stageNumber: 0,
      stageCount: stages.length,
      stageName: '',
      overallProgress: safeProgress
    };
  }

  return {
    stageId,
    stageIndex,
    stageNumber: stageIndex + 1,
    stageCount: stages.length,
    stageName: stages[stageIndex].name,
    overallProgress: safeProgress
  };
}

export class StageProgressSystem {
  constructor(options = {}) {
    this.stages = options.stages || STAGES;
    this.rootEl = options.rootEl || document.getElementById('ui-chapter');
    this.positionEl = options.positionEl || document.getElementById('ui-stage-position');
    this.currentEl = options.currentEl || document.getElementById('ui-stage-current');
    this.railEl = options.railEl || document.getElementById('ui-stage-rail');
    this.progressEl = options.progressEl || document.getElementById('ui-progress');
    this.progressFillEl = options.progressFillEl || document.getElementById('ui-progress-fill');
    this.segmentEls = [];
  }

  mount() {
    if (!this.railEl) return;

    this.railEl.replaceChildren();
    this.segmentEls = this.stages.map((stage, index) => {
      const segment = document.createElement('span');
      segment.className = 'ui-stage-segment';
      segment.dataset.stageId = stage.id;
      segment.title = `${index + 1}. ${stage.name}（${stage.period}）`;
      segment.setAttribute('aria-hidden', 'true');
      this.railEl.appendChild(segment);
      return segment;
    });
  }

  update(stageId, overallProgress) {
    const model = getStageProgressModel(stageId, overallProgress, this.stages);

    if (this.positionEl) {
      this.positionEl.textContent = model.stageNumber
        ? `第 ${model.stageNumber} / ${model.stageCount} 阶段`
        : `共 ${model.stageCount} 阶段`;
    }
    if (this.currentEl) this.currentEl.textContent = model.stageName;

    this.segmentEls.forEach((segment, index) => {
      segment.classList.toggle('completed', model.stageIndex >= 0 && index < model.stageIndex);
      segment.classList.toggle('current', index === model.stageIndex);
      segment.classList.toggle('upcoming', model.stageIndex < 0 || index > model.stageIndex);
    });

    if (this.railEl) {
      this.railEl.setAttribute('aria-valuemin', '1');
      this.railEl.setAttribute('aria-valuemax', String(model.stageCount));
      this.railEl.setAttribute('aria-valuenow', String(model.stageNumber || 1));
      this.railEl.setAttribute(
        'aria-valuetext',
        model.stageNumber
          ? `第 ${model.stageNumber} 阶段，共 ${model.stageCount} 阶段：${model.stageName}`
          : `共 ${model.stageCount} 阶段`
      );
    }

    if (this.progressFillEl) {
      this.progressFillEl.style.width = `${model.overallProgress}%`;
    }
    if (this.progressEl) {
      this.progressEl.setAttribute('aria-valuenow', String(model.overallProgress));
      this.progressEl.setAttribute('aria-valuetext', `本局人生进度 ${model.overallProgress}%`);
    }
    if (this.rootEl) {
      this.rootEl.dataset.stageId = model.stageId || '';
    }

    return model;
  }

  destroy() {
    this.segmentEls = [];
    this.rootEl = null;
    this.positionEl = null;
    this.currentEl = null;
    this.railEl = null;
    this.progressEl = null;
    this.progressFillEl = null;
  }
}
