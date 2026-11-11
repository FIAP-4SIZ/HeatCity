import React, { useRef, useState } from 'react';
import CalibrationLab from './CalibrationLab.jsx';
import DiagnosticReport from '../components/DiagnosticReport.jsx';
import { summarizeDiagnostic } from '../diagnostics.js';
import { signalAttempts } from '../signal-analysis.js';
import SignalReport from '../components/SignalReport.jsx';

export default function Diagnostics() {
  const [reports, setReports] = useState([]),
    [current, setCurrent] = useState(null),
    [error, setError] = useState('');
  const [signalReports, setSignalReports] = useState([]);
  const snapshot = useRef(() => ({}));
  function exportPage() {
    const page = snapshot.current();
    const latest = page.calibrations?.at(-1) || {};
    const data = {
      ...latest,
      page_diagnostic_version: 1,
      page_diagnostic: page,
      imported_comparisons: reports,
      imported_signal_comparisons: signalReports,
      privacy:
        'Sem cadastro, nomes, documentos, vídeo ou imagens faciais. Coordenadas e características numéricas locais.',
      precision_note: 'Sem alvo de referência, o tracking experimental não mede erro de olhar.',
    };
    const url = URL.createObjectURL(new Blob([JSON.stringify(data)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'heatcity-diagnostico-completo.json';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function load(event) {
    setError('');
    const incoming = [],
      signals = [];
    try {
      const files = [...event.target.files];
      if (files.length > 20) throw new Error('Selecione até 20 arquivos por vez.');
      for (const file of files) {
        if (file.size > 10000000) throw new Error(`${file.name}: limite de 10 MB.`);
        const data = JSON.parse(await file.text());
        const attempts = signalAttempts(data);
        signals.push(...attempts.map((a) => ({ ...a, name: file.name })));
        if (data.quality && Array.isArray(data.residuals))
          incoming.push(summarizeDiagnostic(data, file.name));
        else if (!attempts.length)
          throw new Error('Arquivo sem resíduos de conferência ou amostras por alvo.');
      }
      setReports((previous) => [...previous, ...incoming].slice(-20));
      setSignalReports((previous) => [...previous, ...signals].slice(-20));
    } catch (e) {
      setError(e.message);
    }
    event.target.value = '';
  }
  return (
    <section>
      <div className="page-title">
        <div>
          <p className="eyebrow">LABORATÓRIO INDEPENDENTE</p>
          <h1>Diagnóstico do olhar.</h1>
          <p>
            Teste a câmera, calibre e veja as estimativas sem cadastrar estudo, cena ou
            participante.
          </p>
        </div>
        <span className="tag neutral">DEV · não gera evidência de estudo</span>
      </div>
      <div className="notice">
        <strong>Diagnóstico não libera uma sessão.</strong>
        <p>
          É possível visualizar estimativas de uma calibração reprovada para investigar erros. O
          limite dos estudos continua em 0,100; esses testes não são persistidos como observações
          válidas.
        </p>
      </div>
      <div className="panel">
        <button className="primary" onClick={exportPage}>
          Baixar diagnóstico completo da página
        </button>
        <p className="small">
          Sem cadastro. Inclui até 5 calibrações, telemetria e os últimos 5.000 registros da câmera
          e do tracking experimental (até 10 por segundo), aprovado ou reprovado. Exporte depois de
          testar. Não contém imagens; sem alvos conhecidos, o tracking não comprova precisão.
        </p>
      </div>
      <CalibrationLab
        diagnosticsOnly
        registerSnapshot={(getter) => {
          snapshot.current = getter;
        }}
        onDiagnostic={(data) => {
          try {
            setCurrent(summarizeDiagnostic(data));
          } catch (e) {
            setError(e.message);
          }
        }}
      />
      <section className="panel diagnostic-import">
        <div className="section-heading">
          <div>
            <p className="eyebrow">COMPARAR TENTATIVAS</p>
            <h2>Abra seus diagnósticos JSON.</h2>
          </div>
          <button
            className="secondary"
            onClick={() => {
              setReports([]);
              setCurrent(null);
              setSignalReports([]);
            }}
          >
            Limpar comparação
          </button>
        </div>
        <p>
          São exibidas até 20 análises de sinal importadas. Os arquivos são analisados neste
          navegador, sem envio ou cadastro. Não são incorporados ao repositório ou ao banco.
        </p>
        <label>
          Importar diagnósticos
          <input type="file" multiple accept="application/json,.json" onChange={load} />
        </label>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
      </section>
      <div className="diagnostic-grid">
        {current && <DiagnosticReport report={current} />}{' '}
        {reports.map((r, i) => (
          <DiagnosticReport key={i} report={r} />
        ))}
      </div>
      {signalReports.map((r, i) => (
        <SignalReport
          key={i}
          analysis={r.analysis}
          title={`${r.name} · tentativa ${r.attempt} · sinal ocular`}
        />
      ))}
    </section>
  );
}
