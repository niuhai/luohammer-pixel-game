// 对照诊断：本地 preview 版本天赋 overlay 可达性 + 场景状态探针
const { chromium } = require('playwright');

(async () => {
  const base = process.argv[2] || 'http://localhost:4319/';
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 375, height: 812 } });
  const consoleErrs = [];
  page.on('pageerror', (e) => consoleErrs.push('PAGEERROR: ' + String(e).slice(0, 200)));
  page.on('console', (m) => { if (m.type() === 'error') consoleErrs.push(m.text().slice(0, 200)); });

  const t0 = Date.now();
  await page.goto(base, { waitUntil: 'load', timeout: 30000 });
  const loadMs = Date.now() - t0;
  const bootVisible = await page.locator('#ui-boot-overlay').isVisible({ timeout: 15000 }).catch(() => false);

  let talentOverlay = false; let talentAtRound = -1;
  const probe = {};
  if (bootVisible) {
    await page.locator('#ui-boot-buttons button', { hasText: '开始游戏' }).click({ timeout: 8000 });
    for (let i = 0; i < 30; i++) {
      talentOverlay = await page.evaluate(() => {
        const el = document.querySelector('.ui-talent-overlay');
        return !!(el && getComputedStyle(el).display !== 'none' && el.offsetHeight > 0);
      });
      if (talentOverlay) { talentAtRound = i; break; }
      await page.keyboard.press('Space');
      await page.waitForTimeout(1000);
    }
    // 场景状态探针
    Object.assign(probe, await page.evaluate(() => {
      const g = window.game;
      const scenes = g ? g.scene.getScenes(true).map((s) => s.scene.key) : [];
      const overlays = Array.from(document.querySelectorAll('[id^="ui-"], [class*="overlay"]'))
        .filter((el) => el.offsetHeight > 0)
        .map((el) => el.id || el.className).slice(0, 15);
      return { activeScenes: scenes, visibleOverlays: overlays };
    }));
    await page.screenshot({ path: 'scripts/_diag_state.png' });
  }
  console.log(JSON.stringify({ base, loadMs, bootVisible, talentOverlay, talentAtRound, probe, consoleErrs }, null, 2));
  await browser.close();
})();
