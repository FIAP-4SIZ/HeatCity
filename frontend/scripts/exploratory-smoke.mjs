import { chromium } from 'playwright';
import { installTestCamera } from './test-camera.mjs';
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
  const study = await (
    await page.request.post(`${base}/api/studies`, {
      data: {
        title: 'Teste técnico exploratório',
        objective: 'Verificar software com dados sintéticos, sem resultados humanos.',
      },
    })
  ).json();
  id = study.id;
  const scene = await (await page.request.get(`${base}/api/scene-example`)).json();
  await page.request.post(`${base}/api/studies/${id}/scenarios`, { data: scene });
  await page.goto(`${base}/#/studies/${id}/explore`);
  await page.getByLabel('Código do participante').fill('DEMO01');
  await page.getByRole('checkbox').check();
  const targets = [0.05, 0.5, 0.95].flatMap((y) => [0.05, 0.5, 0.95].map((x) => [x, y]));
  const held = [
    [0.2, 0.2],
    [0.8, 0.2],
    [0.5, 0.5],
    [0.2, 0.8],
    [0.8, 0.8],
  ];
  const feature = ([x, y]) => [0.3 + 0.2 * x, 0.1 * (y - 0.5)];
  await page.getByLabel('Importar diagnóstico para demonstração').setInputFiles({
    name: 'sintetico-reprovado.json',
    mimeType: 'application/json',
    buffer: Buffer.from(
      JSON.stringify({
        mode: 'sweep',
        detector: 'face-mesh-legacy',
        quality: { basis: 'mesh' },
        features: targets.map(feature),
        targets,
        validation_features: held.map((p) => {
          const f = feature(p);
          f[0] += 0.06;
          return f;
        }),
        validation_targets: held,
      }),
    ),
  });
  await page.getByText(/Calibração reprovada · fonte/).waitFor();
  await page.route('**/mediapipe/face_landmarker.task', (r) =>
    r.fulfill({ status: 404, body: '' }),
  );
  await page.evaluate(() => {
    window.FaceMesh = class {
      setOptions() {}
      onResults(fn) {
        this.fn = fn;
      }
      close() {}
      async send() {
        const f = Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5 }));
        for (const [a, b, u, l, i] of [
          [33, 133, 159, 145, 468],
          [362, 263, 386, 374, 473],
        ]) {
          f[a] = { x: 0.2, y: 0.5 };
          f[b] = { x: 0.4, y: 0.5 };
          f[u] = { x: 0.3, y: 0.47 };
          f[l] = { x: 0.3, y: 0.53 };
          f[i] = { x: 0.28, y: 0.5 };
        }
        this.fn({ multiFaceLandmarks: [f] });
      }
    };
  });
  await page.getByRole('button', { name: 'Continuar para o teste de 15 s', exact: true }).click();
  await page.getByText('ENSAIO EXPLORATÓRIO · NÃO VALIDADO', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Iniciar sessão em tela cheia', exact: true }).click();
  await page
    .getByRole('heading', { name: 'Densidade de estimativas para demonstração', exact: true })
    .waitFor({ timeout: 40000 });
  const data = await (await page.request.get(`${base}/api/studies/${id}/results`)).json();
  assert.equal(data.sessions.length, 1);
  const session = data.sessions[0];
  assert.equal(session.mode, 'exploratory');
  assert.equal(session.calibration.approved, false);
  assert.equal(session.calibration.source, 'imported_diagnostic');
  assert.equal(session.metrics.success, null);
  assert.equal(session.metrics.eligible, false);
  assert.ok(session.metrics.valid_samples > 0);
  assert.equal(data.summary.exploratory_sessions, 1);
  assert.deepEqual(data.summary.selected_session_ids, []);
  assert.ok(data.summary.rows.every((r) => r.participants === 0 && r.success_rate === null));
  const heat = await page.request.get(
    `${base}/api/scenarios/${session.scenario_id}/heatmap?mode=exploratory&session_id=${session.id}`,
  );
  assert.equal((await heat.body()).subarray(1, 4).toString(), 'PNG');
  const pdf = await page.request.get(`${base}/api/studies/${id}/report.pdf`);
  assert.equal((await pdf.body()).subarray(0, 5).toString(), '%PDF-');
  await page.screenshot({ path: '/tmp/heatcity-exploratory.png', fullPage: true });
  assert.deepEqual(errors, []);
  console.log(
    'PASS: import rejected geometry, record real video-loop estimates, show exploratory heatmap, export PDF, and keep official denominators empty. Synthetic software test.',
  );
} finally {
  if (id) await page.request.delete(`${base}/api/studies/${id}`).catch(() => {});
  await browser.close();
}
