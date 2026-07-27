/**
 * 走查：文案↔场景/立绘匹配修复后的实机验证
 *
 * 对每个目标节点：注入存档 → 继续游戏 → 等待渲染 → 断言纹理 → 截图。
 * 覆盖本轮修复的 4 类问题：
 *   1. 新场景背景：cafe / rental / factory / factory_door
 *   2. act3_lei_chat 咖啡馆续节点
 *   3. ≥2016 startup 节点中年立绘（char-middle）
 *   4. 时期标签与角色名一致性（抽查 act5_a 显示「老罗」）
 *
 * 用法：先启动 vite dev（5173），再 node scripts/walkthrough-scenes.mjs
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.WALKTHROUGH_BASE || 'http://localhost:5173/luohammer-pixel-game/';
const OUT = path.join(process.cwd(), 'walkthrough', 'shots');
fs.mkdirSync(OUT, { recursive: true });

// [nodeId, 预期场景纹理 key, 预期角色纹理 key|null, 备注]
// 背景断言：PixelRenderer 会把 'bg-cafe' 生成为 '_cache_bg_cafe' 缓存纹理（- 转 _）
// 角色断言：中年立绘池 = dark 组（middle/depressed/livestream 均为中年形象）
const MIDDLE_AGE_CHAR_KEYS = new Set(['char-middle', 'char-depressed', 'char-livestream']);
const TARGETS = [
  ['act3_lei',      'bg-cafe',         null,     'A级修复：雷军会面咖啡馆'],
  ['act3_lei_chat', 'bg-cafe',         null,     '本轮新发现：咖啡馆续节点'],
  ['act0_gre',      'bg-rental',       null,     'A级修复：郊区出租屋自学GRE'],
  ['act0_fail3',    'bg-rental',       null,     'A级修复：出租屋药材发霉'],
  ['act4_yield',    'bg-factory',      null,     'A级修复：富士康产线良率噩梦'],
  ['act4_factory',  'bg-factory_door', null,     'A级修复：中天信工厂被封'],
  ['act5_a',        null,              'middle', 'B级修复：2016年44岁应中年立绘池'],
  ['act6_bird',     null,              'middle', 'B级修复：2018鸟巢前夜中年立绘池'],
];

function seedState(nodeId) {
  return {
    pride: 5, wealth: 5, reputation: 5, trust: 5,
    failures: 0, pressure: 0, pressureMax: 10,
    failurePenalty: 1, successBonus: 1, talentSpecials: [],
    currentStageId: null, currentNode: nodeId,
    flags: [], triggeredEvents: [], history: [], _version: 2,
  };
}

const browser = await chromium.launch();
let fail = 0;

for (const [nodeId, expectBg, expectChar, note] of TARGETS) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  await ctx.addInitScript((state) => {
    localStorage.setItem('luohammer_save', JSON.stringify(state));
    localStorage.setItem('luohammer_intro_seen', '1');
    localStorage.setItem('luohammer_play_count', '3'); // 跳过天赋引导类新手流程
  }, seedState(nodeId));

  const page = await ctx.newPage();
  try {
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    const continueBtn = page.locator('button.ui-boot-btn-primary', { hasText: '继续游戏' });
    await continueBtn.waitFor({ state: 'visible', timeout: 20000 });
    await continueBtn.click();
    // 等对话面板出现当前节点文本（渲染完成的信号）
    await page.waitForSelector('.ui-dialog, .dialog, [class*="dialog"]', { state: 'visible', timeout: 20000 });
    await page.waitForTimeout(1800); // 等场景图/立绘懒加载落位

    // 断言实际显示的纹理（而非纹理库中存在）：背景 sprite + 角色 sprite 的当前 texture key
    const result = await page.evaluate(() => {
      const gs = window.game?.scene?.getScene('GameScene');
      const renderer = gs?.pixelRenderer;
      const bgSprite = renderer?.bgSprite || renderer?.bg || null;
      return {
        current: gs?.state?.currentNode || null,
        bgKey: bgSprite?.texture?.key || null,
        charKey: renderer?.charSprite?.texture?.key || null,
        charName: document.querySelector('.ui-dialog-name, .dialog-name, [class*="name"]')?.textContent || null,
      };
    });

    const shot = path.join(OUT, `${nodeId}.png`);
    await page.screenshot({ path: shot });

    const expectBgKey = expectBg ? `_cache_${expectBg.replace(/-/g, '_')}` : null;
    const okBg = expectBg === null || result.bgKey === expectBgKey;
    const okChar = expectChar === null
      || (expectChar === 'middle' ? MIDDLE_AGE_CHAR_KEYS.has(result.charKey) : result.charKey === expectChar);
    const okNode = result.current === nodeId;
    const pass = okBg && okChar && okNode;
    if (!pass) fail++;
    console.log(`${pass ? 'PASS' : 'FAIL'} [${nodeId}] ${note}`);
    console.log(`     node=${result.current} bg=${result.bgKey} char=${result.charKey} name=${result.charName} shot=${shot}`);
  } catch (e) {
    fail++;
    console.log(`FAIL [${nodeId}] ${note} — ${e.message.split('\n')[0]}`);
  }
  await ctx.close();
}

await browser.close();
console.log(`\n${TARGETS.length - fail}/${TARGETS.length} 通过`);
process.exit(fail ? 1 : 0);
