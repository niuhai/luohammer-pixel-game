import fs from 'fs';
import path from 'path';

function walk(dir) {
  const out = [];
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) out.push(...walk(p));
    else if (f.endsWith('.js')) out.push(p);
  }
  return out;
}

const files = walk('src');
const re = /(style|cssText)\s*[:=]\s*[`'"][^`'"]*#[0-9a-fA-F]{3,6}/g;
let count = 0;
for (const f of files) {
  const c = fs.readFileSync(f, 'utf8');
  const lines = c.split('\n');
  lines.forEach((l, i) => {
    re.lastIndex = 0;
    if (re.test(l)) {
      console.log(`${f}:${i + 1}: ${l.trim().substring(0, 200)}`);
      count++;
    }
  });
}
console.log(`\nTotal: ${count} matches`);
