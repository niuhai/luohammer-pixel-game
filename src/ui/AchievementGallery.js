import {
  ALL_ACHIEVEMENTS,
  HIDDEN_ACHIEVEMENTS,
  COMBO_ACHIEVEMENTS,
  loadUnlockedAchievements,
  loadComboAchievements,
  getAchievementScore
} from './AchievementPopup.js';
import { MetaProgression, MILESTONE_REWARDS } from '../systems/MetaProgression.js';

/**
 * 打开成就图鉴弹窗。
 * @param {object} options
 * @param {Set<string>} [options.unlockedNames] - 已解锁成就名称集合；未传则从 localStorage 读取。
 * @param {string|null} [options.highlightName] - 高亮并默认展示详情的成就名称。
 * @param {Function} [options.onClose] - 关闭后的回调。
 * @param {boolean} [options.showHiddenHints] - 是否显示隐藏成就的提示。
 */
export function showAchievementGallery(options = {}) {
  const previousFocus = document.activeElement instanceof HTMLElement
    ? document.activeElement
    : null;
  let unlockedNames = options.unlockedNames;
  if (!unlockedNames) {
    const stored = loadUnlockedAchievements();
    unlockedNames = new Set(stored.map(a => a.name).filter(Boolean));
  }

  const allDefs = Object.values(ALL_ACHIEVEMENTS);
  const hiddenDefs = Object.values(HIDDEN_ACHIEVEMENTS);
  const hiddenNames = new Set(hiddenDefs.map(def => def.name));
  const normalDefs = allDefs.filter(def => !hiddenNames.has(def.name));
  const comboList = loadComboAchievements();
  const comboNames = new Set(comboList.map(combo => combo.name).filter(Boolean));

  // === 计算总积分 ===
  const meta = new MetaProgression();
  let totalScore = meta.getAchievementScore();
  if (!totalScore) {
    // 回退方案：本地累加
    for (const def of allDefs) {
      if (unlockedNames.has(def.name)) totalScore += getAchievementScore(def.name);
    }
    for (const combo of comboList) {
      totalScore += combo.score || 0;
    }
  }

  // === 计算里程碑进度 ===
  const claimedMilestones = meta.getClaimedMilestones();
  const unlockedCount = allDefs.filter(def => unlockedNames.has(def.name)).length;
  const totalAchievementCount = unlockedCount + comboNames.size;
  const totalCount = allDefs.length + COMBO_ACHIEVEMENTS.length;
  const pct = totalCount > 0 ? Math.round((totalAchievementCount / totalCount) * 100) : 0;
  const nextMs = MILESTONE_REWARDS.find(ms => totalAchievementCount < ms.threshold) || null;

  // 移除已存在的弹窗
  const existing = document.getElementById('ui-achievement-gallery-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'ui-achievement-gallery-overlay';
  overlay.className = 'ui-achievement-gallery-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', 'ui-achievement-gallery-title');

  overlay.innerHTML = `
    <div class="ui-achievement-gallery-card">
      <div class="ui-achievement-gallery-header">
        <div class="ui-achievement-gallery-title" id="ui-achievement-gallery-title">
          <span aria-hidden="true">★</span>
          <span>成就图鉴</span>
        </div>
        <div class="ui-achievement-gallery-count">${totalAchievementCount} / ${totalCount}</div>
        <button class="ui-achievement-gallery-close" type="button" aria-label="关闭成就图鉴">✕</button>
      </div>
      <div class="ui-achievement-gallery-progress">
        <div class="ui-achievement-gallery-progress-fill" style="width: ${pct}%"></div>
      </div>
      <div class="ui-achievement-gallery-score-row">
        <div class="ui-achievement-gallery-score-box">
          <span class="ui-achievement-gallery-score-label">总积分</span>
          <span class="ui-achievement-gallery-score-value">${totalScore}</span>
        </div>
        <div class="ui-achievement-gallery-score-box">
          <span class="ui-achievement-gallery-score-label">成就数</span>
          <span class="ui-achievement-gallery-score-value">${totalAchievementCount}</span>
        </div>
        <div class="ui-achievement-gallery-score-box">
          <span class="ui-achievement-gallery-score-label">里程碑</span>
          <span class="ui-achievement-gallery-score-value">${claimedMilestones.length}/${MILESTONE_REWARDS.length}</span>
        </div>
      </div>
      <div class="ui-achievement-gallery-tabs" role="tablist" aria-label="成就分类">
        <button class="ui-achievement-gallery-tab active" id="ui-achievement-tab-normal" type="button" role="tab" aria-selected="true" data-tab="normal">
          <span>普通</span><b>${normalDefs.filter(def => unlockedNames.has(def.name)).length}/${normalDefs.length}</b>
        </button>
        <button class="ui-achievement-gallery-tab" id="ui-achievement-tab-hidden" type="button" role="tab" aria-selected="false" data-tab="hidden">
          <span>隐藏</span><b>${hiddenDefs.filter(def => unlockedNames.has(def.name)).length}/${hiddenDefs.length}</b>
        </button>
        <button class="ui-achievement-gallery-tab" id="ui-achievement-tab-combo" type="button" role="tab" aria-selected="false" data-tab="combo">
          <span>组合</span><b>${comboNames.size}/${COMBO_ACHIEVEMENTS.length}</b>
        </button>
      </div>
      <div class="ui-achievement-gallery-grid" id="ui-achievement-gallery-grid" role="tabpanel" aria-labelledby="ui-achievement-tab-normal"></div>
      <div class="ui-achievement-gallery-detail" id="ui-achievement-gallery-detail">
        <div class="ui-achievement-gallery-detail-empty">点击上方成就查看触发原因</div>
      </div>
      <div class="ui-achievement-gallery-milestones" id="ui-achievement-gallery-milestones"></div>
    </div>
  `;

  document.body.appendChild(overlay);

  // 动画
  requestAnimationFrame(() => overlay.classList.add('visible'));

  const grid = overlay.querySelector('#ui-achievement-gallery-grid');
  const detail = overlay.querySelector('#ui-achievement-gallery-detail');
  const milestones = overlay.querySelector('#ui-achievement-gallery-milestones');
  const tabs = [...overlay.querySelectorAll('.ui-achievement-gallery-tab')];

  function renderDetail(def, type) {
    const unlocked = type === 'combo' ? comboNames.has(def.name) : unlockedNames.has(def.name);
    if (type === 'hidden' && !unlocked) {
      // 全知之眼：显示隐藏成就的触发提示
      const hint = options.showHiddenHints ? (def.desc || '暂无提示') : '达成特定隐藏条件后解锁。';
      const hintLabel = options.showHiddenHints ? '隐藏成就 · 预兆提示' : '隐藏成就';
      detail.innerHTML = `
        <div class="ui-achievement-gallery-detail-icon">${options.showHiddenHints ? '◯' : '◑'}</div>
        <div class="ui-achievement-gallery-detail-name">${hintLabel}</div>
        <div class="ui-achievement-gallery-detail-desc">${hint}</div>
      `;
      return;
    }

    const detailLabel = type === 'combo'
      ? (unlocked ? '组合成就 · 已达成' : '组合路径')
      : (type === 'hidden' ? '隐藏成就 · 触发条件' : (unlocked ? '已达成 · 触发原因' : '解锁条件'));
    const requirement = type === 'combo' && Array.isArray(def.requires)
      ? `需要同时解锁：${def.requires.join(' + ')}`
      : (def.desc || '暂无描述');

    detail.innerHTML = `
      <div class="ui-achievement-gallery-detail-icon">${def.icon || '★'}</div>
      <div class="ui-achievement-gallery-detail-name">${def.name}</div>
      <div class="ui-achievement-gallery-detail-label">${detailLabel}</div>
      <div class="ui-achievement-gallery-detail-desc">${requirement}</div>
    `;
  }

  function renderGrid(type) {
    const defs = type === 'hidden'
      ? hiddenDefs
      : (type === 'combo' ? COMBO_ACHIEVEMENTS : normalDefs);
    grid.innerHTML = '';
    detail.innerHTML = '<div class="ui-achievement-gallery-detail-empty">选择一枚成就，查看它如何被点亮</div>';
    grid.dataset.tab = type;

    for (const def of defs) {
      const unlocked = type === 'combo' ? comboNames.has(def.name) : unlockedNames.has(def.name);
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'ui-achievement-gallery-item' +
        (unlocked ? ' unlocked' : ' locked') +
        (type === 'hidden' ? ' hidden' : '') +
        (type === 'combo' ? ' combo' : '');
      item.dataset.name = def.name;
      item.setAttribute('aria-pressed', 'false');
      const accessibleName = type === 'hidden' && !unlocked ? '未解锁隐藏成就' : def.name;
      item.setAttribute('aria-label', unlocked ? `${accessibleName}，已解锁` : `${accessibleName}，未解锁`);

      const icon = unlocked ? (def.icon || '★') : (type === 'hidden' ? '◑' : '?');
      const name = unlocked ? def.name : (type === 'hidden' ? '???' : def.name);
      const score = unlocked ? getAchievementScore(def.name) : 0;
      const scoreHtml = unlocked ? `<span class="ui-achievement-gallery-item-score">${score}</span>` : '';
      item.innerHTML = `<span class="ui-achievement-gallery-item-icon" aria-hidden="true">${icon}</span><span class="ui-achievement-gallery-item-name">${name}</span>${scoreHtml}`;

      item.addEventListener('click', () => {
        grid.querySelectorAll('.ui-achievement-gallery-item').forEach(el => {
          el.classList.remove('active');
          el.setAttribute('aria-pressed', 'false');
        });
        item.classList.add('active');
        item.setAttribute('aria-pressed', 'true');
        renderDetail(def, type);
      });

      grid.appendChild(item);
    }
  }

  function selectTab(type) {
    tabs.forEach(tab => {
      const active = tab.dataset.tab === type;
      tab.classList.toggle('active', active);
      tab.setAttribute('aria-selected', String(active));
      tab.tabIndex = active ? 0 : -1;
    });
    grid.setAttribute('aria-labelledby', `ui-achievement-tab-${type}`);
    renderGrid(type);
  }

  for (const tab of tabs) {
    tab.addEventListener('click', () => selectTab(tab.dataset.tab));
  }

  const milestoneStatus = nextMs
    ? `距离「${nextMs.name}」还差 ${Math.max(0, nextMs.threshold - totalAchievementCount)} 枚`
    : '所有跨周目里程碑均已达成';
  milestones.innerHTML = `
    <details class="ui-achievement-gallery-milestone-details">
      <summary>
        <span><b>◆ 跨周目里程碑</b><em>${milestoneStatus}</em></span>
        <span aria-hidden="true">▾</span>
      </summary>
      <div class="ui-achievement-gallery-milestone-list">
        ${MILESTONE_REWARDS.map(ms => {
          const reached = totalAchievementCount >= ms.threshold;
          const status = reached ? '已达成' : `${totalAchievementCount}/${ms.threshold}`;
          return `
            <div class="ui-achievement-gallery-milestone ${reached ? 'reached' : ''}">
              <span class="ui-achievement-gallery-milestone-mark">${reached ? '◆' : '◇'}</span>
              <span class="ui-achievement-gallery-milestone-copy">
                <b>${ms.name}</b><small>${ms.desc}</small>
              </span>
              <span class="ui-achievement-gallery-milestone-state">${status}</span>
            </div>
          `;
        }).join('')}
      </div>
    </details>
  `;

  // 默认分类与高亮
  let initialTab = 'normal';
  if (options.highlightName) {
    if (hiddenNames.has(options.highlightName)) initialTab = 'hidden';
    if (COMBO_ACHIEVEMENTS.some(def => def.name === options.highlightName)) initialTab = 'combo';
  }
  selectTab(initialTab);
  if (options.highlightName) {
    const target = grid.querySelector(`[data-name="${CSS.escape(options.highlightName)}"]`);
    if (target) {
      target.click();
      target.scrollIntoView({ block: 'nearest' });
    }
  }

  let closed = false;
  const onKey = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
      return;
    }

    const tabIndex = tabs.indexOf(event.target);
    if (tabIndex >= 0 && ['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
      event.preventDefault();
      let nextIndex = tabIndex;
      if (event.key === 'ArrowLeft') nextIndex = (tabIndex - 1 + tabs.length) % tabs.length;
      if (event.key === 'ArrowRight') nextIndex = (tabIndex + 1) % tabs.length;
      if (event.key === 'Home') nextIndex = 0;
      if (event.key === 'End') nextIndex = tabs.length - 1;
      selectTab(tabs[nextIndex].dataset.tab);
      tabs[nextIndex].focus();
      return;
    }

    if (event.key === 'Tab') {
      const focusable = [...overlay.querySelectorAll(
        'button:not([disabled]), summary, [href], [tabindex]:not([tabindex="-1"])'
      )].filter(element => element.getClientRects().length > 0 || element === document.activeElement);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      } else if (!overlay.contains(document.activeElement)) {
        event.preventDefault();
        first.focus();
      }
    }
  };

  function close() {
    if (closed) return;
    closed = true;
    document.removeEventListener('keydown', onKey);
    overlay.classList.remove('visible');
    overlay.classList.add('hiding');
    setTimeout(() => {
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      if (previousFocus && previousFocus.isConnected) {
        previousFocus.focus({ preventScroll: true });
      }
      if (typeof options.onClose === 'function') options.onClose();
    }, 250);
  }

  overlay.querySelector('.ui-achievement-gallery-close').addEventListener('click', close);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });
  document.addEventListener('keydown', onKey);
  overlay.querySelector('.ui-achievement-gallery-close').focus();
}

/**
 * 从 session state 与 localStorage 合并出已解锁成就名称集合。
 * @param {object} [state] - GameScene 的 state（含 achievements 数组）。
 * @returns {Set<string>}
 */
export function getUnlockedAchievementNames(state) {
  const set = new Set();
  if (state && Array.isArray(state.achievements)) {
    for (const ach of state.achievements) {
      const name = typeof ach === 'string' ? ach : (ach.name || ach.achievement);
      if (name) set.add(name);
    }
  }
  const stored = loadUnlockedAchievements();
  for (const ach of stored) {
    if (ach.name) set.add(ach.name);
  }
  return set;
}
