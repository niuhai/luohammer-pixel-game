/* eslint-env node */

const { chromium } = require('playwright');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const getArg = (name, fallback) => {
  const prefix = `--${name}=`;
  const value = process.argv.find(arg => arg.startsWith(prefix));
  return value ? value.slice(prefix.length) : fallback;
};
const round = getArg('round', 'R005');
const phase = getArg('phase', 'before');
if (!/^R\d+$/.test(round) || !/^[a-z0-9-]+$/i.test(phase)) {
  throw new Error('round 或 phase 参数不安全');
}

const OUT = path.join(ROOT, '.iteration', 'ui', 'evidence', round, phase);
const PORT = 4191;
const BASE = `http://127.0.0.1:${PORT}/luohammer-pixel-game/`;
const viewports = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844 }
];

const waitForServer = async (timeoutMs = 30_000) => {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(BASE);
      if (response.ok) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 300));
  }
  throw new Error('Vite preview 启动超时');
};

async function enterGameplay(page) {
  await page.goto(BASE, { waitUntil: 'load', timeout: 30_000 });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'load' });
  await page.locator('#rotate-hint-dismiss').click({ force: true }).catch(() => {});
  await page.locator('#ui-boot-buttons button', { hasText: '开始游戏' }).click();
  await page.locator('#ui-intro-overlay.visible').waitFor({ timeout: 15_000 });
  await page.locator('#ui-intro-skip-hint.visible').waitFor({ timeout: 3_000 });
  await page.locator('#ui-intro-skip-hint').click({ force: true });

  await page.locator('#ui-talent-overlay').waitFor({ state: 'visible', timeout: 25_000 });
  await page.waitForTimeout(1_500);
  const cards = page.locator('#ui-talent-cards .ui-talent-card');
  await cards.nth(0).click();
  await cards.nth(1).click();
  await page.locator('#ui-talent-confirm:not([disabled])').click();

  const settlement = page.locator('.ui-settlement-overlay.visible');
  if (await settlement.isVisible({ timeout: 6_000 }).catch(() => false)) {
    await page.locator('#ui-settlement-continue').click().catch(() => {});
  }
  await page.locator('#ui-dialog.visible').waitFor({ timeout: 20_000 });
}

async function captureViewport(browser, viewport) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    hasTouch: viewport.name === 'mobile',
    isMobile: viewport.name === 'mobile',
    reducedMotion: 'no-preference'
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(String(error)));

  await enterGameplay(page);
  await page.keyboard.press('Space');
  await page.waitForTimeout(180);
  await page.screenshot({
    path: path.join(OUT, `${viewport.name}-dialog.png`),
    fullPage: false
  });

  const dialog = await page.evaluate(() => {
    const dialogEl = document.getElementById('ui-dialog');
    const text = document.getElementById('ui-dialog-text');
    const continueEl = document.getElementById('ui-dialog-continue');
    const rect = element => {
      const value = element.getBoundingClientRect();
      return {
        left: Math.round(value.left),
        top: Math.round(value.top),
        right: Math.round(value.right),
        bottom: Math.round(value.bottom),
        width: Math.round(value.width),
        height: Math.round(value.height)
      };
    };
    return {
      viewport: { width: innerWidth, height: innerHeight },
      dialog: rect(dialogEl),
      text: rect(text),
      textLength: text.textContent.length,
      textFontSize: Number.parseFloat(getComputedStyle(text).fontSize),
      continueVisible: getComputedStyle(continueEl).display !== 'none'
    };
  });

  for (let attempt = 0; attempt < 12; attempt++) {
    if (await page.locator('#ui-choices.visible').isVisible().catch(() => false)) break;
    await page.keyboard.press('Space');
    await page.waitForTimeout(450);
  }
  await page.locator('#ui-choices.visible').waitFor({ timeout: 8_000 });
  await page.waitForTimeout(500);
  await page.screenshot({
    path: path.join(OUT, `${viewport.name}-choices.png`),
    fullPage: false
  });

  const choices = await page.evaluate(() => {
    const choicesEl = document.getElementById('ui-choices');
    const dialogEl = document.getElementById('ui-dialog');
    const buttons = [...choicesEl.querySelectorAll('.ui-choice-btn')];
    const active = document.activeElement;
    const rect = element => {
      const value = element.getBoundingClientRect();
      return {
        left: Math.round(value.left),
        top: Math.round(value.top),
        right: Math.round(value.right),
        bottom: Math.round(value.bottom),
        width: Math.round(value.width),
        height: Math.round(value.height)
      };
    };
    return {
      choices: rect(choicesEl),
      dialog: rect(dialogEl),
      buttonRects: buttons.map(rect),
      buttonCount: buttons.length,
      enabledCount: buttons.filter(button => !button.disabled).length,
      contextText: choicesEl.querySelector('.ui-choice-context')?.textContent.trim() || '',
      activeElement: active?.className || active?.id || active?.tagName || '',
      activeInsideChoices: choicesEl.contains(active),
      role: choicesEl.getAttribute('role'),
      ariaLabel: choicesEl.getAttribute('aria-label')
    };
  });

  await page.keyboard.press('ArrowDown');
  const arrowDownFocusIndex = await page.locator('.ui-choice-btn').evaluateAll(
    buttons => buttons.indexOf(document.activeElement)
  );
  await page.keyboard.press('Home');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(120);
  const nativeEnterAccepted = await page.evaluate(() => {
    const choicesEl = document.getElementById('ui-choices');
    return choicesEl.classList.contains('leaving') ||
      !choicesEl.classList.contains('visible') ||
      Boolean(choicesEl.querySelector('.ui-choice-btn.selected'));
  });
  choices.arrowDownFocusIndex = arrowDownFocusIndex;
  choices.nativeEnterAccepted = nativeEnterAccepted;

  await context.close();
  return {
    viewport,
    dialog,
    choices,
    errors,
    fits: dialog.dialog.top >= 0 &&
      dialog.dialog.bottom <= viewport.height &&
      choices.choices.top >= 0 &&
      choices.choices.bottom <= viewport.height &&
      choices.activeInsideChoices &&
      choices.arrowDownFocusIndex >= 0 &&
      choices.nativeEnterAccepted &&
      choices.buttonRects.every(rect =>
        rect.left >= 0 && rect.right <= viewport.width &&
        rect.top >= 0 && rect.bottom <= viewport.height
      )
  };
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const viteCli = path.join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js');
  const preview = spawn(process.execPath, [
    viteCli,
    'preview',
    '--host', '127.0.0.1',
    '--port', String(PORT),
    '--strictPort'
  ], {
    cwd: ROOT,
    stdio: 'ignore',
    windowsHide: true
  });

  let browser;
  try {
    await waitForServer();
    browser = await chromium.launch();
    const results = [];
    for (const viewport of viewports) {
      results.push(await captureViewport(browser, viewport));
    }
    const report = {
      schemaVersion: 1,
      round,
      phase,
      generatedAt: new Date().toISOString(),
      passed: results.every(result => result.fits && result.errors.length === 0),
      results
    };
    fs.writeFileSync(
      path.join(OUT, 'report.json'),
      `${JSON.stringify(report, null, 2)}\n`,
      'utf8'
    );
    console.log(JSON.stringify(report, null, 2));
    if (!report.passed) process.exitCode = 1;
  } finally {
    if (browser) await browser.close();
    preview.kill();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
