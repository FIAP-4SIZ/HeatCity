export const targets = [0.1, 0.5, 0.9].flatMap((y) => [0.1, 0.5, 0.9].map((x) => [x, y]));
export const validationTargets = [
  [0.2, 0.2],
  [0.8, 0.2],
  [0.5, 0.5],
  [0.2, 0.8],
  [0.8, 0.8],
];
const path = [
  [0.1, 0.1],
  [0.9, 0.1],
  [0.1, 0.9],
  [0.9, 0.9],
  [0.5, 0.5],
];
export const PASS_MS = 12000;
export function trajectory(elapsed) {
  const position = Math.max(0, Math.min(1, elapsed / PASS_MS)) * (path.length - 1);
  const index = Math.min(path.length - 2, Math.floor(position)),
    fraction = position - index;
  return path[index].map((value, axis) => value + (path[index + 1][axis] - value) * fraction);
}

export function inspectEyes(faces, classic = false, options = {}) {
  if (faces?.length !== 1)
    return {
      reason:
        faces?.length > 1
          ? 'Mantenha apenas um rosto na câmera.'
          : 'Centralize o rosto e ilumine-o pela frente.',
    };
  const points = faces[0];
  if (points.length < 478)
    return { reason: 'Íris não detectadas. Aproxime-se e evite reflexos nos óculos.' };
  const valid = (p) => p && Number.isFinite(p.x) && Number.isFinite(p.y);
  const features = [];
  for (const [a, b, upper, lower, iris] of [
    [33, 133, 159, 145, 468],
    [362, 263, 386, 374, 473],
  ]) {
    const [p, q, u, l, i] = [a, b, upper, lower, iris].map((index) => points[index]);
    if (![p, q, u, l, i].every(valid))
      return { reason: 'Olhos encobertos. Ajuste o enquadramento.' };
    const dx = q.x - p.x,
      dy = q.y - p.y,
      width = Math.hypot(dx, dy);
    if (width < (classic ? 0.015 : 0.022))
      return { reason: 'Aproxime-se: os olhos estão pequenos na imagem.' };
    const openness = Math.hypot(u.x - l.x, u.y - l.y) / width;
    if (openness < (options.minOpenness ?? (classic ? 0.12 : 0.14)))
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
export function predict(feature, coefficients, basis = 'affine') {
  if (basis === 'quadratic') {
    const [x, y] = feature;
    feature = [x, y, x * x, x * y, y * y];
  }
  return [0, 1].map((axis) =>
    feature.reduce(
      (total, value, index) => total + value * coefficients[index][axis],
      coefficients.at(-1)[axis],
    ),
  );
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

export function calibrationFeature(feature, mode) {
  return mode === 'fixed'
    ? [(feature[0] + feature[2]) / 2, (feature[1] + feature[3]) / 2]
    : feature;
}
