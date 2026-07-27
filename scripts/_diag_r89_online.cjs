// R89 线上终验：长窗口轮询——GameScene 加载是否最终完成并到达天赋 overlay
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 375, height: 812 } });
  const logs = [];
  page.on('pageerror', (e) => logs.push('PAGEERROR: ' + String(e).slice(0, 200)));
  const t0 = Date.now();

  await page.goto('https://niuhai.github.io/luohammer-pixel-game/', { waitUntil: 'load', timeout: 60000 });
  await page.locator('#ui-boot-overlay').waitFor({ state: 'visible', timeout: 30000 });
  await page.locator('#ui-boot-buttons button', { hasText: '开始游戏' }).click({ timeout: 8000 });
  for (let i = 0; i < 7; i++) { await page.keyboard.press('Space'); await page.waitForTimeout(1000); }

  const samples = [];
  let final = null;
  // 长窗口：最多 90s，每 3s 采样一次
  for (let i = 0; i < 30; i++) {
    await page.waitForTimeout(3000);
    const s = await page.evaluate(() => {
      const g = window.game;
      const gs = g.scene.keys.GameScene;
      const gl = document.getElementById('ui-game-loading');
      const talent = document.querySelector('.ui-talent-overlay');
      return {
        status: gs ? gs.sys.settings.status : null, // 5=RUNNING
        progress: gs && gs.load ? gs.load.progress : null,
        loadingVisible: !!(gl && gl.classList.contains('visible')),
        loadingText: gl ? gl.querySelector('.ui-game-loading-text')?.textContent : null,
        talent: !!(talent && talent.offsetHeight > 0),
      };
    });
    samples.push(`[+${Math.round((Date.now() - t0) / 1000)}s] ` + JSON.stringify(s));
    if (s.talent) { final = s; break; }
  }
  console.log(samples.join('\n'));
  console.log('errors:', JSON.stringify(logs));
  console.log(final ? 'PASS: talent overlay reached' : 'FAIL: talent overlay NOT reached in 90s');
  await browser.close();
  process.exit(final ? 0 : 1);
})();
