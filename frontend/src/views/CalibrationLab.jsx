import { EyeProfile } from '../eye-profile.js';
import { DiagnosticLog } from '../diagnostic-log.js';
import { createDetector } from '../detector.js';
import React, { useEffect, useRef, useState } from 'react';
import {
  targets,
  precisionSequence,
  precisionValidation,
  validationTargets,
  medianFeature,
  predict,
  calibrationFeature,
  inspectEyes,
  trajectory,
  PASS_MS,
  EyeGate,
  GuidanceFilter,
  EyeReadiness,
} from '../gaze.js';

async function api(path, body, method = 'POST') {
  const response = await fetch(`/api${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(
      typeof error.detail === 'string'
        ? error.detail
        : 'Não foi possível concluir a operação. Verifique a API.',
    );
  }
  return response.status === 204 ? null : response.json();
}

export default function CalibrationLab({
  participantCode,
  scenarioId,
  onReady,
  diagnosticsOnly = false,
  onDiagnostic,
  registerSnapshot,
}) {
  const video = useRef(),
    stage = useRef(),
    field = useRef(),
    runtime = useRef({}),
    runId = useRef(0);
  const overlay = useRef();
  const [dev, setDev] = useState({
    adaptive: true,
    confidence: 0.6,
    minOpenness: 0.12,
    filter: true,
    overlay: 'iris',
    smoothing: 0.25,
  });
  const [metrics, setMetrics] = useState(null),
    [gaze, setGaze] = useState(null);
  runtime.current.dev = dev;
  if (diagnosticsOnly) runtime.current.log ??= new DiagnosticLog();
  const [consent, setConsent] = useState(false),
    [camera, setCamera] = useState(false);
  const [calibrationMode, setCalibrationMode] = useState('fixed');
  const [busy, setBusy] = useState(false),
    [phase, setPhase] = useState('idle');
  runtime.current.phase = phase;
  const [message, setMessage] = useState('Ative a câmera para verificar o enquadramento.');
  const [quality, setQuality] = useState(false),
    [target, setTarget] = useState(null);
  const [progress, setProgress] = useState(0),
    [result, setResult] = useState(null);
  const [diagnostic, setDiagnostic] = useState(null);
  const [countdown, setCountdown] = useState(null);
  const [visualWarning, setVisualWarning] = useState(false);
  const [guidance, setGuidance] = useState('Centralize o rosto e ilumine-o pela frente.');

  function invalidate(text) {
    runId.current++;
    const state = runtime.current;
    state.collection = null;
    state.tracking = false;
    state.geometry = null;
    if (state.calibration?.calibration_id)
      api(`/calibrations/${state.calibration.calibration_id}`, null, 'DELETE').catch(() => {});
    state.calibration = null;
    clearTimeout(state.expiry);
    setCountdown(null);
    setResult(null);
    setDiagnostic(null);
    setTarget(null);
    setGaze(null);
    setPhase('idle');
    if (text) setMessage(text);
  }

  async function stop(text = 'Câmera desligada. Faça uma nova calibração para continuar.') {
    invalidate(text);
    const state = runtime.current;
    state.log?.event('camera_stop');
    state.running = false;
    state.cameraRun = (state.cameraRun || 0) + 1;
    cancelAnimationFrame(state.frame);
    state.stream?.getTracks().forEach((track) => track.stop());
    state.stream = null;
    setCamera(false);
    setQuality(false);
    if (video.current) video.current.srcObject = null;
    if (overlay.current) {
      const context = overlay.current.getContext('2d');
      context.clearRect(0, 0, overlay.current.width, overlay.current.height);
    }
    if (diagnosticsOnly) setMetrics(null);
  }

  useEffect(() => {
    registerSnapshot?.(() => ({
      ...runtime.current.log.snapshot(),
      detector: runtime.current.mesh?.engine ?? null,
      eye_profile: runtime.current.eyeProfile?.baseline ?? null,
      developer_options: { ...runtime.current.dev },
      telemetry: {
        frames: runtime.current.frames || 0,
        valid_frames: runtime.current.validFrames || 0,
      },
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
        pixel_ratio: window.devicePixelRatio,
      },
      purpose: 'Diagnóstico local; tracking sem referência não mede precisão.',
    }));
    const resized = () => {
      runtime.current.log?.event('viewport_resize');
      const geometry = runtime.current.geometry;
      if (diagnosticsOnly && document.fullscreenElement !== stage.current) return;
      if (
        geometry &&
        (field.current.clientWidth !== geometry[0] || field.current.clientHeight !== geometry[1])
      )
        invalidate('A área de exibição mudou. Refaça a calibração.');
    };
    const fullscreen = () => {
      runtime.current.log?.event(
        document.fullscreenElement ? 'fullscreen_enter' : 'fullscreen_exit',
      );
      if (document.fullscreenElement !== stage.current) {
        if (diagnosticsOnly && runtime.current.calibration && !runtime.current.collection) {
          runtime.current.tracking = false;
          runtime.current.geometry = null;
          setGaze(null);
          setPhase('result');
        } else invalidate('Tela cheia encerrada. Refaça a calibração para continuar.');
      }
    };
    document.addEventListener('fullscreenchange', fullscreen);
    const hidden = () => {
      if (document.hidden) stop('Captura interrompida ao sair da página.');
    };
    window.addEventListener('resize', resized);
    document.addEventListener('visibilitychange', hidden);
    return () => {
      stop();
      runtime.current.mesh?.close();
      window.removeEventListener('resize', resized);
      document.removeEventListener('fullscreenchange', fullscreen);
      document.removeEventListener('visibilitychange', hidden);
    };
  }, []);

  async function startCamera() {
    setBusy(true);
    setMessage('Carregando detector e solicitando acesso à câmera…');
    const state = runtime.current;
    try {
      await state.inflight?.catch(() => {});
      if (!navigator.mediaDevices?.getUserMedia)
        throw new Error('A câmera exige HTTPS ou execução em localhost.');
      state.stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
        audio: false,
      });
      video.current.srcObject = state.stream;
      await video.current.play();
      await state.mesh?.close();
      state.mesh = await createDetector({
        maxNumFaces: 2,
        refineLandmarks: true,
        minDetectionConfidence: diagnosticsOnly ? state.dev.confidence : 0.6,
        minTrackingConfidence: diagnosticsOnly ? state.dev.confidence : 0.6,
      });
      state.featureMode = calibrationMode;
      state.eyeProfile = new EyeProfile();
      state.log?.event('camera_start');
      state.gate = new EyeGate();
      state.readiness = new EyeReadiness();
      state.guide = new GuidanceFilter();
      setVisualWarning(false);
      state.frames = 0;
      state.validFrames = 0;
      state.began = performance.now();
      state.lastStats = 0;
      state.mesh.onResults((results) => {
        if (!state.running) return;
        const eyes = state.eyeProfile.inspect(results.multiFaceLandmarks, state.frameTime);
        const adaptive = !diagnosticsOnly || state.dev.adaptive;
        const inspection =
          adaptive && !eyes.ready
            ? {
                reason:
                  'Ajustando abertura individual: olhe à frente por dois segundos, sem forçar os olhos.',
              }
            : inspectEyes(
                results.multiFaceLandmarks,
                state.featureMode !== 'motion',
                adaptive ? { thresholds: eyes.thresholds } : { minOpenness: state.dev.minOpenness },
              );
        const feature = inspection.feature;
        const now = state.frameTime;
        const accepted =
          diagnosticsOnly && !state.dev.filter ? !!feature : state.gate.update(feature, now);
        setQuality(state.readiness.update(feature, now));
        let issue = feature
          ? null
          : inspection.blink
            ? 'Olhos fechados por mais tempo. Abra-os quando estiver confortável.'
            : inspection.reason;
        const collection = state.collection;
        if (
          collection &&
          accepted &&
          now - collection.since > 900 &&
          now - (collection.last || 0) >= 50
        ) {
          const delta = collection.last ? Math.min(now - collection.last, 100) : 0;
          collection.last = now;
          collection.features.push(feature);
          collection.targets.push(
            collection.moving ? trajectory(Math.max(0, collection.clock - 150)) : collection.target,
          );
          if (collection.moving) collection.clock = Math.min(PASS_MS, collection.clock + delta);
        }
        state.frames++;
        if (accepted) state.validFrames++;
        let rawPoint = null;
        if (diagnosticsOnly && state.tracking && state.calibration) {
          const point = accepted
            ? predict(
                calibrationFeature(feature, state.calibration.feature_mode),
                state.calibration.coefficients,
                state.calibration.basis,
              )
            : null;
          rawPoint = point;
          if (point?.every(Number.isFinite)) {
            const alpha = state.dev.smoothing;
            state.smoothed = state.smoothed
              ? point.map((v, i) => alpha * v + (1 - alpha) * state.smoothed[i])
              : point;
            setGaze(state.smoothed);
          } else {
            state.smoothed = null;
            setGaze(null);
          }
        }
        state.log?.add(
          {
            phase: state.tracking ? 'tracking' : state.phase,
            accepted,
            reason: accepted
              ? null
              : feature
                ? 'Recuperação de piscada ou movimento rápido'
                : inspection.reason,
            features: feature || null,
            openness: eyes.openness,
            thresholds: adaptive ? eyes.thresholds : [state.dev.minOpenness, state.dev.minOpenness],
            raw_prediction: rawPoint,
            filtered_prediction: state.tracking ? state.smoothed : null,
            expected: state.collection?.moving ? null : state.collection?.target || null,
            faces: results.multiFaceLandmarks?.length || 0,
            latency_ms: performance.now() - now,
          },
          now,
        );
        if (diagnosticsOnly && performance.now() - state.lastStats > 250) {
          state.lastStats = performance.now();
          setMetrics({
            frames: state.frames,
            fps: (state.frames * 1000) / (state.lastStats - state.began),
            valid: state.validFrames / state.frames,
            latency: state.lastStats - now,
            faces: results.multiFaceLandmarks?.length || 0,
            features: feature,
          });
          const canvas = overlay.current;
          if (canvas) {
            canvas.width = video.current.videoWidth;
            canvas.height = video.current.videoHeight;
            const context = canvas.getContext('2d');
            context.clearRect(0, 0, canvas.width, canvas.height);
            if (state.dev.overlay !== 'off')
              for (const face of results.multiFaceLandmarks || []) {
                for (let i = 0; i < face.length; i++) {
                  if (
                    state.dev.overlay === 'iris' &&
                    ![
                      33, 133, 159, 145, 362, 263, 386, 374, 468, 469, 470, 471, 472, 473, 474, 475,
                      476, 477,
                    ].includes(i)
                  )
                    continue;
                  context.beginPath();
                  context.arc(
                    face[i].x * canvas.width,
                    face[i].y * canvas.height,
                    (i >= 468 ? 2.5 : 1.5) * (canvas.width / (canvas.clientWidth || 180)),
                    0,
                    Math.PI * 2,
                  );
                  context.fillStyle = i >= 468 ? '#ffcb4d' : '#55ebac';
                  context.fill();
                }
              }
          }
        }
        const display = state.guide.update(issue, now);
        setGuidance(display.text);
        setVisualWarning(display.warning);
      });
      state.running = true;
      const cameraRun = (state.cameraRun = (state.cameraRun || 0) + 1);
      state.stream.getVideoTracks()[0].onended = () => stop('A câmera foi desconectada.');
      const tick = async () => {
        if (!state.running || state.cameraRun !== cameraRun) return;
        try {
          state.frameTime = performance.now();
          state.inflight = state.mesh.send({ image: video.current });
          await state.inflight;
        } catch {
          await stop('Falha no detector. Desligue e tente novamente.');
          return;
        }
        if (state.running && state.cameraRun === cameraRun)
          state.frame = requestAnimationFrame(tick);
      };
      await tick();
      setCamera(state.running);
      setMessage(
        `Detector: ${state.mesh.engine}. Ajuste a câmera à altura dos olhos. Pisque naturalmente.`,
      );
    } catch (error) {
      await stop(
        error.name === 'NotAllowedError'
          ? 'Permissão de câmera negada. Autorize no navegador e tente novamente.'
          : error.message,
      );
    } finally {
      setBusy(false);
    }
  }

  async function calibrate() {
    invalidate();
    setPhase('countdown');
    setCountdown(3);
    const id = runId.current,
      state = runtime.current;
    state.featureMode = calibrationMode;
    const captureDetails = [];
    const payload = {
      detector: state.mesh?.engine,
      mode: calibrationMode,
      participant_code: participantCode,
      scenario_id: scenarioId,
      features: [],
      targets: [],
      validation_features: [],
      validation_targets: [],
    };
    try {
      if (document.fullscreenElement !== stage.current) await stage.current.requestFullscreen();
      if (runId.current !== id) return;
      setProgress(0);
      for (let remaining = 3; remaining > 0; remaining--) {
        if (runId.current !== id) return;
        setCountdown(remaining);
        setMessage(`Prepare-se. Iniciando em ${remaining}…`);
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
      if (runId.current !== id) return;
      state.geometry = [field.current.clientWidth, field.current.clientHeight];
      payload.viewport_width = state.geometry[0];
      payload.viewport_height = state.geometry[1];
      setCountdown(null);
      setPhase('collecting');
      const collect = async (moving, point, duration, minimum = 6) => {
        const collection = {
          since: performance.now(),
          features: [],
          targets: [],
          moving,
          target: point,
          clock: 0,
        };
        state.collection = collection;
        await new Promise((resolve, reject) => {
          const poll = () => {
            if (runId.current !== id) {
              resolve();
              return;
            }
            const elapsed = performance.now() - collection.since;
            setTarget(moving ? trajectory(collection.clock) : point);
            const enough = moving
              ? collection.clock >= PASS_MS && collection.features.length >= 120
              : elapsed >= duration && collection.features.length >= minimum;
            if (enough) {
              resolve();
              return;
            }
            if (elapsed > (moving ? 45000 : 6500)) {
              state.collection = null;
              reject(
                new Error(
                  `Coleta insuficiente: ${collection.features.length} amostras válidas (${moving ? 'mínimo 120 na trajetória' : `mínimo ${minimum} neste ponto`}). Verifique iluminação e enquadramento; a câmera pode estar processando lentamente.`,
                ),
              );
              return;
            }
            requestAnimationFrame(poll);
          };
          poll();
        });
        state.collection = null;
        if (runId.current !== id) return null;
        return collection;
      };
      const fixedPoints = calibrationMode === 'precision' ? precisionSequence() : targets;
      const heldPoints = calibrationMode === 'precision' ? precisionValidation : validationTargets;
      if (calibrationMode !== 'motion') {
        for (let index = 0; index < fixedPoints.length; index++) {
          setMessage(
            `Calibração ${index + 1}/${fixedPoints.length}: olhe para o ponto, sem seguir com a cabeça.`,
          );
          const collection = await collect(false, fixedPoints[index], 2200, 20);
          if (!collection) return;
          payload.features.push(
            medianFeature(
              collection.features.map((feature) => calibrationFeature(feature, calibrationMode)),
            ),
          );
          payload.targets.push(fixedPoints[index]);
          captureDetails.push({
            phase: 'training',
            target: fixedPoints[index],
            samples: collection.features,
          });
          setProgress(index + 1);
        }
      } else {
        setMessage('Acompanhe o alvo com os olhos. Pisque normalmente.');
        const training = await collect(true, null, PASS_MS);
        if (!training) return;
        payload.features.push(...training.features);
        payload.targets.push(...training.targets);
        setProgress(1);
      }
      for (let index = 0; index < heldPoints.length; index++) {
        setMessage(`Validação ${index + 1}/${heldPoints.length}: mantenha o olhar no ponto.`);
        const classic = calibrationMode !== 'motion';
        const collection = await collect(
          false,
          heldPoints[index],
          classic ? 2200 : 1500,
          classic ? 20 : 6,
        );
        if (!collection) return;
        if (classic) {
          payload.validation_features.push(
            medianFeature(
              collection.features.map((feature) => calibrationFeature(feature, calibrationMode)),
            ),
          );
          payload.validation_targets.push(heldPoints[index]);
        } else {
          payload.validation_features.push(...collection.features);
          payload.validation_targets.push(...collection.targets);
        }
        captureDetails.push({
          phase: 'validation',
          target: heldPoints[index],
          samples: collection.features,
        });
        setProgress(index + (classic ? fixedPoints.length + 1 : 2));
      }
      setTarget(null);
      setMessage('Avaliando erro em amostras independentes…');
      const response = await api(
        diagnosticsOnly ? '/diagnostics/calibration' : '/calibrations/evaluate',
        payload,
      );
      if (runId.current !== id) {
        if (response.calibration_id)
          api(`/calibrations/${response.calibration_id}`, null, 'DELETE').catch(() => {});
        return;
      }
      state.calibration = {
        ...response,
        detector: state.mesh.engine,
        eye_profile: state.eyeProfile.baseline,
        feature_mode: calibrationMode,
        viewport_width: payload.viewport_width,
        viewport_height: payload.viewport_height,
      };
      setResult(response);
      const quality = { ...response };
      delete quality.calibration_id;
      delete quality.expires_in_seconds;
      const detailed = {
        version: 2,
        capture_details: captureDetails,
        feature_schema: 'separate eyes x/y + nose yaw/pitch + eye midpoint x/y + eye span + roll',
        purpose: 'diagnóstico experimental, não comprovação de precisão humana',
        ...payload,
        quality,
        residuals: payload.validation_features.map((feature, index) => {
          const estimated = predict(feature, response.coefficients, response.basis);
          const expected = payload.validation_targets[index];
          return {
            expected,
            estimated,
            error: Math.hypot(estimated[0] - expected[0], estimated[1] - expected[1]),
          };
        }),
      };
      if (diagnosticsOnly) detailed.developer_options = { ...state.dev };
      detailed.eye_profile = state.eyeProfile.baseline;
      state.log?.calibration(detailed);
      setDiagnostic(detailed);
      onDiagnostic?.(detailed);
      setPhase('result');
      setMessage(
        response.approved
          ? 'Calibração aprovada. A prévia do olhar está liberada.'
          : 'Calibração reprovada. Ajuste a postura e repita.',
      );
      if (response.approved && !diagnosticsOnly)
        state.expiry = setTimeout(
          () => invalidate('Calibração expirada. Refaça antes de continuar.'),
          response.expires_in_seconds * 1000,
        );
    } catch (error) {
      if (runId.current === id) invalidate(error.message);
    }
  }

  async function previewDiagnostic() {
    const state = runtime.current;
    try {
      await stage.current.requestFullscreen();
      setPhase('tracking');
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      if (!state.calibration) return;
      if (
        field.current.clientWidth !== state.calibration.viewport_width ||
        field.current.clientHeight !== state.calibration.viewport_height
      )
        throw new Error('O tamanho da tela mudou. Recalibre nesta tela.');
      state.geometry = [field.current.clientWidth, field.current.clientHeight];
      state.log?.event('tracking_start');
      state.tracking = true;
      state.smoothed = null;
      setPhase('tracking');
    } catch (error) {
      state.tracking = false;
      setGaze(null);
      setPhase('result');
      setMessage(error.message);
    }
  }
  function transfer() {
    const value = runtime.current.calibration;
    runtime.current.calibration = null;
    clearTimeout(runtime.current.expiry);
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    onReady(value);
  }
  function exportDiagnostic() {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(diagnostic, null, 2)], { type: 'application/json' }),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = 'heatcity-diagnostico-calibracao.json';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const collecting = phase === 'collecting' || phase === 'countdown';
  return (
    <section className={`calibration-lab ${diagnosticsOnly ? 'diagnostic-lab' : ''}`}>
      <div className="workspace">
        <aside>
          <h2>{diagnosticsOnly ? 'Câmera e controles DEV' : 'Prepare seu espaço'}</h2>
          {diagnosticsOnly && (
            <fieldset className="dev-controls">
              <legend>Experimentos locais</legend>
              <p className="small">
                Ajuste antes de ativar a câmera. Não altera os critérios dos estudos.
              </p>
              <label>
                Confiança de detecção / tracking
                <input
                  type="number"
                  min="0.3"
                  max="0.9"
                  step="0.1"
                  value={dev.confidence}
                  disabled={camera || busy || collecting}
                  onChange={(e) =>
                    setDev({
                      ...dev,
                      confidence: Math.min(0.9, Math.max(0.3, Number(e.target.value))),
                    })
                  }
                />
              </label>
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={dev.adaptive}
                  disabled={camera || busy || collecting}
                  onChange={(e) => setDev({ ...dev, adaptive: e.target.checked })}
                />
                Ajustar abertura por olho automaticamente
              </label>
              <p className="small">
                Olhe à frente por dois segundos com os olhos confortáveis. O perfil é individual;
                não usa etnia. O limite manual abaixo só é usado com o ajuste automático desligado.
              </p>
              <label>
                Abertura mínima das pálpebras
                <input
                  type="number"
                  min="0.03"
                  max="0.2"
                  step="0.01"
                  value={dev.minOpenness}
                  disabled={camera || busy || collecting}
                  onChange={(e) =>
                    setDev({
                      ...dev,
                      minOpenness: Math.min(0.2, Math.max(0.03, Number(e.target.value))),
                    })
                  }
                />
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={dev.filter}
                  disabled={camera || busy || collecting}
                  onChange={(e) => setDev({ ...dev, filter: e.target.checked })}
                />{' '}
                Filtrar movimentos rápidos e recuperação de piscadas
              </label>
              <label>
                Landmarks na câmera
                <select
                  value={dev.overlay}
                  disabled={collecting}
                  onChange={(e) => setDev({ ...dev, overlay: e.target.value })}
                >
                  <option value="iris">Olhos e íris</option>
                  <option value="face">Rosto completo</option>
                  <option value="off">Ocultar landmarks</option>
                </select>
              </label>
              <label>
                Suavização visual da prévia
                <input
                  type="range"
                  min="0.05"
                  max="1"
                  step="0.05"
                  value={dev.smoothing}
                  onChange={(e) => setDev({ ...dev, smoothing: Number(e.target.value) })}
                />
              </label>
            </fieldset>
          )}
          <label>
            Método de calibração
            <select
              aria-label="Método de calibração"
              value={calibrationMode}
              disabled={collecting || busy}
              onChange={(e) => {
                invalidate('Método alterado. Faça uma nova calibração.');
                runtime.current.featureMode = e.target.value;
                setCalibrationMode(e.target.value);
              }}
            >
              <option value="precision">Precisão · pontos aleatórios + deriva</option>
              <option value="fixed">Pontos fixos · validação independente</option>
              <option value="motion">Rápida · alvo móvel</option>
            </select>
          </label>
          <p>
            Use luz difusa pela frente, câmera na altura dos olhos e distância de 40–70 cm. Evite
            contraluz e reflexos nas lentes. Aproxime-se se os olhos não forem reconhecidos.
          </p>

          <label>
            <input
              type="checkbox"
              checked={consent}
              disabled={busy}
              onChange={(e) => {
                setConsent(e.target.checked);
                if (!e.target.checked) stop('Consentimento retirado. Câmera desligada.');
              }}
            />{' '}
            Concordo com o uso da câmera para este teste. Os frames são processados neste navegador,
            sem gravação ou envio.
          </label>
          <button
            disabled={!consent || busy || collecting}
            onClick={() => (camera ? stop() : startCamera())}
          >
            {busy ? 'Preparando…' : camera ? 'Desligar câmera' : 'Ativar câmera'}
          </button>
          <p className="small">
            Apenas coordenadas oculares são enviadas à API na calibração. Nenhum vídeo ou imagem
            facial é armazenado. Uso acadêmico, sem precisão clínica garantida.
          </p>
        </aside>
        <section className="experiment">
          <div className="stage-head">
            <h2>Calibração individual</h2>
            <span>
              {progress}/
              {calibrationMode === 'precision' ? 38 : calibrationMode === 'fixed' ? 14 : 6} etapas ·{' '}
              {calibrationMode === 'precision'
                ? 'cerca de 90 s'
                : calibrationMode === 'fixed'
                  ? 'cerca de 35 s'
                  : 'tempo adaptativo'}
            </span>
          </div>
          <div
            ref={stage}
            className={`stage ${collecting || phase === 'tracking' ? 'immersive' : ''}`}
            aria-label="Área de calibração"
          >
            <div ref={field} className="visual-field" aria-label="Campo visual branco">
              {countdown !== null ? (
                <div className="countdown" role="timer" aria-label="Contagem regressiva">
                  {countdown}
                </div>
              ) : phase === 'tracking' ? (
                <>
                  {gaze && (
                    <div
                      className="gaze"
                      data-outside={gaze.some((v) => v < 0 || v > 1)}
                      style={{
                        left: `${Math.max(0, Math.min(1, gaze[0])) * 100}%`,
                        top: `${Math.max(0, Math.min(1, gaze[1])) * 100}%`,
                      }}
                    />
                  )}
                  <span className="diagnostic-watermark">
                    PRÉVIA DEV · {result?.approved ? 'RMSE aprovado' : 'CALIBRAÇÃO REPROVADA'} · ESC
                    volta ao diagnóstico
                  </span>
                </>
              ) : target ? (
                <div
                  className="target"
                  style={{ left: `${target[0] * 100}%`, top: `${target[1] * 100}%` }}
                />
              ) : (
                <div className="placeholder">
                  <span>＋</span>
                  <h3>Olhe. Calibre. Avalie.</h3>
                  <p>
                    {calibrationMode === 'precision'
                      ? '25 posições aleatórias e quatro repetições do centro.'
                      : calibrationMode === 'fixed'
                        ? 'Nove pontos fixos para comparar com o método inicial.'
                        : 'Um alvo móvel por 12 segundos.'}
                    <br />
                    {calibrationMode === 'precision'
                      ? 'Nove alvos de validação independente.'
                      : 'Cinco alvos de validação independente.'}
                  </p>
                </div>
              )}
            </div>
            <div
              className={`camera-preview ${visualWarning ? 'warning' : 'ready'}`}
              aria-label="Câmera com orientação em tempo real"
            >
              <video ref={video} muted playsInline aria-label="Prévia da webcam" />
              {diagnosticsOnly && (
                <canvas
                  ref={overlay}
                  className="landmark-canvas"
                  aria-label="Landmarks do detector"
                />
              )}
              <p className="camera-guidance" aria-live="polite">
                {camera ? guidance : 'Câmera desligada'}
              </p>
            </div>
            <div className="fullscreen-panel">
              <strong>{message}</strong>
              {diagnostic && (
                <button className="secondary" onClick={exportDiagnostic}>
                  Baixar diagnóstico da calibração
                </button>
              )}
              {result && (
                <p>
                  RMSE {result.validation_rmse.toFixed(3)} · Limite 0.100 ·{' '}
                  {result.approved ? 'Aprovada' : 'Reprovada'}
                </p>
              )}
              <button disabled={!camera || !quality || collecting || busy} onClick={calibrate}>
                {result ? 'Refazer calibração' : 'Iniciar calibração'}
              </button>
              {diagnosticsOnly ? (
                <button disabled={!result || !camera || collecting} onClick={previewDiagnostic}>
                  Mostrar tracking experimental
                </button>
              ) : (
                <button disabled={!result?.approved || !camera || collecting} onClick={transfer}>
                  Usar calibração no estudo
                </button>
              )}
              <button
                className="secondary"
                onClick={() => {
                  invalidate('Teste encerrado.');
                  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
                }}
              >
                Cancelar / Encerrar
              </button>
            </div>
          </div>
          <div className="feedback" role="status">
            {message}
          </div>
          {diagnosticsOnly && metrics && (
            <div className="live-metrics" aria-label="Telemetria do detector">
              <span>FPS: {metrics.fps.toFixed(1)}</span>
              <span>Processamento: {metrics.latency.toFixed(0)} ms</span>
              <span>Válidas: {(metrics.valid * 100).toFixed(0)}%</span>
              <span>Rostos: {metrics.faces}</span>
              <span>Frames: {metrics.frames}</span>
              <span>
                Features:{' '}
                {metrics.features?.map((v) => v.toFixed(3)).join(' · ') || 'indisponíveis'}
              </span>
            </div>
          )}
          {result && (
            <p className={result.approved ? 'good' : 'error'}>
              Erro de validação: {result.validation_rmse.toFixed(3)} · Limite: 0.100 ·{' '}
              {result.approved ? 'Aprovada' : 'Reprovada'}
            </p>
          )}
        </section>
      </div>
    </section>
  );
}
