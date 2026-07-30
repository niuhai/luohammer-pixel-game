import {
  DECISION_STAT_LABELS,
  describeDecisionEffects,
  escapeDecisionText
} from './DecisionPresentation.js';

const STAT_KEYS = Object.freeze([
  'pride',
  'wealth',
  'reputation',
  'failures',
  'pressure',
  'trust'
]);

function normalizeLabel(value) {
  return String(value || '').replace(/^["“”']+|["“”']+$/g, '').trim();
}

function normalizeChoiceTone(value) {
  return ['positive', 'warning', 'danger'].includes(value) ? value : '';
}

function renderEffectTokens(effects = {}, className = '') {
  return describeDecisionEffects(effects)
    .map(effect => `
      <span
        class="ui-consequence-effect ${effect.tone} ${className}"
        data-stat="${escapeDecisionText(effect.key)}"
      >
        <span>${escapeDecisionText(effect.label)}</span>
        <strong>${effect.value > 0 ? '+' : ''}${effect.value}</strong>
      </span>
    `)
    .join('');
}

function collectTransitions(beforeState = {}, afterState = {}, effects = {}) {
  const changedKeys = new Set([
    ...Object.keys(effects),
    ...STAT_KEYS.filter(key => beforeState[key] !== afterState[key])
  ]);

  return [...changedKeys]
    .filter(key => (
      typeof beforeState[key] === 'number' &&
      typeof afterState[key] === 'number' &&
      beforeState[key] !== afterState[key]
    ))
    .map(key => ({
      key,
      label: DECISION_STAT_LABELS[key] || key,
      before: beforeState[key],
      after: afterState[key]
    }));
}

export class ConsequenceOverlay {
  constructor(scene) {
    this.scene = scene;
    this.root = document.getElementById('ui-consequence-overlay');
    this.card = this.root?.querySelector('.ui-consequence-card') || null;
    this.kickerEl = document.getElementById('ui-consequence-kicker');
    this.progressEl = document.getElementById('ui-consequence-progress');
    this.titleEl = document.getElementById('ui-consequence-title');
    this.causeEl = document.getElementById('ui-consequence-cause');
    this.narrativeEl = document.getElementById('ui-consequence-narrative');
    this.mitigationEl = document.getElementById('ui-consequence-mitigation');
    this.effectsEl = document.getElementById('ui-consequence-effects');
    this.choicesEl = document.getElementById('ui-consequence-choices');
    this.resultEl = document.getElementById('ui-consequence-result');
    this.hintEl = document.getElementById('ui-consequence-hint');
    this.continueEl = document.getElementById('ui-consequence-continue');

    this._stage = null;
    this._choiceButtons = [];
    this._advance = null;
    this._selectionLocked = false;
    this._previousFocus = null;
    this._abortController = new AbortController();

    if (!this.root || !this.continueEl) return;

    const signal = this._abortController.signal;
    this.continueEl.addEventListener('click', () => this._runAdvance(), { signal });
    document.addEventListener('keydown', event => this._handleKeydown(event), {
      signal,
      capture: true
    });
  }

  isVisible() {
    return Boolean(this.root?.classList.contains('visible'));
  }

  showDecision(config = {}) {
    if (!this.root) return;
    const choices = Array.isArray(config.choices) ? config.choices : [];
    this._prepare({
      stage: 'decision',
      kicker: config.kicker || '系统中断 · 必须恢复',
      title: config.title || '压力到达极限',
      cause: config.cause,
      narrative: config.narrative,
      progress: null
    });

    this._setMitigation(config.mitigation);
    this.effectsEl.innerHTML = '';
    this.effectsEl.hidden = true;
    this.resultEl.innerHTML = '';
    this.resultEl.hidden = true;
    this.continueEl.hidden = true;
    this.hintEl.hidden = false;
    this.hintEl.textContent = '↑↓ 切换 · Enter 确认 · 数字键选择';

    this.choicesEl.hidden = false;
    this.choicesEl.innerHTML = choices.map((choice, index) => {
      const previewEffects = choice.previewEffects || choice.effects;
      const effects = describeDecisionEffects(previewEffects);
      const effectSummary = effects.map(effect => effect.text).join('，');
      const label = normalizeLabel(choice.label);
      const note = String(choice.note || '').trim();
      const tone = normalizeChoiceTone(choice.tone);
      return `
        <button
          class="ui-consequence-choice ${tone ? `tone-${tone}` : ''}"
          type="button"
          data-choice-index="${index}"
          aria-keyshortcuts="${index + 1}"
          aria-label="${escapeDecisionText(
            `${index + 1}，${label}${effectSummary ? `，${effectSummary}` : ''}${
              note ? `，${note}` : ''
            }`
          )}"
        >
          <span class="ui-consequence-choice-index" aria-hidden="true">${index + 1}</span>
          <span class="ui-consequence-choice-copy">
            <span class="ui-consequence-choice-label">${escapeDecisionText(label)}</span>
            <span class="ui-consequence-choice-effects">
              ${renderEffectTokens(previewEffects, 'compact')}
            </span>
            ${note
              ? `<span class="ui-consequence-choice-note">${escapeDecisionText(note)}</span>`
              : ''}
          </span>
          <span class="ui-consequence-choice-arrow" aria-hidden="true">→</span>
        </button>
      `;
    }).join('');

    this._choiceButtons = [...this.choicesEl.querySelectorAll('.ui-consequence-choice')];
    this._choiceButtons.forEach((button, index) => {
      button.addEventListener('click', () => {
        if (this._selectionLocked) return;
        this._selectionLocked = true;
        this.scene?.vibrate?.(14);
        const outcome = config.onSelect?.(choices[index], index);
        if (outcome) {
          this.showResult(outcome);
        } else {
          this._selectionLocked = false;
        }
      }, { signal: this._abortController.signal });
    });

    this._focusElement(this._choiceButtons[0] || this.card);
  }

  showNotice(config = {}) {
    if (!this.root) return;
    this._prepare({
      stage: 'notice',
      kicker: config.kicker || '阈值回响 · 状态将改变',
      title: config.title || '隐藏事件',
      cause: config.cause,
      narrative: config.narrative,
      progress: config.progress
    });

    this._setMitigation(config.mitigation);
    this._renderStandaloneEffects(config.effects, '即将生效');
    this.choicesEl.innerHTML = '';
    this.choicesEl.hidden = true;
    this.resultEl.innerHTML = '';
    this.resultEl.hidden = true;
    this._choiceButtons = [];
    this._selectionLocked = false;
    this._advance = config.onContinue || null;
    this.hintEl.hidden = false;
    this.hintEl.textContent = '确认后属性变化才会生效';
    this.continueEl.hidden = false;
    this.continueEl.textContent = config.actionLabel || '确认变化';
    this.continueEl.setAttribute('aria-label', this.continueEl.textContent);
    this._focusElement(this.continueEl);
  }

  showResult(config = {}) {
    if (!this.root) return;
    this._prepare({
      stage: 'result',
      kicker: config.kicker || '恢复动作 · 已落地',
      title: config.title || '崩溃代价已结算',
      cause: config.cause || '你已经作出恢复选择，结果不会自动跳过。',
      narrative: config.narrative,
      progress: config.progress
    });

    this._setMitigation(null);
    this.choicesEl.innerHTML = '';
    this.choicesEl.hidden = true;
    this._choiceButtons = [];
    this._renderStandaloneEffects(config.effects, '本次变化');

    const transitions = [
      ...collectTransitions(
        config.beforeState,
        config.afterState,
        config.effects
      ),
      ...(Array.isArray(config.extraTransitions) ? config.extraTransitions : [])
        .filter(transition => (
          transition &&
          transition.label &&
          transition.before !== undefined &&
          transition.after !== undefined
        ))
        .map(transition => ({
          ...transition,
          key: transition.key || 'resource'
        }))
    ];
    const selectedLabel = normalizeLabel(config.choiceLabel);
    this.resultEl.hidden = false;
    this.resultEl.innerHTML = `
      <div class="ui-consequence-selected">
        <span>${escapeDecisionText(config.selectionKicker || '你选择了')}</span>
        <strong>${escapeDecisionText(selectedLabel)}</strong>
      </div>
      ${transitions.length > 0 ? `
        <div class="ui-consequence-transitions" aria-label="属性变化结果">
          ${transitions.map(transition => `
            <div class="ui-consequence-transition ${
              transition.key === 'pressure'
                ? 'ui-consequence-pressure-transition'
                : transition.key === 'resource'
                  ? 'ui-consequence-resource-transition'
                  : ''
            }">
              <span>${escapeDecisionText(transition.label)}</span>
              <strong>
                <span>${transition.before}</span>
                <span aria-hidden="true">→</span>
                <span>${transition.after}</span>
              </strong>
            </div>
          `).join('')}
        </div>
      ` : ''}
    `;

    this._selectionLocked = false;
    this._advance = config.onContinue || null;
    this.hintEl.hidden = false;
    this.hintEl.textContent = config.hint || '确认结果后继续原来的旅程';
    this.continueEl.hidden = false;
    this.continueEl.textContent = config.actionLabel || '继续旅程 →';
    this.continueEl.setAttribute('aria-label', this.continueEl.textContent);
    this._focusElement(this.continueEl);
  }

  hide(options = {}) {
    if (!this.root) return;
    const { restoreFocus = true } = options;
    this.root.classList.remove('visible');
    this.root.removeAttribute('data-consequence-stage');
    this.root.setAttribute('aria-hidden', 'true');
    this._stage = null;
    this._choiceButtons = [];
    this._advance = null;
    this._selectionLocked = false;

    const previousFocus = this._previousFocus;
    this._previousFocus = null;
    if (
      restoreFocus &&
      previousFocus instanceof HTMLElement &&
      previousFocus.isConnected &&
      !previousFocus.closest('#ui-choices:not(.visible), #ui-dialog:not(.visible)')
    ) {
      previousFocus.focus({ preventScroll: true });
    }
  }

  destroy() {
    this.hide({ restoreFocus: false });
    this._abortController?.abort();
    this._abortController = null;
    this.scene = null;
  }

  _prepare({ stage, kicker, title, cause, narrative, progress }) {
    if (!this.isVisible()) {
      this._previousFocus = document.activeElement;
    }
    this._stage = stage;
    this._selectionLocked = false;
    this._advance = null;
    this.root.classList.add('visible');
    this.root.setAttribute('role', 'dialog');
    this.root.setAttribute('aria-modal', 'true');
    this.root.setAttribute('aria-labelledby', 'ui-consequence-title');
    this.root.setAttribute('aria-describedby', 'ui-consequence-narrative');
    this.root.setAttribute('aria-hidden', 'false');
    this.root.setAttribute('data-consequence-stage', stage);

    this.kickerEl.textContent = kicker || '';
    this.titleEl.textContent = title || '';
    this.causeEl.textContent = cause || '';
    this.causeEl.hidden = !cause;
    this.narrativeEl.textContent = narrative || '';
    this.narrativeEl.hidden = !narrative;

    if (progress?.current && progress?.total) {
      const progressLabel = progress.label || '隐藏事件';
      this.progressEl.hidden = false;
      this.progressEl.textContent = `${progressLabel} ${progress.current} / ${progress.total}`;
      this.progressEl.setAttribute(
        'aria-label',
        `${progressLabel}第 ${progress.current} 个，共 ${progress.total} 个`
      );
    } else {
      this.progressEl.hidden = true;
      this.progressEl.textContent = '';
      this.progressEl.removeAttribute('aria-label');
    }

    if (this.card) this.card.scrollTop = 0;
  }

  _setMitigation(message) {
    this.mitigationEl.textContent = message || '';
    this.mitigationEl.hidden = !message;
  }

  _renderStandaloneEffects(effects = {}, label = '属性变化') {
    const tokens = renderEffectTokens(effects);
    this.effectsEl.hidden = !tokens;
    this.effectsEl.innerHTML = tokens
      ? `<span class="ui-consequence-effects-label">${escapeDecisionText(label)}</span>${tokens}`
      : '';
  }

  _runAdvance() {
    if (!this._advance || this._selectionLocked) return;
    this._selectionLocked = true;
    this.scene?.vibrate?.(12);
    const callback = this._advance;
    this._advance = null;
    callback();
  }

  _handleKeydown(event) {
    if (!this.isVisible() || event.repeat) return;

    if (this._stage === 'decision') {
      const numericIndex = Number(event.key) - 1;
      if (numericIndex >= 0 && numericIndex < this._choiceButtons.length) {
        event.preventDefault();
        this._choiceButtons[numericIndex].click();
        return;
      }

      if (['ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowLeft', 'Home', 'End'].includes(event.key)) {
        event.preventDefault();
        const currentIndex = Math.max(0, this._choiceButtons.indexOf(document.activeElement));
        let nextIndex = currentIndex;
        if (event.key === 'Home') nextIndex = 0;
        else if (event.key === 'End') nextIndex = this._choiceButtons.length - 1;
        else if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
          nextIndex = (currentIndex + 1) % this._choiceButtons.length;
        } else {
          nextIndex = (currentIndex - 1 + this._choiceButtons.length) % this._choiceButtons.length;
        }
        this._choiceButtons[nextIndex]?.focus({ preventScroll: true });
        return;
      }
    }

    const focusable = this._getFocusableElements();
    if (event.key === 'Tab' && focusable.length > 0) {
      const currentIndex = focusable.indexOf(document.activeElement);
      const nextIndex = event.shiftKey
        ? (currentIndex <= 0 ? focusable.length - 1 : currentIndex - 1)
        : (currentIndex >= focusable.length - 1 ? 0 : currentIndex + 1);
      event.preventDefault();
      focusable[nextIndex].focus({ preventScroll: true });
      return;
    }

    if (
      (event.key === 'Enter' || event.key === ' ' || event.code === 'Space') &&
      !(document.activeElement instanceof HTMLButtonElement)
    ) {
      event.preventDefault();
      if (this._stage === 'decision') this._choiceButtons[0]?.click();
      else this.continueEl?.click();
    }
  }

  _getFocusableElements() {
    return [...this.root.querySelectorAll('button:not([hidden]):not([disabled]), [tabindex="0"]')]
      .filter(element => !element.closest('[hidden]'));
  }

  _focusElement(element) {
    if (!element) return;
    const focus = () => {
      if (!this.isVisible() || !element.isConnected) return;
      element.focus({ preventScroll: true });
    };
    focus();
    requestAnimationFrame(focus);
  }
}
