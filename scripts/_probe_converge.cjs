const { chromium } = require('playwright');
const BASE = process.env.INTRO_URL || 'http://localhost:5177/luohammer-pixel-game/';
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.on('pageerror', e => console.log('[pageerror]', e.message));
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#ui-boot-overlay.visible', { timeout: 15000 });
  await page.evaluate(() => {
    window.__frozen = false; window.__freezeAt = null; window.__reanchor = null;
    window.__handlerT = []; window.__updateT = [];
    const scene = window.game.scene.getScene('IntroScene');
    scene.events.on('update', (time) => {
      if (window.__reanchor != null && scene._startTime) {
        scene._startTime += (time - scene._startTime) - window.__reanchor;
        window.__reanchor = null; }
      if (scene._startTime) window.__handlerT.push(Math.round(time - scene._startTime));
      const target = window.__freezeAt;
      if (target && scene._startTime && (time - scene._startTime) >= target) {
        window.__freezeAt = null; window.__frozenAt = Math.round(time - scene._startTime);
        window.game.loop.sleep(); window.__frozen = true; }
    });
  });
  await page.evaluate(() => document.querySelector('.ui-boot-btn-primary')?.click());
  await page.waitForSelector('#ui-intro-overlay.visible', { timeout: 5000 });
  await page.evaluate(() => {
    const scene = window.game.scene.getScene('IntroScene');
    const orig = scene.update.bind(scene);
    scene.update = (time) => {
      if (scene._startTime) window.__updateT.push(Math.round(time - scene._startTime));
      return orig(time); };
    window.__patched = true; });
  const PROBES = [6900, 7300, 7700];
  for (const at of PROBES) {
    await page.evaluate((target) => {
      window.__frozen = false;
      window.__reanchor = window.__frozenAt != null ? window.__frozenAt : null;
      window.__freezeAt = target;
      if (window.game.loop && window.game.loop.wake) window.game.loop.wake();
    }, at);
    await page.waitForFunction(() => window.__frozen === true, null, { timeout: 15000 });
    const state = await page.evaluate(() => {
      const scene = window.game.scene.getScene('IntroScene');
      return { patched: window.__patched === true, frozenAt: window.__frozenAt,
        convergeAt: Math.round(scene._convergeAt), burstAt: Math.round(scene._burstAt),
        handlerTail: window.__handlerT.slice(-6), updateTail: window.__updateT.slice(-6),
        updateCalls: window.__updateT.length };
    });
    console.log('probe target=' + at, JSON.stringify(state));
  }
  await browser.close();
})();