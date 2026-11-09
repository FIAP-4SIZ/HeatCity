import { test } from 'node:test';
import assert from 'node:assert/strict';
import { eyeFeature, predict, medianFeature, targets, validationTargets } from './gaze.js';
test('requires one face with iris landmarks', () => {
  assert.equal(eyeFeature([]), null);
  assert.equal(eyeFeature([[], []]), null);
  assert.equal(eyeFeature([Array(468).fill({ x: 0, y: 0 })]), null);
});
test('extracts eye-relative features and rejects closed eyes', () => {
  const face = Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5 }));
  for (const [a, b, u, l, i] of [
    [33, 133, 159, 145, 468],
    [362, 263, 386, 374, 473],
  ]) {
    face[a] = { x: 0.2, y: 0.5 };
    face[b] = { x: 0.4, y: 0.5 };
    face[u] = { x: 0.3, y: 0.47 };
    face[l] = { x: 0.3, y: 0.53 };
    face[i] = { x: 0.3, y: 0.5 };
  }
  const result = eyeFeature([face]);
  assert.ok(Math.abs(result[0] - 0.5) < 1e-10);
  assert.equal(result[1], 0);
  face[145] = face[159];
  assert.equal(eyeFeature([face]), null);
});
test('prediction preserves outside-screen coordinates for invalidation', () => {
  assert.deepEqual(
    predict(
      [2, 3],
      [
        [1, 0],
        [0, 1],
        [0.1, 0.2],
      ],
    ),
    [2.1, 3.2],
  );
});
test('uses distinct validation targets and robust median', () => {
  assert.equal(targets.length, 9);
  assert.equal(validationTargets.length, 5);
  assert.deepEqual(
    medianFeature([
      [1, 2],
      [100, 200],
      [2, 3],
    ]),
    [2, 3],
  );
});

test('motion trajectory is bounded and covers all four quadrants', async () => {
  const { trajectory, PASS_MS } = await import('./gaze.js');
  const quadrants = new Set();
  for (let t = 0; t <= PASS_MS; t += 50) {
    const point = trajectory(t);
    assert.ok(point.every((v) => v >= 0.1 - 1e-10 && v <= 0.9 + 1e-10));
    quadrants.add(point.map((v) => Number(v >= 0.5)).join(','));
  }
  assert.equal(quadrants.size, 4);
});

test('blink recovery and saccades suppress invalid samples without freezing gaze', async () => {
  const { EyeGate } = await import('./gaze.js');
  const gate = new EyeGate();
  assert.equal(gate.update([0.3, 0.1, 0.3, 0.1], 0), true);
  assert.equal(gate.update(null, 20), false);
  assert.equal(gate.update([0.3, 0.1, 0.3, 0.1], 100), false);
  assert.equal(gate.update([0.3, 0.1, 0.3, 0.1], 220), true);
  assert.equal(gate.update([0.9, 0.1, 0.9, 0.1], 240), false);
  assert.equal(gate.update([0.9, 0.1, 0.9, 0.1], 400), true);
});

test('head posture beyond the calibrated range requires recalibration', async () => {
  const { supportedHead } = await import('./gaze.js');
  const model = { head_min: [0, 0, 0.4, 0.4, 0.2, 0], head_max: [0.1, 0.1, 0.6, 0.6, 0.3, 0.1] };
  assert.equal(supportedHead([0, 0, 0, 0, 0.05, 0.05, 0.5, 0.5, 0.25, 0.05], model), true);
  assert.equal(supportedHead([0, 0, 0, 0, 0.05, 0.05, 0.9, 0.5, 0.25, 0.05], model), false);
});

test('natural blink and recovery do not change guidance or show a warning', async () => {
  const { GuidanceFilter } = await import('./gaze.js');
  const guide = new GuidanceFilter();
  guide.update(null, 0);
  const healthy = guide.update(null, 600);
  for (const t of [800, 900, 1000]) assert.deepEqual(guide.update('Olhos fechados', t), healthy);
  assert.deepEqual(guide.update(null, 1100), healthy);
  assert.deepEqual(guide.update(null, 1800), healthy);
});
test('persistent problem warns, text is held and recovery is stable', async () => {
  const { GuidanceFilter } = await import('./gaze.js');
  const guide = new GuidanceFilter();
  guide.update('Sem rosto', 0);
  assert.equal(guide.update('Sem rosto', 1199).warning, false);
  const warning = guide.update('Sem rosto', 1200);
  assert.equal(warning.warning, true);
  assert.deepEqual(guide.update('Aproxime-se', 1300), warning);
  guide.update(null, 1400);
  assert.deepEqual(guide.update(null, 2000), warning);
  assert.equal(guide.update(null, 3200).warning, false);
});

