import React, { useEffect, useRef, useState } from 'react';
import { post } from '../api.js';
import { createCamera, gazePoint } from '../camera.js';
import Scene from '../components/Scene.jsx';

export default function RunSession({
  scenario,
  participant,
  target,
  consent,
  calibration,
  onComplete,
  onBack,
}) {
  const root = useRef(),
    image = useRef(),
    video = useRef(),
    state = useRef({ points: [], active: false });
  const [phase, setPhase] = useState('ready'),
    [remaining, setRemaining] = useState(15),
    [message, setMessage] = useState(
      'A sessão dura 15 segundos. Nenhuma imagem facial será salva.',
    ),
    [error, setError] = useState('');
  const [count, setCount] = useState(3),
    [coverage, setCoverage] = useState(0);
  const [retry, setRetry] = useState(false);
  useEffect(() => {
    const current = state.current;
    const interrupted = () => {
      if (current.active && (document.fullscreenElement !== root.current || document.hidden))
        cancel('Sessão interrompida. A calibração deve ser refeita após alteração da tela.');
    };
    document.addEventListener('fullscreenchange', interrupted);
    document.addEventListener('visibilitychange', interrupted);
    return () => {
      current.cancelled = true;
      current.active = false;
      clearInterval(current.timer);
      current.stop?.();
      if (current.session && !current.finished)
        post(`/sessions/${current.session.id}/abort`).catch(() => {});
      document.removeEventListener('fullscreenchange', interrupted);
      document.removeEventListener('visibilitychange', interrupted);
    };
  }, []);
  async function cancel(reason) {
    const current = state.current;
    current.cancelled = true;
    current.active = false;
    clearInterval(current.timer);
    await current.stop?.();
    if (current.session && !current.finished) {
      await post(`/sessions/${current.session.id}/abort`).catch(() => {});
      current.finished = true;
    }
    setRetry(true);
    setPhase('interrupted');
    setError(reason);
    if (document.fullscreenElement === root.current)
      await document.exitFullscreen().catch(() => {});
  }
  async function finish() {
    const current = state.current;
    if (!current.active) return;
    current.active = false;
    clearInterval(current.timer);
    setPhase('saving');
    await current.stop?.();
    current.payload = {
      duration: Math.max(0.1, Math.min(300, (performance.now() - current.started) / 1000)),
      points: current.points,
    };
    await save();
  }
  async function save() {
    const current = state.current;
    try {
      setError('');
      setPhase('saving');
      const result = await post(`/sessions/${current.session.id}/finish`, current.payload);
      current.finished = true;
      if (document.fullscreenElement === root.current)
        await document.exitFullscreen().catch(() => {});
      onComplete(result);
    } catch (e) {
      setError(e.message);
      setPhase('save-error');
    }
  }
  async function begin() {
    const current = state.current;
    try {
      setPhase('preparing');
      setError('');
      await root.current.requestFullscreen();
      current.stop = await createCamera(
        video.current,
        (feature, time) => {
          if (!current.active || !image.current || time - (current.last || 0) < 95) return;
          current.last = time;
          const gaze = gazePoint(feature, calibration),
            rect = image.current.getBoundingClientRect();
          const x = gaze ? (gaze[0] * window.innerWidth - rect.left) / rect.width : 0;
          const y = gaze ? (gaze[1] * window.innerHeight - rect.top) / rect.height : 0;
          const valid = !!gaze && x >= 0 && x <= 1 && y >= 0 && y <= 1;
          const elapsed = (time - current.started) / 1000;
          if (elapsed >= 0 && elapsed <= 300)
            current.points.push({ time: elapsed, x: valid ? x : 0, y: valid ? y : 0, valid });
        },
        setMessage,
        calibration.feature_mode,
        calibration.detector,
        calibration.eye_profile,
      );
      if (current.cancelled) {
        await current.stop();
        return;
      }
      setPhase('countdown');
      for (let i = 3; i > 0; i--) {
        setCount(i);
        await new Promise((resolve) => setTimeout(resolve, 1000));
        if (current.cancelled) return;
      }
      current.session = await post('/sessions', {
        participant,
        scenario_id: scenario.id,
        target,
        consent,
        mode: 'gaze',
        calibration_id: calibration.calibration_id,
        viewport_width: window.innerWidth,
        viewport_height: window.innerHeight,
      });
      if (current.cancelled) {
        await post(`/sessions/${current.session.id}/abort`);
        return;
      }
      current.started = performance.now();
      current.active = true;
      setPhase('running');
      current.timer = setInterval(() => {
        const left = Math.max(0, 15 - (performance.now() - current.started) / 1000);
        setRemaining(left);
        const points = current.points;
        setCoverage(points.length ? points.filter((p) => p.valid).length / points.length : 0);
        if (left === 0) finish();
      }, 100);
    } catch (e) {
      await cancel(
        e.name === 'NotAllowedError'
          ? 'Permita o acesso à câmera e tela cheia para continuar.'
          : e.message,
      );
    }
  }
  return (
    <section ref={root} className="run-session">
      <div className="run-instructions">
        <span className="eyebrow">PARTICIPANTE {participant}</span>
        <h2>Encontre a placa “{target}” com os olhos.</h2>
        <p>Não clique nas placas. Mantenha uma posição confortável.</p>
      </div>
      <div className="run-field">
        {phase === 'countdown' ? (
          <div className="run-count" role="timer">
            {count}
          </div>
        ) : (
          <div
            ref={image}
            className="run-image"
            style={{
              width: `min(100%, calc((100dvh - 210px) * ${scenario.width / scenario.height}))`,
            }}
          >
            <Scene scenario={scenario} showAreas={false} />
          </div>
        )}
      </div>
      <video className="processing-video" ref={video} muted playsInline aria-hidden="true" />
      <div className="run-footer">
        <span>
          {phase === 'running'
            ? `${Math.ceil(remaining)} s restantes · ${Math.round(coverage * 100)}% das amostras na cena`
            : phase === 'saving'
              ? 'Salvando sessão…'
              : phase === 'countdown'
                ? 'Prepare-se…'
                : message}
        </span>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        {phase === 'ready' && (
          <button className="primary" onClick={begin}>
            Iniciar sessão em tela cheia
          </button>
        )}
        {phase === 'save-error' && (
          <button className="primary" onClick={save}>
            Tentar salvar novamente
          </button>
        )}
        {(phase === 'running' || phase === 'preparing' || phase === 'countdown') && (
          <button className="secondary" onClick={() => cancel('Sessão cancelada pelo operador.')}>
            Interromper
          </button>
        )}
        {(phase === 'ready' || retry) && (
          <button className="secondary" onClick={onBack}>
            Voltar à preparação
          </button>
        )}
      </div>
    </section>
  );
}
