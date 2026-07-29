/**
 * 天赋抽取系统
 *
 * 开局时随机抽取5个天赋，玩家5选2
 * UI：5张语义化天赋卡片，点击选择2个后确认
 */

import {
  TALENT_OFFER_COUNT,
  TALENT_PICK_COUNT,
  TALENT_SPECIAL_LABELS,
  getTalentCombination
} from '../data/talents.js';

// 保留旧导出名，兼容数据完整性测试与外部调用；单一事实源在 talents.js。
export const SPECIAL_LABELS = TALENT_SPECIAL_LABELS;

const ATTR_NAMES = Object.freeze({
  pride: '理想主义',
  wealth: '财富',
  reputation: '名声',
  pressure: '压力',
  trust: '公众信任',
  pressureMax: '压力上限',
  failurePenalty: '翻车记录',
  successBonus: '正面收益'
});

const TALENT_DEAL_STAGGER_MS = 45;
const TALENT_DEAL_DURATION_MS = 320;
const TALENT_BACK_HOLD_MS = 120;
const TALENT_REVEAL_STAGGER_MS = 80;
const TALENT_FLIP_DURATION_MS = 500;

export function formatTalentEffect(key, value) {
  const name = ATTR_NAMES[key] || key;
  if (key === 'failurePenalty' || key === 'successBonus') {
    return `${name} ×${value}`;
  }
  const sign = value > 0 ? '+' : '';
  return `${name}${sign}${value}`;
}

function getTalentEffectTone(key, value) {
  if (key === 'pressure') return value > 0 ? 'negative' : 'positive';
  if (key === 'failurePenalty') return value > 1 ? 'negative' : 'positive';
  if (key === 'successBonus') return value > 1 ? 'positive' : 'negative';
  return value > 0 ? 'positive' : 'negative';
}

export class TalentSystem {
  constructor(scene) {
    this.scene = scene;
    this.overlay = document.getElementById('ui-talent-overlay');
    this.cardsEl = document.getElementById('ui-talent-cards');
    this.confirmBtn = document.getElementById('ui-talent-confirm');
    this.hintEl = this.overlay.querySelector('.ui-talent-hint');
    this.subtitleEl = this.overlay.querySelector('.ui-talent-subtitle');
    this.comboEl = this.overlay.querySelector('.ui-talent-combo');
    this.selectedTalents = [];
    this.onSelect = null;
    this.maxSelection = TALENT_PICK_COUNT;
    this.offerCount = TALENT_OFFER_COUNT;
    this._clickHandler = null;
    this._rerollBtn = null;
    this._confirmTimer = null;  // 确认淡出定时器（destroy 时清理）
    this._revealTimers = new Set();
    this._isRevealing = false;
    this._revealedCount = 0;
    this._rerollClickHandler = () => this._performReroll();

    // 切换周目会重建 TalentSystem；动态按钮不能复用旧实例遗留的闭包监听。
    const staleRerollBtn = document.getElementById('ui-talent-reroll');
    if (staleRerollBtn) staleRerollBtn.remove();

    // Confirm button handler
    this._confirmClickHandler = () => {
      if (this.selectedTalents.length === this.maxSelection && this.onSelect) {
        this._confirmSelection();
      }
    };
    this.confirmBtn.addEventListener('click', this._confirmClickHandler);
  }

