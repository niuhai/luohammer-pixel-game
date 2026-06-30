// 临时补丁脚本：为 BootScene.js 添加隐藏调试开关 + DEBUG 标识
const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'src', 'scenes', 'BootScene.js');
let src = fs.readFileSync(file, 'utf8');
const before = src;

function replaceOnce(label, find, insert, where = 'after') {
  if (src.indexOf(find) === -1) {
    throw new Error(`[PATCH] 找不到锚点: ${label}\n  锚点: ${JSON.stringify(find).slice(0, 120)}`);
  }
  if (where === 'after') {
    src = src.replace(find, find + insert);
  } else if (where === 'before') {
    src = src.replace(find, insert + find);
  } else if (where === 'replace') {
    src = src.replace(find, insert);
  }
  console.log('  [OK] ' + label);
}

// 1. 添加 toast import
replaceOnce(
  'import toast',
  "import { MetaProgression } from '../systems/MetaProgression.js';",
  "\nimport { toast } from '../systems/ToastSystem.js';"
);

// 2. 在 overlay.classList.add('visible') 之后调用 _setupDebugToggle
replaceOnce(
  'setup debug toggle call',
  "    overlay.classList.add('visible');\n",
  "    overlay.classList.add('visible');\n\n    // === 隐藏调试开关 + DEBUG 标识 ===\n    this._setupDebugToggle(overlay);\n"
);

// 3. 在 shutdown() 方法之前添加 _setupDebugToggle 和 _updateDebugBadge 方法
const newMethods = `
  /**
   * 隐藏调试开关：连续点击标题画面右下角 5 次切换调试模式
   * 同时管理 DEBUG 标识的显示
   */
  _setupDebugToggle(overlay) {
    if (!overlay) return;

    // === DEBUG 标识 ===
    let badge = document.getElementById('ui-boot-debug-badge');
    if (!badge) {
      badge = document.createElement('div');
      badge.id = 'ui-boot-debug-badge';
      badge.style.cssText = \`
        position: absolute;
        bottom: 8px;
        left: 8px;
        padding: 2px 8px;
        background: rgba(224, 64, 64, 0.85);
        color: #fff;
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 1px;
        border-radius: 3px;
        z-index: 20;
        pointer-events: none;
        display: none;
        font-family: 'Luohammer UI', monospace;
      \`;
      badge.textContent = 'DEBUG';
      overlay.appendChild(badge);
    }
    this._debugBadge = badge;
    this._updateDebugBadge();

    // === 隐藏点击区域（右下角 80x80） ===
    let zone = document.getElementById('ui-boot-debug-zone');
    if (!zone) {
      zone = document.createElement('div');
      zone.id = 'ui-boot-debug-zone';
      zone.style.cssText = \`
        position: absolute;
        bottom: 0;
        right: 0;
        width: 80px;
        height: 80px;
        z-index: 19;
        cursor: default;
        background: transparent;
      \`;
      overlay.appendChild(zone);
    }
    this._debugZone = zone;

    this._debugClickCount = 0;
    this._debugClickTimer = null;

    this._debugClickHandler = () => {
      this._debugClickCount++;
      if (this._debugClickTimer) clearTimeout(this._debugClickTimer);
      this._debugClickTimer = setTimeout(() => {
        this._debugClickCount = 0;
      }, 3000);

      if (this._debugClickCount >= 5) {
        this._debugClickCount = 0;
        if (this._debugClickTimer) {
          clearTimeout(this._debugClickTimer);
          this._debugClickTimer = null;
        }
        this._toggleDebugMode();
      }
    };
    zone.addEventListener('click', this._debugClickHandler);
  }

  /**
   * 切换调试模式
   */
  _toggleDebugMode() {
    const key = 'luohammer_debug';
    let enabled = false;
    try { enabled = localStorage.getItem(key) === '1'; } catch (e) {}
    try {
      if (enabled) {
        localStorage.removeItem(key);
        toast.info('调试模式已关闭');
      } else {
        localStorage.setItem(key, '1');
        toast.success('调试模式已开启\\n可在控制台使用 __luohammerDebug 调试命令', 4000);
      }
    } catch (e) {}
    this._updateDebugBadge();
  }

  /**
   * 更新 DEBUG 标识显示
   */
  _updateDebugBadge() {
    if (!this._debugBadge) return;
    let enabled = false;
    try { enabled = localStorage.getItem('luohammer_debug') === '1'; } catch (e) {}
    this._debugBadge.style.display = enabled ? 'block' : 'none';
  }

`;

replaceOnce(
  'add debug methods',
  '  /**\n   * 场景关闭时清理资源，防止内存泄漏\n   */\n  shutdown() {',
  newMethods,
  'before'
);

// 4. 在 shutdown() 中添加清理逻辑
replaceOnce(
  'cleanup debug in shutdown',
  "    if (this._soundToggleBtn && this._soundToggleBtn.parentNode) {\n      this._soundToggleBtn.parentNode.removeChild(this._soundToggleBtn);\n      this._soundToggleBtn = null;\n    }\n  }",
  "    if (this._soundToggleBtn && this._soundToggleBtn.parentNode) {\n      this._soundToggleBtn.parentNode.removeChild(this._soundToggleBtn);\n      this._soundToggleBtn = null;\n    }\n    // 清理调试开关相关元素\n    if (this._debugClickTimer) {\n      clearTimeout(this._debugClickTimer);\n      this._debugClickTimer = null;\n    }\n    if (this._debugZone && this._debugZone.parentNode) {\n      this._debugZone.parentNode.removeChild(this._debugZone);\n      this._debugZone = null;\n    }\n    if (this._debugBadge && this._debugBadge.parentNode) {\n      this._debugBadge.parentNode.removeChild(this._debugBadge);\n      this._debugBadge = null;\n    }\n  }"
);

if (src === before) {
  throw new Error('[PATCH] 未发生任何替换');
}

fs.writeFileSync(file, src, 'utf8');
console.log('[PATCH] BootScene.js 修改完成');
