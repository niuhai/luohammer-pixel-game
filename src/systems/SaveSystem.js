import { STAGES, getStageByNodeId } from '../data/stages.js';
import { STORY } from '../data/story.js';

const SAVE_KEY = 'luohammer_save';
const BACKUP_KEY = 'luohammer_save_backup';
const INTRO_SEEN_KEY = 'luohammer_intro_seen';
const SAVE_VERSION = 2;

// === 多槽位支持 ===
const SAVE_SLOTS_KEY = 'luohammer_save_slots'; // 仅存储手动槽位 { slot1: {state, meta}, ... }
const AUTO_META_KEY = 'luohammer_auto_meta';   // 自动槽位的元信息 { timestamp }
const AUTO_SLOT = 'auto';
const MANUAL_SLOTS = ['slot1', 'slot2', 'slot3'];
const ALL_SLOTS = [AUTO_SLOT, ...MANUAL_SLOTS];

const SLOT_LABELS = {
  auto: '自动存档',
  slot1: '存档 1',
  slot2: '存档 2',
  slot3: '存档 3'
};

/**
 * 安全地将 state 中的 Set/对象/undefined 字段转为 Array，确保 JSON.stringify 不会丢失数据
 */
function sanitizeForJSON(state) {
  if (!state || typeof state !== 'object') return state;
  const result = { ...state };
  result.flags = _toArray(result.flags);
  result.triggeredEvents = _toArray(result.triggeredEvents);
  result._version = SAVE_VERSION;
  return result;
}

/**
 * 校验 parsed 是否为合法存档对象（避免 localStorage 被篡改为原始值）
 */
// 游戏状态必含的核心属性键及其合法数值范围（与 ATTRIBUTES 对齐）
// 用于校验存档完整性，防止损坏数据导致游戏中途崩溃
const REQUIRED_ATTRS = ['pride', 'wealth', 'reputation'];
const ATTR_RANGE = { min: -50, max: 50 }; // 容忍迁移期数值越界，但拒绝明显异常值

function _isValidState(parsed) {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return false;
  // 必须存在核心属性且为有限数字
  for (const key of REQUIRED_ATTRS) {
    const v = parsed[key];
    if (typeof v !== 'number' || !Number.isFinite(v)) return false;
    if (v < ATTR_RANGE.min || v > ATTR_RANGE.max) return false;
  }
  // currentNode 必须是非空字符串（空字符串会导致 getStageByNodeId 返回 null 后续崩溃）
  if (typeof parsed.currentNode !== 'string' || parsed.currentNode.length === 0) return false;
  // currentNode 必须在 STORY 中实际存在（旧版存档节点改名后不致白屏崩溃）
  if (!STORY[parsed.currentNode]) return false;
  return true;
}

function _toArray(val) {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  if (val instanceof Set) return Array.from(val);
  if (typeof val === 'object') {
    try {
      const keys = Object.keys(val);
      if (keys.length > 0) return keys;
    } catch (e) {
      console.warn('[SaveSystem] _toArray fallback failed:', e);
    }
  }
  return [];
}

/**
 * 根据节点ID计算全局进度百分比（基于所有阶段节点的扁平索引）
 */
function _computeProgress(state) {
  if (!state || !state.currentNode) return 0;
  const allNodes = STAGES.flatMap(s => s.nodes || []);
  const idx = allNodes.indexOf(state.currentNode);
  if (idx >= 0 && allNodes.length > 0) {
    return Math.round((idx / allNodes.length) * 100);
  }
  // 回退：按阶段序号估算
  const stage = getStageByNodeId(state.currentNode);
  if (stage) {
    const stageIdx = STAGES.indexOf(stage);
    if (stageIdx >= 0 && STAGES.length > 0) {
      return Math.round((stageIdx / STAGES.length) * 100);
    }
  }
  return 0;
}

/**
 * 从 state 提取槽位元信息（章节/进度/属性快照）
 */
