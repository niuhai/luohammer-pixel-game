import fs from 'fs';
const c = fs.readFileSync('src/data/events-random.js', 'utf-8');
const r = /flag:\s*['"]([^'"]+)['"]/g;
let m;
const s = new Set();
while ((m = r.exec(c)) !== null) {
  s.add(m[1]);
}
console.log([...s].sort().join('\n'));
console.log('\nTotal:', s.size);
