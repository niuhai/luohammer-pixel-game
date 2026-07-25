/**
 * 天赋抽取系统
 *
 * 开局时随机抽取5个天赋，玩家5选2
 * UI：5张语义化天赋卡片，点击选择2个后确认
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
  achievement_hunter_bonus: '每解锁一个成就，当前最低基础属性 +1（每局最多5次）'
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
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'ui-talent-card';
      card.setAttribute('data-rarity', talent.rarity);
      card.setAttribute('aria-pressed', 'false');
      card.setAttribute('aria-label', `${talent.name}，${rarityLabels[talent.rarity]}天赋`);
      // R28-T1: stagger 入场——每张卡延迟 100ms 出现，营造抽卡仪式感
      card.style.animationDelay = `${_i * 100}ms`;

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

    // 更新提示文字
    if (this.hintEl) {
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
