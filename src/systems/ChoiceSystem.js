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
    // R45: 容器滚动时更新"还有更多选项"吸底提示（元素静态存在于 index.html，监听一次即可）
    this._onChoicesScroll = () => this._updateScrollHint();
    if (this.el) this.el.addEventListener('scroll', this._onChoicesScroll, { passive: true });
  }

  /**
   * 属性中文名映射，用于门槛提示
   */
  static STAT_LABELS = {
    pride: '理想', wealth: '财富', reputation: '名声',
    failures: '翻车', pressure: '压力', trust: '信任'
  };

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
    const attrLabel = ChoiceSystem.STAT_LABELS[check.attr] || check.attr;
    let hint = `【检定】需要 ${attrLabel} ≥ ${check.min}`;

    // 读心术技能：显示成功率
    if (state._showCheckInfo) {
      const attrValue = state[check.attr] || 0;
      let rate = (attrValue / (check.min + 2)) * 100;
      rate = Math.max(10, Math.min(90, rate));
      // 成功率按区间着色：<30% 红，30-70% 金，>70% 绿
      const successColor = rate < 30 ? 'var(--color-danger)' : rate > 70 ? 'var(--color-success)' : 'var(--color-gold)';
      hint += ` · <span style="color: ${successColor}">成功率：约${Math.round(rate)}%</span>`;
    }

    return `<span class="choice-check-hint">${hint}</span>`;
  }

  /**
   * 构建效果预览文本（用于先见之明技能自动预览）
   * @param {object} choice - 选项对象
   * @returns {string} 效果预览文本，无效果时返回空字符串
   */
  _buildEffectPreview(choice) {
    const effects = choice.effects || {};
    const parts = [];
    if (effects.pride) parts.push(`理想${effects.pride > 0 ? '+' : ''}${effects.pride}`);
    if (effects.wealth) parts.push(`财富${effects.wealth > 0 ? '+' : ''}${effects.wealth}`);
    if (effects.reputation) parts.push(`名声${effects.reputation > 0 ? '+' : ''}${effects.reputation}`);
    if (effects.trust) parts.push(`信任${effects.trust > 0 ? '+' : ''}${effects.trust}`);
    if (effects.pressure) parts.push(`压力${effects.pressure > 0 ? '+' : ''}${effects.pressure}`);
    if (effects.failures) parts.push(`翻车${effects.failures > 0 ? '+' : ''}${effects.failures}`);
    return parts.length > 0 ? parts.join(' · ') : '';
  }

  /**
   * 推断选项导向（好/坏/中性），用于命运之眼技能
   * @param {object} choice - 选项对象
   * @returns {{label: string, cls: string}} 导向标签与样式类
   */
  _inferAlignment(choice) {
    const effects = choice.effects || {};
    let score = 0;
    if (effects.pride > 0) score += effects.pride;
    if (effects.wealth > 0) score += effects.wealth;
    if (effects.reputation > 0) score += effects.reputation;
    if (effects.trust > 0) score += effects.trust;
    if (effects.pressure < 0) score += 1;
    if (effects.pride < 0) score += effects.pride;
    if (effects.wealth < 0) score += effects.wealth;
    if (effects.reputation < 0) score += effects.reputation;
    if (effects.trust < 0) score += effects.trust;
    if (effects.pressure > 0) score -= 1;
    if (effects.failures > 0) score -= 2;

    if (score >= 2) return { label: '向好', cls: 'alignment-good' };
    if (score <= -2) return { label: '向坏', cls: 'alignment-bad' };
    return { label: '中性', cls: 'alignment-neutral' };
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
    const enabledCount = choices.filter(choice =>
      !this._getChoiceLock(choice, state, choices).locked
    ).length;
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
      const { locked, hint: lockHint } = this._getChoiceLock(choice, state, choices);
      const marker = String(i + 1);

      // === 跨周目技能：命运之眼 — 显示选项导向（好/坏/中性）===
      let alignmentHtml = '';
      if (state._showAlignment && !locked) {
        const align = this._inferAlignment(choice);
        alignmentHtml = `<span class="choice-alignment ${align.cls}">${align.label}</span>`;
      }

      // === 跨周目技能：先见之明 — 选项默认显示效果预览（无需长按）===
      let autoPreviewHtml = '';
      if (state._autoPreview && !locked) {
        const previewText = this._buildEffectPreview(choice);
        if (previewText) {
          autoPreviewHtml = `<span class="choice-auto-preview">${previewText}</span>`;
        }
      }

      const btn = document.createElement('button');
      btn.className = 'ui-choice-btn' + (locked ? ' locked' : '');
      btn.type = 'button';
      btn.setAttribute('aria-describedby', 'ui-choice-context-meta');
      btn.setAttribute('aria-posinset', String(i + 1));
      btn.setAttribute('aria-setsize', String(choices.length));
      if (!locked && i < 9) btn.setAttribute('aria-keyshortcuts', marker);
      // 任务1：选项逐个 stagger 入场，每个按钮延迟 80ms 出现
      btn.style.animationDelay = `${i * 80}ms`;
      const checkHintHtml = this._buildCheckHint(choice, state);
      btn.innerHTML = `
        <span class="corner-deco tl"></span>
        <span class="corner-deco tr"></span>
        <span class="corner-deco bl"></span>
        <span class="corner-deco br"></span>
        <span class="ui-choice-marker">${locked ? '<span class="lock-icon">▣</span>' : `<span class="marker-icon">${marker}</span><span class="marker-key-hint">${marker}</span>`}</span>
        <span class="ui-choice-text">${choice.label}${checkHintHtml}${autoPreviewHtml}</span>
        ${alignmentHtml}
        ${locked ? `<span class="ui-choice-lock-hint">${lockHint}</span>` : '<span class="ui-choice-arrow">→</span>'}
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

    // R45: "还有更多选项"吸底提示——sticky 定位不随内容滚走，显隐由 _updateScrollHint 控制
    const moreHint = document.createElement('div');
    moreHint.className = 'ui-choices-more';
    moreHint.setAttribute('aria-hidden', 'true');
    moreHint.textContent = '▼';
    this.el.appendChild(moreHint);

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
        if (!locked && onChoice) {
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
    this.el = null;
    this.scene = null;
  }
}
