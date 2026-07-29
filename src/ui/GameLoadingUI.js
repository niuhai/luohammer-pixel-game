const HIDE_TRANSITION_MS = 260;

const STAGE_COPY = {
  preparing: {
    kicker: '连接人生舞台',
    title: '正在展开人生…',
    detail: '正在准备你的第一段故事',
    meta: '连接故事与游戏舞台',
    announcement: '正在准备第一段故事',
    progressMode: 'indeterminate'
  },
  assets: {
    kicker: '布置第一幕',
    title: '正在载入舞台…',
    detail: '舞台与人物正在就位',
    meta: '舞台与人物正在就位',
    announcement: '正在加载第一幕的舞台与人物',
    progressMode: 'determinate'
  },
  error: {
    kicker: '连接暂未完成',
    title: '这一幕还没有准备好',
    detail: '主游戏代码没有完成加载，本次进度未受影响',
    meta: '本次进度未受影响',
    announcement: '主游戏代码没有完成加载，可以重新加载或先返回标题页',
    progressMode: 'static'
  }
};

function getUI() {
  const element = document.getElementById('ui-game-loading');
  if (!element) return null;
  return {
    element,
    kicker: element.querySelector('.ui-game-loading-kicker'),
    title: element.querySelector('.app-loading-title'),
    detail: element.querySelector('.ui-game-loading-detail'),
    meta: element.querySelector('.ui-game-loading-meta-label'),
    percent: element.querySelector('.ui-game-loading-percent'),
    fill: element.querySelector('.ui-game-loading-fill'),
    progress: element.querySelector('[role="progressbar"]'),
    announcement: element.querySelector('.ui-game-loading-announcement'),
    actions: element.querySelector('.ui-game-loading-actions'),
    action: element.querySelector('.ui-game-loading-action'),
    dismiss: element.querySelector('.ui-game-loading-dismiss')
  };
}

function cancelTimer(element, property, cancel = clearTimeout) {
  if (!element[property]) return;
  cancel(element[property]);
  element[property] = null;
}

function cancelPendingState(element) {
  cancelTimer(element, '__gameLoadingHideTimer');
  cancelTimer(element, '__gameLoadingErrorTimer');
  if (element.__gameLoadingRevealFrame) {
    if (typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(element.__gameLoadingRevealFrame);
    } else {
      clearTimeout(element.__gameLoadingRevealFrame);
    }
    element.__gameLoadingRevealFrame = null;
  }
}

function revealOnNextFrame(element) {
  const reveal = () => {
    element.__gameLoadingRevealFrame = null;
    if (!element.hidden && element.getAttribute('aria-hidden') === 'false') {
      element.classList.add('visible');
    }
  };
  element.__gameLoadingRevealFrame = typeof requestAnimationFrame === 'function'
    ? requestAnimationFrame(reveal)
    : setTimeout(reveal, 0);
}

function setText(element, value) {
  if (element && typeof value === 'string') element.textContent = value;
}

function resetRecoveryActions(ui) {
  ui.element.classList.remove('recoverable');
  ui.element.setAttribute('role', 'region');
  ui.element.removeAttribute('aria-modal');
  if (ui.actions) ui.actions.hidden = true;
  if (ui.action) {
    ui.action.hidden = true;
    ui.action.disabled = false;
    ui.action.removeAttribute('aria-busy');
    ui.action.onclick = null;
  }
  if (ui.dismiss) {
    ui.dismiss.hidden = true;
    ui.dismiss.disabled = false;
    ui.dismiss.onclick = null;
  }
}

/**
 * 显示一个明确的游戏加载阶段。只有此函数会把加载层放回无障碍树。
 */
export function showGameLoadingStage(stage = 'preparing', options = {}) {
  const ui = getUI();
  if (!ui) return false;
  const copy = STAGE_COPY[stage] || STAGE_COPY.preparing;
  const progressMode = options.progressMode || copy.progressMode;

  cancelPendingState(ui.element);
  resetRecoveryActions(ui);
  ui.element.dataset.loadingStage = stage;
  ui.element.dataset.progressMode = progressMode;
  ui.element.dataset.announcedProgressBucket = '-1';
  ui.element.hidden = false;
  ui.element.setAttribute('aria-hidden', 'false');
  ui.element.setAttribute('aria-busy', 'true');
  setText(ui.kicker, options.kicker || copy.kicker);
  setText(ui.title, options.title || copy.title);
  setText(ui.detail, options.detail || copy.detail);
  setText(ui.meta, options.meta || copy.meta);
  setText(ui.announcement, options.announcement || copy.announcement);

  if (progressMode === 'determinate') {
    updateGameLoadingProgress(options.progress ?? 0, { announce: false });
  } else {
    if (ui.fill) ui.fill.style.width = '';
    setText(ui.percent, stage === 'error' ? '未完成' : '准备中');
    ui.progress?.removeAttribute('aria-valuenow');
    ui.progress?.setAttribute(
      'aria-valuetext',
      stage === 'error' ? '资源加载未完成' : '正在准备游戏内容'
    );
  }

  revealOnNextFrame(ui.element);
  return true;
}

