import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CalibrationArchive } from './calibration-archive.js';
test('all official attempts survive beyond the diagnostic log limit and snapshots are immutable', () => {
  const archive = new CalibrationArchive();
  for (let i = 0; i < 8; i++)
    archive.append({
      status: i % 2 ? 'failed' : 'completed',
      features: [[i, i]],
      signal_analysis: { references: [] },
    });
  const copy = archive.snapshot();
  assert.equal(copy.attempts_total, 8);
  assert.equal(copy.page_diagnostic.calibrations[0].attempt_number, 1);
  assert.equal(copy.page_diagnostic.calibrations[7].attempt_number, 8);
  copy.page_diagnostic.calibrations[0].features[0][0] = 999;
  assert.equal(archive.records[0].features[0][0], 0);
  assert.equal(archive.snapshot().record_type, 'official_calibration_history');
});
