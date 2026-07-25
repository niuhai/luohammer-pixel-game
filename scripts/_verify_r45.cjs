// R45 验证：选项溢出吸底提示 + 锁定按钮防裁剪 + 分享卡结局计数
const { chromium } = require('playwright');
const OUT = 'test-screenshots/r45';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('pageerror', e => console.log('PAGEERROR:', e.message));

  // === 直达 act6_night（8 选项，pride 6 → “放弃”选项被锁定）===
  await page.goto('http://localhost:5175/luohammer-pixel-game/');
  await page.evaluate(() => {
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
  await page.reload();
  const btn = page.locator('#ui-boot-buttons button', { hasText: '继续游戏' });
  await btn.waitFor({ state: 'visible', timeout: 15000 });
  await btn.click();
  // 长文本分页：反复按空格推进直到选项出现（最多 30 次）
  for (let i = 0; i < 30; i++) {
    const n = await page.evaluate(() => document.querySelectorAll('.ui-choice-btn').length);
    if (n > 0) break;
    await page.keyboard.press('Space');
    await page.waitForTimeout(700);
  }
  await page.locator('.ui-choice-btn').first().waitFor({ state: 'visible', timeout: 10000 });
  await page.waitForTimeout(1500);

  // --- F1: 滚动提示存在且 has-more 生效 ---
  const f1a = await page.evaluate(() => {
    const el = document.getElementById('ui-choices');
    const hint = el.querySelector('.ui-choices-more');
    return {
      hintExists: !!hint,
      hasMore: el.classList.contains('has-more'),
      scrollH: el.scrollHeight, clientH: el.clientHeight,
      hintOpacity: hint ? getComputedStyle(hint).opacity : null
    };
  });
  console.log('F1 未滚到底:', JSON.stringify(f1a));
  await page.screenshot({ path: `${OUT}/f1-scroll-hint.png` });

  // 滚到底 → has-more 应消失
  const f1b = await page.evaluate(() => {
    const el = document.getElementById('ui-choices');
    el.scrollTop = el.scrollHeight;
    return new Promise(r => setTimeout(() => r({
      hasMore: el.classList.contains('has-more'),
      hintOpacity: getComputedStyle(el.querySelector('.ui-choices-more')).opacity
    }), 400));
  });
  console.log('F1 滚到底后:', JSON.stringify(f1b));

  // --- F2: 锁定按钮内容不被裁剪 ---
  const f2 = await page.evaluate(() => {
    const locked = document.querySelector('.ui-choice-btn.locked');
    if (!locked) return { found: false };
    const hint = locked.querySelector('.ui-choice-lock-hint');
    const lr = locked.getBoundingClientRect();
    const hr = hint ? hint.getBoundingClientRect() : null;
    return {
      found: true,
      btnScrollH: locked.scrollHeight, btnClientH: locked.clientHeight,
      notClipped: locked.scrollHeight <= locked.clientHeight + 2,
      hintText: hint ? hint.textContent : null,
      hintInsideBtn: hr ? (hr.bottom <= lr.bottom + 1 && hr.height > 0) : false
    };
  });
  console.log('F2 锁定按钮:', JSON.stringify(f2));
  await page.screenshot({ path: `${OUT}/f2-locked-btn.png` });

  // --- F3: 分享卡结局计数（直达结局页）---
  await page.evaluate(() => {
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
  const btn2 = page.locator('#ui-boot-buttons button', { hasText: '继续游戏' });
  await btn2.waitFor({ state: 'visible', timeout: 15000 });
  await btn2.click();
  await page.locator('#ui-ending-overlay.visible').waitFor({ timeout: 30000 });
  await page.waitForTimeout(1500);
  // 拦截 renderShareCard 入参验证 totalEndings / endingIndex
  const f3 = await page.evaluate(() => {
    return new Promise(resolve => {
      const scene = window.game ? window.game.scene.getScene('EndingScene') : null;
      if (!scene) return resolve({ err: 'no scene' });
      let captured = null;
      const PR = scene.pixelRenderer ? scene.pixelRenderer.constructor : null;
      if (!PR || !PR.renderShareCard) return resolve({ err: 'no PR' });
      const orig = PR.renderShareCard;
      PR.renderShareCard = function (state, ending, meta) { captured = meta; return { toDataURL: () => 'data:image/png;base64,' }; };
      scene.generateShareCard();
      PR.renderShareCard = orig;
      setTimeout(() => resolve({ captured }), 300);
    });
  });
  console.log('F3 分享卡 meta:', JSON.stringify(f3));
  // 关闭分享卡遮罩便于截图
  await page.evaluate(() => { const m = document.getElementById('share-card-mask'); if (m) m.remove(); });

  await browser.close();
  console.log('R45 验证完成');
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
