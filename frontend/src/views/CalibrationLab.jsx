import { ReferenceCapture } from '../reference-capture.js';
import React, { useEffect, useRef, useState } from 'react';
import { createDetector } from '../detector.js';
import { EyeProfile } from '../eye-profile.js';
import { DiagnosticLog } from '../diagnostic-log.js';
import {
  sweepTargets,
  sweepDuration,
  validationTargets,
  calibrationFeature,
  medianFeature,
  predict,
  inspectEyes,
  EyeGate,
  EyeReadiness,
  GuidanceFilter,
} from '../gaze.js';

async function request(path, body, method = 'POST') {
  const r = await fetch(`/api${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!r.ok) {
    const data = await r.json().catch(() => ({}));
    throw new Error(
      typeof data.detail === 'string' ? data.detail : 'Não foi possível concluir a calibração.',
    );
  }
  return r.status === 204 ? null : r.json();
}
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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
    overlay = useRef();
  const state = useRef({ log: new DiagnosticLog(), generation: 0, dev: {} });
  const [camera, setCamera] = useState(false),
    [busy, setBusy] = useState(false),
    [phase, setPhase] = useState('idle');
  const [quality, setQuality] = useState(false),
    [target, setTarget] = useState(null),
    [gaze, setGaze] = useState(null);
  const [countdown, setCountdown] = useState(null),
    [message, setMessage] = useState('Ative a câmera para conferir os olhos.'),
    [guidance, setGuidance] = useState('Olhe à frente com os olhos confortáveis.');
  const [result, setResult] = useState(null),
    [diagnostic, setDiagnostic] = useState(null),
    [metrics, setMetrics] = useState(null);
  const [confirmation, setConfirmation] = useState(null);
  const [consent, setConsent] = useState(false),
    [progress, setProgress] = useState(0);
  const [dev, setDev] = useState({
    adaptive: true,
    minOpenness: 0.12,
    confidence: 0.6,
    filter: true,
    smoothing: 0.25,
    overlay: 'iris',
  });
  state.current.dev = dev;
  state.current.phase = phase;
  const collecting = phase === 'collecting' || phase === 'countdown';
  function invalidate(text) {
    const s = state.current;
    s.generation++;
    s.collection = null;
    setConfirmation(null);
    s.tracking = false;
    s.reference = null;
    s.displayTarget = null;
    if (s.calibration?.calibration_id)
      request(`/calibrations/${s.calibration.calibration_id}`, null, 'DELETE').catch(() => {});
    s.calibration = null;
    s.geometry = null;
    clearTimeout(s.expiry);
    setResult(null);
    setDiagnostic(null);
    setTarget(null);
    setGaze(null);
    setCountdown(null);
    setPhase('idle');
    if (text) setMessage(text);
  }
  function confirmReference(source = 'button') {
    const s = state.current;
    if (s.collection?.confirm(performance.now(), source)) {
      s.log.event('reference_confirmed');
      setConfirmation(null);
    }
  }
  async function stop(text = 'Câmera desligada. Recalibre ao reiniciar.') {
    invalidate(text);
    const s = state.current;
    s.running = false;
    cancelAnimationFrame(s.frame);
    s.stream?.getTracks().forEach((t) => t.stop());
    s.stream = null;
    await s.inflight?.catch(() => {});
    await s.mesh?.close();
    s.mesh = null;
    s.log.event('camera_stop');
    setCamera(false);
    setQuality(false);
  }
  useEffect(() => {
    registerSnapshot?.(() => ({
      ...state.current.log.snapshot(),
      detector: state.current.mesh?.engine || null,
      eye_profile: state.current.profile?.baseline || null,
      developer_options: { ...state.current.dev },
      telemetry: {
        frames: state.current.frames || 0,
        valid_frames: state.current.validFrames || 0,
      },
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
        pixel_ratio: window.devicePixelRatio,
      },
      method: 'Referências medidas e interpolação geométrica; sem regressão ou treinamento.',
    }));
    const full = () => {
      const s = state.current;
      s.log.event(document.fullscreenElement ? 'fullscreen_enter' : 'fullscreen_exit');
      if (document.fullscreenElement !== stage.current) {
        if (diagnosticsOnly && s.calibration && !s.collection && s.phase !== 'countdown') {
          s.tracking = false;
          s.reference = null;
          s.geometry = null;
          setGaze(null);
          setTarget(null);
          setPhase('result');
        } else invalidate('Tela cheia encerrada. A coleta foi interrompida.');
      }
    };
    const resize = () => {
      const s = state.current;
      s.log.event('viewport_resize');
      if (
        document.fullscreenElement === stage.current &&
        s.geometry &&
        (s.geometry[0] !== field.current.clientWidth ||
          s.geometry[1] !== field.current.clientHeight)
      )
        invalidate('A área da tela mudou. Refaça a varredura.');
    };
    const hidden = () => {
      if (document.hidden) stop('Captura interrompida ao sair da página.');
    };
    const key = (event) => {
      if (!state.current.collection || !['Space', 'Enter'].includes(event.code)) return;
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(event.target?.tagName)) return;
      event.preventDefault();
      if (!event.repeat) confirmReference(event.code === 'Space' ? 'space' : 'enter');
    };
    document.addEventListener('keydown', key);
    document.addEventListener('fullscreenchange', full);
    window.addEventListener('resize', resize);
    document.addEventListener('visibilitychange', hidden);
    return () => {
      state.current.generation++;
      state.current.running = false;
      cancelAnimationFrame(state.current.frame);
      state.current.stream?.getTracks().forEach((t) => t.stop());
      state.current.inflight?.finally(() => state.current.mesh?.close()).catch(() => {});
      clearTimeout(state.current.expiry);
      if (state.current.calibration?.calibration_id)
        request(`/calibrations/${state.current.calibration.calibration_id}`, null, 'DELETE').catch(
          () => {},
        );
      document.removeEventListener('keydown', key);
      document.removeEventListener('fullscreenchange', full);
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', hidden);
    };
  }, []);
  async function startCamera() {
    setBusy(true);
    const s = state.current;
    try {
      if (!navigator.mediaDevices?.getUserMedia)
        throw new Error('A câmera exige HTTPS ou localhost.');
      s.stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
        audio: false,
      });
      video.current.srcObject = s.stream;
      await video.current.play();
      s.mesh = await createDetector({
        minDetectionConfidence: diagnosticsOnly ? dev.confidence : 0.6,
        minTrackingConfidence: diagnosticsOnly ? dev.confidence : 0.6,
      });
      s.profile = new EyeProfile();
      s.gate = new EyeGate();
      s.ready = new EyeReadiness();
      s.guide = new GuidanceFilter();
      s.frames = 0;
      s.validFrames = 0;
      s.began = performance.now();
      s.lastStats = 0;
      s.mesh.onResults((r) => {
        if (!s.running) return;
        const now = s.frameTime,
          eyes = s.profile.inspect(r.multiFaceLandmarks, now),
          adaptive = !diagnosticsOnly || s.dev.adaptive;
        const inspection =
          adaptive && !eyes.ready
            ? { reason: 'Ajustando abertura individual. Olhe à frente por dois segundos.' }
            : inspectEyes(
                r.multiFaceLandmarks,
                true,
                adaptive ? { thresholds: eyes.thresholds } : { minOpenness: s.dev.minOpenness },
              );
        const f = inspection.feature,
          accepted = diagnosticsOnly && !s.dev.filter ? !!f : s.gate.update(f, now);
        setQuality(s.ready.update(f, now));
        s.frames++;
        if (accepted) s.validFrames++;
        const issue = f
          ? null
          : inspection.blink
            ? 'Olhos fechados por mais tempo. Abra-os quando confortável.'
            : inspection.reason;
        setGuidance(s.guide.update(issue, now).text);
        if (s.collection && accepted) s.collection.push(f, now);
        const point = s.tracking && accepted ? predict(calibrationFeature(f), s.calibration) : null;
        if (point?.every(Number.isFinite)) {
          const alpha = s.dev.smoothing;
          s.smoothed = s.smoothed
            ? point.map((v, i) => alpha * v + (1 - alpha) * s.smoothed[i])
            : point;
          setGaze(s.smoothed);
        } else if (s.tracking) {
          s.smoothed = null;
          setGaze(null);
        }
        if (
          s.reference &&
          accepted &&
          point?.every(Number.isFinite) &&
          now - s.reference.since >= 600
        )
          s.reference.predictions.push(point);
        s.log.add(
          {
            phase: s.tracking ? 'tracking' : s.phase,
            accepted,
            features: f || null,
            raw_prediction: point?.every(Number.isFinite) ? point : null,
            prediction_supported: s.tracking ? !!point?.every(Number.isFinite) : null,
            filtered_prediction: s.tracking ? s.smoothed : null,
            expected: s.reference?.target || s.collection?.target || s.displayTarget || null,
            reference_stationary: !!s.collection,
            reason: accepted
              ? null
              : f
                ? 'Recuperação de piscada ou movimento rápido'
                : inspection.reason,
            openness: eyes.openness,
            thresholds: adaptive ? eyes.thresholds : [s.dev.minOpenness, s.dev.minOpenness],
            faces: r.multiFaceLandmarks?.length || 0,
            latency_ms: performance.now() - now,
            diagnostic_attempt: s.attempt || null,
          },
          now,
        );
        if (now - s.lastStats > 250) {
          s.lastStats = now;
          setMetrics({
            frames: s.frames,
            fps: (s.frames * 1000) / (now - s.began),
            valid: s.validFrames / s.frames,
            features: f,
            faces: r.multiFaceLandmarks?.length || 0,
          });
          const c = overlay.current;
          if (c) {
            c.width = video.current.videoWidth;
            c.height = video.current.videoHeight;
            const ctx = c.getContext('2d');
            ctx.clearRect(0, 0, c.width, c.height);
            if (s.dev.overlay !== 'off')
              for (const face of r.multiFaceLandmarks || [])
                for (let i = 0; i < face.length; i++) {
                  if (s.dev.overlay === 'iris' && i < 468) continue;
                  ctx.beginPath();
                  ctx.arc(
                    face[i].x * c.width,
                    face[i].y * c.height,
                    ((i >= 468 ? 2.5 : 1.5) * c.width) / (c.clientWidth || 180),
                    0,
                    Math.PI * 2,
                  );
                  ctx.fillStyle = i >= 468 ? '#ffcb4d' : '#55ebac';
                  ctx.fill();
                }
          }
        }
      });
      s.running = true;
      s.stream.getVideoTracks()[0].onended = () => stop('A câmera foi desconectada.');
      s.log.event('camera_start');
      const tick = async () => {
        if (!s.running) return;
        try {
          s.frameTime = performance.now();
          s.inflight = s.mesh.send({ image: video.current });
          await s.inflight;
        } catch {
          await stop('Falha no detector. Reinicie a câmera.');
          return;
        }
        if (s.running) s.frame = requestAnimationFrame(tick);
      };
      await tick();
      setCamera(s.running);
      setMessage(`Detector: ${s.mesh.engine}. Mantenha a cabeça confortável e estável.`);
    } catch (e) {
      await stop(e.name === 'NotAllowedError' ? 'Permissão de câmera negada.' : e.message);
    } finally {
      setBusy(false);
    }
  }
  async function fullScreen() {
    if (document.fullscreenElement !== stage.current) await stage.current.requestFullscreen();
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  }
  async function calibrate() {
    invalidate();
    const s = state.current,
      id = s.generation;
    setBusy(true);
    setPhase('countdown');
    const details = [],
      payload = {
        mode: 'sweep',
        participant_code: participantCode,
        scenario_id: scenarioId,
        features: [],
        targets: [],
        validation_features: [],
        validation_targets: [],
        validation_samples: [],
      };
    const current = () => {
      if (s.generation !== id || !s.running) throw new Error('Coleta interrompida.');
    };
    try {
      await fullScreen();
      for (let i = 3; i > 0; i--) {
        current();
        setCountdown(i);
        setMessage(`Prepare-se. Iniciando em ${i}…`);
        await pause(1000);
      }
      current();
      s.geometry = [field.current.clientWidth, field.current.clientHeight];
      payload.viewport_width = s.geometry[0];
      payload.viewport_height = s.geometry[1];
      setCountdown(null);
      setPhase('collecting');
      let last = [0.5, 0.5];
      const move = async (next) => {
        const from = last,
          start = performance.now(),
          duration = sweepDuration(from, next);
        await new Promise((resolve, reject) => {
          const step = () => {
            try {
              current();
              const t = Math.min(1, (performance.now() - start) / duration),
                ease = t * t * (3 - 2 * t);
              s.displayTarget = next.map((v, i) => from[i] + ease * (v - from[i]));
              setTarget(s.displayTarget);
              if (t < 1) requestAnimationFrame(step);
              else resolve();
            } catch (e) {
              reject(e);
            }
          };
          step();
        });
        last = next;
      };
      const collect = async (point) => {
        await move(point);
        current();
        const c = new ReferenceCapture(point, performance.now());
        s.collection = c;
        while (!c.confirmed) {
          current();
          setConfirmation({ ready: c.ready(performance.now()), count: c.samples.length });
          await pause(80);
        }
        current();
        s.collection = null;
        setConfirmation(null);
        return c;
      };
      for (let i = 0; i < sweepTargets.length; i++) {
        setMessage(
          `Referência ${i + 1}/${sweepTargets.length}: acompanhe o alvo. Confirme quando estiver olhando para ele.`,
        );
        const p = sweepTargets[i],
          capture = await collect(p),
          samples = capture.features;
        payload.features.push(medianFeature(samples.map(calibrationFeature)));
        payload.targets.push(p);
        details.push({
          phase: 'reference',
          target: p,
          samples,
          confirmed_by: capture.confirmedBy,
          confirmed_at_ms: Math.round(capture.confirmedAt - s.began),
        });
        setProgress(i + 1);
      }
      for (let i = 0; i < validationTargets.length; i++) {
        setMessage(
          `Conferência ${i + 1}/${validationTargets.length}: olhe para o alvo e confirme. Estes dados só medem erro.`,
        );
        const p = validationTargets[i],
          capture = await collect(p),
          samples = capture.features,
          pairs = samples.map(calibrationFeature);
        payload.validation_features.push(medianFeature(pairs));
        payload.validation_targets.push(p);
        payload.validation_samples.push(pairs);
        details.push({
          phase: 'validation',
          target: p,
          samples,
          confirmed_by: capture.confirmedBy,
          confirmed_at_ms: Math.round(capture.confirmedAt - s.began),
        });
        setProgress(sweepTargets.length + i + 1);
      }
      s.displayTarget = null;
      setTarget(null);
      setMessage('Calculando interpolação geométrica e erro medido…');
      const response = await request(
        diagnosticsOnly ? '/diagnostics/calibration' : '/calibrations/evaluate',
        payload,
      );
      current();
      s.attempt = (s.attempt || 0) + 1;
      s.calibration = {
        ...response,
        feature_mode: 'sweep',
        detector: s.mesh.engine,
        eye_profile: s.profile.baseline,
        viewport_width: payload.viewport_width,
        viewport_height: payload.viewport_height,
      };
      const quality = { ...response };
      delete quality.calibration_id;
      delete quality.expires_in_seconds;
      const report = {
        version: 4,
        confirmation_required: true,
        mode: 'sweep',
        detector: s.mesh.engine,
        ...payload,
        quality,
        eye_profile: s.profile.baseline,
        developer_options: diagnosticsOnly ? { ...s.dev } : undefined,
        capture_details: details,
        diagnostic_attempt: s.attempt,
        feature_schema: 'Média das duas posições relativas das íris; interpolação por triângulos',
        purpose: 'Medição geométrica experimental; sem treinamento',
        residuals: payload.validation_features.map((f, i) => {
          const p = predict(f, response),
            finite = p.every(Number.isFinite);
          return {
            expected: payload.validation_targets[i],
            estimated: finite ? p : null,
            unsupported: !finite,
            error: finite
              ? Math.hypot(
                  p[0] - payload.validation_targets[i][0],
                  p[1] - payload.validation_targets[i][1],
                )
              : null,
          };
        }),
      };
      s.log.calibration(report);
      setDiagnostic(report);
      onDiagnostic?.(report);
      setResult(response);
      setPhase('result');
      setMessage(
        response.approved
          ? 'Conferência geométrica aprovada. Verifique o tracking antes de usar.'
          : 'Conferência geométrica reprovada. A prévia permanece apenas para diagnóstico.',
      );
      if (response.approved && !diagnosticsOnly)
        s.expiry = setTimeout(
          () => invalidate('Calibração expirada.'),
          response.expires_in_seconds * 1000,
        );
    } catch (e) {
      if (s.generation === id) invalidate(e.message);
    } finally {
      if (s.generation === id) {
        s.collection = null;
        setBusy(false);
      } else setBusy(false);
    }
  }
  async function preview() {
    const s = state.current;
    try {
      await fullScreen();
      setPhase('tracking');
      await pause(50);
      if (!s.calibration) return false;
      if (
        field.current.clientWidth !== s.calibration.viewport_width ||
        field.current.clientHeight !== s.calibration.viewport_height
      )
        throw new Error('A área da tela mudou. Refaça a varredura.');
      s.geometry = [field.current.clientWidth, field.current.clientHeight];
      s.tracking = true;
      s.smoothed = null;
      s.log.event('tracking_start');
      return true;
    } catch (e) {
      s.tracking = false;
      setPhase('result');
      setMessage(e.message);
      return false;
    }
  }
  function exportCalibration() {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(diagnostic)], { type: 'application/json' }),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = 'heatcity-diagnostico-calibracao.json';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function transfer() {
    const s = state.current,
      geometry = s.calibration;
    s.calibration = null;
    clearTimeout(s.expiry);
    s.running = false;
    cancelAnimationFrame(s.frame);
    s.stream?.getTracks().forEach((t) => t.stop());
    s.inflight?.finally(() => s.mesh?.close()).catch(() => {});
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    onReady(geometry);
  }
  return (
    <section className={`calibration-lab ${diagnosticsOnly ? 'diagnostic-lab' : ''}`}>
      <div className="workspace">
        <aside>
          <h2>{diagnosticsOnly ? 'Câmera e controles DEV' : 'Prepare seu espaço'}</h2>
          <p>
            O MediaPipe detecta os olhos. A calibração usa somente referências medidas e
            interpolação geométrica, sem treinar modelo.
          </p>
          {diagnosticsOnly && (
            <fieldset className="dev-controls">
              <legend>Experimentos locais</legend>
              <label>
                Confiança de detecção / tracking
                <input
                  type="number"
                  min="0.3"
                  max="0.9"
                  step="0.1"
                  disabled={camera || busy}
                  value={dev.confidence}
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
                  disabled={camera || busy}
                  checked={dev.adaptive}
                  onChange={(e) => setDev({ ...dev, adaptive: e.target.checked })}
                />
                Ajustar abertura por olho automaticamente
              </label>
              <label>
                Abertura mínima das pálpebras
                <input
                  type="number"
                  min="0.03"
                  max="0.2"
                  step="0.01"
                  disabled={camera || busy}
                  value={dev.minOpenness}
                  onChange={(e) =>
                    setDev({
                      ...dev,
                      minOpenness: Math.min(0.2, Math.max(0.03, Number(e.target.value))),
                    })
                  }
                />
              </label>
              <p className="small">O limite manual só é usado com o ajuste automático desligado.</p>
              <label className="checkbox">
                <input
                  type="checkbox"
                  disabled={camera || busy}
                  checked={dev.filter}
                  onChange={(e) => setDev({ ...dev, filter: e.target.checked })}
                />
                Filtrar movimentos rápidos e recuperação de piscadas
              </label>
              <label>
                Landmarks na câmera
                <select
                  value={dev.overlay}
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
          <p>
            Olhe à frente por dois segundos, sem forçar a abertura dos olhos. Use luz frontal e
            mantenha a cabeça estável. Não há compensação aprendida de postura.
          </p>
          {
            <label className="checkbox">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => {
                  setConsent(e.target.checked);
                  if (!e.target.checked) stop('Consentimento retirado. Câmera desligada.');
                }}
              />
              Concordo com o uso da câmera para este teste, sem gravação de imagens.
            </label>
          }
          <button
            disabled={busy || (!camera && !consent)}
            onClick={() => (camera ? stop() : startCamera())}
          >
            {camera ? 'Desligar câmera' : 'Ativar câmera'}
          </button>
          <p className="small">
            Nenhuma imagem facial é enviada à API. Só coordenadas de calibração.
          </p>
        </aside>
        <section className="experiment">
          <div className="stage-head">
            <h2>Calibração por varredura geométrica</h2>
            <span>
              {progress}/{sweepTargets.length + validationTargets.length} · avanço somente ao
              confirmar
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
              ) : target ? (
                <div
                  className="target"
                  style={{ left: `${target[0] * 100}%`, top: `${target[1] * 100}%` }}
                />
              ) : phase === 'tracking' ? (
                <>
                  {gaze && (
                    <div
                      className="gaze"
                      style={{ left: `${gaze[0] * 100}%`, top: `${gaze[1] * 100}%` }}
                    />
                  )}
                  <span className="diagnostic-watermark">
                    PRÉVIA DEV ·{' '}
                    {result?.approved ? 'Conferência aprovada' : 'CALIBRAÇÃO REPROVADA'} · fora da
                    malha, a previsão é ocultada · ESC volta
                  </span>
                </>
              ) : (
                <div className="placeholder">
                  <span>＋</span>
                  <h3>Acompanhe o alvo móvel.</h3>
                  <p>
                    Alvo lento, 25 referências e conferência dos cantos e bordas. Você controla o
                    avanço.
                  </p>
                  <p>Sem regressão, classificação ou treinamento.</p>
                </div>
              )}
              {confirmation && target && (
                <div
                  className="reference-confirmation"
                  style={{
                    left: `clamp(min(165px, 45%), ${target[0] * 100}%, max(calc(100% - 165px), 55%))`,
                    top: `${target[1] * 100}%`,
                    transform:
                      target[1] > 0.65
                        ? 'translate(-50%, calc(-100% - 35px))'
                        : 'translate(-50%, 35px)',
                  }}
                >
                  <p>{message}</p>
                  <button
                    data-confirm-reference
                    disabled={!confirmation.ready}
                    onClick={() => confirmReference('button')}
                  >
                    Confirmar referência · Espaço ou Enter
                  </button>
                  <span role="status">
                    {confirmation.ready
                      ? 'Continue olhando para o alvo e confirme, sem olhar para o botão.'
                      : 'Aguardando amostras recentes dos olhos. Pisque naturalmente.'}
                  </span>
                  {!confirmation.ready && <span>{guidance}</span>}
                  <button
                    className="secondary"
                    onClick={() => {
                      invalidate('Coleta cancelada.');
                      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
                    }}
                  >
                    Cancelar
                  </button>
                </div>
              )}
            </div>
            <div className="camera-preview">
              <video ref={video} autoPlay muted playsInline />
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
              {Number.isFinite(result?.max_target_rmse) && (
                <p>
                  Maior erro por alvo: {result.max_target_rmse.toFixed(3)} · cada região precisa
                  atender ao limite 0,100.
                </p>
              )}
              {result?.unsupported_validation_samples > 0 && (
                <p>
                  {result.unsupported_validation_samples} quadros sem previsão na malha. O RMSE,
                  quando disponível, considera somente quadros com previsão; cobertura insuficiente
                  reprova.
                </p>
              )}
              {diagnostic && (
                <button className="secondary" onClick={exportCalibration}>
                  Baixar diagnóstico da calibração
                </button>
              )}
              {result && (
                <p>
                  RMSE{' '}
                  {Number.isFinite(result.validation_rmse)
                    ? result.validation_rmse.toFixed(3)
                    : 'indisponível'}{' '}
                  · Limite 0.100 · {result.approved ? 'Aprovada' : 'Reprovada'}
                </p>
              )}
              <button disabled={!camera || !quality || busy || collecting} onClick={calibrate}>
                {result ? 'Refazer calibração' : 'Iniciar calibração'}
              </button>
              {diagnosticsOnly ? (
                <button disabled={!result || !camera || busy || collecting} onClick={preview}>
                  Mostrar tracking experimental
                </button>
              ) : (
                <button
                  disabled={!result?.approved || !camera || busy || collecting}
                  onClick={transfer}
                >
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
          {diagnosticsOnly && metrics && (
            <div className="live-metrics" aria-label="Telemetria do detector">
              <span>FPS: {metrics.fps.toFixed(1)}</span>
              <span>Válidas: {(metrics.valid * 100).toFixed(0)}%</span>
              <span>Rostos: {metrics.faces}</span>
              <span>Frames: {metrics.frames}</span>
              <span>
                Features:{' '}
                {metrics.features?.map((v) => v.toFixed(3)).join(' · ') || 'indisponíveis'}
              </span>
            </div>
          )}
        </section>
      </div>
    </section>
  );
}
