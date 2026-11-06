export const targets = [0.1, 0.5, 0.9].flatMap(y => [0.1, 0.5, 0.9].map(x => [x, y]));
export const validationTargets = [[.2, .2], [.8, .2], [.5, .5], [.2, .8], [.8, .8]];

// Iris relative to eye corners; face rotation is not a substitute for gaze.
export function eyeFeature(faces) {
  if (faces?.length !== 1 || faces[0].length < 478) return null;
  const points = faces[0];
  const eyes = [[33, 133, 159, 145, 468], [362, 263, 386, 374, 473]];
  const features = eyes.map(([a, b, upper, lower, iris]) => {
    const [p, q, u, l, i] = [a, b, upper, lower, iris].map(index => points[index]);
    if (![p, q, u, l, i].every(v => v && Number.isFinite(v.x) && Number.isFinite(v.y))) return null;
    const dx = q.x - p.x, dy = q.y - p.y, width = Math.hypot(dx, dy);
    if (width < .015 || Math.hypot(u.x - l.x, u.y - l.y) / width < .12) return null;
    return [((i.x-p.x)*dx + (i.y-p.y)*dy)/(width*width),
      ((i.y-(p.y+q.y)/2)*dx - (i.x-(p.x+q.x)/2)*dy)/(width*width)];
  });
  return features.every(Boolean) ? [0, 1].map(axis => (features[0][axis] + features[1][axis]) / 2) : null;
}

export function predict(feature, coefficients) {
  return [0, 1].map(axis => feature[0]*coefficients[0][axis] + feature[1]*coefficients[1][axis] + coefficients[2][axis]);
}

export function medianFeature(samples) {
  return [0, 1].map(axis => samples.map(s => s[axis]).sort((a,b) => a-b)[Math.floor(samples.length/2)]);
}
