// R94 DEBUG：离线 reload 后 boot 不可见根因定位
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 375, height: 812 } });
  const page = await context.newPage();
  const logs = [];
  page.on('console', (m) => logs.push(m.type() + ': ' + m.text().slice(0, 150)));
  page.on('pageerror', (e) => logs.push('PAGEERROR: ' + String(e).slice(0, 150)));
  page.on('requestfailed', (r) => logs.push('REQFAIL: ' + r.url().slice(-60) + ' ' + (r.failure() || {}).errorText));

  const result = { logs };
  try {
    await page.goto('http://localhost:4180/luohammer-pixel-game/', { waitUntil: 'load', timeout: 30000 });
    await page.locator('#ui-boot-overlay').waitFor({ state: 'visible', timeout: 15000 });
    result.onlineBoot = true;
    await page.waitForTimeout(6000); // 让预热跑一段 + SW 充分缓存

    await context.setOffline(true);
    logs.push('--- OFFLINE RELOAD ---');
    await page.reload({ waitUntil: 'load', timeout: 20000 });

    await page.waitForTimeout(8000);
    result.dom = await page.evaluate(() => {
      const boot = document.getElementById('ui-boot-overlay');
      const loading = document.getElementById('app-loading');
      return {
        bootExists: !!boot,
        bootDisplay: boot ? getComputedStyle(boot).display : null,
        bootH: boot ? boot.offsetHeight : 0,
        loadingExists: !!loading,
        loadingText: loading ? (document.getElementById('app-loading-text') || {}).textContent : null,
        canvasCount: document.querySelectorAll('canvas').length,
        swControlled: !!navigator.serviceWorker.controller,
        bodyChildren: document.body.children.length,
      };
    });
  } catch (e) {
    result.err = String(e).slice(0, 300);
  }
  console.log(JSON.stringify(result, null, 2));
  await browser.close();
})();
