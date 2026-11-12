import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mouseAnchor, sceneEstimate, PracticeMetrics } from './practice-metrics.js';
test('slow cumulative cursor movement resets the stationary clock', () => {
  let a = mouseAnchor(null, [0.5, 0.5], 0);
  a = mouseAnchor(a, [0.502, 0.5], 100);
  assert.equal(a.since, 0);
  a = mouseAnchor(a, [0.504, 0.5], 200);
  assert.equal(a.since, 200);
});
test('raw and displayed error remain separate; missing predictions are not zero errors', () => {
  const p = new PracticeMetrics();
  p.observe({ time: 0, reference: [0.5, 0.5], raw: [0.7, 0.5], shown: [0.6, 0.5] });
  p.observe({ time: 100, reference: [0.5, 0.5], raw: null, shown: null });
  const s = p.snapshot();
  assert.ok(Math.abs(s.mean_distance - 0.2) < 1e-10);
  assert.ok(Math.abs(s.shown_mean_distance - 0.1) < 1e-10);
  assert.equal(s.observations, 2);
  assert.equal(s.missing_predictions, 1);
  assert.equal(s.jitter_recent, null);
});
test('AOIs are mapped through image letterboxing and uncertainty spanning plates stays ambiguous', () => {
  const scene = {
    plates: [
      { name: 'A', x: 0, y: 0, width: 0.45, height: 1 },
      { name: 'B', x: 0.55, y: 0, width: 0.45, height: 1 },
    ],
  };
  const rect = { x: 0.25, y: 0, width: 0.5, height: 1 };
  const e = sceneEstimate([0.4, 0.5], scene, rect, [0.2, 0.1]);
  assert.equal(e.plate, 'A');
  assert.equal(e.ambiguous, true);
  assert.deepEqual(e.candidates, ['A', 'B']);
  assert.equal(sceneEstimate([0.1, 0.5], scene, rect, [0.01, 0.01]).inside, false);
});
test('repeated center checks quantify displacement without changing estimates', () => {
  const p = new PracticeMetrics();
  for (const [start, x] of [
    [0, 0.4],
    [3000, 0.6],
  ]) {
    p.beginCenter(start);
    for (let t = start + 600; t <= start + 2000; t += 100)
      p.observe({ time: t, reference: [0.5, 0.5], raw: [x, 0.5], shown: [x, 0.5] });
  }
  const s = p.snapshot();
  assert.equal(s.center_checks.length, 2);
  assert.ok(Math.abs(s.center_checks[1].drift_from_first - 0.2) < 1e-10);
  assert.ok(Math.abs(s.center_checks[0].mean[0] - 0.4) < 1e-10);
});
