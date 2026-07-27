// 线上逐次空格探针：定位场景全停发生在哪一步 + 焦点元素 + scene 事件追踪
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 375, height: 812 } });
  const logs = [];
  page.on('pageerror', (e) => logs.push('PAGEERROR: ' + String(e).slice(0, 300)));
  page.on('console', (m) => { const t = m.text(); if (!t.includes('Phaser v') && !t.includes('[PWA]')) logs.push(`[${m.type()}] ` + t.slice(0, 200)); });

  await page.goto('https://niuhai.github.io/luohammer-pixel-game/', { waitUntil: 'load', timeout: 60000 });
  const bootVisible = await page.locator('#ui-boot-overlay').isVisible({ timeout: 30000 }).catch(() => false);

  if (bootVisible) {
    // 注入 scene 事件监听
    await page.evaluate(() => {
      window.__sceneLog = [];
      const g = window.game;
      g.scene.scenes.forEach((s) => {
        s.events.on('start', () => window.__sceneLog.push(s.scene.key + ':start'));
        s.events.on('shutdown', () => window.__sceneLog.push(s.scene.key + ':shutdown'));
        s.events.on('create', () => window.__sceneLog.push(s.scene.key + ':create'));
      });
    });
    await page.locator('#ui-boot-buttons button', { hasText: '开始游戏' }).click({ timeout: 8000 });
    for (let i = 0; i < 12; i++) {
      await page.waitForTimeout(1200);
      const st = await page.evaluate(() => {
        const g = window.game;
        return {
          active: g ? g.scene.scenes.filter((s) => s.scene.isActive()).map((s) => s.scene.key) : [],
          registered: g ? g.scene.scenes.map((s) => s.scene.key) : [],
          talent: !!document.querySelector('.ui-talent-overlay')?.offsetHeight,
          intro: !!document.getElementById('ui-intro-overlay')?.offsetHeight,
          focus: document.activeElement ? (document.activeElement.id || document.activeElement.tagName + '.' + document.activeElement.className).slice(0, 60) : null,
          sceneLog: window.__sceneLog.splice(0),
        };
      });
      logs.push(`after space#${i}: ` + JSON.stringify(st));
      if (st.talent) { logs.push('--- TALENT REACHED ---'); break; }
      await page.keyboard.press('Space');
    }
    await page.screenshot({ path: 'scripts/_diag_state3.png' });
  }
  console.log(JSON.stringify(logs, null, 2));
  await browser.close();
})();
