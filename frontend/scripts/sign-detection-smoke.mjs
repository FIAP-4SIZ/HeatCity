import { chromium } from 'playwright';
import assert from 'node:assert/strict';
const base = process.env.HEATCITY_BASE_URL || 'http://127.0.0.1:5173';
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--no-sandbox', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
});
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1080 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(base);
  await page.getByRole('heading', { name: /Localização e acompanhamento/ }).waitFor();
  await page
    .getByLabel('Referência cadastrada')
    .locator('option')
    .first()
    .waitFor({ state: 'attached' });
  await page.getByRole('button', { name: 'Abrir vídeo demonstrativo' }).click();
  await page.getByRole('button', { name: 'Iniciar análise', exact: true }).waitFor();
  await page.waitForFunction(
    () =>
      ![...document.querySelectorAll('button')].find((b) => b.textContent === 'Iniciar análise')
        .disabled,
  );
  await page.getByRole('button', { name: 'Iniciar análise', exact: true }).click();
  await page.getByRole('heading', { name: 'Análise final: dificuldade e melhorias' }).waitFor();
  await page.waitForFunction(() =>
    document.querySelector('.detector-final')?.textContent.includes('anotações'),
  );
  await page.waitForFunction(() => document.querySelector('video').ended, { timeout: 30000 });
  assert.ok((await page.locator('.detector-box').count()) > 0);
  assert.match(await page.locator('.detector-final').innerText(), /Precisão por placa 1/);
  assert.equal(await page.getByText(/Sem referência geométrica automática/).count(), 0);
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Baixar diagnóstico JSON' }).click();
  const file = await download;
  const stream = await file.createReadStream();
  const chunks = [];
  for await (const c of stream) chunks.push(c);
  const data = JSON.parse(Buffer.concat(chunks).toString());
  assert.ok(data.frames.length >= 8);
  assert.ok(data.summary.annotations > 0);
  assert.ok(data.summary.signs.some((s) => s.detectedSeconds > 0));
  assert.ok(data.frames.some((f) => f.signs.some((s) => s.status === 'not_found')));
  assert.ok(data.frames.every((f) => !f.image));
  assert.equal(data.source.kind, 'demo');
  const pdfWait = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Baixar relatório PDF' }).click();
  const pdf = await pdfWait;
  const pdfStream = await pdf.createReadStream();
  const bytes = [];
  for await (const b of pdfStream) bytes.push(b);
  assert.equal(Buffer.concat(bytes).subarray(0, 5).toString(), '%PDF-');
  await page.getByRole('button', { name: 'Marcar placa ausente' }).click();
  await page.getByRole('button', { name: 'Calcular acerto deste quadro' }).click();
  await page.getByText('Acerto calculado somente para as placas anotadas neste quadro.').waitFor();
  await page.screenshot({ path: '/tmp/heatcity-sign-desktop.png', fullPage: true });
  await page.getByRole('button', { name: /Tema escuro/ }).click();
  await page.screenshot({ path: '/tmp/heatcity-sign-dark.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: '/tmp/heatcity-sign-mobile.png', fullPage: true });
  assert.ok(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
    'Sem overflow horizontal na página móvel',
  );
  const result = await (
    await page.request.get(`${base}/api/studies/hospital-orientacao-base-v1/results`)
  ).json();
  assert.equal(result.sessions.length, 0);
  await page.getByRole('button', { name: 'Fechar fonte' }).click();
  await page
    .getByLabel('Abrir meu vídeo')
    .setInputFiles(new URL('../public/detection-demo.mp4', import.meta.url).pathname);
  await page.waitForFunction(
    () =>
      ![...document.querySelectorAll('button')].find(
        (b) => b.textContent === 'Analisar quadro atual',
      )?.disabled,
  );
  await page.getByRole('button', { name: 'Analisar quadro atual' }).click();
  await page.getByRole('heading', { name: 'Análise final: dificuldade e melhorias' }).waitFor();
  await page.getByRole('button', { name: 'Marcar posição real' }).click();
  const canvas = page.locator('.detector-frame .scene-image');
  await canvas.scrollIntoViewIfNeeded();
  const rect = await canvas.boundingBox();
  await page.mouse.move(rect.x + rect.width * 0.29, rect.y + rect.height * 0.29);
  await page.mouse.down();
  await page.mouse.move(rect.x + rect.width * 0.4, rect.y + rect.height * 0.34);
  await page.mouse.up();
  await page.getByRole('button', { name: 'Calcular acerto deste quadro' }).click();
  await page.getByText('Acerto calculado somente para as placas anotadas neste quadro.').waitFor();
  await page.getByRole('button', { name: 'Fechar fonte' }).click();
  await page.context().grantPermissions(['camera']);
  await page.getByRole('button', { name: 'Abrir webcam' }).click();
  await page.waitForFunction(
    () =>
      ![...document.querySelectorAll('button')].find((b) => b.textContent === 'Iniciar análise')
        ?.disabled,
  );
  await page.getByRole('button', { name: 'Iniciar análise', exact: true }).click();
  await page.getByRole('heading', { name: 'Análise final: dificuldade e melhorias' }).waitFor();
  await page.evaluate(() => {
    window.testCameraStream = document.querySelector('video').srcObject;
  });
  await page.getByRole('button', { name: 'Fechar fonte' }).click();
  assert.ok(
    await page.evaluate(() =>
      window.testCameraStream.getTracks().every((track) => track.readyState === 'ended'),
    ),
  );
  assert.deepEqual(errors, []);
  console.log(
    `PASS: vídeo sintético, ${data.frames.length} quadros, métricas anotadas, tempos, falhas, análise final, PDF/JSON, anotação manual e layout móvel; sem sessões humanas.`,
  );
} finally {
  await browser.close();
}