function _buildMeta(state, timestamp) {
  const stage = state && state.currentNode ? getStageByNodeId(state.currentNode) : null;
  return {
    timestamp: timestamp || Date.now(),
    chapter: stage ? stage.name : '未知',
    progress: _computeProgress(state),
    attributes: {
      pride: state ? (state.pride ?? 0) : 0,
      wealth: state ? (state.wealth ?? 0) : 0,
      reputation: state ? (state.reputation ?? 0) : 0,
      trust: state ? (state.trust ?? 0) : 0
    }
  };
}

/**
 * 读取手动槽位存储对象
 */
function _readSlotsStore() {
  try {
    const raw = localStorage.getItem(SAVE_SLOTS_KEY);
    if (raw) return JSON.parse(raw) || {};
  } catch (e) {
    console.warn('[SaveSystem] read slots store failed:', e);
  }
  return {};
}

function _writeSlotsStore(store) {
  try {
    localStorage.setItem(SAVE_SLOTS_KEY, JSON.stringify(store || {}));
    return true;
  } catch (e) {
    console.error('[SaveSystem] write slots store failed:', e);
    return false;
  }
}

function _readAutoMeta() {
  try {
    const raw = localStorage.getItem(AUTO_META_KEY);
    if (raw) return JSON.parse(raw) || {};
  } catch (e) {}
  return {};
}

function _writeAutoMeta(meta) {
  try {
    localStorage.setItem(AUTO_META_KEY, JSON.stringify(meta || {}));
  } catch (e) {
    console.warn('[SaveSystem] write auto meta failed:', e);
  }
}

export class SaveSystem {
  /**
   * 保存游戏状态到指定槽位。
   * - auto 槽位：写入 SAVE_KEY（并向 BACKUP_KEY 备份），保持与旧版本完全兼容；
   *   同时写入 AUTO_META_KEY 记录时间戳，供 getSlotInfo 使用。
   * - 手动槽位：写入 SAVE_SLOTS_KEY 下的 { state, meta } 结构。
   * @param {object} state 游戏状态
   * @param {string} [slotId='auto'] 槽位ID
   * @returns {boolean} 是否保存成功
   */
  save(state, slotId = AUTO_SLOT) {
    try {
      const sanitized = sanitizeForJSON(state);

      if (slotId === AUTO_SLOT) {
        const jsonStr = JSON.stringify(sanitized);

        // 写入前备份旧存档
        try {
          const oldData = localStorage.getItem(SAVE_KEY);
          if (oldData) {
            localStorage.setItem(BACKUP_KEY, oldData);
          }
        } catch (e) {
          console.warn('[SaveSystem] Backup failed (non-fatal):', e);
        }

        localStorage.setItem(SAVE_KEY, jsonStr);
        // 同步写入 auto 元信息（时间戳）
        _writeAutoMeta({ timestamp: Date.now() });
        return true;
      }

      // 手动槽位
      if (!MANUAL_SLOTS.includes(slotId)) {
        console.warn('[SaveSystem] Unknown slotId:', slotId);
        return false;
      }
      const store = _readSlotsStore();
      store[slotId] = {
        state: sanitized,
        meta: _buildMeta(sanitized, Date.now())
      };
      return _writeSlotsStore(store);
    } catch (e) {
      console.error('[SaveSystem] Save failed — progress NOT saved:', e);
      return false;
    }
  }

