import Diagnostics from './views/Diagnostics.jsx';
import React, { useEffect, useState } from 'react';
import { api, post, route, number } from './api.js';
import ScenarioEditor from './views/ScenarioEditor.jsx';
import Preparation from './views/Preparation.jsx';
import Results from './views/Results.jsx';
import Scene from './components/Scene.jsx';

function useRoute() {
  const read = () => window.location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  const [value, setValue] = useState(read);
  useEffect(() => {
    const change = () => setValue(read());
    window.addEventListener('hashchange', change);
    return () => window.removeEventListener('hashchange', change);
  }, []);
  return value;
}
function Methodology() {
  return (
    <section className="methodology">
      <div className="page-title">
        <p className="eyebrow">PROTOCOLO E LIMITES</p>
        <h1>
          Medir também é reconhecer
          <br />o que ainda não sabemos.
        </h1>
        <p>
          HeatCity é um instrumento acadêmico de estimativa de olhar em cenas de sinalização. Os
          indicadores dependem da qualidade da coleta.
        </p>
      </div>
      <div className="content-grid">
        <article className="panel">
          <span className="step-number">01</span>
          <h2>Defina a tarefa antes da coleta.</h2>
          <p>
            Cadastre uma cena, delimite suas placas e escolha uma placa a localizar por sessão.
            Cenários salvos não mudam; crie um novo para comparar A/B. Alterne a ordem entre
            participantes para reduzir aprendizagem.
          </p>
        </article>
        <article className="panel">
          <span className="step-number">02</span>
          <h2>Calibre e confira o erro.</h2>
          <p>
            O alvo móvel percorre a tela e registra 25 referências geométricas registradas
            automaticamente. Treze alvos posteriores conferem o erro, sem treinamento. A autorização
            exige RMSE ≤ 0,100 e erro menor que metade da menor dimensão da placa escolhida. São
            critérios experimentais, não limites clínicos.
          </p>
        </article>
        <article className="panel">
          <span className="step-number">03</span>
          <h2>Preserve a incerteza.</h2>
          <p>
            Piscadas e detecções inválidas não viram coordenadas artificiais. Pontos dentro da
            margem de RMSE junto às bordas não contam para a placa. Sessões com menos de 30 amostras
            válidas ou cobertura inferior a 60% ficam fora do consolidado.
          </p>
        </article>
        <article className="panel">
          <span className="step-number">04</span>
          <h2>Compare com responsabilidade.</h2>
          <p>
            A taxa usa participantes da mesma tarefa e cenário. O tempo até observar considera
            somente sucessos. Densidade não é fixação, leitura ou compreensão. Resultados não
            certificam acessibilidade, visibilidade física ou sinalização real em 3D.
          </p>
        </article>
      </div>
      <div className="notice">
        <strong>Privacidade por padrão.</strong>
        <p>
          A câmera é processada no navegador. Não salvamos vídeo ou fotos do participante. São
          persistidos códigos, coordenadas, calibração e métricas. Esta edição é local, de operador
          único, sem autenticação: não deve ser publicada como serviço compartilhado.
        </p>
      </div>
    </section>
  );
}

