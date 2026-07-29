import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve('.');
const EVIDENCE_ROOT = path.join(ROOT, '.iteration', 'ui', 'evidence', 'R020');
const BEFORE_REPORT = path.join(EVIDENCE_ROOT, 'before', 'report.json');
const hasPassingBaseline = fs.existsSync(BEFORE_REPORT) &&
  JSON.parse(fs.readFileSync(BEFORE_REPORT, 'utf8')).passed === true;
const PHASE = hasPassingBaseline ? 'after' : 'before';
const OUT = path.join(EVIDENCE_ROOT, PHASE);
const SEEN_ENDINGS = ['legend', 'tycoon', 'tech_blogger'];

async function openEndingGallery(page) {
  await page.evaluate(async seenEndings => {
    document.getElementById('ui-ending-gallery-overlay')?.remove();
    const boot = document.getElementById('ui-boot-overlay');
    if (boot) {
      boot.classList.remove('visible');
      boot.style.display = 'none';
    }
    const skip = document.getElementById('ui-intro-skip-hint');
    if (skip) skip.style.display = 'none';

    let trigger = document.getElementById('ui-ending-gallery-probe-trigger');
    if (!trigger) {
      trigger = document.createElement('button');
      trigger.id = 'ui-ending-gallery-probe-trigger';
      trigger.type = 'button';
      trigger.textContent = '打开结局图鉴';
      trigger.style.cssText = [
        'position: fixed',
        'inset: 0 auto auto 0',
        'width: 44px',
        'height: 44px',
        'opacity: 0',
        'pointer-events: none'
      ].join(';');
      document.body.appendChild(trigger);
    }
    trigger.focus();

    const [{ showEndingGallery }, { ENDINGS }] = await Promise.all([
      import('/luohammer-pixel-game/src/ui/EndingGallery.js'),
      import('/luohammer-pixel-game/src/data/endings.js')
    ]);
    window.__endingGalleryProbe = {
      closeCount: 0,
      fullDescription: ENDINGS.find(ending => ending.id === 'tech_blogger').desc
        .replace(/罗远/g, '老罗')
    };
    showEndingGallery({
      seenEndings,
      onClose: () => {
        window.__endingGalleryProbe.closeCount += 1;
      }
    });
  }, SEEN_ENDINGS);
  await expect(page.locator('#ui-ending-gallery-overlay')).toBeVisible();
  await expect(page.locator('.ui-ending-gallery-card-item')).toHaveCount(35);
  await page.waitForTimeout(620);
}

