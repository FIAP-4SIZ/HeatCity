import { installTestCamera } from './test-camera.mjs';
import { waitForAutomaticSweep } from './automatic-sweep.mjs';
import { readFile } from 'node:fs/promises';
// Software-only E2E: real WASM/no-face gate, then synthetic landmarks. No human accuracy claims.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
async function checkContrast(page) {
  // Inspect settled theme colors rather than the intermediate background transition.
  await page.evaluate(async () => {
    getComputedStyle(document.body).backgroundColor;
    await Promise.all(
      document
        .getAnimations()
        .filter((a) => Number.isFinite(a.effect.getComputedTiming().endTime))
        .map((a) => a.finished.catch(() => {})),
    );
  });
  const ratios = await page.evaluate(() => {
    const light = (color) => {
      const values = color
        .match(/[\d.]+/g)
        .slice(0, 3)
        .map((v) => {
          const x = Number(v) / 255;
          return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
        });
      return values[0] * 0.2126 + values[1] * 0.7152 + values[2] * 0.0722;
    };
    return [
      ['.page-title h1', 'body'],
      ['.page-title p:last-child', 'body'],
      ['.sidebar-caption', '.app-sidebar'],
      ['.app-sidebar nav a.active', '.app-sidebar nav a.active'],
      ['.primary', '.primary'],
    ].map(([a, b]) => {
      const x = light(getComputedStyle(document.querySelector(a)).color),
        y = light(getComputedStyle(document.querySelector(b)).backgroundColor);
      return { name: a, ratio: (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05) };
    });
  });
  for (const item of ratios) assert.ok(item.ratio >= 4.5, `${item.name}: contraste ${item.ratio}`);
}
const base = process.env.HEATCITY_BASE_URL || 'http://127.0.0.1:5173';
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: [
    '--no-sandbox',
    '--use-fake-ui-for-media-stream',
    '--use-fake-device-for-media-stream',
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
  ],
});
const page = await browser.newPage({
  viewport: { width: 1440, height: 1080 },
  permissions: ['camera'],
});
await installTestCamera(page);
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
let studyId;
try {
  await page.goto(base);
  await page.getByRole('heading', { name: /Cidades mais claras/ }).waitFor();
  assert.equal(await page.locator('html').getAttribute('data-theme'), 'light');
  await checkContrast(page);
  await page.getByRole('button', { name: /Tema escuro/ }).click();
  await page.reload();
  await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark');
  await checkContrast(page);
  await page.getByRole('button', { name: /Tema claro/ }).click();
  await page.getByRole('button', { name: '+ Criar estudo', exact: true }).click();
  await page.getByLabel('Título', { exact: true }).fill('Estudo automatizado de sinalização');
  await page
    .getByLabel('Objetivo da avaliação')
    .fill('Validar o fluxo do MVP com landmarks sintéticos identificados como teste.');
  await page.getByRole('button', { name: 'Criar estudo', exact: true }).click();
  await page
    .getByRole('heading', { name: 'Estudo automatizado de sinalização', exact: true })
    .waitFor();
  studyId = new URL(page.url()).hash.split('/')[2];
  await page.screenshot({ path: '/tmp/heatcity-mvp-overview.png', fullPage: true });
  await page.getByRole('link', { name: 'Cenários e placas', exact: true }).click();
  await page.getByRole('button', { name: '+ Novo cenário', exact: true }).click();
  await page.getByRole('button', { name: 'Usar cena didática', exact: true }).click();
  await page.getByLabel('Próxima placa').fill('Teste de delimitação');
  const editor = page.locator('.scene-image.editing');
  await editor.scrollIntoViewIfNeeded();
  const bounds = await editor.boundingBox();
  await page.mouse.move(bounds.x + bounds.width * 0.77, bounds.y + bounds.height * 0.8);
  await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width * 0.98, bounds.y + bounds.height * 0.98, {
    steps: 8,
  });
  await page.mouse.up();
  await page.getByRole('button', { name: 'Remover Teste de delimitação', exact: true }).click();
  await page.getByRole('button', { name: 'Salvar cenário e áreas', exact: true }).click();
  await page.getByRole('heading', { name: 'Cenário didático A', exact: true }).waitFor();
  await page.reload();
  await page.getByRole('heading', { name: 'Cenário didático A', exact: true }).waitFor();
  await page.getByRole('link', { name: 'Nova sessão', exact: true }).click();
  await page.getByLabel('Código do participante').fill('E2E01');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Calibrar olhar', exact: true }).click();
  await page.getByRole('button', { name: 'Ativar câmera', exact: true }).waitFor();
  // Camera in the calibration module has its own explicit consent.
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Ativar câmera', exact: true }).click();
  await page
    .getByRole('button', { name: 'Desligar câmera', exact: true })
    .waitFor({ timeout: 60000 });
  await page.waitForTimeout(1800);
  assert.equal(
    await page.getByRole('button', { name: 'Iniciar calibração', exact: true }).isDisabled(),
    true,
  );
  console.log(
    'PASS: studies/scenarios persist; real MediaPipe and synthetic no-face video keep calibration blocked.',
  );
  await page.getByRole('checkbox').uncheck();
  await page.getByRole('button', { name: 'Voltar', exact: true }).click();
  await page.getByRole('button', { name: 'Calibrar olhar', exact: true }).click();
  await page.route('**/mediapipe/face_landmarker.task', (route) =>
    route.fulfill({ status: 404, body: '' }),
  );
  await page.evaluate(() => {
    window.FaceMesh = class {
      setOptions() {}
      onResults(fn) {
        this.callback = fn;
      }
      close() {}
      async send() {
        const target = document.querySelector('.target');
        const x = target ? parseFloat(target.style.left) / 100 : (window.mockGaze?.[0] ?? 0.5);
        const y = target ? parseFloat(target.style.top) / 100 : (window.mockGaze?.[1] ?? 0.5);
        const points = Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5 }));
        for (const [a, b, u, l, i] of [
          [33, 133, 159, 145, 468],
          [362, 263, 386, 374, 473],
        ]) {
          points[a] = { x: 0.2, y: 0.5 };
          points[b] = { x: 0.4, y: 0.5 };
          points[u] = { x: 0.3, y: 0.47 };
          points[l] = { x: 0.3, y: 0.53 };
          points[i] = { x: 0.2 + 0.2 * (0.3 + 0.2 * x), y: 0.5 + 0.02 * (y - 0.5) };
          if (window.mockBlink) points[l] = points[u];
        }
        this.callback({ multiFaceLandmarks: [points] });
      }
    };
  });
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Ativar câmera', exact: true }).click();
  await page.getByRole('button', { name: 'Iniciar calibração', exact: true }).click();
  await page.getByRole('timer').filter({ hasText: '3' }).waitFor();
  assert.equal(await page.locator('.target').count(), 0);
  await waitForAutomaticSweep(page);
  await page
    .getByRole('button', { name: 'Usar calibração no estudo', exact: true })
    .waitFor({ state: 'visible', timeout: 90000 });
  await page.waitForFunction(
    () =>
      !Array.from(document.querySelectorAll('button')).find(
        (b) => b.textContent === 'Usar calibração no estudo',
      )?.disabled,
  );
  const diagnosticDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Baixar diagnóstico da calibração', exact: true }).click();
  const diagnosticFile = await diagnosticDownload;
  const diagnostic = JSON.parse(await readFile(await diagnosticFile.path(), 'utf8'));
  assert.equal(diagnostic.targets.length, 25);
  assert.equal(diagnostic.mode, 'sweep');
  assert.equal(diagnostic.quality.basis, 'mesh');
  assert.equal('coefficients' in diagnostic.quality, false);
  assert.equal(diagnostic.residuals.length, 13);
  assert.equal('calibration_id' in diagnostic.quality, false);
  await page.getByRole('button', { name: 'Usar calibração no estudo', exact: true }).click();
  await page.getByRole('button', { name: 'Continuar para o teste de 15 s', exact: true }).click();
  await page.getByRole('button', { name: 'Iniciar sessão em tela cheia', exact: true }).click();
  await page.waitForFunction(() => document.fullscreenElement?.classList.contains('run-session'));
  await page.waitForFunction(() => document.querySelector('.run-image'));
  await page.evaluate(() => {
    const r = document.querySelector('.run-image').getBoundingClientRect();
    window.mockGaze = [
      (r.left + r.width * 0.22) / innerWidth,
      (r.top + r.height * 0.32) / innerHeight,
    ];
  });
  await page.waitForTimeout(6000);
  await page.evaluate(() => {
    window.mockBlink = true;
  });
  await page.waitForTimeout(250);
  await page.evaluate(() => {
    window.mockBlink = false;
  });
  await page
    .getByRole('heading', { name: 'Resultados com rastreabilidade.', exact: true })
    .waitFor({ timeout: 35000 });
  const response = await page.request.get(`${base}/api/studies/${studyId}/results`);
  const data = await response.json();
  assert.equal(data.sessions.length, 1);
  assert.equal(data.sessions[0].mode, 'gaze');
  assert.equal(data.sessions[0].status, 'completed');
  assert.equal(data.sessions[0].metrics.eligible, true);
  assert.ok(data.sessions[0].points.length >= 30);
  assert.equal(data.sessions[0].metrics.success, true);
  assert.equal(data.sessions[0].calibration.uncertainty.policy, 'observed_envelope_v1');
  assert.ok(data.sessions[0].stimulus_width > 0);
  assert.ok(data.sessions[0].capture_settings.width > 0);
  assert.ok(data.sessions[0].processing_stats.processed_frames > 0);
  assert.equal(data.sessions[0].metrics.outcome, 'observed');
  assert.ok(data.sessions[0].metrics.confirmed_samples >= 3);
  const pdf = await page.request.get(`${base}/api/studies/${studyId}/report.pdf`);
  assert.ok((await pdf.body()).subarray(0, 5).equals(Buffer.from('%PDF-')));
  const heatmap = await page.request.get(
    `${base}/api/scenarios/${data.study.scenarios[0].id}/heatmap?mode=gaze`,
  );
  assert.ok((await heatmap.body()).subarray(1, 4).equals(Buffer.from('PNG')));
  await page.screenshot({ path: '/tmp/heatcity-mvp-results.png', fullPage: true });
  await page.reload();
  await page
    .getByRole('heading', { name: 'Resultados com rastreabilidade.', exact: true })
    .waitFor();
  assert.deepEqual(errors, []);
  console.log(
    'PASS: moving sweep and geometric interpolation, participant-bound authorization, full gaze session, blink, persistence, heatmap and PDF. Synthetic test only.',
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForFunction(() => {
    const image = document.querySelector('img.heatmap');
    return image?.complete && image.naturalWidth > 0;
  });
  await page.screenshot({ path: '/tmp/heatcity-mvp-mobile.png', fullPage: true });
  assert.ok(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
    'Mobile page must not overflow horizontally.',
  );
} finally {
  if (studyId) await page.request.delete(`${base}/api/studies/${studyId}`).catch(() => {});
  await browser.close();
}
