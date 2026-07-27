// R90：本地 preview 冒烟——隔离网络因素，验证天赋 overlay 流程未被 R90 改动破坏
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 375, height: 812 } });
  const consoleErrs = [];
  page.on('pageerror', (e) => consoleErrs.push('PAGEERROR: ' + String(e).slice(0, 150)));
  page.on('console', (m) => { if (m.type() === 'error') consoleErrs.push(m.text().slice(0, 150)); });

  const result = { bootVisible: false, talentOverlay: false, activeScene: null, consoleErrs };
  try {
    await page.goto('http://localhost:4173/luohammer-pixel-game/', { waitUntil: 'load', timeout: 30000 });
    result.bootVisible = await page.locator('#ui-boot-overlay').isVisible({ timeout: 15000 });

    if (result.bootVisible) {
      await page.locator('#ui-boot-buttons button', { hasText: '开始游戏' }).click({ timeout: 8000 });
      for (let i = 0; i < 20; i++) {
        result.talentOverlay = await page.evaluate(() => {
          const el = document.querySelector('.ui-talent-overlay');
          return !!(el && getComputedStyle(el).display !== 'none' && el.offsetHeight > 0);
        });
        if (result.talentOverlay) break;
        await page.keyboard.press('Space');
        await page.waitForTimeout(700);
      }
      result.activeScene = await page.evaluate(() => {
        if (!window.game) return 'no-game-handle';
        return window.game.scene.getScenes(true).map(s => s.scene.key).join(',');
      });
    }
  } catch (e) {
    result.err = String(e).slice(0, 200);
  }
  console.log(JSON.stringify(result, null, 2));
  await browser.close();
  process.exit(result.bootVisible && result.talentOverlay && consoleErrs.length === 0 ? 0 : 1);
})();
