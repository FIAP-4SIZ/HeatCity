// Descriptive practice statistics. No gaze correction, fitting or authorization.
const pair = (p) => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite);
const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
export function mouseAnchor(previous, target, time) {
  const moved = !previous || distance(target, previous.anchor || previous.target) > 0.003;
  return {
    target: [...target],
    anchor: moved ? [...target] : previous.anchor || previous.target,
    since: moved ? time : previous.since,
  };
}
export function sceneEstimate(point, scenario, rect, margin) {
  if (!pair(point) || !scenario || !rect) return null;
  const [x, y] = [(point[0] - rect.x) / rect.width, (point[1] - rect.y) / rect.height];
  const inside = x >= 0 && x <= 1 && y >= 0 && y <= 1;
  const plate = inside
    ? scenario.plates.find((p) => x >= p.x && x <= p.x + p.width && y >= p.y && y <= p.y + p.height)
        ?.name || null
    : null;
  const axes = pair(margin) ? [margin[0] / rect.width, margin[1] / rect.height] : null;
  const candidates =
    inside && axes
      ? scenario.plates
          .filter(
            (p) =>
              x + axes[0] >= p.x &&
              x - axes[0] <= p.x + p.width &&
              y + axes[1] >= p.y &&
              y - axes[1] <= p.y + p.height,
          )
          .map((p) => p.name)
      : [];
  return {
    x,
    y,
    inside,
    plate,
    candidates,
    margin_known: !!axes,
    ambiguous: !axes || candidates.length !== 1,
  };
}
export class PracticeMetrics {
  centers = [];
  centerCapture = null;
  beginCenter(time) {
    this.centerCapture = { since: time, points: [] };
  }
  observations = 0;
  samples = 0;
  error_sum = 0;
  shown_samples = 0;
  shown_error_sum = 0;
  recent = [];
  plate_counts = {};
  ambiguous = 0;
  observe({ time, reference, raw, shown, scene }) {
    this.observations++;
    if (this.centerCapture) {
      if (distance(reference, [0.5, 0.5]) > 0.008) this.centerCapture = null;
      else {
        if (pair(shown)) this.centerCapture.points.push([...shown]);
        if (time - this.centerCapture.since >= 2000) {
          const rows = this.centerCapture.points;
          const mean =
            rows.length >= 6
              ? [0, 1].map((i) => rows.reduce((s, p) => s + p[i], 0) / rows.length)
              : null;
          const first = this.centers.find((c) => c.mean)?.mean;
          this.centers.push({
            samples: rows.length,
            mean,
            drift_from_first: mean && first ? distance(mean, first) : null,
            status: mean ? 'measured' : 'insufficient',
          });
          this.centers = this.centers.slice(-20);
          this.centerCapture = null;
        }
      }
    }
    if (pair(raw)) {
      this.samples++;
      this.error_sum += distance(raw, reference);
    }
    if (pair(shown)) {
      this.shown_samples++;
      this.shown_error_sum += distance(shown, reference);
      if (
        this.recent.length &&
        (distance(reference, this.recent[0].reference) > 0.008 ||
          time - this.recent.at(-1).time > 400)
      )
        this.recent = [];
      this.recent.push({ time, reference: [...reference], point: [...shown] });
      this.recent = this.recent.filter((r) => time - r.time <= 2000).slice(-25);
    } else this.recent = [];
    if (scene?.inside) {
      if (scene.plate) this.plate_counts[scene.plate] = (this.plate_counts[scene.plate] || 0) + 1;
      if (scene.ambiguous) this.ambiguous++;
    }
  }
  snapshot() {
    const mean = this.recent.length
      ? [0, 1].map((i) => this.recent.reduce((s, r) => s + r.point[i], 0) / this.recent.length)
      : null;
    return {
      version: 2,
      observations: this.observations,
      samples: this.samples,
      error_sum: this.error_sum,
      mean_distance: this.samples ? this.error_sum / this.samples : null,
      shown_samples: this.shown_samples,
      shown_mean_distance: this.shown_samples ? this.shown_error_sum / this.shown_samples : null,
      missing_predictions: this.observations - this.shown_samples,
      jitter_recent:
        mean && this.recent.length >= 3
          ? Math.sqrt(
              this.recent.reduce((s, r) => s + distance(r.point, mean) ** 2, 0) /
                this.recent.length,
            )
          : null,
      recent_samples: this.recent.length,
      center_checks: structuredClone(this.centers),
      center_check_running: !!this.centerCapture,
      plate_counts: { ...this.plate_counts },
      ambiguous_scene_samples: this.ambiguous,
      mean_distance_source: 'raw_prediction',
      shown_distance_source: 'filtered_prediction',
      reference_type: 'declared_reference',
      use: 'diagnostic_only_no_training',
    };
  }
}
