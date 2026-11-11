import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  predict,
  calibrationFeature,
  sweepTargets,
  validationTargets,
  sweepDuration,
  EyeGate,
  EyeReadiness,
} from './gaze.js';
const geometry = {
  basis: 'mesh',
  anchors: [
    { eye: [0, 0], screen: [0, 0] },
    { eye: [1, 0], screen: [1, 0] },
    { eye: [1, 1], screen: [1, 1] },
    { eye: [0, 1], screen: [0, 1] },
  ],
  cells: [
    [0, 1, 2],
    [0, 2, 3],
  ],
};
test('geometric interpolation preserves references, interior points and rejects extrapolation', () => {
  assert.deepEqual(predict([0.3, 0.6], geometry), [0.3, 0.6]);
  assert.deepEqual(predict([0, 0], geometry), [0, 0]);
  assert.ok(predict([1.5, 0.5], geometry).every(Number.isNaN));
  assert.deepEqual(calibrationFeature([0.2, 0.4, 0.4, 0.6]), [0.30000000000000004, 0.5]);
});
test('moving sweep visits 25 distinct references at center, edges and corners', () => {
  assert.equal(new Set(sweepTargets.map((p) => p.join(','))).size, 25);
  for (const p of [
    [0.05, 0.05],
    [0.95, 0.95],
    [0.05, 0.95],
    [0.95, 0.05],
    [0.5, 0.5],
    [0.5, 0.05],
    [0.05, 0.5],
  ])
    assert.ok(sweepTargets.some((q) => q.every((v, i) => v === p[i])));
  assert.equal(validationTargets.length, 13);
});
test('blink rejection is temporary and button readiness survives a natural blink', () => {
  const gate = new EyeGate(),
    ready = new EyeReadiness();
  assert.equal(gate.update([0.3, 0.3], 0), true);
  ready.update([0.3, 0.3], 0);
  assert.equal(gate.update(null, 100), false);
  assert.equal(ready.update(null, 200), true);
  assert.equal(gate.update([0.3, 0.3], 200), false);
  assert.equal(gate.update([0.3, 0.3], 400), true);
  assert.equal(ready.update(null, 1500), false);
});
test('individual eyelid profile admits narrow eyes and still rejects blinks per eye', async () => {
  const { EyeProfile } = await import('./eye-profile.js');
  const { inspectEyes } = await import('./gaze.js');
  const face = Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5 }));
  for (const [a, b, u, l, i] of [
    [33, 133, 159, 145, 468],
    [362, 263, 386, 374, 473],
  ]) {
    face[a] = { x: 0.2, y: 0.5 };
    face[b] = { x: 0.4, y: 0.5 };
    face[u] = { x: 0.3, y: 0.495 };
    face[l] = { x: 0.3, y: 0.505 };
    face[i] = { x: 0.3, y: 0.5 };
  }
  assert.equal(inspectEyes([face], true).feature, undefined);
  const profile = new EyeProfile();
  let result;
  for (let frame = 0; frame <= 40; frame++) result = profile.inspect([face], frame * 50);
  assert.equal(result.ready, true);
  assert.ok(inspectEyes([face], true, { thresholds: result.thresholds }).feature);
  face[145] = face[159];
  assert.equal(inspectEyes([face], true, { thresholds: result.thresholds }).blink, true);
  for (let frame = 41; frame <= 90; frame++) profile.inspect([face], frame * 50);
  assert.deepEqual(profile.thresholds(), result.thresholds); // no learning a blink as normal
  const empty = new EyeProfile();
  for (let frame = 0; frame < 100; frame++) empty.inspect([], frame * 50);
  assert.equal(empty.baseline, null);
});

