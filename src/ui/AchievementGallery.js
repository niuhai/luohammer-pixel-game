import {
  ALL_ACHIEVEMENTS,
  HIDDEN_ACHIEVEMENTS,
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
  let unlockedNames = options.unlockedNames;
  if (!unlockedNames) {
    const stored = loadUnlockedAchievements();
    unlockedNames = new Set(stored.map(a => a.name).filter(Boolean));
  }

  const allDefs = Object.values(ALL_ACHIEVEMENTS);
  const hiddenDefs = Object.values(HIDDEN_ACHIEVEMENTS);
  const comboList = loadComboAchievements();
  const hiddenNames = new Set(hiddenDefs.map(d => d.name));

  // === 计算总积分 ===
  const meta = new MetaProgression();
  let totalScore = meta.getAchievementScore();
  if (!totalScore) {
    // 回退方案：本地累加
    for (const def of allDefs) {
      if (unlockedNames.has(def.name)) totalScore += getAchievementScore(def.name);
    }
    for (const def of hiddenDefs) {
      if (unlockedNames.has(def.name)) totalScore += getAchievementScore(def.name);
    }
    for (const combo of comboList) {
      totalScore += combo.score || 0;
    }
  }

  // === 计算里程碑进度 ===
  const claimedMilestones = meta.getClaimedMilestones();
  const totalAchievementCount = unlockedNames.size + comboList.length;
  let _highestMs = null;
  let nextMs = null;
  for (const ms of MILESTONE_REWARDS) {
    if (totalAchievementCount >= ms.threshold) {
      _highestMs = ms;
    } else if (!nextMs) {
      nextMs = ms;
    }
  }

  // 移除已存在的弹窗
  const existing = document.getElementById('ui-achievement-gallery-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'ui-achievement-gallery-overlay';
  overlay.className = 'ui-achievement-gallery-overlay';

  const unlockedCount = allDefs.filter(d => unlockedNames.has(d.name)).length;
  const totalCount = allDefs.length;
  const pct = totalCount > 0 ? Math.round((unlockedCount / totalCount) * 100) : 0;

  overlay.innerHTML = `
    <div class="ui-achievement-gallery-card">
      <div class="ui-achievement-gallery-header">
        <div class="ui-achievement-gallery-title">
          <span>★</span>
          <span>成就图鉴</span>
        </div>
        <div class="ui-achievement-gallery-count">${unlockedCount} / ${totalCount}</div>
        <button class="ui-achievement-gallery-close" aria-label="关闭">✕</button>
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
      <div class="ui-achievement-gallery-tabs">
        <button class="ui-achievement-gallery-tab active" data-tab="normal">普通</button>
        <button class="ui-achievement-gallery-tab" data-tab="hidden">隐藏</button>
        <button class="ui-achievement-gallery-tab" data-tab="combo">组合</button>
      </div>
      <div class="ui-achievement-gallery-grid" id="ui-achievement-gallery-grid"></div>
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

  function renderDetail(def) {
    const unlocked = unlockedNames.has(def.name);
    const hidden = hiddenNames.has(def.name);
    if (hidden && !unlocked) {
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
    detail.innerHTML = `
      <div class="ui-achievement-gallery-detail-icon">${def.icon || '★'}</div>
      <div class="ui-achievement-gallery-detail-name">${def.name}</div>
      <div class="ui-achievement-gallery-detail-label">${hidden ? '隐藏成就 · 触发条件' : '触发原因'}</div>
      <div class="ui-achievement-gallery-detail-desc">${def.desc || '暂无描述'}</div>
    `;
  }

  for (const def of allDefs) {
    const unlocked = unlockedNames.has(def.name);
    const hidden = hiddenNames.has(def.name);
    const item = document.createElement('div');
    item.className = 'ui-achievement-gallery-item' +
      (unlocked ? ' unlocked' : ' locked') +
      (hidden ? ' hidden' : '');
    item.dataset.name = def.name;

    const icon = unlocked ? (def.icon || '★') : (hidden ? '◑' : '?');
    const name = unlocked ? def.name : (hidden ? '???' : def.name);
    // 已解锁成就显示积分值
    const score = unlocked ? getAchievementScore(def.name) : 0;
    const scoreHtml = unlocked ? `<span class="ui-achievement-gallery-item-score">${score}</span>` : '';
    item.innerHTML = `<span class="ui-achievement-gallery-item-icon">${icon}</span><span class="ui-achievement-gallery-item-name">${name}</span>${scoreHtml}`;

    item.addEventListener('click', () => {
      grid.querySelectorAll('.ui-achievement-gallery-item').forEach(el => el.classList.remove('active'));
      item.classList.add('active');
      renderDetail(def);
    });

    grid.appendChild(item);
  }

  // 默认高亮
  if (options.highlightName) {
    const target = grid.querySelector(`[data-name="${CSS.escape(options.highlightName)}"]`);
    if (target) target.click();
  }

  function close() {
    overlay.classList.remove('visible');
    overlay.classList.add('hiding');
    setTimeout(() => {
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      if (typeof options.onClose === 'function') options.onClose();
    }, 250);
  }

  overlay.querySelector('.ui-achievement-gallery-close').addEventListener('click', close);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });
  document.addEventListener('keydown', function onKey(e) {
    if (e.key === 'Escape') {
      close();
      document.removeEventListener('keydown', onKey);
    }
  });
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
