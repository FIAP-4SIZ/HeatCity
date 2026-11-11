import React from 'react';
import { number } from '../api.js';
export default function DiagnosticReport({ report }) {
  const clamp = (value) => Math.max(0, Math.min(1, value));
  return (
    <article className="panel diagnostic-report">
      <div className="section-heading">
        <div>
          <p className="eyebrow">
            {report.mode === 'sweep'
              ? 'VARREDURA GEOMÉTRICA'
              : report.mode === 'precision'
                ? 'PROTOCOLO DE PRECISÃO'
                : report.mode === 'fixed'
                  ? 'PONTOS FIXOS'
                  : 'ALVO MÓVEL'}{' '}
            · {report.basis}
          </p>
          <h3>{report.name}</h3>
        </div>
        <span
          className={`tag ${report.approved && Number.isFinite(report.rmse) && report.rmse <= 0.1 ? 'positive' : 'neutral'}`}
        >
          RMSE {number(report.rmse, 3)}
        </span>
      </div>
      <p className="small">
        Referências: {report.training} · Conferência: {report.validation} · Fora da tela:{' '}
        {report.outside} · Sem previsão na malha: {report.unsupported || 0}
      </p>
      <p className="small">
        RMSE X/Y: {report.axisRmse.map((v) => number(v, 3)).join(' / ')} · Viés X/Y:{' '}
        {report.bias.map((v) => number(v, 3)).join(' / ')}
      </p>
      <svg
        viewBox="-20 -20 540 340"
        role="img"
        aria-label="Comparação entre alvos esperados e estimativas médias"
      >
        <rect width="500" height="300" fill="#fff" stroke="#809587" />
        {report.targets.map((t, i) => (
          <g key={i}>
            <line
              x1={t.expected[0] * 500}
              y1={t.expected[1] * 300}
              x2={clamp(t.estimated[0]) * 500}
              y2={clamp(t.estimated[1]) * 300}
              stroke="#8b6d50"
              strokeWidth="2"
            />
            <circle cx={t.expected[0] * 500} cy={t.expected[1] * 300} r="7" fill="#166238" />
            <circle
              cx={clamp(t.estimated[0]) * 500}
              cy={clamp(t.estimated[1]) * 300}
              r="5"
              fill="#c04c2f"
            />
          </g>
        ))}
      </svg>
      <p className="small">
        Verde: alvo esperado. Laranja: estimativa média. Pontos fora da tela são desenhados na borda
        e contabilizados acima.
      </p>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Alvo (x, y)</th>
              <th>Estimativa média</th>
              <th>Erro médio</th>
            </tr>
          </thead>
          <tbody>
            {report.targets.map((t, i) => (
              <tr key={i}>
                <td>{t.expected.map((v) => number(v, 2)).join(', ')}</td>
                <td>{t.estimated.map((v) => number(v, 3)).join(', ')}</td>
                <td>{number(t.error, 3)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="small">
        RMSE das medianas com previsão: {number(report.recomputed, 4)}. Médias por alvo ocultam
        dispersão; este gráfico não comprova precisão humana.
      </p>
    </article>
  );
}
