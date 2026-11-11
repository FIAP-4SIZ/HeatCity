import assert from 'node:assert/strict';

// Each step is confirmed through the same user inputs as the real workflow.
export async function confirmSweep(page, { verifyWait = false } = {}) {
  const expires = Date.now() + 180000;
  let confirmed = 0;
  while (Date.now() < expires) {
    const status = await page.waitForFunction(
      () => {
        if (
          [...document.querySelectorAll('.fullscreen-panel p')].some((p) =>
            /^RMSE /.test(p.textContent.trim()),
          )
        )
          return 'done';
        const button = document.querySelector('[data-confirm-reference]');
        return button && !button.disabled ? 'ready' : false;
      },
      undefined,
      { timeout: 30000 },
    );
    if ((await status.jsonValue()) === 'done') {
      assert.equal(confirmed, 38);
      return;
    }
    if (!confirmed && verifyWait) {
      const position = await page.locator('.target').getAttribute('style');
      await page.waitForTimeout(2500);
      assert.equal(
        await page.locator('.target').getAttribute('style'),
        position,
        'The target must not advance without explicit confirmation.',
      );
    }
    if (!confirmed) await page.locator('[data-confirm-reference]').click();
    else await page.keyboard.press(confirmed % 2 ? 'Space' : 'Enter');
    confirmed++;
    await page.waitForFunction(
      () => !document.querySelector('[data-confirm-reference]'),
      undefined,
      { timeout: 5000 },
    );
  }
  throw new Error('The confirmed sweep did not finish in the test deadline.');
}