  /**
   * 显示天赋选择界面
   * @param {array} talents - 5个天赋对象
   * @param {function} onSelect - 选择回调 (talents) => void，传入选中的2个天赋数组
   * @param {object} [opts] - 可选参数
   * @param {function} [opts.onReroll] - 重新抽取天赋的回调，返回新的天赋数组；不传则不显示刷新按钮
   * @param {number} [opts.rerollCount] - 剩余刷新次数
   */
  show(talents, onSelect, opts = {}) {
    this._clearRevealTimers();
    this.cardsEl.innerHTML = '';
    this.selectedTalents = [];
    this.onSelect = onSelect;
    this.confirmBtn.classList.remove('visible');
    this.confirmBtn.disabled = true;
    this.confirmBtn.textContent = `请选择 ${this.maxSelection} 个天赋`;
    this._onReroll = opts.onReroll || null;
    this._rerollCount = opts.rerollCount || 0;
    this.offerCount = talents.length;
    const reducedMotion = typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const revealLead = TALENT_DEAL_DURATION_MS +
      Math.max(0, talents.length - 1) * TALENT_DEAL_STAGGER_MS +
      TALENT_BACK_HOLD_MS;
    this._isRevealing = !reducedMotion;
    this._revealedCount = reducedMotion ? this.offerCount : 0;
    this.overlay.classList.remove('reveal-complete');

    if (this.subtitleEl) {
      this._readySubtitle =
        `本局获得 ${this.offerCount} 个天赋，选择 ${this.maxSelection} 个组合你的人生底色`;
      this.subtitleEl.textContent = this._isRevealing
        ? '命运正在发牌 · 全部揭晓后即可选择'
        : this._readySubtitle;
    }
    if (this._isRevealing) this._updateRevealProgress();
    else this._updateSelectionSummary();

    // === 里程碑奖励：刷新按钮 ===
    this._updateRerollButton();

    const rarityLabels = { common: '普通', rare: '稀有', legendary: '传说' };
    const specialLabels = SPECIAL_LABELS;

    talents.forEach((talent, _i) => {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = reducedMotion
        ? 'ui-talent-card is-revealed'
        : 'ui-talent-card is-dealing';
      card.setAttribute('data-rarity', talent.rarity);
      card.setAttribute('data-position', `${_i + 1}/${talents.length}`);
      card.setAttribute('data-talent-id', talent.id);
      card.setAttribute('aria-pressed', 'false');
      const baseAriaLabel =
        `第 ${_i + 1} 张，共 ${talents.length} 张；${talent.name}，${rarityLabels[talent.rarity]}天赋`;
      card.dataset.baseAriaLabel = baseAriaLabel;
      card.setAttribute('aria-label', baseAriaLabel);
      const dealDelay = _i * TALENT_DEAL_STAGGER_MS;
      const revealDelay = revealLead + _i * TALENT_REVEAL_STAGGER_MS;
      card.style.setProperty('--talent-deal-delay', `${dealDelay}ms`);
      card.style.setProperty('--talent-deal-duration', `${TALENT_DEAL_DURATION_MS}ms`);
      card.style.setProperty('--talent-reveal-delay', `${revealDelay}ms`);
      card.style.setProperty('--talent-flip-duration', `${TALENT_FLIP_DURATION_MS}ms`);
      if (!reducedMotion) {
        // 翻牌完成前不允许误选，也不让键盘焦点落到尚未揭晓的卡牌上。
        card.disabled = true;
        card.setAttribute('aria-disabled', 'true');
        card.tabIndex = -1;
      }

      // Build effects HTML
      const effectEntries = Object.entries(talent.effects).filter(([_k, v]) => v !== 0);
      let effectsHtml = '';
      for (const [key, val] of effectEntries) {
        const cls = getTalentEffectTone(key, val);
        effectsHtml += `<div class="ui-talent-effect ${cls}">${formatTalentEffect(key, val)}</div>`;
      }

      // Special effect
      let specialHtml = '';
      if (talent.special) {
        specialHtml = `<div class="ui-talent-special">★ ${specialLabels[talent.special] || talent.special}</div>`;
      }

      card.innerHTML = `
        <span class="ui-talent-card-inner">
          <span class="ui-talent-card-face ui-talent-card-back" aria-hidden="true">
            <span class="ui-talent-card-back-sigil">◇</span>
            <span class="ui-talent-card-back-title">人生底色</span>
            <span class="ui-talent-card-back-index">${String(_i + 1).padStart(2, '0')}</span>
          </span>
          <span class="ui-talent-card-face ui-talent-card-front">
            <span class="ui-talent-rarity ${talent.rarity}">${rarityLabels[talent.rarity]}</span>
            <span class="ui-talent-position">${_i + 1}/${talents.length}</span>
            <span class="ui-talent-icon">${talent.icon}</span>
            <span class="ui-talent-name">${talent.name}</span>
            <span class="ui-talent-desc">${talent.desc}</span>
            <span class="ui-talent-effects">${effectsHtml}</span>
            ${specialHtml}
          </span>
        </span>
      `;

      card.addEventListener('click', () => {
        this._toggleTalent(talent, card);
      });

      this.cardsEl.appendChild(card);

      if (!reducedMotion) {
        this._scheduleRevealTask(() => {
          this._revealedCount = Math.max(this._revealedCount, _i + 1);
          if (this._revealedCount >= this.offerCount) {
            this._completeReveal();
          } else {
            this._updateRevealProgress();
          }
        }, revealDelay + TALENT_FLIP_DURATION_MS);
      }
    });

    this.overlay.classList.add('visible');
    if (reducedMotion) {
      this._completeReveal();
    }

    // 音效落在翻牌经过 90° 的瞬间，视觉与听觉共用同一个 stagger 节奏。
    try {
      const audio = this.scene && this.scene.audio;
      if (!reducedMotion && audio && audio.enabled) {
        for (let i = 0; i < talents.length; i++) {
          const delay = revealLead + i * TALENT_REVEAL_STAGGER_MS +
            Math.round(TALENT_FLIP_DURATION_MS * 0.48);
          const isLegendary = talents[i].rarity === 'legendary';
          const isRare = talents[i].rarity === 'rare';
          this._scheduleRevealTask(() => {
            if (audio._playTone) {
              audio._playTone(440 + i * 80, 0.06, 'triangle', 0.07);
            }
          }, delay);
          if (isLegendary) {
            this._scheduleRevealTask(() => {
              if (audio._playTone) {
                audio._playTone(1047, 0.12, 'sine', 0.06);
                audio._playTone(1319, 0.15, 'sine', 0.05);
              }
            }, delay + 90);
          } else if (isRare) {
            this._scheduleRevealTask(() => {
              if (audio._playTone) {
                audio._playTone(880, 0.1, 'sine', 0.05);
              }
            }, delay + 90);
          }
        }
      }
    } catch (e) {}
  }

