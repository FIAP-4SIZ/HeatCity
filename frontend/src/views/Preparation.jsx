import React, { useState, useRef } from 'react';
import { CalibrationArchive } from '../calibration-archive.js';
import CalibrationHistoryDownload from '../components/CalibrationHistoryDownload.jsx';
import CalibrationLab from './CalibrationLab.jsx';
import RunSession from './RunSession.jsx';
import { number, post } from '../api.js';

export default function Preparation({ study, onFinished, exploratory = false }) {
  const archive = useRef(new CalibrationArchive());
  const [scenarioId, setScenarioId] = useState(study.scenarios[0]?.id || ''),
    [participant, setParticipant] = useState(''),
    [target, setTarget] = useState(study.scenarios[0]?.plates[0]?.name || ''),
    [consent, setConsent] = useState(false),
    [calibrating, setCalibrating] = useState(false),
    [calibration, setCalibration] = useState(null),
    [running, setRunning] = useState(false);
  const [importing, setImporting] = useState(false),
    [importError, setImportError] = useState('');
  const scenario = study.scenarios.find((s) => s.id === scenarioId);
  if (!scenario)
    return (
      <div className="empty panel">
        <h2>Cadastre um cenário primeiro.</h2>
        <p>A sessão precisa de uma cena e das áreas das placas.</p>
      </div>
    );
  if (running)
    return (
      <RunSession
        exploratory={exploratory}
        scenario={scenario}
        participant={participant}
        target={target}
        consent={consent}
        calibration={calibration}
        onComplete={onFinished}
        onBack={() => {
          setRunning(false);
          setCalibration(null);
        }}
      />
    );
  if (calibrating)
    return (
      <section>
        <div className="section-heading">
          <div>
            <p className="eyebrow">ETAPA 2 · CALIBRAÇÃO INDIVIDUAL</p>
            <h2>Uma referência para cada participante</h2>
            <p>
              {participant} · {scenario.name}
            </p>
          </div>
          <button className="secondary" onClick={() => setCalibrating(false)}>
            Voltar
          </button>
        </div>
        <CalibrationLab
          exploratory={exploratory}
          attemptArchive={archive.current}
          participantCode={participant}
          scenarioId={scenario.id}
          onReady={(model) => {
            setCalibration(model);
            setCalibrating(false);
          }}
        />
      </section>
    );
  const valid = /^[A-Z0-9][A-Z0-9_-]{1,23}$/.test(participant) && consent;
  async function importDiagnostic(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setImporting(true);
    setImportError('');
    try {
      if (file.size > 10000000) throw new Error('Limite de 10 MB.');
      const data = JSON.parse(await file.text());
      const candidates = [...(data.page_diagnostic?.calibrations || []), data];
      const source = candidates
        .filter(
          (c) =>
            c.mode === 'sweep' &&
            c.quality?.basis === 'mesh' &&
            Array.isArray(c.features) &&
            c.features.length >= 9,
        )
        .at(-1);
      if (!source)
        throw new Error('Use um diagnóstico com malha concluída, aprovada ou reprovada.');
      const payload = {
        mode: 'sweep',
        source: 'imported_diagnostic',
        eye_geometry: source.eye_geometry || 'legacy_v1',
        participant_code: participant,
        scenario_id: scenario.id,
      };
      for (const key of [
        'features',
        'targets',
        'validation_features',
        'validation_targets',
        'validation_samples',
      ])
        if (source[key]) payload[key] = source[key];
      const result = await post('/exploratory/calibrations', payload);
      setCalibration({
        ...result,
        feature_mode: 'sweep',
        eye_geometry: source.eye_geometry || 'legacy_v1',
        detector: source.detector,
        source: 'imported_diagnostic',
      });
    } catch (error) {
      setImportError(error.message);
    } finally {
      setImporting(false);
    }
  }
  return (
    <div className="preparation-grid">
      <section className="panel">
        <p className="eyebrow">ETAPA 1 · PREPARAR SESSÃO</p>
        <h2>
          {exploratory
            ? 'Ensaio exploratório · não validado'
            : 'Identifique a sessão com um código'}
        </h2>
        {exploratory && (
          <div className="notice">
            <strong>
              Demonstração técnica; não mede sucesso, tempo de localização ou atenção validada.
            </strong>
            <p>
              Você pode usar uma malha concluída reprovada. Importar um diagnóstico evita repetir a
              coleta na apresentação, mas a posição atual pode diferir da original. O ensaio ficará
              fora das taxas oficiais.
            </p>
          </div>
        )}
        <p className="muted">
          O único dado de identificação solicitado é o código do participante. Não informe nome,
          e-mail, CPF, telefone ou outros dados pessoais.
        </p>
        {!exploratory && <CalibrationHistoryDownload archive={archive.current} />}
        <div className="form-stack">
          <label>
            Código do participante (obrigatório)
            <input
              required
              autoComplete="off"
              spellCheck={false}
              minLength={2}
              aria-describedby="participant-code-help"
              placeholder="Ex.: P01"
              value={participant}
              maxLength={24}
              onChange={(e) => {
                setParticipant(e.target.value.toUpperCase());
                setCalibration(null);
              }}
            />
          </label>
          <p id="participant-code-help" className="small">
            Use de 2 a 24 caracteres: letras, números, hífen ou sublinhado. Exemplo: P01. Reutilize
            o mesmo código nas sessões da mesma pessoa. Cada participante faz sua própria
            calibração.
          </p>
          <label>
            Cenário
            <select
              value={scenarioId}
              onChange={(e) => {
                setScenarioId(e.target.value);
                setTarget(study.scenarios.find((s) => s.id === e.target.value).plates[0].name);
                setCalibration(null);
              }}
            >
              {study.scenarios.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Placa a localizar
            <select value={target} onChange={(e) => setTarget(e.target.value)}>
              {scenario.plates.map((p) => (
                <option key={p.name}>{p.name}</option>
              ))}
            </select>
          </label>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => {
                setConsent(e.target.checked);
                if (!e.target.checked) setCalibration(null);
              }}
            />
            <span>
              O participante recebeu a explicação e consentiu com a câmera e o armazenamento das
              coordenadas da sessão. Imagens faciais não serão salvas.
            </span>
          </label>
          <button
            className="primary"
            disabled={!valid || importing}
            onClick={() => setCalibrating(true)}
          >
            {calibration ? 'Refazer calibração' : 'Calibrar olhar'}
          </button>
          {exploratory && (
            <label>
              Importar diagnóstico para demonstração
              <input
                type="file"
                accept="application/json,.json"
                disabled={!valid || importing}
                onChange={importDiagnostic}
              />
              <span className="small">
                Informe código, consentimento e cenário antes de importar. Nenhuma imagem facial
                será importada.
              </span>
            </label>
          )}
          {importing && <p role="status">Conferindo geometria importada…</p>}
          {importError && (
            <p className="error" role="alert">
              {importError}
            </p>
          )}
          {calibration && (
            <div className={`notice ${exploratory ? '' : 'success'}`}>
              <strong>
                {exploratory ? 'Geometria para demonstração' : 'Calibração aprovada'} · RMSE{' '}
                {number(calibration.validation_rmse, 3)}
              </strong>
              {exploratory && (
                <p>
                  Calibração {calibration.approved ? 'aprovada pelo critério' : 'reprovada'} ·
                  fonte:{' '}
                  {calibration.source === 'imported_diagnostic'
                    ? 'diagnóstico importado, não reconferido nesta postura'
                    : 'coleta atual'}
                  . Uso exclusivamente exploratório.
                </p>
              )}
              <p>A autorização é temporária e válida somente para este participante e cenário.</p>
              <button className="primary" disabled={!valid} onClick={() => setRunning(true)}>
                Continuar para o teste de 15 s
              </button>
            </div>
          )}
        </div>
      </section>
      <aside className="panel protocol-card">
        <span className="tag">SOMENTE RASTREAMENTO OCULAR</span>
        <h3>Uma sessão com qualidade.</h3>
        <ol>
          <li>Câmera à altura dos olhos, luz frontal e sem reflexos fortes.</li>
          <li>Posição confortável; não force a abertura dos olhos.</li>
          <li>Calibração em tela cheia, com contagem 3–2–1 e validação independente.</li>
          <li>Durante o teste, procure a placa com os olhos. Não clique na imagem.</li>
          <li>ESC interrompe a sessão. Dados insuficientes ficam fora do consolidado.</li>
        </ol>
        <p className="small">
          RMSE ≤ 0,100 é um limite experimental, não uma medida clínica. Uma tentativa reprovada é
          informação de qualidade; não será convertida em observação válida.
        </p>
      </aside>
    </div>
  );
}
