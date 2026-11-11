import { chromium } from 'playwright';
import { installTestCamera } from './test-camera.mjs';
import { readFile } from 'node:fs/promises';
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
await installTestCamera(page);
let id;
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
try {
  await page.goto(`${base}/#/diagnostics`);
  // Importing partial data must work without any RMSE or camera permission prompt.
  const partial = {
    status: 'failed',
    capture_details: [0, 1].map((x) => ({
      phase: 'reference',
      target: [x, 0.5],
      samples: Array.from({ length: 12 }, (_, i) => [
        0.3 + x * 0.2 + i * 0.0001,
        0.1,
        0.3 + x * 0.2 + i * 0.0001,
        0.1,
      ]),
    })),
  };
  await page.getByLabel('Importar diagnósticos').setInputFiles(
    process.env.HEATCITY_DIAGNOSTIC_FILE || {
      name: 'partial.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(partial)),
    },
  );
  await page.locator('.signal-report').first().waitFor();
  assert.ok((await page.locator('.signal-report').count()) >= 1);
  await page.locator('.signal-report select').first().selectOption('eye0');
  await page.screenshot({ path: '/tmp/heatcity-ocular-signals.png', fullPage: true });
  const study = await (
    await page.request.post(`${base}/api/studies`, {
      data: {
        title: 'Sinal ocular: teste de software',
        objective: 'Conferir o histórico oficial sem dados humanos reais.',
      },
    })
  ).json();
  id = study.id;
  const scene = await (await page.request.get(`${base}/api/scene-example`)).json();
  await page.request.post(`${base}/api/studies/${id}/scenarios`, { data: scene });
  await page.goto(`${base}/#/studies/${id}/prepare`);
  await page.getByLabel('Código do participante').fill('TESTE01');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Calibrar olhar', exact: true }).click();
  await page.route('**/mediapipe/face_landmarker.task', (route) =>
    route.fulfill({ status: 404, body: '' }),
  );
  await page.route('**/api/diagnostics/geometry', (route) =>
    route.fulfill({
      json: {
        valid: false,
        message: 'Falha geométrica sintética para testar exportação.',
        reference_indices: [0, 1],
      },
    }),
  );
  await page.evaluate(() => {
    window.FaceMesh = class {
      setOptions() {}
      onResults(fn) {
        this.fn = fn;
      }
      close() {}
      async send() {
        const target = document.querySelector('.target');
        const x = target ? parseFloat(target.style.left) / 100 : 0.5,
          y = target ? parseFloat(target.style.top) / 100 : 0.5;
        const face = Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5 }));
        for (const [a, b, u, l, i] of [
          [33, 133, 159, 145, 468],
          [362, 263, 386, 374, 473],
        ]) {
          face[a] = { x: 0.2, y: 0.5 };
          face[b] = { x: 0.4, y: 0.5 };
          face[u] = { x: 0.3, y: 0.47 };
          face[l] = { x: 0.3, y: 0.53 };
          face[i] = { x: 0.2 + 0.2 * (0.3 + 0.2 * x), y: 0.5 + 0.02 * (y - 0.5) };
        }
        this.fn({ multiFaceLandmarks: [face] });
      }
    };
  });
  await page.getByRole('checkbox', { name: /Concordo com o uso da câmera/ }).check();
  await page.getByRole('button', { name: 'Ativar câmera', exact: true }).click();
  for (let attempt = 1; attempt <= 2; attempt++) {
    await page.getByRole('button', { name: 'Iniciar calibração', exact: true }).click();
    await page
      .locator('.fullscreen-panel strong')
      .filter({ hasText: /Coleta interrompida na linha 1/ })
      .waitFor({ timeout: 90000 });
    await page.waitForFunction(() => !document.fullscreenElement);
    await page
      .getByRole('button', {
        name: new RegExp(`Baixar todas as calibrações deste teste \\(${attempt}\\)`),
      })
      .waitFor();
  }
  assert.ok((await page.locator('.signal-report').count()) > 0);
  assert.ok(
    await page.getByRole('button', { name: 'Usar calibração no estudo', exact: true }).isDisabled(),
  );
  await page.getByRole('button', { name: 'Voltar', exact: true }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: /Baixar todas as calibrações deste teste/ }).click();
  const file = await download;
  const archive = JSON.parse(await readFile(await file.path(), 'utf8'));
  assert.equal(archive.attempts_total, 2);
  assert.ok(
    archive.page_diagnostic.calibrations.every(
      (c) => c.status === 'failed' && c.signal_analysis.references.length === 5,
    ),
  );
  assert.ok(
    archive.page_diagnostic.calibrations.every((c) =>
      c.capture_details.every((d) => d.sample_timing.length === d.samples.length),
    ),
  );
  assert.equal(
    (await (await page.request.get(`${base}/api/studies/${id}/results`)).json()).sessions.length,
    0,
  );
  assert.deepEqual(errors, []);
  console.log(
    'PASS: partial diagnostic import, per-eye plots, two failed official attempts, combined download after returning, timing and signal analysis preserved, official gate remains closed. Synthetic software test.',
  );
} finally {
  if (id) await page.request.delete(`${base}/api/studies/${id}`);
  await browser.close();
}
