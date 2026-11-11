// Deterministic collection checks; no learned model and no manual confirmation.
const median = (values) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
const center = (rows) => [0, 1, 2, 3].map((axis) => median(rows.map((r) => r.feature[axis])));
const distance = (a, b) => Math.hypot(...a.map((v, i) => v - b[i])) / Math.SQRT2;
export class ReferenceCapture {
  constructor(target, since, motionSamples = []) {
    this.target = target;
    this.arrived = since;
    this.since = motionSamples.length ? Math.min(since, motionSamples[0].time - 300) : since;
    this.collectAfter = since + (motionSamples.length ? 150 : 300);
    this.last = motionSamples.at(-1)?.time ?? -Infinity;
    this.samples = motionSamples.map((s) => ({ ...s, feature: [...s.feature], moving: true }));
    this.complete = false;
    this.reason = 'Aguardando amostras recentes dos olhos.';
  }
  prune(time) {
    this.samples = this.samples.filter((s) => time - s.time <= 1200);
  }
  push(feature, time) {
    if (!Array.isArray(feature) || feature.length < 4 || !feature.every(Number.isFinite)) return;
    if (this.complete || time < this.collectAfter || time - this.last < 50) return;
    this.last = time;
    this.samples.push({ feature: [...feature], time });
    this.prune(time);
  }
  evaluate(time) {
    if (this.complete) return true;
    this.prune(time);
    if (
      time - this.arrived < 300 ||
      time - this.since < 900 ||
      this.samples.length < 10 ||
      time - this.last > 250 ||
      this.samples.at(-1).time - this.samples[0].time < 600
    ) {
      this.reason = 'Aguardando amostras recentes dos olhos. Pisque naturalmente.';
      return false;
    }
    const middle = center(this.samples);
    const radii = this.samples
      .map((s) => distance(s.feature.slice(0, 4), middle))
      .sort((a, b) => a - b);
    const p90 = radii[Math.floor((radii.length - 1) * 0.9)],
      half = Math.floor(this.samples.length / 2);
    const drift = distance(center(this.samples.slice(0, half)), center(this.samples.slice(half)));
    const headShift = this.samples.every((s) => s.feature.length >= 8)
      ? Math.hypot(
          ...[6, 7].map(
            (axis) =>
              median(this.samples.slice(0, half).map((s) => s.feature[axis])) -
              median(this.samples.slice(half).map((s) => s.feature[axis])),
          ),
        )
      : 0;
    this.stability = {
      eye_p90: p90,
      eye_drift: drift,
      head_shift: headShift,
      limits: { eye_p90: 0.035, eye_drift: 0.02, head_shift: 0.005 },
    };
    if (p90 > 0.035 || drift > 0.02 || headShift > 0.005) {
      this.reason = 'Aguardando estabilidade dos olhos e da cabeça. Continue olhando para o alvo.';
      return false;
    }
    this.complete = true;
    this.acceptedAt = time;
    this.features = this.samples.map((s) => s.feature);
    this.motionSamplesUsed = this.samples.filter((s) => s.moving).length;
    this.reason = 'Referência registrada automaticamente.';
    return true;
  }
}
