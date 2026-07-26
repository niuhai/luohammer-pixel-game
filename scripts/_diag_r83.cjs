// R83 诊断：F3 横屏锁定选项原因 vs 属性面板遮挡实测（812x375）
// 注入 3 选项（layout-side）含 1 锁定项，测 lock-hint 与 .ui-stats 矩形关系
const { chromium } = require('playwright');
const BASE = process.argv[2] || 'http://localhost:5199/luohammer-pixel-game/';

async function gotoGameScene(page) {
  // dev 首访编译慢：轮询等 window.game 就绪
  for (let i = 0; i < 40; i++) {
    const ready = await page.evaluate(() => !!window.game);
    if (ready) break;
    await page.waitForTimeout(500);
  }
  await page.evaluate(() => {
    document.querySelector('#rotate-hint-dismiss')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('.ui-boot-btn')].find(b => /继续游戏|新游戏|开始游戏/.test(b.textContent));
    btn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  // 推进到天赋屏
  for (let i = 0; i < 30; i++) {
    const ok = await page.evaluate(() => !!document.querySelector('.ui-talent-overlay.visible'));
    if (ok) break;
    await page.evaluate(() => {
      const t = document.querySelector('.ui-intro-overlay.visible') || document.querySelector('#dialog-touch-layer') || document.querySelector('#ui-dialog') || document.body;
      t.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await page.waitForTimeout(400);
  }
  await page.waitForTimeout(1600);
  // 选两个天赋并确认 → GameScene
  await page.evaluate(() => {
    const cards = [...document.querySelectorAll('.ui-talent-card')];
    cards[0]?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    cards[1]?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  await page.waitForTimeout(400);
  await page.evaluate(() => {
    document.querySelector('#ui-talent-confirm')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  await page.waitForTimeout(2500);
}

async function runCase(browser, w, h) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.goto(BASE, { waitUntil: 'load' });
  await page.waitForTimeout(1200);
  await gotoGameScene(page);

  const inGame = await page.evaluate(() => !!(window.game && window.game.scene.getScene('GameScene') && window.game.scene.getScene('GameScene').choices));
  console.log(`[${w}x${h}] 进入 GameScene:`, inGame);
  if (!inGame) {
    const state = await page.evaluate(() => ({
      talent: !!document.querySelector('.ui-talent-overlay.visible'),
      btns: [...document.querySelectorAll('.ui-boot-btn')].map(b => b.textContent.trim()).slice(0, 5),
      scenes: window.game ? window.game.scene.getScenes(true).map(s => s.scene.key) : []
    }));
    console.log('失败现场:', JSON.stringify(state));
    await page.screenshot({ path: `shots/r83-diag-fail-${w}.png` });
    await ctx.close(); return false;
  }

  // 注入 3 选项（layout-side）+ 1 锁定项，模拟真实锁定原因文案
  await page.evaluate(() => {
    const scene = window.game.scene.getScene('GameScene');
    scene.state = scene.state || {};
    scene.choices.show([
      { label: '接受投资人的对赌协议，三个月内还清一个亿', effects: {} },
      { label: '拒绝对赌，选择慢慢还债的漫长道路', effects: {} },
      { label: '孤注一掷，押上全部信誉再博一次', requires: { reputation: 80, trust: 60 }, effects: {} }
    ], () => {});
  });
  await page.waitForTimeout(900); // 等 stagger 入场完

  const r = await page.evaluate(() => {
    const stats = document.querySelector('#ui-stats');
    const statsB = stats.getBoundingClientRect();
    const choices = document.querySelector('#ui-choices');
    const chB = choices.getBoundingClientRect();
    const hint = document.querySelector('.ui-choice-lock-hint');
    const hintB = hint ? hint.getBoundingClientRect() : null;
    return {
      layout: [...choices.classList].find(c => c.startsWith('layout-')),
      statsRect: { left: Math.round(statsB.left), right: Math.round(statsB.right), w: Math.round(statsB.width), top: Math.round(statsB.top), bottom: Math.round(statsB.bottom) },
      choicesRect: { left: Math.round(chB.left), right: Math.round(chB.right), w: Math.round(chB.width) },
      hintRect: hintB ? { left: Math.round(hintB.left), right: Math.round(hintB.right), top: Math.round(hintB.top), bottom: Math.round(hintB.bottom), text: hint.textContent } : null,
      viewport: { w: innerWidth, h: innerHeight }
    };
  });
  console.log(JSON.stringify(r));
  // 遮挡判定：选项容器右缘 / 锁定提示右缘 vs 属性面板容器左缘
  if (r.hintRect) {
    const gapBtn = r.statsRect.left - r.choicesRect.right;
    const gapHint = r.statsRect.left - r.hintRect.right;
    const pass = gapBtn > 0 && gapHint > 0;
    console.log(`[${w}x${h}] 面板左缘 ${r.statsRect.left} | 选项右缘 ${r.choicesRect.right} (间隙 ${gapBtn}px) | 提示右缘 ${r.hintRect.right} (间隙 ${gapHint}px) → ${pass ? '【无遮挡 PASS】' : '【遮挡 FAIL】'}`);
    await page.screenshot({ path: `shots/r83-diag-locked-${w}x${h}.png` });
    await ctx.close();
    return pass;
  }
  await ctx.close();
  return false;
}

(async () => {
  const browser = await chromium.launch();
  const p1 = await runCase(browser, 812, 375);
  const p2 = await runCase(browser, 896, 414);
  const p3 = await runCase(browser, 926, 428);
  console.log(p1 && p2 && p3 ? '== R83 F3 DIAG ALL PASS ==' : '== R83 F3 DIAG HAS FAIL ==');
  await browser.close();
  process.exit(p1 && p2 && p3 ? 0 : 1);
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
