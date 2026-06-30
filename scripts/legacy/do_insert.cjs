const fs = require('fs');
const p = 'e:/ownWorkPlace/罗的十字路口/luohammer-pixel-game/src/data/story/10_act7.js';
const fp = 'e:/ownWorkPlace/罗的十字路口/luohammer-pixel-game/frag.txt';
let content = fs.readFileSync(p, 'utf8');
let frag = fs.readFileSync(fp, 'utf8');
frag = frag.replace(/^\uFEFF/, '');
frag = frag.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
frag = frag.trim();
const endPattern = '\n};\n';
const lastIdx = content.lastIndexOf(endPattern);
if (lastIdx === -1) { console.error('ERROR: end pattern not found'); process.exit(1); }
const before = content.substring(0, lastIdx);
const newContent = before + ',\n' + frag + '\n' + endPattern;
fs.writeFileSync(p, newContent, 'utf8');
console.log('SUCCESS. Old length:', content.length, 'New length:', newContent.length);
