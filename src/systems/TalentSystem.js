/**
 * 天赋抽取系统
 *
 * 开局时随机抽取5个天赋，玩家5选2
 * UI：5张天赋卡片，点击选择2个后确认
 * 桌面端 hover / 移动端长按可预览天赋详细效果（tooltip）
 */

/** 天赋特殊效果 key → 中文文案（卡片与 tooltip 共用；新增天赋 special 时必须同步补充，否则玩家会看到英文 key） */
export const SPECIAL_LABELS = {
  random_events_bias_positive: '随机事件更偏向好结果',
  failure_heals_pride: '每次跌倒让理想主义更坚定',
  fans_loyalty_bonus: '公众信任和名声双倍增长',
  low_stats_bonus: '劣势状态下获得额外加成',
  debt_reduction_bonus: '还债效率提升',
  pressure_never_max: '压力永远不会爆表',
  stage_events_bonus: '舞台表现事件奖励加倍',
  product_events_bonus: '产品相关事件奖励加倍',
  reality_distortion_field: '现实扭曲力场：极低概率的选择反而更稳',
  high_risk_high_reward: '高风险选择收益翻倍，代价也翻倍',
  late_game_bonus: '后半生阶段属性加成额外+1',
  reputation_gain_doubled: '名声增长翻倍',
  pressure_recovery: '每个阶段结束自动降低2点压力',
  failure_wealth_bonus: '每次失败后获得额外财富加成',
  trust_gain_bonus: '公众信任增长额外+1',
  replay_bonus: '多周目游戏初始属性额外+1',
  all_choices_bonus: '所有选项的正面效果+1',
  titan_heart_effect: '压力越高，理想主义加成越大',
  pressure_crash_halved: '压力崩溃时属性损失减半',
  pressure_gain_halved: '压力增长减半',
  trust_check_bonus: '信任≥5时检定自动加成',
  achievement_hunter_bonus: '解锁成就越多，属性加成越强'
};

export class TalentSystem {
  constructor(scene) {
    this.scene = scene;
    this.overlay = document.getElementById('ui-talent-overlay');
    this.cardsEl = document.getElementById('ui-talent-cards');
    this.confirmBtn = document.getElementById('ui-talent-confirm');
    this.hintEl = this.overlay.querySelector('.ui-talent-hint');
    this.selectedTalents = [];
    this.onSelect = null;
    this.maxSelection = 2;
    this._clickHandler = null;

    // 单例 tooltip 元素：避免每张卡片都创建一个
    this._tooltipEl = null;
    this._longPressTimer = null;
    this._longPressActive = false;

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
    this._onReroll = opts.onReroll || null;
    this._rerollCount = opts.rerollCount || 0;

    // 更新提示文字
    if (this.hintEl) {
      this.hintEl.innerHTML = `选择 <span>${this.maxSelection}</span> 个天赋开始游戏`;
    }

    // === 里程碑奖励：刷新按钮 ===
    this._updateRerollButton();

    const rarityLabels = { common: '普通', rare: '稀有', legendary: '传说' };
    const attrNames = {
      pride: '理想主义', wealth: '财富', reputation: '名声',
      pressure: '压力', trust: '公众信任', pressureMax: '压力上限',
      failurePenalty: '翻车惩罚', successBonus: '成功奖励'
    };
    const specialLabels = SPECIAL_LABELS;

    talents.forEach((talent, _i) => {
      const card = document.createElement('div');
      card.className = 'ui-talent-card';
      card.setAttribute('data-rarity', talent.rarity);

      // Build effects HTML
      const effectEntries = Object.entries(talent.effects).filter(([_k, v]) => v !== 0);
      let effectsHtml = '';
      for (const [key, val] of effectEntries) {
        const sign = val > 0 ? '+' : '';
        const cls = val > 0 ? 'positive' : 'negative';
        effectsHtml += `<div class="ui-talent-effect ${cls}">${attrNames[key] || key}${sign}${val}</div>`;
      }

      // Special effect
      let specialHtml = '';
      if (talent.special) {
        specialHtml = `<div class="ui-talent-special">★ ${specialLabels[talent.special] || talent.special}</div>`;
      }

      card.innerHTML = `
        <span class="ui-talent-rarity ${talent.rarity}">${rarityLabels[talent.rarity]}</span>
        <div class="ui-talent-icon">${talent.icon}</div>
        <div class="ui-talent-name">${talent.name}</div>
        <div class="ui-talent-desc">${talent.desc}</div>
        <div class="ui-talent-effects">${effectsHtml}</div>
        ${specialHtml}
      `;

      card.addEventListener('click', () => {
        this._toggleTalent(talent, card);
      });

      // 悬停 / 长按预览
      this._attachPreviewEvents(card, talent);

      this.cardsEl.appendChild(card);
    });

    this.overlay.classList.add('visible');
  }

