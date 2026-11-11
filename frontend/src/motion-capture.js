// Reuse only measurements acquired near a reference. No regression or assumed eye delay.
export class MotionCapture {
  enabled = true;
  history = [];
  samples = [];
  last = -Infinity;
  dropped = 0;
  radius = 0.025;
  target(point, time, moving) {
    if (!this.enabled) return;
    this.history.push({ point: [...point], time, moving });
    if (this.history.length > 5000) this.history.shift();
  }
  add(feature, time) {
    if (!this.enabled || time - this.last < 50) return;
    const target = this.history.findLast((entry) => entry.time <= time);
    if (!target?.moving) return;
    this.last = time;
    this.samples.push({
      feature: [...feature],
      target: [...target.point],
      time,
      target_time: target.time,
      moving: true,
    });
    if (this.samples.length > 2000) {
      this.samples.shift();
      this.dropped++;
    }
  }
  near(point, time) {
    const recent = this.samples.filter(
      (s) =>
        time >= s.time &&
        time - s.time <= 1200 &&
        Math.hypot(s.target[0] - point[0], s.target[1] - point[1]) <= this.radius,
    );
    return recent.length >= 3 ? recent : [];
  }
  snapshot() {
    return {
      samples: [...this.samples],
      radius: this.radius,
      dropped_samples: this.dropped,
      alignment: 'most recent rendered target at frame acquisition; no assumed pursuit delay',
    };
  }
}
