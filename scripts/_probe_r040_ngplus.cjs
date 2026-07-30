// R040 SCAN：NG+（二周目）完整链路走查——评委"结局后 3 分钟"旅程
// 视角：结局页 → 再来一次 → 标题 → 开始游戏 → 序章自动跳过 → 天赋（时间旅者 replay_bonus）→ 首章对话
// 模拟已通关一周目的玩家：luohammer_meta_progress.playCount=1 + luohammer_play_count=1（双 key 约束）
// 断言：C1 再来一次回标题；C2 序章自动跳过（intro overlay 不可见，直接进入天赋/对话）；
//       C3 NG+ 仍提供 5 选 2 天赋；C4 时间旅者卡的 replay_bonus 差异化信息是否对玩家可见；
//       C5 选择时间旅者后 NG+ +1 全属性是否实际生效；C6 首章对话正常；C7 零 pageerror
// 用法：node scripts/_probe_r040_ngplus.cjs（自带 4191 preview，需先 npm run build）
const { chromium } = require('playwright');
const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const BASE = 'http://localhost:4191/luohammer-pixel-game/';
const OUT = path.resolve('test-screenshots/r040');

const waitPort = (url, timeout = 30000) => new Promise((resolve, reject) => {
  const t0 = Date.now();
  const tick = async () => {
    try { const r = await fetch(url); if (r.ok) return resolve(); } catch {}
    if (Date.now() - t0 > timeout) return reject(new Error('preview port timeout'));
    setTimeout(tick, 500);
  };
  tick();
});

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const preview = spawn('npx', ['vite', 'preview', '--port', '4191', '--strictPort'], {
    stdio: 'ignore', shell: true, cwd: path.resolve(__dirname, '..')
  });
  const errors = [];
  const checks = [];
  const check = (name, pass, detail) => {
    checks.push({ name, pass, detail });
    console.log(`${pass ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`);
  };
  try {
    await waitPort(BASE);
    const browser = await chromium.launch();
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push('PAGEERROR: ' + String(e).slice(0, 200)));

    // ============ 阶段0：注入"已通关一周目"身份 + 结局存档 ============
    await page.goto(BASE, { waitUntil: 'load', timeout: 30000 });
    await page.evaluate(() => {
      localStorage.clear();
      localStorage.setItem('luohammer_meta_progress', JSON.stringify({ playCount: 1, exp: 120, unlockedSkills: [] }));
      localStorage.setItem('luohammer_play_count', '1');
      const state = {
        pride: 6, wealth: 5, reputation: 5, failures: 0, pressure: 2, trust: 5,
        pressureMax: 10, failurePenalty: 1, successBonus: 1,
        talentSpecials: [], currentStageId: 'youth', currentNode: 'ending_scholar',
        flags: [], triggeredEvents: [],
        history: [
          { nodeId: 'act1_first', choiceLabel: '坚持背诵《理想》课文', historyChoice: '坚持理想' },
          { nodeId: 'act6_debt', choiceLabel: '承认 6 亿债务', historyChoice: '直面现实', effects: { failures: 1 }, flags: ['faced_debt'] }
        ],
        achievements: ['first_choice'], gameStartTime: Date.now() - 600000
      };
      localStorage.setItem('luohammer_save', JSON.stringify(state));
      localStorage.setItem('luohammer_save_backup', JSON.stringify(state));
    });
    await page.reload({ waitUntil: 'load' });

    // ============ 阶段1：结局页 → 再来一次 ============
    const contBtn = page.locator('#ui-boot-buttons button', { hasText: '继续游戏' });
    await contBtn.waitFor({ state: 'visible', timeout: 15000 });
    await contBtn.click();
    await page.locator('#ui-ending-overlay.visible').waitFor({ timeout: 30000 });
    await page.waitForTimeout(2600); // stagger 完成
    await page.screenshot({ path: path.join(OUT, '01-ending.png') });

    const retry = await page.evaluate(() => {
      const btn = [...document.querySelectorAll('#ui-ending-buttons button')].find((b) => b.textContent.includes('再来一次'));
      if (!btn) return { found: false };
      const r = btn.getBoundingClientRect();
      const out = { found: true, w: Math.round(r.width), h: Math.round(r.height) };
      btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      return out;
    });
    check('C1a 再来一次按钮存在', retry.found === true, JSON.stringify(retry));
    check('C1b 再来一次按钮 ≥44px', retry.found && retry.h >= 44, `h=${retry.h}`);

    // ============ 阶段2：回标题 → 开始游戏 → 序章应自动跳过 ============
    await page.locator('#ui-boot-overlay').waitFor({ state: 'visible', timeout: 15000 });
    await page.locator('#ui-boot-buttons button', { hasText: '开始游戏' }).click({ timeout: 8000 });

    // 观察 3s：intro overlay 是否出现（NG+ 应直接跳过，不出现）
    let introSeen = false;
    for (let i = 0; i < 10; i++) {
      const vis = await page.evaluate(() => {
        const el = document.querySelector('.ui-intro-overlay');
        return !!(el && el.classList.contains('visible') && el.offsetHeight > 0);
      });
      if (vis) { introSeen = true; break; }
      await page.waitForTimeout(300);
    }
    check('C2 二周目序章自动跳过', introSeen === false, introSeen ? 'intro 意外出现（playCount 未生效）' : '3s 内无 intro overlay');
    await page.screenshot({ path: path.join(OUT, '02-ngplus-entry.png') });

    // ============ 阶段3：天赋 overlay（NG+ 仍 5 选 2） ============
    let talentOk = false;
    for (let i = 0; i < 30; i++) {
      talentOk = await page.evaluate(() => {
        const el = document.querySelector('.ui-talent-overlay');
        return !!(el && getComputedStyle(el).display !== 'none' && el.offsetHeight > 0);
      });
      if (talentOk) break;
      await page.keyboard.press('Space');
      await page.waitForTimeout(600);
    }
    check('C3 二周目天赋选择仍出现', talentOk, '');

    // 等待错峰翻牌全部揭晓（R038/R039：先牌背后翻牌，揭晓前卡面不可读/不可选）
    await page.waitForFunction(() => {
      const cards = document.querySelectorAll('.ui-talent-card');
      return cards.length === 5 && [...cards].every((c) => c.classList.contains('is-revealed'));
    }, { timeout: 15000 }).catch(() => {});

    // ============ 阶段4：时间旅者卡的 NG+ 差异化信息可见性 ============
    const travelerInfo = await page.evaluate(() => {
      const cards = [...document.querySelectorAll('.ui-talent-card')];
      const card = cards.find((c) => c.textContent.includes('时间旅者'));
      if (!card) return { found: false, allNames: cards.map((c) => c.textContent.slice(0, 30)) };
      return { found: true, text: card.textContent.replace(/\s+/g, ' ').slice(0, 220) };
    });
    console.log('INFO 时间旅者卡文案:', JSON.stringify(travelerInfo));
    check('C4a 时间旅者卡在天赋池', travelerInfo.found === true, travelerInfo.found ? '' : JSON.stringify(travelerInfo.allNames));
    const bonusVisible = travelerInfo.found && /多周目|额外|\+1|二周目|replay/i.test(travelerInfo.text);
    check('C4b NG+ 加成对玩家可见（卡面告知 +1）', bonusVisible, travelerInfo.text || 'N/A');
    await page.screenshot({ path: path.join(OUT, '03-ngplus-talent.png') });

    // ============ 阶段5：选时间旅者 + 任一卡 → 确认 → 验证 +1 生效 ============
    if (talentOk && travelerInfo.found) {
      const picked = await page.evaluate(() => {
        const cards = [...document.querySelectorAll('.ui-talent-card')];
        const tIdx = cards.findIndex((c) => c.dataset.talentId === 'time_traveler');
        const other = cards.findIndex((c, i) => i !== tIdx);
        const click = (i) => cards[i] && cards[i].dispatchEvent(new MouseEvent('click', { bubbles: true }));
        click(tIdx);
        return { tIdx, other, otherId: cards[other] && cards[other].dataset.talentId };
      });
      await page.waitForTimeout(300);
      await page.evaluate((other) => {
        const cards = [...document.querySelectorAll('.ui-talent-card')];
        if (cards[other]) cards[other].dispatchEvent(new MouseEvent('click', { bubbles: true }));
      }, picked.other);
      await page.waitForTimeout(400);
      await page.evaluate(() => {
        const btn = document.querySelector('#ui-talent-confirm');
        if (btn && !btn.disabled) btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });
      await page.waitForTimeout(2500);

      const attrs = await page.evaluate(() => {
        try {
          const scene = window.game.scene.getScene('GameScene');
          const s = scene && scene.state;
          return s ? { pride: s.pride, wealth: s.wealth, reputation: s.reputation, trust: s.trust, specials: s.talentSpecials } : null;
        } catch (e) { return { err: String(e).slice(0, 120) }; }
      });
      console.log('INFO 选后属性:', JSON.stringify(attrs), '第二张卡:', picked.otherId);
      // 期望 = 初值(5/5/5/5) + 时间旅者效果 + 第二张卡效果，钳 [0,10] 后 replay_bonus 全 +1（钳 10）
      const { TALENTS } = await import('file:///' + path.resolve(__dirname, '../src/data/talents.js').replace(/\\/g, '/'));
      const byId = Object.fromEntries(TALENTS.map((t) => [t.id, t]));
      const t1 = byId.time_traveler, t2 = byId[picked.otherId];
      const expected = {};
      for (const attr of ['pride', 'wealth', 'reputation', 'trust']) {
        const raw = 5 + ((t1.effects || {})[attr] || 0) + (((t2 && t2.effects) || {})[attr] || 0);
        expected[attr] = Math.min(10, Math.max(0, Math.min(10, raw)) + 1); // replay_bonus +1
      }
      const bonusApplied = attrs && !attrs.err &&
        attrs.pride === expected.pride && attrs.wealth === expected.wealth &&
        attrs.reputation === expected.reputation && attrs.trust === expected.trust &&
        Array.isArray(attrs.specials) && attrs.specials.includes('replay_bonus');
      check('C5 replay_bonus NG+ +1 全属性实际生效', bonusApplied === true,
        `实际 ${JSON.stringify(attrs)} vs 期望 ${JSON.stringify(expected)}`);
    }

    // ============ 阶段6：首章对话正常 ============
    for (let i = 0; i < 3; i++) { await page.keyboard.press('Space'); await page.waitForTimeout(600); }
    const dialogOk = await page.evaluate(() => {
      const d = document.getElementById('ui-dialog');
      return !!(d && d.classList.contains('visible'));
    });
    check('C6 二周目首章对话正常', dialogOk, '');
    await page.screenshot({ path: path.join(OUT, '04-ngplus-dialog.png') });

    // ============ 收尾 ============
    check('C7 全程零 pageerror', errors.length === 0, errors.join(' | ').slice(0, 300));

    await browser.close();
    const failed = checks.filter(c => !c.pass);
    console.log(failed.length === 0 ? '\nALL PASS' : `\n${failed.length} FAIL`);
    process.exit(failed.length === 0 ? 0 : 1);
  } finally {
    try { preview.kill(); } catch {}
    try { execSync(`taskkill /pid ${preview.pid} /T /F`, { stdio: 'ignore' }); } catch {}
  }
})().catch(e => { console.error('FATAL', e); process.exit(2); });
