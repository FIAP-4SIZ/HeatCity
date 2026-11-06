import { inspectEyes, EyeGate, calibrationFeature, predict, supportedHead } from './gaze.js';

let detectorLoader;
export async function loadFaceMesh() {
  if (window.FaceMesh) return;
  if (!detectorLoader)
    detectorLoader = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = '/mediapipe/face_mesh.js';
      script.onload = () =>
        window.FaceMesh ? resolve() : reject(new Error('Detector indisponível.'));
      script.onerror = () => {
        detectorLoader = null;
        script.remove();
        reject(new Error('Não foi possível carregar o detector local. Execute npm ci novamente.'));
      };
      document.head.append(script);
    });
  await detectorLoader;
}

// The video stays mounted and decoded; it never covers the stimulus.
export async function createCamera(video, onSample, onStatus, featureMode = 'fixed') {
  let running = true,
    stream,
    mesh,
    frame,
    inflight;
  const gate = new EyeGate();
  try {
    await loadFaceMesh();
    if (!navigator.mediaDevices?.getUserMedia)
      throw new Error('A câmera exige HTTPS ou localhost.');
    stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
      audio: false,
    });
    video.srcObject = stream;
    await video.play();
    mesh = new window.FaceMesh({ locateFile: (file) => `/mediapipe/${file}` });
    mesh.setOptions({
      maxNumFaces: 2,
      refineLandmarks: true,
      minDetectionConfidence: 0.6,
      minTrackingConfidence: 0.6,
    });
    mesh.onResults((result) => {
      if (!running) return;
      const inspection = inspectEyes(result.multiFaceLandmarks, featureMode === 'fixed');
      const time = performance.now();
      const valid = gate.update(inspection.feature, time);
      onStatus?.(inspection.reason);
      onSample(valid ? inspection.feature : null, time);
    });
    stream.getVideoTracks()[0].onended = () => {
      if (running) onStatus?.('Câmera desconectada; finalize e repita a sessão.');
    };
    const tick = async () => {
      if (!running) return;
      try {
        inflight = mesh.send({ image: video });
        await inflight;
      } catch {
        onSample(null, performance.now());
        onStatus?.('Falha no detector. Finalize e repita a sessão.');
      }
      if (running) frame = requestAnimationFrame(tick);
    };
    await tick();
    return async () => {
      running = false;
      cancelAnimationFrame(frame);
      stream.getTracks().forEach((t) => t.stop());
      await inflight?.catch(() => {});
      await mesh.close();
    };
  } catch (error) {
    running = false;
    stream?.getTracks().forEach((t) => t.stop());
    await mesh?.close();
    throw error;
  }
}
export function gazePoint(feature, model) {
  if (!feature || !supportedHead(feature, model)) return null;
  const point = predict(
    calibrationFeature(feature, model.feature_mode),
    model.coefficients,
    model.basis,
  );
  return point.every((n) => Number.isFinite(n) && n >= 0 && n <= 1) ? point : null;
}
