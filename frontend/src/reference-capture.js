// Explicit confirmation of recent measurements, with no training or regression.
export class ReferenceCapture {
  constructor(target, since) {
    this.target = target;
    this.since = since;
    this.last = -Infinity;
    this.samples = [];
    this.confirmed = false;
  }
  prune(time) {
    this.samples = this.samples.filter((s) => time - s.time <= 1200);
  }
  push(feature, time) {
    if (this.confirmed || time - this.since < 300 || time - this.last < 50) return;
    this.last = time;
    this.samples.push({ feature: [...feature], time });
    this.prune(time);
  }
  ready(time) {
    this.prune(time);
    return (
      !this.confirmed &&
      time - this.since >= 900 &&
      this.samples.length >= 10 &&
      time - this.last <= 500
    );
  }
  confirm(time, source) {
    if (!this.ready(time)) return false;
    this.confirmed = true;
    this.confirmedAt = time;
    this.confirmedBy = source;
    this.features = this.samples.map((s) => s.feature);
    return true;
  }
}
