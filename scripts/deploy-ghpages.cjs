// Deploy dist/ to gh-pages branch
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const distPath = path.join(__dirname, '..', 'dist');
const tempDir = path.join(__dirname, '..', '.gh-pages-temp');

// Clean up temp dir
if (fs.existsSync(tempDir)) {
  fs.rmSync(tempDir, { recursive: true });
}
fs.mkdirSync(tempDir, { recursive: true });

// Copy dist to temp
function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

copyDir(distPath, tempDir);
console.log('Copied dist to temp dir');

// dist/showcase 是 vite 构建产生的空目录；作品展示页真实文件在仓库根 showcase/，
// 必须显式拷贝，否则 /MIR 镜像会把线上 showcase 删成空目录（R040 部署事故）
const showcaseSrc = path.join(__dirname, '..', 'showcase');
if (fs.existsSync(showcaseSrc)) {
  copyDir(showcaseSrc, path.join(tempDir, 'showcase'));
  console.log('Copied showcase pages to temp dir');
}

// Create .nojekyll file
fs.writeFileSync(path.join(tempDir, '.nojekyll'), '');
console.log('.nojekyll created');

console.log('\nNow run these commands manually:');
console.log('  git checkout gh-pages');
console.log('  Remove all files except .git');
console.log(`  Copy all files from ${tempDir} to current directory`);
console.log('  git add .');
console.log('  git commit -m "deploy"');
console.log('  git push origin gh-pages');
console.log('  git checkout master');
