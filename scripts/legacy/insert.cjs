const fs = require('fs');
const p = 'e:/ownWorkPlace/罗的十字路口/luohammer-pixel-game/src/data/story/10_act7.js';
const fragmentPath = 'e:/ownWorkPlace/罗的十字路口/luohammer-pixel-game/new_nodes_fragment.txt';
let content = fs.readFileSync(p, 'utf8');
let fragment = fs.readFileSync(fragmentPath, 'utf8');
const endPattern = '\n};\n';
const lastIdx = content.lastIndexOf(endPattern);
if (lastIdx === -1) { console.error('No end pattern'); process.exit(1); }
const before = content.substring(0, lastIdx);
const newContent = before + ',\n' + fragment + '\n' + endPattern;
fs.writeFileSync(p, newContent, 'utf8');
console.log('Done. Old:', content.length, 'New:', newContent.length);
