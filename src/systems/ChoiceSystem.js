import {
  buildChoiceAlignmentInsight,
  buildCheckOutcomePreview,
  buildCheckSnapshot,
  DECISION_STAT_LABELS,
  describeDecisionEffects,
  escapeDecisionText
} from '../ui/DecisionPresentation.js';

export class ChoiceSystem {
  constructor(scene) {
    this.scene = scene;
    this.el = document.getElementById('ui-choices');
    this.choices = [];
    this._keyHandler = null;
    this._orientationHandler = null;
    this._resizeHandler = null;
    this._leaveTimer = null;
    this._transientTimers = new Set();
    this._activePreview = null;
    this._previewTimer = null;
    this._safetyFallbackChoice = null;
    // R45: 容器滚动时更新"还有更多选项"吸底提示（元素静态存在于 index.html，监听一次即可）
    this._onChoicesScroll = () => this._updateScrollHint();
    if (this.el) this.el.addEventListener('scroll', this._onChoicesScroll, { passive: true });
  }

  /**
   * 属性中文名映射，用于门槛提示
   */
  static STAT_LABELS = DECISION_STAT_LABELS;

  /**
   * Flag 中文名映射，用于门槛提示
   */
  static FLAG_LABELS = {
    honest_repay: '诚实还债', declared_bankruptcy: '破产清算',
    dropout: '退学', persist_premium: '坚持高端',
    killed_m1: '砍掉M1', never_compromised: '永不妥协',
    conservative_funding: '保守融资', became_investor: '成为投资人',
    gave_up_hardware: '放弃硬件', bookworm: '书虫',
    fighter: '斗士', corrupt: '收红包',
    influencer: '网红', stayed_xinfang: '留新东方',
    education_reform: '教育改革', all_in: '孤注一掷',
    sued_big_tech: '告大厂', public_feud: '公开互怼',
    joined_xiaomi: '加入小米', started_business: '创业',
    sold_out: '接烂广告', banned_fight: '维权封号',
    wrote_book: '出书', became_influencer: '超级网红',
    continued_livestream: '继续直播', retired: '退网',
    mentor: '创业导师', sold_name: '卖名字',
    ai_believer: 'AI信徒', comeback_attempt: '再战一次',
    final_comeback: '最终回归', honest_repay_dark: '暗夜还债',
    born_proud_triggered: '天生骄傲', peoples_luo_triggered: '人民信任',
    penniless_triggered: '身无分文', deadbeat_triggered: '老赖',
    famous_triggered: '众望所归', realist_triggered: '现实主义',
    indomitable_triggered: '百折不挠',
  };

  /**
   * 统一判断选项是否被锁定（UI渲染和键盘快捷键共用）
   * @param {object} choice - 选项对象
   * @param {object} state - 游戏状态
   * @returns {{ locked: boolean, hint: string }}
   */
  _checkLock(choice, state) {
    const unmet = [];

    // 1. 属性下限检查 (requires)
    if (choice.requires) {
      for (const [key, min] of Object.entries(choice.requires)) {
        if ((state[key] || 0) < min) {
          unmet.push(`${ChoiceSystem.STAT_LABELS[key] || key}≥${min}`);
        }
      }
    }

    // 2. 属性上限检查 (maxAttr)
    if (choice.maxAttr) {
      for (const [key, max] of Object.entries(choice.maxAttr)) {
        if ((state[key] || 0) > max) {
          unmet.push(`${ChoiceSystem.STAT_LABELS[key] || key}≤${max}`);
        }
      }
    }

    // 3. Flag 条件检查 (requiresFlags)
    if (choice.requiresFlags) {
      const flags = state.flags || new Set();
      for (const f of choice.requiresFlags) {
        if (!flags.has(f)) {
          unmet.push(`需要「${ChoiceSystem.FLAG_LABELS[f] || f}」`);
        }
      }
    }

    return { locked: unmet.length > 0, hint: unmet.length > 0 ? `需要 ${unmet.join(' 且 ')}` : '' };
  }

