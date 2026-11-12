import { mediaTimeForCapture } from '../video-frame.js';
import AnalysisReport from '../components/AnalysisReport.jsx';
import PlateCrops from '../components/PlateCrops.jsx';
import ReferenceEditor from './ReferenceEditor.jsx';
import { loadReferences, uploadProject } from '../references.js';
import React, { useEffect, useRef, useState } from 'react';
import { post, number } from '../api.js';
import Scene from '../components/Scene.jsx';
import { summarizeTracking, csvTracking, MAX_GAP_SECONDS } from '../sign-tracking.js';

const labels = {
  detected: 'Detectada',
  ambiguous: 'Ambígua',
  not_found: 'Não localizada',
  conflict: 'Conflito de identidade',
};
function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
async function imageHash(image) {
  const raw = Uint8Array.from(atob(image.split(',')[1]), (c) => c.charCodeAt(0));
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', raw))]
    .map((x) => x.toString(16).padStart(2, '0'))
    .join('');
}
export default function SignDetection({ referenceId }) {
  const [scenarios, setScenarios] = useState([]),
    [selected, setSelected] = useState('');
  const [phase, setPhase] = useState('prepare');
  const [inputMode, setInputMode] = useState(referenceId ? 'custom' : 'choose');
  const [editingProject, setEditingProject] = useState(null);
  const [source, setSource] = useState(null),
    [ready, setReady] = useState(false),
    [running, setRunning] = useState(false);
  const [records, setRecords] = useState([]),
    [snapshot, setSnapshot] = useState(null),
    [error, setError] = useState('');
  const [status, setStatus] = useState(
    'Escolha uma referência cadastrada e abra um vídeo ou a webcam.',
  );
  const [busy, setBusy] = useState(false),
    [plateName, setPlateName] = useState(''),
    [annotations, setAnnotations] = useState({});
  const [drawing, setDrawing] = useState(false);
  const video = useRef(null),
    stream = useRef(null),
    epoch = useRef(0),
    objectUrl = useRef(null),
    demoStep = useRef(0),
    inFlight = useRef(false),
    autoStarted = useRef(null);
  const scenario = scenarios.find((s) => s.id === selected);
  const summary = summarizeTracking(records);
  useEffect(() => {
    let active = true;
    loadReferences()
      .then((all) => {
        if (active) {
          setScenarios(all);
          const initial =
            all.find((r) => r.id === referenceId) ||
            all.find((r) => r.fixture_key === 'hospital-signs') ||
            all[0];
          setSelected(initial?.id || '');
          setPlateName(initial?.plates[0]?.name || '');
        }
      })
      .catch((e) => active && setError(e.message));
    return () => {
      active = false;
      epoch.current++;
      stream.current?.getTracks().forEach((t) => t.stop());
      if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    };
  }, []);
  function stop() {
    epoch.current++;
    setRunning(false);
    video.current?.pause();
  }
  function clearResults() {
    setRecords([]);
    setSnapshot(null);
    setAnnotations({});
    setDrawing(false);
  }
  function closeSource() {
    stop();
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    objectUrl.current = null;
    setReady(false);
    demoStep.current = 0;
    setSource(null);
    clearResults();
    setPhase('prepare');
    setInputMode('choose');
    setEditingProject(null);
  }
  function finish() {
    stop();
    setPhase('report');
    window.scrollTo(0, 0);
  }
  async function loadSource(kind, file, reference = scenario) {
    closeSource();
    setError('');
    setBusy(true);
    try {
      let next;
      if (kind === 'camera') {
        stream.current = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 30 } },
          audio: false,
        });
        next = {
          kind,
          id: `webcam-${Date.now()}`,
          label: 'Webcam ao vivo',
          settings: stream.current.getVideoTracks()[0].getSettings(),
        };
      } else if (kind === 'demo') {
        const response = await fetch('/detection-demo.json');
        if (!response.ok) throw new Error('Vídeo demonstrativo indisponível.');
        const metadata = await response.json();
        const validReference =
          reference &&
          (await imageHash(reference.image)) === metadata.reference_sha256 &&
          JSON.stringify(reference.plates) === JSON.stringify(metadata.plates);
        next = {
          kind,
          id: `demo-${Date.now()}`,
          label: 'Hospital · vídeo sintético de 12 s',
          url: '/detection-demo.mp4',
          metadata: validReference ? metadata : null,
        };
        if (!validReference) throw new Error('A foto do exemplo não confere com o vídeo incluído.');
      } else {
        if (!file) return;
        objectUrl.current = URL.createObjectURL(file);
        next = { kind, id: `video-${Date.now()}`, label: file.name, url: objectUrl.current };
      }
      setSource({ ...next, autoStart: true });
      setPhase('analyze');
    } catch (e) {
      setError(e.message || 'Não foi possível abrir a câmera ou o vídeo.');
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    if (!source || !video.current) return;
    if (source.kind === 'camera') {
      video.current.srcObject = stream.current;
      video.current.play().catch((e) => setError(e.message));
    } else {
      video.current.srcObject = null;
      video.current.src = source.url;
      video.current.load();
    }
  }, [source]);
  async function analyzeFrame(token, advance = true) {
    if (!scenario || !video.current || inFlight.current) return;
    const player = video.current;
    if (source.kind !== 'demo' && (player.readyState < 2 || !player.videoWidth)) return;
    inFlight.current = true;
    try {
      let result,
        image,
        time,
        sample = {};
      if (source.kind === 'demo') {
        const indices = source.metadata.sample_frame_indices;
        if (advance && demoStep.current >= indices.length) {
          finish();
          return;
        }
        const index = advance
          ? indices[demoStep.current]
          : (snapshot?.record.frame_index ?? indices[0]);
        const data = await post(`/references/${scenario.id}/detect-demo-frame`, {
          frame_index: index,
        });
        result = data.result;
        image = data.preview;
        time = data.time;
        sample = {
          frame_index: data.frame_index,
          condition: data.condition,
          captureMode: 'decoded_file_grid',
        };
      } else {
        time = await mediaTimeForCapture(player);
        if (epoch.current !== token) return;
        const canvas = document.createElement('canvas');
        const scale = Math.min(1, 800 / player.videoWidth);
        canvas.width = Math.round(player.videoWidth * scale);
        canvas.height = Math.round(player.videoHeight * scale);
        if (Math.min(canvas.width, canvas.height) < 200)
          throw new Error(
            'O vídeo precisa ter pelo menos 200 pixels por lado após redução para 800 px de largura.',
          );
        canvas.getContext('2d').drawImage(player, 0, 0, canvas.width, canvas.height);
        image = canvas.toDataURL('image/jpeg', 0.92);
        result = await post(`/references/${scenario.id}/detect-plates`, { image, annotations: [] });
        sample = { captureMode: 'live_decoded_frame' };
      }
      if (epoch.current !== token) return;
      const record = {
        ...result,
        ...sample,
        source: source.id,
        time,
        reference: scenario.id,
        annotationSource: source.kind === 'demo' ? 'synthetic_geometry' : null,
      };
      setRecords((previous) =>
        [
          ...previous.filter((r) => !(r.source === record.source && r.time === record.time)),
          record,
        ].slice(-300),
      );
      setSnapshot({ image, width: result.width, height: result.height, record });
      setAnnotations({});
      setStatus(
        `Quadro em ${number(time, 2)} s do arquivo · processamento ${number(result.processing_ms, 0)} ms`,
      );
      if (source.kind === 'demo') {
        player.currentTime = time;
        if (advance) demoStep.current++;
        if (demoStep.current >= source.metadata.sample_frame_indices.length) finish();
      }
    } finally {
      inFlight.current = false;
    }
  }

  useEffect(() => {
    if (!running) return;
    const token = epoch.current;
    let cancelled = false,
      timer;
    async function tick() {
      const begin = performance.now();
      try {
        await analyzeFrame(token);
      } catch (e) {
        if (epoch.current === token) {
          setError(e.message);
          stop();
        }
      }
      if (!cancelled && epoch.current === token)
        timer = setTimeout(
          tick,
          source.kind === 'demo' ? 0 : Math.max(0, 500 - (performance.now() - begin)),
        );
    }
    tick();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [running, source, selected]);
  useEffect(() => {
    if (records.length >= 300 && running) {
      stop();
      setStatus('Limite de 300 quadros atingido. Exporte o ensaio antes de iniciar outro.');
      setPhase('report');
    }
  }, [records.length, running]);
  async function start() {
    setError('');
    setDrawing(false);
    try {
      if (source.kind !== 'demo') await video.current.play();
      setRunning(true);
    } catch (e) {
      setError(e.message);
    }
  }
  async function freeze() {
    stop();
    setDrawing(false);
    setError('');
    try {
      await analyzeFrame(epoch.current, false);
    } catch (e) {
      setError(e.message);
    }
  }
  async function evaluate() {
    if (!snapshot) return;
    setBusy(true);
    setError('');
    try {
      const result = await post(`/references/${scenario.id}/detect-plates`, {
        image: snapshot.image,
        annotations: Object.values(annotations),
      });
      const record = { ...snapshot.record, ...result, annotationSource: 'manual_operator' };
      setRecords((all) =>
        all.map((r) => (r.source === record.source && r.time === record.time ? record : r)),
      );
      setSnapshot({ ...snapshot, record });
      setDrawing(false);
      setStatus('Acerto calculado somente para as placas anotadas neste quadro.');
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function exportPdf() {
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/sign-detection/report.pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(records),
      });
      if (!response.ok) throw new Error('Não foi possível gerar o PDF.');
      saveBlob(await response.blob(), 'HeatCity-deteccao-placas.pdf');
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  const frame = snapshot?.record;
  function exportJson() {
    saveBlob(
      new Blob(
        [
          JSON.stringify(
            {
              version: 1,
              method: 'template_multiscale_v1',
              source: source ? { id: source.id, kind: source.kind, label: source.label } : null,
              reference: scenario
                ? { id: scenario.id, name: scenario.name, plates: scenario.plates }
                : null,
              maxGapSeconds: MAX_GAP_SECONDS,
              summary,
              frames: records,
            },
            null,
            2,
          ),
        ],
        { type: 'application/json' },
      ),
      'heatcity-placas-video.json',
    );
  }
  return (
    <section className="sign-detection">
      <div className="page-title">
        <p className="eyebrow">HEATCITY · PLACAS EM VÍDEO</p>
        <h1>Onde a placa aparece?</h1>
        <p>
          Localize placas em um vídeo e veja um relatório de detecção, dificuldades e sugestões.
        </p>
      </div>
      <ol className="analysis-steps" aria-label="Etapas da análise">
        {[
          ['prepare', 'Escolher entrada'],
          ['analyze', 'Analisar o vídeo'],
          ['report', 'Ver o relatório'],
        ].map(([value, label], i) => (
          <li key={value} aria-current={phase === value ? 'step' : undefined}>
            <span>{i + 1}</span>
            {label}
          </li>
        ))}
      </ol>
      {error && (
        <p className="global-message error" role="alert">
          {error}
        </p>
      )}
      {phase === 'prepare' && inputMode === 'choose' && (
        <div className="start-options">
          <article className="panel start-card">
            <p className="eyebrow">PARA CONHECER O PROJETO</p>
            <h2>Veja um exemplo pronto.</h2>
            <p>
              Um vídeo de 12 segundos com quatro placas. A análise roda e abre o relatório
              automaticamente.
            </p>
            <button
              className="primary"
              disabled={busy || !scenarios.some((r) => r.fixture_key === 'hospital-signs')}
              onClick={() => {
                const ref = scenarios.find((r) => r.fixture_key === 'hospital-signs');
                setSelected(ref.id);
                setPlateName(ref.plates[0].name);
                loadSource('demo', null, ref);
              }}
            >
              Ver exemplo funcionando
            </button>
          </article>
          <article className="panel start-card">
            <p className="eyebrow">PARA ANALISAR SEU AMBIENTE</p>
            <h2>Use seu próprio vídeo.</h2>
            <p>
              Primeiro cadastre uma foto nítida com as placas. Depois escolha um vídeo que mostre
              essas mesmas placas.
            </p>
            <button
              className="secondary"
              onClick={() => {
                setInputMode('custom');
                setSelected('');
              }}
            >
              Começar com meu vídeo
            </button>
          </article>
        </div>
      )}
      {phase === 'prepare' && inputMode === 'custom' && (
        <div className="panel detector-controls">
          <button
            className="text-button"
            onClick={() => {
              setInputMode('choose');
              setEditingProject(null);
            }}
          >
            ← Voltar ao início
          </button>
          <h2>1. Escolha uma foto com suas placas.</h2>
          <p>
            A foto fornece o padrão visual que será procurado. Se ainda não cadastrou uma, use
            “Cadastrar foto”.
          </p>
          {editingProject ? (
            <ReferenceEditor
              project={editingProject}
              onCancel={() => setEditingProject(null)}
              onSaved={async (saved) => {
                try {
                  const all = await loadReferences();
                  setScenarios(all);
                  const ref = all.find((r) => r.id === saved.id);
                  setSelected(ref?.id || '');
                  setPlateName(ref?.plates[0]?.name || '');
                  setEditingProject(null);
                } catch (e) {
                  setError(e.message);
                }
              }}
            />
          ) : (
            <>
              <label>
                Foto cadastrada
                <select
                  value={selected}
                  onChange={(e) => {
                    setSelected(e.target.value);
                    setPlateName(
                      scenarios.find((r) => r.id === e.target.value)?.plates[0]?.name || '',
                    );
                  }}
                >
                  <option value="">Selecione uma foto</option>
                  {scenarios.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </label>
              <button
                className="secondary"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    setEditingProject(await uploadProject());
                  } catch (e) {
                    setError(e.message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Cadastrar foto
              </button>
              {scenario && (
                <>
                  <PlateCrops reference={scenario} />
                  <h2>2. Escolha o vídeo para começar.</h2>
                  <p>Depois de selecionar o arquivo, a análise inicia automaticamente.</p>
                  <label className="primary button-link video-upload">
                    Selecionar vídeo e analisar
                    <input
                      aria-label="Selecionar vídeo e analisar"
                      type="file"
                      accept="video/*"
                      disabled={busy}
                      onChange={(e) => {
                        if (e.target.files[0]) loadSource('file', e.target.files[0]);
                        e.target.value = '';
                      }}
                    />
                  </label>
                  <details className="webcam-option">
                    <summary>Usar webcam em vez de um arquivo</summary>
                    <button
                      className="secondary"
                      disabled={busy}
                      onClick={() => loadSource('camera')}
                    >
                      Analisar webcam
                    </button>
                  </details>
                </>
              )}
            </>
          )}
        </div>
      )}
      {phase === 'analyze' && (
        <div className="section-heading">
          <div>
            <p className="eyebrow">ETAPA 2 · ANALISAR</p>
            <h2>{running ? 'Análise em andamento.' : 'Vídeo pausado.'}</h2>
            <p>
              Ao terminar, o relatório será aberto automaticamente. Você também pode concluir antes.
            </p>
          </div>
          <button className="text-button" onClick={closeSource}>
            Fechar fonte
          </button>
        </div>
      )}
      {source && (
        <div className="detector-workspace" hidden={phase !== 'analyze'}>
          <article className="panel">
            <div className="section-heading">
              <h2>Placas localizadas no vídeo</h2>
              <span className="tag neutral">{running ? 'ANALISANDO' : 'PAUSADO'}</span>
            </div>
            {snapshot ? (
              <div className="detector-frame">
                <Scene
                  scenario={{
                    ...snapshot,
                    plates: drawing
                      ? Object.values(annotations)
                          .filter((a) => a.present)
                          .map((a) => ({
                            name: a.name,
                            x: a.box[0],
                            y: a.box[1],
                            width: a.box[2],
                            height: a.box[3],
                          }))
                      : [],
                  }}
                  edit={drawing}
                  onArea={(area) =>
                    setAnnotations((a) => ({
                      ...a,
                      [plateName]: {
                        name: plateName,
                        present: true,
                        box: [area.x, area.y, area.width, area.height],
                      },
                    }))
                  }
                />
                {!drawing &&
                  frame?.signs
                    .filter((s) => s.box)
                    .map((s) => (
                      <div
                        key={s.name}
                        className={`detector-box ${s.status}`}
                        style={{
                          left: `${s.box[0] * 100}%`,
                          top: `${s.box[1] * 100}%`,
                          width: `${s.box[2] * 100}%`,
                          height: `${s.box[3] * 100}%`,
                        }}
                      >
                        <span>
                          {s.name} · {labels[s.status]}
                        </span>
                      </div>
                    ))}
              </div>
            ) : (
              <div className="detector-empty">
                Inicie a análise ou congele um quadro para localizar as placas.
              </div>
            )}
            <p role="status" className="small">
              {status}
            </p>
            <div className="button-row">
              <button
                className="secondary"
                onClick={running ? stop : start}
                disabled={!ready || busy || records.length >= 300}
              >
                {running ? 'Pausar análise' : 'Iniciar análise'}
              </button>
              <button className="secondary" onClick={freeze} disabled={!ready || running || busy}>
                Analisar quadro atual
              </button>
            </div>
            <button className="primary" disabled={!records.length} onClick={finish}>
              Terminar e ver relatório
            </button>
          </article>
          <aside className="panel detector-source">
            <h2>Fonte do vídeo</h2>
            <p>{source.label}</p>
            <video
              ref={video}
              controls={source.kind !== 'demo'}
              muted
              playsInline
              onPause={() => {
                if (running && source.kind !== 'demo') setRunning(false);
              }}
              onLoadedData={() => {
                setReady(true);
                setStatus('Vídeo pronto.');
                if (source.autoStart && autoStarted.current !== source.id) {
                  autoStarted.current = source.id;
                  start();
                }
              }}
              onEnded={() => {
                if (source.kind === 'demo') return;
                setRunning(false);
                setPhase('report');
                window.scrollTo(0, 0);
                setStatus('Vídeo concluído. Exporte os resultados ou confira um quadro.');
              }}
              onSeeking={() => {
                if (running && source.kind !== 'demo') stop();
              }}
              onError={() => {
                setError('Formato não suportado pelo navegador. Use MP4/H.264 ou WebM.');
                setReady(false);
              }}
            />
            {source.kind === 'demo' && (
              <p className="small">
                Demonstração sintética analisada em 24 quadros fixos do arquivo, sempre nas mesmas
                posições de tempo. O processamento pode levar mais ou menos tempo que o vídeo; não é
                uma medição de tempo real. Há deslocamento, desfoque e remoção de uma placa.
                Posições conhecidas permitem medir o acerto neste exemplo. Não é uma captura real
                nem estudo com pessoas.
              </p>
            )}
            {source.kind === 'camera' && (
              <p className="small">
                Captura negociada: {source.settings.width} × {source.settings.height},{' '}
                {number(source.settings.frameRate)} FPS. Isso difere da frequência de análise.
              </p>
            )}
            {scenario && (
              <details>
                <summary>Ver imagem e recortes de referência</summary>
                <Scene scenario={scenario} />
              </details>
            )}
          </aside>
        </div>
      )}
      {snapshot && !running && phase === 'analyze' && (
        <article className="panel">
          <h2>Conferir o acerto com uma referência conhecida</h2>
          <p>
            Selecione uma placa, ative a marcação e arraste um retângulo sobre sua posição real no
            quadro analisado. Se ela não estiver no quadro, marque ausente. Apenas as placas
            anotadas entram no cálculo; a marcação não treina nem corrige o detector.
          </p>
          <div className="button-row">
            <label>
              Placa a conferir
              <select value={plateName} onChange={(e) => setPlateName(e.target.value)}>
                {scenario.plates.map((p) => (
                  <option key={p.name}>{p.name}</option>
                ))}
              </select>
            </label>
            <button
              className="secondary"
              onClick={() => {
                setDrawing(!drawing);
              }}
            >
              {drawing ? 'Encerrar marcação' : 'Marcar posição real'}
            </button>
            <button
              className="secondary"
              onClick={() =>
                setAnnotations((a) => ({ ...a, [plateName]: { name: plateName, present: false } }))
              }
            >
              Marcar placa ausente
            </button>
            <button
              className="primary"
              disabled={!Object.keys(annotations).length || busy}
              onClick={evaluate}
            >
              Calcular acerto deste quadro
            </button>
          </div>
          <ul>
            {Object.values(annotations).map((a) => (
              <li key={a.name}>
                {a.name}: {a.present ? 'retângulo marcado' : 'ausente'}{' '}
                <button
                  className="text-button"
                  onClick={() =>
                    setAnnotations((all) => {
                      const next = { ...all };
                      delete next[a.name];
                      return next;
                    })
                  }
                >
                  Remover anotação
                </button>
              </li>
            ))}
          </ul>
        </article>
      )}

      {phase === 'report' && records.length > 0 && (
        <AnalysisReport
          summary={summary}
          records={records}
          source={source}
          onReview={() => setPhase('analyze')}
          onRestart={closeSource}
          onJson={exportJson}
          onCsv={() =>
            saveBlob(
              new Blob(['\ufeff' + csvTracking(records)], { type: 'text/csv;charset=utf-8' }),
              'heatcity-placas-video.csv',
            )
          }
          onPdf={exportPdf}
          busy={busy}
        />
      )}
      {phase === 'analyze' && !running && records.length > 0 && (
        <div className="button-row">
          <button className="primary" onClick={finish}>
            Ver relatório atualizado →
          </button>
        </div>
      )}
    </section>
  );
}
