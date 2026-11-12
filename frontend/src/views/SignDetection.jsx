import AnalysisReport from '../components/AnalysisReport.jsx';
import PlateCrops from '../components/PlateCrops.jsx';
import { referenceLabel } from '../reference-labels.js';
import React, { useEffect, useRef, useState } from 'react';
import { api, post, number } from '../api.js';
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
  const [drawing, setDrawing] = useState(false),
    [showPath, setShowPath] = useState(false);
  const video = useRef(null),
    stream = useRef(null),
    epoch = useRef(0),
    objectUrl = useRef(null),
    clock = useRef(0),
    inFlight = useRef(false);
  const scenario = scenarios.find((s) => s.id === selected);
  const summary = summarizeTracking(records);
  const last = records.at(-1);
  useEffect(() => {
    let active = true;
    api('/projects')
      .then(async (projects) => {
        const full = await Promise.all(projects.map((s) => api(`/projects/${s.id}`)));
        const all = full.flatMap((s) =>
          s.references.map((c) => ({ ...c, projectTitle: s.title, projectId: s.id })),
        );
        if (active) {
          setScenarios(all);
          const initial =
            all.find((s) => s.id === referenceId) ||
            all.find(
              (s) => s.projectId === 'hospital-orientacao-base-v1' && s.name.includes(' A '),
            ) ||
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
    setSource(null);
    clearResults();
    setPhase('prepare');
  }
  function finish() {
    stop();
    setPhase('report');
    window.scrollTo(0, 0);
  }
  async function loadSource(kind, file) {
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
          scenario &&
          (await imageHash(scenario.image)) === metadata.reference_sha256 &&
          JSON.stringify(scenario.plates) === JSON.stringify(metadata.plates);
        next = {
          kind,
          id: `demo-${Date.now()}`,
          label: 'Hospital · vídeo sintético de 12 s',
          url: '/detection-demo.mp4',
          metadata: validReference ? metadata : null,
        };
        if (!validReference)
          setStatus(
            'Referência diferente da cena A original: a demonstração funciona, mas sem anotação automática de acerto.',
          );
      } else {
        if (!file) return;
        objectUrl.current = URL.createObjectURL(file);
        next = { kind, id: `video-${Date.now()}`, label: file.name, url: objectUrl.current };
      }
      setSource(next);
      setPhase('analyze');
      clock.current = performance.now();
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
  async function analyzeFrame(token) {
    if (!scenario || !video.current || inFlight.current) return;
    const player = video.current;
    if (player.readyState < 2 || !player.videoWidth) return;
    const time =
      source.kind === 'camera' ? (performance.now() - clock.current) / 1000 : player.currentTime;
    const canvas = document.createElement('canvas');
    const scale = Math.min(1, 800 / player.videoWidth);
    canvas.width = Math.round(player.videoWidth * scale);
    canvas.height = Math.round(player.videoHeight * scale);
    if (Math.min(canvas.width, canvas.height) < 200)
      throw new Error(
        'O vídeo precisa ter pelo menos 200 pixels por lado após redução para 800 px de largura.',
      );
    canvas.getContext('2d').drawImage(player, 0, 0, canvas.width, canvas.height);
    const image = canvas.toDataURL('image/jpeg', 0.92);
    const known = source.metadata?.segments.find((s) => time >= s.start && time < s.end);
    inFlight.current = true;
    try {
      const result = await post(`/references/${scenario.id}/detect-plates`, {
        image,
        annotations: known?.annotations || [],
      });
      if (epoch.current !== token) return;
      const record = {
        ...result,
        source: source.id,
        time,
        reference: scenario.id,
        annotationSource: known ? 'synthetic_geometry' : null,
      };
      setRecords((previous) =>
        [
          ...previous.filter((r) => !(r.source === record.source && r.time === record.time)),
          record,
        ].slice(-300),
      );
      setSnapshot({ image, width: canvas.width, height: canvas.height, record });
      setAnnotations({});
      setStatus(
        `Quadro em ${number(time, 2)} s · processamento ${number(result.processing_ms, 0)} ms`,
      );
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
        setError(e.message);
        setRunning(false);
      }
      if (!cancelled && epoch.current === token)
        timer = setTimeout(tick, Math.max(0, 500 - (performance.now() - begin)));
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
      await video.current.play();
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
      await analyzeFrame(epoch.current);
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
        <p>Escolha as placas, analise um vídeo e veja o que dificultou a detecção.</p>
      </div>
      <ol className="analysis-steps" aria-label="Etapas da análise">
        {[
          ['prepare', 'Escolher as placas'],
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
      <div className="panel detector-controls" hidden={phase !== 'prepare'}>
        <p className="eyebrow">ETAPA 1 · PREPARAR</p>
        <h2>Estas são as placas que vamos procurar.</h2>
        <p>
          Os recortes abaixo são o padrão visual usado pelo detector. Basta uma imagem de referência
          compatível com o vídeo; não é necessário escolher um par A/B.
        </p>
        {scenario && (
          <>
            <strong>{referenceLabel(scenario)}</strong>
            <PlateCrops reference={scenario} />
          </>
        )}
        <details>
          <summary>Escolher outra referência cadastrada</summary>
          <label>
            Referência cadastrada
            <select
              value={selected}
              disabled={!!source || busy}
              onChange={(e) => {
                setSelected(e.target.value);
                clearResults();
                setPlateName(scenarios.find((s) => s.id === e.target.value)?.plates[0]?.name || '');
              }}
            >
              {scenarios.map((s) => (
                <option key={s.id} value={s.id}>
                  {referenceLabel(s)}
                </option>
              ))}
            </select>
          </label>
          <p className="small">
            A imagem alternativa B do hospital foi mantida no catálogo como material de origem. Ela
            não é usada no vídeo demonstrativo e não precisa ser selecionada para começar.
          </p>
        </details>
        <h3>Agora escolha o vídeo.</h3>
        <div className="button-row">
          <button
            className="primary"
            disabled={!scenario || busy}
            onClick={() => loadSource('demo')}
          >
            Abrir vídeo demonstrativo
          </button>
          <label className="detector-file">
            Abrir meu vídeo
            <input
              aria-label="Abrir meu vídeo"
              type="file"
              accept="video/*"
              disabled={!scenario || busy}
              onChange={(e) => {
                loadSource('file', e.target.files[0]);
                e.target.value = '';
              }}
            />
          </label>
          <button
            className="secondary"
            disabled={!scenario || busy}
            onClick={() => loadSource('camera')}
          >
            Abrir webcam
          </button>
        </div>
        <p className="small">
          O exemplo já vem pronto e é sintético. Para um vídeo próprio, use uma imagem nítida das
          placas que aparecem nele. Quadros são enviados à API local e não são salvos.
        </p>
        <a
          className="text-link"
          href={scenario ? `#/references/${scenario.projectId}` : '#/references'}
        >
          Cadastrar placas de outro ambiente →
        </a>
      </div>
      {phase === 'analyze' && (
        <div className="section-heading">
          <div>
            <p className="eyebrow">ETAPA 2 · ANALISAR</p>
            <h2>Inicie e acompanhe as caixas no vídeo.</h2>
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
              <h2>Quadro analisado</h2>
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
                {showPath && !drawing && (
                  <svg
                    className="detector-path"
                    viewBox="0 0 100 100"
                    preserveAspectRatio="none"
                    aria-label="Centros das detecções nos quadros analisados"
                  >
                    {summary.signs.map((s, i) => (
                      <g key={s.name}>
                        {s.path.map((p, j) => (
                          <circle
                            key={j}
                            cx={p.x * 100}
                            cy={p.y * 100}
                            r="0.4"
                            fill={['#f62e51', '#00d9cf', '#f5c800', '#a389ff'][i % 4]}
                          />
                        ))}
                      </g>
                    ))}
                  </svg>
                )}
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
                className="primary"
                onClick={running ? stop : start}
                disabled={!ready || busy || records.length >= 300}
              >
                {running ? 'Pausar análise' : 'Iniciar análise'}
              </button>
              <button className="secondary" onClick={freeze} disabled={!ready || running || busy}>
                Analisar quadro atual
              </button>
              <label>
                <input
                  type="checkbox"
                  checked={showPath}
                  onChange={(e) => setShowPath(e.target.checked)}
                />{' '}
                Mostrar centros detectados
              </label>
            </div>
            <button className="primary" disabled={!records.length} onClick={finish}>
              Concluir análise e ver relatório →
            </button>
          </article>
          <aside className="panel detector-source">
            <h2>Fonte do vídeo</h2>
            <p>{source.label}</p>
            <video
              ref={video}
              controls
              muted
              playsInline
              onPause={() => {
                if (running) setRunning(false);
              }}
              onLoadedData={() => {
                setReady(true);
                setStatus('Fonte pronta. Clique em Iniciar análise.');
              }}
              onEnded={() => {
                setRunning(false);
                setPhase('report');
                window.scrollTo(0, 0);
                setStatus('Vídeo concluído. Exporte os resultados ou confira um quadro.');
              }}
              onSeeking={() => {
                if (running) stop();
              }}
              onError={() => {
                setError('Formato não suportado pelo navegador. Use MP4/H.264 ou WebM.');
                setReady(false);
              }}
            />
            {source.kind === 'demo' && (
              <p className="small">
                Demonstração sintética: imagem hospitalar gerada por IA, deslocamento, desfoque e
                remoção de uma placa.{' '}
                {source.metadata
                  ? 'Referência original conferida: posições conhecidas permitem medir acerto automaticamente.'
                  : 'Sem referência geométrica automática para esta seleção.'}{' '}
                Não é uma captura real nem estudo com pessoas.
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
      <article className="panel" hidden={phase !== 'analyze'}>
        <h2>Acompanhamento por placa</h2>
        <p>
          {records.length} quadros analisados ·{' '}
          {last ? `${number(last.time, 2)} s na fonte` : 'sem coleta'} ·{' '}
          {last
            ? `${number(last.processing_ms, 0)} ms no último processamento`
            : 'aguardando vídeo'}
        </p>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Placa</th>
                <th>Tempo detectado estimado</th>
                <th>Primeira detecção</th>
                <th>Trechos detectados</th>
                <th>Quadros detectados / analisados</th>
                <th>Quadros incertos</th>
              </tr>
            </thead>
            <tbody>
              {summary.signs.map((s) => (
                <tr key={s.name}>
                  <td>{s.name}</td>
                  <td>{number(s.detectedSeconds, 2)} s</td>
                  <td>{number(s.firstSeen, 2)} s</td>
                  <td>{s.events}</td>
                  <td>
                    {s.detectedFrames} / {records.length}
                  </td>
                  <td>{s.uncertainFrames}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="small">
          Tempo = soma dos intervalos entre detecções consecutivas da mesma placa, na mesma fonte,
          com intervalo máximo de {MAX_GAP_SECONDS} s. Intervalos maiores, falhas e ambiguidades
          interrompem o trecho. O primeiro quadro isolado soma 0 s. A amostragem não comprova
          presença contínua entre quadros. Centros acumulados mostram a trajetória da placa na
          imagem.
        </p>
      </article>
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
                setShowPath(false);
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
