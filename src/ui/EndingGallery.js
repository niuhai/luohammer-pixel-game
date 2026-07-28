import { ENDINGS, ENDING_HINTS } from '../data/endings.js';

/**
 * 结局图鉴面板
 *
 * 全屏展示所有结局的收集进度：
 * - 已解锁：显示结局标题 + 简短描述
 * - 未解锁：显示 "???" + 模糊提示
 *
 * 可在结局页和标题页调用。
 */

const STORAGE_KEY = 'luohammer_meta_progress';

/**
 * 从 localStorage 读取已见结局 ID 列表（兼容旧存档）
 * @returns {string[]}
 */
function loadSeenEndings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return parsed.seenEndings || [];
    }
  } catch (e) {}
  return [];
}

/**
 * 打开结局图鉴弹窗。
 * @param {object} [options]
 * @param {string[]} [options.seenEndings] - 已见结局 ID 列表；未传则从 localStorage 读取。
 * @param {Function} [options.onClose] - 关闭后的回调。
 */
export function showEndingGallery(options = {}) {
  const previousFocus = document.activeElement instanceof HTMLElement
    ? document.activeElement
    : null;
  const seenList = options.seenEndings || loadSeenEndings();
  const seenSet = new Set(seenList);

  // 移除已存在的弹窗
  const existing = document.getElementById('ui-ending-gallery-overlay');
  if (existing) existing.remove();

  const totalCount = ENDINGS.length;
  const unlockedCount = ENDINGS.filter(e => seenSet.has(e.id)).length;
  const pct = totalCount > 0 ? Math.round((unlockedCount / totalCount) * 100) : 0;

  const overlay = document.createElement('div');
  overlay.id = 'ui-ending-gallery-overlay';
  overlay.className = 'ui-ending-gallery-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', 'ui-ending-gallery-title');

  overlay.innerHTML = `
    <div class="ui-ending-gallery-card">
      <div class="ui-ending-gallery-header">
        <div class="ui-ending-gallery-title" id="ui-ending-gallery-title">
          <span>▤</span>
          <span>结局图鉴</span>
        </div>
        <div class="ui-ending-gallery-count">${unlockedCount} / ${totalCount}</div>
        <button class="ui-ending-gallery-close" aria-label="关闭">✕</button>
      </div>
      <div class="ui-ending-gallery-progress">
        <div class="ui-ending-gallery-progress-fill" style="width: ${pct}%"></div>
      </div>
      <div class="ui-ending-gallery-intro">
        每一种选择，都通往不同的命运。已收集 <b style="color: var(--color-gold);">${unlockedCount}</b> / ${totalCount} 种结局。
      </div>
      <div class="ui-ending-gallery-grid" id="ui-ending-gallery-grid"></div>
    </div>
  `;

  document.body.appendChild(overlay);

  // 动画
  requestAnimationFrame(() => overlay.classList.add('visible'));

  const grid = overlay.querySelector('#ui-ending-gallery-grid');

  // 渲染结局卡片
  ENDINGS.forEach((ending, idx) => {
    const isUnlocked = seenSet.has(ending.id);
    const card = document.createElement('div');
    card.className = isUnlocked
      ? 'ui-ending-gallery-card-item ui-ending-gallery-card-unlocked'
      : 'ui-ending-gallery-card-item ui-ending-gallery-card-locked';
    // R38: stagger 入场动画延迟（前 12 张卡片错开入场，强化"揭晓感"）
    card.style.setProperty('--card-index', Math.min(idx, 12));

    if (isUnlocked) {
      const desc = (ending.desc || '').replace(/罗远/g, '老罗');
      const shortDesc = desc.length > 80 ? desc.substring(0, 80) + '…' : desc;
      card.innerHTML = `
        <div class="ui-ending-gallery-card-icon">${ending.icon || '★'}</div>
        <div class="ui-ending-gallery-card-name">${ending.name}</div>
        <div class="ui-ending-gallery-card-subtitle">${ending.subtitle || ''}</div>
        <div class="ui-ending-gallery-card-desc">${shortDesc}</div>
      `;
    } else {
      const hint = ENDING_HINTS[ending.id] || '尝试不同的属性组合';
      card.innerHTML = `
        <div class="ui-ending-gallery-card-icon">◑</div>
        <div class="ui-ending-gallery-card-name">???</div>
        <div class="ui-ending-gallery-card-subtitle">未解锁</div>
        <div class="ui-ending-gallery-card-hint">提示：${hint}</div>
      `;
    }

    grid.appendChild(card);
  });

  // 关闭按钮
  // R88 GATE-R87 P1-2：closed 幂等 + escHandler 统一解绑（对齐 AchievementGallery 模式）——
  // 原实现仅 ESC 路径移除 keydown 监听器，点关闭按钮/遮罩关闭时监听器永久泄漏，
  // 且残留 handler 再收 ESC 会对已关闭图鉴重跑 closeGallery 导致 onClose 二次调用
  const closeBtn = overlay.querySelector('.ui-ending-gallery-close');
  let closed = false;
  const closeGallery = () => {
    if (closed) return;
    closed = true;
    try { options.audio?.playDialogAdvance?.(); } catch (e) {}
    document.removeEventListener('keydown', escHandler);
    overlay.classList.remove('visible');
    setTimeout(() => {
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      if (previousFocus && previousFocus.isConnected) {
        previousFocus.focus({ preventScroll: true });
      }
      if (typeof options.onClose === 'function') options.onClose();
    }, 250);
  };
  closeBtn.addEventListener('click', closeGallery);

  // 点击遮罩区域关闭
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeGallery();
  });

  // ESC 关闭 + Tab 焦点陷阱（统一在此 keydown 处理器，closeGallery 一处解绑，
  // 对齐 AchievementGallery onKey 模式，防监听器泄漏）
  const escHandler = (e) => {
    if (e.key === 'Escape') {
      closeGallery();
      return;
    }

    if (e.key === 'Tab') {
      const focusable = [...overlay.querySelectorAll(
        'button:not([disabled]), summary, [href], [tabindex]:not([tabindex="-1"])'
      )].filter(element => element.getClientRects().length > 0 || element === document.activeElement);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      } else if (!overlay.contains(document.activeElement)) {
        e.preventDefault();
        first.focus();
      }
    }
  };
  document.addEventListener('keydown', escHandler);
  // 初始焦点移入弹窗（关闭按钮）
  closeBtn.focus();
  // R91：图鉴开启确认音
  try { options.audio?.playChoice?.(); } catch (e) {}
}

/**
 * 获取结局收集进度摘要（用于在结局页/标题页显示精简进度条）
 * @param {string[]} [seenEndings] - 已见结局 ID 列表；未传则从 localStorage 读取。
 * @returns {{unlocked: number, total: number, pct: number}}
 */
export function getEndingProgress(seenEndings) {
  const seenList = seenEndings || loadSeenEndings();
  const seenSet = new Set(seenList);
  const total = ENDINGS.length;
  const unlocked = ENDINGS.filter(e => seenSet.has(e.id)).length;
  const pct = total > 0 ? Math.round((unlocked / total) * 100) : 0;
  return { unlocked, total, pct };
}