async function readGalleryState(page) {
  return page.locator('#ui-ending-gallery-overlay').evaluate(overlay => {
    const dialogCard = overlay.querySelector('.ui-ending-gallery-card');
    const grid = overlay.querySelector('#ui-ending-gallery-grid');
    const progress = overlay.querySelector('.ui-ending-gallery-progress');
    const unlockedCards = [...overlay.querySelectorAll(
      '.ui-ending-gallery-card-unlocked'
    )];
    const lockedCards = [...overlay.querySelectorAll(
      '.ui-ending-gallery-card-locked'
    )];
    const toggles = [...overlay.querySelectorAll(
      '.ui-ending-gallery-card-toggle'
    )];
    const longCard = unlockedCards.find(card =>
      card.textContent.includes('数码博主')
    );
    const longSummary = longCard?.querySelector('.ui-ending-gallery-card-desc');
    const dialogRect = dialogCard.getBoundingClientRect();
    const gridRect = grid.getBoundingClientRect();
    const focused = document.activeElement;
    const focusable = [...overlay.querySelectorAll(
      'button:not([disabled]), summary, [href], [tabindex]:not([tabindex="-1"])'
    )].filter(element => element.getClientRects().length > 0);

    return {
      dialogRole: overlay.getAttribute('role') || '',
      progressRole: progress.getAttribute('role') || '',
      progressValueNow: progress.getAttribute('aria-valuenow'),
      progressValueText: progress.getAttribute('aria-valuetext') || '',
      gridRole: grid.getAttribute('role') || '',
      gridLabel: grid.getAttribute('aria-label') || '',
      unlockedCount: unlockedCards.length,
      lockedCount: lockedCards.length,
      unlockedTag: unlockedCards[0]?.tagName || '',
      unlockedRole: unlockedCards[0]?.getAttribute('role') || '',
      lockedRole: lockedCards[0]?.getAttribute('role') || '',
      lockedLabel: lockedCards[0]?.getAttribute('aria-label') || '',
      toggleCount: toggles.length,
      firstToggleTag: toggles[0]?.tagName || '',
      firstToggleExpanded: toggles[0]?.getAttribute('aria-expanded'),
      longSummaryLength: longSummary?.textContent.trim().length || 0,
      expectedLongDescriptionLength:
        window.__endingGalleryProbe.fullDescription.length,
      detailVisible: Boolean(
        overlay.querySelector('.ui-ending-gallery-detail:not([hidden])')
      ),
      detailText: overlay.querySelector('.ui-ending-gallery-detail:not([hidden])')
        ?.textContent.replace(/\s+/g, ' ').trim() || '',
      detailHasFullDescription: Boolean(
        overlay.querySelector('.ui-ending-gallery-detail:not([hidden])')
          ?.textContent.includes(window.__endingGalleryProbe.fullDescription)
      ),
      focusableCount: focusable.length,
      initialFocusText: focused?.textContent?.replace(/\s+/g, ' ').trim() || '',
      initialFocusInDialog: overlay.contains(focused),
      dialogBox: {
        left: Math.round(dialogRect.left),
        top: Math.round(dialogRect.top),
        right: Math.round(dialogRect.right),
        bottom: Math.round(dialogRect.bottom)
      },
      gridBox: {
        left: Math.round(gridRect.left),
        right: Math.round(gridRect.right),
        scrollHeight: Math.round(grid.scrollHeight),
        clientHeight: Math.round(grid.clientHeight)
      },
      viewport: { width: innerWidth, height: innerHeight }
    };
  });
}

async function revealLongEnding(page) {
  const card = page.locator('.ui-ending-gallery-card-unlocked', {
    hasText: '数码博主'
  });
  await card.scrollIntoViewIfNeeded();
  const toggle = card.locator('.ui-ending-gallery-card-toggle');
  if (await toggle.count()) {
    await toggle.focus();
    await page.keyboard.press('Enter');
  }
  await page.waitForTimeout(180);
  return readGalleryState(page);
}

async function readArrowNavigation(page) {
  const toggles = page.locator('.ui-ending-gallery-card-toggle');
  if (await toggles.count() < 2) {
    return { supported: false, before: '', after: '' };
  }
  await toggles.nth(0).focus();
  const before = await page.evaluate(() =>
    document.activeElement?.textContent?.replace(/\s+/g, ' ').trim() || ''
  );
  await page.keyboard.press('ArrowRight');
  const after = await page.evaluate(() =>
    document.activeElement?.textContent?.replace(/\s+/g, ' ').trim() || ''
  );
  return { supported: before !== after, before, after };
}

async function captureViewport(page, viewport, filename) {
  await page.setViewportSize(viewport);
  await openEndingGallery(page);
  const state = await readGalleryState(page);
  await page.screenshot({ path: path.join(OUT, filename) });
  return state;
}

