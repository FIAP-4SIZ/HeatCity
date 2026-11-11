import React, { useState } from 'react';
import { number } from '../api.js';
const labels = {
  combined: 'Média dos dois olhos',
  eye0: 'Olho 0 do detector',
  eye1: 'Olho 1 do detector',
};
export default function SignalReport({ analysis, title = 'Variação e separação do sinal ocular' }) {
  const [channel, setChannel] = useState('combined');
  if (!analysis?.references?.length) return null;
  const nodes = analysis.references,
    comparison = analysis.comparisons[channel];
  const extent = (axis) => {
    const low = Math.min(
      ...nodes.map((n) => n.channels[channel].center[axis] - n.channels[channel].radius_p90),
    );
    const high = Math.max(
      ...nodes.map((n) => n.channels[channel].center[axis] + n.channels[channel].radius_p90),
    );
    return [low, Math.max(high - low, 0.0001)];
  };
  const [minX, rangeX] = extent(0),
    [minY, rangeY] = extent(1),
    scale = Math.min(580 / rangeX, 280 / rangeY);
  const x = (v) => 50 + (v - minX) * scale,
    y = (v) => 30 + (v - minY) * scale;
  const weak = [...comparison.pairs].sort((a, b) => a.gap - b.gap).slice(0, 10);
  return (
    <article className="panel signal-report">
      <p className="eyebrow">DIAGNÓSTICO DESCRITIVO · SEM TREINAMENTO</p>
      <h3>{title}</h3>
      <p>
        {nodes.length} referências com pelo menos duas amostras. {comparison.overlapping_pairs}/
        {comparison.total_pairs} pares de alvos diferentes têm discos de dispersão sobrepostos neste
        canal.
      </p>
      <label>
        Canal ocular
        <select value={channel} onChange={(e) => setChannel(e.target.value)}>
          {Object.entries(labels).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <svg
        viewBox="0 0 700 350"
        role="img"
        aria-label="Centros e dispersão das coordenadas oculares por alvo"
      >
        <title>
          Espaço das características oculares, não coordenadas da tela. Escala igual nos dois eixos;
          Y cresce para baixo.
        </title>
        {nodes.map((n) => {
          const s = n.channels[channel];
          return (
            <g key={n.index}>
              <circle
                cx={x(s.center[0])}
                cy={y(s.center[1])}
                r={Math.max(0, s.radius_p90 * scale)}
                fill="none"
                stroke="currentColor"
                strokeOpacity="0.35"
              />
              {s.first_half && (
                <line
                  x1={x(s.first_half[0])}
                  y1={y(s.first_half[1])}
                  x2={x(s.last_half[0])}
                  y2={y(s.last_half[1])}
                  stroke="#bd6e35"
                />
              )}
              <circle cx={x(s.center[0])} cy={y(s.center[1])} r="3" fill="currentColor" />
              <text x={x(s.center[0]) + 5} y={y(s.center[1]) - 5} fill="currentColor" fontSize="11">
                {n.index + 1}
              </text>
            </g>
          );
        })}
      </svg>
      <p className="small">
        Cada número identifica uma referência. Círculo: centro mediano e raio P90 das distâncias ao
        centro. Linha laranja: mudança entre as metades inicial e final da coleta. As posições são
        relativas ao olho, sem unidade de tela ou erro em pixels. Olho 0/1 seguem os índices do
        detector; não identificam etnia.
      </p>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Ref. / alvo na tela</th>
              <th>Amostras / em movimento</th>
              <th>Centro ocular X/Y</th>
              <th>Raio P90</th>
              <th>Deslocamento entre metades</th>
              <th>P90 sem movimento</th>
            </tr>
          </thead>
          <tbody>
            {nodes.map((n) => (
              <tr key={n.index}>
                <td>
                  {n.index + 1} · {n.target.map((v) => number(v, 3)).join(' / ')}
                </td>
                <td>
                  {n.n} / {n.motion_samples ?? 'não registrado'}
                </td>
                <td>{n.channels[channel].center.map((v) => number(v, 4)).join(' / ')}</td>
                <td>{number(n.channels[channel].radius_p90, 4)}</td>
                <td>{number(n.channels[channel].drift, 4)}</td>
                <td>{channel === 'combined' ? number(n.stationary?.radius_p90, 4) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h4>Pares com menor margem de separação</h4>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Referências</th>
              <th>Distância entre centros</th>
              <th>Soma dos raios P90</th>
              <th>Distância − raios</th>
            </tr>
          </thead>
          <tbody>
            {weak.map((p) => (
              <tr key={`${p.a}-${p.b}`}>
                <td>
                  {p.a + 1} / {p.b + 1}
                </td>
                <td>{number(p.distance, 4)}</td>
                <td>{number(p.spread_sum, 4)}</td>
                <td>
                  {number(p.gap, 4)} · {p.overlap ? 'sobreposição descritiva' : 'discos separados'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!comparison.total_pairs && (
        <p>É necessário registrar dois alvos diferentes para comparar sinais.</p>
      )}
      <p>{analysis.note}</p>
      <p className="small">
        A tabela compara todos os pares disponíveis, não apenas vizinhos. Não usa classificação,
        regressão, ajuste de pesos nem seleção automática do melhor olho. Quadros são
        correlacionados e P90 não é garantia de distinguir o olhar. Os dados sem movimento só são
        calculados quando há marcação temporal compatível.
      </p>
    </article>
  );
}
