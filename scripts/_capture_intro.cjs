/**
 * 临时脚本：抓取开场动画关键帧（验证「星图·人生路口」视觉）
 * 冻结帧方案：进入 IntroScene 前在游戏内注入 update 钩子，
 * 到达目标游戏时刻时 loop.sleep() 冻结 RAF，截图零漂移。
 * 用法: node scripts/_capture_intro.cjs
 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const BASE = process.env.INTRO_URL || 'http://localhost:5174/luohammer-pixel-game/';
const OUT_DIR = path.join(__dirname, '..', 'tmp-intro-frames');

// 抓帧时刻（相对进入 IntroScene 的 ms，游戏内时钟精确冻结）
const FRAMES = process.env.FRAMES_JSON ? JSON.parse(process.env.FRAMES_JSON) : [
  { at: 900,  name: 'f01-heart' },      // 中心节点亮起 + 星场淡入中
  { at: 1600, name: 'f02-meteor' },     // 亮流星划向金色拐点途中
  { at: 3000, name: 'f03-path1' },      // 第一批光轨延伸 + L1/L2
  { at: 4600, name: 'f04-nodes' },      // 节点点亮 + 方向词浮现
  { at: 5400, name: 'f05-wave' },       // 终局波前传播中（43%）
  { at: 6150, name: 'f06-flash' },      // 波前到达端点：节点白金闪光
  { at: 6850, name: 'f07-hold' },       // 星光齐明保持（swell 完成）+ 终局聚焦
];

(async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.on('console', m => { if (m.type() === 'error') console.log('[console.error]', m.text()); });
  page.on('pageerror', e => console.log('[pageerror]', e.message));

  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForSelector('#ui-boot-overlay.visible', { timeout: 15000 });

  // 先注入冻结钩子（IntroScene 实例常驻，events 跨 start/shutdown 存活）
  // __reanchor：冻结后唤醒时 RAF 时间戳可能跳变，把场景时钟重新锚定到冻结时刻
  await page.evaluate(() => {
    window.__frozen = false;
    window.__freezeAt = null;
    window.__reanchor = null;
    const scene = window.game.scene.getScene('IntroScene');
    scene.events.on('update', (time) => {
      if (window.__reanchor != null && scene._startTime) {
        scene._startTime += (time - scene._startTime) - window.__reanchor;
        window.__reanchor = null;
      }
      const target = window.__freezeAt;
      if (target && scene._startTime && (time - scene._startTime) >= target) {
        window.__freezeAt = null;
        window.__frozenAt = Math.round(time - scene._startTime);
        window.game.loop.sleep();
        window.__frozen = true;
      }
    });
  });

  // 首次访问流程：点「开始游戏」进入 IntroScene（fresh profile 无"回顾开场"按钮）
  const clicked = await page.evaluate(() => {
    const btn = document.querySelector('.ui-boot-btn-primary');
    if (btn) { btn.click(); return true; }
    return false;
  });
  if (!clicked) throw new Error('start button not found');
  await page.waitForSelector('#ui-intro-overlay.visible', { timeout: 5000 });
  console.log('entered IntroScene');

  for (const f of FRAMES) {
    // 布防目标时刻 → 唤醒循环 → 等冻结 → 截图（RAF 已停，零漂移）
    await page.evaluate((at) => {
      window.__frozen = false;
      window.__reanchor = window.__frozenAt != null ? window.__frozenAt : null;
      window.__freezeAt = at;
      if (window.game.loop && window.game.loop.wake) window.game.loop.wake();
    }, f.at);
    await page.waitForFunction(() => window.__frozen === true, null, { timeout: 15000 });
    const frozenAt = await page.evaluate(() => window.__frozenAt);
    const file = path.join(OUT_DIR, `${f.name}.png`);
    await page.screenshot({ path: file });
    console.log(`captured ${f.name} target=${f.at} frozenAt=${frozenAt}`);
  }

  await browser.close();
})();

/** 移动端竖屏抓帧：375x812，验证文案不溢出、星图可见（终局保持帧） */
async function captureMobile() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });
  page.on('pageerror', e => console.log('[mobile pageerror]', e.message));
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForSelector('#ui-boot-overlay.visible', { timeout: 15000 });
  await page.evaluate(() => document.getElementById('rotate-hint')?.classList.add('hidden'));
  await page.evaluate(() => {
    window.__frozen = false;
    window.__freezeAt = null;
    const scene = window.game.scene.getScene('IntroScene');
    scene.events.on('update', (time) => {
      const target = window.__freezeAt;
      if (target && scene._startTime && (time - scene._startTime) >= target) {
        window.__freezeAt = null;
        window.game.loop.sleep();
        window.__frozen = true;
      }
    });
  });
  await page.evaluate(() => document.querySelector('.ui-boot-btn-primary')?.click());
  await page.waitForSelector('#ui-intro-overlay.visible', { timeout: 5000 });
  const mobileAt = Number(process.env.INTRO_MOBILE_AT || 6500);
  await page.evaluate((at) => {
    window.__freezeAt = at;
    if (window.game.loop && window.game.loop.wake) window.game.loop.wake();
  }, mobileAt);
  await page.waitForFunction(() => window.__frozen === true, null, { timeout: 15000 });
  const mobileName = process.env.INTRO_MOBILE_NAME || 'f08-mobile-portrait';
  await page.screenshot({ path: path.join(OUT_DIR, `${mobileName}.png`) });
  console.log(`captured ${mobileName}`);
  await browser.close();
}

if (process.env.INTRO_MOBILE === '1') {
  captureMobile().catch(e => { console.error('[mobile]', e.message); process.exit(1); });
}
