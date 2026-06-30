// 纯 Node.js 生成像素风 PWA 图标（不依赖 canvas 模块）
import fs from 'fs';
import zlib from 'zlib';

function createPNG(size, outputPath) {
  const pixelSize = Math.floor(size / 16);
  const grid = [
    [0,0,1,1,1,1,1,1,1,1,1,1,1,1,0,0],
    [0,0,0,0,0,1,1,1,1,1,0,0,0,0,0,0],
    [0,0,1,1,1,1,1,1,1,1,1,1,1,1,0,0],
    [0,0,0,0,0,1,1,1,1,1,0,0,0,0,0,0],
    [0,0,1,1,1,1,1,1,1,1,1,1,1,1,0,0],
    [0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0],
    [0,0,1,1,1,1,1,1,1,1,1,1,1,1,0,0],
    [0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0],
    [0,0,0,1,1,1,1,1,1,1,1,1,1,0,0,0],
    [0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0],
    [0,0,0,1,1,1,1,1,1,1,1,1,1,0,0,0],
    [0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0],
    [0,0,0,0,1,1,1,1,1,1,1,1,0,0,0,0],
    [0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0],
    [0,0,0,0,0,1,1,1,1,1,1,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  ];

  // 颜色：背景 #0a0a0a, 前景 #f0c040
  const bg = [10, 10, 10];
  const fg = [240, 192, 64];

  // 构建像素数据
  const rawRows = [];
  for (let y = 0; y < size; y++) {
    const row = [0]; // filter byte
    const gridY = Math.floor(y / pixelSize);
    for (let x = 0; x < size; x++) {
      const gridX = Math.floor(x / pixelSize);
      // 边框检测
      const borderSize = Math.max(1, Math.floor(size / 64));
      const isBorder = (
        (x >= size/16 && x < size/16 + borderSize) ||
        (x >= size*15/16 - borderSize && x < size*15/16) ||
        (y >= size/16 && y < size/16 + borderSize) ||
        (y >= size*15/16 - borderSize && y < size*15/16)
      ) && x >= size/16 && x < size*15/16 && y >= size/16 && y < size*15/16;

      let color;
      if (isBorder) {
        color = fg;
      } else if (gridY < 16 && gridX < 16 && grid[gridY][gridX]) {
        color = fg;
      } else {
        color = bg;
      }
      row.push(...color, 255); // RGBA
    }
    rawRows.push(Buffer.from(row));
  }
  const rawData = Buffer.concat(rawRows);

  // PNG 构建
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  function chunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const typeB = Buffer.from(type);
    const crcData = Buffer.concat([typeB, data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(crcData) >>> 0);
    return Buffer.concat([len, typeB, data, crc]);
  }

  // CRC32
  function crc32(buf) {
    let c = 0xFFFFFFFF;
    for (let i = 0; i < buf.length; i++) {
      c ^= buf[i];
      for (let j = 0; j < 8; j++) {
        c = (c >>> 1) ^ (c & 1 ? 0xEDB88320 : 0);
      }
    }
    return c ^ 0xFFFFFFFF;
  }

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // color type: RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  const compressed = zlib.deflateSync(rawData);

  const png = Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', compressed),
    chunk('IEND', Buffer.alloc(0))
  ]);

  fs.writeFileSync(outputPath, png);
  console.log(`Generated ${outputPath} (${size}x${size})`);
}

createPNG(192, 'public/icon-192.png');
createPNG(512, 'public/icon-512.png');
