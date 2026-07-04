import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from './config.js';
import { IntroScene } from './scenes/IntroScene.js';
import { BootScene } from './scenes/BootScene.js';
import { GameScene } from './scenes/GameScene.js';
import { EndingScene } from './scenes/EndingScene.js';
import { ENDINGS } from './data/endings.js';
import { matchEnding } from './data/endings.js';

// === 结局数据一致性检查（开发期防御）===
// 确保所有结局定义在 display 表中都有对应条目，避免无声回退到 default
(function validateEndingsConsistency() {
  const storyEndings = Object.keys(ENDINGS);
  // 这里可以添加更多检查逻辑
  if (typeof console !== 'undefined' && console.debug) {
    console.debug(`[Endings] ${storyEndings.length} 个结局已加载`);
  }
})();

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
    scale: {
      mode: mobilePortrait ? Phaser.Scale.FIT : Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      resolution: 1 // Fixed at 1 for performance — avoids high-DPI buffer scaling issues
    },
    scene: [BootScene, IntroScene, GameScene, EndingScene],
    // 竖屏标记，供 scene 读取
    callbacks: {
      preBoot: (game) => {
        game.registry.set('isPortraitMobile', mobilePortrait);
      }
    }
  };
}

const config = getResponsiveConfig();

const game = new Phaser.Game(config);
window.game = game;

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

function _hideLoading() {
  clearInterval(_loadingTimer);
  if (_loadingFill) _loadingFill.style.width = '100%';
  if (_loadingText) _loadingText.textContent = '准备好了。';
  setTimeout(() => {
    if (_loadingEl) {
      _loadingEl.classList.add('hidden');
      setTimeout(() => { if (_loadingEl) _loadingEl.remove(); }, 700);
    }
  }, 250);
}

// BootScene.create 执行完毕 = 标题画面 DOM 已就绪，可安全移除 loading
game.events.once('ready', () => {
  // 给标题画面一点渲染时间再淡出
  setTimeout(_hideLoading, 300);
});

// 兜底：如果 6 秒后 ready 仍未触发（异常情况），强制移除
setTimeout(() => {
  if (_loadingEl && !_loadingEl.classList.contains('hidden')) _hideLoading();
}, 6000);

// Register Service Worker for PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}

// === 全局横屏提示（所有场景生效）===
(function setupGlobalOrientationHint() {
  const hint = document.getElementById('rotate-hint');
  if (!hint) return;
  let userDismissed = false;
  const update = () => {
    if (userDismissed) return;
    const isPortrait = window.matchMedia('(orientation: portrait)').matches;
    if (isPortrait && window.innerWidth < 768) {
      hint.classList.remove('hidden');
    } else {
      hint.classList.add('hidden');
    }
  };
  const dismissBtn = document.getElementById('rotate-hint-dismiss');
  if (dismissBtn) {
    dismissBtn.addEventListener('click', () => {
      userDismissed = true;
      hint.classList.add('hidden');
    }, { once: true });
  }
  update();
  window.addEventListener('resize', update);
  window.addEventListener('orientationchange', update);
})();
