import { expect, test } from '@playwright/test';

test.setTimeout(240_000);

async function enterGame(page) {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.locator('#ui-boot-overlay').waitFor({ state: 'visible', timeout: 15_000 });
  await page.locator('#ui-boot-buttons button', { hasText: '开始游戏' }).click();
  await page.locator('#ui-intro-overlay').waitFor({ state: 'visible', timeout: 15_000 });
  await page.locator('#ui-intro-skip-hint.visible').click({ force: true });
  await page.locator('#ui-talent-overlay').waitFor({ state: 'visible', timeout: 30_000 });
  await page.locator('#ui-talent-cards .ui-talent-card.is-revealed').first()
    .waitFor({ state: 'visible', timeout: 15_000 });
  await page.locator('#ui-talent-cards .ui-talent-card').nth(0).click();
  await page.locator('#ui-talent-cards .ui-talent-card').nth(1).click();
  await page.locator('#ui-talent-confirm:not([disabled])').click();
  const settlement = page.locator('.ui-settlement-overlay.visible');
  if (await settlement.isVisible({ timeout: 6_000 }).catch(() => false)) {
    await page.locator('#ui-settlement-continue').click().catch(() => {});
  }
  await page.locator('#ui-dialog.visible').waitFor({ timeout: 25_000 });
}

test('所有非结局选择节点都能渲染出可操作的选择面板', async ({ page }) => {
  await enterGame(page);

  const report = await page.evaluate(async () => {
    const [{ STORY }, { STAGES }] = await Promise.all([
      import('/luohammer-pixel-game/src/data/story.js'),
      import('/luohammer-pixel-game/src/data/stages.js')
    ]);
    const scene = window.game?.scene?.getScene('GameScene');
    if (!scene) throw new Error('GameScene 未启动');

    const stageEntryFlags = STAGES.map(stage => `stage_entry_${stage.id}`);
    const nodes = Object.entries(STORY).filter(([, node]) =>
      !node.isEnding && Array.isArray(node.choices) && node.choices.length > 0
    );
    const failures = [];

    const waitForDialog = async nodeId => {
      for (let i = 0; i < 320; i++) {
        const dialog = document.querySelector('#ui-dialog.visible');
        if (dialog && document.querySelector('#ui-dialog-text')?.textContent?.trim()) {
          return true;
        }
        await new Promise(resolve => setTimeout(resolve, 25));
      }
      failures.push({ nodeId, reason: 'dialog_timeout' });
      return false;
    };

    for (const [nodeId, node] of nodes) {
      scene.choices.hide(true);
      scene.dialog.hide();
      scene.dialog._finishHide?.();
      scene.state = {
        ...scene.state,
        currentNode: nodeId,
        currentStageId: STAGES.find(stage => stage.nodes.includes(nodeId))?.id || scene.state.currentStageId,
        flags: new Set(),
        triggeredEvents: new Set(stageEntryFlags),
        history: [],
        unlockedHistoryNotes: [],
        readHistoryNotes: [],
        pride: 5,
        wealth: 5,
        reputation: 5,
        failures: 0,
        pressure: 3,
        trust: 5,
        pressureMax: 10
      };
      scene.isNewGame = false;
      await scene._renderNode(node);
      if (!await waitForDialog(nodeId)) continue;
      if (typeof scene.dialog._skipToChoices === 'function') scene.dialog._skipToChoices();
      if (scene.dialog.isTyping) scene.dialog.skipTyping();

      for (let i = 0; i < 80; i++) {
        if (document.querySelector('#ui-choices.visible')) break;
        await new Promise(resolve => setTimeout(resolve, 25));
      }

      const choices = document.querySelector('#ui-choices.visible');
      const buttons = choices ? [...choices.querySelectorAll('.ui-choice-btn')] : [];
      const enabled = buttons.filter(button => !button.disabled);
      const invalidButton = buttons.find(button => {
        const rect = button.getBoundingClientRect();
        const style = getComputedStyle(button);
        return button.tagName !== 'BUTTON' ||
          rect.width <= 0 || rect.height <= 0 ||
          style.pointerEvents === 'none' ||
          style.display === 'none' || style.visibility === 'hidden';
      });

      if (!choices) {
        failures.push({ nodeId, reason: 'choices_not_visible' });
      } else if (buttons.length !== node.choices.length) {
        failures.push({ nodeId, reason: 'choice_count_mismatch', expected: node.choices.length, actual: buttons.length });
      } else if (enabled.length === 0) {
        failures.push({ nodeId, reason: 'no_enabled_choice' });
      } else if (invalidButton) {
        failures.push({ nodeId, reason: 'invalid_button', label: invalidButton.textContent.trim().slice(0, 40) });
      }
    }

    return { total: nodes.length, failures };
  });

  expect(report.total).toBeGreaterThan(150);
  expect(report.failures).toEqual([]);
});
