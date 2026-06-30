export class StatsSystem {
  constructor(scene) {
    this.scene = scene;
    this.el = document.getElementById('ui-stats');
    this.bars = {};
    this.showHidden = false;

    // 清空旧内容，避免场景切换后属性条重复堆叠
    if (this.el) this.el.innerHTML = '';

    // 可见属性 — 每项独立配色 + 渐变填充
    const stats = [
      { key: 'pride',       label: '理想', icon: '◆', color: '#f0c040', gradient: 'linear-gradient(90deg, #c49a2a, #f0c040)', tooltip: '理想主义：你的信念和坚持，越高越不容易妥协' },
      { key: 'wealth',      label: '财富', icon: '¥', color: '#40c060', gradient: 'linear-gradient(90deg, #2a8a4a, #40c060)', tooltip: '财富：经济实力，影响商业决策的底气' },
      { key: 'reputation',  label: '名声', icon: '★', color: '#4090e0', gradient: 'linear-gradient(90deg, #2070b0, #4090e0)', tooltip: '名声：社会影响力，公众对你的认知度' },
      { key: 'failures',    label: '翻车', icon: '✕', color: '#e04040', gradient: 'linear-gradient(90deg, #b03030, #e04040)', tooltip: '翻车：失败次数，越多越容易触发负面事件' }
    ];

    // 隐藏属性
    this.hiddenStats = [
      { key: 'pressure', label: '压力', icon: '◈', color: '#8040C0', gradient: 'linear-gradient(90deg, #6030a0, #8040c0)', tooltip: '压力：心理负担，过高会触发崩溃事件' },
      { key: 'trust',    label: '信任', icon: '◇', color: '#40C0C0', gradient: 'linear-gradient(90deg, #30a0a0, #40c0c0)', tooltip: '公众信任：社会对你的信赖程度' }
    ];

    // Build DOM for visible stats
    stats.forEach((stat) => {
      this._createBar(stat, false);
    });

    // Build DOM for hidden stats
    this.hiddenBars = {};
    this.hiddenStats.forEach((stat) => {
      this._createBar(stat, true);
    });

    // Toggle hint
    this._toggleHint = document.createElement('div');
    this._toggleHint.className = 'ui-stats-toggle-hint';
    this._toggleHint.textContent = '点击展开隐藏属性';
    this.el.appendChild(this._toggleHint);

    // Toggle hidden stats on click
    this.el.addEventListener('click', () => {
      this.showHidden = !this.showHidden;
      this._updateHiddenVisibility();
      this._toggleHint.textContent = this.showHidden ? '点击收起隐藏属性' : '点击展开隐藏属性';
    });
  }

  _createBar(stat, hidden = false) {
    const item = document.createElement('div');
    item.className = 'ui-stat-item';
    item.dataset.stat = stat.key;
    if (hidden) item.style.display = 'none';

    item.innerHTML = `
      <span class="ui-stat-icon" style="color: ${stat.color};">${stat.icon || ''}</span>
      <span class="ui-stat-label">${stat.label}</span>
      <div class="ui-stat-bar-bg">
        <div class="ui-stat-bar-fill" style="width: 0%; background: ${stat.gradient || stat.color};"></div>
      </div>
      <span class="ui-stat-value">0</span>
      <span class="ui-stat-change"></span>
      <div class="ui-stat-tooltip">${stat.tooltip}</div>
    `;

    this.el.appendChild(item);

    const fillEl = item.querySelector('.ui-stat-bar-fill');
    const valueEl = item.querySelector('.ui-stat-value');
    const changeEl = item.querySelector('.ui-stat-change');

    const barData = {
      fillEl: fillEl,
      valueEl: valueEl,
      changeEl: changeEl,
      itemEl: item,
      color: stat.color,
      gradient: stat.gradient || stat.color,
      isFailures: stat.key === 'failures',
      hidden: hidden,
      prevValue: 0
    };

    if (hidden) {
      this.hiddenBars[stat.key] = barData;
    } else {
      this.bars[stat.key] = barData;
    }
  }

  _updateHiddenVisibility() {
    for (const key of Object.keys(this.hiddenBars)) {
      const bar = this.hiddenBars[key];
      bar.itemEl.style.display = this.showHidden ? 'flex' : 'none';
    }
  }

  update(state) {
    // Update visible stats
    this._updateBars(this.bars, state);

    // Update hidden stats
    this._updateBars(this.hiddenBars, state);

    // Auto-show triggered hidden stats
    if (!this.showHidden) {
      for (const key of Object.keys(this.hiddenBars)) {
        const val = state[key];
        const defaultVal = key === 'pressure' ? 0 : 5;
        if (val !== undefined && val !== defaultVal) {
          const bar = this.hiddenBars[key];
          bar.itemEl.style.display = 'flex';
        }
      }
    }

    // Show the stats container
    this.el.classList.add('visible');

    // 首次显示属性面板时，展示引导气泡
    this._showFirstTimeHint();
  }

  /**
   * 首次进入游戏时，在属性面板旁显示一次性引导气泡
   */
  _showFirstTimeHint() {
    if (this._hintShown) return;
    try {
      if (localStorage.getItem('luohammer_stats_hint_seen')) {
        this._hintShown = true;
        return;
      }
    } catch (e) { this._hintShown = true; return; }

    this._hintShown = true;
    try { localStorage.setItem('luohammer_stats_hint_seen', '1'); } catch (e) {}

    // 创建引导气泡
    const hint = document.createElement('div');
    hint.className = 'ui-stats-hint-bubble';
    hint.innerHTML = '► 点击属性面板可展开<b>隐藏属性</b>，悬停可查看<b>属性说明</b>';
    this.el.appendChild(hint);

    // 3.5秒后自动消失，或点击属性面板时消失
    const removeHint = () => {
      if (hint.parentNode) {
        hint.classList.add('fading');
        setTimeout(() => { if (hint.parentNode) hint.parentNode.removeChild(hint); }, 400);
      }
    };
    setTimeout(removeHint, 3500);
    this.el.addEventListener('click', removeHint, { once: true });
  }

  _updateBars(bars, state) {
    Object.keys(bars).forEach(key => {
      const bar = bars[key];
      if (!bar || !bar.fillEl) return;

      const val = state[key] || 0;
      let targetPercent;

      if (bar.isFailures) {
        targetPercent = Math.min(val * 10, 100);
      } else {
        const clamped = Math.max(0, Math.min(10, val));
        targetPercent = clamped * 10;
      }

      bar.valueEl.textContent = String(val);

      // 使用属性自身渐变色；仅当非翻车属性极低(≤2)时闪红警告
      let bg = bar.gradient || bar.color;
      if (!bar.isFailures) {
        const clamped = Math.max(0, Math.min(10, val));
        if (clamped <= 2) bg = 'linear-gradient(90deg, #a02020, #e04040)';
      }

      bar.fillEl.style.width = targetPercent + '%';
      bar.fillEl.style.background = bg;

      // 压力值满值警告：压力 ≥ 9 时给属性条添加 critical class
      if (key === 'pressure' && val >= 9) {
        bar.itemEl.classList.add('critical');
      } else {
        bar.itemEl.classList.remove('critical');
      }

      // 数值变化时触发绿色/红色脉冲闪烁 + 浮动变化提示 + 数值弹跳
      if (bar.prevValue !== undefined && val !== bar.prevValue) {
        const fillEl = bar.fillEl;
        fillEl.classList.remove('pulse-up', 'pulse-down');
        // 强制重绘以允许同一方向连续触发动画
        void fillEl.offsetWidth;
        const direction = val > bar.prevValue ? 'pulse-up' : 'pulse-down';
        fillEl.classList.add(direction);
        const onAnimationEnd = () => {
          fillEl.classList.remove(direction);
          fillEl.removeEventListener('animationend', onAnimationEnd);
        };
        fillEl.addEventListener('animationend', onAnimationEnd);

        // 数值弹跳动画
        if (bar.valueEl) {
          bar.valueEl.classList.remove('bounce');
          void bar.valueEl.offsetWidth;
          bar.valueEl.classList.add('bounce');
          const onBounceEnd = () => {
            bar.valueEl.classList.remove('bounce');
            bar.valueEl.removeEventListener('animationend', onBounceEnd);
          };
          bar.valueEl.addEventListener('animationend', onBounceEnd);
        }

        if (bar.changeEl) {
          const delta = val - bar.prevValue;
          const sign = delta > 0 ? '+' : '';
          bar.changeEl.textContent = `${sign}${delta}`;
          bar.changeEl.classList.remove('show', 'up', 'down');
          void bar.changeEl.offsetWidth;
          bar.changeEl.classList.add('show', delta > 0 ? 'up' : 'down');
          const onChangeEnd = () => {
            bar.changeEl.classList.remove('show', 'up', 'down');
            bar.changeEl.removeEventListener('animationend', onChangeEnd);
          };
          bar.changeEl.addEventListener('animationend', onChangeEnd);
        }
      }

      bar.prevValue = val;
    });
  }
}
