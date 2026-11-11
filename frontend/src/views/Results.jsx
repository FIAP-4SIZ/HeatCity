import React, { useEffect, useState } from 'react';
import { api, download, number } from '../api.js';

export default function Results({ studyId, refresh, onError }) {
  const [data, setData] = useState(null),
    [scenarioId, setScenarioId] = useState(''),
    [sessionId, setSessionId] = useState('');
  function load() {
    api(`/studies/${studyId}/results`)
      .then((result) => {
        setData(result);
        setScenarioId((current) =>
          result.study.scenarios.some((s) => s.id === current)
            ? current
            : result.study.scenarios[0]?.id || '',
        );
      })
      .catch(onError);
  }
  useEffect(load, [studyId, refresh]);
  if (!data)
    return (
      <div className="panel loading" role="status">
        Carregando resultados…
      </div>
    );
  const scenario = data.study.scenarios.find((s) => s.id === scenarioId);
  const eligible = data.sessions.filter(
    (s) => s.scenario_id === scenarioId && s.status === 'completed' && s.metrics.eligible,
  );
  const rows = data.summary.rows.filter((r) => r.scenario_id === scenarioId);
  async function remove(id) {
    if (!window.confirm('Excluir permanentemente esta sessão e suas coordenadas?')) return;
    try {
      await api(`/sessions/${id}`, null, 'DELETE');
      setSessionId('');
      load();
    } catch (e) {
      onError(e);
    }
  }
  return (
    <section className="results-view">
      <div className="metric-grid">
        <div className="metric-card">
          <span>Sessões registradas</span>
          <strong>{data.summary.sessions_total}</strong>
        </div>
        <div className="metric-card">
          <span>Concluídas</span>
          <strong>{data.summary.completed}</strong>
        </div>
        <div className="metric-card">
          <span>Excluídas / incompletas</span>
          <strong>{data.summary.excluded}</strong>
        </div>
      </div>
      <div className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">EVIDÊNCIAS DO ESTUDO</p>
            <h2>Resultados com rastreabilidade.</h2>
          </div>
          <div className="button-row">
            <button
              className="secondary"
              onClick={() => download(`/studies/${studyId}/export.csv`)}
            >
              CSV
            </button>
            <button
              className="secondary"
              onClick={() => download(`/studies/${studyId}/export.json`)}
            >
              JSON completo
            </button>
            <button className="primary" onClick={() => download(`/studies/${studyId}/report.pdf`)}>
              Exportar relatório PDF
            </button>
          </div>
        </div>
        <p className="muted">
          Cada indicador usa participantes elegíveis da mesma tarefa e cenário. Repetições usam a
          última sessão elegível por código. Não há dados fictícios nos indicadores.
        </p>
        {scenario && (
          <label className="inline-filter">
            Cenário
            <select
              value={scenarioId}
              onChange={(e) => {
                setScenarioId(e.target.value);
                setSessionId('');
              }}
            >
              {data.study.scenarios.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
        )}
        {!data.summary.completed && (
          <div className="notice">
            Ainda não há sessões concluídas. O relatório PDF identifica a ausência de dados; não
            comprova desempenho humano.
          </div>
        )}
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Placa / tarefa</th>
                <th>Participantes válidos</th>
                <th>Observação estimada</th>
                <th>Até observar</th>
                <th>Atenção estimada</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.target}>
                  <td>
                    <strong>{row.target}</strong>
                  </td>
                  <td>{row.participants}</td>
                  <td>
                    <div className="rate">
                      <span>
                        {number(row.success_rate)}
                        {row.success_rate != null ? '%' : ''}
                      </span>
                      {row.success_rate != null && (
                        <meter min="0" max="100" value={row.success_rate} />
                      )}
                    </div>
                  </td>
                  <td>{number(row.mean_first_seconds, 2)} s</td>
                  <td>{number(row.mean_attention_seconds, 2)} s</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="small">
          “Até observar” considera somente sucessos. Tempo de atenção usa intervalos válidos
          limitados a 200 ms; entradas em área não são fixações oculares. Pontos ambíguos próximos
          às bordas não são atribuídos à placa.
        </p>
      </div>
      {scenario && (
        <div className="panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">MAPA DE DENSIDADE</p>
              <h2>Onde ficaram as estimativas?</h2>
            </div>
            <label>
              Visualização
              <select value={sessionId} onChange={(e) => setSessionId(e.target.value)}>
                <option value="">Consolidado elegível</option>
                {eligible.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.participant} · {s.target} · {new Date(s.created_at).toLocaleString('pt-BR')}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {eligible.length ? (
            <>
              <img
                className="heatmap"
                alt="Mapa de densidade das estimativas de olhar"
                src={`/api/scenarios/${scenarioId}/heatmap?mode=gaze${sessionId ? `&session_id=${sessionId}` : ''}&revision=${data.summary.sessions_total}`}
              />
              <div className="heatmap-legend">
                <span>Menor concentração</span>
                <i />
                <span>Maior concentração</span>
              </div>
              <p className="small">
                Cores normalizadas em cada imagem; não compare intensidade diretamente entre mapas.
                O mapa representa densidade de amostras, não tempo de fixação nem leitura.
              </p>
            </>
          ) : (
            <div className="empty">
              <h3>Sem rastreamento elegível neste cenário.</h3>
              <p>Sessões com qualidade insuficiente não geram mapas consolidados.</p>
            </div>
          )}
        </div>
      )}
      <div className="panel">
        <h2>Histórico das sessões</h2>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Participante</th>
                <th>Tarefa</th>
                <th>Estado</th>
                <th>Cobertura temporal</th>
                <th>RMSE</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {data.sessions.map((s) => (
                <tr key={s.id}>
                  <td>{s.participant}</td>
                  <td>{s.target}</td>
                  <td>
                    <span className={`tag ${s.metrics?.eligible ? 'positive' : 'neutral'}`}>
                      {s.status === 'running'
                        ? 'Incompleta'
                        : s.status === 'aborted'
                          ? 'Interrompida'
                          : s.metrics.eligible
                            ? 'Elegível'
                            : 'Inconclusiva'}
                    </span>
                    {s.metrics?.outcome && (
                      <p className="small">
                        {
                          {
                            observed: 'Observação confirmada',
                            not_observed: 'Sem observação confirmada',
                            inconclusive: 'Resultado inconclusivo',
                          }[s.metrics.outcome]
                        }
                      </p>
                    )}
                    {s.metrics?.uncertainty && (
                      <p className="small">
                        Margem na imagem X/Y:{' '}
                        {s.metrics.uncertainty.image_axes
                          .map((v) => `${number(v * 100, 1)}%`)
                          .join(' / ')}{' '}
                        · amostras ambíguas: {s.metrics.uncertain_samples} · observação mínima: 0,2
                        s
                      </p>
                    )}
                    {s.metrics?.reason && <p className="small">{s.metrics.reason}</p>}
                  </td>
                  <td>
                    {number(s.metrics?.coverage == null ? null : s.metrics.coverage * 100)}
                    {s.metrics?.coverage != null ? '%' : ''}
                  </td>
                  <td>{number(s.calibration?.validation_rmse, 3)}</td>
                  <td>
                    <button className="text-button danger" onClick={() => remove(s.id)}>
                      Excluir
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!data.sessions.length && <p className="muted">Nenhuma sessão registrada.</p>}
      </div>
    </section>
  );
}
