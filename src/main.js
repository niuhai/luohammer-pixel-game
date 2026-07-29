import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, CHARACTER_ASSETS, SCENE_ASSETS } from './config.js';
import { IntroScene } from './scenes/IntroScene.js';
import { BootScene } from './scenes/BootScene.js';

// === 结局数据一致性检查（仅开发期）===
// 生产首屏不应为了开发期校验同步下载结局数据。
if (import.meta.env.DEV) {
  Promise.all([import('./config.js'), import('./data/endings.js')]).then(([
    { ENDING_PRESENTATION_MAP, SCENE_ASSETS },
    { ENDINGS }
  ]) => {
    const endingIds = ENDINGS.map(e => e.id);
    const validSceneTypes = new Set(SCENE_ASSETS.map(asset => asset.type));
    const validBgmTypes = new Set(['ending_legendary', 'ending_tragic', 'ending_peaceful']);
    const validParticleStyles = new Set(['legendary', 'tragic', 'peaceful', 'neutral']);
    const missing = endingIds.filter(id => !ENDING_PRESENTATION_MAP[id]);
    const invalid = endingIds.filter(id => {
      const presentation = ENDING_PRESENTATION_MAP[id];
      return presentation && (
        !validSceneTypes.has(presentation.sceneType) ||
        !validBgmTypes.has(presentation.bgmType) ||
        !validParticleStyles.has(presentation.particleStyle)
      );
    });
    if (missing.length) {
      console.error('[Endings] 以下结局缺少完整呈现配置:', missing);
    }
    if (invalid.length) {
      console.error('[Endings] 以下结局的呈现配置无效:', invalid);
    }
    if (!missing.length && !invalid.length && typeof console !== 'undefined' && console.debug) {
      console.debug(`[Endings] ${endingIds.length} 个结局呈现配置校验通过`);
    }
  }).catch(error => console.warn('[Endings] 开发期一致性检查未完成:', error));
}

// 主游戏与结局场景不阻塞标题首屏；仅在玩家明确开始/继续后加载。
let gameplayScenesPromise = null;
function ensureGameplayScenes(game) {
  if (game.scene.keys.GameScene && game.scene.keys.EndingScene) {
    return Promise.resolve();
  }
  if (!gameplayScenesPromise) {
    gameplayScenesPromise = Promise.all([
      import('./scenes/GameScene.js'),
      import('./scenes/EndingScene.js')
    ]).then(([{ GameScene }, { EndingScene }]) => {
      if (!game.scene.keys.GameScene) game.scene.add('GameScene', GameScene, false);
      if (!game.scene.keys.EndingScene) game.scene.add('EndingScene', EndingScene, false);
    }).catch(error => {
      gameplayScenesPromise = null;
      throw error;
    });
  }
  return gameplayScenesPromise;
}

const _assetWarmPromises = new Map();
function _warmAsset(url) {
  if (_assetWarmPromises.has(url)) return _assetWarmPromises.get(url);
  const promise = fetch(url, { priority: 'low' })
    .then(response => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.blob();
    })
    .catch(error => {
      _assetWarmPromises.delete(url);
      throw error;
    });
  _assetWarmPromises.set(url, promise);
  return promise;
}

function _warmFirstGameplayAssets() {
  const firstSceneUrls = [
    'assets/characters/scene-classroom-v2.webp',
    'assets/characters/luo-standing-v4-nobg.webp',
    'assets/characters/luo-young-v4-nobg.webp'
  ];
  for (const url of firstSceneUrls) {
    _warmAsset(url).catch(() => {
      // Phaser 进入 GameScene 后仍会按需加载并提供 Graphics 兜底。
    });
  }
}

let _gameplayIntentPrepared = false;
function prepareGameplay(game) {
  if (!_gameplayIntentPrepared) {
    _gameplayIntentPrepared = true;
    // 点击开始即并行准备首章图片；下载发生在序章演出内，不再占用标题首屏带宽。
    _warmFirstGameplayAssets();
    // 完整离线资源只在玩家已表达游玩意图后渐进缓存。
    setTimeout(_warmGameAssets, 3200);
  }
  return ensureGameplayScenes(game);
}

// === 全局错误捕获 ===
// 捕获未处理的同步错误和 Promise 拒绝，防止白屏且便于生产排查
window.addEventListener('error', (e) => {
  console.error('[全局错误]', e.message, e.filename + ':' + e.lineno, e.error);
});
window.addEventListener('unhandledrejection', (e) => {
  console.error('[未处理的Promise拒绝]', e.reason);
  e.preventDefault?.();
});