export default function App() {
  const path = useRoute(),
    studyId = path[0] === 'studies' ? path[1] : null,
    tab = path[2] || 'overview';
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem('heatcity-theme') === 'dark' ? 'dark' : 'light';
    } catch {
      return 'light';
    }
  });
  const [studies, setStudies] = useState([]),
    [study, setStudy] = useState(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [revision, setRevision] = useState(0),
    [creating, setCreating] = useState(false),
    [title, setTitle] = useState(''),
    [objective, setObjective] = useState(''),
    [busy, setBusy] = useState(false),
    [editing, setEditing] = useState(false);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem('heatcity-theme', theme);
    } catch {}
  }, [theme]);
  useEffect(() => {
    api('/studies')
      .then(setStudies)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [revision]);
  useEffect(() => {
    setError('');
    setEditing(false);
    if (!studyId) {
      setStudy(null);
      return;
    }
    let active = true;
    setStudy(null);
    api(`/studies/${studyId}`)
      .then((value) => {
        if (active) setStudy(value);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [studyId, revision]);
  const fail = (e) => setError(e.message || String(e));
  async function create(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const result = await post('/studies', { title: title.trim(), objective: objective.trim() });
      setTitle('');
      setObjective('');
      setCreating(false);
      setRevision((r) => r + 1);
      route(`/studies/${result.id}`);
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  }
  async function deleteStudy() {
    if (
      !window.confirm(
        'Excluir este estudo, seus cenários e todas as sessões? Esta ação é permanente.',
      )
    )
      return;
    try {
      await api(`/studies/${studyId}`, null, 'DELETE');
      setRevision((r) => r + 1);
      route('/');
      setNotice('Estudo e seus registros excluídos.');
    } catch (e) {
      fail(e);
    }
  }
  const tabs = [
    ['overview', 'Visão geral'],
    ['scenarios', 'Cenários e placas'],
    ['prepare', 'Nova sessão'],
    ['results', 'Resultados'],
  ];
  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <a className="app-brand" href="#/">
          Heat<span>City</span>
          <i />
        </a>
        <p className="sidebar-caption">
          LABORATÓRIO DE
          <br />
          ATENÇÃO VISUAL
        </p>
        <nav aria-label="Navegação principal">
          <a className={!['method', 'diagnostics'].includes(path[0]) ? 'active' : ''} href="#/">
            <span>▦</span> Estudos
          </a>
          <a className={path[0] === 'method' ? 'active' : ''} href="#/method">
            <span>◎</span> Método e qualidade
          </a>
          <a className={path[0] === 'diagnostics' ? 'active' : ''} href="#/diagnostics">
            <span>⌁</span> Diagnósticos / DEV
          </a>
        </nav>
        <div className="sidebar-bottom">
          <span className="local-dot" /> Ambiente local
          <p>
            Global Solution · FIAP
            <br />
            Visão computacional aplicada
          </p>
          <button
            className="theme-switch"
            onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
          >
            {theme === 'light' ? '◐ Tema escuro' : '☀ Tema claro'}
          </button>
        </div>
      </aside>
      <main className="app-main">
        <header className="app-topbar">
          <div>
            <span className="breadcrumb">WORKSPACE</span>
            <span className="breadcrumb-current">
              {path[0] === 'diagnostics'
                ? 'Diagnósticos / DEV'
                : path[0] === 'method'
                  ? 'Método e qualidade'
                  : study?.title || 'Estudos de sinalização'}
            </span>
          </div>
          <span className="tag neutral">MVP · Olhar experimental</span>
        </header>
        {error && (
          <div className="global-message error" role="alert">
            {error}
            <button className="text-button" onClick={() => setError('')}>
              Fechar
            </button>
          </div>
        )}
        {notice && (
          <div className="global-message" role="status">
            {notice}
            <button className="text-button" onClick={() => setNotice('')}>
              Fechar
            </button>
          </div>
        )}
        {path[0] === 'diagnostics' ? (
          <Diagnostics />
        ) : path[0] === 'method' ? (
          <Methodology />
        ) : studyId ? (
          <>
            {!study && !error && (
              <div className="loading" role="status">
                Carregando estudo…
              </div>
            )}
            {study && (
              <>
                <div className="page-title study-title">
                  <div>
                    <p className="eyebrow">ESTUDO DE SINALIZAÇÃO</p>
                    <h1>{study.title}</h1>
                    <p>{study.objective}</p>
                  </div>
                  <button className="text-button danger" onClick={deleteStudy}>
                    Excluir estudo
                  </button>
                </div>
                <nav className="study-tabs" aria-label="Etapas do estudo">
                  {tabs.map(([value, label]) => (
                    <a
                      className={tab === value ? 'active' : ''}
                      key={value}
                      href={`#/studies/${studyId}/${value}`}
                    >
                      {label}
                    </a>
                  ))}
                </nav>
                {tab === 'overview' && (
                  <>
                    <div className="study-hero">
                      <div>
                        <span className="tag">DO AMBIENTE À EVIDÊNCIA</span>
                        <h2>
                          Entenda o caminho
                          <br />
                          do olhar até a informação.
                        </h2>
                        <p>
                          Prepare a cena, registre uma tarefa e interprete apenas os dados que
                          atendem aos critérios de qualidade.
                        </p>
                        <button
                          className="primary"
                          onClick={() =>
                            route(
                              `/studies/${studyId}/${study.scenarios.length ? 'prepare' : 'scenarios'}`,
                            )
                          }
                        >
                          {study.scenarios.length
                            ? 'Preparar participante →'
                            : 'Adicionar primeiro cenário →'}
                        </button>
                      </div>
                      <div className="hero-visual" aria-hidden="true">
                        <div className="signal signal-one">RECEPÇÃO ↗</div>
                        <div className="signal signal-two">SAÍDA →</div>
                        <div className="focus-ring">
                          <i />
                        </div>
                        <div className="visual-grid" />
                      </div>
                    </div>
                    <div className="content-grid">
                      <article className="panel">
                        <p className="eyebrow">01 · CONTEXTO</p>
                        <h3>
                          {study.scenarios.length} cenário{study.scenarios.length !== 1 ? 's' : ''}{' '}
                          pronto{study.scenarios.length !== 1 ? 's' : ''} para avaliar
                        </h3>
                        <p>
                          Imagens e áreas de interesse preservam a referência espacial de cada
                          sessão.
                        </p>
                        <button
                          className="text-button"
                          onClick={() => route(`/studies/${studyId}/scenarios`)}
                        >
                          Gerenciar cenários →
                        </button>
                      </article>
                      <article className="panel">
                        <p className="eyebrow">02 · QUALIDADE</p>
                        <h3>Resultados com limites explícitos.</h3>
                        <p>
                          Calibrações reprovadas e rastreamento insuficiente são identificados como
                          inconclusivos. Nenhuma tentativa reprovada vira observação válida.
                        </p>
                        <a className="text-link" href="#/method">
                          Conhecer os critérios →
                        </a>
                      </article>
                    </div>
                  </>
                )}
                {tab === 'scenarios' &&
                  (editing ? (
                    <ScenarioEditor
                      study={study}
                      onCancel={() => setEditing(false)}
                      onSaved={() => {
                        setEditing(false);
                        setRevision((r) => r + 1);
                        setNotice('Cenário salvo. As áreas estão prontas para calibração.');
                      }}
                    />
                  ) : (
                    <section>
                      <div className="section-heading">
                        <div>
                          <p className="eyebrow">CENÁRIOS E ÁREAS DE INTERESSE</p>
                          <h2>Uma referência visual para cada avaliação.</h2>
                        </div>
                        <button className="primary" onClick={() => setEditing(true)}>
                          + Novo cenário
                        </button>
                      </div>
                      {!study.scenarios.length ? (
                        <div className="empty panel">
                          <span className="empty-icon">▧</span>
                          <h3>Comece com a imagem de um ambiente.</h3>
                          <p>
                            Envie uma cena ou use a imagem didática para conhecer o fluxo. Não são
                            criadas sessões fictícias.
                          </p>
                        </div>
                      ) : (
                        <div className="scenario-grid">
                          {study.scenarios.map((s) => (
                            <article className="panel scenario-card" key={s.id}>
                              <Scene scenario={s} />
                              <h3>{s.name}</h3>
                              <p>
                                {s.plates.length} placas · {s.width} × {s.height} px
                              </p>
                              <div className="table-scroll">
                                <table>
                                  <thead>
                                    <tr>
                                      <th>Placa</th>
                                      <th>Área</th>
                                      <th>Contraste local</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {s.image_metrics.map((m) => (
                                      <tr key={m.name}>
                                        <td>{m.name}</td>
                                        <td>{number(m.area_percent)}%</td>
                                        <td>{number(m.local_contrast, 3)}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                              <p className="small">
                                OpenCV: contraste por percentis de luminância. É uma descrição da
                                imagem, não certificação de acessibilidade.
                              </p>
                            </article>
                          ))}
                        </div>
                      )}
                    </section>
                  ))}
                {tab === 'prepare' && (
                  <Preparation
                    key={`${study.id}-${revision}`}
                    study={study}
                    onFinished={(session) => {
                      setRevision((r) => r + 1);
                      setNotice(
                        session.metrics.eligible
                          ? 'Sessão salva e incluída na análise.'
                          : 'Sessão salva como inconclusiva e excluída do consolidado.',
                      );
                      route(`/studies/${studyId}/results`);
                    }}
                  />
                )}
                {tab === 'results' && (
                  <Results studyId={studyId} refresh={revision} onError={fail} />
                )}
              </>
            )}
          </>
        ) : (
          <section className="studies-home">
            <div className="page-title">
              <div>
                <p className="eyebrow">OBSERVAR PARA TRANSFORMAR</p>
                <h1>
                  Cidades mais claras.
                  <br />
                  Decisões com evidências.
                </h1>
                <p>
                  Avalie como participantes localizam sinalizações em imagens.
                  <br />
                  Da delimitação das placas à análise de estimativas de olhar.
                </p>
              </div>
              <div className="button-row">
                <button className="secondary" onClick={() => route('/diagnostics')}>
                  Diagnósticos
                </button>
                <button className="primary" onClick={() => setCreating(true)}>
                  + Criar estudo
                </button>
              </div>
            </div>
            <div className="home-strip">
              <div>
                <span className="strip-number">01</span>
                <strong>Prepare o ambiente</strong>
                <small>Cenas e placas delimitadas</small>
              </div>
              <div>
                <span className="strip-number">02</span>
                <strong>Calibre por participante</strong>
                <small>Validação independente</small>
              </div>
              <div>
                <span className="strip-number">03</span>
                <strong>Interprete os resultados</strong>
                <small>Qualidade antes de conclusões</small>
              </div>
            </div>
            {creating && (
              <form className="panel create-form" onSubmit={create}>
                <div className="section-heading">
                  <h2>Novo estudo</h2>
                  <button type="button" className="text-button" onClick={() => setCreating(false)}>
                    Cancelar
                  </button>
                </div>
                <div className="form-stack">
                  <label>
                    Título
                    <input
                      autoFocus
                      required
                      minLength={3}
                      maxLength={100}
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Ex.: Sinalização do hospital"
                    />
                  </label>
                  <label>
                    Objetivo da avaliação
                    <textarea
                      required
                      minLength={10}
                      maxLength={1000}
                      value={objective}
                      onChange={(e) => setObjective(e.target.value)}
                      placeholder="Qual problema de orientação você quer investigar?"
                      rows={3}
                    />
                  </label>
                  <button className="primary" disabled={busy}>
                    {busy ? 'Salvando…' : 'Criar estudo'}
                  </button>
                </div>
              </form>
            )}
            <div className="section-heading">
              <h2>Seus estudos</h2>
              <span className="muted">
                {studies.length} registrado{studies.length !== 1 ? 's' : ''}
              </span>
            </div>
            {loading ? (
              <div className="loading" role="status">
                Carregando estudos…
              </div>
            ) : !studies.length ? (
              <div className="empty panel">
                <span className="empty-icon">◎</span>
                <h3>Sua primeira investigação começa aqui.</h3>
                <p>
                  Crie um estudo, adicione uma cena e delimite as placas antes de convidar um
                  participante.
                </p>
                <button className="secondary" onClick={() => setCreating(true)}>
                  Criar primeiro estudo
                </button>
              </div>
            ) : (
              <div className="study-grid">
                {studies.map((s, index) => (
                  <article className="study-card" key={s.id}>
                    <div className="study-card-top">
                      <span className="study-index">{String(index + 1).padStart(2, '0')}</span>
                      <span className="tag neutral">Estudo local</span>
                    </div>
                    <h3>{s.title}</h3>
                    <p>{s.objective}</p>
                    <div className="study-card-bottom">
                      <span>{new Date(s.created_at).toLocaleDateString('pt-BR')}</span>
                      <button className="text-button" onClick={() => route(`/studies/${s.id}`)}>
                        Abrir estudo ↗
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
            <div className="research-note">
              <span>◎</span>
              <div>
                <strong>Estimativa de olhar não é certeza de atenção.</strong>
                <p>
                  O HeatCity separa evidências elegíveis de resultados inconclusivos. Conheça o
                  método antes de iniciar a coleta.
                </p>
              </div>
              <a href="#/method">Entender o método →</a>
            </div>
          </section>
        )}
        <footer className="app-footer">
          <span>HeatCity · Transformando olhares em cidades mais inteligentes.</span>
          <span>Global Solution FIAP · MVP acadêmico</span>
        </footer>
      </main>
    </div>
  );
}
