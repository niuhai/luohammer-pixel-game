// R73 验证：真实路径结局串扰 + 移动端布局遮挡实测
const { chromium } = require('playwright');
const OUT = 'test-screenshots/r73';

(async () => {
  const browser = await chromium.launch();

  // === 1. 真实路径：标题页 → 继续游戏（注入结局前夜 state）→ 玩到结局 ===
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.on('pageerror', e => console.log('PAGEERROR:', e.message));
  await page.goto('http://localhost:5173/luohammer-pixel-game/');
  await page.evaluate(() => {
    localStorage.clear();
    const state = {
      pride: 6, wealth: 5, reputation: 5, failures: 0, pressure: 2, trust: 5,
      pressureMax: 10, failurePenalty: 1, successBonus: 1,
      talentSpecials: [], currentStageId: 'youth', currentNode: 'ending_scholar',
      flags: [], triggeredEvents: [], history: [], achievements: [],
      gameStartTime: Date.now() - 60000
    };
    localStorage.setItem('luohammer_save', JSON.stringify(state));
    localStorage.setItem('luohammer_save_backup', JSON.stringify(state));
  });
  await page.reload();
  const btn = page.locator('#ui-boot-buttons button', { hasText: '继续游戏' });
  await btn.waitFor({ state: 'visible', timeout: 15000 });
  await btn.click();
  await page.locator('#ui-ending-overlay.visible').waitFor({ timeout: 30000 });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${OUT}/v-real-ending.png` });

  // 检查标题页 DOM 是否残留可见
  const leak = await page.evaluate(() => {
    const probe = (sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return { visible: r.width > 0 && r.height > 0 && cs.display !== 'none' && cs.visibility !== 'hidden' && +cs.opacity > 0.01, opacity: cs.opacity, display: cs.display, zIndex: cs.zIndex };
    };
    return {
      bootButtons: probe('#ui-boot-buttons'),
      bootTitle: probe('#ui-boot-title') || probe('.ui-boot-title'),
      bootContainer: probe('#ui-boot'),
      endingOverlay: probe('#ui-ending-overlay')
    };
  });
  console.log('真实路径标题页残留:', JSON.stringify(leak, null, 2));

  // === 2. 移动端布局遮挡实测 ===
  const m = await browser.newPage({ viewport: { width: 375, height: 812 } });
  m.on('pageerror', e => console.log('M PAGEERROR:', e.message));
  await m.goto('http://localhost:5173/luohammer-pixel-game/');
  await m.evaluate(() => {
    localStorage.clear();
    const state = {
      pride: 6, wealth: 1, reputation: 6, failures: 3, pressure: 7, trust: 4,
      pressureMax: 10, failurePenalty: 1, successBonus: 1,
      talentSpecials: [], currentStageId: 'act6', currentNode: 'act6_night',
      flags: [], triggeredEvents: [], history: [], achievements: [],
      gameStartTime: Date.now() - 300000
    };
    localStorage.setItem('luohammer_save', JSON.stringify(state));
    localStorage.setItem('luohammer_save_backup', JSON.stringify(state));
  });
  await m.reload();
  const mbtn = m.locator('#ui-boot-buttons button', { hasText: '继续游戏' });
  await mbtn.waitFor({ state: 'visible', timeout: 15000 });
  await mbtn.click();
  // 推进对话直到选项出现
  for (let i = 0; i < 30; i++) {
    const n = await m.evaluate(() => document.querySelectorAll('.ui-choice-btn').length);
    if (n > 0) break;
    await m.keyboard.press('Space');
    await m.waitForTimeout(600);
  }
  await m.locator('.ui-choice-btn').first().waitFor({ state: 'visible', timeout: 10000 });
  await m.waitForTimeout(1200);

  const layout = await m.evaluate(() => {
    const rect = (sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
    };
    // F5 实测：选项文字/对话文字/章节名 字号
    const fs = (sel) => {
      const el = document.querySelector(sel);
      return el ? getComputedStyle(el).fontSize : null;
    };
    // F3/F4 实测：4 个固定按钮右偏移与间距
    const btnRight = (sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { right: Math.round(innerWidth - r.right), w: Math.round(r.width) };
    };
    return {
      canvas: rect('#game-container canvas') || rect('canvas'),
      choices: rect('#ui-choices'),
      dialog: rect('#ui-dialog'),
      stats: rect('#ui-stats'),
      chapter: rect('#ui-chapter') || rect('.ui-chapter'),
      viewport: { w: innerWidth, h: innerHeight },
      fontSize: {
        choiceText: fs('.ui-choice-btn .ui-choice-text'),
        dialogText: fs('.ui-dialog-text'),
        chapterName: fs('.ui-chapter-name')
      },
      buttons: {
        sound: btnRight('.ui-sound-toggle'),
        menu: btnRight('.ui-menu-toggle'),
        narration: btnRight('.ui-narration-toggle'),
        voice: btnRight('.ui-voice-toggle')
      }
    };
  });
  console.log('移动端布局:', JSON.stringify(layout, null, 2));
  await m.screenshot({ path: `${OUT}/v-mobile-layout.png` });

  // 桌面端按钮间距复核
  const d = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await d.goto('http://localhost:5173/luohammer-pixel-game/');
  await d.evaluate(() => {
    localStorage.clear();
    const state = {
      pride: 6, wealth: 1, reputation: 6, failures: 3, pressure: 7, trust: 4,
      pressureMax: 10, failurePenalty: 1, successBonus: 1,
      talentSpecials: [], currentStageId: 'act6', currentNode: 'act6_night',
      flags: [], triggeredEvents: [], history: [], achievements: [],
      gameStartTime: Date.now() - 300000
    };
    localStorage.setItem('luohammer_save', JSON.stringify(state));
    localStorage.setItem('luohammer_save_backup', JSON.stringify(state));
  });
  await d.reload();
  const dbtn = d.locator('#ui-boot-buttons button', { hasText: '继续游戏' });
  await dbtn.waitFor({ state: 'visible', timeout: 15000 });
  await dbtn.click();
  await d.waitForTimeout(2000);
  const dbtns = await d.evaluate(() => {
    const btnRight = (sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { right: Math.round(innerWidth - r.right), w: Math.round(r.width), visible: r.width > 0 };
    };
    return {
      sound: btnRight('.ui-sound-toggle'),
      menu: btnRight('.ui-menu-toggle'),
      narration: btnRight('.ui-narration-toggle'),
      voice: btnRight('.ui-voice-toggle')
    };
  });
  console.log('桌面按钮:', JSON.stringify(dbtns));
  await d.close();

  await browser.close();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