  _scheduleRevealTask(fn, delay) {
    const timer = setTimeout(() => {
      this._revealTimers.delete(timer);
      if (!this.scene || !this.overlay) return;
      try { fn(); } catch (e) {}
    }, delay);
    this._revealTimers.add(timer);
    return timer;
  }

  _clearRevealTimers() {
    for (const timer of this._revealTimers) clearTimeout(timer);
    this._revealTimers.clear();
  }

  /**
   * 更新/创建刷新按钮（里程碑奖励：额外刷新一次）
   * 仅当存在 onReroll 回调且剩余次数 > 0 时显示
   */
  _updateRerollButton() {
    let btn = this._rerollBtn;
    if (!this._onReroll || this._rerollCount <= 0) {
      if (btn) btn.style.display = 'none';
      return;
    }
    if (!btn) {
      btn = document.createElement('button');
      btn.type = 'button';
      btn.id = 'ui-talent-reroll';
      btn.className = 'ui-talent-confirm';
      this.confirmBtn.parentNode.insertBefore(btn, this.confirmBtn);
      btn.addEventListener('click', this._rerollClickHandler);
      this._rerollBtn = btn;
    }
    btn.style.display = 'inline-block';
    btn.textContent = `↻ 刷新天赋 (${this._rerollCount})`;
    btn.classList.add('visible');
    btn.disabled = this._isRevealing;
    btn.setAttribute(
      'aria-label',
      this._isRevealing
        ? `天赋揭晓完成后可刷新，剩余 ${this._rerollCount} 次`
        : `刷新天赋，剩余 ${this._rerollCount} 次`
    );
  }

