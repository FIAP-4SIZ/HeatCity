import { chromium } from 'playwright';
import assert from 'node:assert/strict';
const base = process.env.HEATCITY_BASE_URL || 'http://127.0.0.1:5173';
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--no-sandbox'],
});
let projectId;
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [],
    requests = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('request', (r) => requests.push(r.url()));
  await page.goto(`${base}/#/references/hospital-orientacao-base-v1`);
  await page.locator('.alternative-references > summary').waitFor();
  assert.equal(await page.locator('.reference-card:visible').count(), 1);
  assert.match(
    await page.locator('.reference-card:visible h2').innerText(),
    /placas do vídeo de exemplo/,
  );
  await page.locator('.alternative-references > summary').click();
  assert.equal(await page.locator('.reference-card:visible').count(), 2);
  await page.locator('.alternative-references > summary').click();
  await page.screenshot({ path: '/tmp/heatcity-hospital-one-reference.png', fullPage: true });
  await page.goto(`${base}/#/references`);
  await page.getByRole('heading', { name: 'As placas começam aqui.' }).waitFor();
  await page.getByRole('button', { name: '+ Novo projeto' }).click();
  await page.getByLabel('Título', { exact: true }).fill('Terminal — teste de software');
  await page
    .getByLabel('Objetivo', { exact: true })
    .fill('Localizar a placa de entrada no percurso do terminal.');
  await page.getByRole('button', { name: 'Criar projeto', exact: true }).click();
  await page.getByRole('button', { name: '+ Nova referência' }).waitFor();
  projectId = new URL(page.url()).hash.split('/')[2];
  await page.getByRole('button', { name: '+ Nova referência' }).click();
  await page.getByLabel('Nome da referência').fill('Entrada — referência de teste');
  await page
    .getByLabel('Imagem do ambiente')
    .setInputFiles(
      new URL('../../backend/heatcity/fixtures/hospital-a.jpg', import.meta.url).pathname,
    );
  await page.getByLabel('Próxima placa').fill('Entrada');
  const scene = page.locator('.reference-editor .scene-image');
  await scene.scrollIntoViewIfNeeded();
  const rect = await scene.boundingBox();
  await page.mouse.move(rect.x + rect.width * 0.1, rect.y + rect.height * 0.25);
  await page.mouse.down();
  await page.mouse.move(rect.x + rect.width * 0.3, rect.y + rect.height * 0.32);
  await page.mouse.up();
  await page.getByRole('button', { name: 'Salvar referência e placas' }).click();
  await page.getByRole('heading', { name: 'Entrada — referência de teste' }).waitFor();
  assert.equal(await page.locator('.reference-card').count(), 1);
  await page.screenshot({ path: '/tmp/heatcity-catalog-desktop.png', fullPage: true });
  await page.getByRole('link', { name: 'Analisar vídeo →' }).click();
  await page.waitForFunction(() =>
    document
      .querySelector('select')
      ?.selectedOptions[0]?.textContent.includes('Entrada — referência de teste'),
  );
  assert.equal(await page.getByRole('link', { name: 'Diagnósticos / DEV' }).count(), 0);
  await page.getByRole('link', { name: 'PDI visual', exact: false }).click();
  await page.getByRole('heading', { name: /Histograma · Entrada/ }).waitFor();
  assert.equal(await page.locator('.pdi-histogram rect').count(), 32);
  const before = await page.locator('.pdi-view .scene-image img').getAttribute('src');
  await page.getByLabel('Ver cena em cinza').check();
  assert.notEqual(await page.locator('.pdi-view .scene-image img').getAttribute('src'), before);
  await page.screenshot({ path: '/tmp/heatcity-pdi-new.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  await page.getByRole('link', { name: 'Referências de placas', exact: false }).click();
  await page.getByRole('link', { name: 'Abrir projeto →' }).first().click();
  await page.screenshot({ path: '/tmp/heatcity-catalog-mobile.png', fullPage: true });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  const apiProject = await (await page.request.get(`${base}/api/projects/${projectId}`)).json();
  assert.equal(apiProject.references.length, 1);
  assert.ok(!requests.some((url) => /mediapipe|face_landmarker|face_mesh/.test(url)));
  assert.deepEqual(errors, []);
  console.log(
    'PASS: catálogo por interface, upload, recorte por arraste, análise pela referência correta, PDI, cinza, layout móvel e ausência de componentes removidos.',
  );
} finally {
  if (projectId) await fetch(`${base}/api/projects/${projectId}`, { method: 'DELETE' });
  await browser.close();
}
