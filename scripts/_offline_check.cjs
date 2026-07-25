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
    // 模拟断网方案B：路由级 abort（网络层全断，但 SW 缓存拦截仍在渲染进程内生效）。
    // 注：Playwright ctx.setOffline 与 SW 子资源加载存在已知兼容问题（ERR_FAILED 假阳性），
    // route.abort 更接近真实"服务器挂了/现场断网但 SW 健全"场景。
    await ctx.route('**/*', (route) => route.abort());
    const failedReqs = [];
    const consoleErrs = [];
    page.on('console', (m) => { if (m.type() === 'error') consoleErrs.push(m.text().slice(0, 150)); });
    page.on('pageerror', (e) => consoleErrs.push('PAGEERROR: ' + String(e).slice(0, 150)));
    let offlineOK = false; let bootVisible = false; let errText = null;
    try {
      await page.reload({ timeout: 15000 });
      bootVisible = await page.locator('#ui-boot-overlay').isVisible({ timeout: 10000 });
      offlineOK = true;
    } catch (e) { errText = String(e).slice(0, 200); }
    // 离线状态下深挖：SW 控制状态 + cache.match 直连测试
    const deep = await page.evaluate(async () => {
      const out = { controller: Boolean(navigator.serviceWorker && navigator.serviceWorker.controller) };
      try {
        const c = await caches.open('luohammer-v8-prod');
        const m1 = await c.match('/luohammer-pixel-game/assets/index-PhLVy4fj.js');
        const m2 = await c.match('./assets/index-PhLVy4fj.js');
        const m3 = await c.match('assets/index-PhLVy4fj.js');
        out.matchAbs = Boolean(m1); out.matchDot = Boolean(m2); out.matchRel = Boolean(m3);
        if (m1) { out.cachedType = m1.type; out.cachedStatus = m1.status; }
        const keys = (await c.keys()).map((r) => ({ url: r.url.slice(-50), mode: r.mode }));
        out.keyModes = keys;
        // 通过 SW 发一次真实 fetch
        try {
          const f = await fetch('/luohammer-pixel-game/assets/phaser-DzVrRZrn.js');
          out.swFetchStatus = f.status;
          out.swFetchType = f.headers.get('content-type');
        } catch (e) { out.swFetchErr = String(e).slice(0, 120); }
        // 动态 import（模块加载路径，等同 <script type=module>）
        try {
          await import('/luohammer-pixel-game/assets/story-B3j2t4Da.js');
          out.dynamicImport = 'OK';
        } catch (e) { out.dynamicImport = String(e).slice(0, 150); }
        // 动态插入 script 标签
        try {
          await new Promise((res, rej) => {
            const s = document.createElement('script');
            s.type = 'module';
            s.src = '/luohammer-pixel-game/assets/story-B3j2t4Da.js';
            s.onload = () => res();
            s.onerror = () => rej(new Error('script tag load error'));
            document.head.appendChild(s);
          });
          out.scriptTag = 'OK';
        } catch (e) { out.scriptTag = String(e).slice(0, 150); }
      } catch (e) { out.err = String(e).slice(0, 150); }
      return out;
    });
    console.log(JSON.stringify({ cacheInfo, offlineOK, bootVisible, errText, deep, failedReqs: failedReqs.slice(0, 12), consoleErrs: consoleErrs.slice(0, 8) }, null, 2));
    await browser.close();
  } finally { preview.kill(); }
})();
