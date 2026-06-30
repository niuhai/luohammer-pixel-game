// 生成 og-image.png - 1200x630 像素风分享图
// 纯 Node.js 实现，无外部依赖
const fs = require('fs');
const zlib = require('zlib');
const path = require('path');

const WIDTH = 1200;
const HEIGHT = 630;

// 颜色
const COLORS = {
  bg: [10, 10, 10],
  gold: [240, 192, 64],
  goldDark: [180, 140, 40],
  white: [240, 240, 240],
  gray: [120, 110, 90],
  darkGray: [40, 38, 35],
  midGray: [60, 55, 50],
  skin: [220, 190, 170],
  skinDark: [200, 170, 150],
  hair: [60, 50, 40],
  shirt: [40, 45, 55],
  shirtDark: [25, 28, 35]
};

// 创建原始图像数据缓冲区（含滤镜字节）
const rowBytes = WIDTH * 3 + 1;
const rawData = Buffer.alloc(HEIGHT * rowBytes);

function setPixel(x, y, color) {
  if (x < 0 || x >= WIDTH || y < 0 || y >= HEIGHT) return;
  const offset = y * rowBytes + 1 + x * 3;
  rawData[offset] = color[0];
  rawData[offset + 1] = color[1];
  rawData[offset + 2] = color[2];
}

function fillRect(x, y, w, h, color) {
  const x0 = Math.max(0, x);
  const x1 = Math.min(WIDTH, x + w);
  const y0 = Math.max(0, y);
  const y1 = Math.min(HEIGHT, y + h);
  for (let py = y0; py < y1; py++) {
    for (let px = x0; px < x1; px++) {
      setPixel(px, py, color);
    }
  }
}

// ============= 开始绘制 =============

// 1. 填充背景
for (let y = 0; y < HEIGHT; y++) {
  for (let x = 0; x < WIDTH; x++) {
    setPixel(x, y, COLORS.bg);
  }
}

// 2. 金色边框装饰（四角星点）
const cornerDots = [
  [20, 20], [40, 20], [60, 20], [20, 40], [20, 60],
  [WIDTH - 21, 20], [WIDTH - 41, 20], [WIDTH - 61, 20], [WIDTH - 21, 40], [WIDTH - 21, 60],
  [20, HEIGHT - 21], [40, HEIGHT - 21], [60, HEIGHT - 21], [20, HEIGHT - 41], [20, HEIGHT - 61],
  [WIDTH - 21, HEIGHT - 21], [WIDTH - 41, HEIGHT - 21], [WIDTH - 61, HEIGHT - 21], [WIDTH - 21, HEIGHT - 41], [WIDTH - 21, HEIGHT - 61]
];
cornerDots.forEach(([x, y]) => fillRect(x, y, 4, 4, COLORS.goldDark));

