const QUOTES = [
  '彪悍的人生不需要解释',
  '通过干干净净地赚钱让人相信干干净净地赚钱是可能的',
  '不被嘲笑的梦想是不值得去实现的',
  '永远年轻，永远热泪盈眶',
  '我不是为了输赢，我就是认真'
];

const SAVE_KEY = 'luohammer_save';
const SAVE_SLOTS_KEY = 'luohammer_save_slots';

function readStoredBootState(storage) {
  let hasAutoSave = false;
  let hasManualSave = false;
  try {
    hasAutoSave = storage.getItem(SAVE_KEY) !== null;
    const rawSlots = storage.getItem(SAVE_SLOTS_KEY);
    const slots = rawSlots ? JSON.parse(rawSlots) : null;
    hasManualSave = Boolean(slots && typeof slots === 'object' &&
      Object.values(slots).some(entry => entry?.state));
  } catch (error) {
    // 标题壳只做存在性判断；完整校验仍由 SaveSystem 接管。
  }
  return {
    hasAutoSave,
    hasAnySave: hasAutoSave || hasManualSave
  };
}

function createPrimaryAction(buttons, storedState) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'ui-boot-btn ui-boot-btn-primary ui-boot-shell-primary';
  if (storedState.hasAutoSave) {
    button.textContent = '继续游戏';
    button.dataset.shellAction = 'continue';
  } else if (storedState.hasAnySave) {
    button.textContent = '存档管理';
    button.dataset.shellAction = 'manage';
  } else {
    button.textContent = '开始游戏';
    button.dataset.shellAction = 'start';
  }
  buttons.appendChild(button);
  return button;
}

function createStatus(buttons) {
  const status = document.createElement('div');
  status.id = 'ui-boot-shell-status';
  status.className = 'ui-boot-shell-status';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  status.textContent = '完整菜单正在后台准备';
  buttons.appendChild(status);
  return status;
}

function hideBlockingLoader() {
  const loading = document.getElementById('app-loading');
  if (!loading) return;
  // 壳层标题与首帧占位使用不同字号，交叉淡化会产生重影；壳已完整可见后直接换帧。
  loading.remove();
}

function scheduleIdle(callback) {
  if (typeof window.requestIdleCallback === 'function') {
    const id = window.requestIdleCallback(callback, { timeout: 1200 });
    return () => window.cancelIdleCallback?.(id);
  }
  const id = window.setTimeout(callback, 700);
  return () => window.clearTimeout(id);
}

/**
 * 在 Phaser 下载和初始化之前交付标题主操作。
 * 完整 BootScene 就绪后会消费 intent，并把焦点与动作无缝交给真实按钮。
 */
export function initializeBootShell(options = {}) {
  if (window.__luohammerBootShell?.version === 1) {
    return window.__luohammerBootShell;
  }

  const loadEngine = options.loadEngine || (() => import('./main.js'));
  const overlay = document.getElementById('ui-boot-overlay');
  const buttons = document.getElementById('ui-boot-buttons');
  const quote = document.getElementById('ui-boot-quote');
  if (!overlay || !buttons || !quote) {
    // 壳层结构意外缺失时仍启动完整应用，避免一次 HTML/CSS 漂移把页面变成空白。
    Promise.resolve()
      .then(() => loadEngine())
      .catch(error => {
        console.error('[BootShell] fallback engine load failed:', error);
      });
    return null;
  }

  const storedState = readStoredBootState(options.storage || localStorage);
  const quoteText = QUOTES[Math.floor(Math.random() * QUOTES.length)];
  const state = {
    version: 1,
    visibleAt: performance.now(),
    interactiveAt: null,
    engineRequestedAt: null,
    engineModuleLoadedAt: null,
    engineReadyAt: null,
    requestReason: null,
    intent: null,
    quote: quoteText,
    hasAutoSave: storedState.hasAutoSave,
    hasAnySave: storedState.hasAnySave,
    enginePromise: null,
    cancelScheduledLoad: null,
    consumeIntent() {
      const pending = this.intent;
      this.intent = null;
      return pending;
    },
    markEngineReady() {
      this.engineReadyAt = performance.now();
    }
  };
  window.__luohammerBootShell = state;

  overlay.dataset.bootPhase = 'shell';
  overlay.classList.add('boot-shell-hydrated');
  overlay.classList.toggle('returning-player', storedState.hasAnySave);
  overlay.classList.add('visible');
  buttons.classList.toggle('is-returning', storedState.hasAnySave);
  buttons.innerHTML = '';
  quote.textContent = quoteText;

  const primary = createPrimaryAction(buttons, storedState);
  const originalLabel = primary.textContent;
  const status = createStatus(buttons);
  primary.setAttribute('aria-describedby', status.id);

  const startEngine = reason => {
    if (state.enginePromise) return state.enginePromise;
    state.cancelScheduledLoad?.();
    state.cancelScheduledLoad = null;
    state.requestReason = reason;
    state.engineRequestedAt = performance.now();
    if (!state.intent) status.textContent = '完整菜单正在后台准备';
    state.enginePromise = Promise.resolve()
      .then(() => loadEngine())
      .then(module => {
        state.engineModuleLoadedAt = performance.now();
        return module;
      })
      .catch(error => {
        state.enginePromise = null;
        state.engineRequestedAt = null;
        state.intent = null;
        status.textContent = '加载未完成，请重试';
        primary.disabled = false;
        primary.removeAttribute('aria-busy');
        primary.textContent = originalLabel;
        console.error('[BootShell] engine load failed:', error);
        throw error;
      });
    return state.enginePromise;
  };

  primary.addEventListener('click', () => {
    if (state.intent) return;
    state.intent = {
      action: primary.dataset.shellAction,
      requestedAt: performance.now()
    };
    primary.disabled = true;
    primary.setAttribute('aria-busy', 'true');
    primary.textContent = state.intent.action === 'continue'
      ? '正在读取进度…'
      : state.intent.action === 'manage'
        ? '正在准备存档…'
        : '正在准备开场…';
    status.textContent = '操作已收到，正在进入完整体验';
    // 状态与重试入口已在 startEngine 内恢复；这里消费 rejection，避免全局未处理错误。
    startEngine('intent').catch(() => {});
  });
  primary.addEventListener('keydown', event => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    // 引擎可能恰好在 keydown/keyup 之间替换按钮；在 keydown 当下锁定意图，
    // 避免键盘激活因焦点节点被接管而静默丢失。
    event.preventDefault();
    primary.click();
  });

  hideBlockingLoader();
  state.interactiveAt = performance.now();
  window.dispatchEvent(new CustomEvent('luohammer:shell-interactive', {
    detail: {
      action: primary.dataset.shellAction,
      interactiveAt: state.interactiveAt
    }
  }));
  requestAnimationFrame(() => {
    const active = document.activeElement;
    if (!active || active === document.body || !overlay.contains(active)) {
      primary.focus({ preventScroll: true });
    }
  });

  if (options.scheduleEngine !== false) {
    state.cancelScheduledLoad = scheduleIdle(() => {
      startEngine('idle').catch(() => {});
    });
  }
  state.startEngine = startEngine;
  return state;
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  initializeBootShell();
}
