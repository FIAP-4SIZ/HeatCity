import React, { useState } from 'react';
import CalibrationLab from './CalibrationLab.jsx';
import DiagnosticReport from '../components/DiagnosticReport.jsx';
import { summarizeDiagnostic } from '../diagnostics.js';

export default function Diagnostics() {
  const [reports, setReports] = useState([]),
    [current, setCurrent] = useState(null),
    [error, setError] = useState('');
  async function load(event) {
    setError('');
    const incoming = [];
    try {
      const files = [...event.target.files];
      if (files.length > 20) throw new Error('Selecione até 20 arquivos por vez.');
      for (const file of files) {
        if (file.size > 2000000) throw new Error(`${file.name}: limite de 2 MB.`);
        incoming.push(summarizeDiagnostic(JSON.parse(await file.text()), file.name));
      }
      setReports((previous) => [...previous, ...incoming].slice(-20));
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
      <CalibrationLab
        diagnosticsOnly
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
            }}
          >
            Limpar comparação
          </button>
        </div>
        <p>
          Os arquivos são analisados neste navegador, sem envio ou cadastro. Não são incorporados ao
          repositório ou ao banco.
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
    </section>
  );
}
