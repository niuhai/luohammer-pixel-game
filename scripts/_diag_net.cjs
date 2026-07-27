// 网络级探针：GameScene 4 个关键资源请求的发起/完成/失败时刻
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 375, height: 812 } });
  const t0 = Date.now();
  const log = (m) => console.log(`[+${Date.now() - t0}ms] ${m}`);

  page.on('request', (r) => {
    if (r.url().includes('assets/characters')) log(`REQ  ${r.url().split('/').pop()} via=${r.resourceType()}`);
  });
  page.on('requestfinished', async (r) => {
    if (r.url().includes('assets/characters')) {
      const resp = await r.response();
      log(`DONE ${r.url().split('/').pop()} status=${resp ? resp.status() : '?'} fromSW=${resp ? resp.fromServiceWorker() : '?'}`);
    }
  });
  page.on('requestfailed', (r) => {
    if (r.url().includes('assets/characters')) log(`FAIL ${r.url().split('/').pop()} err=${r.failure()?.errorText}`);
  });

  await page.goto('https://niuhai.github.io/luohammer-pixel-game/', { waitUntil: 'load', timeout: 60000 });
  await page.locator('#ui-boot-overlay').waitFor({ state: 'visible', timeout: 30000 });
  log('boot visible');
  await page.locator('#ui-boot-buttons button', { hasText: '开始游戏' }).click({ timeout: 8000 });
  for (let i = 0; i < 7; i++) { await page.keyboard.press('Space'); await page.waitForTimeout(1200); }
  log('--- intro done, waiting 15s for loader ---');
  await page.waitForTimeout(15000);
  const st = await page.evaluate(() => {
    const gs = window.game.scene.keys.GameScene;
    return { status: gs?.sys.settings.status, progress: gs?.load?.progress };
  });
  log('final: ' + JSON.stringify(st));
  await browser.close();
})();