// === 移动端动态缩放策略 ===
// 竖屏时动态缩小 game height 使 Canvas 自适应屏幕宽度，不再强制横屏
function getResponsiveConfig() {
  const isPortrait = window.matchMedia('(orientation: portrait)').matches;
  const isMobile = window.innerWidth < 768;
  // 竖屏移动设备：调整显示高度以适配竖屏（16:9 → 可兼容竖屏 9:16）
  const mobilePortrait = isPortrait && isMobile;
  return {
    type: Phaser.CANVAS,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    pixelArt: true,
    roundPixels: true,
    backgroundColor: 0x0a0a0a,
    // R89: XHR 资源加载韧性——默认 timeout=0（无限等待）会让挂起请求永久阻塞
    // GameScene create()（慢网"永久黑屏"根因）。20s 判定失败 + 重试 2 次，
    // 最终失败走 loaderror → create() 照常执行，PixelRenderer 自动降级为
    // Graphics 绘制的兜底角色/背景，游戏永远可玩。
    loader: {
      timeout: 20000,
      maxRetries: 2
    },
    scale: {
      mode: mobilePortrait ? Phaser.Scale.FIT : Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      resolution: 1 // Fixed at 1 for performance — avoids high-DPI buffer scaling issues
    },
    scene: [BootScene, IntroScene],
    // 竖屏标记，供 scene 读取
    callbacks: {
      preBoot: (game) => {
        game.registry.set('isPortraitMobile', mobilePortrait);
        game.registry.set('ensureGameplayScenes', () => prepareGameplay(game));
      }
    }
  };
}

const config = getResponsiveConfig();

const game = new Phaser.Game(config);
// R90: 仅本地环境暴露调试句柄（走查/诊断脚本依赖），生产环境关闭 cheat 面
if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) {
  window.game = game;
}

// a11y: 为 Phaser 生成的 canvas 添加无障碍标注
game.events.once('ready', () => {
  const canvas = document.querySelector('canvas');
  if (canvas) {
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', '罗的十字路口像素游戏画面');
  }
});

// === 首屏 Loading 控制 ===
// Phaser ready 后淡出 loading 层，避免黑屏等待
const _loadingEl = document.getElementById('app-loading');
const _loadingFill = document.getElementById('app-loading-fill');
const _loadingText = document.getElementById('app-loading-text');

// 进度模拟：让进度条有"在动"的感觉，真实加载完成后直接跳满
let _loadingProgress = 0;
const _loadingTimer = setInterval(() => {
  _loadingProgress = Math.min(90, _loadingProgress + Math.random() * 12);
  if (_loadingFill) _loadingFill.style.width = _loadingProgress + '%';
}, 220);

let _loadingHidden = false;
function _hideLoading() {
  if (_loadingHidden) return;
  _loadingHidden = true;
  clearInterval(_loadingTimer);
  if (_loadingFill) _loadingFill.style.width = '100%';
  if (_loadingText) _loadingText.textContent = '准备好了。';
  // 标题 DOM 已可操作，不再人为停留 250ms；下一帧立即让出交互，
  // 仅保留一段很短的视觉淡出。
  requestAnimationFrame(() => {
    if (_loadingEl) {
      _loadingEl.classList.add('hidden');
      setTimeout(() => { if (_loadingEl) _loadingEl.remove(); }, 300);
    }
  });
}

// === PWA 离线完整性——玩家开始后空闲时全量图片资源预热 ===
// 首屏只承担标题资源；明确开始后再串行低优先级拉取全部图片并写入 SW 运行时缓存。
let _assetsWarmStarted = false;
function _warmGameAssets() {
  if (_assetsWarmStarted) return;
  _assetsWarmStarted = true;

  // 省流量模式 / 极慢网络不预热——预热是增强不是必需，绝不牺牲弱网体验
  const conn = navigator.connection;
  if (conn && (conn.saveData || /(^|-)2g$/.test(conn.effectiveType || ''))) return;
  // 只有页面已经被 SW 控制时，预热请求才会进入运行时缓存。
  // 首次访问虽然可以注册 SW，但当前页尚未受其控制；此时预热既不能形成离线资产，
  // 还会与序章后的主游戏资源争抢网络，造成“打开很慢”的真实感受。
  if (!('serviceWorker' in navigator) || !navigator.serviceWorker.controller) return;

  // 角色姿态优先（每节点都在屏，情绪价值最高），场景图其后（config 顺序≈剧情顺序）
  const urls = [];
  const seen = new Set();
  for (const asset of [...CHARACTER_ASSETS, ...SCENE_ASSETS]) {
    if (asset && asset.url && !seen.has(asset.url)) {
      seen.add(asset.url);
      urls.push(asset.url);
    }
  }

  const idle = () => new Promise((resolve) => {
    if ('requestIdleCallback' in window) {
      window.requestIdleCallback(resolve, { timeout: 2000 });
    } else {
      setTimeout(resolve, 300);
    }
  });
  const visible = () => new Promise((resolve) => {
    if (!document.hidden) return resolve();
    document.addEventListener('visibilitychange', function onVisible() {
      if (!document.hidden) {
        document.removeEventListener('visibilitychange', onVisible);
        resolve();
      }
    });
  });

  (async () => {
    for (const url of urls) {
      try {
        await visible();   // 页面隐藏时暂停，回前台续传
        await idle();      // 每张之间让出主线程与网络优先级
        // 低优先级串行拉取；SW staleWhileRevalidate 会把响应写入离线缓存
        await _warmAsset(url);
      } catch (error) {
        // 单张失败不阻塞后续；游玩时仍会按需加载
      }
    }
  })();
}