test('结局图鉴应支持完整回顾、准确进度语义和键盘浏览', async ({ page }) => {
  fs.mkdirSync(OUT, { recursive: true });
  await page.goto('/');

  const desktop = await captureViewport(
    page,
    { width: 1440, height: 900 },
    'desktop-gallery.png'
  );
  const desktopDetail = await revealLongEnding(page);
  if (PHASE === 'after') {
    await page.screenshot({ path: path.join(OUT, 'desktop-detail.png') });
  }
  const arrowNavigation = await readArrowNavigation(page);

  await page.keyboard.press('Escape');
  if (PHASE === 'after' && desktopDetail.detailVisible) {
    await expect(page.locator('.ui-ending-gallery-detail')).toBeHidden();
    await page.keyboard.press('Escape');
  }
  await expect(page.locator('#ui-ending-gallery-overlay')).toHaveCount(0);
  const desktopClose = await page.evaluate(() => ({
    triggerFocused: document.activeElement ===
      document.getElementById('ui-ending-gallery-probe-trigger'),
    closeCount: window.__endingGalleryProbe.closeCount
  }));

  const mobile390 = await captureViewport(
    page,
    { width: 390, height: 844 },
    'mobile-390-gallery.png'
  );
  const mobileDetail = await revealLongEnding(page);
  if (PHASE === 'after') {
    await page.screenshot({ path: path.join(OUT, 'mobile-390-detail.png') });
  }
  await page.keyboard.press('Escape');
  if (PHASE === 'after' && mobileDetail.detailVisible) {
    await page.keyboard.press('Escape');
  }
  await expect(page.locator('#ui-ending-gallery-overlay')).toHaveCount(0);

  const mobile375 = await captureViewport(
    page,
    { width: 375, height: 812 },
    'mobile-375-gallery.png'
  );

  const report = {
    schemaVersion: 1,
    round: 'R020',
    phase: PHASE,
    generatedAt: new Date().toISOString(),
    desktop,
    desktopDetail,
    arrowNavigation,
    desktopClose,
    mobile390,
    mobileDetail,
    mobile375
  };
  report.passed = desktop.dialogRole === 'dialog' &&
    desktop.unlockedCount === SEEN_ENDINGS.length &&
    desktop.initialFocusInDialog &&
    desktop.dialogBox.left >= 0 &&
    desktop.dialogBox.right <= desktop.viewport.width &&
    mobile390.dialogBox.left >= 0 &&
    mobile390.dialogBox.right <= mobile390.viewport.width &&
    mobile375.dialogBox.left >= 0 &&
    mobile375.dialogBox.right <= mobile375.viewport.width &&
    desktopClose.triggerFocused &&
    desktopClose.closeCount === 1;
  fs.writeFileSync(
    path.join(OUT, 'report.json'),
    `${JSON.stringify(report, null, 2)}\n`,
    'utf8'
  );

  expect(report.passed).toBeTruthy();
  if (PHASE === 'before') {
    expect(desktop.progressRole).toBe('');
    expect(desktop.gridRole).toBe('');
    expect(desktop.toggleCount).toBe(0);
    expect(desktop.focusableCount).toBe(1);
    expect(desktop.longSummaryLength).toBeLessThan(
      desktop.expectedLongDescriptionLength
    );
    expect(desktopDetail.detailVisible).toBeFalsy();
    expect(arrowNavigation.supported).toBeFalsy();
  } else {
    const before = JSON.parse(fs.readFileSync(BEFORE_REPORT, 'utf8'));
    expect(before.desktop.progressRole).toBe('');
    expect(before.desktop.toggleCount).toBe(0);
    expect(before.desktop.focusableCount).toBe(1);
    expect(before.desktopDetail.detailVisible).toBeFalsy();

    expect(desktop.progressRole).toBe('progressbar');
    expect(desktop.progressValueNow).toBe(String(SEEN_ENDINGS.length));
    expect(desktop.progressValueText).toContain(
      `已解锁 ${SEEN_ENDINGS.length}`
    );
    expect(desktop.gridRole).toBe('list');
    expect(desktop.gridLabel).toContain('结局');
    expect(desktop.unlockedRole).toBe('listitem');
    expect(desktop.lockedRole).toBe('listitem');
    expect(desktop.lockedLabel).toContain('未解锁');
    expect(desktop.toggleCount).toBe(SEEN_ENDINGS.length);
    expect(desktop.firstToggleTag).toBe('BUTTON');
    expect(desktop.firstToggleExpanded).toBe('false');
    expect(desktop.focusableCount).toBeGreaterThanOrEqual(
      SEEN_ENDINGS.length + 1
    );
    expect(desktopDetail.detailVisible).toBeTruthy();
    expect(desktopDetail.detailHasFullDescription).toBeTruthy();
    expect(desktopDetail.detailText).toContain('数码博主');
    expect(arrowNavigation.supported).toBeTruthy();
    expect(mobile390.dialogBox.bottom).toBeLessThanOrEqual(
      mobile390.viewport.height
    );
    expect(mobile375.dialogBox.bottom).toBeLessThanOrEqual(
      mobile375.viewport.height
    );
  }
});