  /**
   * 同一局支线防重复：当目标节点已经历，且当前仍有一个条件满足的未经历出口时，
   * 将旧支线标记为已完成。这样既允许玩家探索支线，也不会在返回枢纽后无限刷属性。
   */
  _checkRevisitLock(choice, state, allChoices) {
    if (choice.allowRepeat || !choice.next || !Array.isArray(state.history)) {
      return { locked: false, hint: '' };
    }

    const visitedNodes = new Set(state.history.map(item => item && item.nodeId).filter(Boolean));
    if (!visitedNodes.has(choice.next)) return { locked: false, hint: '' };

    const hasAvailableUnvisitedExit = allChoices.some((candidate) => {
      if (candidate === choice || candidate.allowRepeat || !candidate.next) return false;
      if (visitedNodes.has(candidate.next)) return false;
      return !this._checkLock(candidate, state).locked;
    });

    return hasAvailableUnvisitedExit
      ? { locked: true, hint: '这段经历已完成，请探索新的选择' }
      : { locked: false, hint: '' };
  }

  _getChoiceLock(choice, state, allChoices) {
    const conditionLock = this._checkLock(choice, state);
    if (conditionLock.locked) return conditionLock;
    return this._checkRevisitLock(choice, state, allChoices);
  }

  /**
   * 构建检定提示 HTML（选项有 check 字段时显示）
   * @param {object} choice - 选项对象
   * @param {object} state - 游戏状态
   * @returns {string} 提示 HTML，无检定时返回空字符串
   */
  _buildCheckHint(choice, state) {
    if (!choice.check) return '';
    const check = choice.check;
    const snapshot = buildCheckSnapshot(check, state);
    const readiness = snapshot.passed
      ? '<span class="choice-check-status ready">已满足</span>'
      : `<span class="choice-check-status short">还差 ${snapshot.gap}</span>`;
    const bonus = snapshot.bonus > 0
      ? `<span class="choice-check-bonus">基础 ${snapshot.rawValue} + 加成 ${snapshot.bonus}</span>`
      : '';
    let detail = `
      <span class="choice-check-line">
        <span class="choice-check-label">◊ ${escapeDecisionText(snapshot.attrLabel)}检定</span>
        <span class="choice-check-equation">${snapshot.value} / ${snapshot.target}</span>
        ${readiness}
      </span>
      ${bonus}
    `;

    // 读心术技能：确定性检定不再伪造概率，改为揭示两条真实结果路径。
    if (state._showCheckInfo) {
      const preview = buildCheckOutcomePreview(check);
      const success = preview.success || '推进剧情';
      const fail = preview.fail || '进入另一条剧情';
      detail += `
        <span class="choice-check-preview">
          <span class="success">成功 ${escapeDecisionText(success)}</span>
          <span class="fail">失败 ${escapeDecisionText(fail)}</span>
        </span>
      `;
    }

    return `<span class="choice-check-hint">${detail}</span>`;
  }

  /**
   * 把先见之明呈现为独立的即时影响芯片，不与选项标题或命运方向混排。
   */
  _buildEffectPreviewPresentation(choice) {
    const effects = describeDecisionEffects(choice.effects);
    if (effects.length === 0) return '';
    const tokens = effects.map(effect => `
      <span class="choice-effect-token effect-${escapeDecisionText(effect.tone)}"
        data-tone="${escapeDecisionText(effect.tone)}">${escapeDecisionText(effect.text)}</span>
    `).join('');
    const summary = effects.map(effect => effect.text).join('，');
    return `
      <span class="choice-auto-preview" role="note"
        aria-label="先见之明，即时影响：${escapeDecisionText(summary)}">
        <span class="choice-effect-source">◇ 先见之明</span>
        <span class="choice-effect-scope">即时影响</span>
        <span class="choice-effect-tokens">${tokens}</span>
      </span>
    `;
  }

