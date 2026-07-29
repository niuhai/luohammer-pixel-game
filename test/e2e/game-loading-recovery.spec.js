import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve('.');
const EVIDENCE_ROOT = path.join(ROOT, '.iteration', 'ui', 'evidence', 'R023');
const BEFORE_REPORT = path.join(EVIDENCE_ROOT, 'before', 'report.json');
const PHASE = fs.existsSync(BEFORE_REPORT) ? 'after' : 'before';
const OUT = path.join(EVIDENCE_ROOT, PHASE);

async function ariaSnapshot(locator) {
  try {
    return await locator.ariaSnapshot();
  } catch (error) {
    return '';
  }
}

async function openFreshTitle(page) {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.locator('#rotate-hint-dismiss').click({ force: true }).catch(() => {});
  await expect(page.locator('#ui-boot-overlay')).toBeVisible({ timeout: 15_000 });
}

async function enterAndSkipIntro(page) {
  await page.locator('#ui-boot-buttons .ui-boot-btn-primary').click({ force: true });
  await expect(page.locator('#ui-intro-overlay')).toBeVisible({ timeout: 10_000 });
  const skip = page.locator('#ui-intro-skip-hint');
  await expect(skip).toHaveClass(/visible/, { timeout: 5_000 });
  await skip.click({ force: true });
}

async function collectChunkFailure(browser, viewport, label, options = {}) {
  const context = await browser.newContext({
    baseURL: 'http://localhost:5173/',
    viewport,
    serviceWorkers: 'block'
  });
  const page = await context.newPage();
  let shouldFailChunk = true;
  let failedRequests = 0;
  await page.route(/\/src\/scenes\/GameScene\.js(?:\?|$)/, async route => {
    if (!shouldFailChunk) {
      await route.continue();
      return;
    }
    failedRequests += 1;
    await route.fulfill({
      status: 503,
      contentType: 'text/javascript; charset=utf-8',
      body: 'throw new Error("R023 injected GameScene failure");'
    });
  });

  await openFreshTitle(page);
  await enterAndSkipIntro(page);

  const loader = page.locator('#ui-game-loading');
  await expect(loader).toHaveAttribute('data-loading-stage', 'error', {
    timeout: 15_000
  });
  await expect(page.locator('#ui-boot-overlay')).toBeVisible({ timeout: 10_000 });
  const state = await loader.evaluate(element => {
    const retry = element.querySelector('.ui-game-loading-action');
    const dismiss = element.querySelector('.ui-game-loading-dismiss');
    return {
      hidden: element.hidden,
      ariaHidden: element.getAttribute('aria-hidden'),
      role: element.getAttribute('role'),
      ariaModal: element.getAttribute('aria-modal'),
      pointerEvents: getComputedStyle(element).pointerEvents,
      retryVisible: Boolean(retry && !retry.hidden),
      retryLabel: retry?.textContent.trim() || '',
      dismissVisible: Boolean(dismiss && !dismiss.hidden),
      focusedClass: document.activeElement?.className || '',
      focusedText: document.activeElement?.textContent?.trim() || '',
      cardBox: (() => {
        const rect = element.querySelector('.ui-game-loading-card')
          ?.getBoundingClientRect();
        return rect ? {
          left: Math.round(rect.left),
          top: Math.round(rect.top),
          right: Math.round(rect.right),
          bottom: Math.round(rect.bottom)
        } : null;
      })(),
      actionHeight: retry?.getBoundingClientRect().height || 0,
      viewport: { width: innerWidth, height: innerHeight }
    };
  });
  state.ariaSnapshot = await ariaSnapshot(loader);
  if (options.captureEvidence) {
    await page.screenshot({ path: path.join(OUT, `${label}-chunk-error.png`) });
  }

  await page.waitForTimeout(2100);
  state.persistentAfter2100 = await loader.evaluate(element =>
    !element.hidden && element.getAttribute('aria-hidden') === 'false'
  );

  state.reloadReachedTitle = false;
  state.hiddenAfterRecovery = false;
  if (PHASE === 'after' && state.retryVisible) {
    shouldFailChunk = false;
    await page.locator('.ui-game-loading-action').focus();
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'domcontentloaded' }),
      page.keyboard.press('Enter')
    ]);
    await expect(page.locator('#ui-boot-overlay')).toBeVisible({ timeout: 15_000 });
    state.reloadReachedTitle = true;
    state.hiddenAfterRecovery = await loader.evaluate(element =>
      element.hidden && element.getAttribute('aria-hidden') === 'true'
    );
    if (options.captureEvidence) {
      await page.screenshot({ path: path.join(OUT, `${label}-chunk-recovered.png`) });
    }
  }

  await context.close();
  return { failedRequests, ...state };
}

