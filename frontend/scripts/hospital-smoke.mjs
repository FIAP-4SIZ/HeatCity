import { chromium } from 'playwright';
import assert from 'node:assert/strict';
const base = process.env.HEATCITY_BASE_URL || 'http://127.0.0.1:5173';
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1080 } });
let id;
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
try {
  await page.goto(base);
  await page.getByRole('button', { name: 'Exemplo hospitalar A/B' }).click();
  const save = page.getByRole('button', { name: 'Criar estudo com os dois cenários' });
  assert.ok(await save.isDisabled());
  // Synthetic software fixture, not the user's hospital images or human observations.
  const image = await page.evaluate(() => {
    const c = document.createElement('canvas');
    c.width = 1371;
    c.height = 1536;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#ddd';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.fillStyle = '#123456';
    ctx.fillRect(120, 407, 290, 110);
    return c.toDataURL('image/png').split(',')[1];
  });
  for (const label of ['A', 'B'])
    await page.getByLabel(`Imagem do cenário ${label}`, { exact: true }).setInputFiles({
      name: `fixture-${label}.png`,
      mimeType: 'image/png',
      buffer: Buffer.from(image, 'base64'),
    });
  await page.locator('.hospital-example .scene-area').last().waitFor();
  assert.equal(await page.locator('.hospital-example .scene-area').count(), 8);
  assert.ok(await save.isDisabled());
  const first = page.locator('.hospital-example .scene-image').first();
  await first.scrollIntoViewIfNeeded();
  const bounds = await first.boundingBox();
  await page.mouse.move(bounds.x + bounds.width * 0.1, bounds.y + bounds.height * 0.4);
  await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width * 0.3, bounds.y + bounds.height * 0.5);
  await page.mouse.up();
  await page.waitForFunction(
    () =>
      Math.abs(parseFloat(document.querySelector('.hospital-example .scene-area').style.top) - 40) <
      0.1,
  );
  await page.getByRole('checkbox', { name: /Conferi as imagens/ }).check();
  const response = page.waitForResponse(
    (r) => r.url().endsWith('/study-examples/hospital') && r.request().method() === 'POST',
  );
  await save.click();
  const created = await response;
  assert.equal(created.status(), 201);
  const study = await created.json();
  id = study.id;
  await page
    .getByRole('heading', { name: 'Orientação na entrada de um hospital', exact: true })
    .waitFor();
  await page.getByRole('link', { name: 'PDI visual', exact: true }).click();
  await page.getByRole('heading', { name: /Histograma · Recepção/ }).waitFor();
  const result = await (await page.request.get(`${base}/api/studies/${id}/results`)).json();
  assert.equal(result.sessions.length, 0);
  assert.equal(result.study.scenarios.length, 2);
  assert.ok(result.summary.rows.every((r) => r.participants === 0));
  assert.equal(result.study.example_protocol.target, 'Recepção');
  await page.screenshot({ path: '/tmp/heatcity-hospital-example.png' });
  assert.deepEqual(errors, []);
  console.log(
    'PASS: importa duas imagens, ajusta AOI, cria estudo A/B rotulado como ilustrativo e processa PDI sem inventar sessões. Fixture de software sintética.',
  );
} finally {
  if (id) await page.request.delete(`${base}/api/studies/${id}`);
  await browser.close();
}
