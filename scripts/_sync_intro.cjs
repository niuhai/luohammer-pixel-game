/**
 * 探针：验证 R16 终局同步（"他"字现金同刻波前涌出）。
 * 无头环境下 Phaser Clock（驱动 delayedCall 文案）落后 RAF 时间戳（驱动绘制），
 * 本脚本每帧强制 scene._startTime = time - scene.time.now，使两条时间线对齐，
 * 模拟真实浏览器 60fps 播放，再冻结抓帧。
 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const BASE = process.env.INTRO_URL || 'http://localhost:5174/luohammer-pixel-game/';
const OUT_DIR = path.join(__dirname, '..', 'tmp-intro-frames');

const FRAMES = JSON.parse(process.env.FRAMES_JSON || '[{"at":5480,"name":"r16b-sync"},{"at":6340,"name":"r16b-arrive"},{"at":7550,"name":"r16b-hold"}]');

(async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.on('pageerror', e => console.log('[pageerror]', e.message));

  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForSelector('#ui-boot-overlay.visible', { timeout: 15000 });

  await page.evaluate(() => {
    window.__frozen = false;
    window.__freezeAt = null;
    const scene = window.game.scene.getScene('IntroScene');
    scene.events.on('update', (time) => {
      // 对齐：RAF 相对时钟 = Phaser Clock（真实浏览器中二者天然一致）
      if (scene._startTime && scene.time) {
        scene._startTime = time - scene.time.now;
      }
      const target = window.__freezeAt;
      if (target && scene._startTime != null && scene.time && scene.time.now >= target) {
        window.__freezeAt = null;
        window.__frozenAt = Math.round(scene.time.now);
        window.game.loop.sleep();
        window.__frozen = true;
      }
    });
  });

  await page.evaluate(() => document.querySelector('.ui-boot-btn-primary')?.click());
  await page.waitForSelector('#ui-intro-overlay.visible', { timeout: 5000 });
  console.log('entered IntroScene');

  for (const f of FRAMES) {
    await page.evaluate((at) => {
      window.__frozen = false;
      window.__freezeAt = at;
      if (window.game.loop && window.game.loop.wake) window.game.loop.wake();
    }, f.at);
    await page.waitForFunction(() => window.__frozen === true, null, { timeout: 20000 });
    const state = await page.evaluate(() => {
      const scene = window.game.scene.getScene('IntroScene');
      const l3 = document.getElementById('ui-intro-line3');
      const chars = l3 ? [...l3.querySelectorAll('.ui-intro-char')] : [];
      return {
        frozenAt: window.__frozenAt,
        clockNow: scene.time ? Math.round(scene.time.now) : null,
        finaleClass: !!document.querySelector('.ui-intro-text-layer')?.classList.contains('finale'),
        l3Revealed: chars.filter(c => c.classList.contains('revealed')).length,
        l3Total: chars.length,
        heRevealed: chars[7] ? chars[7].classList.contains('revealed') : null
      };
    });
    console.log(`captured ${f.name}`, JSON.stringify(state));
    await page.screenshot({ path: path.join(OUT_DIR, `${f.name}.png`) });
  }

  await browser.close();
})();
