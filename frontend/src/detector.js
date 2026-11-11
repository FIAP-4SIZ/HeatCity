// Both calibration and live tracking use this adapter and the same landmark indices.
// A legacy detector remains available for comparison and existing installations.
export async function createDetector(options = {}) {
  const available = await fetch('/mediapipe/face_landmarker.task', { method: 'HEAD' });
  // Vite returns index.html for unknown files; never interpret that as a model.
  if (available.ok && !available.headers.get('content-type')?.includes('text/html')) {
    const { FaceLandmarker, FilesetResolver } = await import('@mediapipe/tasks-vision');
    const files = await FilesetResolver.forVisionTasks('/mediapipe/tasks');
    const detector = await FaceLandmarker.createFromOptions(files, {
      baseOptions: { modelAssetPath: '/mediapipe/face_landmarker.task', delegate: 'CPU' },
      runningMode: 'VIDEO',
      numFaces: 2,
      minFaceDetectionConfidence: options.minDetectionConfidence ?? 0.6,
      minFacePresenceConfidence: options.minTrackingConfidence ?? 0.6,
      minTrackingConfidence: options.minTrackingConfidence ?? 0.6,
    });
    let callback,
      timestamp = -1;
    return {
      engine: 'tasks-vision-1.2.2',
      onResults(fn) {
        callback = fn;
      },
      async send({ image }) {
        timestamp = Math.max(performance.now(), timestamp + 0.001);
        const result = detector.detectForVideo(image, timestamp);
        callback?.({ multiFaceLandmarks: result.faceLandmarks });
      },
      close() {
        detector.close();
      },
    };
  }
  const { loadFaceMesh } = await import('./camera.js');
  await loadFaceMesh();
  const mesh = new window.FaceMesh({ locateFile: (file) => `/mediapipe/${file}` });
  mesh.setOptions({ maxNumFaces: 2, refineLandmarks: true, ...options });
  mesh.engine = 'face-mesh-legacy';
  return mesh;
}
