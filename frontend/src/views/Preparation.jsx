import React, { useState } from 'react';
import CalibrationLab from './CalibrationLab.jsx';
import RunSession from './RunSession.jsx';
import { number } from '../api.js';

export default function Preparation({ study, onFinished }) {
  const [scenarioId, setScenarioId] = useState(study.scenarios[0]?.id || ''),
    [participant, setParticipant] = useState(''),
    [target, setTarget] = useState(study.scenarios[0]?.plates[0]?.name || ''),
    [consent, setConsent] = useState(false),
    [calibrating, setCalibrating] = useState(false),
    [calibration, setCalibration] = useState(null),
    [running, setRunning] = useState(false);
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
  return (
    <div className="preparation-grid">
      <section className="panel">
        <p className="eyebrow">ETAPA 1 · PREPARAR SESSÃO</p>
        <h2>Quem vai avaliar a sinalização?</h2>
        <p className="muted">
          Use um código, sem nome ou documento. Cada participante faz sua própria calibração.
        </p>
        <div className="form-stack">
          <label>
            Código do participante
            <input
              placeholder="Ex.: P01"
              value={participant}
              maxLength={24}
              onChange={(e) => {
                setParticipant(e.target.value.toUpperCase());
                setCalibration(null);
              }}
            />
          </label>
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
          <button className="primary" disabled={!valid} onClick={() => setCalibrating(true)}>
            {calibration ? 'Refazer calibração' : 'Calibrar olhar'}
          </button>
          {calibration && (
            <div className="notice success">
              <strong>Calibração aprovada · RMSE {number(calibration.validation_rmse, 3)}</strong>
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
