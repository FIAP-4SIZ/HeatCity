import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const base = process.env.HEATCITY_BASE_URL || 'http://127.0.0.1:5173';
const id = 'hospital-orientacao-base-v1';
const fixture = JSON.parse(
  await readFile(
    new URL('../../backend/heatcity/fixtures/hospital-study.json', import.meta.url),
    'utf8',
  ),
);
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--no-sandbox'],
});
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1080 } });
  await page.goto(`${base}/#/studies`);
  assert.equal(await page.getByRole('button', { name: 'Exemplo hospitalar A/B' }).count(), 0);
  const card = page.locator('.study-card').filter({
    has: page.getByRole('heading', { name: 'Orientação na entrada de um hospital', exact: true }),
  });
  await card.getByRole('button', { name: /Abrir estudo/ }).click();
  await page
    .getByRole('heading', { name: 'Orientação na entrada de um hospital', exact: true })
    .waitFor();
  await page.getByRole('link', { name: 'Cenários e placas', exact: true }).click();
  await page.locator('.scenario-card').first().waitFor();
  assert.equal(await page.locator('.scenario-card').count(), 2);
  assert.equal(await page.locator('.scenario-card .scene-area').count(), 8);
  const study = await (await page.request.get(`${base}/api/studies/${id}`)).json();
  for (const scene of study.scenarios) {
    const label = scene.name.includes(' A ') ? 'a' : 'b';
    const hash = createHash('sha256')
      .update(Buffer.from(scene.image.split(',')[1], 'base64'))
      .digest('hex');
    assert.equal(hash, fixture.source_sha256[`hospital-${label}.jpg`]);
  }
  await page.screenshot({ path: '/tmp/heatcity-hospital-normal-study.png', fullPage: true });
  await page.getByRole('link', { name: 'PDI visual', exact: true }).click();
  await page.getByRole('heading', { name: /Histograma · Recepção/ }).waitFor();
  const result = await (await page.request.get(`${base}/api/studies/${id}/results`)).json();
  assert.equal(result.sessions.length, 0);
  assert.ok(result.summary.rows.every((r) => r.participants === 0));
  await page.getByRole('link', { name: 'Nova sessão', exact: true }).click();
  await page.getByLabel('Código do participante').waitFor();
  assert.equal(await page.getByLabel('Código do participante').inputValue(), '');
  console.log(
    'PASS: base carregada automaticamente como estudo normal; imagens originais conferidas por SHA-256, oito AOIs, PDI e preparo de participante. Nenhum resultado humano inventado.',
  );
} finally {
  await browser.close();
}
