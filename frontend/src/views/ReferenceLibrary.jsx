import { isHospitalAlternative, referenceLabel } from '../reference-labels.js';
import React, { useEffect, useState } from 'react';
import { api, post, route } from '../api.js';
import ReferenceEditor from './ReferenceEditor.jsx';

export default function ReferenceLibrary({ projectId }) {
  const [projects, setProjects] = useState([]),
    [project, setProject] = useState(null),
    [revision, setRevision] = useState(0),
    [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false),
    [editing, setEditing] = useState(false),
    [title, setTitle] = useState(''),
    [objective, setObjective] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    setEditing(false);
    setProject(null);
    Promise.all([
      api('/projects'),
      projectId ? api(`/projects/${projectId}`) : Promise.resolve(null),
    ])
      .then(([all, current]) => {
        if (active) {
          setProjects(all);
          setProject(current);
        }
      })
      .catch((e) => active && setError(e.message))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [projectId, revision]);
  async function create(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const value = await post('/projects', { title, objective });
      setCreating(false);
      setTitle('');
      setObjective('');
      route(`/references/${value.id}`);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function remove(path, message) {
    if (!confirm(message)) return;
    setError('');
    try {
      await api(path, null, 'DELETE');
      if (path.startsWith('/projects/')) route('/references');
      else setRevision((v) => v + 1);
    } catch (e) {
      setError(e.message);
    }
  }
  const referenceCard = (r) => (
    <article className="panel reference-card" key={r.id}>
      <div className="reference-cover">
        <img src={r.image} alt={`Imagem de referência: ${r.name}`} />
        <span className="tag">{r.plates.length} placas</span>
      </div>
      <div className="reference-info">
        <h2>{referenceLabel(r)}</h2>
        <p className="small">
          {r.width} × {r.height} px · {r.plates.map((p) => p.name).join(' · ')}
        </p>
        <div className="button-row">
          <a className="primary button-link" href={`#/analysis/${r.id}`}>
            Analisar vídeo →
          </a>
          <button
            className="text-button danger"
            onClick={() =>
              remove(`/references/${r.id}`, 'Excluir esta imagem e seus recortes de referência?')
            }
          >
            Excluir referência
          </button>
        </div>
        <details>
          <summary>Recortes cadastrados</summary>
          <ul>
            {r.plates.map((p) => (
              <li key={p.name}>
                {p.name} — x {p.x.toFixed(3)}, y {p.y.toFixed(3)}, largura {p.width.toFixed(3)},
                altura {p.height.toFixed(3)}
              </li>
            ))}
          </ul>
        </details>
      </div>
    </article>
  );
  return (
    <section>
      <div className="page-title">
        <p className="eyebrow">CATÁLOGO DE REFERÊNCIAS</p>
        <h1>{project?.title || 'As placas começam aqui.'}</h1>
        <p>
          {(project?.id === 'hospital-orientacao-base-v1'
            ? 'A referência principal fornece os recortes das placas para o vídeo de exemplo. Você não precisa comparar duas imagens para analisar um vídeo.'
            : project?.objective) ||
            'Organize ambientes, envie imagens nítidas e delimite as placas que o detector deve procurar.'}
        </p>
      </div>
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      {loading && <p role="status">Carregando referências…</p>}
      {!projectId && !loading && (
        <>
          <div className="section-heading">
            <h2>
              Seus projetos <span className="count">{projects.length}</span>
            </h2>
            <button className="primary" onClick={() => setCreating(!creating)}>
              {creating ? 'Fechar formulário' : '+ Novo projeto'}
            </button>
          </div>
          {creating && (
            <form className="panel project-form" onSubmit={create}>
              <h2>Novo projeto de sinalização</h2>
              <label>
                Título
                <input
                  autoFocus
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  minLength={3}
                  maxLength={100}
                  required
                  placeholder="Ex.: Entrada do terminal"
                />
              </label>
              <label>
                Objetivo
                <textarea
                  value={objective}
                  onChange={(e) => setObjective(e.target.value)}
                  minLength={10}
                  maxLength={1000}
                  required
                  placeholder="Quais placas deseja localizar e em qual percurso?"
                />
              </label>
              <button className="primary" disabled={busy}>
                {busy ? 'Salvando…' : 'Criar projeto'}
              </button>
            </form>
          )}
          <div className="project-grid">
            {projects.map((p) => (
              <article className="panel project-card" key={p.id}>
                <span className="card-icon">▣</span>
                <p className="eyebrow">PROJETO DE SINALIZAÇÃO</p>
                <h2>{p.title}</h2>
                <p>
                  {p.id === 'hospital-orientacao-base-v1'
                    ? 'Um exemplo pronto: placas cadastradas e vídeo sintético para entender o fluxo.'
                    : p.objective}
                </p>
                <a className="text-link" href={`#/references/${p.id}`}>
                  Abrir projeto →
                </a>
              </article>
            ))}
          </div>
          {!projects.length && (
            <div className="empty panel">
              <h2>Prepare sua primeira referência.</h2>
              <p>Crie um projeto e envie uma imagem com as placas que aparecerão no vídeo.</p>
            </div>
          )}
        </>
      )}
      {project && (
        <>
          <div className="section-heading">
            <div className="button-row">
              <a className="text-link" href="#/references">
                ← Todos os projetos
              </a>
              <span className="tag neutral">
                {project.references.filter((r) => !isHospitalAlternative(r)).length} imagens
                principais ·{' '}
                {project.references
                  .filter((r) => !isHospitalAlternative(r))
                  .reduce((n, r) => n + r.plates.length, 0)}{' '}
                recortes
              </span>
            </div>
            <div className="button-row">
              <button
                className="secondary danger"
                onClick={() =>
                  remove(
                    `/projects/${project.id}`,
                    'Excluir este projeto e suas imagens de referência?',
                  )
                }
              >
                Excluir projeto
              </button>
              <button className="primary" onClick={() => setEditing(true)}>
                + Nova referência
              </button>
            </div>
          </div>
          {editing ? (
            <ReferenceEditor
              project={project}
              onCancel={() => setEditing(false)}
              onSaved={() => {
                setEditing(false);
                setRevision((v) => v + 1);
              }}
            />
          ) : (
            <>
              <div className="reference-grid">
                {project.references.filter((r) => !isHospitalAlternative(r)).map(referenceCard)}
              </div>
              {project.references.some(isHospitalAlternative) && (
                <details className="panel alternative-references">
                  <summary>Material alternativo: outra imagem do hospital</summary>
                  <p>
                    A imagem B veio da comparação anterior de posicionamentos. Ela não é necessária
                    para o vídeo de exemplo, que usa a imagem A. Só escolha outra referência se ela
                    corresponder ao conteúdo do seu próprio vídeo.
                  </p>
                  <div className="reference-grid">
                    {project.references.filter(isHospitalAlternative).map(referenceCard)}
                  </div>
                </details>
              )}
              {!project.references.length && (
                <div className="empty panel">
                  <h2>Adicione uma imagem do ambiente.</h2>
                  <p>
                    Envie PNG, JPEG ou WebP, nomeie as placas e arraste os recortes sobre a imagem.
                    Depois, abra um vídeo que contenha essas referências.
                  </p>
                </div>
              )}
            </>
          )}
        </>
      )}
    </section>
  );
}
