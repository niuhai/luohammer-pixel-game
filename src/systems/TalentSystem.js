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
    this.cardsEl.innerHTML = '';
    this.selectedTalents = [];
    this.onSelect = onSelect;
    this.confirmBtn.classList.remove('visible');
    this.confirmBtn.disabled = true;
    this.confirmBtn.textContent = `请选择 ${this.maxSelection} 个天赋`;
    this._onReroll = opts.onReroll || null;
    this._rerollCount = opts.rerollCount || 0;
    this.offerCount = talents.length;

    if (this.subtitleEl) {
      this.subtitleEl.textContent = `本局获得 ${this.offerCount} 个天赋，选择 ${this.maxSelection} 个组合你的人生底色`;
    }
    this._updateSelectionSummary();

    // === 里程碑奖励：刷新按钮 ===
    this._updateRerollButton();

    const rarityLabels = { common: '普通', rare: '稀有', legendary: '传说' };
    const specialLabels = SPECIAL_LABELS;

    talents.forEach((talent, _i) => {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'ui-talent-card';
      card.setAttribute('data-rarity', talent.rarity);
      card.setAttribute('data-position', `${_i + 1}/${talents.length}`);
      card.setAttribute('aria-pressed', 'false');
      card.setAttribute('aria-label', `${talent.name}，${rarityLabels[talent.rarity]}天赋`);
      // R28-T1: stagger 入场——每张卡延迟 100ms 出现，营造抽卡仪式感
      card.style.animationDelay = `${_i * 100}ms`;

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
        <span class="ui-talent-rarity ${talent.rarity}">${rarityLabels[talent.rarity]}</span>
        <span class="ui-talent-position">${_i + 1}/${talents.length}</span>
        <div class="ui-talent-icon">${talent.icon}</div>
        <div class="ui-talent-name">${talent.name}</div>
        <div class="ui-talent-desc">${talent.desc}</div>
        <div class="ui-talent-effects">${effectsHtml}</div>
        ${specialHtml}
      `;

      card.addEventListener('click', () => {
        this._toggleTalent(talent, card);
      });

      this.cardsEl.appendChild(card);
    });

    this.overlay.classList.add('visible');

    // R28-T1: 卡牌出现音效——翻牌声 + 稀有度差异化提示音
    // 复用 AudioSystem.playTalentSelect 的三角波音色，但节奏更短促模拟"翻牌"
    // 传说天赋：额外的金光闪耀音（复用 playAchievementLegendary 的和弦）
    try {
      const audio = this.scene && this.scene.audio;
      if (audio && audio.enabled) {
        // 翻牌声：每张卡 80ms 间隔的短促三角波
        for (let i = 0; i < talents.length; i++) {
          const delay = i * 100;
          const isLegendary = talents[i].rarity === 'legendary';
          const isRare = talents[i].rarity === 'rare';
          if (audio._scheduleSfx) {
            audio._scheduleSfx(() => {
              audio._playTone(440 + i * 80, 0.06, 'triangle', 0.07);
            }, delay);
            // 稀有度差异化：传说/稀有多一个高音点缀
            if (isLegendary) {
              audio._scheduleSfx(() => {
                audio._playTone(1047, 0.12, 'sine', 0.06);
                audio._playTone(1319, 0.15, 'sine', 0.05);
              }, delay + 80);
            } else if (isRare) {
              audio._scheduleSfx(() => {
                audio._playTone(880, 0.1, 'sine', 0.05);
              }, delay + 80);
            }
          }
        }
      }
    } catch (e) {}
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
  }

  /**
   * 执行刷新：调用 onReroll 回调获取新天赋，然后重新渲染
   */
  _performReroll() {
    if (!this._onReroll || this._rerollCount <= 0) return;
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

  _toggleTalent(talent, cardEl) {
    const idx = this.selectedTalents.indexOf(talent);
    if (idx >= 0) {
      // Deselect
      this.selectedTalents.splice(idx, 1);
      cardEl.classList.remove('selected');
      cardEl.setAttribute('aria-pressed', 'false');
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
      cardEl.classList.add('selected');
      cardEl.setAttribute('aria-pressed', 'true');
    }

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
    this.overlay.classList.remove('visible');
    this.cardsEl.innerHTML = '';
    this.confirmBtn.classList.remove('visible');
    this.confirmBtn.disabled = true;
    this.confirmBtn.textContent = `请选择 ${this.maxSelection} 个天赋`;
    this.selectedTalents = [];
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
