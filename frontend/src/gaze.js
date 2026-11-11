export const referenceLevels = [0.05, 0.275, 0.5, 0.725, 0.95];
export const targets = referenceLevels.flatMap((y) => referenceLevels.map((x) => [x, y]));
export const sweepTargets = referenceLevels.flatMap((y, row) =>
  (row % 2 ? [...referenceLevels].reverse() : referenceLevels).map((x) => [x, y]),
);
export const validationTargets = [
  [0.2, 0.2],
  [0.8, 0.2],
  [0.5, 0.5],
  [0.2, 0.8],
  [0.8, 0.8],
  [0.08, 0.08],
  [0.5, 0.08],
  [0.92, 0.08],
  [0.08, 0.5],
  [0.92, 0.5],
  [0.08, 0.92],
  [0.5, 0.92],
  [0.92, 0.92],
];
export function sweepDuration(from, to) {
  return Math.max(1000, Math.hypot(to[0] - from[0], to[1] - from[1]) * 3000);
}
export function predict(feature, geometry) {
  if (!feature || geometry?.basis !== 'mesh') return [NaN, NaN];
  for (const cell of geometry.cells || []) {
    const anchors = cell.map((i) => geometry.anchors[i]);
    const [a, b, c] = anchors.map((p) => p.eye);
    const ux = b[0] - a[0],
      uy = b[1] - a[1],
      vx = c[0] - a[0],
      vy = c[1] - a[1];
    const px = feature[0] - a[0],
      py = feature[1] - a[1],
      det = ux * vy - uy * vx;
    if (Math.abs(det) < 1e-8) continue;
    const wb = (px * vy - py * vx) / det,
      wc = (ux * py - uy * px) / det,
      weights = [1 - wb - wc, wb, wc];
    if (Math.min(...weights) < -1e-7) continue;
    return [0, 1].map((axis) =>
      anchors.reduce((sum, p, i) => sum + weights[i] * p.screen[axis], 0),
    );
  }
  return [NaN, NaN];
}
export function inspectEyes(faces, classic = false, options = {}) {
  if (faces?.length !== 1)
    return {
      reason:
        faces?.length > 1
          ? 'Mantenha apenas um rosto na câmera.'
          : 'Centralize o rosto e ilumine-o pela frente.',
    };
  const aspect =
    Number.isFinite(options.frameAspect) && options.frameAspect > 0 ? options.frameAspect : 1;
  // Coordinates share the image width as unit before lengths, projections and rotations.
  const points = faces[0].map((p) => (p ? { ...p, y: p.y / aspect } : p));
  if (points.length < 478)
    return { reason: 'Íris não detectadas. Aproxime-se e evite reflexos nos óculos.' };
  const valid = (p) => p && Number.isFinite(p.x) && Number.isFinite(p.y);
  const features = [];
  for (const [eyeIndex, [a, b, upper, lower, iris]] of [
    [33, 133, 159, 145, 468],
    [362, 263, 386, 374, 473],
  ].entries()) {
    const [p, q, u, l, i] = [a, b, upper, lower, iris].map((index) => points[index]);
    if (![p, q, u, l, i].every(valid))
      return { reason: 'Olhos encobertos. Ajuste o enquadramento.' };
    const dx = q.x - p.x,
      dy = q.y - p.y,
      width = Math.hypot(dx, dy);
    if (width < (classic ? 0.015 : 0.022))
      return { reason: 'Aproxime-se: os olhos estão pequenos na imagem.' };
    const openness = Math.hypot(u.x - l.x, u.y - l.y) / width;
    if (
      openness < (options.thresholds?.[eyeIndex] ?? options.minOpenness ?? (classic ? 0.12 : 0.14))
    )
      return { reason: 'Piscada ou olhos parcialmente fechados: coleta pausada.', blink: true };
    features.push(
      ((i.x - p.x) * dx + (i.y - p.y) * dy) / (width * width),
      ((i.y - (p.y + q.y) / 2) * dx - (i.x - (p.x + q.x) / 2) * dy) / (width * width),
    );
  }
  const [left, right, nose] = [33, 263, 1].map((i) => points[i]);
  if (![left, right, nose].every(valid)) return { reason: 'Rosto parcialmente encoberto.' };
  const width = Math.hypot(right.x - left.x, right.y - left.y);
  if (width < 0.05) return { reason: 'Centralize o rosto sem girar demais a cabeça.' };
  const cx = (left.x + right.x) / 2,
    cy = (left.y + right.y) / 2;
  features.push(
    (nose.x - cx) / width,
    (nose.y - cy) / width,
    cx,
    cy,
    width,
    Math.atan2(right.y - left.y, right.x - left.x),
  );
  return {
    feature: features,
    reason: 'Olhos e posição da cabeça detectados. Pisque naturalmente.',
  };
}
export function eyeFeature(faces) {
  return inspectEyes(faces).feature || null;
}

// Blink recovery and rapid eye movement rejection, in seconds rather than frames.
export class EyeGate {
  previous = null;
  recoverUntil = 0;
  update(feature, time) {
    if (!feature) {
      this.previous = null;
      this.recoverUntil = time + 180;
      return false;
    }
    const old = this.previous;
    this.previous = { feature, time };
    if (time < this.recoverUntil) return false;
    if (
      old &&
      time > old.time &&
      time - old.time < 250 &&
      (Math.hypot(feature[0] - old.feature[0], feature[1] - old.feature[1]) * 1000) /
        (time - old.time) >
        4
    ) {
      this.recoverUntil = time + 100;
      return false;
    }
    return true;
  }
}
export function supportedHead(feature, model) {
  if (!model?.head_min) return true;
  const margins = [0.15, 0.15, 0.06, 0.06, 0.08, 0.2];
  return feature
    .slice(4)
    .every((v, i) => v >= model.head_min[i] - margins[i] && v <= model.head_max[i] + margins[i]);
}
export function medianFeature(samples) {
  return samples[0].map(
    (_, axis) => samples.map((s) => s[axis]).sort((a, b) => a - b)[Math.floor(samples.length / 2)],
  );
}

// Presentation timing is independent of frame validity and never admits bad data.
export class GuidanceFilter {
  badSince = null;
  goodSince = null;
  shownAt = -Infinity;
  current = { text: 'Enquadrando o rosto. Pisque naturalmente.', warning: false };
  update(issue, time) {
    if (issue) {
      this.goodSince = null;
      this.badSince ??= time;
      if (
        time - this.badSince >= 1200 &&
        time - this.shownAt >= 2000 &&
        this.current.text !== issue
      ) {
        this.current = { text: issue, warning: true };
        this.shownAt = time;
      }
    } else {
      this.badSince = null;
      this.goodSince ??= time;
      if (
        time - this.goodSince >= 600 &&
        time - this.shownAt >= 2000 &&
        this.current.text !==
          'Olhos detectados. Continue acompanhando o alvo e pisque naturalmente.'
      ) {
        this.current = {
          text: 'Olhos detectados. Continue acompanhando o alvo e pisque naturalmente.',
          warning: false,
        };
        this.shownAt = time;
      }
    }
    return this.current;
  }
}

export class EyeReadiness {
  lastSeen = -Infinity;
  update(feature, time) {
    if (feature) this.lastSeen = time;
    return time - this.lastSeen < 1200;
  }
}

export function calibrationFeature(feature) {
  return [(feature[0] + feature[2]) / 2, (feature[1] + feature[3]) / 2];
}
