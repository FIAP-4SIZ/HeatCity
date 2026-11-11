export class DiagnosticLog {
  started = performance.now();
  samples = [];
  events = [];
  calibrations = [];
  dropped = 0;
  last = -Infinity;
  add(sample, time) {
    if (time - this.last < 100) return;
    this.last = time;
    if (this.samples.length >= 5000) {
      this.samples.shift();
      this.dropped++;
    }
    this.samples.push({ elapsed_ms: Math.round(time - this.started), ...sample });
  }
  event(type) {
    if (this.events.length >= 500) this.events.shift();
    this.events.push({ elapsed_ms: Math.round(performance.now() - this.started), type });
  }
  calibration(data) {
    if (this.calibrations.length >= 5) this.calibrations.shift();
    this.calibrations.push(data);
  }
  snapshot() {
    return {
      samples: [...this.samples],
      events: [...this.events],
      calibrations: [...this.calibrations],
      dropped_samples: this.dropped,
      max_samples: 5000,
      interval_ms: 100,
    };
  }
}
