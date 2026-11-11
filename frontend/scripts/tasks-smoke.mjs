import { chromium } from 'playwright';
import assert from 'node:assert/strict';
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--no-sandbox'],
});
try {
  const page = await browser.newPage();
  await page.goto(process.env.HEATCITY_BASE_URL || 'http://127.0.0.1:5173');
  const result = await page.evaluate(async () => {
    const { createDetector } = await import('/src/detector.js');
    const detector = await createDetector();
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 480;
    const context = canvas.getContext('2d');
    context.fillStyle = '#777';
    context.fillRect(0, 0, 640, 480);
    let faces = null;
    detector.onResults((result) => {
      faces = result.multiFaceLandmarks.length;
    });
    await detector.send({ image: canvas });
    await detector.send({ image: canvas });
    detector.close();
    return { engine: detector.engine, faces };
  });
  assert.equal(result.engine, 'tasks-vision-1.2.2');
  assert.equal(result.faces, 0);
  console.log(
    'PASS: bundled Face Landmarker initializes with CPU/WASM and rejects a blank frame. No human accuracy claim.',
  );
} finally {
  await browser.close();
}
