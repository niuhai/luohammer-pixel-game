/**
 * 临时脚本：抓取开场动画关键帧（验证「星图·人生路口」视觉）
 * 用法: node scripts/_capture_intro.cjs
 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const BASE = process.env.INTRO_URL || 'http://localhost:5174/luohammer-pixel-game/';
const OUT_DIR = path.join(__dirname, '..', 'tmp-intro-frames');

// 抓帧时刻（相对进入 IntroScene 的 ms）
const FRAMES = process.env.FRAMES_JSON ? JSON.parse(process.env.FRAMES_JSON) : [
  { at: 400,  name: 'f01-stars' },      // 星场淡入
  { at: 1200, name: 'f02-heart-line1' },// 中心节点 + L1
  { at: 1500, name: 'f02b-meteor' },    // 亮流星划向金色拐点（dur 900ms）
  { at: 2800, name: 'f03-path1' },      // 第一批光轨延伸中
  { at: 4000, name: 'f04-path2' },      // 第二批光轨 + 部分节点点亮
  { at: 4200, name: 'f04b-meteor2' },   // 暗流星掠过左上（dur 800ms）
  { at: 5600, name: 'f05-line3' },      // L3 浮现 + 终局波前传播中
  { at: 6100, name: 'f05c-flash' },     // 波前到达端点：节点白金闪光
  { at: 6800, name: 'f06-full' },       // 全星图高亮保持 + 终局聚焦
];

(async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.on('console', m => { if (m.type() === 'error') console.log('[console.error]', m.text()); });
  page.on('pageerror', e => console.log('[pageerror]', e.message));

  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForSelector('#ui-boot-overlay.visible', { timeout: 15000 });

  // 首次访问流程：点「开始游戏」进入 IntroScene（fresh profile 无"回顾开场"按钮）
  const t0 = Date.now();
  const clicked = await page.evaluate(() => {
    const btn = document.querySelector('.ui-boot-btn-primary');
    if (btn) { btn.click(); return true; }
    return false;
  });
  if (!clicked) throw new Error('start button not found');
  await page.waitForSelector('#ui-intro-overlay.visible', { timeout: 5000 });
  const entered = Date.now();
  console.log(`entered IntroScene at +${entered - t0}ms`);

  for (const f of FRAMES) {
    const wait = f.at - (Date.now() - entered);
    if (wait > 0) await page.waitForTimeout(wait);
    const file = path.join(OUT_DIR, `${f.name}.png`);
    await page.screenshot({ path: file });
    console.log(`captured ${f.name} at +${Date.now() - entered}ms`);
  }

  // 验证自然结束后 intro overlay 隐藏（进入 GameScene）
  await page.waitForSelector('#ui-intro-overlay:not(.visible)', { timeout: 8000 }).catch(() => console.log('WARN: intro overlay still visible after 8s'));
  console.log('intro finished OK');

  await browser.close();
})();

/** 移动端竖屏抓帧：375x812，验证文案不溢出、星图可见 */
async function captureMobile() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });
  page.on('pageerror', e => console.log('[mobile pageerror]', e.message));
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForSelector('#ui-boot-overlay.visible', { timeout: 15000 });
  // 关掉横屏提示，纯看开场表现
  await page.evaluate(() => document.getElementById('rotate-hint')?.classList.add('hidden'));
  await page.evaluate(() => document.querySelector('.ui-boot-btn-primary')?.click());
  await page.waitForSelector('#ui-intro-overlay.visible', { timeout: 5000 });
  await page.waitForTimeout(6800);
  await page.screenshot({ path: path.join(OUT_DIR, 'f07-mobile-portrait.png') });
  console.log('captured f07-mobile-portrait');
  await browser.close();
}

if (process.env.INTRO_MOBILE === '1') {
  captureMobile().catch(e => { console.error('[mobile]', e.message); process.exit(1); });
}