// 3. 绘制老罗像素头像（左侧）
function drawLuo(cx, cy, s) {
  // 头发/头顶
  fillRect(cx - 35 * s, cy - 60 * s, 70 * s, 25 * s, COLORS.hair);
  fillRect(cx - 40 * s, cy - 50 * s, 8 * s, 40 * s, COLORS.hair);
  fillRect(cx + 32 * s, cy - 50 * s, 8 * s, 40 * s, COLORS.hair);
  
  // 脸
  fillRect(cx - 32 * s, cy - 35 * s, 64 * s, 65 * s, COLORS.skin);
  
  // 耳朵
  fillRect(cx - 38 * s, cy - 25 * s, 6 * s, 25 * s, COLORS.skinDark);
  fillRect(cx + 32 * s, cy - 25 * s, 6 * s, 25 * s, COLORS.skinDark);
  
  // 眉毛
  fillRect(cx - 25 * s, cy - 22 * s, 18 * s, 4 * s, COLORS.hair);
  fillRect(cx + 7 * s, cy - 22 * s, 18 * s, 4 * s, COLORS.hair);
  
  // 眼镜框（黑色）
  // 左镜框
  fillRect(cx - 27 * s, cy - 15 * s, 22 * s, 18 * s, [20, 15, 10]);
  // 右镜框
  fillRect(cx + 5 * s, cy - 15 * s, 22 * s, 18 * s, [20, 15, 10]);
  // 白色镜边框
  // 左
  fillRect(cx - 27 * s, cy - 15 * s, 22 * s, 2 * s, COLORS.white);
  fillRect(cx - 27 * s, cy + 1 * s, 22 * s, 2 * s, COLORS.white);
  fillRect(cx - 27 * s, cy - 15 * s, 2 * s, 18 * s, COLORS.white);
  fillRect(cx - 7 * s, cy - 15 * s, 2 * s, 18 * s, COLORS.white);
  // 右
  fillRect(cx + 5 * s, cy - 15 * s, 22 * s, 2 * s, COLORS.white);
  fillRect(cx + 5 * s, cy + 1 * s, 22 * s, 2 * s, COLORS.white);
  fillRect(cx + 5 * s, cy - 15 * s, 2 * s, 18 * s, COLORS.white);
  fillRect(cx + 25 * s, cy - 15 * s, 2 * s, 18 * s, COLORS.white);
  // 镜桥
  fillRect(cx - 5 * s, cy - 8 * s, 10 * s, 2 * s, COLORS.white);
  
  // 眼睛（从镜片里看到）
  fillRect(cx - 20 * s, cy - 9 * s, 6 * s, 6 * s, [80, 60, 45]);
  fillRect(cx + 12 * s, cy - 9 * s, 6 * s, 6 * s, [80, 60, 45]);
  
  // 鼻子
  fillRect(cx - 2 * s, cy + 5 * s, 4 * s, 15 * s, COLORS.skinDark);
  fillRect(cx - 6 * s, cy + 15 * s, 12 * s, 5 * s, COLORS.skinDark);
  
  // 嘴（微笑）
  fillRect(cx - 10 * s, cy + 22 * s, 20 * s, 3 * s, [160, 70, 70]);
  
  // 下巴阴影
  fillRect(cx - 25 * s, cy + 28 * s, 50 * s, 4 * s, COLORS.skinDark);
  
  // 脖子
  fillRect(cx - 15 * s, cy + 30 * s, 30 * s, 20 * s, COLORS.skinDark);
  
  // 衣服（深色V领）
  fillRect(cx - 55 * s, cy + 48 * s, 110 * s, 80 * s, COLORS.shirt);
  fillRect(cx - 60 * s, cy + 45 * s, 120 * s, 10 * s, COLORS.shirtDark);
  // V领
  for (let i = 0; i < 20 * s; i++) {
    fillRect(cx - i, cy + 48 * s + i, 2 * i, 2, COLORS.skin);
  }
}

drawLuo(250, 360, 1.2);

// 4. 右侧"手机屏幕"装饰
function drawPhone(sx, sy) {
  // 手机外框
  fillRect(sx, sy, 180, 310, [30, 30, 35]);
  // 屏幕
  fillRect(sx + 12, sy + 25, 156, 255, [15, 15, 18]);
  // 顶部听筒/摄像头
  fillRect(sx + 60, sy + 10, 60, 8, [60, 60, 65]);
  // 屏幕内容装饰
  // 标题条
  fillRect(sx + 20, sy + 45, 140, 10, COLORS.goldDark);
  fillRect(sx + 20, sy + 60, 110, 6, [180, 160, 130]);
  fillRect(sx + 20, sy + 75, 130, 6, [160, 140, 110]);
  // 选项框
  fillRect(sx + 20, sy + 95, 140, 22, [25, 25, 30]);
  // 选项框金色装饰
  fillRect(sx + 20, sy + 95, 2, 22, COLORS.gold);
  fillRect(sx + 158, sy + 95, 2, 22, COLORS.goldDark);
  fillRect(sx + 20, sy + 95, 140, 2, COLORS.gold);
  fillRect(sx + 20, sy + 115, 140, 2, COLORS.goldDark);
  // 更多文字条
  fillRect(sx + 25, sy + 130, 130, 6, [200, 180, 150]);
  fillRect(sx + 25, sy + 145, 110, 6, [170, 150, 120]);
  fillRect(sx + 25, sy + 160, 120, 6, [180, 160, 130]);
  // 属性条
  fillRect(sx + 25, sy + 185, 130, 8, [35, 32, 28]);
  fillRect(sx + 25, sy + 185, 70, 8, COLORS.goldDark);
  fillRect(sx + 25, sy + 200, 130, 8, [35, 32, 28]);
  fillRect(sx + 25, sy + 200, 40, 8, [100, 80, 140]);
  fillRect(sx + 25, sy + 215, 130, 8, [35, 32, 28]);
  fillRect(sx + 25, sy + 215, 55, 8, [80, 150, 120]);
  // 底部Home键
  fillRect(sx + 75, sy + 285, 30, 8, [50, 50, 55]);
}

drawPhone(880, 220);

// 5. 中央"真还传"大标题装饰（金色像素块）
// 大标题背景
fillRect(380, 100, 440, 110, COLORS.darkGray);
// 装饰点
for (let x = 380; x < 820; x += 6) {
  fillRect(x, 100, 2, 2, COLORS.goldDark);
  fillRect(x, 208, 2, 2, COLORS.goldDark);
}
for (let y = 100; y < 210; y += 6) {
  fillRect(380, y, 2, 2, COLORS.goldDark);
  fillRect(818, y, 2, 2, COLORS.goldDark);
}

