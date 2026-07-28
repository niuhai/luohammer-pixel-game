// R91：FTUE 首 90 秒情绪曲线审计——本地生产构建（localhost:4173）
// 打点：每个节拍的时间戳 + 屏上反馈，回答"评委第一眼到第一次选择"的节奏问题
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  // 确保全新用户（无存档无天赋）
  await page.goto('http://localhost:4173/luohammer-pixel-game/', { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'load' });

  const t0 = Date.now();
  const beats = [];
  const beat = (name) => beats.push({ name, t: ((Date.now() - t0) / 1000).toFixed(1) + 's' });

  const vis = (sel) => page.evaluate((s) => {
    const el = document.querySelector(s);
    return !!(el && getComputedStyle(el).display !== 'none' && el.offsetHeight > 0);
  }, sel);

  try {
    // B1: 加载层
    await page.waitForSelector('#app-loading', { state: 'attached', timeout: 8000 }).catch(() => {});
    beat('load');
    // B2: 标题屏可见
    await page.locator('#ui-boot-overlay').waitFor({ state: 'visible', timeout: 15000 });
    beat('boot-visible');
    // B3: 标题动画/金句是否已渲染
    const titleInfo = await page.evaluate(() => {
      const q = document.querySelector('.ui-boot-quote, #ui-boot-quote, .boot-quote');
      return { quote: q ? q.textContent.slice(0, 20) : null };
    });
    // B4: 点开始游戏
    await page.locator('#ui-boot-buttons button', { hasText: '开始游戏' }).click();
    beat('click-start');
    // B5: IntroScene 星图（canvas 活跃）——等 1.5s 看 intro 文本出现
    await page.waitForTimeout(1500);
    const introState = await page.evaluate(() => ({
      introText: !!document.querySelector('.intro-line, #ui-intro-overlay'),
      gameLoading: (() => { const el = document.getElementById('ui-game-loading'); return !!(el && el.offsetHeight > 0 && getComputedStyle(el).opacity !== '0'); })(),
    }));
    beat('intro-1.5s');
    // B6: 空格推进 intro 直到天赋 overlay（最多 30 轮）
    let talentAt = null;
    for (let i = 0; i < 30; i++) {
      if (await vis('.ui-talent-overlay')) { talentAt = i; break; }
      await page.keyboard.press('Space');
      await page.waitForTimeout(600);
    }
    beat('talent-overlay');
    // B7: 天赋卡是否可操作（选中 2 张→确认）
    const talentInfo = await page.evaluate(() => {
      const cards = document.querySelectorAll('.ui-talent-card');
      return { cardCount: cards.length };
    });
    // 选前两张
    await page.evaluate(() => {
      const cards = document.querySelectorAll('.ui-talent-card');
      if (cards[0]) cards[0].dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await page.waitForTimeout(300);
    await page.evaluate(() => {
      const cards = document.querySelectorAll('.ui-talent-card');
      if (cards[1]) cards[1].dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await page.waitForTimeout(400);
    beat('talent-selected');
    // 确认按钮
    const confirmed = await page.evaluate(() => {
      const btn = document.querySelector('.ui-talent-confirm, #ui-talent-confirm');
      if (btn && !btn.disabled) { btn.dispatchEvent(new MouseEvent('click', { bubbles: true })); return true; }
      return false;
    });
    beat('talent-confirm:' + confirmed);
    // B8: 第一个对话节点出现
    await page.waitForTimeout(2500);
    const dialogState = await page.evaluate(() => {
      const d = document.getElementById('ui-dialogue');
      const text = document.querySelector('.ui-dialog-text, #ui-dialog-text');
      return { visible: !!(d && d.offsetHeight > 0), textHead: text ? text.textContent.slice(0, 30) : null };
    });
    beat('first-dialog');
    // B9: 推进到第一个选项出现（最多 20 轮）
    let choiceAt = null;
    for (let i = 0; i < 20; i++) {
      const n = await page.evaluate(() => document.querySelectorAll('.ui-choice-btn').length);
      if (n > 0) { choiceAt = { round: i, count: n }; break; }
      await page.keyboard.press('Space');
      await page.waitForTimeout(700);
    }
    beat('first-choice');

    console.log(JSON.stringify({ beats, titleInfo, introState, talentInfo, dialogState, choiceAt }, null, 2));
  } catch (e) {
    console.log(JSON.stringify({ err: String(e).slice(0, 300), beats }, null, 2));
  }
  await browser.close();
})();
