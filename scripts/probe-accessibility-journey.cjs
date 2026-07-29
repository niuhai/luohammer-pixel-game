/* eslint-env node */

const { chromium } = require('playwright');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, '.iteration', 'ui', 'evidence', 'R007', 'after');
const PORT = 4193;
const BASE = `http://127.0.0.1:${PORT}/luohammer-pixel-game/`;

const waitForServer = async (timeoutMs = 30_000) => {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(BASE);
      if (response.ok) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 300));
  }
  throw new Error('Vite preview startup timed out.');
};

async function resetFirstPlay(page) {
  await page.goto(BASE, { waitUntil: 'load', timeout: 30_000 });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'load' });
  await page.locator('#rotate-hint-dismiss').click({ force: true }).catch(() => {});
}

async function captureKeyboardJourney(browser) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    reducedMotion: 'no-preference'
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(String(error)));
  page.on('console', message => {
    if (message.type() === 'error') errors.push(message.text());
  });

  await resetFirstPlay(page);
  await page.locator('#ui-boot-overlay.visible').waitFor({ timeout: 15_000 });
  await page.waitForTimeout(100);
  const boot = await page.evaluate(() => ({
    role: document.getElementById('ui-boot-overlay').getAttribute('role'),
    labelledBy: document.getElementById('ui-boot-overlay').getAttribute('aria-labelledby'),
    active: document.activeElement?.textContent?.trim() || '',
    primaryFocused: document.activeElement?.classList.contains('ui-boot-btn-primary') || false
  }));
  await page.screenshot({ path: path.join(OUT, 'keyboard-boot.png') });

  await page.keyboard.press('Enter');
  await page.locator('#ui-intro-overlay.visible').waitFor({ timeout: 10_000 });
  await page.locator('#ui-intro-skip-hint.visible').waitFor({ timeout: 3_000 });
  const intro = await page.evaluate(() => ({
    role: document.getElementById('ui-intro-overlay').getAttribute('role'),
    label: document.getElementById('ui-intro-overlay').getAttribute('aria-label'),
    skipFocused: document.activeElement?.id === 'ui-intro-skip-hint'
  }));
  await page.screenshot({ path: path.join(OUT, 'keyboard-intro.png') });

  await page.keyboard.press('Enter');
  await page.locator('#ui-talent-overlay.visible').waitFor({ timeout: 25_000 });
  await page.waitForFunction(() =>
    document.activeElement?.classList.contains('ui-talent-card')
  );
  const firstCard = page.locator('#ui-talent-cards .ui-talent-card').first();
  await page.keyboard.press('Space');
  const talent = await page.evaluate(() => {
    const overlay = document.getElementById('ui-talent-overlay');
    const cards = [...document.querySelectorAll('.ui-talent-card')];
    return {
      role: overlay.getAttribute('role'),
      labelledBy: overlay.getAttribute('aria-labelledby'),
      cardCount: cards.length,
      firstCardFocused: document.activeElement === cards[0],
      firstCardPressed: cards[0].getAttribute('aria-pressed'),
      enabledCards: cards.filter(card => !card.disabled).length
    };
  });
  await page.screenshot({ path: path.join(OUT, 'keyboard-talent.png') });

  await context.close();
  return {
    boot,
    intro,
    talent,
    errors,
    passed:
      boot.role === 'main' &&
      boot.primaryFocused &&
      intro.role === 'dialog' &&
      intro.skipFocused &&
      talent.role === 'dialog' &&
      talent.firstCardFocused &&
      talent.firstCardPressed === 'true' &&
      talent.enabledCards === 5 &&
      errors.length === 0
  };
}

async function captureReducedMotionJourney(browser) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
    reducedMotion: 'reduce'
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(String(error)));
  page.on('console', message => {
    if (message.type() === 'error') errors.push(message.text());
  });

  await resetFirstPlay(page);
  await page.locator('#ui-boot-overlay.visible').waitFor({ timeout: 15_000 });
  await page.waitForTimeout(150);
  const boot = await page.evaluate(() => {
    const selectors = [
      '.ui-boot-character-bg',
      '.ui-boot-title',
      '.ui-boot-subtitle',
      '.ui-boot-btn-primary'
    ];
    const seconds = value => value.split(',').map(item => {
      const trimmed = item.trim();
      return trimmed.endsWith('ms')
        ? Number.parseFloat(trimmed) / 1000
        : Number.parseFloat(trimmed);
    });
    const timings = selectors.flatMap(selector => {
      const style = getComputedStyle(document.querySelector(selector));
      return seconds(style.animationDuration).map((duration, index) => ({
        duration,
        delay: seconds(style.animationDelay)[index] || 0
      }));
    });
    return {
      quote: document.getElementById('ui-boot-quote').textContent.trim(),
      hasCursor: Boolean(document.querySelector('.ui-boot-quote-cursor')),
      animationTimingsSeconds: timings,
      primaryFocused: document.activeElement?.classList.contains('ui-boot-btn-primary') || false
    };
  });
  await page.screenshot({ path: path.join(OUT, 'reduced-motion-boot.png') });

  await page.keyboard.press('Enter');
  await page.locator('#ui-intro-overlay.visible').waitFor({ timeout: 10_000 });
  await page.waitForTimeout(1_000);
  const intro = await page.evaluate(() => ({
    reducedMotion: window.game?.scene?.getScene('IntroScene')?._reducedMotion === true,
    visibleLines: [...document.querySelectorAll('.ui-intro-line.visible')].length
  }));
  await page.screenshot({ path: path.join(OUT, 'reduced-motion-intro.png') });

  await page.locator('#ui-talent-overlay.visible').waitFor({ timeout: 25_000 });
  await page.waitForFunction(() =>
    document.activeElement?.classList.contains('ui-talent-card')
  );
  const talent = await page.evaluate(() => {
    const cards = [...document.querySelectorAll('.ui-talent-card')];
    return {
      allRevealed: cards.every(card => card.classList.contains('is-revealed')),
      disabledCount: cards.filter(card => card.disabled).length,
      focusedFirstCard: document.activeElement === cards[0]
    };
  });
  await page.screenshot({ path: path.join(OUT, 'reduced-motion-talent.png') });

  await context.close();
  return {
    boot,
    intro,
    talent,
    errors,
    passed:
      boot.quote.length > 0 &&
      !boot.hasCursor &&
      boot.animationTimingsSeconds.every(({ duration, delay }) =>
        duration <= 0.001 && delay <= 0.001
      ) &&
      boot.primaryFocused &&
      intro.reducedMotion &&
      intro.visibleLines >= 3 &&
      talent.allRevealed &&
      talent.disabledCount === 0 &&
      talent.focusedFirstCard &&
      errors.length === 0
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
    const keyboard = await captureKeyboardJourney(browser);
    const reducedMotion = await captureReducedMotionJourney(browser);
    const report = {
      schemaVersion: 1,
      round: 'R007',
      generatedAt: new Date().toISOString(),
      passed: keyboard.passed && reducedMotion.passed,
      keyboard,
      reducedMotion
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
