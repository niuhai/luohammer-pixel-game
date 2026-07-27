// R89 一次性脚本：v4 角色立绘无损 VP8L → 有损 WebP(q85) 重编码
// 背景：v4 立绘 2048x3072 无损单张 ~500-670KB（10 张共 5.5MB），慢网导致 GameScene preload 停滞
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, '..', 'public', 'assets', 'characters');

(async () => {
  const files = fs.readdirSync(DIR).filter(f => f.startsWith('luo-') && f.includes('-v4-nobg.webp'));
  let before = 0, after = 0;
  for (const f of files) {
    const src = path.join(DIR, f);
    const tmp = src + '.tmp';
    const origSize = fs.statSync(src).size;
    await sharp(src)
      .webp({ quality: 85, alphaQuality: 95, lossless: false, effort: 6, smartSubsample: true })
      .toFile(tmp);
    const newSize = fs.statSync(tmp).size;
    fs.renameSync(tmp, src);
    before += origSize; after += newSize;
    console.log(`${f}: ${Math.round(origSize / 1024)}KB -> ${Math.round(newSize / 1024)}KB`);
  }
  console.log(`TOTAL: ${Math.round(before / 1024)}KB -> ${Math.round(after / 1024)}KB (saved ${Math.round((1 - after / before) * 100)}%)`);
})();
