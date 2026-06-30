const fs = require('fs');
const path = require('path');

const storyDir = path.join(__dirname, '..', 'src', 'data', 'story');
const files = fs.readdirSync(storyDir).filter(f => f.endsWith('.js'));
const achievements = new Map();

for (const file of files) {
  const text = fs.readFileSync(path.join(storyDir, file), 'utf8');
  // Match achievement: '...' or achievement: "..." or achievement: [...]
  const re = /achievement:\s*(\[[\s\S]*?\]|['"][^'"]*['"])/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const raw = m[1].trim();
    let names = [];
    if (raw.startsWith('[')) {
      const sre = /['"]([^'"]+)['"]/g;
      let sm;
      while ((sm = sre.exec(raw)) !== null) names.push(sm[1]);
    } else {
      names.push(raw.replace(/^['"]|['"]$/g, ''));
    }
    for (const name of names) {
      if (!name) continue;
      if (!achievements.has(name)) achievements.set(name, new Set());
      achievements.get(name).add(file);
    }
  }
}

const list = Array.from(achievements.entries()).sort((a,b)=>a[0].localeCompare(b[0]));
console.log(`Found ${list.length} unique achievement names:\n`);
for (const [name, files] of list) {
  console.log(`- ${name}  (${Array.from(files).join(', ')})`);
}
