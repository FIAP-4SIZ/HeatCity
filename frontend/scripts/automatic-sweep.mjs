import assert from 'node:assert/strict';

// Observe automatic progress. Never press keys or click a reference.
export async function waitForAutomaticSweep(page, { verifyWait = false } = {}) {
  if (verifyWait) {
    await page.evaluate(() => {
      window.mockBlink = true;
    });
    await page.locator('[data-reference-status]').waitFor({ timeout: 30000 });
    const position = await page.locator('.target').getAttribute('style');
    await page.waitForTimeout(2500);
    assert.equal(
      await page.locator('.target').getAttribute('style'),
      position,
      'The target must wait while eye samples are invalid.',
    );
    assert.equal(await page.locator('[data-confirm-reference]').count(), 0);
    await page.evaluate(() => {
      window.mockBlink = false;
    });
  }
  await page
    .locator('.fullscreen-panel p')
    .filter({ hasText: /^RMSE / })
    .waitFor({ timeout: 180000 });
}