test('page diagnostic retains rejected samples and tracking with bounded history', async () => {
  const { DiagnosticLog } = await import('./diagnostic-log.js');
  const log = new DiagnosticLog();
  for (let i = 0; i < 5005; i++)
    log.add({ phase: 'tracking', accepted: false, reason: 'blink' }, log.started + i * 101);
  for (let i = 0; i < 7; i++) log.calibration({ index: i });
  const result = log.snapshot();
  assert.equal(result.samples.length, 5000);
  assert.equal(result.dropped_samples, 5);
  assert.equal(result.samples[0].accepted, false);
  assert.equal(result.calibrations.length, 5);
  assert.equal(result.calibrations[0].index, 2);
});

test('sweep motion takes at least one second and slows down long moves', () => {
  assert.equal(sweepDuration([0.5, 0.5], [0.5, 0.5]), 1000);
  assert.ok(sweepDuration([0.05, 0.05], [0.95, 0.95]) > 3800);
});
test('references advance automatically only with fresh stable eyes and head', async () => {
  const { ReferenceCapture } = await import('./reference-capture.js');
  const base = [0.4, 0.1, 0.4, 0.1, 0, 0, 0.5, 0.5];
  const c = new ReferenceCapture([0.05, 0.05], 0);
  assert.equal(c.evaluate(200), false);
  for (let t = 300; t <= 1300; t += 50) c.push(base, t);
  assert.equal(c.evaluate(1300), true);
  assert.equal(c.complete, true);
  assert.equal(c.features.length, 21);
  const noisy = new ReferenceCapture([0.05, 0.05], 0);
  for (let t = 300; t <= 1300; t += 50)
    noisy.push([t % 100 === 0 ? 0.6 : 0.2, 0.1, 0.4, 0.1, 0, 0, 0.5, 0.5], t);
  assert.equal(noisy.evaluate(1300), false);
  assert.equal(noisy.evaluate(4000), false); // elapsed time never forces progress
  for (let t = 4050; t <= 4750; t += 50) noisy.push(base, t);
  assert.equal(noisy.evaluate(4750), true);
  assert.ok(noisy.features.every((f) => f[0] === 0.4));
  const head = new ReferenceCapture([0.05, 0.05], 0);
  for (let t = 300; t <= 1300; t += 50) head.push([...base.slice(0, 6), 0.5 + t * 0.00002, 0.5], t);
  assert.equal(head.evaluate(1300), false);
});

test('movement uses the acquisition timestamp and seeds only nearby references', async () => {
  const { MotionCapture } = await import('./motion-capture.js');
  const { ReferenceCapture } = await import('./reference-capture.js');
  const motion = new MotionCapture();
  const f = [0.4, 0.1, 0.4, 0.1, 0, 0, 0.5, 0.5];
  for (let t = 0; t <= 1000; t += 50) {
    motion.target([0.4 + (0.1 * t) / 1000, 0.5], t, true);
    motion.add(f, t);
  }
  const seed = motion.near([0.5, 0.5], 1000);
  assert.ok(seed.length >= 3);
  assert.ok(seed.every((s) => Math.hypot(s.target[0] - 0.5, s.target[1] - 0.5) <= 0.025));
  assert.deepEqual(motion.near([0.9, 0.9], 1000), []);
  assert.deepEqual(motion.near([0.5, 0.5], 3000), []);
  const capture = new ReferenceCapture([0.5, 0.5], 1000, seed);
  for (let t = 1150; t <= 1500; t += 50) capture.push(f, t);
  assert.equal(capture.evaluate(1500), true);
  assert.ok(capture.motionSamplesUsed >= 3);
  const stationary = new ReferenceCapture([0.5, 0.5], 1000);
  for (let t = 1150; t <= 1500; t += 50) stationary.push(f, t);
  assert.equal(stationary.evaluate(1500), false);
  const delayed = new MotionCapture();
  delayed.target([0.1, 0.1], 100, true);
  delayed.target([0.9, 0.9], 200, true);
  delayed.add(f, 150);
  assert.deepEqual(delayed.snapshot().samples[0].target, [0.1, 0.1]);
  delayed.enabled = false;
  delayed.add(f, 250);
  assert.equal(delayed.snapshot().samples.length, 1);
});
