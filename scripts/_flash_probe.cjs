/**
 * 探针：采样白闪层 computed opacity，定位跨场景溶解为何不可见。
 * 从 7.4s 开始每 100ms 采样：opacity / display / 几何 / 场景，直到切场后 1.2s。
 */
const { chromium } = require('playwright');

const BASE = process.env.INTRO_URL || 'http://localhost:5173/luohammer-pixel-game/';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.on('pageerror', e => console.log('[pageerror]', e.message));

  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForSelector('#ui-boot-overlay.visible', { timeout: 15000 });
  await page.evaluate(() => document.querySelector('.ui-boot-btn-primary')?.click());
  await page.waitForSelector('#ui-intro-overlay.visible', { timeout: 5000 });
  console.log('entered IntroScene');

  await page.evaluate(() => {
    window.__samples = [];
    const el = document.getElementById('ui-scene-flash');
    const t0 = performance.now();
    const iv = setInterval(() => {
      const t = Math.round(performance.now() - t0);
      if (!el) { window.__samples.push({ t, missing: true }); return; }
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      const scenes = window.game ? window.game.scene.getScenes(true).map(s => s.scene.key).join('+') : '?';
      window.__samples.push({
        t,
        inline: el.style.opacity,
        inlineTr: el.style.transition.slice(0, 40),
        computed: cs.opacity,
        display: cs.display,
        z: cs.zIndex,
        w: Math.round(r.width), h: Math.round(r.height),
        scenes
      });
    }, 100);
    window.__stopSampling = () => clearInterval(iv);
  });

  await page.waitForTimeout(11000);
  const samples = await page.evaluate(() => { window.__stopSampling(); return window.__samples; });
  // 只打印有变化的行（opacity 非 0 或场景含 GameScene）
  let lastKey = '';
  for (const s of samples) {
    const key = `${s.computed}|${s.scenes}`;
    if (key !== lastKey || (s.computed !== '0' && s.computed !== '1')) {
      console.log(JSON.stringify(s));
      lastKey = key;
    }
  }
  await browser.close();
})();
