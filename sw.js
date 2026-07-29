// R021：v11→v12——标题壳拆分后递归发现构建依赖，保持完整离线可玩链路。
const CACHE_VERSION = 'v12-prod';
const CACHE_NAME = `luohammer-${CACHE_VERSION}`;

// 预缓存核心 HTML + 首屏关键图（标题背景，避免首屏白屏等待）
const PRECACHE_ASSETS = [
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './og-image.png',
  './share-image.png',
  './assets/characters/scene-stage-v2-720.webp',
  './assets/characters/scene-stage-v2-1440.webp'
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

  // 开发环境绕行：Vite dev server 使用未 hash 的 ESM 模块 + HMR 查询参数，
  // SW 缓存这些请求会导致模块加载失败（net::ERR_ABORTED）和 HMR 失效。
  // 命中以下任一特征即放行给网络，不拦截、不缓存：
  //   1. 路径含 /src/            — Vite 源码模块（如 /src/systems/Foo.js）
  //   2. 路径含 /@vite/ 或 /@fs/ — Vite 内部虚拟模块
  //   3. 查询含 ?t= 或 ?import   — Vite HMR / 依赖优化标记
  if (url.pathname.includes('/src/') ||
      url.pathname.includes('/@vite/') ||
      url.pathname.includes('/@fs/') ||
      url.search.includes('?t=') ||
      url.search.includes('?import') ||
      url.search.includes('&t=')) {
    return;
  }

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

  // R021：标题壳成为 HTML 唯一入口后，构建图变为 bootShell → main → 场景懒加载 chunk。
  // 只扫描第一层会造成标题离线可见、点击后却无法进入游戏，因此递归发现应用 JS 图。
  const entryScripts = revisionedAssets.filter((asset) => asset.endsWith('.js'));
  const pendingScripts = [...entryScripts];
  const visitedScripts = new Set();
  const chunkAssets = new Set();
  while (pendingScripts.length > 0) {
    const scriptUrl = pendingScripts.shift();
    if (visitedScripts.has(scriptUrl)) continue;
    visitedScripts.add(scriptUrl);
    try {
      const scriptResponse = await fetch(scriptUrl, { cache: 'reload' });
      if (!scriptResponse || !scriptResponse.ok) continue;
      const scriptText = await scriptResponse.text();
      const matches = scriptText.matchAll(/["'](assets\/[^"']+-[A-Za-z0-9_-]+\.js)["']/g);
      for (const match of matches) {
        // 统一为 ./ 相对路径，与 PRECACHE_ASSETS 键形式一致
        const chunkUrl = './' + match[1];
        if (chunkAssets.has(chunkUrl)) continue;
        chunkAssets.add(chunkUrl);
        // Phaser 自包含且体积最大：纳入缓存，但不额外读取文本扫描依赖。
        if (!/\/phaser-[^/]+\.js$/.test(chunkUrl)) pendingScripts.push(chunkUrl);
      }
    } catch (error) {
      // 单个构建节点抓取失败不阻塞安装；失败项仍由 cache.add 单独记录。
    }
  }

  const appShell = [...new Set([
    ...PRECACHE_ASSETS.filter((asset) => asset !== './index.html'),
    ...revisionedAssets,
    ...chunkAssets
  ])];

  await cache.put('./index.html', indexResponse);
  // R84：逐项缓存取代原子 addAll——任一单项 404/网络抖动不再摧毁整个 install
  // （addAll 原子性 = 一个图标失败，全部 12 项核心 chunk 陪葬，离线能力归零）。
  // 失败项写入调试键，线下诊断脚本可读取定位。
  const results = await Promise.all(appShell.map(async (asset) => {
    try {
      await cache.add(asset);
      return null;
    } catch (error) {
      return asset + ' :: ' + String((error && error.message) || error).slice(0, 80);
    }
  }));
  const failures = results.filter(Boolean);
  if (failures.length > 0) {
    await cache.put('./__precache_failures__', new Response(JSON.stringify(failures)));
  }
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
  // R94：必须 ignoreVary——静态服务器（vite preview / 部分 CDN）对 JS 响应加
  // "Vary: Origin"，而 Chromium 模块脚本请求一律携带 Origin 头；预缓存键
  // （prefetch / cache.add，无 Origin）与之 Vary 不匹配 → 离线 MISS →
  // ERR_FAILED → 主 bundle 全挂（R94 实测：boot 不可见）。内容哈希资源
  // 的 Vary 无意义，忽略安全。
  const cached = await cache.match(request, { ignoreVary: true });
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
  // R94：ignoreVary 同理——图片经 Phaser XHR/<img> 加载不带 Origin，
  // 但若响应带 Vary: Origin 且未来请求方变化，保持匹配稳健
  const cached = await cache.match(request, { ignoreVary: true });
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
  // 超大/高密度屏可能选择未预缓存的 2304px 标题图；离线时退回 1440px，
  // 保证仍有完整构图，而不必让每次 PWA 安装额外下载原图。
  const url = new URL(request.url);
  if (/\/assets\/characters\/scene-stage-v2(?:-\d+)?\.webp$/.test(url.pathname)) {
    const titleFallback = await cache.match(
      './assets/characters/scene-stage-v2-1440.webp',
      { ignoreVary: true }
    );
    if (titleFallback) return titleFallback;
  }
  return Response.error();
}
