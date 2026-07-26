// PWA 离线验证：首次加载注册 SW → 断网 → 重新加载，期望页面仍可打开且标题可见
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');
const BASE = 'http://localhost:4173/luohammer-pixel-game/';
const waitPort = (url, timeout = 30000) => new Promise((resolve, reject) => {
  const t0 = Date.now();
  const tick = async () => {
    try { const r = await fetch(url); if (r.ok) return resolve(); } catch {}
    if (Date.now() - t0 > timeout) return reject(new Error('timeout'));
    setTimeout(tick, 500);
  };
  tick();
});
(async () => {
  const preview = spawn('npx', ['vite', 'preview', '--port', '4173', '--strictPort'], { stdio: 'ignore', shell: true, cwd: path.resolve(__dirname, '..') });
  try {
    await waitPort(BASE);
    const browser = await chromium.launch();
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(BASE, { waitUntil: 'networkidle' });
    // 等 SW 激活并控制页面
    await page.waitForFunction(async () => {
      if (!navigator.serviceWorker) return false;
      const reg = await navigator.serviceWorker.getRegistration();
      return Boolean(reg && reg.active && navigator.serviceWorker.controller);
    }, null, { timeout: 15000 });
    // 等 precache 完成（所有资源入缓存）
    await page.waitForTimeout(3000);
    const cacheInfo = await page.evaluate(async () => {
      const keys = await caches.keys();
      const counts = {};
      for (const k of keys) {
        const reqs = await (await caches.open(k)).keys();
        counts[k] = reqs.map((r) => r.url.replace(/^.*luohammer-pixel-game\//, ''));
      }
      return counts;
    });
    // R84 终局判据：CDP setOffline/route.abort 都会误伤 SW 对 module script(cors) 的缓存响应
    // （ERR_FAILED 假阳性：fetch() API 走同一 SW 缓存却 200）。改用**真实杀服务器**——
    // TCP 拒绝连接，SW respondWith 是浏览器内纯内存操作，不受网络栈影响，等价评委现场服务器挂掉。
    // Windows: shell:true 的 spawn 需 taskkill /T /F 杀进程树，否则 node 子进程残留端口未释放=假离线。
    try { require('child_process').execSync(`taskkill /pid ${preview.pid} /T /F`, { stdio: 'ignore' }); } catch {}
    await new Promise((r) => setTimeout(r, 1200)); // 等端口真正释放
    const navLog = [];
    page.on('framenavigated', (f) => { if (f === page.mainFrame()) navLog.push(f.url().slice(-60)); });
    page.on('crash', () => navLog.push('PAGE_CRASHED'));
    const failedReqs = [];
    const consoleErrs = [];
    page.on('requestfailed', (r) => failedReqs.push(r.url().slice(-70) + ' | ' + (r.failure() && r.failure().errorText)));
    page.on('console', (m) => { if (m.type() === 'error') consoleErrs.push(m.text().slice(0, 150)); });
    page.on('pageerror', (e) => consoleErrs.push('PAGEERROR: ' + String(e).slice(0, 150)));
    let offlineOK = false; let bootVisible = false; let errText = null;
    try {
      await page.reload({ timeout: 15000 });
      bootVisible = await page.locator('#ui-boot-overlay').isVisible({ timeout: 10000 });
      offlineOK = true;
    } catch (e) { errText = String(e).slice(0, 200); }
    // R84 关键链路：离线状态下点"开始游戏"→ 动态 import GameScene chunk → 天赋 overlay
    // 验证 SW 预缓存是否覆盖懒加载 chunk（v9 起 precacheAppShell 提取 __vite__mapDeps 全量 chunk）
    let offlineGameplay = null;
    if (bootVisible) {
      try {
        await page.locator('#ui-boot-buttons button', { hasText: '开始游戏' }).click({ timeout: 5000 });
        // IntroScene 空格推进 → 天赋 overlay 出现即证明 GameScene 链路 chunk 全部离线可达
        let talentOk = false;
        for (let i = 0; i < 12; i++) {
          talentOk = await page.evaluate(() => {
            const el = document.querySelector('.ui-talent-overlay');
            return !!(el && getComputedStyle(el).display !== 'none' && el.offsetHeight > 0);
          });
          if (talentOk) break;
          await page.keyboard.press('Space');
          await page.waitForTimeout(700);
        }
        offlineGameplay = { talentOverlayReached: talentOk };
      } catch (e) { offlineGameplay = { err: String(e).slice(0, 150) }; }
    }
    // 离线状态下深挖：SW 控制状态 + cache.match 直连测试
    let deep = null;
    try {
      deep = await page.evaluate(async () => {
      const out = { controller: Boolean(navigator.serviceWorker && navigator.serviceWorker.controller) };
      try {
        const cacheNames = await caches.keys();
        out.cacheNames = cacheNames;
        const prodName = cacheNames.find((n) => n.startsWith('luohammer-'));
        const c = await caches.open(prodName);
        const allKeys = await c.keys();
        // R84：hash 随构建变化，改为从缓存 keys 动态选取，避免硬编码 hash 失效
        const indexKey = allKeys.find((r) => /\/assets\/index-[^/]+\.js$/.test(r.url));
        const phaserKey = allKeys.find((r) => /\/assets\/phaser-[^/]+\.js$/.test(r.url));
        const chunkKey = allKeys.find((r) => /\/assets\/GameScene-[^/]+\.js$/.test(r.url));
        const endingKey = allKeys.find((r) => /\/assets\/EndingScene-[^/]+\.js$/.test(r.url));
        const eventsKey = allKeys.find((r) => /\/assets\/events-random-[^/]+\.js$/.test(r.url));
        out.lazyChunksCached = { gameScene: Boolean(chunkKey), endingScene: Boolean(endingKey), eventsRandom: Boolean(eventsKey) };
        const probe = indexKey ? indexKey.url.replace(/^https?:\/\/[^/]+/, '') : null;
        out.probedIndex = probe ? probe.slice(-40) : 'NOT_FOUND';
        if (probe) {
          const m1 = await c.match(probe);
          const m2 = await c.match('.' + probe.replace('/luohammer-pixel-game', ''));
          const m3 = await c.match(probe.replace('/luohammer-pixel-game/', ''));
          out.matchAbs = Boolean(m1); out.matchDot = Boolean(m2); out.matchRel = Boolean(m3);
          if (m1) { out.cachedType = m1.type; out.cachedStatus = m1.status; }
        }
        // 通过 SW 发一次真实 fetch
        try {
          const f = await fetch(phaserKey ? phaserKey.url.replace(/^https?:\/\/[^/]+/, '') : '/luohammer-pixel-game/assets/phaser-DzVrRZrn.js');
          out.swFetchStatus = f.status;
          out.swFetchType = f.headers.get('content-type');
        } catch (e) { out.swFetchErr = String(e).slice(0, 120); }
        // 动态 import（模块加载路径，等同 <script type=module>）
        const chunkPath = chunkKey ? chunkKey.url.replace(/^https?:\/\/[^/]+/, '') : null;
        out.probedChunk = chunkPath ? chunkPath.slice(-40) : 'NOT_FOUND';
        if (chunkPath) {
          try {
            await import(/* @vite-ignore */ chunkPath);
            out.dynamicImport = 'OK';
          } catch (e) { out.dynamicImport = String(e).slice(0, 150); }
          // 动态插入 script 标签
          try {
            await new Promise((res, rej) => {
              const s = document.createElement('script');
              s.type = 'module';
              s.src = chunkPath;
              s.onload = () => res();
              s.onerror = () => rej(new Error('script tag load error'));
              document.head.appendChild(s);
            });
            out.scriptTag = 'OK';
          } catch (e) { out.scriptTag = String(e).slice(0, 150); }
        }
      } catch (e) { out.err = String(e).slice(0, 150); }
      return out;
    });
    } catch (e) { deep = { evalErr: String(e).slice(0, 200) }; }
    console.log(JSON.stringify({ cacheInfo, offlineOK, bootVisible, offlineGameplay, navLog, errText, deep, failedReqs: failedReqs.slice(0, 12), consoleErrs: consoleErrs.slice(0, 8) }, null, 2));
    await browser.close();
  } finally { try { require('child_process').execSync(`taskkill /pid ${preview.pid} /T /F`, { stdio: 'ignore' }); } catch {} }
})();
