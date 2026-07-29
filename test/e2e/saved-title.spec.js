import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve('.');
const EVIDENCE_ROOT = path.join(ROOT, '.iteration', 'ui', 'evidence', 'R012');
const BEFORE_REPORT = path.join(EVIDENCE_ROOT, 'before', 'report.json');
const hasPassingBaseline = fs.existsSync(BEFORE_REPORT) &&
  JSON.parse(fs.readFileSync(BEFORE_REPORT, 'utf8')).passed === true;
const PHASE = hasPassingBaseline ? 'after' : 'before';
const OUT = path.join(EVIDENCE_ROOT, PHASE);

const SAVED_STATE = {
  pride: 7,
  wealth: 5,
  reputation: 6,
  failures: 1,
  pressure: 2,
  trust: 5,
  pressureMax: 10,
  failurePenalty: 1,
  successBonus: 1,
  talentSpecials: [],
  currentStageId: 'teacher',
  currentNode: 'act1_first',
  flags: [],
  triggeredEvents: [],
  history: [],
  achievements: [],
  gameStartTime: Date.now() - 120_000
};

async function openReturningTitle(page) {
  await page.goto('/');
  await page.evaluate(state => {
    localStorage.clear();
    localStorage.setItem('luohammer_save', JSON.stringify(state));
    localStorage.setItem('luohammer_save_backup', JSON.stringify(state));
    localStorage.setItem('luohammer_intro_seen', '1');
    localStorage.setItem('luohammer_orientation_hint_seen', '1');
    localStorage.setItem('luohammer_meta_progress', JSON.stringify({
      exp: 8,
      unlockedSkills: [],
      seenEndings: ['legend'],
      playCount: 2,
      totalChoices: 24,
      achievementScore: 120,
      claimedMilestones: [],
      claimedAchievementMilestones: [],
      titles: []
    }));
  }, SAVED_STATE);
  await page.reload();
  await expect(page.locator('#ui-boot-overlay')).toBeVisible({ timeout: 15_000 });
  await expect.poll(() => page.evaluate(
    () => window.__luohammerBootShell?.hasAutoSave || false
  )).toBe(true);
  await expect(page.locator('#ui-boot-overlay')).toHaveAttribute('data-boot-phase', 'engine', {
    timeout: 15_000
  });
  await expect(page.locator('#ui-boot-buttons button', { hasText: '继续游戏' }))
    .toBeVisible({ timeout: 15_000 });
  await expect(page.locator('#ui-boot-more-toggle')).toBeVisible({ timeout: 15_000 });
}

async function readTitleLayout(page) {
  return page.evaluate(() => {
    const viewport = { width: window.innerWidth, height: window.innerHeight };
    const content = document.querySelector('.ui-boot-content');
    const buttonsRoot = document.getElementById('ui-boot-buttons');
    const contentRect = content.getBoundingClientRect();
    const buttons = [...buttonsRoot.querySelectorAll('button')].map(button => {
      const rect = button.getBoundingClientRect();
      const style = getComputedStyle(button);
      const visible = !button.hidden && style.display !== 'none' &&
        style.visibility !== 'hidden' && Number(style.opacity) > 0.01 &&
        rect.width > 0 && rect.height > 0;
      return {
        text: button.textContent.replace(/\s+/g, ' ').trim(),
        visible,
        primary: button.classList.contains('ui-boot-btn-primary'),
        top: Math.round(rect.top),
        bottom: Math.round(rect.bottom),
        left: Math.round(rect.left),
        right: Math.round(rect.right),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        fullyInViewport: visible && rect.top >= 0 && rect.bottom <= viewport.height &&
          rect.left >= 0 && rect.right <= viewport.width
      };
    });
    const visibleButtons = buttons.filter(button => button.visible);
    return {
      viewport,
      returningClass: document.getElementById('ui-boot-overlay')
        .classList.contains('returning-player'),
      content: {
        top: Math.round(contentRect.top),
        bottom: Math.round(contentRect.bottom),
        clientHeight: content.clientHeight,
        scrollHeight: content.scrollHeight,
        scrollTop: content.scrollTop,
        overflowY: getComputedStyle(content).overflowY,
        canScroll: content.scrollHeight > content.clientHeight + 1
      },
      totalButtonCount: buttons.length,
      visibleButtonCount: visibleButtons.length,
      clippedVisibleButtons: visibleButtons.filter(button => !button.fullyInViewport)
        .map(button => button.text),
      primaryAction: buttons.find(button => button.primary)?.text || '',
      buttons
    };
  });
}

