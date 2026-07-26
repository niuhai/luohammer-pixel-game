// R83 SCAN 渠道3：完整评委旅程端到端走查（收敛判定轮）
// 竖屏 390x844 全程 + 横屏 812x375 抽查转场；零修改游戏代码
const { chromium } = require('playwright');
const BASE = process.argv[2] || 'http://localhost:4176/luohammer-pixel-game/';
const SHOT = (n) => `shots/r83-${n}.png`;

const report = { consoleErrors: [], pageErrors: [], consoleWarns: [], timings: {}, notes: [] };

function attachLogs(page, tag) {
  page.on('pageerror', (e) => report.pageErrors.push(`[${tag}] ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') report.consoleErrors.push(`[${tag}] ${m.text().slice(0, 300)}`);
    if (m.type() === 'warning') report.consoleWarns.push(`[${tag}] ${m.text().slice(0, 200)}`);
  });
}

async function rect(page, sel) {
  return page.evaluate((s) => {
    const el = document.querySelector(s);
    if (!el) return null;
    const b = el.getBoundingClientRect();
    const cs = window.getComputedStyle(el);
    return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height),
      fontSize: cs.fontSize, visible: b.width > 0 && b.height > 0 };
  }, sel);
}

async function perf(page) {
  return page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0] || {};
    const paints = performance.getEntriesByType('paint');
    const fcp = (paints.find(p => p.name === 'first-contentful-paint') || {}).startTime;
    return {
      domContentLoaded: Math.round(nav.domContentLoadedEventEnd || 0),
      loadEventEnd: Math.round(nav.loadEventEnd || 0),
      fcp: fcp ? Math.round(fcp) : null,
      transferSize: nav.transferSize || 0,
    };
  });
}

async function dismissRotateHint(page) {
  const b = page.locator('#rotate-hint-dismiss');
  if (await b.isVisible().catch(() => false)) {
    await b.click().catch(() => {});
    return true;
  }
  return false;
}

// ============ 竖屏全程 ============
async function portraitJourney(browser) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  attachLogs(page, 'P');

  // --- 1. 首屏加载 ---
  const t0 = Date.now();
  await page.goto(BASE, { waitUntil: 'load' });
  report.timings.gotoLoadMs = Date.now() - t0;
  await page.waitForTimeout(1500);
  report.timings.perf = await perf(page);
  const hadRotateHint = await dismissRotateHint(page);
  report.notes.push(`竖屏开场旋转提示条出现: ${hadRotateHint}`);
  await page.screenshot({ path: SHOT('p-01-title') });
  report.notes.push(`title boot btns: ${JSON.stringify(await page.evaluate(() =>
    [...document.querySelectorAll('.ui-boot-btn')].map(el => {
      const b = el.getBoundingClientRect(); const cs = getComputedStyle(el);
      return { t: el.textContent.trim().slice(0, 8), w: Math.round(b.width), h: Math.round(b.height), fs: cs.fontSize };
    })))}`);

  // --- 2. 标题 → 开场星图 ---
  const startBtn = page.locator('.ui-boot-btn:has-text("开始游戏"), .ui-boot-btn:has-text("新游戏")').first();
  await startBtn.waitFor({ state: 'visible', timeout: 10000 });
  const tStart = Date.now();
  await startBtn.click();
  await page.waitForTimeout(400);
  report.timings.startToIntroMs = Date.now() - tStart;
  await page.screenshot({ path: SHOT('p-02-intro-early') });
  // 星图推进（模拟评委真实观看节奏：先看 ~4s 再开始跳过）
  await page.waitForTimeout(3600);
  await page.screenshot({ path: SHOT('p-03-intro-mid') });

  const tSkip = Date.now();
  let introPresses = 0;
  for (let i = 0; i < 24; i++) {
    if (await page.locator('.ui-talent-overlay.visible').count()) break;
    if (await page.locator('#ui-dialog.visible').count()) break;
    await page.keyboard.press('Space');
    introPresses++;
    await page.waitForTimeout(380);
  }
  report.timings.introSkipPresses = introPresses;
  report.timings.introSkipWallMs = Date.now() - tSkip;

  // --- 3. 天赋抽卡 ---
  const talentOverlay = page.locator('.ui-talent-overlay.visible');
  if (await talentOverlay.count()) {
    await page.waitForTimeout(500);
    await page.screenshot({ path: SHOT('p-04-talent') });
    report.notes.push(`talent cards: ${JSON.stringify(await page.evaluate(() =>
      [...document.querySelectorAll('.ui-talent-card')].map(el => {
        const b = el.getBoundingClientRect();
        return { w: Math.round(b.width), h: Math.round(b.height), y: Math.round(b.y) };
      })))}`);
    const cards = page.locator('.ui-talent-card');
    await cards.nth(0).click();
    await page.waitForTimeout(250);
    await cards.nth(1).click();
    await page.waitForTimeout(250);
    await page.screenshot({ path: SHOT('p-05-talent-selected') });
    const confirm = page.locator('.ui-talent-confirm, button:has-text("出发"), button:has-text("确认")').first();
    const tConf = Date.now();
    await confirm.click();
    await page.locator('#ui-dialog.visible, .ui-stats.visible').first().waitFor({ state: 'visible', timeout: 8000 }).catch(() => {});
    report.timings.talentConfirmToDialogMs = Date.now() - tConf;
  } else {
    report.notes.push('!! 天赋 overlay 未出现');
  }
  await page.waitForTimeout(600);
  await page.screenshot({ path: SHOT('p-06-dialog-first') });

  // --- 4. 第一幕对话推进 → 首个选择 ---
  const dialogData0 = await page.evaluate(() => ({
    statsVisible: !!document.querySelector('.ui-stats.visible'),
    dialogRect: (() => { const el = document.querySelector('#ui-dialog'); if (!el) return null; const b = el.getBoundingClientRect(); return { y: Math.round(b.y), h: Math.round(b.height) }; })(),
  }));
  report.notes.push(`dialog0: ${JSON.stringify(dialogData0)}`);

  const touchLayer = page.locator('#dialog-touch-layer');
  let choiceSeen = false;
  let clicks = 0;
  const clickLatencies = [];
  for (let i = 0; i < 40; i++) {
    if (await page.locator('#ui-choices .ui-choice-btn').count()) { choiceSeen = true; break; }
    const before = await page.evaluate(() => (document.querySelector('#ui-dialog-text') || document.querySelector('#ui-dialog'))?.textContent?.length || 0);
    const tc = Date.now();
    if (await touchLayer.count()) await touchLayer.click({ force: true }).catch(() => {});
    else await page.keyboard.press('Space');
    clicks++;
    await page.waitForTimeout(120);
    const after = await page.evaluate(() => (document.querySelector('#ui-dialog-text') || document.querySelector('#ui-dialog'))?.textContent?.length || 0);
    clickLatencies.push({ ms: Date.now() - tc, changed: after !== before });
    await page.waitForTimeout(450);
  }
  report.timings.dialogClicksToFirstChoice = clicks;
  report.notes.push(`click latencies(first8): ${JSON.stringify(clickLatencies.slice(0, 8))}`);

  if (choiceSeen) {
    await page.waitForTimeout(400);
    await page.screenshot({ path: SHOT('p-07-choice') });
    const choiceData = await page.evaluate(() => {
      const btns = [...document.querySelectorAll('#ui-choices .ui-choice-btn')];
      return btns.map(el => {
        const b = el.getBoundingClientRect(); const cs = getComputedStyle(el);
        return { t: el.textContent.trim().slice(0, 20), w: Math.round(b.width), h: Math.round(b.height), y: Math.round(b.y), fs: cs.fontSize, lh: cs.lineHeight };
      });
    });
    report.notes.push(`choices: ${JSON.stringify(choiceData)}`);
    // 点击第一个选项
    const tCh = Date.now();
    await page.locator('#ui-choices .ui-choice-btn').first().click();
    await page.waitForTimeout(600);
    report.timings.choiceClickToNextMs = Date.now() - tCh;
    await page.screenshot({ path: SHOT('p-08-after-choice') });
  } else {
    report.notes.push('!! 40 次推进未遇到选择节点');
    await page.screenshot({ path: SHOT('p-07-nochoice') });
  }

  // 继续推进若干节点观察节奏/转场（最多 25 次，遇到选择就选第一个）
  let act1Nodes = 0;
  for (let i = 0; i < 25; i++) {
    const choiceBtns = page.locator('#ui-choices .ui-choice-btn');
    if (await choiceBtns.count()) {
      await choiceBtns.first().click();
      act1Nodes++;
      await page.waitForTimeout(500);
      continue;
    }
    if (await touchLayer.count()) await touchLayer.click({ force: true }).catch(() => {});
    else await page.keyboard.press('Space');
    act1Nodes++;
    await page.waitForTimeout(420);
    if (i === 12) await page.screenshot({ path: SHOT('p-09-act1-mid') });
  }
  report.notes.push(`act1 advanced steps: ${act1Nodes}`);
  await page.screenshot({ path: SHOT('p-10-act1-late') });
  const stateNow = await page.evaluate(() => {
    const g = window.__game || window.game;
    try {
      const scene = g?.scene?.getScene?.('GameScene');
      return { node: scene?.state?.currentNode || null, attrs: scene?.state ? { p: scene.state.pride, w: scene.state.wealth, r: scene.state.reputation } : null };
    } catch (e) { return { err: e.message }; }
  });
  report.notes.push(`state after act1 walk: ${JSON.stringify(stateNow)}`);

  // --- 5. 注入结局存档 → 继续游戏 → 结局 → AI复盘 → 分享卡 ---
  await page.evaluate(() => {
    const state = {
      currentNode: 'ending_comeback',
      pride: 12, wealth: 28, reputation: 30, trust: 6, pressure: 35, failures: 2,
      flags: ['killer_600m_seen'], triggeredEvents: [], talents: [],
      history: [
        { node: 'act0_start', choice: '退学闯荡', attrs: { pride: 2 } },
        { node: 'act3_live', choice: '首播带货', attrs: { wealth: 5 } },
      ],
      _version: 2,
    };
    localStorage.setItem('luohammer_save', JSON.stringify(state));
    localStorage.setItem('luohammer_auto_meta', JSON.stringify({ timestamp: Date.now() }));
  });
  const tReload = Date.now();
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(1200);
  await dismissRotateHint(page);
  const contBtn = page.locator('.ui-boot-btn:has-text("继续游戏")').first();
  const hasContinue = await contBtn.count();
  report.notes.push(`继续游戏按钮存在: ${hasContinue}`);
  if (hasContinue) {
    await contBtn.click();
    // 等待结局屏
    await page.waitForTimeout(2500);
    report.timings.reloadToEndingMs = Date.now() - tReload;
    await page.screenshot({ path: SHOT('p-11-ending') });
    const endingData = await page.evaluate(() => {
      const q = (s) => { const el = document.querySelector(s); return el ? el.textContent.trim().slice(0, 60) : null; };
      const btns = [...document.querySelectorAll('.ui-ending-btn')].map(el => {
        const b = el.getBoundingClientRect();
        return { t: el.textContent.trim().slice(0, 12), w: Math.round(b.width), h: Math.round(b.height), y: Math.round(b.y) };
      });
      return {
        title: q('.ui-ending-title, #ui-ending-title, h1'),
        quote: q('.ui-ending-quote'),
        btnCount: btns.length, btns,
        scrollable: document.querySelector('#ui-ending')?.scrollHeight > window.innerHeight,
      };
    });
    report.notes.push(`ending: ${JSON.stringify(endingData)}`);

    // AI 复盘
    const aiBtn = page.locator('.ui-ending-btn-ai, button:has-text("AI 人生复盘")').first();
    if (await aiBtn.count()) {
      const tAi = Date.now();
      await aiBtn.click();
      await page.waitForTimeout(1800);
      report.timings.aiReviewOpenMs = Date.now() - tAi;
      await page.screenshot({ path: SHOT('p-12-ai-review') });
      const reviewInfo = await page.evaluate(() => {
        const ov = document.querySelector('.ui-ai-review-overlay, #ui-ai-review, [class*="ai-review"]');
        if (!ov) return { found: false };
        const b = ov.getBoundingClientRect();
        return { found: true, w: Math.round(b.width), h: Math.round(b.height), text: ov.textContent.trim().slice(0, 80) };
      });
      report.notes.push(`ai review: ${JSON.stringify(reviewInfo)}`);
      // 关闭复盘
      const closeBtn = page.locator('.ui-ai-review-close, [class*="ai-review"] button:has-text("关闭"), [class*="ai-review"] .close').first();
      if (await closeBtn.count()) await closeBtn.click().catch(() => {});
      else await page.keyboard.press('Escape');
      await page.waitForTimeout(400);
    } else {
      report.notes.push('!! AI 复盘按钮未找到');
    }

    // 更多 → 分享卡
    const moreBtn = page.locator('.ui-ending-btn:has-text("更多"), button:has-text("更多")').first();
    if (await moreBtn.count()) {
      await moreBtn.click();
      await page.waitForTimeout(400);
      await page.screenshot({ path: SHOT('p-13-ending-more') });
      const shareItem = page.locator('text=分享卡').first();
      if (await shareItem.count()) {
        const tShare = Date.now();
        await shareItem.click();
        await page.waitForTimeout(1200);
        report.timings.shareCardMs = Date.now() - tShare;
        await page.screenshot({ path: SHOT('p-14-share-card') });
        const shareInfo = await page.evaluate(() => {
          const mask = document.querySelector('#share-card-mask, [id*="share-card"]');
          const canvas = mask ? mask.querySelector('canvas') : document.querySelector('canvas.share-card');
          return { maskFound: !!mask, canvasFound: !!canvas, canvasSize: canvas ? { w: canvas.width, h: canvas.height } : null };
        });
        report.notes.push(`share card: ${JSON.stringify(shareInfo)}`);
        // 关闭分享卡
        const maskEl = page.locator('#share-card-mask').first();
        if (await maskEl.count()) await maskEl.click({ position: { x: 10, y: 10 } }).catch(() => {});
        await page.waitForTimeout(300);
      } else {
        report.notes.push('!! 分享卡入口未找到');
      }
    } else {
      report.notes.push('!! 结局更多按钮未找到');
    }
    await page.screenshot({ path: SHOT('p-15-ending-final') });
  }

  await ctx.close();
}

// ============ 横屏抽查 ============
async function landscapeSpot(browser) {
  const ctx = await browser.newContext({ viewport: { width: 812, height: 375 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  attachLogs(page, 'L');
  await page.goto(BASE, { waitUntil: 'load' });
  await page.waitForTimeout(1400);
  await page.screenshot({ path: SHOT('l-01-title') });
  const startBtn = page.locator('.ui-boot-btn:has-text("开始游戏"), .ui-boot-btn:has-text("新游戏"), .ui-boot-btn:has-text("继续游戏")').first();
  await startBtn.click();
  await page.waitForTimeout(2500);
  await page.screenshot({ path: SHOT('l-02-intro') });
  // 快进到天赋/对话
  for (let i = 0; i < 24; i++) {
    if (await page.locator('.ui-talent-overlay.visible').count()) break;
    if (await page.locator('#ui-dialog.visible').count()) break;
    await page.keyboard.press('Space');
    await page.waitForTimeout(350);
  }
  if (await page.locator('.ui-talent-overlay.visible').count()) {
    await page.screenshot({ path: SHOT('l-03-talent') });
    const cards = page.locator('.ui-talent-card');
    await cards.nth(0).click(); await cards.nth(1).click();
    await page.locator('.ui-talent-confirm, button:has-text("出发"), button:has-text("确认")').first().click();
    await page.waitForTimeout(900);
  }
  await page.screenshot({ path: SHOT('l-04-dialog') });
  // 推进到选择
  const touchLayer = page.locator('#dialog-touch-layer');
  for (let i = 0; i < 30; i++) {
    if (await page.locator('#ui-choices .ui-choice-btn').count()) break;
    if (await touchLayer.count()) await touchLayer.click({ force: true }).catch(() => {});
    else await page.keyboard.press('Space');
    await page.waitForTimeout(400);
  }
  await page.waitForTimeout(400);
  await page.screenshot({ path: SHOT('l-05-choice') });
  await ctx.close();
}

(async () => {
  const browser = await chromium.launch();
  await portraitJourney(browser);
  await landscapeSpot(browser);
  await browser.close();

  console.log('\n========== R83 RAW REPORT ==========');
  console.log('TIMINGS:', JSON.stringify(report.timings, null, 1));
  console.log('\nNOTES:');
  report.notes.forEach(n => console.log(' -', n));
  console.log('\nPAGE ERRORS:', report.pageErrors.length ? report.pageErrors : 'none');
  console.log('\nCONSOLE ERRORS:', report.consoleErrors.length ? report.consoleErrors : 'none');
  console.log('\nCONSOLE WARNS (first10):', report.consoleWarns.length ? report.consoleWarns.slice(0, 10) : 'none');
})().catch(e => { console.error('R83 FAIL:', e); process.exit(1); });
