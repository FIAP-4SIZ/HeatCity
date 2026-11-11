import { openCapture, framePump } from './capture-quality.js';
import { EyeProfile } from './eye-profile.js';
import { createDetector } from './detector.js';
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
export async function createCamera(
  video,
  onSample,
  onStatus,
  featureMode = 'fixed',
  expectedEngine,
  eyeBaseline,
  cameraBinding,
  eyeGeometry = 'legacy_v1',
) {
  let running = true,
    stream,
    mesh,
    pump,
    capture,
    acquired,
    inflight;
  const gate = new EyeGate();
  const profile = new EyeProfile(eyeBaseline);
  try {
    capture = await openCapture(cameraBinding);
    stream = capture.stream;
    video.srcObject = stream;
    await video.play();
    mesh = await createDetector({
      maxNumFaces: 2,
      refineLandmarks: true,
      minDetectionConfidence: 0.6,
      minTrackingConfidence: 0.6,
    });
    if (expectedEngine && mesh.engine !== expectedEngine)
      throw new Error('O detector mudou desde a calibração. Recalibre antes da sessão.');
    mesh.onResults((result) => {
      if (!running) return;
      const time = acquired;
      const frameAspect = eyeGeometry === 'pixel_v2' ? video.videoWidth / video.videoHeight : 1;
      const eyes = profile.inspect(result.multiFaceLandmarks, time, frameAspect);
      const inspection = eyes.ready
        ? inspectEyes(result.multiFaceLandmarks, featureMode !== 'motion', {
            thresholds: eyes.thresholds,
            frameAspect,
          })
        : { reason: 'Ajustando abertura individual: olhe à frente e pisque naturalmente.' };
      const valid = gate.update(inspection.feature, time);
      onStatus?.(inspection.reason);
      onSample(valid ? inspection.feature : null, time);
    });
    stream.getVideoTracks()[0].onended = () => {
      if (running) onStatus?.('Câmera desconectada; finalize e repita a sessão.');
    };
    pump = framePump(
      video,
      async (time) => {
        acquired = time;
        inflight = mesh.send({ image: video });
        await inflight;
      },
      () => {
        onSample(null, performance.now());
        onStatus?.('Falha no detector. Finalize e repita a sessão.');
      },
    );
    const stop = async () => {
      running = false;
      pump.stop();
      stream.getTracks().forEach((t) => t.stop());
      await inflight?.catch(() => {});
      await mesh.close();
    };
    stop.stats = () => pump.stats.snapshot();
    stop.capture = capture;
    return stop;
  } catch (error) {
    running = false;
    pump?.stop();
    stream?.getTracks().forEach((t) => t.stop());
    await mesh?.close();
    throw error;
  }
}
export function gazePoint(feature, model) {
  if (!feature || !supportedHead(feature, model)) return null;
  const point = predict(calibrationFeature(feature), model);
  return point.every((n) => Number.isFinite(n) && n >= 0 && n <= 1) ? point : null;
}
