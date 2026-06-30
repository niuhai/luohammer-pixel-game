/**
 * 随机事件系统
 *
 * 在主线节点之间随机插入事件
 * UI：DOM overlay 弹窗式事件卡片，2选1
 * 两阶段显示：visible(设display) -> active(触发动画)
 */

import { getAvailableEvents, pickRandomEvent, resolveRandomEffects } from '../data/events-random.js';
import { getStageByNodeId } from '../data/stages.js';

// 属性中文名映射（与实际状态字段保持一致）
const STAT_LABELS = {
  pride: '理想',
  wealth: '财富',
  reputation: '名声',
  failures: '翻车',
  pressure: '压力',
  trust: '信任'
};

export class RandomEventSystem {
  constructor(scene) {
    this.scene = scene;
    this.onComplete = null;

    // DOM 元素引用
    this._overlay = document.getElementById('ui-random-event-overlay');
    this._titleEl = document.getElementById('ui-random-event-title');
    this._bodyEl = document.getElementById('ui-random-event-body');
    this._choicesEl = document.getElementById('ui-random-event-choices');
    this._feedbackEl = document.getElementById('ui-random-event-feedback');
    this._feedbackListEl = document.getElementById('ui-random-event-feedback-list');

    // 键盘快捷键
    this._keyHandler = null;

    // 关闭动画超时兜底
    this._closeTimeout = null;

    // 移动端触控高亮
    this._touchHandlers = [];

    // 节流：记录自上次触发以来的节点计数，避免随机事件打断叙事节奏
    this._nodesSinceLastEvent = 0;
    this._minNodesBetweenEvents = 5; // 每 5 个主线节点最多触发 1 次随机事件
  }

  /**
   * 主线节点推进时调用，用于节流计数
   */
  onNodeAdvanced() {
    this._nodesSinceLastEvent++;
  }

  /**
   * 尝试触发随机事件
   * @param {object} state - 当前游戏状态
   * @param {string} stageId - 当前阶段
   * @param {Set} triggeredEvents - 已触发事件集合
   * @param {function} onComplete - 完成回调 (effects, flag) => void
   * @returns {boolean} 是否触发了事件
   */
  tryTrigger(state, stageId, triggeredEvents, onComplete) {
    // 节流：距上次触发不足 5 个节点则跳过，避免随机事件打断叙事节奏
    if (this._nodesSinceLastEvent < this._minNodesBetweenEvents) return false;

    const flags = state.flags || new Set();
    const available = getAvailableEvents(state, stageId, triggeredEvents, flags);
    if (available.length === 0) return false;

    // 阶段随机事件概率
    const chance = this._getStageChance(stageId);
    if (Math.random() > chance) return false;

    const event = pickRandomEvent(available, state.talentSpecials || []);
    if (!event) return false;

    this.onComplete = onComplete;
    this._currentEvent = event;
    this._showEvent(event);
    // 触发后重置计数
    this._nodesSinceLastEvent = 0;
    return true;
  }

  _getStageChance(stageId) {
    const chances = {
      youth: 0.2,
      teacher: 0.25,
      startup: 0.35,
      dark: 0.3,
      repay: 0.25,
      reborn: 0.2
    };
    let chance = chances[stageId] || 0.25;

    // 天赋 random_events_bias_positive: 随机事件概率 +15%
    const specials = this.scene.state && this.scene.state.talentSpecials || [];
    if (specials.includes('random_events_bias_positive')) {
      chance += 0.15;
    }

    return chance;
  }