// 真还传 - 三个字用金色像素块表示
// "真"字块
fillRect(405, 115, 75, 80, [180, 145, 50]);
fillRect(410, 120, 65, 70, [220, 185, 65]);
// 内部装饰（模拟"真"字的笔画结构）
fillRect(420, 125, 10, 60, [180, 145, 50]);
fillRect(450, 130, 20, 40, [180, 145, 50]);
fillRect(435, 140, 50, 10, [180, 145, 50]);
fillRect(435, 165, 50, 10, [180, 145, 50]);

// "还"字块
fillRect(515, 115, 75, 80, [180, 145, 50]);
fillRect(520, 120, 65, 70, [220, 185, 65]);
// 内部装饰
fillRect(530, 125, 45, 8, [180, 145, 50]);
fillRect(530, 140, 45, 8, [180, 145, 50]);
fillRect(535, 155, 35, 25, [180, 145, 50]);
fillRect(550, 135, 8, 55, [180, 145, 50]);

// "传"字块
fillRect(625, 115, 75, 80, [180, 145, 50]);
fillRect(630, 120, 65, 70, [220, 185, 65]);
// 内部装饰
fillRect(640, 130, 45, 10, [180, 145, 50]);
fillRect(640, 155, 45, 10, [180, 145, 50]);
fillRect(648, 130, 10, 35, [180, 145, 50]);
fillRect(665, 130, 20, 55, [180, 145, 50]);

// 6. 副标题：金色"创业模拟器"5个小方块
for (let i = 0; i < 5; i++) {
  const x = 440 + i * 60;
  fillRect(x, 230, 50, 50, [35, 32, 28]);
  fillRect(x + 5, 235, 40, 40, COLORS.goldDark);
  fillRect(x + 10, 240, 30, 30, [200, 170, 70]);
}

// 7. 中央底部 - 锤子图案
// 锤柄
fillRect(585, 330, 30, 80, [100, 80, 55]);
fillRect(590, 335, 20, 70, [130, 110, 75]);
// 锤头
fillRect(520, 310, 160, 40, [140, 130, 115]);
fillRect(525, 315, 150, 6, [180, 170, 150]);
// 锤头侧边阴影
fillRect(520, 310, 6, 40, [110, 100, 85]);
fillRect(674, 310, 6, 40, [110, 100, 85]);

// 8. 底部Slogan装饰条
fillRect(200, 450, 800, 40, COLORS.darkGray);
// 金色装饰点
for (let i = 0; i < 26; i++) {
  const x = 220 + i * 30;
  fillRect(x, 460, 6, 20, COLORS.goldDark);
  fillRect(x + 2, 465, 2, 10, COLORS.gold);
}

// 9. 随机金色像素装饰
function addDecor(x, y) {
  fillRect(x, y, 3, 3, COLORS.goldDark);
  fillRect(x + 2, y + 2, 2, 2, COLORS.gold);
}
const decorPoints = [
  [350, 550], [400, 560], [450, 545], [500, 555], [550, 550], [600, 560], [650, 550], [700, 555], [750, 545],
  [350, 300], [380, 280], [360, 260], [800, 260], [820, 280], [840, 300],
  [150, 150], [1050, 150]
];
decorPoints.forEach(([x, y]) => addDecor(x, y));

// ============= PNG 文件写入 =============

// CRC32 表
const crcTable = (function makeCrcTable() {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function makeChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

// 压缩图像数据
const compressed = zlib.deflateSync(rawData);

// 写入 PNG 文件
const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(WIDTH, 0);
ihdr.writeUInt32BE(HEIGHT, 4);
ihdr[8] = 8;    // 8-bit
ihdr[9] = 2;    // RGB
ihdr[10] = 0;   // deflate
ihdr[11] = 0;   // filter type 0
ihdr[12] = 0;   // no interlace

const pngBuffer = Buffer.concat([
  signature,
  makeChunk('IHDR', ihdr),
  makeChunk('IDAT', compressed),
  makeChunk('IEND', Buffer.alloc(0))
]);

const outputPath = path.join(__dirname, '..', 'public', 'og-image.png');
fs.writeFileSync(outputPath, pngBuffer);

console.log('✓ 生成成功: ' + outputPath);
console.log('✓ 文件大小: ' + Math.round(pngBuffer.length / 1024) + ' KB');
console.log('✓ 尺寸: ' + WIDTH + ' x ' + HEIGHT);
