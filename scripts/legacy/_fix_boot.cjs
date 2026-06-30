const fs = require('fs');
const f = 'e:/ownWorkPlace/罗的十字路口/luohammer-pixel-game/src/scenes/BootScene.js';
let c = fs.readFileSync(f, 'utf8');

// Fix pre-existing duplicate block in shutdown() method
// Line 626 has a premature '}' closing the method, followed by a duplicate if block
const old = "  }    if (this._soundToggleBtn && this._soundToggleBtn.parentNode) {\n      this._soundToggleBtn.parentNode.removeChild(this._soundToggleBtn);\n      this._soundToggleBtn = null;\n    }\n    // 清理调试开关相关元素";
const neu = "    // 清理调试开关相关元素";

if (!c.includes(old)) {
  console.log('DUPLICATE BLOCK NOT FOUND in BootScene.js');
  process.exit(1);
}

c = c.replace(old, neu);
fs.writeFileSync(f, c, 'utf8');
console.log('Syntax fix applied: removed duplicate block in BootScene.js shutdown()');
