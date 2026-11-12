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
  const ready = () =>
    page.waitForFunction(
      () =>
        ![...document.querySelectorAll('button')].find((b) => b.textContent === 'Iniciar análise')
          ?.disabled,
    );
  const restart = () =>
    page.getByRole('button', { name: 'Começar outra análise (limpa o resultado atual)' }).click();
  async function download(name) {
    const wait = page.waitForEvent('download');
    await page.getByRole('button', { name, exact: true }).click();
    const item = await wait;
    const stream = await item.createReadStream();
    const chunks = [];
    for await (const part of stream) chunks.push(part);
    return Buffer.concat(chunks);
  }
  await page.goto(base);
  await page.getByRole('heading', { name: 'Onde a placa aparece?' }).waitFor();
  await page.locator('.plate-crops figure').first().waitFor();
  assert.equal(await page.locator('.plate-crops figure').count(), 4);
  assert.equal(await page.locator('.analysis-report').count(), 0);
  assert.equal(await page.locator('.detector-controls details').getAttribute('open'), null);
  await page.screenshot({ path: '/tmp/heatcity-guided-prepare.png', fullPage: true });
  await page.getByRole('button', { name: 'Abrir vídeo demonstrativo' }).click();
  await ready();
  assert.match(
    await page.locator('.analysis-steps [aria-current]').innerText(),
    /Analisar o vídeo/,
  );
  await page.getByRole('button', { name: 'Iniciar análise', exact: true }).click();
  await page.locator('.detector-box').first().waitFor();
  assert.equal(await page.locator('.analysis-report').count(), 0);
  await page
    .getByRole('heading', { name: 'Relatório da análise', exact: true })
    .waitFor({ timeout: 30000 });
  assert.match(await page.locator('.analysis-steps [aria-current]').innerText(), /Ver o relatório/);
  assert.equal(await page.locator('.detector-workspace').isVisible(), false);
  await page.getByText('Acerto medido em um exemplo sintético.', { exact: true }).waitFor();
  assert.equal(await page.locator('.report-plate[open]').count(), 1);
  assert.equal(await page.locator('.report-plate').count(), 4);
  const data = JSON.parse((await download('Baixar diagnóstico JSON')).toString());
  assert.ok(data.frames.length >= 8);
  assert.ok(data.summary.annotations > 0);
  assert.ok(data.summary.signs.some((s) => s.detectedSeconds > 0));
  assert.ok(data.frames.some((f) => f.signs.some((s) => s.status === 'not_found')));
  assert.ok(data.frames.every((f) => !f.image));
  assert.equal((await download('Baixar relatório PDF')).subarray(0, 5).toString(), '%PDF-');
  assert.match((await download('Baixar CSV')).toString(), /tempo_s/);
  await page.screenshot({ path: '/tmp/heatcity-guided-report.png', fullPage: true });
  await page.getByRole('button', { name: /Tema escuro/ }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  await page.screenshot({ path: '/tmp/heatcity-guided-mobile.png', fullPage: true });
  await page.getByRole('button', { name: 'Voltar ao vídeo' }).click();
  await page.getByRole('button', { name: 'Marcar placa ausente' }).click();
  await page.getByRole('button', { name: 'Calcular acerto deste quadro' }).click();
  await page.getByText('Acerto calculado somente para as placas anotadas neste quadro.').waitFor();
  await page.getByRole('button', { name: 'Ver relatório atualizado →' }).click();
  await restart();
  await page
    .getByLabel('Abrir meu vídeo')
    .setInputFiles(new URL('../public/detection-demo.mp4', import.meta.url).pathname);
  await ready();
  await page.getByRole('button', { name: 'Analisar quadro atual' }).click();
  await page.locator('.detector-frame').waitFor();
  await page.getByRole('button', { name: 'Concluir análise e ver relatório →' }).click();
  await page.getByText('Precisão ainda não medida.', { exact: true }).waitFor();
  const unannotated = JSON.parse((await download('Baixar diagnóstico JSON')).toString());
  assert.equal(unannotated.summary.annotations, 0);
  assert.equal(unannotated.summary.precision, null);
  await page.getByRole('button', { name: 'Voltar ao vídeo' }).click();
  await page.getByRole('button', { name: 'Marcar posição real' }).click();
  const canvas = page.locator('.detector-frame .scene-image');
  await canvas.scrollIntoViewIfNeeded();
  const box = await canvas.boundingBox();
  await page.mouse.move(box.x + box.width * 0.29, box.y + box.height * 0.29);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.4, box.y + box.height * 0.34);
  await page.mouse.up();
  await page.getByRole('button', { name: 'Calcular acerto deste quadro' }).click();
  await page.getByText('Acerto calculado somente para as placas anotadas neste quadro.').waitFor();
  await page.getByRole('button', { name: 'Ver relatório atualizado →' }).click();
  await page.getByText('Acerto medido apenas nos quadros conferidos.', { exact: true }).waitFor();
  await restart();
  await page.context().grantPermissions(['camera']);
  await page.getByRole('button', { name: 'Abrir webcam' }).click();
  await ready();
  await page.getByRole('button', { name: 'Iniciar análise', exact: true }).click();
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
    `PASS: 3 etapas, 4 recortes, relatório automático, ${data.frames.length} quadros, PDF/JSON/CSV, distinção entre acerto sintético e não medido, conferência manual, webcam e celular.`,
  );
} finally {
  await browser.close();
}