  /**
   * 把跨周目技能选项表达为“来源—动作—路线—得失”，而不是混在普通文案中。
   */
  _buildTalentChoicePresentation(choice) {
    const talent = choice?.talentChoice;
    if (!talent) return '';
    const name = escapeDecisionText(talent.name || '技能选项');
    const kind = escapeDecisionText(talent.kind || '特殊路径');
    const title = escapeDecisionText(choice.label || '使用技能');
    const route = escapeDecisionText(talent.route || '沿安全路线继续');
    const benefit = escapeDecisionText(talent.benefit || '');
    const tradeoff = escapeDecisionText(talent.tradeoff || '');
    return `
      <span class="choice-talent-header">
        <span class="choice-talent-badge">◈ ${name}</span>
        <span class="choice-talent-kind">${kind}</span>
      </span>
      <span class="choice-talent-title">${title}</span>
      <span class="choice-talent-route">${route}</span>
      <span class="choice-talent-impact">
        ${benefit ? `<span class="choice-talent-benefit">${benefit}</span>` : ''}
        ${tradeoff ? `<span class="choice-talent-tradeoff">${tradeoff}</span>` : ''}
      </span>
    `;
  }

  _buildAlignmentPresentation(choice) {
    const insight = buildChoiceAlignmentInsight(choice);
    const type = escapeDecisionText(insight.type);
    const label = escapeDecisionText(insight.label);
    const basis = escapeDecisionText(insight.basis);
    const scope = escapeDecisionText(insight.scope);
    return `
      <span class="choice-alignment alignment-${type}"
        aria-label="命运之眼：${label}。${basis}。${scope}">
        <span class="choice-alignment-source">◉ 命运之眼</span>
        <span class="choice-alignment-verdict">${label}</span>
        <span class="choice-alignment-basis">${basis}</span>
        <span class="choice-alignment-scope">${scope}</span>
      </span>
    `;
  }

