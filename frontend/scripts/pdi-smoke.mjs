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
  const study = await (
    await page.request.post(`${base}/api/studies`, {
      data: {
        title: 'PDI: teste de software',
        objective: 'Conferir descritores de uma cena didática sintética.',
      },
    })
  ).json();
  id = study.id;
  const scene = await (await page.request.get(`${base}/api/scene-example`)).json();
  const saved = await page.request.post(`${base}/api/studies/${id}/scenarios`, { data: scene });
  assert.equal(saved.status(), 201);
  await page.goto(`${base}/#/studies/${id}/pdi`);
  await page.getByRole('heading', { name: /O que existe dentro/ }).waitFor();
  await page.getByRole('heading', { name: /Histograma · Recepção/ }).waitFor();
  assert.equal(await page.locator('.pdi-histogram rect').count(), 32);
  const first = await page.locator('.pdi-view .scene-image img').getAttribute('src');
  await page.getByLabel('Ver cena em cinza').check();
  assert.notEqual(await page.locator('.pdi-view .scene-image img').getAttribute('src'), first);
  await page.getByRole('button', { name: 'Saída', exact: true }).click();
  await page.getByRole('heading', { name: /Histograma · Saída/ }).waitFor();
  await page.getByRole('button', { name: /Tema escuro/ }).click();
  await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark');
  const color = await page.locator('.pdi-histogram').evaluate((e) => getComputedStyle(e).color);
  assert.notEqual(color, 'rgb(0, 0, 0)');
  await page.screenshot({ path: '/tmp/heatcity-pdi-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
    'Sem rolagem horizontal no celular',
  );
  await page.screenshot({ path: '/tmp/heatcity-pdi-mobile.png', fullPage: true });
  const results = await (await page.request.get(`${base}/api/studies/${id}/results`)).json();
  assert.equal(results.sessions.length, 0);
  assert.deepEqual(errors, []);
  console.log(
    'PASS: PDI sem câmera; AOIs, cinza, histograma, seleção de placa, tema escuro e celular; nenhuma sessão criada.',
  );
} finally {
  if (id) await page.request.delete(`${base}/api/studies/${id}`);
  await browser.close();
}
