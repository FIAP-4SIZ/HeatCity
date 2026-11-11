import { waitForAutomaticSweep } from './automatic-sweep.mjs';
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
const base = process.env.HEATCITY_BASE_URL || 'http://127.0.0.1:5173';
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--no-sandbox', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
});
const page = await browser.newPage({
  viewport: { width: 1440, height: 1080 },
  permissions: ['camera'],
});
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
try {
  // Synthetic-landmark scenarios explicitly use the legacy mock. Real Tasks is tested separately.
  await page.route('**/mediapipe/face_landmarker.task', (route) =>
    route.fulfill({ status: 404, body: '' }),
  );
  const before = await (await page.request.get(`${base}/api/studies`)).json();
  await page.goto(base);
  await page.getByRole('button', { name: 'Diagnósticos', exact: true }).click();
  await page.getByRole('heading', { name: 'Diagnóstico do olhar.', exact: true }).waitFor();
  assert.equal(await page.getByLabel('Código do participante').count(), 0);
  await page.getByLabel('Importar diagnósticos').setInputFiles({
    name: 'comparacao.json',
    mimeType: 'application/json',
    buffer: Buffer.from(
      JSON.stringify({
        mode: 'fixed',
        quality: { validation_rmse: 0.2 },
        features: [],
        residuals: [{ expected: [0.5, 0.5], estimated: [0.7, 0.5] }],
      }),
    ),
  });
  await page.getByRole('heading', { name: 'comparacao.json', exact: true }).waitFor();
  await page.getByLabel('Abertura mínima das pálpebras', { exact: true }).fill('0.08');
  await page.evaluate((approved) => {
    window.mockApproved = approved;
    window.FaceMesh = class {
      setOptions() {}
      onResults(fn) {
        this.fn = fn;
      }
      close() {}
      async send() {
        const target = document.querySelector('.target');
        const validation = document
          .querySelector('.fullscreen-panel strong')
          ?.textContent.startsWith('Conferência');
        const x = target ? parseFloat(target.style.left) / 100 : 0.5,
          y = target ? parseFloat(target.style.top) / 100 : 0.5;
        const face = Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5 }));
        for (const [a, b, u, l, i] of [
          [33, 133, 159, 145, 468],
          [362, 263, 386, 374, 473],
        ]) {
          face[a] = { x: 0.2, y: 0.5 };
          face[b] = { x: 0.4, y: 0.5 };
          face[u] = { x: 0.3, y: 0.495 };
          face[l] = { x: 0.3, y: 0.505 };
          face[i] = {
            x: 0.2 + 0.2 * (0.3 + 0.2 * x + (validation && !window.mockApproved ? 0.08 : 0)),
            y: 0.5 + 0.02 * (y - 0.5),
          };
          if (window.mockBlink) face[l] = face[u];
        }
        this.fn({ multiFaceLandmarks: [face] });
      }
    };
  }, !!process.env.HEATCITY_TEST_APPROVED);
  await page.getByRole('checkbox', { name: /Concordo com o uso da câmera/ }).check();
  await page.getByRole('button', { name: 'Ativar câmera', exact: true }).click();
  await page.getByLabel('Telemetria do detector').waitFor();
  assert.ok(
    await page
      .locator('.landmark-canvas')
      .evaluate((c) =>
        Array.from(c.getContext('2d').getImageData(0, 0, c.width, c.height).data).some(
          (v, i) => i % 4 === 3 && v > 0,
        ),
      ),
  );
  await page.getByRole('button', { name: 'Iniciar calibração', exact: true }).click();
  await page.getByRole('timer').filter({ hasText: '3' }).waitFor();
  await waitForAutomaticSweep(page, { verifyWait: !!process.env.HEATCITY_TEST_APPROVED });
  await page
    .locator('.fullscreen-panel p')
    .filter({ hasText: /^RMSE / })
    .waitFor({ timeout: process.env.HEATCITY_TEST_PRECISION ? 150000 : 90000 });
  assert.ok(
    await page
      .locator('.fullscreen-panel p')
      .filter({ hasText: process.env.HEATCITY_TEST_APPROVED ? 'Aprovada' : 'Reprovada' })
      .count(),
  );
  {
    const waiting = page.waitForEvent('download');
    await page
      .getByRole('button', { name: 'Baixar diagnóstico da calibração', exact: true })
      .click();
    const file = await waiting;
    const data = JSON.parse(await readFile(await file.path(), 'utf8'));
    assert.equal(data.mode, 'sweep');
    assert.equal(data.features.length, 25);
    assert.equal(data.validation_features.length, 13);
    assert.equal(data.capture_details.length, 38);
    assert.equal(data.features[0].length, 2);
    assert.equal(data.quality.basis, 'mesh');
    assert.equal(data.confirmation_required, false);
    assert.equal(data.automatic_advance, true);
    assert.ok(data.capture_details.every((c) => c.accepted_by === 'automatic_stability'));
    assert.ok(data.capture_details.every((c) => c.stability.eye_p90 <= 0.035));
    assert.equal('coefficients' in data.quality, false);
    assert.equal(data.validation_samples.length, 13);
  }
  await page.getByRole('button', { name: 'Mostrar tracking experimental', exact: true }).click();
  await page.locator('.gaze').waitFor();
  // Let the 10 Hz diagnostic stream record the visible tracking state.
  await page.waitForTimeout(350);
  assert.ok(
    await page
      .getByText(
        process.env.HEATCITY_TEST_APPROVED
          ? /PRÉVIA DEV.*Conferência aprovada/
          : /PRÉVIA DEV.*CALIBRAÇÃO REPROVADA/,
      )
      .count(),
  );
  await page.evaluate(() => {
    window.mockBlink = true;
  });
  await page.waitForFunction(() => !document.querySelector('.gaze'));
  await page.waitForTimeout(250);
  await page.evaluate(() => {
    window.mockBlink = false;
  });
  await page.locator('.gaze').waitFor();
  // Let the 10 Hz diagnostic stream record the visible tracking state.
  await page.waitForTimeout(350);
  await page.evaluate(() => document.exitFullscreen());
  await page.getByRole('button', { name: 'Mostrar tracking experimental', exact: true }).waitFor();
  assert.equal(
    await page
      .getByRole('button', { name: 'Baixar diagnóstico da calibração', exact: true })
      .isVisible(),
    true,
  );
  const fullDownload = page.waitForEvent('download');
  await page
    .getByRole('button', { name: 'Baixar diagnóstico completo da página', exact: true })
    .click();
  const fullFile = await fullDownload;
  const fullData = JSON.parse(await readFile(await fullFile.path(), 'utf8'));
  assert.equal(fullData.page_diagnostic_version, 1);
  assert.equal(fullData.page_diagnostic.calibrations.length, 1);
  assert.ok(fullData.page_diagnostic.eye_profile.every((v) => v < 0.12));
  assert.ok(
    fullData.page_diagnostic.samples.some((s) => s.phase === 'tracking' && s.raw_prediction),
  );
  assert.ok(fullData.page_diagnostic.samples.some((s) => !s.accepted));
  assert.ok(fullData.page_diagnostic.events.some((s) => s.type === 'tracking_start'));
  assert.equal(fullData.quality.approved, !!process.env.HEATCITY_TEST_APPROVED);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: '/tmp/heatcity-diagnostics.png', fullPage: true });
  const after = await (await page.request.get(`${base}/api/studies`)).json();
  assert.deepEqual(after, before);
  assert.deepEqual(errors, []);
  console.log(
    'PASS: standalone diagnostics, local JSON comparison, DEV options, eye landmarks, complete page export, narrow eyelid profile, experimental tracking, blink and no study registration.',
  );
} finally {
  await browser.close();
}
