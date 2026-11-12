import { openCapture, framePump } from '../capture-quality.js';
import { PracticeMetrics, mouseAnchor, sceneEstimate } from '../practice-metrics.js';
import { MotionCapture } from '../motion-capture.js';
import { ReferenceCapture } from '../reference-capture.js';
import { analyzeSignals } from '../signal-analysis.js';
import SignalReport from '../components/SignalReport.jsx';
import { CalibrationArchive } from '../calibration-archive.js';
import CalibrationHistoryDownload from '../components/CalibrationHistoryDownload.jsx';
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
  attemptArchive,
  scenarioId,
  onReady,
  diagnosticsOnly = false,
  exploratory = false,
  onDiagnostic,
  registerSnapshot,
  registerPreviewLoader,
  devScenario,
}) {
  const localArchive = useRef(new CalibrationArchive());
  const archive = attemptArchive || localArchive.current;
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
  const [captureStatus, setCaptureStatus] = useState(null);
  const [mouseReference, setMouseReference] = useState(null),
    [practiceStats, setPracticeStats] = useState(null);
  const [signalAnalysis, setSignalAnalysis] = useState(null);
  const [sceneLayout, setSceneLayout] = useState(null),
    [sceneStatus, setSceneStatus] = useState(null),
    [practiceMap, setPracticeMap] = useState(null),
    [mapError, setMapError] = useState('');
  const [consent, setConsent] = useState(false),
    [progress, setProgress] = useState(0);
  const [dev, setDev] = useState({
    adaptive: true,
    minOpenness: 0.12,
    confidence: 0.6,
    filter: true,
    smoothing: 0.25,
    overlay: 'iris',
    mouseReference: false,
  });
  state.current.dev = dev;
  state.current.devScenario = devScenario;
  state.current.phase = phase;
  const collecting = phase === 'collecting' || phase === 'countdown';
  function archiveAttempt(report) {
    if (!diagnosticsOnly && !exploratory)
      archive.append({
        ...report,
        camera_capture: state.current.capture?.metadata,
        telemetry: state.current.pump?.stats.snapshot(),
      });
  }
  useEffect(() => {
    state.current.scenePoints = [];
    state.current.sceneRect = null;
    state.current.sceneId = devScenario?.id;
    state.current.practice = null;
    setPracticeStats(null);
    setSceneStatus(null);
    setPracticeMap(null);
  }, [devScenario?.id]);
  useEffect(
    () => () => {
      if (practiceMap) URL.revokeObjectURL(practiceMap);
    },
    [practiceMap],
  );
  function invalidate(text) {
    const s = state.current;
    s.generation++;
    if (s.pending?.status === 'collecting') {
      s.pending = {
        ...s.pending,
        status: 'interrupted',
        error: text || 'Coleta interrompida.',
        motion_capture: s.motion?.snapshot(),
        signal_analysis: analyzeSignals(s.pending.capture_details || []),
      };
      if (s.pending.features.length || s.pending.motion_capture?.samples.length)
        s.log.calibration(s.pending);
      archiveAttempt(s.pending);
      setSignalAnalysis(s.pending.signal_analysis);
    }
    s.collection = null;
    if (s.motion) s.motion.enabled = false;
    setCaptureStatus(null);
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
  async function stop(text = 'Câmera desligada. Recalibre ao reiniciar.') {
    invalidate(text);
    const s = state.current;
    s.running = false;
    s.pump?.stop();
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
    registerPreviewLoader?.(loadPreviewCalibration);
    registerSnapshot?.(() => ({
      ...state.current.log.snapshot(),
      incomplete_calibration: state.current.pending
        ? {
            ...state.current.pending,
            signal_analysis: analyzeSignals(state.current.pending.capture_details || []),
            motion_capture: state.current.motion?.snapshot(),
          }
        : null,
      detector: state.current.mesh?.engine || null,
      eye_geometry: state.current.eyeGeometry || 'pixel_v2',
      mouse_practice: state.current.practice?.snapshot() || null,
      practice_scene: state.current.devScenario
        ? {
            id: state.current.devScenario.id,
            name: state.current.devScenario.name,
            points: state.current.scenePoints || [],
          }
        : null,
      eye_profile: state.current.profile?.baseline || null,
      developer_options: { ...state.current.dev },
      camera_capture: state.current.capture?.metadata,
      telemetry: {
        ...state.current.pump?.stats.snapshot(),
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
        if (diagnosticsOnly && s.tracking && !s.collection && s.phase !== 'countdown') {
          s.tracking = false;
          s.reference = null;
          s.geometry = null;
          setGaze(null);
          setTarget(null);
          s.mouse = null;
          setMouseReference(null);
          setPhase(s.calibration ? 'result' : 'idle');
        } else if (s.pending?.status === 'failed') {
          invalidate(s.pending.error);
          setDiagnostic(s.pending);
          setSignalAnalysis(s.pending.signal_analysis);
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
    const escapePreview = (e) => {
      if (
        e.key === 'Escape' &&
        diagnosticsOnly &&
        state.current.tracking &&
        document.fullscreenElement === stage.current
      )
        document.exitFullscreen().catch(() => {});
    };
    document.addEventListener('keydown', escapePreview);
    document.addEventListener('fullscreenchange', full);
    window.addEventListener('resize', resize);
    document.addEventListener('visibilitychange', hidden);
    return () => {
      state.current.generation++;
      state.current.running = false;
      state.current.pump?.stop();
      state.current.stream?.getTracks().forEach((t) => t.stop());
      state.current.inflight?.finally(() => state.current.mesh?.close()).catch(() => {});
      clearTimeout(state.current.expiry);
      if (state.current.calibration?.calibration_id)
        request(`/calibrations/${state.current.calibration.calibration_id}`, null, 'DELETE').catch(
          () => {},
        );
      document.removeEventListener('keydown', escapePreview);
      document.removeEventListener('fullscreenchange', full);
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', hidden);
    };
  }, []);
  async function startCamera() {
    setBusy(true);
    const s = state.current;
    try {
      s.capture = await openCapture();
      s.stream = s.capture.stream;
      video.current.srcObject = s.stream;
      await video.current.play();
      s.mesh = await createDetector({
        minDetectionConfidence: diagnosticsOnly ? dev.confidence : 0.6,
        minTrackingConfidence: diagnosticsOnly ? dev.confidence : 0.6,
      });
      s.eyeGeometry = s.calibration?.eye_geometry || 'pixel_v2';
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
          frameAspect =
            s.eyeGeometry === 'pixel_v2' ? video.current.videoWidth / video.current.videoHeight : 1,
          eyes = s.profile.inspect(r.multiFaceLandmarks, now, frameAspect),
          adaptive = !diagnosticsOnly || s.dev.adaptive;
        const inspection =
          adaptive && !eyes.ready
            ? { reason: 'Ajustando abertura individual. Olhe à frente por dois segundos.' }
            : inspectEyes(
                r.multiFaceLandmarks,
                true,
                adaptive
                  ? { thresholds: eyes.thresholds, frameAspect }
                  : { minOpenness: s.dev.minOpenness, frameAspect },
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
        if (accepted) s.motion?.add(f, now);
        const declaredMouse =
          diagnosticsOnly && s.tracking && s.dev.mouseReference ? s.mouse : null;
        const mouseSettled = !!declaredMouse && now - declaredMouse.since >= 600;
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
        const declaredError =
          mouseSettled && accepted && point?.every(Number.isFinite)
            ? Math.hypot(point[0] - declaredMouse.target[0], point[1] - declaredMouse.target[1])
            : null;
        const shownError =
          mouseSettled && s.smoothed
            ? Math.hypot(
                s.smoothed[0] - declaredMouse.target[0],
                s.smoothed[1] - declaredMouse.target[1],
              )
            : null;
        const scene = sceneEstimate(
          s.smoothed,
          s.devScenario,
          s.sceneRect,
          s.calibration?.error_margin?.axes,
        );
        if (s.tracking && s.devScenario && now - (s.lastScenePoint || 0) >= 100) {
          s.lastScenePoint = now;
          if (scene?.inside) {
            s.scenePoints ||= [];
            s.scenePoints.push({
              time: (now - s.began) / 1000,
              x: scene.x,
              y: scene.y,
              valid: true,
            });
            if (s.scenePoints.length > 5000) s.scenePoints.shift();
          }
          setSceneStatus(scene);
        }
        if (mouseSettled && now - (s.lastPractice || 0) >= 100) {
          s.lastPractice = now;
          s.practice ||= new PracticeMetrics();
          s.practice.observe({
            time: now,
            reference: declaredMouse.target,
            raw: point?.every(Number.isFinite) ? point : null,
            shown: s.smoothed,
            scene,
          });
        }
        s.log.add(
          {
            phase: s.tracking ? 'tracking' : s.phase,
            accepted,
            features: f || null,
            raw_prediction: point?.every(Number.isFinite) ? point : null,
            prediction_supported: s.tracking ? !!point?.every(Number.isFinite) : null,
            filtered_prediction: s.tracking ? s.smoothed : null,
            expected:
              declaredMouse?.target ||
              s.reference?.target ||
              s.collection?.target ||
              s.displayTarget ||
              null,
            reference_source: declaredMouse
              ? declaredMouse.fixed
                ? 'guided_center'
                : 'mouse_declared'
              : s.collection || s.displayTarget
                ? 'calibration_target'
                : null,
            mouse_reference: declaredMouse?.target || null,
            mouse_stationary: mouseSettled,
            declared_reference_distance: declaredError,
            raw_declared_distance: declaredError,
            shown_declared_distance: shownError,
            scene_estimate: scene,
            eye_geometry: s.eyeGeometry,
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
            processed_fps: s.processingRate ?? null,
            camera_frame_rate: s.capture.settings.frame_rate ?? null,
            diagnostic_attempt: s.attempt || null,
          },
          now,
        );
        if (now - s.lastStats > 250) {
          s.lastStats = now;
          s.processingRate = s.pump?.stats.snapshot().processed_fps || 0;
          setPracticeStats(s.practice?.snapshot() || null);
          setMetrics({
            frames: s.frames,
            fps: s.processingRate,
            cameraFps: s.capture.settings.frame_rate,
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
      s.pump = framePump(
        video.current,
        async (time) => {
          s.frameTime = time;
          s.inflight = s.mesh.send({ image: video.current });
          await s.inflight;
        },
        () => stop('Falha no detector. Reinicie a câmera.'),
      );
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
    s.eyeGeometry = 'pixel_v2';
    s.profile = new EyeProfile();
    s.practice = null;
    s.mouse = null;
    setPracticeStats(null);
    setMouseReference(null);
    setBusy(true);
    setSignalAnalysis(null);
    setPhase('countdown');
    const details = [],
      payload = {
        mode: 'sweep',
        eye_geometry: s.eyeGeometry || 'pixel_v2',
        capture_settings: s.capture.settings,
        participant_code: participantCode,
        scenario_id: scenarioId,
        features: [],
        targets: [],
        validation_features: [],
        validation_targets: [],
        validation_samples: [],
      };
    s.motion = new MotionCapture();
    s.pending = {
      version: 6,
      record_type: 'incomplete_calibration',
      detector: s.mesh?.engine,
      eye_profile: s.profile?.baseline,
      status: 'collecting',
      ...payload,
      capture_details: details,
      geometry_checks: [],
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
      Object.assign(s.pending, {
        viewport_width: payload.viewport_width,
        viewport_height: payload.viewport_height,
        camera_capture: s.capture.metadata,
        eye_profile: s.profile.baseline,
      });
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
              s.motion.target(s.displayTarget, performance.now(), t < 1);
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
      const collect = async (point, reuseMotion = true) => {
        await move(point);
        current();
        const arrived = performance.now();
        const c = new ReferenceCapture(
          point,
          arrived,
          reuseMotion ? s.motion.near(point, arrived) : [],
        );
        s.collection = c;
        while (!c.complete) {
          current();
          if (c.evaluate(performance.now())) break;
          setCaptureStatus({ reason: c.reason, count: c.samples.length });
          await pause(80);
        }
        s.log.event('reference_accepted_automatically');
        current();
        s.collection = null;
        setCaptureStatus(null);
        return c;
      };
      for (let i = 0; i < sweepTargets.length; i++) {
        setMessage(
          `Referência ${i + 1}/${sweepTargets.length}: acompanhe o alvo. O sistema avança ao obter uma coleta estável.`,
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
          sample_timing: capture.samples.map((row) => ({
            relative_ms: Math.round(row.time - capture.arrived),
            moving: !!row.moving,
          })),
          accepted_by: 'automatic_stability',
          stability: capture.stability,
          motion_samples_used: capture.motionSamplesUsed || 0,
          accepted_at_ms: Math.round(capture.acceptedAt - s.began),
        });
        setProgress(i + 1);
        s.pending.signal_analysis = analyzeSignals(details);
        if ((i + 1) % 5 === 0) {
          for (let attempt = 0; attempt <= 2; attempt++) {
            const check = await request('/diagnostics/geometry', {
              features: payload.features,
              targets: payload.targets,
            });
            current();
            s.pending.geometry_checks.push({
              ...check,
              references: payload.features.length,
              retry: attempt,
            });
            if (check.valid) break;
            if (attempt === 2) {
              s.pending.affected_references = check.reference_indices;
              throw new Error(
                `Coleta interrompida na linha ${Math.floor(i / 5) + 1}: ${check.message} A análise de variação e separação dos sinais está disponível abaixo e no diagnóstico.`,
              );
            }
            const all = check.reference_indices || [];
            const recent = all.filter((index) => index >= i - 4);
            const indices = attempt === 0 && recent.length ? recent : all;
            if (!indices.length) throw new Error(check.message);
            for (const index of indices) {
              setMessage(
                `Recolhendo somente a região inconsistente: referência ${index + 1}/${payload.features.length}. Continue acompanhando o alvo.`,
              );
              const repeated = await collect(payload.targets[index], false);
              payload.features[index] = medianFeature(repeated.features.map(calibrationFeature));
              details[index] = {
                ...details[index],
                samples: repeated.features,
                sample_timing: repeated.samples.map((row) => ({
                  relative_ms: Math.round(row.time - repeated.arrived),
                  moving: !!row.moving,
                })),
                previous_reference: details[index],
                retry: attempt + 1,
                stability: repeated.stability,
                motion_samples_used: 0,
                accepted_at_ms: Math.round(repeated.acceptedAt - s.began),
              };
            }
          }
        }
      }
      s.motion.enabled = false;
      for (let i = 0; i < validationTargets.length; i++) {
        setMessage(
          `Conferência ${i + 1}/${validationTargets.length}: olhe para o alvo; o avanço é automático. Estes dados só medem erro.`,
        );
        const p = validationTargets[i],
          capture = await collect(p, false),
          samples = capture.features,
          pairs = samples.map(calibrationFeature);
        payload.validation_features.push(medianFeature(pairs));
        payload.validation_targets.push(p);
        payload.validation_samples.push(pairs);
        details.push({
          phase: 'validation',
          target: p,
          samples,
          sample_timing: capture.samples.map((row) => ({
            relative_ms: Math.round(row.time - capture.arrived),
            moving: !!row.moving,
          })),
          accepted_by: 'automatic_stability',
          stability: capture.stability,
          motion_samples_used: capture.motionSamplesUsed || 0,
          accepted_at_ms: Math.round(capture.acceptedAt - s.began),
        });
        setProgress(sweepTargets.length + i + 1);
      }
      s.displayTarget = null;
      setTarget(null);
      setMessage('Calculando interpolação geométrica e erro medido…');
      const response = await request(
        diagnosticsOnly
          ? '/diagnostics/calibration'
          : exploratory
            ? '/exploratory/calibrations'
            : '/calibrations/evaluate',
        payload,
      );
      current();
      s.attempt = (s.attempt || 0) + 1;
      s.calibration = {
        ...response,
        feature_mode: 'sweep',
        eye_geometry: s.eyeGeometry || 'pixel_v2',
        camera_binding: s.capture.binding,
        capture_settings: s.capture.settings,
        detector: s.mesh.engine,
        eye_profile: s.profile.baseline,
        viewport_width: payload.viewport_width,
        viewport_height: payload.viewport_height,
      };
      const quality = { ...response };
      delete quality.calibration_id;
      delete quality.expires_in_seconds;
      const report = {
        version: 6,
        camera_capture: s.capture.metadata,
        motion_capture: s.motion.snapshot(),
        geometry_checks: s.pending.geometry_checks,
        signal_analysis: analyzeSignals(details),
        confirmation_required: false,
        automatic_advance: true,
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
      s.pending = null;
      s.log.calibration(report);
      archiveAttempt(report);
      setDiagnostic(report);
      setSignalAnalysis(report.signal_analysis);
      onDiagnostic?.(report);
      setResult(response);
      setPhase('result');
      setMessage(
        response.approved
          ? 'Conferência geométrica aprovada. Verifique o tracking antes de usar.'
          : 'Conferência geométrica reprovada. A prévia permanece apenas para diagnóstico.',
      );
      if ((response.approved || exploratory) && !diagnosticsOnly)
        s.expiry = setTimeout(
          () => invalidate('Calibração expirada.'),
          response.expires_in_seconds * 1000,
        );
    } catch (e) {
      if (s.generation === id) {
        s.pending = {
          ...s.pending,
          status: 'failed',
          error: e.message,
          signal_analysis: analyzeSignals(details),
          motion_capture: s.motion.snapshot(),
        };
        s.log.calibration(s.pending);
        archiveAttempt(s.pending);
        invalidate(e.message);
        setDiagnostic(s.pending);
        setSignalAnalysis(s.pending.signal_analysis);
        if (document.fullscreenElement === stage.current)
          await document.exitFullscreen().catch(() => {});
      }
    } finally {
      if (s.generation === id) {
        s.collection = null;
        setBusy(false);
      } else setBusy(false);
    }
  }
  async function loadPreviewCalibration(source) {
    if (!diagnosticsOnly) throw new Error('Importação disponível somente no DEV.');
    const s = state.current;
    if (['collecting', 'countdown'].includes(s.phase))
      throw new Error('Encerre a coleta antes de importar uma malha.');
    setBusy(true);
    try {
      const payload = { mode: 'sweep', eye_geometry: source.eye_geometry || 'legacy_v1' };
      for (const key of [
        'features',
        'targets',
        'validation_features',
        'validation_targets',
        'validation_samples',
      ])
        if (source[key]) payload[key] = source[key];
      const response = await request('/diagnostics/calibration', payload);
      if (s.mesh && source.detector && s.mesh.engine !== source.detector)
        throw new Error('Detector diferente do arquivo. A malha não foi aplicada.');
      invalidate();
      s.eyeGeometry = payload.eye_geometry;
      s.profile = new EyeProfile();
      s.calibration = {
        ...response,
        eye_geometry: payload.eye_geometry,
        feature_mode: 'sweep',
        imported_preview: true,
        detector: source.detector,
      };
      s.practice = null;
      s.mouse = null;
      setPracticeStats(null);
      setMouseReference(null);
      s.attempt = (s.attempt || 0) + 1;
      s.log.calibration({
        ...payload,
        detector: source.detector,
        quality: response,
        record_type: 'imported_preview',
        diagnostic_attempt: s.attempt,
        capture_details: source.capture_details || [],
        source: 'imported_diagnostic',
        preview_only: true,
      });
      s.log.event('preview_geometry_imported');
      setResult(response);
      setMessage(
        'Malha importada apenas para inspeção DEV. Postura e precisão atuais não foram reconferidas; não libera sessão oficial.',
      );
    } finally {
      setBusy(false);
    }
  }
  function indicateMouse(event) {
    const s = state.current;
    if (!diagnosticsOnly || !s.tracking || !s.dev.mouseReference || s.mouse?.fixed) return;
    const rect = field.current.getBoundingClientRect();
    const point = [
      Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)),
      Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height)),
    ];
    const now = performance.now();
    s.mouse = mouseAnchor(s.mouse, point, now);
    if (now - (s.lastMouseDraw || 0) > 40) {
      s.lastMouseDraw = now;
      setMouseReference(point);
    }
  }
  async function preview() {
    const s = state.current;
    try {
      if (!diagnosticsOnly || !s.running) return false;
      await fullScreen();
      setPhase('tracking');
      await pause(50);
      if (
        s.calibration &&
        !s.calibration.imported_preview &&
        (field.current.clientWidth !== s.calibration.viewport_width ||
          field.current.clientHeight !== s.calibration.viewport_height)
      )
        throw new Error('A área da tela mudou. Refaça a varredura.');
      s.geometry = [field.current.clientWidth, field.current.clientHeight];
      if (s.devScenario) {
        const fw = field.current.clientWidth,
          fh = field.current.clientHeight,
          k = Math.min(fw / s.devScenario.width, fh / s.devScenario.height);
        s.sceneRect = {
          x: (fw - k * s.devScenario.width) / (2 * fw),
          y: (fh - k * s.devScenario.height) / (2 * fh),
          width: (k * s.devScenario.width) / fw,
          height: (k * s.devScenario.height) / fh,
        };
      } else s.sceneRect = null;
      setSceneLayout(s.sceneRect);
      if (s.sceneId !== s.devScenario?.id) {
        s.sceneId = s.devScenario?.id;
        s.scenePoints = [];
        setPracticeMap(null);
      }
      s.tracking = true;
      s.smoothed = null;
      s.mouse = null;
      setMouseReference(null);
      s.log.event(s.calibration ? 'tracking_start' : 'raw_eye_tracking_start');
      return true;
    } catch (e) {
      s.tracking = false;
      setPhase(s.calibration ? 'result' : 'idle');
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
    s.pump?.stop();
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
          {diagnosticsOnly && (
            <div className="dev-practice-controls">
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={dev.mouseReference}
                  onChange={(e) => {
                    setDev({ ...dev, mouseReference: e.target.checked });
                    state.current.mouse = null;
                    setMouseReference(null);
                  }}
                />
                Referência com mouse para prática e diagnóstico
              </label>
              <p className="small">
                Funciona na prévia DEV. O mouse registra onde você indica estar olhando; não
                substitui o olhar, não entra no estudo e não treina modelos.
              </p>
              <button
                className="secondary"
                onClick={() => {
                  state.current.practice = null;
                  state.current.scenePoints = [];
                  setPracticeMap(null);
                  setSceneStatus(null);
                  setPracticeStats(null);
                  state.current.log.event('mouse_practice_reset');
                }}
              >
                Reiniciar medidas da prática
              </button>
            </div>
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
              {progress}/{sweepTargets.length + validationTargets.length} · avanço automático por
              estabilidade
            </span>
          </div>
          <div
            ref={stage}
            className={`stage ${collecting || (phase === 'tracking' && !!state.current.calibration) ? 'immersive' : ''}`}
            aria-label="Área de calibração"
          >
            <div
              ref={field}
              className="visual-field"
              aria-label="Campo visual branco"
              onPointerMove={indicateMouse}
              onPointerLeave={() => {
                state.current.mouse = null;
                setMouseReference(null);
              }}
            >
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
                  {diagnosticsOnly && devScenario && sceneLayout && (
                    <div
                      className="dev-scene"
                      style={{
                        left: `${sceneLayout.x * 100}%`,
                        top: `${sceneLayout.y * 100}%`,
                        width: `${sceneLayout.width * 100}%`,
                        height: `${sceneLayout.height * 100}%`,
                      }}
                    >
                      <img src={devScenario.image} alt={devScenario.name} />
                      {devScenario.plates.map((p) => (
                        <div
                          key={p.name}
                          className="dev-scene-aoi"
                          style={{
                            left: `${p.x * 100}%`,
                            top: `${p.y * 100}%`,
                            width: `${p.width * 100}%`,
                            height: `${p.height * 100}%`,
                          }}
                        >
                          <span>{p.name}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {gaze && (
                    <div
                      className="gaze"
                      style={{ left: `${gaze[0] * 100}%`, top: `${gaze[1] * 100}%` }}
                    />
                  )}
                  {diagnosticsOnly && dev.mouseReference && mouseReference && (
                    <div
                      className="mouse-reference"
                      aria-label="Referência indicada pelo mouse"
                      style={{
                        left: `${mouseReference[0] * 100}%`,
                        top: `${mouseReference[1] * 100}%`,
                      }}
                    />
                  )}
                  {!state.current.calibration && (
                    <div className="raw-eye-tracking">
                      <h3>Olhos detectados, sem posição de olhar calibrada.</h3>
                      <p>Veja os landmarks na câmera e acompanhe as coordenadas abaixo.</p>
                      <p>
                        Íris:{' '}
                        {metrics?.features
                          ?.slice(0, 4)
                          .map((v) => v.toFixed(3))
                          .join(' / ') || 'aguardando detecção'}
                      </p>
                    </div>
                  )}
                  {diagnosticsOnly && dev.mouseReference && (
                    <div className="mouse-practice-note">
                      <div className="button-row">
                        <button
                          onClick={() => {
                            const s = state.current,
                              t = performance.now();
                            s.mouse = {
                              target: [0.5, 0.5],
                              anchor: [0.5, 0.5],
                              since: t,
                              fixed: true,
                            };
                            setMouseReference([0.5, 0.5]);
                            s.practice ||= new PracticeMetrics();
                            s.practice.beginCenter(t);
                          }}
                        >
                          Checar centro por 2 s
                        </button>
                        <button
                          onClick={() => {
                            state.current.mouse = null;
                            setMouseReference(null);
                            if (state.current.practice) state.current.practice.centerCapture = null;
                          }}
                        >
                          Liberar mouse
                        </button>
                      </div>
                      <strong>Azul: mouse indicado · verde: olhar estimado</strong>
                      <p>
                        Acompanhe o cursor com os olhos e pare por pelo menos 0,6 s. É referência
                        autodeclarada, não medição do olhar real. Não altera nem treina a
                        calibração.
                      </p>
                      {devScenario && (
                        <p>
                          Estimativa pontual: {sceneStatus?.plate || 'nenhuma placa'}. Margem
                          compatível com: {sceneStatus?.candidates?.join(', ') || 'indisponível'}.{' '}
                          {sceneStatus?.ambiguous
                            ? 'Ambíguo; não confirma placa.'
                            : 'Compatibilidade geométrica; não comprova atenção.'}
                        </p>
                      )}
                      {!!practiceStats?.center_checks?.length && (
                        <p>
                          Checagens centrais: {practiceStats.center_checks.length}. Deslocamento da
                          última leitura em relação à primeira:{' '}
                          {practiceStats.center_checks.at(-1).drift_from_first?.toFixed(3) ??
                            'indisponível'}
                          . Não corrige a estimativa.
                        </p>
                      )}
                      <p>
                        {practiceStats?.samples
                          ? `${practiceStats.samples} comparações · ${practiceStats.missing_predictions} sem previsão · erro bruto: ${practiceStats.mean_distance.toFixed(3)} · ponto verde: ${practiceStats.shown_mean_distance?.toFixed(3) ?? '—'} · oscilação recente: ${practiceStats.jitter_recent?.toFixed(3) ?? '—'} (tela normalizada)`
                          : 'Sem comparações disponíveis. É necessária uma malha e previsões válidas.'}
                      </p>
                    </div>
                  )}
                  <button
                    className="dev-exit-preview"
                    onClick={() => document.exitFullscreen().catch(() => {})}
                  >
                    Sair da prévia
                  </button>
                  <span className="diagnostic-watermark">
                    PRÉVIA DEV ·{' '}
                    {!state.current.calibration
                      ? 'SEM CALIBRAÇÃO · somente sinais e landmarks'
                      : state.current.calibration.imported_preview
                        ? 'MALHA IMPORTADA · postura não reconferida'
                        : result?.approved
                          ? 'Conferência aprovada'
                          : 'CALIBRAÇÃO REPROVADA'}{' '}
                    · sem previsão, nenhum ponto de olhar é desenhado · ESC volta
                  </span>
                </>
              ) : (
                <div className="placeholder">
                  <span>＋</span>
                  <h3>Acompanhe o alvo móvel.</h3>
                  <p>
                    Alvo lento, 25 referências e conferência dos cantos e bordas. O sistema avança
                    quando a coleta estabiliza.
                  </p>
                  <p>Sem regressão, classificação ou treinamento.</p>
                </div>
              )}
              {captureStatus && target && (
                <div
                  className="reference-status"
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
                  <span role="status" data-reference-status>
                    {captureStatus.reason}
                  </span>
                  <span>{guidance}</span>
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
                  Maior erro por alvo: {result.max_target_rmse.toFixed(3)} · cantos externos sem
                  limite individual; RMSE global, demais alvos e cobertura continuam exigidos.
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
              {!diagnosticsOnly && !exploratory && !collecting && (
                <CalibrationHistoryDownload archive={archive} />
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
                <button disabled={!camera || busy || collecting} onClick={preview}>
                  Mostrar tracking experimental
                </button>
              ) : (
                <button
                  disabled={
                    !(result?.approved || (exploratory && result?.calibration_id)) ||
                    !camera ||
                    busy ||
                    collecting
                  }
                  onClick={transfer}
                >
                  {exploratory
                    ? 'Usar somente no ensaio exploratório'
                    : 'Usar calibração no estudo'}
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
              <span>
                FPS processado: {metrics.fps.toFixed(1)} · Webcam negociada:{' '}
                {metrics.cameraFps || 'não informado'} fps
              </span>
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
      {diagnosticsOnly && devScenario && !collecting && phase !== 'tracking' && (
        <div className="panel">
          <h3>Mapa exploratório da prática</h3>
          <p>
            Somente estimativas oculares válidas dentro da imagem. Coordenadas do mouse não são
            usadas no mapa. Pontos fora da imagem não viram pontos na borda. Suavização visual: 8%
            da largura da imagem; não é medida de precisão. Cores não comprovam atenção.
          </p>
          <button
            className="secondary"
            disabled={
              !state.current.scenePoints?.length || state.current.sceneId !== devScenario.id
            }
            onClick={async () => {
              setMapError('');
              try {
                const response = await fetch(
                  `/api/scenarios/${devScenario.id}/diagnostic-heatmap?blur_fraction=0.08`,
                  {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(
                      state.current.scenePoints.map(({ x, y, valid }) => ({ x, y, valid })),
                    ),
                  },
                );
                if (!response.ok) throw new Error('Não foi possível gerar o mapa DEV.');
                const blob = await response.blob();
                setPracticeMap(URL.createObjectURL(blob));
              } catch (e) {
                setMapError(e.message);
              }
            }}
          >
            Gerar mapa exploratório desta prática
          </button>
          {mapError && <p role="alert">{mapError}</p>}
          {practiceMap && (
            <>
              <img
                className="exploratory-heatmap"
                src={practiceMap}
                alt="Mapa exploratório das estimativas da prática DEV"
              />
              <a download="heatcity-pratica-dev.png" href={practiceMap}>
                Baixar mapa DEV PNG
              </a>
            </>
          )}
        </div>
      )}
      {!collecting && phase !== 'tracking' && signalAnalysis && (
        <SignalReport analysis={signalAnalysis} />
      )}
    </section>
  );
}