test('button readiness survives blinks but expires after persistent detection loss', async () => {
  const { EyeReadiness } = await import('./gaze.js');
  const ready = new EyeReadiness();
  assert.equal(ready.update(null, 0), false);
  assert.equal(ready.update([1, 2], 100), true);
  assert.equal(ready.update(null, 350), true);
  assert.equal(ready.update(null, 1299), true);
  assert.equal(ready.update(null, 1300), false);
  assert.equal(ready.update([1, 2], 1400), true);
});

test('classic calibration uses the mean of both eyes consistently for training and prediction', async () => {
  const { calibrationFeature, predict } = await import('./gaze.js');
  const features = [0.2, 0.1, 0.4, 0.3, 1, 2, 3, 4, 5, 6];
  const classic = calibrationFeature(features, 'fixed');
  assert.ok(Math.abs(classic[0] - 0.3) < 1e-10);
  assert.equal(classic[1], 0.2);
  const point = predict(classic, [
    [2, 0],
    [0, 3],
    [0.1, 0.2],
  ]);
  assert.ok(Math.abs(point[0] - 0.7) < 1e-10);
  assert.ok(Math.abs(point[1] - 0.8) < 1e-10);
  assert.deepEqual(calibrationFeature(features, 'motion'), features);
});

test('quadratic inference matches the explicit backend basis order', () => {
  assert.deepEqual(
    predict(
      [2, 3],
      [
        [0, 0],
        [0, 0],
        [1, 0],
        [0, 1],
        [0, 0],
        [0.1, 0.2],
      ],
      'quadratic',
    ),
    [4.1, 6.2],
  );
});

test('session camera inference uses the basis authorized by calibration', async () => {
  const { gazePoint } = await import('./camera.js');
  const point = gazePoint([0.2, 0.3, 0.2, 0.3, 0, 0, 0, 0, 0, 0], {
    feature_mode: 'fixed',
    basis: 'quadratic',
    coefficients: [
      [0, 0],
      [0, 0],
      [10, 0],
      [0, 0],
      [0, 5],
      [0, 0],
    ],
  });
  assert.ok(Math.abs(point[0] - 0.4) < 1e-10);
  assert.ok(Math.abs(point[1] - 0.45) < 1e-10);
});

test('diagnostic imports recompute error and group validation targets without trusting the declared score', async () => {
  const { summarizeDiagnostic } = await import('./diagnostics.js');
  const result = summarizeDiagnostic({
    mode: 'fixed',
    quality: { validation_rmse: 0.2 },
    features: [],
    residuals: [{ expected: [0.5, 0.5], estimated: [0.8, 0.9] }],
  });
  assert.ok(Math.abs(result.recomputed - 0.5) < 1e-10);
  assert.equal(result.targets.length, 1);
});
test('malformed diagnostic data cannot be rendered as a report', async () => {
  const { summarizeDiagnostic } = await import('./diagnostics.js');
  assert.throws(() =>
    summarizeDiagnostic({ mode: 'fixed', quality: { validation_rmse: -1 }, residuals: [] }),
  );
  assert.throws(() =>
    summarizeDiagnostic({
      mode: 'fixed',
      quality: { validation_rmse: 0.2 },
      residuals: [{ expected: [2, 0.5], estimated: [0.5, 0.5] }],
    }),
  );
});

test('precision protocol randomizes a complete grid, repeats drift anchors and keeps spatial validation separate', async () => {
  const { precisionSequence, precisionTargets, precisionValidation, calibrationFeature } =
    await import('./gaze.js');
  const order = precisionSequence(() => 0.37);
  assert.equal(order.length, 29);
  assert.equal(new Set(order.map((p) => p.join(','))).size, 25);
  assert.equal(order.filter((p) => p[0] === 0.5 && p[1] === 0.5).length, 5);
  assert.equal(precisionValidation.length, 9);
  assert.ok(
    precisionValidation.every((p) => !precisionTargets.some((t) => t[0] === p[0] && t[1] === p[1])),
  );
  assert.equal(calibrationFeature(Array(10).fill(0.1), 'precision').length, 10);
});