/**
 * 更新确定性资源进度。视觉百分比可逐步更新，live region 只在 25% 里程碑播报。
 */
export function updateGameLoadingProgress(value, options = {}) {
  const ui = getUI();
  if (!ui) return false;
  const normalized = Math.min(1, Math.max(0, Number(value) || 0));
  const percent = Math.round(normalized * 100);
  ui.element.dataset.progressMode = 'determinate';
  if (ui.fill) ui.fill.style.width = `${percent}%`;
  setText(ui.percent, `${percent}%`);
  setText(
    ui.detail,
    percent >= 100 ? '舞台与人物已经就位' : '舞台与人物正在就位'
  );
  setText(
    ui.meta,
    percent >= 100 ? '即将进入天赋选择' : '正在准备第一幕资源'
  );
  if (ui.progress) {
    ui.progress.setAttribute('aria-valuenow', String(percent));
    ui.progress.setAttribute('aria-valuetext', `第一幕资源已准备 ${percent}%`);
  }

  const bucket = percent >= 100 ? 4 : Math.floor(percent / 25);
  const previousBucket = Number(ui.element.dataset.announcedProgressBucket || -1);
  if (options.announce !== false && bucket > previousBucket && bucket > 0) {
    setText(ui.announcement, `第一幕资源已准备 ${percent}%`);
  }
  ui.element.dataset.announcedProgressBucket = String(
    Math.max(previousBucket, bucket)
  );
  return true;
}

export function isGameLoadingVisible() {
  const element = document.getElementById('ui-game-loading');
  return Boolean(
    element &&
    !element.hidden &&
    element.getAttribute('aria-hidden') === 'false'
  );
}

/**
 * 立即从无障碍树移除，视觉层可再用 240ms 完成淡出。
 */
export function hideGameLoading(options = {}) {
  const ui = getUI();
  if (!ui) return false;
  cancelPendingState(ui.element);
  ui.element.classList.remove('visible');
  ui.element.setAttribute('aria-hidden', 'true');
  ui.element.setAttribute('aria-busy', 'false');

  const finish = () => {
    ui.element.__gameLoadingHideTimer = null;
    ui.element.hidden = true;
    ui.element.dataset.loadingStage = 'idle';
    ui.element.dataset.progressMode = 'indeterminate';
    resetRecoveryActions(ui);
  };
  if (options.immediate) {
    finish();
  } else {
    ui.element.__gameLoadingHideTimer = setTimeout(
      finish,
      HIDE_TRANSITION_MS
    );
  }
  return true;
}

export function showGameLoadingError(message, options = {}) {
  const shown = showGameLoadingStage('error', {
    detail: message || STAGE_COPY.error.detail
  });
  const ui = getUI();
  if (!shown || !ui) return shown;

  ui.element.setAttribute('aria-busy', 'false');
  if (typeof options.onRetry === 'function') {
    ui.element.classList.add('recoverable');
    ui.element.setAttribute('role', 'alertdialog');
    ui.element.setAttribute('aria-modal', 'true');
    if (ui.actions) ui.actions.hidden = false;
    if (ui.action) {
      ui.action.hidden = false;
      setText(ui.action, options.actionLabel || '重新加载游戏');
      ui.action.onclick = () => options.onRetry();
    }
    if (ui.dismiss && typeof options.onDismiss === 'function') {
      ui.dismiss.hidden = false;
      setText(ui.dismiss, options.dismissLabel || '先回标题');
      ui.dismiss.onclick = () => options.onDismiss();
    }
    const focusAction = () => {
      if (isGameLoadingVisible() && ui.action && !ui.action.hidden) {
        ui.action.focus({ preventScroll: true });
      }
    };
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(focusAction);
    } else {
      setTimeout(focusAction, 0);
    }
  } else {
    ui.element.__gameLoadingErrorTimer = setTimeout(() => {
      hideGameLoading();
    }, 1600);
  }
  return shown;
}
