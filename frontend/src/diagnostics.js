// Uploaded diagnostics are data only. Never execute or merge their contents into app state.
export function summarizeDiagnostic(data, name = 'Calibração atual') {
  if (
    !data ||
    !['fixed', 'motion'].includes(data.mode) ||
    !Number.isFinite(data.quality?.validation_rmse) ||
    data.quality.validation_rmse < 0 ||
    data.quality.validation_rmse > 100 ||
    !Array.isArray(data.residuals) ||
    data.residuals.length > 5000
  )
    throw new Error('Formato de diagnóstico não reconhecido.');
  const groups = new Map();
  let total = 0,
    outside = 0;
  for (const item of data.residuals) {
    if (
      ![item.expected, item.estimated].every(
        (pair) => Array.isArray(pair) && pair.length === 2 && pair.every(Number.isFinite),
      )
    )
      throw new Error('Coordenadas inválidas no diagnóstico.');
    if (item.expected.some((v) => v < 0 || v > 1) || item.estimated.some((v) => Math.abs(v) > 100))
      throw new Error('Coordenadas fora do intervalo aceito.');
    const error = Math.hypot(
      item.expected[0] - item.estimated[0],
      item.expected[1] - item.estimated[1],
    );
    total += error ** 2;
    outside += Number(item.estimated.some((v) => v < 0 || v > 1));
    const key = item.expected.map((v) => v.toFixed(6)).join(',');
    if (!groups.has(key))
      groups.set(key, { expected: item.expected, x: 0, y: 0, sum: 0, count: 0 });
    const group = groups.get(key);
    group.x += item.estimated[0];
    group.y += item.estimated[1];
    group.sum += error;
    group.count++;
  }
  if (groups.size > 50) throw new Error('Número de alvos excede o limite do visualizador.');
  if (!data.residuals.length) throw new Error('O diagnóstico não contém resíduos de validação.');
  return {
    name,
    mode: data.mode,
    rmse: data.quality.validation_rmse,
    recomputed: Math.sqrt(total / data.residuals.length),
    basis: ['affine', 'quadratic'].includes(data.quality.basis)
      ? data.quality.basis
      : data.mode === 'motion'
        ? 'ridge'
        : 'não informado',
    cv: Number.isFinite(data.quality.training_cv_rmse) ? data.quality.training_cv_rmse : null,
    training: Array.isArray(data.features) ? data.features.length : 0,
    validation: data.residuals.length,
    outside,
    targets: [...groups.values()].map((g) => ({
      expected: g.expected,
      estimated: [g.x / g.count, g.y / g.count],
      error: g.sum / g.count,
      count: g.count,
    })),
  };
}