  _showEvent(event) {
    // 角色名字替换：根据当前阶段使用 小罗/老罗
    const currentNode = this.scene.state && this.scene.state.currentNode;
    const stage = currentNode ? getStageByNodeId(currentNode) : null;
    const earlyStages = new Set(['youth', 'teacher', 'startup']);
    const charName = stage && earlyStages.has(stage.id) ? '小罗' : '老罗';
    const replaceName = (s) => typeof s === 'string' ? s.replace(/罗远/g, charName) : s;

    // 设置标题
    this._titleEl.textContent = replaceName(event.title || '');

    // 设置描述
    this._bodyEl.textContent = replaceName(event.text);

    // 创建选项按钮
    this._choicesEl.innerHTML = '';
    this._clearTouchHandlers();
    const markers = ['A', 'B'];

    event.choices.forEach((choice, i) => {
      const btn = document.createElement('div');
      btn.className = 'ui-random-event-choice-btn';
      btn.innerHTML = `
        <span class="corner-deco tl"></span>
        <span class="corner-deco tr"></span>
        <span class="corner-deco bl"></span>
        <span class="corner-deco br"></span>
        <span class="ui-random-event-choice-marker">${markers[i] || '?'}</span>
        <span class="ui-random-event-choice-text">${replaceName(choice.label)}</span>
        <span class="ui-random-event-choice-arrow">→</span>
      `;

      // 点击事件
      btn.addEventListener('click', () => {
        this._selectChoice(choice, event);
      });

      // 移动端触控高亮
      const touchStart = () => btn.classList.add('touch-active');
      const touchEnd = () => btn.classList.remove('touch-active');
      btn.addEventListener('touchstart', touchStart, { passive: true });
      btn.addEventListener('touchend', touchEnd, { passive: true });
      btn.addEventListener('touchcancel', touchEnd, { passive: true });
      this._touchHandlers.push({ el: btn, touchStart, touchEnd });

      this._choicesEl.appendChild(btn);
    });

    // 键盘快捷键
    this._keyHandler = (e) => {
      const keyMap = { 'a': 0, 'b': 1 };
      const idx = keyMap[e.key.toLowerCase()];
      if (idx !== undefined && idx < event.choices.length) {
        this._selectChoice(event.choices[idx], event);
      }
    };
    this.scene.input.keyboard.on('keydown', this._keyHandler);

    // 根据稀有度设置视觉风格
    this._overlay.classList.remove('rarity-common', 'rarity-rare', 'rarity-legendary');
    if (event.rarity) {
      this._overlay.classList.add(`rarity-${event.rarity}`);
    }

    // 两阶段显示：先设 visible(display:flex, opacity:0)，下一帧设 active(触发动画)
    this._overlay.classList.remove('closing', 'active', 'shake');
    this._overlay.classList.add('visible');

    // 使用 requestAnimationFrame 确保 display:flex 已生效后再触发动画
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        // 移除旧的震动监听，防止多次叠加
        if (this._onShakeEnd) {
          this._overlay.removeEventListener('animationend', this._onShakeEnd);
          this._onShakeEnd = null;
        }
        this._overlay.classList.add('active', 'shake');
        // 震动动画结束后移除 shake 类，避免影响关闭动画
        this._onShakeEnd = (e) => {
          if (e.animationName === 'randomEventShake') {
            this._overlay.removeEventListener('animationend', this._onShakeEnd);
            this._onShakeEnd = null;
            this._overlay.classList.remove('shake');
          }
        };
        this._overlay.addEventListener('animationend', this._onShakeEnd);
      });
    });
  }

  _selectChoice(choice, event) {
    // 防止重复点击
    if (this._overlay.classList.contains('closing')) return;

    // 移除键盘监听
    if (this._keyHandler) {
      this.scene.input.keyboard.off('keydown', this._keyHandler);
      this._keyHandler = null;
    }

    // 退出动画
    this._overlay.classList.add('closing');

    const doClose = () => {
      // 清除超时兜底
      if (this._closeTimeout) {
        clearTimeout(this._closeTimeout);
        this._closeTimeout = null;
      }
      // 清理震动动画监听与类名
      if (this._onShakeEnd) {
        this._overlay.removeEventListener('animationend', this._onShakeEnd);
        this._onShakeEnd = null;
      }
      this._overlay.classList.remove('visible', 'active', 'closing', 'shake');
      this._choicesEl.innerHTML = '';
      this._clearTouchHandlers();

      // 解析随机效果波动
      const finalEffects = resolveRandomEffects(choice.effects, choice.effectVariance);

      // 显示属性变化反馈
      this._showFeedback(finalEffects, () => {
        if (this.onComplete) {
          this.onComplete(finalEffects, choice.flag || null, event.id);
        }
      });
    };

    // 监听动画结束
    const onAnimationEnd = (e) => {
      if (e.animationName === 'randomEventFadeOut') {
        this._overlay.removeEventListener('animationend', onAnimationEnd);
        doClose();
      }
    };
    this._overlay.addEventListener('animationend', onAnimationEnd);

    // 超时兜底：如果 animationend 未触发（如动画被中断），400ms 后强制关闭
    this._closeTimeout = setTimeout(doClose, 400);
  }

  _showFeedback(effects, callback) {
    const entries = Object.entries(effects);
    if (entries.length === 0) {
      if (callback) callback();
      return;
    }

    this._feedbackListEl.innerHTML = '';

    entries.forEach(([key, value], index) => {
      const label = STAT_LABELS[key] || key;
      const item = document.createElement('div');
      const isPositive = value > 0;
      item.className = `ui-random-event-feedback-item ${isPositive ? 'positive' : 'negative'}`;
      item.textContent = `${label} ${isPositive ? '+' : ''}${value}`;
      item.style.animationDelay = `${index * 0.18}s`;
      this._feedbackListEl.appendChild(item);
    });

    this._feedbackEl.classList.add('visible');

    // 反馈动画结束后关闭（考虑交错延迟 + 动画时长）
    const staggerDelay = (entries.length - 1) * 180;
    const totalDuration = 1800 + staggerDelay + 200; // 1.8s 动画 + 交错 + 缓冲
    setTimeout(() => {
      this._feedbackEl.classList.remove('visible');
      this._feedbackListEl.innerHTML = '';
      if (callback) callback();
    }, totalDuration);
  }

  /**
   * 清理移动端触控事件处理器
   */
  _clearTouchHandlers() {
    this._touchHandlers.forEach(({ el, touchStart, touchEnd }) => {
      el.removeEventListener('touchstart', touchStart);
      el.removeEventListener('touchend', touchEnd);
      el.removeEventListener('touchcancel', touchEnd);
    });
    this._touchHandlers = [];
  }

  hide() {
    if (this._keyHandler) {
      this.scene.input.keyboard.off('keydown', this._keyHandler);
      this._keyHandler = null;
    }
    if (this._closeTimeout) {
      clearTimeout(this._closeTimeout);
      this._closeTimeout = null;
    }
    if (this._onShakeEnd) {
      this._overlay.removeEventListener('animationend', this._onShakeEnd);
      this._onShakeEnd = null;
    }
    this._overlay.classList.remove('visible', 'active', 'closing', 'shake', 'rarity-common', 'rarity-rare', 'rarity-legendary');
    this._choicesEl.innerHTML = '';
    this._clearTouchHandlers();
    this._feedbackEl.classList.remove('visible');
    this._feedbackListEl.innerHTML = '';
    this._currentEvent = null;
  }

  /**
   * 销毁资源，防止内存泄漏
   */
  destroy() {
    this.hide();
    this.onComplete = null;
    this.scene = null;
  }
}
