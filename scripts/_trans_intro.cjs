/**
 * 临时探针 v2：抓白闪切场后 GameScene 的入场衔接。
 * 冻结在 8500ms（收场切场前 ~10ms）→ 唤醒 → RAF 级轮询等场景翻转 → 立即连拍。
 * 同时记录 framenavigated 诊断页面是否意外 reload。
 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const BASE = process.env.INTRO_URL || 'http://localhost:5174/luohammer-pixel-game/';
const OUT_DIR = path.join(__dirname, '..', 'tmp-intro-frames');

(async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.on('pageerror', e => console.log('[pageerror]', e.message));
  page.on('framenavigated', f => {
    if (f === page.mainFrame()) console.log('[navigated]', f.url());
  });

  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForSelector('#ui-boot-overlay.visible', { timeout: 15000 });

  // 注入冻结钩子（与 _capture_intro.cjs 同款）
  await page.evaluate(() => {
    window.__frozen = false;
    window.__freezeAt = null;
    const scene = window.game.scene.getScene('IntroScene');
    scene.events.on('update', (time) => {
      const target = window.__freezeAt;
      if (target && scene._startTime && (time - scene._startTime) >= target) {
        window.__freezeAt = null;
        window.__frozenAt = Math.round(time - scene._startTime);
        window.game.loop.sleep();
        window.__frozen = true;
      }
    });
  });

  await page.evaluate(() => document.querySelector('.ui-boot-btn-primary')?.click());
  await page.waitForSelector('#ui-intro-overlay.visible', { timeout: 5000 });
  console.log('entered IntroScene, natural playback...');

  // 自然播放（不冻结——CSS transition 挂墙钟，冻结会让白闪溶解在冻结窗口内跑完）。
  // RAF 级等场景翻转：overlay 隐藏 + GameScene active。
  await page.waitForFunction(() => {
    const overlay = document.getElementById('ui-intro-overlay');
    const game = window.game;
    if (!overlay || !game) return false;
    const active = game.scene.getScenes(true).map(s => s.scene.key);
    return !overlay.classList.contains('visible') && active.includes('GameScene');
  }, null, { timeout: 15000 });
  console.log('scene flipped to GameScene');
  const t0 = Date.now();

  const shots = [[0, 't0'], [120, 't120'], [400, 't400'], [1000, 't1000'], [2200, 't2200']];
  for (const [delay, name] of shots) {
    const wait = delay - (Date.now() - t0);
    if (wait > 0) await page.waitForTimeout(wait);
    await page.screenshot({ path: path.join(OUT_DIR, `trans-${name}.png`) });
    console.log(`captured trans-${name}`);
  }

  await browser.close();
})();
