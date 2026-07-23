#!/usr/bin/env node
/**
 * 发布一致性检查：
 * - 当前 dist 的业务入口 hash 是否已经出现在评委体验地址
 * - Service Worker 缓存策略版本是否与本地一致
 *
 * 用法：
 *   node scripts/verify-deployment.mjs
 *   LUOHAMMER_DEPLOY_URL=https://example.com/game/ node scripts/verify-deployment.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST_INDEX = path.join(ROOT, 'dist', 'index.html');
const DIST_SW = path.join(ROOT, 'dist', 'sw.js');
const DEPLOY_URL = new URL(
  process.env.LUOHAMMER_DEPLOY_URL || 'https://niuhai.github.io/luohammer-pixel-game/'
);

function fail(message) {
  console.error(`❌ ${message}`);
  process.exitCode = 1;
}

function extractAppAsset(html) {
  const matches = [...html.matchAll(/(?:src|href)=["']([^"']*\/assets\/index-[^"']+\.(?:js|css))["']/g)];
  return matches.map((match) => path.posix.basename(match[1])).sort();
}

function extractCacheVersion(swSource) {
  return swSource.match(/CACHE_VERSION\s*=\s*['"]([^'"]+)['"]/)?.[1] || null;
}

async function fetchText(url) {
  const requestUrl = new URL(url);
  requestUrl.searchParams.set('__deployment_check', Date.now().toString());
  const response = await fetch(requestUrl, {
    cache: 'no-store',
    headers: { 'Cache-Control': 'no-cache' },
    signal: AbortSignal.timeout(15_000)
  });
  if (!response.ok) {
    throw new Error(`${requestUrl.pathname} 返回 HTTP ${response.status}`);
  }
  return response.text();
}

if (!fs.existsSync(DIST_INDEX) || !fs.existsSync(DIST_SW)) {
  console.error('❌ dist 构建产物不存在，请先运行 npm run build');
  process.exit(1);
}

const localHtml = fs.readFileSync(DIST_INDEX, 'utf8');
const localSw = fs.readFileSync(DIST_SW, 'utf8');

try {
  const [remoteHtml, remoteSw] = await Promise.all([
    fetchText(DEPLOY_URL),
    fetchText(new URL('sw.js', DEPLOY_URL))
  ]);

  const localAssets = extractAppAsset(localHtml);
  const remoteAssets = extractAppAsset(remoteHtml);
  const localCacheVersion = extractCacheVersion(localSw);
  const remoteCacheVersion = extractCacheVersion(remoteSw);

  console.log(`体验地址: ${DEPLOY_URL}`);
  console.log(`本地业务入口: ${localAssets.join(', ') || '未识别'}`);
  console.log(`线上业务入口: ${remoteAssets.join(', ') || '未识别'}`);
  console.log(`本地 SW: ${localCacheVersion || '未识别'}`);
  console.log(`线上 SW: ${remoteCacheVersion || '未识别'}`);

  if (localAssets.length === 0) {
    fail('无法从 dist/index.html 识别业务入口，请检查 Vite 构建结果');
  } else if (JSON.stringify(localAssets) !== JSON.stringify(remoteAssets)) {
    fail('线上体验入口不是当前 dist 构建；评委会看到旧版本');
  }

  if (!localCacheVersion) {
    fail('无法识别本地 Service Worker 缓存版本');
  } else if (localCacheVersion !== remoteCacheVersion) {
    fail('线上 Service Worker 与本地不一致，旧缓存可能继续拦截新版');
  }

  if (!process.exitCode) {
    console.log('✅ 线上体验入口与当前构建一致');
  }
} catch (error) {
  fail(`无法验证体验入口：${error.message}`);
}
