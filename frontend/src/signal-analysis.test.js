import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeSignals, signalAttempts } from './signal-analysis.js';
const detail = (target, center, jitter = 0.001) => ({
  phase: 'reference',
  target,
  samples: Array.from({ length: 12 }, (_, i) => [
    center[0] + (i % 2 ? jitter : -jitter),
    center[1],
    center[0] + (i % 2 ? jitter : -jitter),
    center[1],
  ]),
});
test('stable distinct targets have separated disks and empirical spread', () => {
  const a = analyzeSignals([detail([0, 0], [0.2, 0.3]), detail([1, 1], [0.7, 0.8])]);
  assert.equal(a.comparisons.combined.overlapping_pairs, 0);
  assert.equal(a.comparisons.combined.total_pairs, 1);
  assert.ok(Math.abs(a.references[0].channels.combined.radius_p90 - 0.001) < 1e-12);
  assert.equal(a.references[0].stationary, null);
});
test('different targets with the same signal overlap; zero spread is finite', () => {
  const a = analyzeSignals([detail([0, 0], [0.5, 0.5], 0), detail([1, 1], [0.5, 0.5], 0)]);
  assert.equal(a.comparisons.combined.overlapping_pairs, 1);
  assert.equal(a.comparisons.combined.pairs[0].ratio, null);
  assert.ok(!JSON.stringify(a).includes('NaN'));
});
test('binocular averaging can cancel separation that exists in both individual channels', () => {
  const a = detail([0, 0], [0.2, 0.3], 0),
    b = detail([1, 0], [0.6, 0.3], 0);
  a.samples = a.samples.map(() => [0.2, 0.3, 0.6, 0.3]);
  b.samples = b.samples.map(() => [0.6, 0.3, 0.2, 0.3]);
  const result = analyzeSignals([a, b]);
  assert.equal(result.comparisons.combined.overlapping_pairs, 1);
  assert.equal(result.comparisons.eye0.overlapping_pairs, 0);
  assert.equal(result.comparisons.eye1.overlapping_pairs, 0);
});
test('motion samples and stationary spread remain separate without discarding data', () => {
  const d = detail([0.5, 0.5], [0.3, 0.3]);
  d.motion_samples_used = 4;
  d.sample_timing = d.samples.map((_, i) => ({ moving: i < 4, relative_ms: i * 50 - 200 }));
  const a = analyzeSignals([d]);
  assert.equal(a.references[0].n, 12);
  assert.equal(a.references[0].stationary.n, 8);
  assert.equal(a.references[0].motion_samples, 4);
});
test('partial histories are usable without RMSE and duplicate root is not counted twice', () => {
  const attempt = { status: 'failed', capture_details: [detail([0, 0], [0.2, 0.3])] };
  assert.equal(
    signalAttempts({ ...attempt, page_diagnostic: { calibrations: [attempt, attempt] } }).length,
    2,
  );
  assert.equal(analyzeSignals([]).references.length, 0);
  assert.throws(
    () => analyzeSignals([{ phase: 'reference', target: [0, 0], samples: [[NaN, 0, 0, 0]] }]),
    /inválidas/,
  );
});

test('ongoing partial snapshots are supported and source attempt numbering is preserved', () => {
  const attempt = { status: 'collecting', capture_details: [detail([0, 0], [0.2, 0.3])] };
  assert.equal(
    signalAttempts({ page_diagnostic: { calibrations: [], incomplete_calibration: attempt } })[0]
      .attempt,
    1,
  );
  assert.equal(signalAttempts({ page_diagnostic: { calibrations: [{}, attempt] } })[0].attempt, 2);
  assert.throws(
    () => analyzeSignals([{ phase: 'reference', target: [0, 0], samples: [[1e300, 0, 0, 0]] }]),
    /inválidas/,
  );
});