test('有存档的标题页应优先继续游戏，并让短屏上的全部入口可达', async ({ page }) => {
  fs.mkdirSync(OUT, { recursive: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await openReturningTitle(page);
  const standard = await readTitleLayout(page);
  await page.screenshot({ path: path.join(OUT, 'saved-title-390x844.png') });

  await page.setViewportSize({ width: 375, height: 667 });
  await page.waitForTimeout(500);
  const compactInitial = await readTitleLayout(page);
  await page.screenshot({ path: path.join(OUT, 'saved-title-375x667.png') });

  const disclosure = {
    exists: false,
    expanded: false,
    lowFrequencyCount: 0,
    allLowFrequencyReachable: false,
    firstTabTarget: ''
  };
  const moreButton = page.locator('#ui-boot-more-toggle');
  if (await moreButton.count()) {
    disclosure.exists = true;
    await moreButton.focus();
    await page.keyboard.press('Enter');
    await expect(moreButton).toHaveAttribute('aria-expanded', 'true');
    disclosure.expanded = true;
    await page.waitForTimeout(650);
    const lowFrequency = page.locator('#ui-boot-more-panel button');
    disclosure.lowFrequencyCount = await lowFrequency.count();
    const reachable = [];
    for (let index = 0; index < disclosure.lowFrequencyCount; index++) {
      const button = lowFrequency.nth(index);
      await button.scrollIntoViewIfNeeded();
      reachable.push(await button.evaluate(element => {
        const rect = element.getBoundingClientRect();
        return rect.top >= 0 && rect.bottom <= window.innerHeight &&
          rect.left >= 0 && rect.right <= window.innerWidth;
      }));
    }
    disclosure.allLowFrequencyReachable = reachable.every(Boolean);
    await moreButton.focus();
    await page.keyboard.press('Tab');
    disclosure.firstTabTarget = await page.evaluate(
      () => document.activeElement?.textContent?.replace(/\s+/g, ' ').trim() || ''
    );
    await page.screenshot({ path: path.join(OUT, 'saved-title-more-options.png') });
  }

  const report = {
    schemaVersion: 1,
    round: 'R012',
    phase: PHASE,
    generatedAt: new Date().toISOString(),
    standard,
    compactInitial,
    disclosure
  };
  report.passed = standard.totalButtonCount >= 7 &&
    standard.primaryAction.includes('继续游戏') &&
    compactInitial.totalButtonCount >= 7;
  fs.writeFileSync(path.join(OUT, 'report.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  expect(report.passed).toBeTruthy();
  if (PHASE === 'after') {
    const before = JSON.parse(fs.readFileSync(BEFORE_REPORT, 'utf8'));
    expect(standard.returningClass).toBeTruthy();
    expect(standard.visibleButtonCount).toBeLessThan(before.standard.visibleButtonCount);
    expect(standard.visibleButtonCount).toBe(4);
    expect(compactInitial.clippedVisibleButtons).toEqual([]);
    expect(compactInitial.primaryAction).toContain('继续游戏');
    const continueButton = compactInitial.buttons.find(button =>
      button.text.includes('继续游戏'));
    const secondaryWidths = compactInitial.buttons
      .filter(button => button.visible && !button.primary &&
        !button.text.includes('更多选项'))
      .map(button => button.width);
    expect(continueButton.width).toBeGreaterThan(Math.max(...secondaryWidths));
    expect(disclosure.exists).toBeTruthy();
    expect(disclosure.expanded).toBeTruthy();
    expect(disclosure.lowFrequencyCount).toBe(4);
    expect(disclosure.allLowFrequencyReachable).toBeTruthy();
    expect(disclosure.firstTabTarget).toContain('回顾开场');
  }
});
