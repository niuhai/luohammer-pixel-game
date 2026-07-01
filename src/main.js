import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from './config.js';
import { IntroScene } from './scenes/IntroScene.js';
import { BootScene } from './scenes/BootScene.js';
import { GameScene } from './scenes/GameScene.js';
import { EndingScene } from './scenes/EndingScene.js';

// === 全局错误捕获 ===
// 捕获未处理的同步错误和 Promise 拒绝，防止白屏且便于生产排查
window.addEventListener('error', (e) => {
  console.error('[全局错误]', e.message, e.filename + ':' + e.lineno, e.error);
});
window.addEventListener('unhandledrejection', (e) => {
  console.error('[未处理的Promise拒绝]', e.reason);
  e.preventDefault?.();
});

const config = {
  type: Phaser.CANVAS,
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  pixelArt: true,
  roundPixels: true,
  backgroundColor: 0x0a0a0a,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    resolution: 1 // Fixed at 1 for performance — avoids high-DPI buffer scaling issues
  },
  scene: [BootScene, IntroScene, GameScene, EndingScene]
};

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
