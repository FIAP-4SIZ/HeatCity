import { chromium } from 'playwright';
import assert from 'node:assert/strict';
const base = process.env.HEATCITY_BASE_URL || 'http://127.0.0.1:5173';
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--no-sandbox'],
});
let savedId;
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(base);
  await page.getByRole('button', { name: 'Começar com meu vídeo' }).click();
  await page.getByRole('button', { name: 'Cadastrar foto' }).click();
  await page.getByLabel('Nome da foto').fill('Entrada — teste de interface');
  await page
    .getByLabel('Foto do ambiente')
    .setInputFiles(
      new URL('../../backend/heatcity/fixtures/hospital.jpg', import.meta.url).pathname,
    );
  await page.getByLabel('Nome da placa').fill('Entrada');
  const canvas = page.locator('.reference-editor .scene-image');
  await canvas.scrollIntoViewIfNeeded();
  const rect = await canvas.boundingBox();
  await page.mouse.move(rect.x + rect.width * 0.1, rect.y + rect.height * 0.25);
  await page.mouse.down();
  await page.mouse.move(rect.x + rect.width * 0.3, rect.y + rect.height * 0.32);
  await page.mouse.up();
  const response = page.waitForResponse(
    (r) => r.request().method() === 'POST' && /\/projects\/[^/]+\/references$/.test(r.url()),
  );
  await page.getByRole('button', { name: 'Salvar foto e placas' }).click();
  savedId = (await (await response).json()).id;
  await page.waitForFunction((id) => document.querySelector('select')?.value === id, savedId);
  await page.screenshot({ path: '/tmp/heatcity-simple-custom.png', fullPage: true });
  await page
    .getByLabel('Selecionar vídeo e analisar')
    .setInputFiles(new URL('../public/detection-demo.mp4', import.meta.url).pathname);
  await page.locator('.detector-frame').waitFor();
  await page.getByRole('button', { name: 'Pausar análise' }).click();
  await page.getByRole('button', { name: 'Terminar e ver relatório' }).click();
  await page.getByText('Precisão ainda não medida.', { exact: true }).waitFor();
  await page.getByRole('link', { name: 'Minhas fotos', exact: false }).click();
  await page.getByRole('heading', { name: 'Entrada — teste de interface' }).waitFor();
  const card = page
    .locator('.reference-card')
    .filter({ has: page.getByRole('heading', { name: 'Entrada — teste de interface' }) });
  assert.equal(await page.locator('.reference-card').count(), 2);
  await card.getByRole('link', { name: 'Ver processamento da imagem' }).click();
  await page.getByRole('heading', { name: /Histograma · Entrada/ }).waitFor();
  assert.equal(await page.locator('.pdi-histogram rect').count(), 32);
  await page.getByLabel('Ver cena em cinza').check();
  await page.getByRole('link', { name: 'Minhas fotos', exact: false }).click();
  await page.getByRole('heading', { name: 'Entrada — teste de interface' }).waitFor();
  await card.getByRole('link', { name: 'Usar esta foto →' }).click();
  await page.waitForFunction((id) => document.querySelector('select')?.value === id, savedId);
  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  assert.deepEqual(errors, []);
  console.log(
    'PASS: cadastro de foto dentro do fluxo, seleção automática da foto salva, vídeo próprio inicia sozinho, relatório sem acerto inventado, catálogo com uma foto do exemplo, PDI correto e celular.',
  );
} finally {
  if (savedId) await fetch(`${base}/api/references/${savedId}`, { method: 'DELETE' });
  await browser.close();
}