  /**
   * 加载游戏状态。
   * - auto 槽位：主存档解析失败时自动尝试备份（向后兼容旧存档）。
   * - 手动槽位：从 SAVE_SLOTS_KEY 读取。
   * @param {string} [slotId='auto']
   * @returns {object|null}
   */
  load(slotId = AUTO_SLOT) {
    if (slotId === AUTO_SLOT) {
      // 尝试主存档
      try {
        const data = localStorage.getItem(SAVE_KEY);
        if (data) {
          const parsed = JSON.parse(data);
          if (_isValidState(parsed)) {
            const migrated = this._migrate(parsed);
            migrated.flags = _toArray(migrated.flags);
            migrated.triggeredEvents = _toArray(migrated.triggeredEvents);
            return migrated;
          }
        }
      } catch (e) {
        console.warn('[SaveSystem] Main save corrupted, trying backup:', e);
      }

      // 主存档失败，尝试备份
      try {
        const backupData = localStorage.getItem(BACKUP_KEY);
        if (backupData) {
          const parsed = JSON.parse(backupData);
          if (_isValidState(parsed)) {
            const migrated = this._migrate(parsed);
            migrated.flags = _toArray(migrated.flags);
            migrated.triggeredEvents = _toArray(migrated.triggeredEvents);
            console.info('[SaveSystem] Recovered from backup save.');
            return migrated;
          }
        }
      } catch (e) {
        console.warn('[SaveSystem] Backup save also corrupted:', e);
      }
      return null;
    }

    // 手动槽位
    if (!MANUAL_SLOTS.includes(slotId)) {
      console.warn('[SaveSystem] Unknown slotId:', slotId);
      return null;
    }
    const store = _readSlotsStore();
    const entry = store[slotId];
    if (!entry || !entry.state) return null;
    try {
      const parsed = entry.state;
      if (!_isValidState(parsed)) return null;
      const migrated = this._migrate(parsed);
      migrated.flags = _toArray(migrated.flags);
      migrated.triggeredEvents = _toArray(migrated.triggeredEvents);
      return migrated;
    } catch (e) {
      console.warn('[SaveSystem] Slot load corrupted:', slotId, e);
      return null;
    }
  }

  /**
   * 存档版本迁移钩子。
   * 当 SAVE_VERSION 升级且涉及 breaking change 时，在此实现 v(n) → v(n+1) 的字段调整。
   * 当前版本为 v2，无历史 breaking change，仅做版本号兜底。
   * @param {object} state 已 JSON.parse 的存档对象
   * @returns {object} 迁移后的存档对象（同一引用或新对象）
   */
  _migrate(state) {
    if (!state || typeof state !== 'object') return state;
    const ver = typeof state._version === 'number' ? state._version : 0;
    // 未来如需 v1 → v2 迁移，可在此分支：
    // if (ver < 2) { state.flags = state.flags || []; ... }
    // 兜底：确保最新版本号
    if (ver < SAVE_VERSION) {
      state._version = SAVE_VERSION;
    }
    return state;
  }

  /**
   * 清除指定槽位的存档。
   * @param {string} [slotId='auto']
   */
  clear(slotId = AUTO_SLOT) {
    try {
      if (slotId === AUTO_SLOT) {
        localStorage.removeItem(SAVE_KEY);
        localStorage.removeItem(BACKUP_KEY);
        localStorage.removeItem(AUTO_META_KEY);
        return;
      }
      if (!MANUAL_SLOTS.includes(slotId)) {
        console.warn('[SaveSystem] Unknown slotId:', slotId);
        return;
      }
      const store = _readSlotsStore();
      delete store[slotId];
      _writeSlotsStore(store);
    } catch (e) {
      console.warn('[SaveSystem] Clear failed:', e);
    }
  }

  /**
   * 判断指定槽位是否有存档。
   * @param {string} [slotId='auto']
   * @returns {boolean}
   */
  hasSave(slotId = AUTO_SLOT) {
    try {
      if (slotId === AUTO_SLOT) {
        return localStorage.getItem(SAVE_KEY) !== null;
      }
      if (!MANUAL_SLOTS.includes(slotId)) return false;
      const store = _readSlotsStore();
      return !!(store[slotId] && store[slotId].state);
    } catch (e) {
      return false;
    }
  }

  /**
   * 判断是否存在任意存档（auto 或手动）。
   * @returns {boolean}
   */
  hasAnySave() {
    if (this.hasSave(AUTO_SLOT)) return true;
    return MANUAL_SLOTS.some(id => this.hasSave(id));
  }

