// Temporal evidence from sampled video, without filling gaps or learning a model.
export const MAX_GAP_SECONDS = 1.5;
export function summarizeTracking(frames) {
  const signs = new Map();
  let previous = null;
  for (const frame of frames) {
    for (const sign of frame.signs) {
      if (!signs.has(sign.name))
        signs.set(sign.name, {
          name: sign.name,
          detectedSeconds: 0,
          events: 0,
          detectedFrames: 0,
          uncertainFrames: 0,
          firstSeen: null,
          path: [],
          reasons: {},
          suggestions: {},
          scores: [],
          gaps: [],
          tp: 0,
          fp: 0,
          fn: 0,
          annotations: 0,
        });
      const row = signs.get(sign.name);
      row.scores.push(sign.score);
      if (sign.gap != null) row.gaps.push(sign.gap);
      for (const key of ['reasons', 'suggestions'])
        for (const text of new Set(sign[key] || [])) row[key][text] = (row[key][text] || 0) + 1;
      if (sign.evaluation) {
        row.annotations++;
        for (const key of ['tp', 'fp', 'fn']) row[key] += sign.evaluation[key];
      }
      if (sign.status === 'ambiguous' || sign.status === 'conflict') row.uncertainFrames++;
      if (sign.status !== 'detected') continue;
      row.detectedFrames++;
      row.firstSeen ??= frame.time;
      const dt = frame.time - (previous?.time ?? frame.time);
      const continuous =
        previous?.source === frame.source &&
        dt > 0 &&
        dt <= MAX_GAP_SECONDS &&
        previous.signs.some((s) => s.name === sign.name && s.status === 'detected');
      if (continuous) row.detectedSeconds += dt;
      else row.events++;
      if (sign.box)
        row.path.push({
          time: frame.time,
          x: sign.box[0] + sign.box[2] / 2,
          y: sign.box[1] + sign.box[3] / 2,
        });
    }
    previous = frame;
  }
  const counts = { tp: 0, fp: 0, fn: 0, tn: 0, annotations: 0, abstentions: 0 };
  const overlaps = [];
  for (const frame of frames) {
    for (const key of Object.keys(counts)) counts[key] += frame.metrics?.[key] || 0;
    overlaps.push(...(frame.metrics?.ious || []));
  }
  return {
    signs: [...signs.values()].map((s) => ({
      ...s,
      meanScore: s.scores.reduce((a, b) => a + b, 0) / s.scores.length,
      meanGap: s.gaps.length ? s.gaps.reduce((a, b) => a + b, 0) / s.gaps.length : null,
      precision: s.tp + s.fp ? s.tp / (s.tp + s.fp) : null,
      recall: s.tp + s.fn ? s.tp / (s.tp + s.fn) : null,
    })),
    ...counts,
    precision: counts.tp + counts.fp ? counts.tp / (counts.tp + counts.fp) : null,
    recall: counts.tp + counts.fn ? counts.tp / (counts.tp + counts.fn) : null,
    meanIou: overlaps.length ? overlaps.reduce((a, b) => a + b, 0) / overlaps.length : null,
  };
}
export function csvTracking(frames) {
  const quote = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;
  return [
    'fonte,tempo_s,placa,estado,similaridade,x,y,largura,altura',
    ...frames.flatMap((f) =>
      f.signs.map((s) =>
        [f.source, f.time, s.name, s.status, s.score, ...(s.box || ['', '', '', ''])]
          .map(quote)
          .join(','),
      ),
    ),
  ].join('\n');
}