  show(choices, onChoice) {
    if (this._leaveTimer) {
      clearTimeout(this._leaveTimer);
      this._leaveTimer = null;
    }
    this._clearTransientInteractions();
    this.el.classList.remove('leaving');
    this.el.innerHTML = '';
    this.choices = choices;
    this._choiceLock = false;
    const state = this.scene.state || {};
    const lockStates = choices.map(choice => this._getChoiceLock(choice, state, choices));
    const authoredEnabledCount = lockStates.filter(result => !result.locked).length;
    const fallbackIndex = authoredEnabledCount === 0
      ? choices.findIndex(choice => choice?.next || choice?.check?.successNext || choice?.check?.failNext)
      : -1;
    this._safetyFallbackChoice = fallbackIndex >= 0 ? choices[fallbackIndex] : null;
    const enabledCount = authoredEnabledCount || (fallbackIndex >= 0 ? 1 : 0);
    const isTouch = window.matchMedia('(pointer: coarse)').matches ||
      navigator.maxTouchPoints > 0;

    // 把“剧情阅读”切换为“轮到玩家行动”明确说出来，避免视线从底部对话框
    // 跳到选项时失去上下文；同一行也承担键盘/触控操作说明。
    const context = document.createElement('div');
    context.className = 'ui-choice-context';
    context.setAttribute('role', 'status');
    context.setAttribute('aria-live', 'polite');
    context.innerHTML = `
      <span class="ui-choice-context-main" id="ui-choice-context-title">
        <span aria-hidden="true">◆</span> 做出你的选择
      </span>
      <span class="ui-choice-context-meta" id="ui-choice-context-meta"></span>
    `;
    context.querySelector('.ui-choice-context-meta').textContent = isTouch
      ? `${enabledCount} 个可选方向 · 轻触选择，长按预览影响`
      : `${enabledCount} 个可选方向 · ↑↓ 切换 · Enter 确认 · 数字键 1–${Math.min(choices.length, 9)}`;
    this.el.appendChild(context);
    this.el.setAttribute('role', 'group');
    this.el.setAttribute('aria-labelledby', 'ui-choice-context-title');
    this.el.setAttribute('aria-label', `剧情选择，共 ${choices.length} 项，${enabledCount} 项可选`);

    // 任务1：创建天平元素（选择天平动画）
    const balance = document.createElement('div');
    balance.className = 'choice-balance';
    balance.id = 'choice-balance';
    balance.innerHTML = `
      <svg viewBox="0 0 200 60" xmlns="http://www.w3.org/2000/svg">
        <line x1="100" y1="10" x2="100" y2="50" stroke="#666" stroke-width="2"/>
        <line x1="40" y1="20" x2="160" y2="20" stroke="var(--color-gold)" stroke-width="2" class="balance-beam"/>
        <circle cx="40" cy="20" r="6" fill="#444" class="balance-left"/>
        <circle cx="160" cy="20" r="6" fill="#444" class="balance-right"/>
      </svg>
    `;
    this.el.appendChild(balance);

    // 清除旧的 count/layout/orientation 类名，添加新的（T29 动态布局）
    this.el.className = this.el.className
      .replace(/count-\d+/g, '')
      .replace(/layout-\w+/g, '')
      .replace(/is-(portrait|landscape)/g, '')
      .trim();

    const count = choices.length;
    this.el.classList.add(`count-${count}`);

    // 根据选项数量选择布局：2个底部居中，3-4个左侧垂直面板，更多左侧滑入面板
    if (count <= 2) {
      this.el.classList.add('layout-bottom');
    } else if (count <= 4) {
      this.el.classList.add('layout-side');
    } else {
      this.el.classList.add('layout-panel');
    }

    // 初始化并监听屏幕方向，便于响应式切换
    this._updateOrientationClass();
    if (!this._orientationHandler) {
      this._orientationHandler = () => this._updateOrientationClass();
      window.addEventListener('resize', this._orientationHandler);
    }

    // 监听窗口大小变化，动态更新对话框高度变量
    if (!this._resizeHandler) {
      this._resizeHandler = () => {
        this._syncDialogHeight();
        this._updateScrollHint();
      };
      window.addEventListener('resize', this._resizeHandler);
    }

    // 缓存本轮按钮引用，避免 click/keydown 处理器中重复 querySelectorAll（点击响应关键路径优化）
    this._currentBtns = [];

    choices.forEach((choice, i) => {
      const lockState = lockStates[i];
      const safetyFallback = i === fallbackIndex;
      const locked = lockState.locked && !safetyFallback;
      const lockHint = lockState.hint;
      const marker = String(i + 1);

      // === 跨周目技能：命运之眼 — 显示选项导向（好/坏/中性）===
      let alignmentHtml = '';
      if (state._showAlignment && !locked && !choice.talentChoice) {
        alignmentHtml = this._buildAlignmentPresentation(choice);
      }

      // === 跨周目技能：先见之明 — 选项默认显示效果预览（无需长按）===
      let autoPreviewHtml = '';
      if (state._autoPreview && !locked && !choice.talentChoice) {
        autoPreviewHtml = this._buildEffectPreviewPresentation(choice);
      }

      const btn = document.createElement('button');
      btn.className = 'ui-choice-btn' +
        (locked ? ' locked' : '') +
        (safetyFallback ? ' safety-fallback' : '') +
        (choice.talentChoice ? ' talent-choice' : '');
      btn.type = 'button';
      btn.setAttribute('aria-describedby', 'ui-choice-context-meta');
      btn.setAttribute('aria-posinset', String(i + 1));
      btn.setAttribute('aria-setsize', String(choices.length));
      if (choice.talentChoice) {
        btn.dataset.talentSource = String(choice.talentChoice.id || '');
      }
      if (!locked && i < 9) btn.setAttribute('aria-keyshortcuts', marker);
      // 任务1：选项逐个 stagger 入场，每个按钮延迟 80ms 出现
      btn.style.animationDelay = `${i * 80}ms`;
      const checkHintHtml = this._buildCheckHint(choice, state);
      const talentChoiceHtml = this._buildTalentChoicePresentation(choice);
      btn.innerHTML = `
        <span class="corner-deco tl"></span>
        <span class="corner-deco tr"></span>
        <span class="corner-deco bl"></span>
        <span class="corner-deco br"></span>
        <span class="ui-choice-marker">${locked ? '<span class="lock-icon">▣</span>' : `<span class="marker-icon">${marker}</span><span class="marker-key-hint">${marker}</span>`}</span>
        <span class="ui-choice-text">${talentChoiceHtml || `${choice.label}${checkHintHtml}${autoPreviewHtml}${alignmentHtml}`}</span>
        ${locked
          ? `<span class="ui-choice-lock-hint">${lockHint}</span>`
          : safetyFallback
            ? '<span class="ui-choice-safety-hint">保底路线 · 避免剧情中断</span><span class="ui-choice-arrow">→</span>'
            : '<span class="ui-choice-arrow">→</span>'}
      `;

      if (locked) {
        btn.disabled = true;
      } else {
        let pressTimer = null;
        let previewedByLongPress = false;
        const cancelPressTimer = () => {
          if (pressTimer === null) return;
          clearTimeout(pressTimer);
          this._transientTimers.delete(pressTimer);
          pressTimer = null;
        };

        btn.addEventListener('click', (event) => {
          if (previewedByLongPress) {
            previewedByLongPress = false;
            event.preventDefault();
            event.stopPropagation();
            return;
          }
          if (this._choiceLock) return;
          this._choiceLock = true;
          // 关键反馈同步完成（<16ms）：禁用全部按钮 + 选中锁定态 + 触感震动
          this._currentBtns.forEach(b => b.disabled = true);
          this._markSelected(btn);
          if (this.scene && typeof this.scene.vibrate === 'function') this.scene.vibrate(20);
          // 非关键视觉反馈（水波纹/全屏闪光）推迟到下一帧，不阻塞关键路径
          requestAnimationFrame(() => {
            this._createRipple(btn, event);
            this._triggerChoiceFlash();
          });
          if (onChoice) onChoice(choice);
        });

        // 移动端触控反馈：按下高亮，抬起/取消恢复
        const finishTouch = () => {
          cancelPressTimer();
          btn.classList.remove('touch-active');
        };
        btn.addEventListener('touchstart', () => {
          previewedByLongPress = false;
          cancelPressTimer();
          btn.classList.add('touch-active');
          pressTimer = this._setTransientTimer(() => {
            pressTimer = null;
            previewedByLongPress = true;
            btn.classList.remove('touch-active');
            this._showChoicePreview(choice, btn);
            if (this.scene && typeof this.scene.vibrate === 'function') this.scene.vibrate(12);
          }, 500);
        }, { passive: true });
        btn.addEventListener('touchend', finishTouch, { passive: true });
        btn.addEventListener('touchcancel', finishTouch, { passive: true });

        // 任务1：天平倾斜效果——hover 时天平向该方向倾斜
        btn.addEventListener('mouseenter', () => {
          // R91：桌面端悬停轻音（80ms 节流，快速划过一排便签不炸音）
          try { this.scene?.audio?.playHover?.(); } catch(e) {}
          balance.classList.remove('tilt-left', 'tilt-right');
          if (i % 2 === 0) {
            balance.classList.add('tilt-left');
          } else {
            balance.classList.add('tilt-right');
          }
        });
        btn.addEventListener('mouseleave', () => {
          balance.classList.remove('tilt-left', 'tilt-right');
        });

        // 任务4：长按预览选项效果
        btn.addEventListener('touchmove', () => {
          finishTouch();
        }, { passive: true });
        btn.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          this._showChoicePreview(choice, btn);
        });
      }

      this.el.appendChild(btn);
      this._currentBtns.push(btn);
    });

    // R45: 只有 5+ 的限高滚动面板才需要“还有更多选项”提示。
    // 3-4 项布局会按内容自然撑开，插入带负边距的 sticky 提示反而会制造假溢出。
    if (count > 4) {
      const moreHint = document.createElement('div');
      moreHint.className = 'ui-choices-more';
      moreHint.setAttribute('aria-hidden', 'true');
      moreHint.textContent = '▼';
      this.el.appendChild(moreHint);
    }

    // 数字键快捷选择（1-9）— 与 A 自动播放、S 速度切换等全局快捷键解耦
    this._keyHandler = (event) => {
      if (this.scene
        && typeof this.scene.isGameplayInputBlocked === 'function'
        && this.scene.isGameplayInputBlocked()) {
        return;
      }
      const key = String(event.key || '');
      const available = this._currentBtns.filter(button => !button.disabled);
      if (['ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowLeft', 'Home', 'End'].includes(key)) {
        if (available.length === 0) return;
        if (event.preventDefault) event.preventDefault();
        const currentIndex = available.indexOf(document.activeElement);
        let nextIndex = currentIndex;
        if (key === 'Home') nextIndex = 0;
        else if (key === 'End') nextIndex = available.length - 1;
        else if (key === 'ArrowDown' || key === 'ArrowRight') {
          nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % available.length;
        } else {
          nextIndex = currentIndex < 0
            ? available.length - 1
            : (currentIndex - 1 + available.length) % available.length;
        }
        available[nextIndex].focus({ preventScroll: true });
        return;
      }
      const idx = /^[1-9]$/.test(key) ? Number(key) - 1 : -1;
      if (idx >= 0 && idx < choices.length) {
        if (this._choiceLock) return;
        const c = choices[idx];
        const state = this.scene.state || {};
        const { locked } = this._getChoiceLock(c, state, choices);
        const safetyFallback = c === this._safetyFallbackChoice;
        if ((!locked || safetyFallback) && onChoice) {
          this._choiceLock = true;
          this._currentBtns.forEach(b => b.disabled = true);
          const _selectedBtn = this._currentBtns[idx];
          if (_selectedBtn) this._markSelected(_selectedBtn);
          if (this.scene && typeof this.scene.vibrate === 'function') this.scene.vibrate(20);
          requestAnimationFrame(() => this._triggerChoiceFlash());
          onChoice(c);
        }
      }
    };
    this.scene.input.keyboard.on('keydown', this._keyHandler);

    this.el.classList.add('visible');
    balance.classList.add('visible');

    // 选项渲染完成后测量溢出，并把焦点交给第一个可选动作。
    // 此刻剧情已明确进入选择态，主动聚焦不会打断输入框等其他任务。
    requestAnimationFrame(() => {
      this._updateScrollHint();
      const firstAvailable = this._currentBtns.find(button => !button.disabled);
      if (firstAvailable) firstAvailable.focus({ preventScroll: true });
    });

    // 通知 DialogSystem 选项面板已显示，对话框需要上移
    if (this.scene.dialog && this.scene.dialog.notifyChoicesVisible) {
      // 使用 requestAnimationFrame 确保 DOM 布局已完成再计算高度
      requestAnimationFrame(() => {
        this.scene.dialog.notifyChoicesVisible(true);
        // 同步对话框高度到 CSS 变量，确保选项定位准确
        this._syncDialogHeight();
      });
    }
  }

  /**
   * 创建像素风方形水波纹反馈（点击位置为圆心，基于 CSS animation 无需 JS 定时器）
   */
  _createRipple(btn, event) {
    if (!event) return;
    const rect = btn.getBoundingClientRect();
    const x = (event.clientX || rect.left + rect.width / 2) - rect.left;
    const y = (event.clientY || rect.top + rect.height / 2) - rect.top;
    const ripple = document.createElement('span');
    ripple.className = 'ripple-effect';
    ripple.style.left = x + 'px';
    ripple.style.top = y + 'px';
    btn.appendChild(ripple);
    const onAnimationEnd = () => {
      if (ripple.parentNode) ripple.parentNode.removeChild(ripple);
      ripple.removeEventListener('animationend', onAnimationEnd);
    };
    ripple.addEventListener('animationend', onAnimationEnd);
  }

  _setTransientTimer(callback, delay) {
    const id = setTimeout(() => {
      this._transientTimers.delete(id);
      callback();
    }, delay);
    this._transientTimers.add(id);
    return id;
  }

  _clearTransientInteractions() {
    for (const id of this._transientTimers) {
      clearTimeout(id);
    }
    this._transientTimers.clear();
    this._previewTimer = null;
    if (this._activePreview) {
      this._activePreview.remove();
      this._activePreview = null;
    }
  }

  /**
   * 任务4：长按/右键预览选项可能的影响
   */
  _showChoicePreview(choice, button) {
    this._clearTransientInteractions();

    const preview = document.createElement('div');
    preview.className = 'choice-preview';
    preview.setAttribute('role', 'status');
    preview.setAttribute('aria-live', 'polite');

    // 显示选项的 effects 预览
    const effects = choice.effects || {};
    const effectTexts = [];
    if (effects.pride) effectTexts.push(`理想${effects.pride > 0 ? '+' : ''}${effects.pride}`);
    if (effects.wealth) effectTexts.push(`财富${effects.wealth > 0 ? '+' : ''}${effects.wealth}`);
    if (effects.reputation) effectTexts.push(`名声${effects.reputation > 0 ? '+' : ''}${effects.reputation}`);
    if (effects.trust) effectTexts.push(`信任${effects.trust > 0 ? '+' : ''}${effects.trust}`);
    if (effects.pressure) effectTexts.push(`压力${effects.pressure > 0 ? '+' : ''}${effects.pressure}`);
    if (effects.failures) effectTexts.push(`翻车${effects.failures > 0 ? '+' : ''}${effects.failures}`);

    const title = document.createElement('div');
    title.className = 'preview-title';
    title.textContent = effectTexts.length > 0 ? '可能的影响' : '这个选择的后果';
    const details = document.createElement('div');
    details.className = 'preview-effects';
    details.textContent = effectTexts.length > 0 ? effectTexts.join(' · ') : '未知…';
    preview.append(title, details);

    document.body.appendChild(preview);
    this._activePreview = preview;

    const buttonRect = button.getBoundingClientRect();
    const previewRect = preview.getBoundingClientRect();
    const gutter = 12;
    const minCenter = previewRect.width / 2 + gutter;
    const maxCenter = window.innerWidth - previewRect.width / 2 - gutter;
    const centerX = Math.max(minCenter, Math.min(maxCenter, buttonRect.left + buttonRect.width / 2));
    let top = buttonRect.top - previewRect.height - 10;
    if (top < gutter) {
      top = Math.min(window.innerHeight - previewRect.height - gutter, buttonRect.bottom + 10);
    }
    preview.style.left = `${centerX}px`;
    preview.style.top = `${Math.max(gutter, top)}px`;

    this._previewTimer = this._setTransientTimer(() => {
      if (this._activePreview === preview) {
        preview.remove();
        this._activePreview = null;
        this._previewTimer = null;
      }
    }, 3000);
  }

  /**
   * R45: 选项溢出时显示"▼ 还有更多"吸底提示
   * 容器可滚动且未滚到底时加 has-more 类；滚到底或无需滚动时移除
   */
  _updateScrollHint() {
    const el = this.el;
    if (!el) return;
    const hasOverflow = el.scrollHeight > el.clientHeight + 2;
    const atEnd = el.scrollTop + el.clientHeight >= el.scrollHeight - 4;
    el.classList.toggle('has-more', hasOverflow && !atEnd);
  }

  /**
   * 同步对话框实际高度到 CSS 变量 --dialog-height
   * 确保选项面板定位始终基于对话框的真实高度，避免重叠
   */
  _syncDialogHeight() {
    if (this.scene.dialog && typeof this.scene.dialog.getDialogHeight === 'function') {
      const dialogHeight = this.scene.dialog.getDialogHeight();
      const overlay = document.getElementById('ui-overlay');
      if (overlay) {
        overlay.style.setProperty('--dialog-height', dialogHeight + 'px');
      }
    }
  }

  _updateOrientationClass() {
    const isPortrait = window.matchMedia('(orientation: portrait)').matches;
    this.el.classList.toggle('is-portrait', isPortrait);
    this.el.classList.toggle('is-landscape', !isPortrait);
  }

  _triggerChoiceFlash() {
    const flash = document.getElementById('choice-flash');
    if (!flash) return;
    flash.classList.remove('flash');
    void flash.offsetWidth;
    flash.classList.add('flash');
  }

  /**
   * R41: 标记已选按钮的视觉状态
   * 选中按钮加 .selected（金色发光+放大），其余加 .unselected（灰暗+缩小）
   * 创建"你选了这个"的明确锁定瞬间，持续到选项淡出（hide 时 innerHTML 清空自动清理）
   * @param {HTMLElement} selectedBtn 被选中的按钮元素
   */
  _markSelected(selectedBtn) {
    // 优先用缓存的按钮引用（避免重复 querySelectorAll），缓存不可用时兜底查询
    const allBtns = (this._currentBtns && this._currentBtns.length)
      ? this._currentBtns
      : this.el.querySelectorAll('.ui-choice-btn');
    allBtns.forEach(b => {
      if (b === selectedBtn) {
        b.classList.add('selected');
      } else {
        b.classList.add('unselected');
      }
    });
  }

  hide(immediate = false) {
    if (this.el && this.el.contains(document.activeElement) &&
        this.scene.dialog && this.scene.dialog.requestFocusOnNextShow) {
      this.scene.dialog.requestFocusOnNextShow();
    }
    // Remove keyboard handler
    if (this._keyHandler) {
      this.scene.input.keyboard.off('keydown', this._keyHandler);
      this._keyHandler = null;
    }
    if (this._orientationHandler) {
      window.removeEventListener('resize', this._orientationHandler);
      this._orientationHandler = null;
    }
    if (this._resizeHandler) {
      window.removeEventListener('resize', this._resizeHandler);
      this._resizeHandler = null;
    }
    this._clearTransientInteractions();
    // 退场淡出动画
    this.el.classList.add('leaving');
    const cleanup = () => {
      this._leaveTimer = null;
      this.el.classList.remove('visible', 'leaving');
      this.el.innerHTML = '';
      this._currentBtns = [];
      this._safetyFallbackChoice = null;
      if (this.scene.dialog && this.scene.dialog.notifyChoicesVisible) {
        this.scene.dialog.notifyChoicesVisible(false);
      }
    };
    if (this._leaveTimer) clearTimeout(this._leaveTimer);
    if (immediate) {
      cleanup();
    } else {
      this._leaveTimer = setTimeout(cleanup, 200);
    }
  }

  destroy() {
    if (this.el && this._onChoicesScroll) {
      this.el.removeEventListener('scroll', this._onChoicesScroll);
      this._onChoicesScroll = null;
    }
    this.hide(true);
    this.choices = [];
    this._safetyFallbackChoice = null;
    this.el = null;
    this.scene = null;
  }
}