  /**
   * 执行刷新：调用 onReroll 回调获取新天赋，然后重新渲染
   */
  _performReroll() {
    if (this._isRevealing || !this._onReroll || this._rerollCount <= 0) return;
    const newTalents = this._onReroll();
    if (!Array.isArray(newTalents)) return;
    this._rerollCount = Math.max(0, this._rerollCount - 1);
    // 复用 show 重新渲染（保留 onSelect 和 onReroll）
    this.show(newTalents, this.onSelect, {
      onReroll: this._onReroll,
      rerollCount: this._rerollCount
    });
  }

  _updateSelectionSummary() {
    const selectedCount = this.selectedTalents.length;
    if (this.hintEl) {
      this.hintEl.innerHTML =
        `本局 ${this.offerCount} 选 ${this.maxSelection} · 已选 <span>${selectedCount}/${this.maxSelection}</span>`;
    }

    if (!this.comboEl) return;
    const combo = getTalentCombination(this.selectedTalents);
    this.comboEl.classList.toggle('visible', selectedCount > 0);
    if (combo) {
      this.comboEl.innerHTML = `<strong>「${combo.title}」</strong><span>${combo.desc}</span>`;
    } else if (selectedCount === 1) {
      this.comboEl.innerHTML =
        `<strong>${this.selectedTalents[0].name}</strong><span>再选择 1 个天赋，完成你的人生组合</span>`;
    } else {
      this.comboEl.textContent = '';
    }
  }

  _updateRevealProgress() {
    this.overlay.setAttribute('aria-busy', 'true');
    this.overlay.dataset.phase = 'revealing';
    if (this.hintEl) {
      this.hintEl.innerHTML =
        `天赋揭晓中 · <span>${this._revealedCount}/${this.offerCount}</span>`;
    }
    this.confirmBtn.disabled = true;
    this.confirmBtn.classList.remove('visible');
    this.confirmBtn.textContent = `请等待天赋揭晓 ${this._revealedCount}/${this.offerCount}`;
    if (this._rerollBtn) this._rerollBtn.disabled = true;
  }

  _completeReveal(cards = null) {
    if (!this.overlay || !this.scene) return;
    const talentCards = cards || [...this.cardsEl.querySelectorAll('.ui-talent-card')];
    for (const card of talentCards) {
      card.disabled = false;
      card.removeAttribute('aria-disabled');
      card.tabIndex = 0;
      card.classList.remove('is-dealing');
      card.classList.add('is-revealed');
    }
    this._isRevealing = false;
    this._revealedCount = this.offerCount;
    this.overlay.setAttribute('aria-busy', 'false');
    this.overlay.dataset.phase = 'choosing';
    this.overlay.classList.add('reveal-complete');
    if (this.subtitleEl && this._readySubtitle) {
      this.subtitleEl.textContent = this._readySubtitle;
    }
    this.confirmBtn.disabled = true;
    this.confirmBtn.textContent = `请选择 ${this.maxSelection} 个天赋`;
    if (this._rerollBtn) {
      this._rerollBtn.disabled = false;
      this._rerollBtn.setAttribute(
        'aria-label',
        `刷新天赋，剩余 ${this._rerollCount} 次`
      );
    }
    this._updateSelectionSummary();
    this._focusFirstAvailableCard();
  }

  _syncSelectedCardState() {
    const cards = [...this.cardsEl.querySelectorAll('.ui-talent-card')];
    for (const card of cards) {
      const front = card.querySelector('.ui-talent-card-front');
      const order = this.selectedTalents.findIndex(
        talent => talent.id === card.dataset.talentId
      );
      const selected = order >= 0;
      card.classList.toggle('selected', selected);
      card.setAttribute('aria-pressed', String(selected));
      if (selected) {
        card.dataset.selectionOrder = String(order + 1);
        if (front) front.dataset.selectionOrder = String(order + 1);
        card.setAttribute(
          'aria-label',
          `${card.dataset.baseAriaLabel}，已选第 ${order + 1} 个`
        );
      } else {
        delete card.dataset.selectionOrder;
        if (front) delete front.dataset.selectionOrder;
        card.setAttribute('aria-label', card.dataset.baseAriaLabel || '');
      }
    }
  }

