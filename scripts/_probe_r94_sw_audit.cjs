// R94 DEBUG2：SW 缓存键全量审计 + __precache_failures__ 读取
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 375, height: 812 } });
  const page = await context.newPage();
  try {
    await page.goto('http://localhost:4180/luohammer-pixel-game/', { waitUntil: 'load', timeout: 30000 });
    await page.locator('#ui-boot-overlay').waitFor({ state: 'visible', timeout: 15000 });
    await page.evaluate(async () => { await navigator.serviceWorker.ready; });
    await page.waitForTimeout(4000);

    const audit = await page.evaluate(async () => {
      const keys = await caches.keys();
      const out = { cacheNames: keys };
      for (const k of keys) {
        const cache = await caches.open(k);
        const reqs = await cache.keys();
        out[k] = reqs.map((r) => r.url.replace(/^https?:\/\/[^/]+/, ''));
        const fail = await cache.match('./__precache_failures__');
        if (fail) out.__failures__ = await fail.json();
      }
      return out;
    });
    console.log(JSON.stringify(audit, null, 2));
  } catch (e) {
    console.log(JSON.stringify({ err: String(e).slice(0, 300) }));
  }
  await browser.close();
})();
