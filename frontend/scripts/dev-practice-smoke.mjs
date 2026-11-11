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
try {
  await page.goto(`${base}/#/diagnostics`);
  const before = await (await page.request.get(`${base}/api/studies`)).json();
  let source;
  if (process.env.HEATCITY_DIAGNOSTIC_FILE) {
    const data = JSON.parse(await readFile(process.env.HEATCITY_DIAGNOSTIC_FILE, 'utf8'));
    source = data.page_diagnostic.calibrations.filter((c) => c.quality?.basis === 'mesh').at(-1);
  } else {
    const grid = [0.05, 0.5, 0.95].flatMap((y) => [0.05, 0.5, 0.95].map((x) => [x, y]));
    const held = [
      [0.2, 0.2],
      [0.8, 0.2],
      [0.5, 0.5],
      [0.2, 0.8],
      [0.8, 0.8],
    ];
    source = {
      mode: 'sweep',
      detector: 'face-mesh-legacy',
      eye_geometry: 'legacy_v1',
      features: grid,
      targets: grid,
      validation_features: held,
      validation_targets: held,
      validation_samples: held.map((p) => Array(6).fill(p)),
      capture_details: grid.map((p) => ({
        phase: 'reference',
        target: p,
        samples: Array(6).fill([...p, ...p]),
      })),
    };
    source.quality = await (
      await page.request.post(`${base}/api/diagnostics/calibration`, { data: source })
    ).json();
  }
  // Force the mock engine and matching tag for this software-only experiment.
  source.detector = 'face-mesh-legacy';
  const center = source.features[source.targets.findIndex((p) => p[0] === 0.5 && p[1] === 0.5)];
  await page.route('**/mediapipe/face_landmarker.task', (r) =>
    r.fulfill({ status: 404, body: '' }),
  );
  await page.evaluate((pair) => {
    window.FaceMesh = class {
      setOptions() {}
      onResults(fn) {
        this.fn = fn;
      }
      close() {}
      async send() {
        const face = Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5 }));
        for (const [a, b, u, l, i] of [
          [33, 133, 159, 145, 468],
          [362, 263, 386, 374, 473],
        ]) {
          face[a] = { x: 0.2, y: 0.5 };
          face[b] = { x: 0.4, y: 0.5 };
          face[u] = { x: 0.3, y: 0.47 };
          face[l] = { x: 0.3, y: 0.53 };
          face[i] = { x: 0.2 + 0.2 * pair[0], y: 0.5 + 0.2 * pair[1] };
        }
        this.fn({ multiFaceLandmarks: [face] });
      }
    };
  }, center);
  await page.getByRole('checkbox', { name: /Concordo com o uso da câmera/ }).check();
  await page.getByRole('button', { name: 'Ativar câmera', exact: true }).click();
  await page
    .getByRole('checkbox', { name: 'Referência com mouse para prática e diagnóstico' })
    .check();
  await page.getByRole('button', { name: 'Mostrar tracking experimental', exact: true }).click();
  await page
    .getByRole('heading', { name: 'Olhos detectados, sem posição de olhar calibrada.' })
    .waitFor();
  assert.equal(await page.locator('.gaze').count(), 0);
  assert.ok(await page.locator('.camera-preview').isVisible());
  await page.getByRole('button', { name: 'Sair da prévia', exact: true }).click();
  await page.waitForFunction(() => !document.fullscreenElement);
  await page.getByLabel('Importar diagnósticos').setInputFiles({
    name: 'fixture.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(source)),
  });
  await page.getByRole('button', { name: 'Usar última malha do arquivo na prévia DEV' }).click();
  await page
    .locator('.fullscreen-panel strong')
    .filter({ hasText: /Malha importada apenas/ })
    .waitFor();
  await page.getByRole('button', { name: 'Mostrar tracking experimental', exact: true }).click();
  await page.locator('.gaze').waitFor({ timeout: 15000 });
  const bounds = await page.getByLabel('Campo visual branco', { exact: true }).boundingBox();
  await page.mouse.move(bounds.x + bounds.width * 0.5, bounds.y + bounds.height * 0.5);
  await page.getByLabel('Referência indicada pelo mouse').waitFor();
  await page.waitForTimeout(1200);
  const initial = await page.locator('.gaze').getAttribute('style');
  await page.mouse.move(bounds.x + bounds.width * 0.8, bounds.y + bounds.height * 0.2);
  await page.waitForTimeout(1200);
  assert.equal(
    await page.locator('.gaze').getAttribute('style'),
    initial,
    'Mouse does not move the gaze estimate',
  );
  await page.screenshot({ path: '/tmp/heatcity-dev-mouse-practice.png' });
  await page.getByRole('button', { name: 'Sair da prévia', exact: true }).click();
  await page.waitForFunction(() => !document.fullscreenElement);
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Baixar diagnóstico completo da página' }).click();
  const file = await download;
  const data = JSON.parse(await readFile(await file.path(), 'utf8'));
  assert.ok(
    data.page_diagnostic.samples.some(
      (s) => s.reference_source === 'mouse_declared' && s.declared_reference_distance !== null,
    ),
  );
  assert.ok(data.page_diagnostic.mouse_practice.samples > 0);
  assert.equal(data.page_diagnostic.calibrations.at(-1).eye_geometry, 'legacy_v1');
  assert.equal(
    (
      await page.request.post(`${base}/api/tracking/preview`, {
        data: { calibration_id: 'dev-mouse', consent: true },
      })
    ).status(),
    403,
  );
  assert.deepEqual(await (await page.request.get(`${base}/api/studies`)).json(), before);
  console.log(
    'PASS: preview before calibration, imported geometry, declared mouse reference independent of gaze, detailed export, no study/approval or training. Synthetic detector, optional real geometry.',
  );
} finally {
  await browser.close();
}
