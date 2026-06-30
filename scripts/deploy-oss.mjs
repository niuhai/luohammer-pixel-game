import OSS from 'ali-oss';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST_DIR = path.join(__dirname, '..', 'dist');

const CONFIG = {
  region: 'oss-cn-hangzhou',
  bucket: 'luohammer-game',
  accessKeyId: process.env.OSS_ACCESS_KEY_ID,
  accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET,
};

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.webmanifest': 'application/manifest+json',
};

const LONG_CACHE_EXT = ['.js', '.css', '.png', '.jpg', '.jpeg', '.webp', '.svg', '.ico', '.mp3', '.wav'];
const NO_CACHE_FILES = ['index.html', 'sw.js'];

async function getAllFiles(dir, base = '') {
  const files = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relPath = base ? `${base}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      files.push(...await getAllFiles(fullPath, relPath));
    } else {
      files.push({ fullPath, relPath });
    }
  }
  return files;
}

async function uploadFile(client, file, relPath) {
  const ext = path.extname(relPath).toLowerCase();
  const headers = {
    'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
  };

  if (NO_CACHE_FILES.includes(relPath)) {
    headers['Cache-Control'] = 'no-cache, no-store, must-revalidate';
  } else if (LONG_CACHE_EXT.includes(ext) || relPath.startsWith('assets/')) {
    headers['Cache-Control'] = 'public, max-age=31536000, immutable';
  } else {
    headers['Cache-Control'] = 'public, max-age=3600';
  }

  await client.put(relPath, file, { headers });
  console.log(`  ✓ ${relPath}`);
}

async function main() {
  if (!CONFIG.accessKeyId || !CONFIG.accessKeySecret) {
    console.error('❌ 请先设置环境变量 OSS_ACCESS_KEY_ID 和 OSS_ACCESS_KEY_SECRET');
    console.error('');
    console.error('获取方式：阿里云控制台 → 右上角头像 → AccessKey 管理 → 创建 AccessKey');
    console.error('');
    console.error('Windows PowerShell:');
    console.error('  $env:OSS_ACCESS_KEY_ID="你的KeyId"');
    console.error('  $env:OSS_ACCESS_KEY_SECRET="你的KeySecret"');
    console.error('  npm run deploy');
    process.exit(1);
  }

  if (!fs.existsSync(DIST_DIR)) {
    console.error('❌ dist 目录不存在，请先运行 npm run build');
    process.exit(1);
  }

  console.log('📦 开始上传到阿里云OSS...\n');

  const client = new OSS({
    region: CONFIG.region,
    accessKeyId: CONFIG.accessKeyId,
    accessKeySecret: CONFIG.accessKeySecret,
    bucket: CONFIG.bucket,
  });

  const files = await getAllFiles(DIST_DIR);
  console.log(`找到 ${files.length} 个文件待上传\n`);

  let success = 0;
  let fail = 0;

  for (const { fullPath, relPath } of files) {
    try {
      await uploadFile(client, fullPath, relPath);
      success++;
    } catch (e) {
      console.error(`  ✗ ${relPath}: ${e.message}`);
      fail++;
    }
  }

  console.log(`\n${'='.repeat(40)}`);
  console.log(`✅ 上传完成: ${success} 成功, ${fail} 失败`);
  
  if (fail === 0) {
    console.log(`🌐 访问你的网站，记得CDN刷新缓存`);
  }
}

main().catch(e => {
  console.error('❌ 部署失败:', e.message);
  process.exit(1);
});