async function collectAssetFallback(browser, viewport, label, options = {}) {
  const context = await browser.newContext({
    baseURL: 'http://localhost:5173/',
    viewport,
    serviceWorkers: 'block'
  });
  const page = await context.newPage();
  let failedRequests = 0;
  await page.route(
    /\/assets\/characters\/(?:scene-classroom-v2|luo-standing-v4-nobg|luo-young-v4-nobg)\.webp(?:\?|$)/,
    async route => {
      failedRequests += 1;
      await route.fulfill({ status: 503, body: 'R023 injected image failure' });
    }
  );

  await openFreshTitle(page);
  await enterAndSkipIntro(page);
  await expect(page.locator('#ui-talent-overlay')).toBeVisible({ timeout: 30_000 });

  const warning = page.locator('.toast-item[data-toast-type="warning"]');
  const warningVisible = await warning.isVisible({ timeout: 1500 }).catch(() => false);
  const state = {
    failedRequests,
    talentVisible: await page.locator('#ui-talent-overlay').isVisible(),
    warningVisible,
    warningText: warningVisible ? (await warning.textContent()).trim() : '',
    warningRole: warningVisible ? await warning.getAttribute('role') : null,
    missingTextures: await page.evaluate(() => [
      'bg-classroom',
      'char-standing',
      'char-young'
    ].filter(key => !window.game?.textures?.exists(key))),
    loadingHidden: await page.locator('#ui-game-loading').evaluate(element =>
      element.hidden && element.getAttribute('aria-hidden') === 'true'
    ),
    warningBox: warningVisible
      ? await warning.evaluate(element => {
          const rect = element.getBoundingClientRect();
          return {
            left: Math.round(rect.left),
            right: Math.round(rect.right),
            top: Math.round(rect.top),
            bottom: Math.round(rect.bottom),
            viewportWidth: innerWidth,
            viewportHeight: innerHeight
          };
        })
      : null
  };
  if (options.captureEvidence) {
    await page.screenshot({ path: path.join(OUT, `${label}-asset-fallback.png`) });
  }
  await context.close();
  return state;
}

test('资源失败应提供明确恢复动作，并区分可降级图片', async ({ browser }) => {
  fs.mkdirSync(OUT, { recursive: true });
  test.setTimeout(150_000);
  const viewportSpecs = [
    { label: 'desktop-1440', width: 1440, height: 900, captureEvidence: true },
    { label: 'desktop-1366', width: 1366, height: 768 },
    { label: 'desktop-1920', width: 1920, height: 1080 },
    { label: 'mobile-390', width: 390, height: 844, captureEvidence: true },
    { label: 'mobile-375', width: 375, height: 812 },
    { label: 'mobile-360', width: 360, height: 800 }
  ];
  const chunkEntries = await Promise.all(viewportSpecs.map(async spec => [
    spec.label,
    await collectChunkFailure(
      browser,
      { width: spec.width, height: spec.height },
      spec.label,
      { captureEvidence: spec.captureEvidence }
    )
  ]));
  const chunkMatrix = Object.fromEntries(chunkEntries);
  const desktopChunk = chunkMatrix['desktop-1440'];
  const mobileChunk = chunkMatrix['mobile-390'];
  const [assetFallback, mobileAssetFallback] = await Promise.all([
    collectAssetFallback(
      browser,
      { width: 1440, height: 900 },
      'desktop',
      { captureEvidence: true }
    ),
    collectAssetFallback(
      browser,
      { width: 390, height: 844 },
      'mobile-390',
      { captureEvidence: true }
    )
  ]);
  const result = {
    schemaVersion: 1,
    round: 'R023',
    phase: PHASE,
    generatedAt: new Date().toISOString(),
    desktopChunk,
    mobileChunk,
    chunkMatrix,
    assetFallback,
    mobileAssetFallback
  };
  result.passed = PHASE === 'before' || (
    Object.values(chunkMatrix).every(state =>
      state.failedRequests >= 1 &&
      state.hidden === false &&
      state.ariaHidden === 'false' &&
      state.role === 'alertdialog' &&
      state.ariaModal === 'true' &&
      state.pointerEvents === 'auto' &&
      state.retryVisible &&
      state.dismissVisible &&
      state.focusedClass.includes('ui-game-loading-action') &&
      state.actionHeight >= 44 &&
      state.cardBox.left >= 0 &&
      state.cardBox.right <= state.viewport.width &&
      state.cardBox.top >= 0 &&
      state.cardBox.bottom <= state.viewport.height &&
      state.persistentAfter2100 &&
      state.reloadReachedTitle &&
      state.hiddenAfterRecovery
    ) && [assetFallback, mobileAssetFallback].every(state =>
      state.failedRequests >= 3 &&
      state.talentVisible &&
      state.warningVisible &&
      state.warningText.includes('简化舞台') &&
      state.warningRole === 'status' &&
      state.missingTextures.length >= 1 &&
      state.loadingHidden &&
      state.warningBox.left >= 0 &&
      state.warningBox.right <= state.warningBox.viewportWidth &&
      state.warningBox.top >= 0 &&
      state.warningBox.bottom <= state.warningBox.viewportHeight
    )
  );
  fs.writeFileSync(
    path.join(OUT, 'report.json'),
    `${JSON.stringify(result, null, 2)}\n`,
    'utf8'
  );
  expect(result.passed).toBeTruthy();
});
