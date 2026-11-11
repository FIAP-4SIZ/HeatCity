// Shared negotiation and decoded-frame scheduling. Never export device identifiers.
export async function openCapture(binding) {
  if (!navigator.mediaDevices?.getUserMedia) throw new Error('A câmera exige HTTPS ou localhost.');
  const initial = {
    width: binding?.width || 3840,
    height: binding?.height || 2160,
    frameRate: binding?.frameRate || 120,
  };
  const video = {
    width: { ideal: initial.width },
    height: { ideal: initial.height },
    frameRate: { ideal: initial.frameRate },
    facingMode: 'user',
  };
  if (binding?.deviceId) video.deviceId = { exact: binding.deviceId };
  let stream;
  const warnings = [];
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video, audio: false });
  } catch (error) {
    if (binding || !['OverconstrainedError', 'ConstraintNotSatisfiedError'].includes(error.name))
      throw error;
    warnings.push('Pedido inicial não aceito; captura iniciada com perfil compatível.');
    stream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        frameRate: { ideal: 30 },
        facingMode: 'user',
      },
      audio: false,
    });
  }
  const track = stream.getVideoTracks()[0];
  let caps = {};
  try {
    caps = track.getCapabilities?.() || {};
  } catch {
    warnings.push('Recursos avançados não informados pelo navegador.');
  }
  const maximum = (range, fallback) =>
    Number.isFinite(range?.max) && range.max > 0 ? range.max : fallback;
  const requested = binding
    ? initial
    : {
        width: maximum(caps.width, initial.width),
        height: maximum(caps.height, initial.height),
        frameRate: maximum(caps.frameRate, initial.frameRate),
      };
  const advanced = {};
  for (const key of ['focusMode', 'exposureMode', 'whiteBalanceMode'])
    if (caps[key]?.includes('continuous')) advanced[key] = 'continuous';
  const preferred = {
    width: { ideal: requested.width },
    height: { ideal: requested.height },
    frameRate: { ideal: requested.frameRate },
  };
  try {
    await track.applyConstraints({
      ...preferred,
      ...(Object.keys(advanced).length ? { advanced: [advanced] } : {}),
    });
  } catch {
    warnings.push('Nem todos os recursos máximos e controles automáticos foram aceitos.');
    try {
      await track.applyConstraints(preferred);
    } catch {
      warnings.push('Mantida a configuração de captura compatível.');
    }
  }
  const raw = track.getSettings(),
    settings = { width: raw.width, height: raw.height, frame_rate: raw.frameRate };
  if (!settings.width || !settings.height) {
    stream.getTracks().forEach((t) => t.stop());
    throw new Error('Não foi possível obter as dimensões da câmera.');
  }
  for (const [key, output] of [
    ['focusMode', 'focus_mode'],
    ['exposureMode', 'exposure_mode'],
    ['whiteBalanceMode', 'white_balance_mode'],
  ])
    if (raw[key]) settings[output] = raw[key];
  if (binding && (settings.width !== binding.width || settings.height !== binding.height)) {
    stream.getTracks().forEach((t) => t.stop());
    throw new Error('A resolução da câmera mudou desde a calibração. Recalibre.');
  }
  return {
    stream,
    settings,
    binding: {
      deviceId: raw.deviceId,
      width: raw.width,
      height: raw.height,
      frameRate: raw.frameRate,
    },
    metadata: {
      initial_request: initial,
      requested,
      settings,
      warnings,
      capabilities: { width: caps.width, height: caps.height, frame_rate: caps.frameRate },
    },
  };
}
export class FrameStats {
  started = performance.now();
  count = 0;
  recent = [];
  add(time, latency) {
    this.count++;
    this.recent.push({ time, latency });
    this.recent = this.recent.filter((f) => time - f.time <= 2000).slice(-240);
  }
  stop() {
    this.ended ??= performance.now();
  }
  snapshot() {
    const r = this.recent.filter((f) => (this.ended ?? performance.now()) - f.time <= 2000),
      intervals = r.slice(1).map((f, i) => f.time - r[i].time),
      sorted = [...r].map((f) => f.latency).sort((a, b) => a - b);
    return {
      processed_frames: this.count,
      processed_fps: r.length > 1 ? ((r.length - 1) * 1000) / (r.at(-1).time - r[0].time) : 0,
      average_fps:
        (this.count * 1000) / Math.max(1, (this.ended ?? performance.now()) - this.started),
      latency_p90_ms: sorted.length ? sorted[Math.floor((sorted.length - 1) * 0.9)] : 0,
      interval_p90_ms: intervals.length
        ? [...intervals].sort((a, b) => a - b)[Math.floor((intervals.length - 1) * 0.9)]
        : 0,
    };
  }
}
export function framePump(video, onFrame, onError) {
  let running = true,
    id,
    lastMedia = -Infinity;
  const stats = new FrameStats(),
    native = typeof video.requestVideoFrameCallback === 'function';
  const schedule = () => {
    if (running) id = native ? video.requestVideoFrameCallback(tick) : requestAnimationFrame(tick);
  };
  const tick = async (_, metadata) => {
    if (!running) return;
    const mediaTime = metadata?.mediaTime ?? video.currentTime;
    if (!Number.isFinite(mediaTime) || mediaTime <= lastMedia) {
      schedule();
      return;
    }
    lastMedia = mediaTime;
    const time = performance.now();
    try {
      await onFrame(time);
      stats.add(time, performance.now() - time);
    } catch (error) {
      running = false;
      stats.stop();
      await onError?.(error);
      return;
    }
    schedule();
  };
  schedule();
  return {
    stats,
    stop() {
      running = false;
      stats.stop();
      if (native) video.cancelVideoFrameCallback(id);
      else cancelAnimationFrame(id);
    },
  };
}
