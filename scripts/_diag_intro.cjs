/** 诊断：冻结在 7705ms（爆发后）， dump 场景收场相关状态 */
const { chromium } = require('playwright');
const BASE = process.env.INTRO_URL || 'http://localhost:5174/luohammer-pixel-game/';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.on('pageerror', e => console.log('[pageerror]', e.message));
  page.on('console', m => { if (m.type() !== 'log') console.log(`[console.${m.type()}]`, m.text()); });
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForSelector('#ui-boot-overlay.visible', { timeout: 15000 });
  await page.evaluate(() => document.querySelector('.ui-boot-btn-primary').click());
  await page.waitForSelector('#ui-intro-overlay.visible', { timeout: 5000 });

  // 注入冻结钩子（与 _capture_intro.cjs 同逻辑）
  await page.evaluate(() => {
    window.__frozen = false;
    window.__freezeAt = 7705;
    const scene = window.game.scene.getScene('IntroScene');
    scene.events.on('update', (time) => {
      if (window.__freezeAt && scene._startTime && (time - scene._startTime) >= window.__freezeAt) {
        window.__frozenAt = Math.round(time - scene._startTime);
        window.game.loop.sleep();
        window.__frozen = true;
      }
    });
  });

  await page.waitForFunction(() => window.__frozen === true, null, { timeout: 20000 });
  const diag = await page.evaluate(() => {
    const s = window.game.scene.getScene('IntroScene');
    const flashEl = document.getElementById('ui-intro-flash');
    return JSON.stringify({
      frozenAt: window.__frozenAt,
      convergeAt: s._convergeAt,
      burstAt: s._burstAt,
      finished: s._finished,
      t: Math.round(s.time.now - s._startTime),
      clockNow: Math.round(s.time.now),
      startTime: Math.round(s._startTime),
      timers: s.time._active ? s.time._active.map(e => ({ d: e.delay, e: Math.round(e.elapsed) })) : 'n/a',
      flashExists: !!flashEl,
      flashOpacity: flashEl ? window.getComputedStyle(flashEl).opacity : null,
      sceneActive: s.scene.isActive()
    });
  });
  console.log('DIAG:', diag);
  await browser.close();
})();
