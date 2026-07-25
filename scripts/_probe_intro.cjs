/** 探针：对比 实时 vs 冻结 两种状态下 canvas 像素，定位中心节点消失之谜 */
const { chromium } = require('playwright');

const BASE = process.env.INTRO_URL || 'http://localhost:5174/luohammer-pixel-game/';

function sampleScript(cx, cy) {
  return `(() => {
    const cv = document.querySelector('canvas');
    const ctx = cv.getContext('2d');
    const d = ctx.getImageData(${cx} - 6, ${cy} - 6, 13, 13).data;
    let max = 0, sum = 0, maxPx = null;
    for (let i = 0; i < d.length; i += 4) {
      const lum = d[i] + d[i+1] + d[i+2];
      sum += lum;
      if (lum > max) { max = lum; maxPx = [d[i], d[i+1], d[i+2], d[i+3]]; }
    }
    return JSON.stringify({ avg: Math.round(sum / (d.length / 4)), maxPx });
  })()`;
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.on('pageerror', e => console.log('[pageerror]', e.message));
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForSelector('#ui-boot-overlay.visible', { timeout: 15000 });

  await page.evaluate(() => document.querySelector('.ui-boot-btn-primary').click());
  await page.waitForSelector('#ui-intro-overlay.visible', { timeout: 5000 });

  // 等游戏时间到 ~933ms（轮询场景时钟）
  await page.waitForFunction(() => {
    const s = window.game.scene.getScene('IntroScene');
    return s && s._startTime && (s.time.now - s._startTime) >= 933;
  }, null, { timeout: 8000 });

  const rt = await page.evaluate(sampleScript(400, 172));
  console.log('REALTIME @~933 heart(400,172):', rt);

  // 同帧继续：冻结到 1500ms 再测一次（验证 freeze 后像素是否保留）
  await page.evaluate(() => {
    const s = window.game.scene.getScene('IntroScene');
    window.__frozen = false;
    window.__reanchor = null;
    window.__freezeAt = 1500;
    s.events.on('update', (time) => {
      if (window.__reanchor != null && s._startTime) {
        s._startTime += (time - s._startTime) - window.__reanchor;
        window.__reanchor = null;
      }
      if (window.__freezeAt && s._startTime && (time - s._startTime) >= window.__freezeAt) {
        window.__freezeAt = null;
        window.__frozenAt = Math.round(time - s._startTime);
        window.game.loop.sleep();
        window.__frozen = true;
      }
    });
  });
  await page.waitForFunction(() => window.__frozen === true, null, { timeout: 8000 });
  const fz = await page.evaluate(sampleScript(400, 172));
  const frozenAt = await page.evaluate(() => window.__frozenAt);
  console.log(`FROZEN @${frozenAt} heart(400,172):`, fz);

  // 诊断信息：_gfx 状态、相机、reducedMotion
  const diag = await page.evaluate(() => {
    const s = window.game.scene.getScene('IntroScene');
    const cam = window.game.scene.getScene('IntroScene').cameras.main;
    return JSON.stringify({
      gfxExists: !!s._gfx,
      gfxVisible: s._gfx ? s._gfx.visible : null,
      gfxAlpha: s._gfx ? s._gfx.alpha : null,
      camZoom: cam.zoom, camScroll: [cam.scrollX, cam.scrollY],
      reduced: s._reducedMotion,
      startTime: s._startTime,
      now: s.time.now
    });
  });
  console.log('DIAG:', diag);

  await browser.close();
})();
