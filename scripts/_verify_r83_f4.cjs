// R83 F4 实机验证：阶段结算语义（完成态）+ 成就映射修复
// 断言1：开局进 GameScene 不弹结算卡（youth 无前序阶段），first_steps 已解锁
// 断言2：loadNode('act1_first') → 弹卡标题"延边少年"（前序完成阶段），文本"少年时代结束了"，stage_2 解锁
// 断言3：loadNode('act8_thinred') → 弹卡标题"真还传"（前序），stage_6 "再上路口" 解锁
const { chromium } = require('playwright');
const BASE = process.argv[2] || 'http://localhost:4174/luohammer-pixel-game/';

async function gotoGameScene(page) {
  await page.goto(BASE, { waitUntil: 'load' });
  // 等 game 就绪（dev/preview 冷启动最多 40s）
  for (let i = 0; i < 80; i++) {
    const ok = await page.evaluate(() => !!(window.game && window.game.scene));
    if (ok) break;
    await page.waitForTimeout(500);
  }
  await page.waitForTimeout(800);
  await page.evaluate(() => {
    document.querySelector('#rotate-hint-dismiss')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('.ui-boot-btn')].find(b => /继续游戏|新游戏|开始游戏/.test(b.textContent));
    btn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  // 过 intro 到天赋屏
  for (let i = 0; i < 30; i++) {
    const ok = await page.evaluate(() => !!document.querySelector('.ui-talent-overlay.visible'));
    if (ok) break;
    await page.evaluate(() => {
      const t = document.querySelector('.ui-intro-overlay.visible') || document.querySelector('#dialog-touch-layer') || document.querySelector('#ui-dialog') || document.body;
      t.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await page.waitForTimeout(500);
  }
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
  await page.waitForTimeout(2000);
}

function settlementInfo() {
  const ov = document.querySelector('.ui-settlement-overlay');
  if (!ov) return null;
  return {
    visible: ov.classList.contains('visible'),
    stageName: ov.querySelector('.ui-settlement-stage-name')?.textContent.trim() || '',
    period: ov.querySelector('.ui-settlement-period')?.textContent.trim() || '',
    text: ov.querySelector('.ui-settlement-text')?.textContent.trim() || ''
  };
}

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  let allPass = true;

  await gotoGameScene(page);

  // === 断言1：开局无结算卡 + first_steps 已解锁 ===
  const r1 = await page.evaluate(() => {
    const scene = window.game.scene.getScene('GameScene');
    const ov = document.querySelector('.ui-settlement-overlay');
    return {
      hasCard: !!ov,
      firstSteps: scene.state.achievements.includes('迈出第一步'),
      node: scene.state.currentNode
    };
  });
  const p1 = !r1.hasCard && r1.firstSteps;
  console.log(`[断言1] 开局: 无结算卡=${!r1.hasCard} first_steps解锁=${r1.firstSteps} 节点=${r1.node} → ${p1 ? 'PASS' : 'FAIL'}`);
  if (!p1) allPass = false;

  // === 断言2：进入 teacher 首节点 → 弹 youth(前序) 结算卡 ===
  await page.evaluate(() => {
    const scene = window.game.scene.getScene('GameScene');
    scene.loadNode('act1_first');
  });
  await page.waitForTimeout(700);
  const r2 = await page.evaluate(settlementInfo);
  const ach2 = await page.evaluate(() => {
    const scene = window.game.scene.getScene('GameScene');
    return { stage2: scene.state.achievements.includes('初露锋芒') };
  });
  const p2 = !!(r2 && r2.visible && r2.stageName.includes('延边少年') && r2.text.includes('少年时代结束了') && ach2.stage2);
  console.log(`[断言2] 进act1_first: 卡="${r2 && r2.stageName}" 文本="${r2 && r2.text.slice(0, 20)}…" stage_2=${ach2.stage2} → ${p2 ? 'PASS' : 'FAIL'}`);
  if (!p2) allPass = false;
  await page.screenshot({ path: 'shots/r83-f4-settlement-youth.png' });

  // 点继续关闭结算卡
  await page.evaluate(() => {
    document.querySelector('#ui-settlement-continue')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  await page.waitForTimeout(600);

  // === 断言3：进入 reborn 首节点 → 弹 repay(前序) 结算卡 + stage_6 新名 ===
  await page.evaluate(() => {
    const scene = window.game.scene.getScene('GameScene');
    scene.loadNode('act8_thinred');
  });
  await page.waitForTimeout(700);
  const r3 = await page.evaluate(settlementInfo);
  const ach3 = await page.evaluate(() => {
    const scene = window.game.scene.getScene('GameScene');
    return { stage6: scene.state.achievements.includes('再上路口') };
  });
  const p3 = !!(r3 && r3.visible && r3.stageName.includes('真还传') && r3.text.includes('还了4亿') && ach3.stage6);
  console.log(`[断言3] 进act8_thinred: 卡="${r3 && r3.stageName}" 文本="${r3 && r3.text.slice(0, 20)}…" stage_6再上路口=${ach3.stage6} → ${p3 ? 'PASS' : 'FAIL'}`);
  if (!p3) allPass = false;
  await page.screenshot({ path: 'shots/r83-f4-settlement-repay.png' });

  console.log(allPass ? '== R83 F4 VERIFY ALL PASS ==' : '== R83 F4 VERIFY HAS FAIL ==');
  await browser.close();
  process.exit(allPass ? 0 : 1);
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
