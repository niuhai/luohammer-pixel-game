// R94 VERIFY-L3：PWA 离线完整性实证
// 阶段1（在线）：打开→等预热器跑完→审计 SW 缓存覆盖率（33 张游戏图）
// 阶段2（离线）：setOffline→reload→开始游戏→天赋 5选2→断言 GameScene 纹理离线加载成功
const { chromium } = require('playwright');

const EXPECTED = [
  // 角色姿态（CHARACTER_ASSETS，10）
  'luo-standing-v4-nobg', 'luo-speaking-v4-nobg', 'luo-angry-v4-nobg', 'luo-depressed-v4-nobg',
  'luo-happy-v4-nobg', 'luo-livestream-v4-nobg', 'luo-middle-v4-nobg', 'luo-sitting-v4-nobg',
  'luo-young-v4-nobg',
  // 场景（SCENE_ASSETS，节选关键章）
  'scene-classroom-v2', 'scene-office-v2', 'scene-stage-v2', 'scene-livestream-v2',
  'scene-fridge_smash-v2', 'scene-talkshow-v2', 'scene-ending-v2', 'scene-court-v2',
];

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 375, height: 812 } });
  const page = await context.newPage();
  const result = {};
  try {
    await page.goto('http://localhost:4180/luohammer-pixel-game/', { waitUntil: 'load', timeout: 30000 });
    await page.locator('#ui-boot-overlay').waitFor({ state: 'visible', timeout: 15000 });

    // SW 激活确认
    result.swActive = await page.evaluate(async () => {
      const reg = await navigator.serviceWorker.ready;
      return !!reg.active;
    });

    // 等预热器完成（3.2s 延迟启动 + 33 张串行 idle 拉取，本地每张 <100ms；给足 30s 轮询）
    let warmed = 0;
    for (let i = 0; i < 60; i++) {
      warmed = await page.evaluate(async (expected) => {
        const keys = await caches.keys();
        if (!keys.length) return 0;
        const cache = await caches.open(keys[0]);
        const cached = await cache.keys();
        const urls = cached.map((r) => r.url);
        return expected.filter((name) => urls.some((u) => u.includes(name))).length;
      }, EXPECTED);
      if (warmed >= EXPECTED.length) break;
      await page.waitForTimeout(500);
    }
    result.cacheCoverage = `${warmed}/${EXPECTED.length}`;

    // === 离线阶段 ===
    await context.setOffline(true);
    await page.reload({ waitUntil: 'load', timeout: 20000 });
    result.offlineBoot = await page.locator('#ui-boot-overlay').isVisible({ timeout: 15000 });

    const consoleErrs = [];
    page.on('pageerror', (e) => consoleErrs.push('PAGEERROR: ' + String(e).slice(0, 120)));

    if (result.offlineBoot) {
      await page.locator('#ui-boot-buttons button', { hasText: '开始游戏' }).click({ timeout: 8000 });
      // 推进到天赋 overlay
      let talentOk = false;
      for (let i = 0; i < 40; i++) {
        talentOk = await page.evaluate(() => {
          const el = document.querySelector('.ui-talent-overlay');
          return !!(el && getComputedStyle(el).display !== 'none' && el.offsetHeight > 0);
        });
        if (talentOk) break;
        await page.keyboard.press('Space');
        await page.waitForTimeout(700);
      }
      result.offlineTalent = talentOk;

      if (talentOk) {
        // 5选2 → 确认
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
        await page.evaluate(() => {
          const btn = document.querySelector('#ui-talent-confirm');
          if (btn && !btn.disabled) btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        });
        await page.waitForTimeout(2500);

        // 断言：GameScene 纹理离线加载成功（Phaser 纹理缓存内存在 = webp 从 SW 缓存加载解码）
        result.offlineTextures = await page.evaluate(() => {
          try {
            const scene = window.game.scene.getScene('GameScene');
            const tex = scene.textures;
            return {
              'bg-classroom': tex.exists('bg-classroom'),
              'char-standing': tex.exists('char-standing'),
              'char-young': tex.exists('char-young'),
            };
          } catch (e) { return { err: String(e).slice(0, 100) }; }
        });
        // 对话继续推进 3 拍确认可玩
        for (let i = 0; i < 3; i++) { await page.keyboard.press('Space'); await page.waitForTimeout(700); }
        result.offlineDialog = await page.evaluate(() => {
          const d = document.getElementById('ui-dialog');
          return !!(d && d.classList.contains('visible'));
        });
      }
    }
    result.consoleErrs = consoleErrs;
  } catch (e) {
    result.err = String(e).slice(0, 300);
  }
  console.log(JSON.stringify(result, null, 2));
  await browser.close();
})();
