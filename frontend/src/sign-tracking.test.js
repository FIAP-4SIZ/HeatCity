import { test } from 'node:test';
import assert from 'node:assert/strict';
import { summarizeTracking, csvTracking } from './sign-tracking.js';
const frame = (time, status = 'detected', source = 'video') => ({
  time,
  source,
  signs: [{ name: 'Recepção', status, box: [0.1, 0.2, 0.2, 0.1], score: 0.9 }],
});
test('duration uses media time, rejects gaps and separates uncertainty and reappearances', () => {
  const rows = [
    frame(0),
    frame(0.5),
    frame(1, 'ambiguous'),
    frame(1.5),
    frame(2),
    frame(8),
    frame(0, 'detected', 'other'),
  ];
  const result = summarizeTracking(rows);
  assert.equal(result.signs[0].detectedSeconds, 1);
  assert.equal(result.signs[0].events, 4);
  assert.equal(result.signs[0].uncertainFrames, 1);
  assert.equal(result.precision, null);
});
test('precision uses annotated frames only and abstentions do not disappear', () => {
  const a = {
    ...frame(0),
    metrics: { tp: 1, fp: 1, fn: 2, annotations: 3, abstentions: 1, ious: [1, 0] },
  };
  const result = summarizeTracking([a, frame(0.5)]);
  assert.equal(result.precision, 0.5);
  assert.equal(result.recall, 1 / 3);
  assert.equal(result.meanIou, 0.5);
  assert.equal(result.annotations, 3);
  assert.equal(result.abstentions, 1);
  assert.match(csvTracking([a]), /Recepção/);
});
test('known absence is separated from failure and excluded from difficulty hints', () => {
  const absent = {
    ...frame(0, 'not_found'),
    signs: [
      {
        name: 'Recepção',
        status: 'not_found',
        score: 0.4,
        box: null,
        reasons: ['Similaridade baixa'],
        suggestions: ['Aproximar placa'],
        evaluation: { present: false, tp: 0, fp: 0, fn: 0, tn: 1 },
      },
    ],
    metrics: { tn: 1, annotations: 1, ious: [] },
    condition: 'recepcao_ausente',
  };
  const missed = {
    ...frame(0.5, 'not_found'),
    signs: [{ ...absent.signs[0], evaluation: { present: true, tp: 0, fp: 0, fn: 1, tn: 0 } }],
    metrics: { fn: 1, annotations: 1, ious: [0] },
    condition: 'desfoque',
  };
  const s = summarizeTracking([absent, missed]);
  assert.equal(s.signs[0].knownAbsentFrames, 1);
  assert.equal(s.signs[0].knownPresentFrames, 1);
  assert.equal(s.signs[0].tn, 1);
  assert.equal(s.signs[0].fn, 1);
  assert.equal(s.signs[0].reasons['Similaridade baixa'], 1);
  assert.equal(s.conditions.length, 2);
  assert.equal(s.recall, 0);
});
