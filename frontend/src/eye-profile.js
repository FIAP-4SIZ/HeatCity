// Personal eyelid geometry, never an ethnicity classifier. No images are retained.
export function eyeOpenness(faces, frameAspect = 1) {
  if (faces?.length !== 1 || faces[0].length < 478) return null;
  const aspect = Number.isFinite(frameAspect) && frameAspect > 0 ? frameAspect : 1;
  const face = faces[0].map((p) => (p ? { ...p, y: p.y / aspect } : p));
  const values = [];
  for (const [a, b, u, l] of [
    [33, 133, 159, 145],
    [362, 263, 386, 374],
  ]) {
    const points = [a, b, u, l].map((i) => face[i]);
    if (!points.every((p) => p && Number.isFinite(p.x) && Number.isFinite(p.y))) return null;
    const [p, q, upper, lower] = points;
    const width = Math.hypot(q.x - p.x, q.y - p.y);
    if (width < 0.015) return null;
    values.push(Math.hypot(upper.x - lower.x, upper.y - lower.y) / width);
  }
  return values;
}
export class EyeProfile {
  constructor(baseline = null) {
    this.baseline = baseline;
    this.samples = [];
    this.since = null;
  }
  inspect(faces, time, frameAspect = 1) {
    const openness = eyeOpenness(faces, frameAspect);
    if (!openness) return { ready: !!this.baseline, openness, thresholds: this.thresholds() };
    if (!this.baseline) {
      this.since ??= time;
      this.samples.push(openness);
      if (this.samples.length > 120) this.samples.shift();
      if (time - this.since >= 1500 && this.samples.length >= 30) {
        const candidate = [0, 1].map((axis) => {
          const sorted = this.samples.map((p) => p[axis]).sort((a, b) => a - b);
          return sorted[Math.floor((sorted.length - 1) * 0.9)];
        });
        // Near-zero landmarks cannot establish an open-eye reference.
        if (candidate.every((v) => v >= 0.025 && v <= 1)) this.baseline = candidate;
      }
    }
    return { ready: !!this.baseline, openness, thresholds: this.thresholds() };
  }
  thresholds() {
    return this.baseline?.map((value) => Math.max(0.008, value * 0.35));
  }
}