  _focusFirstAvailableCard() {
    if (!this.overlay?.classList.contains('visible')) return;
    if (this.overlay.contains(document.activeElement)) return;
    const firstCard = this.cardsEl.querySelector('.ui-talent-card:not([disabled])');
    firstCard?.focus({ preventScroll: true });
  }

  _toggleTalent(talent, cardEl) {
    if (this._isRevealing || cardEl.disabled) return;
    const idx = this.selectedTalents.indexOf(talent);
    if (idx >= 0) {
      // Deselect
      this.selectedTalents.splice(idx, 1);
    } else {
      // Select (max 2)
      if (this.selectedTalents.length >= this.maxSelection) {
        cardEl.classList.remove('selection-denied');
        void cardEl.offsetWidth;
        cardEl.classList.add('selection-denied');
        if (this.hintEl) this.hintEl.innerHTML = `最多选择 <span>${this.maxSelection}</span> 个天赋，请先取消一个`;
        return;
      }
      this.selectedTalents.push(talent);
    }
    this._syncSelectedCardState();

    const remaining = this.maxSelection - this.selectedTalents.length;
    const complete = remaining === 0;
    this.confirmBtn.disabled = !complete;
    this.confirmBtn.classList.toggle('visible', complete);
    this.confirmBtn.textContent = complete ? '带着这 2 个天赋出发' : `还需选择 ${remaining} 个`;
    this._updateSelectionSummary();
  }

  _confirmSelection() {
    // Fade out animation
    this.overlay.style.transition = 'opacity 0.5s';
    this.overlay.style.opacity = '0';

    // P1 崩溃防护：timer 存为实例属性，destroy 时清理，
    // 防止场景在 500ms 淡出期间切换后回调操作已销毁对象
    if (this._confirmTimer) clearTimeout(this._confirmTimer);
    this._confirmTimer = setTimeout(() => {
      this._confirmTimer = null;
      // destroy 后 overlay/scene 引用已释放，不再继续
      if (!this.overlay || !this.scene) return;
      this.overlay.classList.remove('visible');
      this.overlay.style.opacity = '';
      this.overlay.style.transition = '';
      if (this.onSelect) {
        // Pass the first selected talent for backward compatibility
        // But also apply both talents
        this.onSelect(this.selectedTalents);
      }
    }, 500);
  }

  hide() {
    this._clearRevealTimers();
    this.overlay.classList.remove('visible');
    this.cardsEl.innerHTML = '';
    this.confirmBtn.classList.remove('visible');
    this.confirmBtn.disabled = true;
    this.confirmBtn.textContent = `请选择 ${this.maxSelection} 个天赋`;
    this.selectedTalents = [];
    this._isRevealing = false;
    this._revealedCount = 0;
    this.overlay.setAttribute('aria-busy', 'false');
    delete this.overlay.dataset.phase;
    this.overlay.classList.remove('reveal-complete');
    if (this.comboEl) {
      this.comboEl.textContent = '';
      this.comboEl.classList.remove('visible');
    }
    if (this._rerollBtn) this._rerollBtn.style.display = 'none';
  }

  /**
   * 销毁资源，防止内存泄漏
   */
  destroy() {
    // 清理确认淡出定时器（P1：防止场景切换后回调操作已销毁对象）
    if (this._confirmTimer) { clearTimeout(this._confirmTimer); this._confirmTimer = null; }
    this._clearRevealTimers();
    if (this._confirmClickHandler) {
      this.confirmBtn.removeEventListener('click', this._confirmClickHandler);
      this._confirmClickHandler = null;
    }
    if (this._rerollBtn) {
      this._rerollBtn.removeEventListener('click', this._rerollClickHandler);
      this._rerollBtn.remove();
      this._rerollBtn = null;
    }
    this.hide();
    this.onSelect = null;
    this._onReroll = null;
    this.scene = null;
  }
}
