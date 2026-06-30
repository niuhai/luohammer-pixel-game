const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const CHAR_DIR = path.join(__dirname, '..', 'public', 'assets', 'characters');

const files = [
  'luo-standing-v2-nobg.png',
  'luo-speaking-v2-nobg.png',
  'luo-angry-v2-nobg.png',
  'luo-depressed-v2-nobg.png',
  'luo-happy-v2-nobg.png',
  'luo-livestream-v2-nobg.png',
  'luo-young-v2-nobg.png',
  'luo-sitting-v2-nobg.png',
  'luo-middle-v2-nobg.png'
];

async function checkCorners(filePath) {
  const { data, info } = await sharp(filePath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  
  const { width, height, channels } = info;
  const corners = [
    { name: 'top-left', x: 0, y: 0 },
    { name: 'top-right', x: width - 1, y: 0 },
    { name: 'bottom-left', x: 0, y: height - 1 },
    { name: 'bottom-right', x: width - 1, y: height - 1 },
    { name: 'top-center', x: Math.floor(width / 2), y: 0 },
    { name: 'bottom-center', x: Math.floor(width / 2), y: height - 1 },
    { name: 'left-center', x: 0, y: Math.floor(height / 2) },
    { name: 'right-center', x: width - 1, y: Math.floor(height / 2) }
  ];

  const results = corners.map(c => {
    const idx = (c.y * width + c.x) * channels;
    return {
      name: c.name,
      r: data[idx],
      g: data[idx + 1],
      b: data[idx + 2],
      a: data[idx + 3]
    };
  });

  return { width, height, corners: results };
}

async function main() {
  console.log('=== 验证角色 PNG 去背效果 ===\n');
  let allGood = true;

  for (const file of files) {
    const filePath = path.join(CHAR_DIR, file);
    if (!fs.existsSync(filePath)) {
      console.log(`❌ ${file}: 文件不存在`);
      allGood = false;
      continue;
    }

    try {
      const result = await checkCorners(filePath);
      const transparentCorners = result.corners.filter(c => c.a < 50).length;
      const totalCorners = result.corners.length;
      
      let status = transparentCorners >= 6 ? '✅' : (transparentCorners >= 4 ? '⚠️' : '❌');
      console.log(`${status} ${file} (${result.width}x${result.height}): ${transparentCorners}/${totalCorners} 角落透明`);
      
      // 打印角落详情
      result.corners.forEach(c => {
        const isTransparent = c.a < 50;
        const marker = isTransparent ? '·' : '█';
        if (!isTransparent) {
          console.log(`     ${marker} ${c.name}: RGBA(${c.r},${c.g},${c.b},${c.a})`);
          allGood = false;
        }
      });
    } catch (e) {
      console.log(`❌ ${file}: 读取失败 - ${e.message}`);
      allGood = false;
    }
    console.log('');
  }

  console.log(allGood ? '=== 所有图片角落透明正常！===' : '=== 存在异常角落需要检查 ===');
  process.exit(allGood ? 0 : 1);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
