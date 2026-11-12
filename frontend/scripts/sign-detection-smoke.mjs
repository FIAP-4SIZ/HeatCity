import { chromium } from 'playwright';
import assert from 'node:assert/strict';
const base = process.env.HEATCITY_BASE_URL || 'http://127.0.0.1:5173';
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--no-sandbox', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
});
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const restart = () =>
    page.getByRole('button', { name: 'Começar outra análise (limpa o resultado atual)' }).click();
  async function download(name) {
    const wait = page.waitForEvent('download');
    await page.getByRole('button', { name, exact: true }).click();
    const file = await wait;
    const stream = await file.createReadStream();
    const chunks = [];
    for await (const c of stream) chunks.push(c);
    return Buffer.concat(chunks);
  }
  async function custom(id) {
    await page.getByRole('button', { name: 'Começar com meu vídeo' }).click();
    await page.getByLabel('Foto cadastrada').selectOption(id);
  }
  await page.goto(base);
  await page.getByRole('button', { name: 'Ver exemplo funcionando' }).waitFor();
  assert.equal(await page.locator('.start-card').count(), 2);
  assert.equal(await page.getByLabel('Foto cadastrada').count(), 0);
  await page.screenshot({ path: '/tmp/heatcity-simple-home.png', fullPage: true });
  await page.getByRole('button', { name: 'Ver exemplo funcionando' }).click();
  await page.locator('.detector-frame').waitFor();
  await page.getByRole('button', { name: 'Pausar análise' }).waitFor();
  assert.equal(await page.locator('.analysis-report').count(), 0);
  await page
    .getByRole('heading', { name: 'Relatório da análise', exact: true })
    .waitFor({ timeout: 30000 });
  await page.getByText('Acerto medido em um exemplo sintético.', { exact: true }).waitFor();
  assert.equal(await page.locator('.report-plate').count(), 4);
  const data = JSON.parse((await download('Baixar diagnóstico JSON')).toString());
  assert.ok(data.frames.length >= 8);
  assert.ok(data.summary.annotations > 0);
  assert.ok(data.summary.signs.some((s) => s.detectedSeconds > 0));
  assert.ok(data.frames.some((f) => f.signs.some((s) => s.status === 'not_found')));
  assert.ok(data.frames.every((f) => !f.image));
  assert.equal((await download('Baixar relatório PDF')).subarray(0, 5).toString(), '%PDF-');
  assert.match((await download('Baixar CSV')).toString(), /tempo_s/);
  await page.screenshot({ path: '/tmp/heatcity-simple-report.png', fullPage: true });
  await page.getByRole('button', { name: /Tema escuro/ }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  await page.getByRole('button', { name: 'Voltar ao vídeo' }).click();
  await page.getByRole('button', { name: 'Marcar placa ausente' }).click();
  await page.getByRole('button', { name: 'Calcular acerto deste quadro' }).click();
  await page.getByText('Acerto calculado somente para as placas anotadas neste quadro.').waitFor();
  await page.getByRole('button', { name: 'Ver relatório atualizado →' }).click();
  await restart();
  await custom(data.reference.id);
  await page
    .getByLabel('Selecionar vídeo e analisar')
    .setInputFiles(new URL('../public/detection-demo.mp4', import.meta.url).pathname);
  await page.locator('.detector-frame').waitFor();
  await page.getByRole('button', { name: 'Pausar análise' }).click();
  await page.getByRole('button', { name: 'Terminar e ver relatório' }).click();
  await page.getByText('Precisão ainda não medida.', { exact: true }).waitFor();
  const unannotated = JSON.parse((await download('Baixar diagnóstico JSON')).toString());
  assert.equal(unannotated.summary.annotations, 0);
  assert.equal(unannotated.summary.precision, null);
  await page.getByRole('button', { name: 'Voltar ao vídeo' }).click();
  await page.getByRole('button', { name: 'Marcar posição real' }).click();
  const canvas = page.locator('.detector-frame .scene-image');
  await canvas.scrollIntoViewIfNeeded();
  const r = await canvas.boundingBox();
  await page.mouse.move(r.x + r.width * 0.29, r.y + r.height * 0.29);
  await page.mouse.down();
  await page.mouse.move(r.x + r.width * 0.4, r.y + r.height * 0.34);
  await page.mouse.up();
  await page.getByRole('button', { name: 'Calcular acerto deste quadro' }).click();
  await page.getByText('Acerto calculado somente para as placas anotadas neste quadro.').waitFor();
  await page.getByRole('button', { name: 'Ver relatório atualizado →' }).click();
  await page.getByText('Acerto medido apenas nos quadros conferidos.', { exact: true }).waitFor();
  await restart();
  await custom(data.reference.id);
  await page.context().grantPermissions(['camera']);
  await page.locator('.webcam-option > summary').click();
  await page.getByRole('button', { name: 'Analisar webcam' }).click();
  await page.locator('.detector-frame').waitFor();
  await page.evaluate(() => {
    window.testCameraStream = document.querySelector('video').srcObject;
  });
  await page.getByRole('button', { name: 'Fechar fonte' }).click();
  assert.ok(
    await page.evaluate(() =>
      window.testCameraStream.getTracks().every((t) => t.readyState === 'ended'),
    ),
  );
  assert.deepEqual(errors, []);
  console.log(
    `PASS: exemplo em um clique, análise automática, relatório com ${data.frames.length} quadros, PDF/JSON/CSV, vídeo próprio sem acerto inventado, conferência manual, webcam e celular.`,
  );
} finally {
  await browser.close();
}