  /**
   * 获取指定槽位的预览信息。
   * @param {string} [slotId='auto']
   * @returns {{ slotId: string, label: string, empty: boolean, chapter: string, progress: number, timestamp: number|null, attributes: object }}
   */
  getSlotInfo(slotId = AUTO_SLOT) {
    const base = {
      slotId,
      label: SLOT_LABELS[slotId] || slotId,
      empty: true,
      chapter: '',
      progress: 0,
      timestamp: null,
      attributes: { pride: 0, wealth: 0, reputation: 0, trust: 0 }
    };

    if (!ALL_SLOTS.includes(slotId)) return base;

    if (slotId === AUTO_SLOT) {
      const state = this.load(AUTO_SLOT);
      if (!state) return base;
      const meta = _readAutoMeta();
      const built = _buildMeta(state);
      return {
        ...base,
        empty: false,
        chapter: built.chapter,
        progress: built.progress,
        timestamp: meta.timestamp || null,
        attributes: built.attributes
      };
    }

    // 手动槽位
    const store = _readSlotsStore();
    const entry = store[slotId];
    if (!entry || !entry.state) return base;
    const meta = entry.meta || _buildMeta(entry.state);
    return {
      ...base,
      empty: false,
      chapter: meta.chapter || '',
      progress: typeof meta.progress === 'number' ? meta.progress : 0,
      timestamp: meta.timestamp || null,
      attributes: meta.attributes || base.attributes
    };
  }

  /**
   * 获取所有 4 个槽位的预览信息（auto + slot1..3）。
   * @returns {Array<object>}
   */
  getAllSlotsInfo() {
    return ALL_SLOTS.map(id => this.getSlotInfo(id));
  }

  /**
   * 保存到指定槽位（save 的语义别名，便于外部调用区分）。
   */
  saveToSlot(slotId, state) {
    return this.save(state, slotId);
  }

  /**
   * 从指定槽位加载（load 的语义别名）。
   */
  loadFromSlot(slotId) {
    return this.load(slotId);
  }

  isIntroSeen() {
    try {
      return localStorage.getItem(INTRO_SEEN_KEY) === '1';
    } catch (e) {
      return false;
    }
  }

  markIntroSeen() {
    try {
      localStorage.setItem(INTRO_SEEN_KEY, '1');
    } catch (e) {
      console.warn('[SaveSystem] markIntroSeen failed:', e);
    }
  }

  // === 已读节点追踪（用于快进已读对话）===
  // 用对象 key 存储实现 O(1) 查询，相比数组 includes 的 O(n) 在 500 节点规模下快 100x
  // 存储格式：{ nodeId1: 1, nodeId2: 1, ... }，兼容旧的数组格式读取
  static _seenNodesCache = null;

  static getSeenNodes() {
    if (SaveSystem._seenNodesCache) return SaveSystem._seenNodesCache;
    try {
      const raw = localStorage.getItem('luohammer_seen_nodes');
      if (!raw) return (SaveSystem._seenNodesCache = {});
      const parsed = JSON.parse(raw);
      // 兼容旧数组格式 → 转为对象
      if (Array.isArray(parsed)) {
        const obj = {};
        for (const id of parsed) obj[id] = 1;
        return (SaveSystem._seenNodesCache = obj);
      }
      return (SaveSystem._seenNodesCache = parsed || {});
    } catch (e) { return (SaveSystem._seenNodesCache = {}); }
  }

  static markNodeSeen(nodeId) {
    try {
      const seen = SaveSystem.getSeenNodes();
      if (seen[nodeId]) return; // 已存在，无需写入
      seen[nodeId] = 1;
      // 限制大小：超过 500 个 key 时，按添加顺序淘汰最旧的
      const keys = Object.keys(seen);
      if (keys.length > 500) {
        const toRemove = keys.length - 500;
        for (let i = 0; i < toRemove; i++) delete seen[keys[i]];
      }
      localStorage.setItem('luohammer_seen_nodes', JSON.stringify(seen));
    } catch (e) {}
  }

  static isNodeSeen(nodeId) {
    try {
      const seen = SaveSystem.getSeenNodes();
      return !!seen[nodeId];
    } catch (e) { return false; }
  }

  clearIntroSeen() {
    try {
      localStorage.removeItem(INTRO_SEEN_KEY);
    } catch (e) {
      console.warn('[SaveSystem] clearIntroSeen failed:', e);
    }
  }
}

// 暴露槽位常量供 UI 使用
export { AUTO_SLOT, MANUAL_SLOTS, ALL_SLOTS, SLOT_LABELS };
