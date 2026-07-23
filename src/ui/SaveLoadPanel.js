import { SaveSystem, AUTO_SLOT } from '../systems/SaveSystem.js';

/**
 * 存档/读档面板
 *
 * 全屏展示 4 个存档槽位（1 自动 + 3 手动），支持保存/读取/删除。
 *
 * 用法：
 *   showSaveLoadPanel({
 *     mode: 'manage' | 'save',   // manage=标题页（仅读取/删除）；save=游戏内（可保存到手动槽）
 *     currentState,              // save 模式下要保存的已序列化状态
 *     saveSystem,                // SaveSystem 实例（可选，未传则新建）
 *     onLoad(slotId, state),     // 用户点击"读取"后回调
 *     onClose()
 *   });
 *
 * 样式：动态注入 <style>（幂等），复用全局 CSS 变量（--color-gold 等），像素风。
 */

const STYLE_ID = 'ui-saveload-panel-style';

const PANEL_CSS = `
  .ui-saveload-overlay {
    position: fixed;
    inset: 0;
    display: flex;
    justify-content: center;
    align-items: center;
    background: rgba(0, 0, 0, 0.86);
    z-index: 200;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.22s ease;
    padding: clamp(8px, 2vw, 20px);
    font-family: 'Luohammer UI', "Microsoft YaHei", "PingFang SC", monospace;
  }
  .ui-saveload-overlay.visible {
    opacity: 1;
    pointer-events: auto;
  }
  .ui-saveload-card {
    width: min(820px, 96vw);
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    background: linear-gradient(180deg, var(--color-bg-panel), var(--color-bg-dark));
    border: 2px solid var(--color-gold);
    box-shadow: 0 0 0 1px rgba(0,0,0,0.6), 0 8px 32px rgba(0,0,0,0.7);
    padding: clamp(14px, 2.4vw, 24px);
  }
  .ui-saveload-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding-bottom: 12px;
    border-bottom: 1px solid rgba(240,192,64,0.25);
    margin-bottom: 14px;
  }
  .ui-saveload-title {
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--color-gold);
    font-size: clamp(16px, 2.4vw, 20px);
    font-weight: 700;
    letter-spacing: 2px;
  }
  .ui-saveload-subtitle {
    color: var(--color-text-secondary);
    font-size: clamp(11px, 1.5vw, 13px);
  }
  .ui-saveload-close {
    width: 32px;
    height: 32px;
    line-height: 30px;
    text-align: center;
    background: transparent;
    border: 1px solid var(--color-text-dim);
    color: var(--color-text-light);
    cursor: pointer;
    font-size: 16px;
    transition: all 0.15s;
    padding: 0;
  }
  .ui-saveload-close:hover {
    border-color: var(--color-gold);
    color: var(--color-gold);
  }
  .ui-saveload-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: clamp(10px, 1.6vw, 16px);
    overflow-y: auto;
    padding: 4px;
    margin: -4px;
  }
  @media (max-width: 600px) {
    .ui-saveload-grid { grid-template-columns: 1fr; }
  }
  .ui-saveload-slot {
    background: rgba(22, 33, 62, 0.6);
    border: 1.5px solid rgba(240,192,64,0.25);
    padding: clamp(10px, 1.6vw, 14px);
    display: flex;
    flex-direction: column;
    gap: 8px;
    transition: border-color 0.15s;
  }
  .ui-saveload-slot:hover {
    border-color: rgba(240,192,64,0.5);
  }
  .ui-saveload-slot.is-auto {
    border-color: rgba(64, 192, 192, 0.35);
  }
  .ui-saveload-slot.is-empty {
    opacity: 0.7;
  }
  .ui-saveload-slot-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }
  .ui-saveload-slot-name {
    color: var(--color-gold);
    font-size: clamp(13px, 1.8vw, 15px);
    font-weight: 700;
    letter-spacing: 1px;
  }
  .ui-saveload-slot.is-auto .ui-saveload-slot-name {
    color: var(--color-trust);
  }
  .ui-saveload-slot-time {
    color: var(--color-text-muted);
    font-size: clamp(10px, 1.3vw, 12px);
  }
  .ui-saveload-slot-body {
    flex: 1;
    min-height: 56px;
  }
  .ui-saveload-slot-chapter {
    color: var(--color-text-light);
    font-size: clamp(12px, 1.6vw, 14px);
    margin-bottom: 4px;
  }
  .ui-saveload-slot-progress {
    display: inline-block;
    color: var(--color-gold);
    font-weight: 700;
    margin-left: 4px;
  }
  .ui-saveload-slot-attrs {
    display: flex;
    flex-wrap: wrap;
    gap: 6px 10px;
    font-size: clamp(11px, 1.4vw, 12px);
  }
  .ui-saveload-attr {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    color: var(--color-text-secondary);
  }
  .ui-saveload-attr b { font-weight: 700; }
  .ui-saveload-attr.pride b { color: var(--color-pride); }
  .ui-saveload-attr.wealth b { color: var(--color-wealth); }
  .ui-saveload-attr.reputation b { color: var(--color-reputation); }
  .ui-saveload-attr.trust b { color: var(--color-trust); }
  .ui-saveload-slot-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 16px 0;
    color: var(--color-text-muted);
    opacity: 0.5;
    transition: opacity 0.2s;
    border: 1px dashed rgba(240, 192, 64, 0.15);
    border-radius: var(--radius-sharp);
    margin: 8px 0;
  }
  .ui-saveload-slot-empty .empty-icon {
    font-size: 24px;
    color: var(--color-text-muted);
  }
  .ui-saveload-slot-empty .empty-text {
    font-size: 12px;
    font-style: italic;
    letter-spacing: 0.1em;
  }
  .ui-saveload-slot:hover .ui-saveload-slot-empty {
    opacity: 0.8;
  }
  .ui-saveload-slot-actions {
    display: flex;
    gap: 8px;
    margin-top: 4px;
  }
  .ui-saveload-btn {
    flex: 1;
    padding: 7px 10px;
    font-family: inherit;
    font-size: clamp(11px, 1.5vw, 13px);
    background: transparent;
    border: 1px solid #555;
    color: var(--color-text-light);
    cursor: pointer;
    transition: all 0.15s;
    letter-spacing: 1px;
  }
  .ui-saveload-btn:hover:not(:disabled) {
    border-color: var(--color-gold);
    color: var(--color-gold);
    background: rgba(240,192,64,0.08);
  }
  .ui-saveload-btn:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }
  .ui-saveload-btn.primary {
    border-color: var(--color-gold);
    color: var(--color-gold);
    background: rgba(240,192,64,0.1);
  }
  .ui-saveload-btn.primary:hover:not(:disabled) {
    background: rgba(240,192,64,0.2);
  }
  .ui-saveload-btn.danger:hover:not(:disabled) {
    border-color: var(--color-danger);
    color: var(--color-danger);
    background: rgba(224,64,64,0.08);
  }
  .ui-saveload-confirm {
    position: absolute;
    inset: 0;
    display: none;
    align-items: center;
    justify-content: center;
    background: rgba(0,0,0,0.7);
    z-index: 210;
  }
  .ui-saveload-confirm.visible { display: flex; }
  .ui-saveload-confirm-box {
    background: var(--color-bg-panel);
    border: 2px solid var(--color-gold);
    padding: clamp(18px, 3vw, 26px);
    max-width: min(90vw, 340px);
    text-align: center;
  }
  .ui-saveload-confirm-text {
    color: var(--color-text-primary);
    font-size: clamp(13px, 1.8vw, 15px);
    margin-bottom: 16px;
    line-height: 1.6;
  }
  .ui-saveload-confirm-btns {
    display: flex;
    gap: 10px;
    justify-content: center;
  }
`;

function ensureStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = PANEL_CSS;
  document.head.appendChild(style);
}

/**
 * 将时间戳格式化为"X分钟前/X小时前/X天前"等相对时间。
 */
function formatTimeAgo(timestamp) {
  if (!timestamp) return '';
  const diff = Date.now() - timestamp;
  if (diff < 0) return '刚刚';
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return '刚刚';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} 分钟前`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} 小时前`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day} 天前`;
  const d = new Date(timestamp);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

/**
 * 打开存档/读档面板。
 * @param {object} options
 * @param {'manage'|'save'} [options.mode='manage']
 * @param {object|null} [options.currentState=null]
 * @param {SaveSystem} [options.saveSystem]
 * @param {(slotId:string, state:object)=>void} [options.onLoad]
 * @param {()=>void} [options.onClose]
 */
export function showSaveLoadPanel(options = {}) {
  const mode = options.mode === 'save' ? 'save' : 'manage';
  const currentState = options.currentState || null;
  const save = options.saveSystem instanceof SaveSystem
    ? options.saveSystem
    : new SaveSystem();
  const onLoad = typeof options.onLoad === 'function' ? options.onLoad : null;
  const onClose = typeof options.onClose === 'function' ? options.onClose : null;

  ensureStyle();

  // 移除已存在的面板
  const existing = document.getElementById('ui-saveload-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'ui-saveload-overlay';
  overlay.className = 'ui-saveload-overlay';

  const titleText = mode === 'save' ? '保存游戏' : '存档管理';

  overlay.innerHTML = `
    <div class="ui-saveload-card">
      <div class="ui-saveload-header">
        <div>
          <div class="ui-saveload-title"><span>◈</span><span>${titleText}</span></div>
          <div class="ui-saveload-subtitle">${
            mode === 'save'
              ? '选择一个手动槽位保存进度（自动存档只读）'
              : '查看与读取你的存档'
          }</div>
        </div>
        <button class="ui-saveload-close" aria-label="关闭">✕</button>
      </div>
      <div class="ui-saveload-grid" id="ui-saveload-grid"></div>
      <div class="ui-saveload-confirm" id="ui-saveload-confirm">
        <div class="ui-saveload-confirm-box">
          <div class="ui-saveload-confirm-text" id="ui-saveload-confirm-text"></div>
          <div class="ui-saveload-confirm-btns">
            <button class="ui-saveload-btn" id="ui-saveload-confirm-cancel">取消</button>
            <button class="ui-saveload-btn primary" id="ui-saveload-confirm-ok">确认覆盖</button>
          </div>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('visible'));

  const grid = overlay.querySelector('#ui-saveload-grid');
  const confirmEl = overlay.querySelector('#ui-saveload-confirm');
  const confirmText = overlay.querySelector('#ui-saveload-confirm-text');
  const confirmOk = overlay.querySelector('#ui-saveload-confirm-ok');
  const confirmCancel = overlay.querySelector('#ui-saveload-confirm-cancel');

  // === 确认弹窗 ===
  let pendingAction = null;
  const showConfirm = (text, action) => {
    pendingAction = action;
    confirmText.innerHTML = text;
    confirmEl.classList.add('visible');
  };
  const hideConfirm = () => {
    pendingAction = null;
    confirmEl.classList.remove('visible');
  };
  confirmCancel.addEventListener('click', hideConfirm);
  confirmOk.addEventListener('click', () => {
    if (typeof pendingAction === 'function') pendingAction();
    hideConfirm();
  });

  // === 关闭 ===
  let closed = false;
  const closePanel = () => {
    if (closed) return;
    closed = true;
    overlay.classList.remove('visible');
    document.removeEventListener('keydown', escHandler);
    setTimeout(() => {
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      if (onClose) onClose();
    }, 220);
  };

  const escHandler = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      if (confirmEl.classList.contains('visible')) {
        hideConfirm();
        return;
      }
      closePanel();
    }
  };
  document.addEventListener('keydown', escHandler);

  overlay.querySelector('.ui-saveload-close').addEventListener('click', closePanel);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closePanel();
  });

  // === 渲染槽位卡片 ===
  function renderSlots() {
    grid.innerHTML = '';
    const infos = save.getAllSlotsInfo();
    infos.forEach(info => renderSlot(info));
  }

  function renderSlot(info) {
    const isAuto = info.slotId === AUTO_SLOT;
    // save 模式下，auto 槽位只读（不可保存）；manage 模式下不提供保存
    const canSave = mode === 'save' && !!currentState && !isAuto;
    const canLoad = !info.empty;
    const canDelete = !info.empty;

    const card = document.createElement('div');
    card.className = 'ui-saveload-slot' + (isAuto ? ' is-auto' : '') + (info.empty ? ' is-empty' : '');

    const attrs = info.attributes || {};
    const attrRow = `
      <div class="ui-saveload-slot-attrs">
        <span class="ui-saveload-attr pride">骄傲<b>${attrs.pride ?? 0}</b></span>
        <span class="ui-saveload-attr wealth">财富<b>${attrs.wealth ?? 0}</b></span>
        <span class="ui-saveload-attr reputation">名望<b>${attrs.reputation ?? 0}</b></span>
        <span class="ui-saveload-attr trust">信任<b>${attrs.trust ?? 0}</b></span>
      </div>`;

    const bodyHtml = info.empty
      ? `<div class="ui-saveload-slot-empty">
          <span class="empty-icon">▫</span>
          <span class="empty-text">空槽位</span>
        </div>`
      : `
        <div class="ui-saveload-slot-chapter">${info.chapter || '未知章节'}<span class="ui-saveload-slot-progress">${info.progress ?? 0}%</span></div>
        ${attrRow}
      `;

    card.innerHTML = `
      <div class="ui-saveload-slot-head">
        <div class="ui-saveload-slot-name">${info.label}</div>
        <div class="ui-saveload-slot-time">${formatTimeAgo(info.timestamp)}</div>
      </div>
      <div class="ui-saveload-slot-body">${bodyHtml}</div>
      <div class="ui-saveload-slot-actions"></div>
    `;

    const actions = card.querySelector('.ui-saveload-slot-actions');

    // 保存按钮
    if (canSave) {
      const saveBtn = document.createElement('button');
      saveBtn.className = 'ui-saveload-btn primary';
      saveBtn.textContent = info.empty ? '保存' : '覆盖保存';
      saveBtn.addEventListener('click', () => {
        // 防抖：保存进行中禁用按钮，避免 showConfirm 期间重复触发覆盖 pendingAction
        if (saveBtn.disabled) return;
        const doSave = () => {
          saveBtn.disabled = true;
          const ok = save.saveToSlot(info.slotId, currentState);
          if (ok) {
            renderSlots();
            _toast('已保存到 ' + info.label);
          } else {
            _toast('保存失败，请重试');
          }
          saveBtn.disabled = false;
        };
        if (!info.empty) {
          showConfirm(`此槽位已有存档（<b style="color:var(--color-gold)">${info.label}</b>），确定覆盖？`, doSave);
        } else {
          doSave();
        }
      });
      actions.appendChild(saveBtn);
    }

    // 读取按钮
    if (canLoad) {
      const loadBtn = document.createElement('button');
      loadBtn.className = 'ui-saveload-btn';
      loadBtn.textContent = '读取';
      loadBtn.addEventListener('click', () => {
        const state = save.loadFromSlot(info.slotId);
        if (!state) {
          _toast('读取失败：存档已损坏');
          return;
        }
        if (onLoad) {
          overlay.classList.remove('visible');
          document.removeEventListener('keydown', escHandler);
          setTimeout(() => {
            if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
            onLoad(info.slotId, state);
          }, 180);
        } else {
          _toast('已读取 ' + info.label);
        }
      });
      actions.appendChild(loadBtn);
    }

    // 删除按钮
    if (canDelete) {
      const delBtn = document.createElement('button');
      delBtn.className = 'ui-saveload-btn danger';
      delBtn.textContent = '删除';
      delBtn.addEventListener('click', () => {
        showConfirm(`确定删除 <b style="color:var(--color-gold)">${info.label}</b>？此操作不可恢复。`, () => {
          save.clear(info.slotId);
          renderSlots();
          _toast('已删除 ' + info.label);
        });
      });
      actions.appendChild(delBtn);
    }

    if (actions.children.length === 0) {
      const hint = document.createElement('div');
      hint.style.cssText = 'flex:1;text-align:center;color:var(--color-text-muted);font-size:12px;padding:7px 0;';
      hint.textContent = isAuto ? '自动存档' : '—';
      actions.appendChild(hint);
    }

    grid.appendChild(card);
  }

  renderSlots();
}

/**
 * 轻量级 toast 提示（与 ToastSystem 解耦，避免额外依赖）
 */
function _toast(msg) {
  let el = document.getElementById('ui-saveload-toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'ui-saveload-toast';
    el.style.cssText = `
      position: fixed;
      left: 50%;
      bottom: 12vh;
      transform: translateX(-50%);
      background: rgba(10,10,26,0.92);
      border: 1px solid var(--color-gold);
      color: var(--color-gold);
      padding: 8px 16px;
      font-size: 13px;
      font-family: 'Luohammer UI', "Microsoft YaHei", monospace;
      z-index: 220;
      opacity: 0;
      transition: opacity 0.2s;
      pointer-events: none;
      letter-spacing: 1px;
    `;
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.style.opacity = '1';
  clearTimeout(el._t);
  el._t = setTimeout(() => { el.style.opacity = '0'; }, 1800);
}
