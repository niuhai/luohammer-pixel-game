const CACHE_VERSION = 'v5-network-first';
const CACHE_NAME = `luohammer-${CACHE_VERSION}`;

// 预缓存核心 HTML + 首屏关键图（标题背景，避免首屏白屏等待）
const PRECACHE_ASSETS = [
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './assets/characters/scene-stage-v2.webp'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    precacheAppShell()
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // HTML 导航必须优先联网。旧版 cache-first 会让回访评委永久停留在旧构建，
  // 即使新版本已经部署；离线时再退回预缓存首页。
  if (request.mode === 'navigate') {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  // Vite 内容哈希资源可安全永久缓存；URL 变化即代表内容变化。
  if (isRevisionedAsset(url.pathname)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // 固定文件名的图片、manifest 等先秒开，同时后台更新，下一次访问即可拿到新版。
  event.respondWith(staleWhileRevalidate(request, event));
});

function isRevisionedAsset(pathname) {
  return /\/assets\/[^/]+-[A-Za-z0-9_-]{6,}\.(?:js|css)$/.test(pathname);
}

async function precacheAppShell() {
  const cache = await caches.open(CACHE_NAME);
  // public/sw.js 不知道 Vite 每次生成的内容 hash；安装时读取当前 HTML，
  // 把真实入口 JS/CSS 一并纳入 app shell，确保首次安装完成后即可离线启动。
  const indexResponse = await fetch('./index.html', { cache: 'reload' });
  if (!indexResponse || !indexResponse.ok) {
    throw new Error('Unable to precache current index.html');
  }

  const html = await indexResponse.clone().text();
  const revisionedAssets = [...html.matchAll(/(?:src|href)=["']([^"']*\/assets\/[^"']+\.(?:js|css))["']/g)]
    .map((match) => match[1]);
  const appShell = [...new Set([
    ...PRECACHE_ASSETS.filter((asset) => asset !== './index.html'),
    ...revisionedAssets
  ])];

  await cache.put('./index.html', indexResponse);
  await cache.addAll(appShell);
}

async function networkFirstNavigation(request) {
  const cache = await caches.open(CACHE_NAME);

  try {
    const response = await fetch(request, { cache: 'no-store' });
    if (response && response.ok) {
      // 统一写入离线回退键，避免带 query 的评委链接无法命中缓存。
      await cache.put('./index.html', response.clone());
    }
    return response;
  } catch (error) {
    const fallback = await cache.match('./index.html');
    if (fallback) return fallback;
    throw error;
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response && response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    // 导航请求失败时返回缓存的 index.html
    if (request.mode === 'navigate') {
      const fallback = await cache.match('./index.html');
      if (fallback) return fallback;
    }
    throw error;
  }
}

async function staleWhileRevalidate(request, event) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  const refresh = fetch(request)
    .then(async (response) => {
      if (response && response.ok) {
        await cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => null);

  if (cached) {
    event.waitUntil(refresh);
    return cached;
  }

  const response = await refresh;
  if (response) return response;
  return Response.error();
}
