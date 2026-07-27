// R89 排障：MutationObserver 全程监听 #ui-game-loading class 变化 + webp 请求计时
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, serviceWorkers: 'block' });
  const page = await ctx.newPage();
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false, latency: 400, downloadThroughput: 300 * 1024, uploadThroughput: 100 * 1024
  });

  const webpReqs = [];
  page.on('response', async (res) => {
    const req = res.request();
    if (req.url().includes('.webp')) {
      const t = await req.timing();
      webpReqs.push(`${req.url().split('/').pop()} dur=${Math.round(t.responseEnd)}ms sw=${res.fromServiceWorker()} status=${res.status()}`);
    }
  });
  page.on('pageerror', (e) => console.log('PAGEERROR:', String(e).slice(0, 150)));

  await page.goto('http://localhost:4173/luohammer-pixel-game/', { waitUntil: 'load', timeout: 90000 });
  await page.locator('#ui-boot-overlay').waitFor({ state: 'visible', timeout: 60000 });

  // 注入 MutationObserver：记录 class 每次变化的时刻
  await page.evaluate(() => {
    window.__loadingLog = [];
    const el = document.getElementById('ui-game-loading');
    if (!el) { window.__loadingLog.push('NO ELEMENT'); return; }
    new MutationObserver(() => {
      window.__loadingLog.push(`${Math.round(performance.now())}ms class="${el.className}"`);
    }).observe(el, { attributes: true, attributeFilter: ['class'] });
    window.__loadingLog.push(`observer ready, el exists, initial class="${el.className}"`);
  });

  await page.locator('#ui-boot-buttons button', { hasText: '开始游戏' }).click({ timeout: 15000 });

  // 空格推进 + 等天赋层
  let talent = false;
  for (let i = 0; i < 200 && !talent; i++) {
    talent = await page.evaluate(() => {
      const t = document.querySelector('.ui-talent-overlay');
      return !!(t && t.offsetHeight > 0);
    });
    if (!talent) {
      if (i % 5 === 4) await page.keyboard.press('Space');
      await page.waitForTimeout(200);
    }
  }

  const log = await page.evaluate(() => window.__loadingLog);
  console.log('talent reached:', talent);
  console.log('--- loading class mutations ---');
  console.log(log.join('\n'));
  console.log('--- webp requests (last 8) ---');
  console.log(webpReqs.slice(-8).join('\n'));
  await browser.close();
})();
