// 本地 preview + CDP 慢网络模拟：复现线上慢时序下 GameScene 停滞
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 375, height: 812 } });
  const logs = [];
  page.on('pageerror', (e) => logs.push('PAGEERROR: ' + String(e).slice(0, 300)));
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') logs.push(`[${m.type()}] ` + m.text().slice(0, 300)); });

  const client = await page.context().newCDPSession(page);
  await client.send('Network.enable');
  await client.send('Network.emulateNetworkConditions', {
    offline: false, latency: 400, downloadThroughput: 400 * 1024, uploadThroughput: 400 * 1024,
  });

  await page.goto('http://localhost:4319/', { waitUntil: 'load', timeout: 90000 });
  const bootVisible = await page.locator('#ui-boot-overlay').isVisible({ timeout: 60000 }).catch(() => false);
  logs.push(`--- bootVisible=${bootVisible} ---`);

  if (bootVisible) {
    await page.locator('#ui-boot-buttons button', { hasText: '开始游戏' }).click({ timeout: 15000 });
    for (let i = 0; i < 14; i++) {
      const st = await page.evaluate(() => {
        const g = window.game;
        return {
          scenes: g ? g.scene.scenes.filter((s) => s.scene.isActive()).map((s) => s.scene.key) : [],
          talent: !!document.querySelector('.ui-talent-overlay')?.offsetHeight,
        };
      });
      logs.push(`round ${i}: active=${JSON.stringify(st.scenes)} talent=${st.talent}`);
      if (st.talent) break;
      await page.keyboard.press('Space');
      await page.waitForTimeout(1000);
    }
  }
  console.log(JSON.stringify(logs, null, 2));
  await browser.close();
})();
