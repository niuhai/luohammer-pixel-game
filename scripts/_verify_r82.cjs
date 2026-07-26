// R82 综合实机验证：F1 天赋卡滚动/命中（竖+横）、F2 隐藏事件金色演出、F4 安装按钮不压指南
const { chromium } = require('playwright');
const BASE = process.argv[2] || 'http://localhost:4174/luohammer-pixel-game/';

async function gotoTalent(page) {
  await page.evaluate(() => {
    document.querySelector('#rotate-hint-dismiss')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('.ui-boot-btn')].find(b => /继续游戏|新游戏|开始游戏/.test(b.textContent));
    btn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  for (let i = 0; i < 30; i++) {
    const ok = await page.evaluate(() => !!document.querySelector('.ui-talent-overlay.visible'));
    if (ok) return true;
    await page.evaluate(() => {
      const t = document.querySelector('.ui-intro-overlay.visible') || document.querySelector('#dialog-touch-layer') || document.querySelector('#ui-dialog') || document.body;
      t.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await page.waitForTimeout(500);
  }
  return false;
}

async function checkTalent(page, tag) {
  await page.waitForTimeout(1800);
  const r = await page.evaluate(async () => {
    const cont = document.querySelector('.ui-talent-cards');
    const confirm = document.querySelector('#ui-talent-confirm');
    const cards = [...document.querySelectorAll('.ui-talent-card')];
    const cb = confirm.getBoundingClientRect();
    // 滚到底验证可滚动
    cont.scrollTop = cont.scrollHeight;
    const scrollable = cont.scrollTop > 0;
    const scrollH = cont.scrollHeight, clientH = cont.clientHeight;
    // 逐卡滚入可视区后命中测试（可滚动容器下方卡片在 scrollTop=0 时被裁剪是预期行为）
    const results = [];
    for (let i = 0; i < cards.length; i++) {
      const c = cards[i];
      c.scrollIntoView({ block: 'center' });
      await new Promise(res => setTimeout(res, 120));
      const b = c.getBoundingClientRect();
      const el = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2);
      const contB = cont.getBoundingClientRect();
      const inView = b.top >= contB.top - 1 && b.bottom <= contB.bottom + 1;
      const overlapConfirm = inView && b.bottom > cb.top && b.top < cb.bottom;
      results.push({ i, y: Math.round(b.y), hitOk: el === c || c.contains(el), inView, overlapConfirm });
    }
    cont.scrollTop = 0;
    return { scrollable, scrollH, clientH, cards: results };
  });
  const bad = r.cards.filter(c => !c.hitOk || c.overlapConfirm);
  console.log(`[${tag}] 可滚动=${r.scrollable}(${r.scrollH}/${r.clientH}) 卡数=${r.cards.length} 异常=${bad.length}`);
  if (bad.length) console.log('  异常卡:', JSON.stringify(bad));
  return bad.length === 0;
}

async function checkHiddenEvent(page, tag) {
  // 天赋确认后进 GameScene，直接调 _showEvent 注入隐藏事件（确定性验证金色演出）
  const ok = await page.evaluate(() => {
    const scene = window.game && window.game.scene.getScene('GameScene');
    if (!scene || !scene.randomEventSystem) return 'no-scene';
    scene.randomEventSystem._showEvent({
      id: 'verify_hidden', rarity: 'legendary', hidden: true,
      title: '屋顶流星', text: '验证用隐藏事件文本。',
      choices: [{ label: '选项A', effects: {} }, { label: '选项B', effects: {} }]
    });
    return 'ok';
  });
  if (ok !== 'ok') { console.log(`[${tag}] 隐藏事件注入失败: ${ok}`); return false; }
  await page.waitForTimeout(900); // 等入场动画
  const r = await page.evaluate(() => {
    const ov = document.querySelector('#ui-random-event-overlay');
    const card = ov.querySelector('.ui-random-event-card');
    const label = ov.querySelector('.ui-random-event-label');
    const cs = getComputedStyle(card);
    return {
      hasClass: ov.classList.contains('hidden-event'),
      label: label.textContent,
      borderColor: cs.borderColor,
      titleColor: getComputedStyle(ov.querySelector('.ui-random-event-title')).color,
      visible: ov.classList.contains('visible') && ov.classList.contains('active')
    };
  });
  const goldBorder = /255,\s*170,\s*64/.test(r.borderColor);
  const pass = r.hasClass && r.label.includes('隐藏') && goldBorder && r.visible;
  console.log(`[${tag}] 隐藏事件: class=${r.hasClass} label="${r.label}" border=${r.borderColor} title=${r.titleColor} → ${pass ? 'PASS' : 'FAIL'}`);
  return pass;
}

(async () => {
  const browser = await chromium.launch();
  let allPass = true;

  // === 竖屏 390x844：F4 安装按钮 + F1 天赋卡 ===
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    await page.goto(BASE, { waitUntil: 'load' });
    await page.waitForTimeout(1200);
    // F4：安装按钮 vs 指南面板（安装按钮仅 beforeinstallprompt 后显示，此处只验证 CSS 定位不冲突——强制显示测位）
    const f4 = await page.evaluate(() => {
      const btn = document.getElementById('ui-boot-install-btn');
      const guide = document.querySelector('.ui-boot-guide');
      if (!btn || !guide) return { skip: true };
      const prev = btn.style.display; btn.style.display = 'block';
      const b = btn.getBoundingClientRect(), g = guide.getBoundingClientRect();
      btn.style.display = prev;
      const overlap = !(b.right < g.left || b.left > g.right || b.bottom < g.top || b.top > g.bottom);
      return { overlap, btn: { x: Math.round(b.x), y: Math.round(b.y) }, guide: { x: Math.round(g.x), y: Math.round(g.y) } };
    });
    console.log('[竖屏] F4 安装按钮重叠:', f4.skip ? 'SKIP(元素缺失)' : (f4.overlap ? `FAIL ${JSON.stringify(f4)}` : 'PASS'));
    if (f4.overlap) allPass = false;

    const ok = await gotoTalent(page);
    console.log('[竖屏] 到达天赋屏:', ok);
    if (ok) {
      if (!await checkTalent(page, '竖屏F1')) allPass = false;
      await page.screenshot({ path: 'shots/r82-verify-talent-portrait.png' });
    } else allPass = false;
    await ctx.close();
  }

  // === 横屏 812x375：F1 天赋卡 + F2 隐藏事件 ===
  {
    const ctx = await browser.newContext({ viewport: { width: 812, height: 375 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    await page.goto(BASE, { waitUntil: 'load' });
    await page.waitForTimeout(1200);
    const ok = await gotoTalent(page);
    console.log('[横屏] 到达天赋屏:', ok);
    if (ok) {
      if (!await checkTalent(page, '横屏F1')) allPass = false;
      await page.screenshot({ path: 'shots/r82-verify-talent-landscape.png' });
      // 选两个天赋并确认 → 进 GameScene
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
      if (!await checkHiddenEvent(page, '横屏F2')) allPass = false;
      await page.screenshot({ path: 'shots/r82-verify-hidden-event.png' });
    } else allPass = false;
    await ctx.close();
  }

  console.log(allPass ? '== R82 VERIFY ALL PASS ==' : '== R82 VERIFY HAS FAIL ==');
  await browser.close();
  process.exit(allPass ? 0 : 1);
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
