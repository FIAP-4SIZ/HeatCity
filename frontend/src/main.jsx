import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { targets, validationTargets, eyeFeature, medianFeature, predict } from './gaze.js';
import './style.css';

async function api(path, body, method = 'POST') {
  const response = await fetch(`/api${path}`, {method, headers: {'Content-Type':'application/json'}, body: body ? JSON.stringify(body) : undefined});
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(typeof error.detail === 'string' ? error.detail : 'Não foi possível concluir a operação. Verifique a API.');
  }
  return response.status === 204 ? null : response.json();
}

function App() {
  const video = useRef(), stage = useRef(), runtime = useRef({}), runId = useRef(0);
  const [consent, setConsent] = useState(false), [camera, setCamera] = useState(false);
  const [busy, setBusy] = useState(false), [phase, setPhase] = useState('idle');
  const [message, setMessage] = useState('Ative a câmera para verificar o enquadramento.');
  const [quality, setQuality] = useState(false), [target, setTarget] = useState(null);
  const [progress, setProgress] = useState(0), [result, setResult] = useState(null);
  const [gaze, setGaze] = useState(null);

  function invalidate(text) {
    runId.current++;
    const state = runtime.current;
    state.collection = null; state.tracking = false;
    if (state.calibration?.calibration_id) api(`/calibrations/${state.calibration.calibration_id}`, null, 'DELETE').catch(() => {});
    state.calibration = null;
    clearTimeout(state.expiry);
    setResult(null); setTarget(null); setGaze(null); setPhase('idle');
    if (text) setMessage(text);
  }

  async function stop(text = 'Câmera desligada. Faça uma nova calibração para continuar.') {
    invalidate(text);
    const state=runtime.current;
    state.running=false;
    state.cameraRun=(state.cameraRun || 0)+1;
    cancelAnimationFrame(state.frame);
    state.stream?.getTracks().forEach(track=>track.stop());
    state.stream=null;
    setCamera(false); setQuality(false);
  }

  useEffect(() => {
    const resized = () => invalidate('A área de exibição mudou. Refaça a calibração.');
    const hidden = () => { if (document.hidden) stop('Captura interrompida ao sair da página.'); };
    window.addEventListener('resize', resized);
    document.addEventListener('visibilitychange', hidden);
    return () => {
      stop(); runtime.current.mesh?.close();
      window.removeEventListener('resize',resized);
      document.removeEventListener('visibilitychange',hidden);
    };
  }, []);

  async function startCamera() {
    setBusy(true); setMessage('Carregando detector e solicitando acesso à câmera…');
    const state=runtime.current;
    try {
      await state.inflight?.catch(()=>{});
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('A câmera exige HTTPS ou execução em localhost.');
      state.stream=await navigator.mediaDevices.getUserMedia({video:{width:640,height:480,facingMode:'user'},audio:false});
      video.current.srcObject=state.stream;
      await video.current.play();
      state.mesh ??= new window.FaceMesh({locateFile: file=>`/mediapipe/${file}`});
      state.mesh.setOptions({maxNumFaces:2,refineLandmarks:true,minDetectionConfidence:.6,minTrackingConfidence:.6});
      state.mesh.onResults(results=> {
        if (!state.running) return;
        const feature=eyeFeature(results.multiFaceLandmarks);
        setQuality(Boolean(feature));
        const now=performance.now();
        if (state.collection && feature && now-state.collection.since > 700) state.collection.samples.push(feature);
        if (state.tracking && state.calibration) {
          const point=feature ? predict(feature,state.calibration.coefficients) : null;
          setGaze(point?.every(v=>Number.isFinite(v)&&v>=0&&v<=1) ? point : null);
        }
      });
      state.running=true;
      const cameraRun=state.cameraRun=(state.cameraRun || 0)+1;
      state.stream.getVideoTracks()[0].onended=()=>stop('A câmera foi desconectada.');
      const tick=async()=> {
        if (!state.running || state.cameraRun!==cameraRun) return;
        try { state.inflight=state.mesh.send({image:video.current}); await state.inflight; }
        catch { await stop('Falha no detector. Desligue e tente novamente.'); return; }
        if (state.running && state.cameraRun===cameraRun) state.frame=requestAnimationFrame(tick);
      };
      await tick();
      setCamera(state.running);
      setMessage('Mantenha um único rosto visível, olhos abertos e a cabeça parada.');
    } catch(error) {
      await stop(error.name==='NotAllowedError' ? 'Permissão de câmera negada. Autorize no navegador e tente novamente.' : error.message);
    } finally { setBusy(false); }
  }

  async function calibrate() {
    invalidate();
    const id=runId.current, state=runtime.current;
    const payload={features:[],targets:[],validation_features:[],validation_targets:[]};
    setPhase('collecting'); setProgress(0);
    try {
      for (const [validation, points] of [[false,targets],[true,validationTargets]]) {
        for (const point of points) {
          if (runId.current!==id) return;
          setTarget(point); setMessage(`${validation ? 'Validação independente' : 'Calibração'}: olhe para o ponto, sem mover a cabeça.`);
          const collection={since:performance.now(), samples:[]}; state.collection=collection;
          await new Promise((resolve,reject)=> {
            const poll=()=> {
              if (runId.current!==id) { resolve(); return; }
              const elapsed=performance.now()-collection.since;
              if (elapsed>=2200 && collection.samples.length>=20) { resolve(); return; }
              if (elapsed>6000) { reject(new Error('Poucas amostras válidas. Ajuste a iluminação e tente novamente.')); return; }
              setTimeout(poll,50);
            }; poll();
          });
          state.collection=null;
          if (runId.current!==id) return;
          payload[validation?'validation_features':'features'].push(medianFeature(collection.samples));
          payload[validation?'validation_targets':'targets'].push(point);
          setProgress(v=>v+1);
        }
      }
      setTarget(null); setMessage('Avaliando erro em amostras independentes…');
      const response=await api('/calibrations/evaluate',payload);
      if (runId.current!==id) {
        if (response.calibration_id) api(`/calibrations/${response.calibration_id}`,null,'DELETE').catch(()=>{});
        return;
      }
      state.calibration=response; setResult(response); setPhase('result');
      setMessage(response.approved ? 'Calibração aprovada. A prévia do olhar está liberada.' : 'Calibração reprovada. Ajuste a postura e repita.');
      if (response.approved) state.expiry=setTimeout(()=>invalidate('Calibração expirada. Refaça antes de continuar.'),response.expires_in_seconds*1000);
    } catch(error) { if(runId.current===id) invalidate(error.message); }
  }

  async function preview() {
    const id=runId.current;
    try {
      await api('/tracking/preview',{calibration_id:result.calibration_id,consent});
      if (id!==runId.current) return;
      runtime.current.tracking=true; setPhase('tracking');
      setMessage('Prévia experimental: o círculo indica o olhar estimado. Nenhum dado é salvo.');
    } catch(error) { invalidate(error.message); }
  }

  const collecting=phase==='collecting';
  return <main>
    <header><a className="brand" href="/">Heat<span>City</span></a><span>LABORATÓRIO DE ATENÇÃO VISUAL</span></header>
    <section className="intro"><p className="eyebrow">01 / PREPARAÇÃO DO PARTICIPANTE</p><h1>Um olhar para cidades<br/>mais acessíveis.</h1><p>Calibre a estimativa de olhar antes de avaliar a sinalização.<br/>Um participante por vez, uma nova calibração a cada teste.</p></section>
    <div className="workspace">
      <aside><h2>Prepare seu espaço</h2><p>Use iluminação frontal, mantenha a cabeça estável e sente-se a uma distância confortável da tela.</p>
        <video ref={video} muted playsInline aria-label="Prévia da webcam"/>
        <p className={quality?'good':'muted'} aria-live="polite">{camera ? quality?'● Olhos detectados':'○ Posicione um único rosto e mantenha os olhos abertos':'○ Câmera desligada'}</p>
        <label><input type="checkbox" checked={consent} disabled={busy} onChange={e=>{setConsent(e.target.checked);if(!e.target.checked)stop('Consentimento retirado. Câmera desligada.');}}/> Concordo com o uso da câmera para este teste. Os frames são processados neste navegador, sem gravação ou envio.</label>
        <button disabled={!consent||busy||collecting} onClick={()=>camera?stop():startCamera()}>{busy?'Preparando…':camera?'Desligar câmera':'Ativar câmera'}</button>
        <p className="small">Apenas coordenadas oculares são enviadas à API na calibração. Nenhum vídeo ou imagem facial é armazenado. Uso acadêmico, sem precisão clínica garantida.</p>
      </aside>
      <section className="experiment"><div className="stage-head"><h2>{phase==='tracking'?'Prévia do olhar':'Calibração individual'}</h2><span>{progress}/14 pontos</span></div>
        <div ref={stage} className="stage" aria-label="Área de calibração">
          {target ? <div className="target" style={{left:`${target[0]*100}%`,top:`${target[1]*100}%`}}/> : phase==='tracking' ? <>{gaze && <div className="gaze" style={{left:`${gaze[0]*100}%`,top:`${gaze[1]*100}%`}}/>}<span className="stage-note">{gaze?'Estimativa em tempo real':'Sem estimativa válida'}</span></> : <div className="placeholder"><span>＋</span><h3>Olhe. Calibre. Avalie.</h3><p>Nove pontos de ajuste.<br/>Cinco pontos de validação independente.</p></div>}
        </div>
        <div className="feedback" role="status">{message}</div>
        {result && <p className={result.approved?'good':'error'}>Erro de validação: {result.validation_rmse.toFixed(3)} · Limite: 0.100 · {result.approved?'Aprovada':'Reprovada'}</p>}
        <div className="actions"><button disabled={!camera||!quality||collecting||busy} onClick={calibrate}>{result?'Refazer calibração':'Iniciar calibração'}</button><button className="secondary" disabled={!result?.approved||!camera||collecting||phase==='tracking'} onClick={preview}>Iniciar prévia</button>{collecting && <button className="secondary" onClick={()=>invalidate('Calibração cancelada.')}>Cancelar</button>}</div>
      </section>
    </div><footer>HeatCity / Global Solution FIAP · Estimativa experimental por webcam</footer>
  </main>;
}
createRoot(document.getElementById('root')).render(<App/>);