// BootScene 完整建立标题 DOM 后立即让出首屏；标题空闲期不下载玩法资源。
game.events.once('boot-ui-ready', () => {
  _hideLoading();
});

// 生命周期兜底：若自定义就绪信号未触发，Phaser ready 后仍可快速进入标题。
game.events.once('ready', () => {
  setTimeout(() => {
    _hideLoading();
  }, 300);
});

// 早期兜底：2.5 秒后若 loading 仍在，强制让出交互。
setTimeout(() => {
  if (_loadingEl && !_loadingEl.classList.contains('hidden')) _hideLoading();
}, 2500);

// Service Worker 注册已由 index.html 负责（含开发环境判断），此处不再重复注册

// === 竖屏建议：仅标题页首次短暂出现，不阻断已完整支持的竖屏游玩 ===
(function setupGlobalOrientationHint() {
  const hint = document.getElementById('rotate-hint');
  if (!hint) return;
  const storageKey = 'luohammer_orientation_hint_seen';
  const bootOverlay = document.getElementById('ui-boot-overlay');
  let canShow = true;
  let isShowing = false;
  let autoHideTimer = null;
  try {
    canShow = localStorage.getItem(storageKey) !== '1';
  } catch (e) {}

  const restoreSceneFocus = () => {
    requestAnimationFrame(() => {
      const focusTarget = document.querySelector([
        '#ui-boot-overlay.visible .ui-boot-btn-primary',
        '#ui-intro-overlay.visible #ui-intro-skip-hint.visible',
        '#ui-talent-overlay.visible .ui-talent-card:not([disabled])',
        '#ui-choices.visible .ui-choice-btn:not([disabled])',
        '#ui-dialog.visible',
        '#ui-ending-overlay.visible .ui-ending-content'
      ].join(','));
      focusTarget?.focus({ preventScroll: true });
    });
  };

  const hide = ({ restoreFocus = false } = {}) => {
    if (autoHideTimer) {
      clearTimeout(autoHideTimer);
      autoHideTimer = null;
    }
    isShowing = false;
    hint.classList.add('hidden');
    hint.setAttribute('aria-hidden', 'true');
    if (restoreFocus) restoreSceneFocus();
  };

  const update = () => {
    const isPortrait = window.matchMedia('(orientation: portrait)').matches;
    const isBootVisible = bootOverlay?.classList.contains('visible');
    if (isShowing && (!isPortrait || window.innerWidth >= 768 || !isBootVisible)) {
      hide();
      return;
    }
    if (canShow && isPortrait && window.innerWidth < 768 && isBootVisible) {
      canShow = false;
      isShowing = true;
      try { localStorage.setItem(storageKey, '1'); } catch (e) {}
      hint.classList.remove('hidden');
      hint.setAttribute('aria-hidden', 'false');
      autoHideTimer = setTimeout(() => hide(), 7000);
    }
  };

  const dismissBtn = document.getElementById('rotate-hint-dismiss');
  if (dismissBtn) {
    dismissBtn.addEventListener('click', () => {
      hide({ restoreFocus: true });
    });
  }

  if (bootOverlay) {
    new MutationObserver(update).observe(bootOverlay, {
      attributes: true,
      attributeFilter: ['class']
    });
  }
  game.events.on('boot-ui-ready', update);
  update();
  window.addEventListener('resize', update);
  window.addEventListener('orientationchange', update);
})();
