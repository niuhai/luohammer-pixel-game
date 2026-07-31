// R042 结局页操作链路专项（生产构建，390×844 竖屏）——评委最终触点+创新性卖点演示路径
// 覆盖：AI 人生复盘(F3重建后首次全链验证) / 技能树 / 更多菜单(决策回顾·历史真相·分享卡·复制文案·人生地图) / 再来一次(NG+)
// 用法：node scripts/_probe_r042_ending_ops.cjs（自带 4188 preview，需先 npm run build）
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const BASE = 'http://localhost:4188/luohammer-pixel-game/';
const OUT = path.resolve('test-screenshots');

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
  const preview = spawn('npx', ['vite', 'preview', '--port', '4188', '--strictPort'], {
    stdio: 'ignore', shell: true, cwd: path.resolve(__dirname, '..')
  });
  const errors = [];
  const checks = [];
  const check = (name, pass, detail) => {
    checks.push({ name, pass, detail });
    console.log(`${pass ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`);
  };
  const clickText = (page, sel, text) => page.evaluate(([s, t]) => {
    const el = [...document.querySelectorAll(s)].find(b => b.textContent.includes(t) && b.offsetHeight > 0);
    if (el) { el.dispatchEvent(new MouseEvent('click', { bubbles: true })); return true; }
    return false;
  }, [sel, text]);

  try {
    await waitPort(BASE);
    const browser = await chromium.launch();
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push('PAGEERROR: ' + String(e).slice(0, 200)));
    page.on('console', (m) => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text().slice(0, 150)); });

    // 注入结局存档直达结局页
    await page.goto(BASE, { waitUntil: 'load', timeout: 30000 });
    await page.evaluate(() => {
      localStorage.clear();
      const state = {
        pride: 6, wealth: 5, reputation: 5, failures: 0, pressure: 2, trust: 5,
        pressureMax: 10, failurePenalty: 1, successBonus: 1,
        talentSpecials: [], currentStageId: 'youth', currentNode: 'ending_scholar',
        flags: [], triggeredEvents: [],
        history: [
          { nodeId: 'act1_first', choiceLabel: '坚持背诵《理想》课文', historyChoice: '坚持理想' },
          { nodeId: 'act6_debt', choiceLabel: '承认 6 亿债务', historyChoice: '直面现实', effects: { failures: 1 }, flags: ['faced_debt'] },
          { nodeId: 'act6_livestream', choiceLabel: '开播卖货还债', historyChoice: '放下面子' }
        ],
        achievements: ['first_choice'], gameStartTime: Date.now() - 600000
      };
      localStorage.setItem('luohammer_save', JSON.stringify(state));
      localStorage.setItem('luohammer_save_backup', JSON.stringify(state));
    });
    await page.reload({ waitUntil: 'load' });
    const contBtn = page.locator('#ui-boot-buttons button', { hasText: '继续游戏' });
    await contBtn.waitFor({ state: 'visible', timeout: 15000 });
    await contBtn.click();
    await page.locator('#ui-ending-overlay.visible').waitFor({ timeout: 30000 });
    await page.waitForTimeout(2600); // stagger 完成

    // ============ E1: AI 人生复盘（本地兜底引擎，断网可演示） ============
    const aiClicked = await clickText(page, '#ui-ending-buttons button', 'AI 人生复盘');
    check('E1a AI 复盘按钮可点', aiClicked);
    await page.locator('.ai-review-overlay.visible').waitFor({ timeout: 8000 }).catch(() => {});
    const aiOpen = await page.evaluate(() => !!document.querySelector('.ai-review-overlay.visible'));
    check('E1b AI 复盘弹窗打开', aiOpen);
    if (aiOpen) {
      // 打字机：文本应随时间增长且最终非空（本地引擎 14 种模式兜底）
      const len1 = await page.evaluate(() => (document.querySelector('.ai-review-body, .ai-review-content, .ai-review-panel')?.textContent || '').length);
      await page.waitForTimeout(2500);
      const len2 = await page.evaluate(() => (document.querySelector('.ai-review-body, .ai-review-content, .ai-review-panel')?.textContent || '').length);
      check('E1c AI 复盘内容生成（打字机增长）', len2 > len1 && len2 > 80, `len ${len1}→${len2}`);
      await page.screenshot({ path: path.join(OUT, 'r042-ai-review.png') });
      await page.evaluate(() => document.querySelector('.ai-review-close')?.click());
      await page.waitForTimeout(500);
      const aiClosed = await page.evaluate(() => !document.querySelector('.ai-review-overlay.visible'));
      check('E1d AI 复盘可关闭', aiClosed);
    }

    // ============ E2: 技能树面板 ============
    const stClicked = await clickText(page, '#ui-ending-buttons button', '跨周目成长');
    check('E2a 跨周目成长按钮可点', stClicked);
    await page.waitForTimeout(900);
    const st = await page.evaluate(() => {
      const p = document.querySelector('.skill-tree-panel');
      if (!p || p.offsetHeight === 0) return { open: false };
      return {
        open: true,
        nodes: p.querySelectorAll('button, [role="button"], .skill-node, .skill-tree-node').length,
        text: p.textContent.slice(0, 60)
      };
    });
    check('E2b 技能树面板打开且有技能节点', st.open && st.nodes > 0, JSON.stringify(st));
    await page.screenshot({ path: path.join(OUT, 'r042-skilltree.png') });
    // 关闭技能树（✕/关闭/遮罩点击兜底）
    await page.evaluate(() => {
      const p = document.querySelector('.skill-tree-panel');
      const btn = p && [...p.querySelectorAll('button')].find(b => /✕|×|关闭/.test(b.textContent));
      if (btn) btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await page.waitForTimeout(600);

    // ============ E3: 更多菜单 ============
    const moreClicked = await clickText(page, '#ui-ending-buttons button', '更多');
    check('E3a 更多按钮可点', moreClicked);
    await page.waitForTimeout(400);
    const menu = await page.evaluate(() => {
      const m = document.getElementById('ui-ending-more-menu');
      if (!m || m.style.display !== 'flex') return { open: false };
      return {
        open: true,
        items: [...m.querySelectorAll('button')].map(b => b.textContent.trim()),
        expanded: document.querySelector('.ui-ending-btn-more')?.getAttribute('aria-expanded')
      };
    });
    const need = ['决策回顾', '历史真相', '分享卡', '复制分享文案', '人生地图'];
    check('E3b 更多菜单打开含 5 项', menu.open && need.every(n => menu.items.some(i => i.includes(n))),
      JSON.stringify(menu.items) + ` aria-expanded=${menu.expanded}`);
    await page.screenshot({ path: path.join(OUT, 'r042-more-menu.png') });

    // ============ E4: 复制分享文案（R92 回归） ============
    await page.evaluate(() => {
      window.__copiedText = null;
      navigator.clipboard.writeText = (t) => { window.__copiedText = t; return Promise.resolve(); };
    });
    await clickText(page, '#ui-ending-more-menu button', '复制分享文案');
    await page.waitForTimeout(700);
    const copied = await page.evaluate(() => window.__copiedText);
    check('E4 分享文案复制成功且含话题标签',
      !!(copied && copied.includes('#罗的十字路口') && copied.includes('#人生模拟器')),
      copied ? `len=${copied.length}` : 'clipboard 未捕获');

    // ============ E5: 分享卡生成（F2 回归） ============
    await clickText(page, '#ui-ending-buttons button', '更多');
    await page.waitForTimeout(400);
    await clickText(page, '#ui-ending-more-menu button', '分享卡');
    let shareOk = false;
    for (let i = 0; i < 12; i++) {
      await page.waitForTimeout(400);
      shareOk = await page.evaluate(() => {
        const m = document.getElementById('share-card-mask');
        return !!(m && m.offsetHeight > 0 && m.querySelector('img, canvas'));
      });
      if (shareOk) break;
    }
    check('E5 分享卡生成（mask+图像）', shareOk);
    if (shareOk) await page.screenshot({ path: path.join(OUT, 'r042-sharecard.png') });
    await page.evaluate(() => {
      const m = document.getElementById('share-card-mask');
      const btn = m && [...m.querySelectorAll('button')].find(b => /✕|×|关闭/.test(b.textContent));
      if (btn) btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      else if (m) m.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await page.waitForTimeout(500);

    // ============ E6: 再来一次 → NG+（R040 回归：存档清理+回 BootScene） ============
    await clickText(page, '#ui-ending-buttons button', '再来一次');
    let bootOk = false;
    for (let i = 0; i < 20; i++) {
      await page.waitForTimeout(500);
      bootOk = await page.evaluate(() => {
        const b = document.getElementById('ui-boot-overlay');
        return !!(b && b.offsetHeight > 0);
      });
      if (bootOk) break;
    }
    check('E6a 再来一次回到标题', bootOk);
    const saveCleared = await page.evaluate(() => !localStorage.getItem('luohammer_save'));
    check('E6b 通关后存档已清理（无"继续游戏"残留）', saveCleared);
    await page.screenshot({ path: path.join(OUT, 'r042-retry-boot.png') });

    // ============ 收尾 ============
    check('E7 零 pageerror/console.error', errors.length === 0, errors.join(' | ').slice(0, 300));

    await browser.close();
    const failed = checks.filter(c => !c.pass);
    console.log(failed.length === 0 ? `\nALL ${checks.length} PASS` : `\n${failed.length} FAIL`);
    process.exit(failed.length === 0 ? 0 : 1);
  } finally {
    try { preview.kill(); } catch {}
    try { require('child_process').execSync(`taskkill /pid ${preview.pid} /T /F`, { stdio: 'ignore' }); } catch {}
  }
})().catch(e => { console.error('FATAL', e); process.exit(2); });
