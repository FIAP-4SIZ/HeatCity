import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { loadReferences, uploadProject } from '../references.js';
import ReferenceEditor from './ReferenceEditor.jsx';
export default function ReferenceLibrary() {
  const [references, setReferences] = useState([]),
    [project, setProject] = useState(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    loadReferences()
      .then((r) => active && setReferences(r))
      .catch((e) => active && setError(e.message));
    return () => {
      active = false;
    };
  }, [revision]);
  async function add() {
    setBusy(true);
    setError('');
    try {
      setProject(await uploadProject());
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function remove(reference) {
    if (!confirm(`Excluir a foto “${reference.name}” e suas placas?`)) return;
    try {
      await api(`/references/${reference.id}`, null, 'DELETE');
      setRevision((x) => x + 1);
    } catch (e) {
      setError(e.message);
    }
  }
  return (
    <section>
      <div className="page-title">
        <p className="eyebrow">FOTOS E PLACAS</p>
        <h1>Suas fotos de referência.</h1>
        <p>Cada foto guarda os recortes que serão procurados no vídeo.</p>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {project ? (
        <ReferenceEditor
          project={project}
          onCancel={() => setProject(null)}
          onSaved={() => {
            setProject(null);
            setRevision((x) => x + 1);
          }}
        />
      ) : (
        <>
          <div className="section-heading">
            <p>{references.length} foto(s) cadastrada(s)</p>
            <button className="primary" onClick={add} disabled={busy}>
              Cadastrar foto
            </button>
          </div>
          <div className="reference-grid">
            {references.map((r) => (
              <article className="panel reference-card" key={r.id}>
                <div className="reference-cover">
                  <img src={r.image} alt={`Foto: ${r.name}`} />
                  <span className="tag">{r.plates.length} placas</span>
                </div>
                <div className="reference-info">
                  <h2>{r.name}</h2>
                  <p>{r.plates.map((p) => p.name).join(' · ')}</p>
                  <div className="button-row">
                    <a className="primary button-link" href={`#/analysis/${r.id}`}>
                      Usar esta foto →
                    </a>
                    <a className="text-link" href={`#/pdi/${r.id}`}>
                      Ver processamento da imagem
                    </a>
                    {!r.fixture_key && (
                      <button className="text-button danger" onClick={() => remove(r)}>
                        Excluir foto
                      </button>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
