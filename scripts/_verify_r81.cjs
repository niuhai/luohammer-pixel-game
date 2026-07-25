// R81 验证：成就弹窗 FIFO 队列——同帧连发 3 个成就应依序完整播放，不再互相打断
// 用法: node scripts/_verify_r81.cjs [baseUrl]
// 轮询式断言：周期实测 ~4.2s/个（滑入+3000ms展示+300ms滑出+250ms间隙），不用固定时刻表
const { chromium } = require('playwright');
const path = require('path');
const BASE = process.argv[2] || 'http://localhost:4173/luohammer-pixel-game/';

const results = [];
function assert(id, name, pass, actual) {
  results.push({ id, pass: !!pass });
  console.log(`${pass ? 'PASS' : 'FAIL'} [${id}] ${name} | 实测=${actual}`);
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await ctx.addInitScript(() => {
    const s = {
      pride: 5, wealth: 3, reputation: 5, failures: 2, pressure: 0, trust: 4,
      pressureMax: 10, failurePenalty: 1, successBonus: 1,
      talentSpecials: [], currentStageId: 'act1', currentNode: 'act1_first',
      flags: [], triggeredEvents: [], history: [], achievements: [],
      gameStartTime: Date.now() - 120000
    };
    const j = JSON.stringify(s);
    localStorage.setItem('luohammer_save', j);
    localStorage.setItem('luohammer_save_backup', j);
    localStorage.setItem('luohammer_intro_seen', '1');
    localStorage.setItem('luohammer_kbd_hint_shown', '1');
    localStorage.setItem('luohammer_narration', 'false');
  });
  const page = await ctx.newPage();
  page.on('pageerror', e => console.log('PAGEERROR:', e.message));
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  const btn = page.locator('button.ui-boot-btn-primary', { hasText: '继续游戏' });
  await btn.waitFor({ state: 'visible', timeout: 20000 });
  await btn.click();
  await page.waitForFunction(() => {
    const sc = window.game && window.game.scene.getScene('GameScene');
    return !!(sc && sc.achievementPopup);
  }, { timeout: 15000 });

  const sample = () => page.evaluate(() => {
    const p = window.game.scene.getScene('GameScene').achievementPopup;
    const el = document.getElementById('achievement-popup');
    return {
      name: el ? el.querySelector('.achievement-popup-name').textContent : null,
      visible: !!(el && el.classList.contains('visible')),
      queueLen: p._queue.length,
      busy: p._busy
    };
  });
  // 轮询直到谓词满足或超时
  async function pollUntil(pred, timeout, label) {
    const t0 = Date.now();
    let last = null;
    while (Date.now() - t0 < timeout) {
      last = await sample();
      if (pred(last)) return { ok: true, last };
      await page.waitForTimeout(250);
    }
    return { ok: false, last, label };
  }

  // 前置：入场可能触发真实阶段成就（如"初露锋芒"），先等其自然播完（队列空+不忙）
  const drain = await pollUntil(s => !s.busy && s.queueLen === 0 && !s.visible, 30000);
  assert('Q0-pre-drained', '入场阶段成就自然播完（队列机制对真实成就同样生效）', drain.ok, JSON.stringify(drain.last));

  // 同帧连发 3 个成就（模拟批量阈值解锁场景）
  await page.evaluate(() => {
    const p = window.game.scene.getScene('GameScene').achievementPopup;
    p.show('测试成就甲', '★', false);
    p.show('测试成就乙', '◆', false);
    p.show('测试成就丙', '♛', true); // 隐藏成就（带闪光演出）也要排队
  });

  // 甲立即展示，乙丙入队
  const r1 = await pollUntil(s => s.visible && s.name === '测试成就甲', 4000);
  assert('Q1-first-shows', '甲立即展示', r1.ok, JSON.stringify(r1.last));
  const q1 = await sample();
  assert('Q1-queued', '乙丙入队（queueLen=2）', q1.queueLen === 2, `queueLen=${q1.queueLen}`);

  // 乙在甲完整播完后接续（关键：甲名字曾被完整看到 = 未被打断）
  const r2 = await pollUntil(s => s.visible && s.name === '测试成就乙', 10000);
  assert('Q2-second-plays', '甲播完后乙接续展示（未被打断）', r2.ok, JSON.stringify(r2.last));

  // 丙（隐藏成就）在乙播完后接续
  const r3 = await pollUntil(s => s.visible && s.name === '测试成就丙', 10000);
  assert('Q3-third-plays', '乙播完后丙接续展示（隐藏成就不被吃掉）', r3.ok, JSON.stringify(r3.last));
  await page.screenshot({ path: path.resolve(__dirname, '..', '..', 'test-screenshots', 'r81-queue-hidden.png') });

  // 全部播完：弹窗隐藏 + 队列空 + 忙态解除
  const r4 = await pollUntil(s => !s.busy && s.queueLen === 0 && !s.visible, 10000);
  assert('Q4-all-drained', '全部播完：弹窗隐藏 + 队列清空 + 忙态解除', r4.ok, JSON.stringify(r4.last));

  // 队列清空后新成就应立即展示（忙态正确复位）
  await page.evaluate(() => {
    window.game.scene.getScene('GameScene').achievementPopup.show('测试成就丁', '◇', false);
  });
  const r5 = await pollUntil(s => s.visible && s.name === '测试成就丁', 3000);
  assert('Q5-post-drain-immediate', '队列清空后新成就立即展示', r5.ok, JSON.stringify(r5.last));

  await browser.close();
  const p = results.filter(r => r.pass).length;
  console.log(`\n== R81 VERIFY 小计: PASS ${p} / FAIL ${results.length - p} ==`);
  process.exit(results.every(r => r.pass) ? 0 : 1);
})().catch(e => { console.error('SCRIPT_ERROR', e); process.exit(1); });
