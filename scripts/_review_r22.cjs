// R19-R21 UI 走查：标题页 / 玩法指引 / 天赋 / 剧情 / 结局
const { chromium } = require('playwright');
const fs = require('fs');
const OUT = 'test-screenshots/r22-review';
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

  await page.goto('http://localhost:5173/luohammer-pixel-game/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.locator('#ui-boot-overlay').waitFor({ state: 'visible', timeout: 20000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/r01-title.png` });

  // 玩法指引展开
  const guideToggle = page.locator('#ui-boot-guide-toggle');
  if (await guideToggle.isVisible().catch(() => false)) {
    await guideToggle.click();
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${OUT}/r02-guide-expanded.png` });
    await guideToggle.click();
    await page.waitForTimeout(400);
  }

  // 开始游戏 → 跳过 intro → 天赋
  await page.locator('#ui-boot-buttons button', { hasText: '开始游戏' }).click();
  const intro = page.locator('#ui-intro-overlay');
  await intro.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(1500);
  if (await intro.isVisible().catch(() => false)) await intro.click({ force: true });
  await page.locator('#ui-talent-overlay').waitFor({ state: 'visible', timeout: 25000 });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${OUT}/r03-talent.png` });

  // 长按预览（新交互）
  const card = page.locator('#ui-talent-cards .ui-talent-card').first();
  await card.hover();
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${OUT}/r04-talent-tooltip.png` });

  await card.click();
  await page.locator('#ui-talent-cards .ui-talent-card').nth(1).click();
  await page.locator('#ui-talent-confirm').click();
  await page.waitForTimeout(2500);
  const settle = page.locator('#ui-settlement-continue');
  if (await settle.isVisible().catch(() => false)) { await page.screenshot({ path: `${OUT}/r05-settlement.png` }); await settle.click(); await page.waitForTimeout(800); }

  // 剧情首节点 + 数字快捷键提示
  await page.waitForTimeout(4000);
  await page.screenshot({ path: `${OUT}/r06-first-node.png` });
  // 跳过多段直到选项
  for (let i = 0; i < 14; i++) {
    if (await page.locator('#ui-choices .ui-choice-btn').first().isVisible().catch(() => false)) break;
    await page.locator('#ui-dialog').click({ force: true }).catch(() => {});
    await page.waitForTimeout(450);
  }
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/r07-choices.png` });

  // 数字快捷键选 1
  await page.keyboard.press('1');
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${OUT}/r08-after-key-choice.png` });

  // 移动端竖屏天赋页
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('http://localhost:5173/luohammer-pixel-game/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.locator('#ui-boot-overlay').waitFor({ state: 'visible', timeout: 20000 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/r09-mobile-title.png` });
  await page.locator('#ui-boot-buttons button', { hasText: '开始游戏' }).click();
  const mIntro = page.locator('#ui-intro-overlay');
  await page.waitForTimeout(1500);
  if (await mIntro.isVisible().catch(() => false)) await mIntro.click({ force: true });
  await page.locator('#ui-talent-overlay').waitFor({ state: 'visible', timeout: 25000 }).catch(() => {});
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/r10-mobile-talent.png` });

  fs.writeFileSync(`${OUT}/console-errors.txt`, errors.join('\n') || '(无)');
  console.log('DONE, errors:', errors.length);
  await browser.close();
})();
