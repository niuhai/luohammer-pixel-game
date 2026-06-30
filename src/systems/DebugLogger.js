/**
 * 数值平衡性调试日志系统
 *
 * 用于记录玩家游玩路径、属性变化、结局触发频率，
 * 帮助开发者调优数值平衡。
 *
 * 启用方式：
 *   - 调用 enable() / disable()
 *   - 或在标题画面右下角连续点击 5 次切换（见 BootScene）
 *   - 状态持久化在 localStorage（key: luohammer_debug）
 *
 * 控制台接口（仅调试模式启用时挂载到 window.__luohammerDebug）：
 *   - printSummary()  打印统计摘要
 *   - exportLogs()    下载完整日志 JSON
 *   - getSummary()    获取统计摘要对象
 *   - state()         获取当前游戏状态
 */

const DEBUG_KEY = 'luohammer_debug';

export class DebugLogger {
  constructor() {
    this.logs = [];
    this.enabled = false;
    try {
      this.enabled = localStorage.getItem(DEBUG_KEY) === '1';
    } catch (e) {}
    this.startTime = Date.now();
    this.endTime = null;
  }

  enable() {
    this.enabled = true;
    try { localStorage.setItem(DEBUG_KEY, '1'); } catch (e) {}
  }

  disable() {
    this.enabled = false;
    try { localStorage.removeItem(DEBUG_KEY); } catch (e) {}
  }

  isEnabled() {
    return this.enabled;
  }

  /**
   * 通用日志记录
   * @param {string} category - 日志类别：choice / check / random / combo / ending / stage
   * @param {string} event - 事件名称
   * @param {object} data - 附加数据
   */
  log(category, event, data) {
    if (!this.enabled) return;
    this.logs.push({
      time: Date.now(),
      category,
      event,
      data: data || {}
    });
  }

  /**
   * 安全提取状态快照（将 Set 转为数组，避免 JSON 序列化失败）
   */
  _snapshotState(state) {
    if (!state) return null;
    const snap = {};
    for (const key of Object.keys(state)) {
      const val = state[key];
      if (val instanceof Set) {
        snap[key] = Array.from(val);
      } else if (Array.isArray(val)) {
        snap[key] = val;
      } else if (val && typeof val === 'object' && !(val instanceof Function)) {
        // 跳过嵌套对象内部细节，仅保留可安全序列化的浅层字段
        snap[key] = '[object]';
      } else {
        snap[key] = val;
      }
    }
    return snap;
  }

  /**
   * 提取核心属性快照（用于对比变化）
   */
  _snapshotAttrs(state) {
    if (!state) return {};
    return {
      pride: state.pride,
      wealth: state.wealth,
      reputation: state.reputation,
      failures: state.failures,
      pressure: state.pressure,
      trust: state.trust
    };
  }

  /**
   * 记录选择
   */
  logChoice(nodeId, choiceLabel, effects, stateBefore, stateAfter) {
    if (!this.enabled) return;
    this.log('choice', 'makeChoice', {
      nodeId,
      choiceLabel: choiceLabel ? String(choiceLabel).substring(0, 60) : '',
      effects: effects || {},
      stateBefore: this._snapshotAttrs(stateBefore),
      stateAfter: this._snapshotAttrs(stateAfter)
    });
  }

  /**
   * 记录属性检定
   */
  logCheck(attr, required, actual, passed, nextNode) {
    if (!this.enabled) return;
    this.log('check', 'performCheck', {
      attr,
      required,
      actual,
      passed: !!passed,
      nextNode: nextNode || null
    });
  }

  /**
   * 记录随机事件
   */
  logRandomEvent(eventId, stageId) {
    if (!this.enabled) return;
    this.log('random', 'randomEvent', {
      eventId,
      stageId: stageId || null
    });
  }

  /**
   * 记录联动事件
   */
  logComboTrigger(triggerId, message) {
    if (!this.enabled) return;
    this.log('combo', 'comboTrigger', {
      triggerId,
      message: message || ''
    });
  }

  /**
   * 记录结局（同时冻结结束时间）
   */
  logEnding(endingId, state) {
    if (!this.enabled) return;
    this.endTime = Date.now();
    this.log('ending', 'showEnding', {
      endingId,
      state: this._snapshotAttrs(state)
    });
  }

  /**
   * 记录阶段结算
   */
  logStageSettlement(stageId, state) {
    if (!this.enabled) return;
    this.log('stage', 'stageSettlement', {
      stageId,
      state: this._snapshotAttrs(state)
    });
  }

  /**
   * 导出日志为 JSON 字符串
   */
  exportLogs() {
    return JSON.stringify({
      meta: {
        startTime: this.startTime,
        endTime: this.endTime,
        duration: this._getDuration(),
        logCount: this.logs.length
      },
      summary: this.getSummary(),
      logs: this.logs
    }, null, 2);
  }

  /**
   * 通过 Blob 下载日志文件
   */
  downloadLogs() {
    try {
      const content = this.exportLogs();
      const blob = new Blob([content], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const stamp = new Date(this.startTime).toISOString().replace(/[:.]/g, '-');
      a.download = `luohammer-debug-${stamp}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      return true;
    } catch (e) {
      console.warn('[DebugLogger] 下载日志失败:', e);
      return false;
    }
  }

  /**
   * 清空日志（保留启用状态与开始时间）
   */
  clear() {
    this.logs = [];
    this.startTime = Date.now();
    this.endTime = null;
  }

  _getDuration() {
    const end = this.endTime || Date.now();
    return end - this.startTime;
  }

  /**
   * 获取统计摘要
   */
  getSummary() {
    let totalChoices = 0;
    let totalChecks = 0;
    let checksPassed = 0;
    let checksFailed = 0;
    let randomEvents = 0;
    let comboTriggers = 0;
    const nodesVisited = [];
    const nodesSet = new Set();
    let endingId = null;
    let finalState = null;

    for (const entry of this.logs) {
      switch (entry.category) {
        case 'choice': {
          totalChoices++;
          if (entry.data && entry.data.nodeId && !nodesSet.has(entry.data.nodeId)) {
            nodesSet.add(entry.data.nodeId);
            nodesVisited.push(entry.data.nodeId);
          }
          if (entry.data && entry.data.stateAfter) {
            finalState = entry.data.stateAfter;
          }
          break;
        }
        case 'check': {
          totalChecks++;
          if (entry.data && entry.data.passed) {
            checksPassed++;
          } else {
            checksFailed++;
          }
          break;
        }
        case 'random':
          randomEvents++;
          break;
        case 'combo':
          comboTriggers++;
          break;
        case 'ending':
          endingId = entry.data ? entry.data.endingId : null;
          if (entry.data && entry.data.state) {
            finalState = entry.data.state;
          }
          break;
        // stage 不计入核心统计
      }
    }

    return {
      totalChoices,
      totalChecks,
      checksPassed,
      checksFailed,
      randomEvents,
      comboTriggers,
      nodesVisited,
      endingId,
      finalState,
      playDuration: this._getDuration()
    };
  }
}

export default DebugLogger;
