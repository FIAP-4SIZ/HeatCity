// Descriptive geometry only: no learned parameters, classifier or approval decision.
const finitePair = (v) => Array.isArray(v) && v.length === 2 && v.every(Number.isFinite);
const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
function quantile(values, p) {
  const a = [...values].sort((x, y) => x - y),
    pos = (a.length - 1) * p,
    i = Math.floor(pos);
  return a[i] + (a[Math.ceil(pos)] - a[i]) * (pos - i);
}
const center = (rows) =>
  [0, 1].map((axis) =>
    quantile(
      rows.map((r) => r[axis]),
      0.5,
    ),
  );
const channels = {
  combined: (f) => [(f[0] + f[2]) / 2, (f[1] + f[3]) / 2],
  eye0: (f) => f.slice(0, 2),
  eye1: (f) => f.slice(2, 4),
};
function distribution(rows) {
  if (!rows.length) return null;
  const mid = center(rows),
    half = Math.floor(rows.length / 2);
  return {
    n: rows.length,
    center: mid,
    radius_p90: quantile(
      rows.map((r) => distance(r, mid)),
      0.9,
    ),
    axis_p90: [0, 1].map((axis) =>
      quantile(
        rows.map((r) => Math.abs(r[axis] - mid[axis])),
        0.9,
      ),
    ),
    first_half: half ? center(rows.slice(0, half)) : null,
    last_half: half ? center(rows.slice(half)) : null,
    drift: half ? distance(center(rows.slice(0, half)), center(rows.slice(half))) : null,
  };
}
export function analyzeSignals(details) {
  if (!Array.isArray(details) || details.length > 100)
    throw new Error('Detalhes de coleta ausentes ou acima do limite.');
  const references = details.filter((d) => d?.phase === 'reference');
  const groups = references
    .map((d, index) => {
      if (
        !finitePair(d.target) ||
        d.target.some((v) => v < 0 || v > 1) ||
        !Array.isArray(d.samples) ||
        d.samples.length > 5000
      )
        throw new Error('Amostras de referência inválidas.');
      if (
        d.samples.some(
          (f) =>
            !Array.isArray(f) ||
            f.length < 4 ||
            !f.every((v) => Number.isFinite(v) && Math.abs(v) <= 100),
        )
      )
        throw new Error('Características oculares inválidas.');
      const hasTiming =
        Array.isArray(d.sample_timing) &&
        d.sample_timing.length === d.samples.length &&
        d.sample_timing.every(
          (row) => row && typeof row.moving === 'boolean' && Number.isFinite(row.relative_ms),
        );
      const stats = {};
      for (const [name, project] of Object.entries(channels)) {
        const rows = d.samples.map(project);
        stats[name] = distribution(rows);
      }
      const stationary = hasTiming
        ? d.samples.filter((_, i) => d.sample_timing[i].moving === false)
        : null;
      return {
        index,
        target: d.target,
        n: d.samples.length,
        motion_samples: hasTiming
          ? d.sample_timing.filter((row) => row.moving).length
          : Number.isInteger(d.motion_samples_used) &&
              d.motion_samples_used >= 0 &&
              d.motion_samples_used <= d.samples.length
            ? d.motion_samples_used
            : null,
        channels: stats,
        stationary:
          stationary?.length >= 2 ? distribution(stationary.map(channels.combined)) : null,
      };
    })
    .filter((g) => g.n >= 2);
  const comparisons = {};
  for (const channel of Object.keys(channels)) {
    const pairs = [];
    for (let i = 0; i < groups.length; i++)
      for (let j = i + 1; j < groups.length; j++) {
        if (distance(groups[i].target, groups[j].target) < 1e-9) continue;
        const a = groups[i].channels[channel],
          b = groups[j].channels[channel];
        const separation = distance(a.center, b.center),
          spread = a.radius_p90 + b.radius_p90;
        pairs.push({
          a: groups[i].index,
          b: groups[j].index,
          distance: separation,
          spread_sum: spread,
          gap: separation - spread,
          overlap: separation <= spread + 1e-12,
          ratio: spread > 1e-12 ? separation / spread : null,
        });
      }
    comparisons[channel] = {
      pairs,
      overlapping_pairs: pairs.filter((p) => p.overlap).length,
      total_pairs: pairs.length,
    };
  }
  return {
    version: 1,
    method: 'median_centers_and_p90_disks_v1',
    references: groups,
    comparisons,
    note: 'Discos P90 são descrições empíricas, não intervalos de confiança. Sobreposição não prova impossibilidade de rastreamento; ausência dela não comprova precisão. Não altera aprovação.',
  };
}
export function signalAttempts(data) {
  let attempts = data.page_diagnostic?.calibrations || [data];
  if (!Array.isArray(attempts) || attempts.length > 1000)
    throw new Error('Número de tentativas inválido.');
  const pending = data.page_diagnostic?.incomplete_calibration;
  if (pending && (pending.status === 'collecting' || !attempts.length))
    attempts = [...attempts, pending];
  return attempts
    .map((a, i) => ({ data: a, index: i + 1 }))
    .filter(
      ({ data: a }) =>
        Array.isArray(a?.capture_details) &&
        a.capture_details.some((d) => d?.phase === 'reference'),
    )
    .map(({ data: a, index }) => ({
      attempt: a.attempt_number ?? index,
      status: a.status || (a.quality ? 'completed' : 'unknown'),
      analysis: analyzeSignals(a.capture_details),
    }));
}
