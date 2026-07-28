// R94 DEBUG4：离线状态下 SW 脚本响应失败根因——页面内 Cache API vs fetch(SW路径) 对照
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 375, height: 812 } });
  const page = await context.newPage();
  const logs = [];
  page.on('requestfailed', (r) => logs.push('REQFAIL: ' + r.url().slice(-50) + ' ' + (r.failure() || {}).errorText));

  const result = { logs };
  try {
    await page.goto('http://localhost:4180/luohammer-pixel-game/', { waitUntil: 'load', timeout: 30000 });
    await page.locator('#ui-boot-overlay').waitFor({ state: 'visible', timeout: 15000 });
    await page.waitForTimeout(6000);

    await context.setOffline(true);
    await page.reload({ waitUntil: 'load', timeout: 20000 });
    await page.waitForTimeout(3000);

    result.offlineProbe = await page.evaluate(async () => {
      const out = {};
      const url = '/luohammer-pixel-game/assets/index-BWKIcCg8.js';
      // 1) 页面直接读 Cache API（不经 SW fetch 处理流程）
      try {
        const cache = await caches.open('luohammer-v9-prod');
        const m = await cache.match(url);
        out.cacheApiMatch = !!m;
        if (m) { out.cachedType = m.type; out.cachedStatus = m.status; out.vary = m.headers.get('vary'); }
      } catch (e) { out.cacheApiErr = String(e).slice(0, 120); }
      // 2) 页面 fetch 同一 URL（走 SW fetch handler → cacheFirst）
      try {
        const r = await fetch(url);
        out.swFetchOk = r.ok;
        out.swFetchStatus = r.status;
        out.swFetchType = r.type;
      } catch (e) { out.swFetchErr = String(e).slice(0, 160); }
      // 3) 无缓存模式 fetch（强制绕过 SW cache 语义，仍走 SW）
      try {
        const r2 = await fetch(url, { cache: 'no-store' });
        out.swFetchNoStoreOk = r2.ok;
        out.swFetchNoStoreStatus = r2.status;
      } catch (e) { out.swFetchNoStoreErr = String(e).slice(0, 160); }
      return out;
    });
  } catch (e) {
    result.err = String(e).slice(0, 300);
  }
  console.log(JSON.stringify(result, null, 2));
  await browser.close();
})();
