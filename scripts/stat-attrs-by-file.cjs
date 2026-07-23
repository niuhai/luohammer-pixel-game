/**
 * 按文件统计属性净偏移
 */

const fs = require('fs');
const path = require('path');

const storyDir = path.resolve(__dirname, '../src/data/story');
const files = fs.readdirSync(storyDir).filter(f => f.endsWith('.js'));

console.log('文件'.padEnd(20) + 'pride'.padStart(8) + 'wealth'.padStart(8) + 'rep'.padStart(8) + 'fail'.padStart(8) + 'pres'.padStart(8) + 'trust'.padStart(8));

for (const file of files) {
  const content = fs.readFileSync(path.join(storyDir, file), 'utf-8');
  const stats = { pride: 0, wealth: 0, reputation: 0, failures: 0, pressure: 0, trust: 0 };

  const effectsRegex = /effects:\s*\{[\s\S]*?\}/g;
  const matches = [...content.matchAll(effectsRegex)];

  for (const match of matches) {
    const inner = match[0].replace(/effects:\s*\{/, '').replace(/\}$/, '');
    const pairRegex = /(\w+):\s*(-?\d+)/g;
    let m;
    while ((m = pairRegex.exec(inner)) !== null) {
      const attr = m[1];
      const val = parseInt(m[2]);
      if (stats[attr] !== undefined) stats[attr] += val;
    }
  }

  console.log(
    file.padEnd(20) +
    String(stats.pride).padStart(8) +
    String(stats.wealth).padStart(8) +
    String(stats.reputation).padStart(8) +
    String(stats.failures).padStart(8) +
    String(stats.pressure).padStart(8) +
    String(stats.trust).padStart(8)
  );
}