  /**
   * 更新/创建刷新按钮（里程碑奖励：额外刷新一次）
   * 仅当存在 onReroll 回调且剩余次数 > 0 时显示
   */
  _updateRerollButton() {
    let btn = document.getElementById('ui-talent-reroll');
    if (!this._onReroll || this._rerollCount <= 0) {
      if (btn) btn.style.display = 'none';
      return;
    }
    if (!btn) {
      btn = document.createElement('button');
      btn.id = 'ui-talent-reroll';
      btn.className = 'ui-talent-confirm';
      btn.style.marginRight = '10px';
      btn.style.borderColor = 'var(--color-trust)';
      btn.style.color = 'var(--color-trust)';
      this.confirmBtn.parentNode.insertBefore(btn, this.confirmBtn);
      btn.addEventListener('click', () => this._performReroll());
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

  /**
   * 为天赋卡片附加预览事件：桌面端 hover 显示，移动端长按显示
   */
  _attachPreviewEvents(card, talent) {
    // 桌面端：hover 显示/隐藏
    card.addEventListener('mouseenter', () => this._showTooltip(talent, card));
    card.addEventListener('mouseleave', () => this._hideTooltip());

    // 移动端：长按 500ms 显示
    const onTouchStart = (_e) => {
      this._longPressActive = false;
      this._longPressTimer = setTimeout(() => {
        this._longPressActive = true;
        this._showTooltip(talent, card);
      }, 500);
    };
    const onTouchEnd = () => {
      if (this._longPressTimer) {
        clearTimeout(this._longPressTimer);
        this._longPressTimer = null;
      }
      if (this._longPressActive) {
        this._hideTooltip();
        // 阻止长按后的 click 触发选择
        this._longPressActive = false;
      }
    };
    const onTouchMove = () => {
      if (this._longPressTimer) {
        clearTimeout(this._longPressTimer);
        this._longPressTimer = null;
      }
      this._hideTooltip();
    };

    card.addEventListener('touchstart', onTouchStart, { passive: true });
    card.addEventListener('touchend', onTouchEnd);
    card.addEventListener('touchmove', onTouchMove, { passive: true });

    // 长按期间阻止 click 事件触发选择
    card.addEventListener('click', (e) => {
      if (this._longPressActive) {
        e.preventDefault();
        e.stopPropagation();
        this._longPressActive = false;
      }
    }, true);
  }

  /**
   * 显示天赋预览 tooltip
   */
  _showTooltip(talent, anchorEl) {
    this._hideTooltip();

    const tooltip = document.createElement('div');
    tooltip.className = 'ui-talent-tooltip';
    tooltip.setAttribute('data-rarity', talent.rarity);

    const rarityLabels = { common: '普通', rare: '稀有', legendary: '传说' };
    const attrNames = {
      pride: '理想主义', wealth: '财富', reputation: '名声',
      pressure: '压力', trust: '公众信任', pressureMax: '压力上限',
      failurePenalty: '翻车惩罚', successBonus: '成功奖励'
    };
    const specialLabels = SPECIAL_LABELS;

    // 效果描述：拼成一句话，如 "初始理想+2，财富+1"
    const effectEntries = Object.entries(talent.effects).filter(([_k, v]) => v !== 0);
    const effectParts = effectEntries.map(([key, val]) => {
      const sign = val > 0 ? '+' : '';
      return `${attrNames[key] || key}${sign}${val}`;
    });
    const effectDesc = effectParts.length > 0 ? effectParts.join('，') : '无属性加成';

    // 特殊能力描述
    const specialDesc = talent.special ? (specialLabels[talent.special] || talent.special) : '';

    tooltip.innerHTML = `
      <div class="ui-talent-tooltip-header">
        <span class="ui-talent-tooltip-icon">${talent.icon}</span>
        <span class="ui-talent-tooltip-name">${talent.name}</span>
      </div>
      <div class="ui-talent-tooltip-rarity ${talent.rarity}">${rarityLabels[talent.rarity] || talent.rarity}</div>
      <div class="ui-talent-tooltip-desc">${talent.desc}</div>
      <div class="ui-talent-tooltip-effects">${effectDesc}</div>
      ${specialDesc ? `<div class="ui-talent-tooltip-special">★ ${specialDesc}</div>` : ''}
    `;

    this.overlay.appendChild(tooltip);
    this._tooltipEl = tooltip;

    // 定位：基于锚点元素的位置
    this._positionTooltip(tooltip, anchorEl);

    // 触发淡入动画
    requestAnimationFrame(() => {
      tooltip.classList.add('visible');
    });
  }

  /**
   * 定位 tooltip：优先显示在卡片上方，空间不足时显示在下方
   */
  _positionTooltip(tooltip, anchorEl) {
    const anchorRect = anchorEl.getBoundingClientRect();
    const overlayRect = this.overlay.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();

    // 相对于 overlay 的坐标
    const relLeft = anchorRect.left - overlayRect.left;
    const relTop = anchorRect.top - overlayRect.top;

    // 水平居中对齐卡片
    let left = relLeft + (anchorRect.width - tooltipRect.width) / 2;
    // 边界钳制
    left = Math.max(8, Math.min(left, overlayRect.width - tooltipRect.width - 8));

    // 垂直：优先上方，空间不足则下方
    let top;
    const spaceAbove = relTop;
    const spaceBelow = overlayRect.height - (relTop + anchorRect.height);
    if (spaceAbove > tooltipRect.height + 12) {
      top = relTop - tooltipRect.height - 8;
    } else if (spaceBelow > tooltipRect.height + 12) {
      top = relTop + anchorRect.height + 8;
    } else {
      // 都不够，贴顶部
      top = Math.max(8, relTop);
    }

    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
  }

  /**
   * 隐藏 tooltip
   */
  _hideTooltip() {
    if (this._tooltipEl) {
      const el = this._tooltipEl;
      el.classList.remove('visible');
      // 等淡出动画结束后移除
      setTimeout(() => {
        if (el.parentNode) el.parentNode.removeChild(el);
      }, 200);
      this._tooltipEl = null;
    }
    if (this._longPressTimer) {
      clearTimeout(this._longPressTimer);
      this._longPressTimer = null;
    }
  }

  _toggleTalent(talent, cardEl) {
    const idx = this.selectedTalents.indexOf(talent);
    if (idx >= 0) {
      // Deselect
      this.selectedTalents.splice(idx, 1);
      cardEl.classList.remove('selected');
    } else {
      // Select (max 2)
      if (this.selectedTalents.length >= this.maxSelection) return;
      this.selectedTalents.push(talent);
      cardEl.classList.add('selected');
    }

    // Show/hide confirm button
    if (this.selectedTalents.length === this.maxSelection) {
      this.confirmBtn.classList.add('visible');
    } else {
      this.confirmBtn.classList.remove('visible');
    }

    // 更新提示文字
    if (this.hintEl) {
      const remaining = this.maxSelection - this.selectedTalents.length;
      if (remaining > 0) {
        this.hintEl.innerHTML = `还需选择 <span>${remaining}</span> 个天赋`;
      } else {
        this.hintEl.innerHTML = `已选择 <span>${this.maxSelection}</span> 个天赋，点击确认`;
      }
    }
  }

  _confirmSelection() {
    // Fade out animation
    this.overlay.style.transition = 'opacity 0.5s';
    this.overlay.style.opacity = '0';

    setTimeout(() => {
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
    this._hideTooltip();
    this.overlay.classList.remove('visible');
    this.cardsEl.innerHTML = '';
    this.confirmBtn.classList.remove('visible');
    this.selectedTalents = [];
  }

  /**
   * 销毁资源，防止内存泄漏
   */
  destroy() {
    if (this._confirmClickHandler) {
      this.confirmBtn.removeEventListener('click', this._confirmClickHandler);
      this._confirmClickHandler = null;
    }
    this._hideTooltip();
    this.hide();
    this.onSelect = null;
    this.scene = null;
  }
}
