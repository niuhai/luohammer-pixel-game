// 修复脚本：修正 logEnding 替换错误
const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'src', 'scenes', 'GameScene.js');
let src = fs.readFileSync(file, 'utf8');

const bad = `    this.scene.start('EndingScene', { state: this.state, ending: endingKey });
  }    try { this.debug.logEnding(endingKey, this.state); } catch(e) {}
    this.scene.start('EndingScene', { state: this.state, ending: endingKey });
  }`;

const good = `    try { this.debug.logEnding(endingKey, this.state); } catch(e) {}
    this.scene.start('EndingScene', { state: this.state, ending: endingKey });
  }`;

if (src.indexOf(bad) === -1) {
  throw new Error('[FIX] 未找到错误代码块');
}

src = src.replace(bad, good);
fs.writeFileSync(file, src, 'utf8');
console.log('[FIX] logEnding 代码块已修正');
