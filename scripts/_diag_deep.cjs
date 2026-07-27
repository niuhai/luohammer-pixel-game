// 线上场景停滞深度诊断：全 console 捕获 + SceneManager 全量状态 + 网络失败请求
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 375, height: 812 } });
  const logs = [];
  const failedReqs = [];
  page.on('pageerror', (e) => logs.push('PAGEERROR: ' + String(e).slice(0, 300)));
  page.on('console', (m) => logs.push(`[${m.type()}] ` + m.text().slice(0, 300)));
  page.on('requestfailed', (r) => failedReqs.push(r.url().slice(-80) + ' :: ' + (r.failure()?.errorText || '')));

  await page.goto('https://niuhai.github.io/luohammer-pixel-game/', { waitUntil: 'load', timeout: 60000 });
  const bootVisible = await page.locator('#ui-boot-overlay').isVisible({ timeout: 30000 }).catch(() => false);
  logs.push(`--- bootVisible=${bootVisible}, clicking 开始游戏 ---`);

  if (bootVisible) {
    await page.locator('#ui-boot-buttons button', { hasText: '开始游戏' }).click({ timeout: 8000 });
    await page.waitForTimeout(5000);
    const state1 = await page.evaluate(() => {
      const g = window.game;
      if (!g) return { game: null };
      return {
        scenes: g.scene.scenes.map((s) => ({ key: s.scene.key, active: s.scene.isActive(), visible: s.scene.isVisible(), paused: s.scene.isPaused(), sleeping: s.scene.isSleeping() })),
        bootOverlayVisible: !!document.getElementById('ui-boot-overlay')?.offsetHeight,
        introOverlay: !!document.getElementById('ui-intro-overlay')?.offsetHeight,
      };
    });
    logs.push('--- state after click+5s: ' + JSON.stringify(state1));
    // 空格推进 10 轮后再探
    for (let i = 0; i < 10; i++) { await page.keyboard.press('Space'); await page.waitForTimeout(800); }
    const state2 = await page.evaluate(() => {
      const g = window.game;
      if (!g) return { game: null };
      return {
        scenes: g.scene.scenes.map((s) => ({ key: s.scene.key, active: s.scene.isActive(), paused: s.scene.isPaused() })),
        talentOverlay: !!document.querySelector('.ui-talent-overlay')?.offsetHeight,
      };
    });
    logs.push('--- state after 10 space: ' + JSON.stringify(state2));
    await page.screenshot({ path: 'scripts/_diag_state2.png' });
  }
  console.log(JSON.stringify({ failedReqs, logs }, null, 2));
  await browser.close();
})();
