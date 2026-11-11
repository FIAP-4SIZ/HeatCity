import React, { useState } from 'react';
import { api, post } from '../api.js';
import Scene from '../components/Scene.jsx';

export default function ScenarioEditor({ study, onSaved, onCancel }) {
  const [scene, setScene] = useState(null),
    [name, setName] = useState('Cenário A'),
    [label, setLabel] = useState(''),
    [plates, setPlates] = useState([]),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  async function example() {
    try {
      const data = await api('/scene-example');
      setScene({ ...data, width: 1000, height: 600 });
      setPlates(data.plates);
      setName(data.name);
      setError('');
    } catch (e) {
      setError(e.message);
    }
  }
  async function upload(event) {
    const file = event.target.files[0];
    if (!file) return;
    setError('');
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 4000000) {
      setError('Envie PNG, JPEG ou WebP com até 4 MB.');
      return;
    }
    try {
      const image = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const bitmap = await createImageBitmap(file);
      if (bitmap.width * bitmap.height > 8000000 || Math.min(bitmap.width, bitmap.height) < 200)
        throw new Error('A cena deve ter ao menos 200 px por lado e até 8 megapixels.');
      setScene({ image, width: bitmap.width, height: bitmap.height });
      bitmap.close();
      setPlates([]);
    } catch (e) {
      setError(e.message || 'Não foi possível ler a imagem.');
    }
  }
  function addArea(area) {
    const text = label.trim();
    if (!text) {
      setError('Informe o nome da placa antes de desenhar a área.');
      return;
    }
    if (plates.some((p) => p.name === text)) {
      setError('Esse nome já foi usado.');
      return;
    }
    setPlates([...plates, { ...area, name: text }]);
    setLabel('');
    setError('');
  }
  async function save() {
    setBusy(true);
    setError('');
    try {
      await post(`/studies/${study.id}/scenarios`, { name, image: scene.image, plates });
      onSaved();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel scenario-editor">
      <div className="section-heading">
        <div>
          <p className="eyebrow">CONSTRUIR CENÁRIO</p>
          <h2>Onde estão as placas?</h2>
        </div>
        <button className="secondary" onClick={onCancel}>
          Cancelar
        </button>
      </div>
      <p className="muted">
        Use uma imagem do ambiente, nomeie cada placa e arraste para delimitar sua área. Cenários
        salvos são imutáveis para preservar os resultados.
      </p>
      <div className="form-row">
        <label>
          Nome do cenário
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
        </label>
        <label>
          Imagem do ambiente
          <input type="file" accept="image/png,image/jpeg,image/webp" onChange={upload} />
        </label>
        <button className="secondary" onClick={example}>
          Usar cena didática
        </button>
      </div>
      {scene && (
        <>
          <div className="editor-grid">
            <Scene scenario={scene} plates={plates} edit onArea={addArea} />
            <div>
              <label>
                Próxima placa
                <input
                  value={label}
                  placeholder="Ex.: Recepção"
                  maxLength={60}
                  onChange={(e) => setLabel(e.target.value)}
                />
              </label>
              <p className="small">
                Depois de nomear, arraste na imagem. Áreas não devem se sobrepor.
              </p>
              <ul className="plate-list">
                {plates.map((p, i) => (
                  <li key={p.name}>
                    <span>
                      {i + 1}. {p.name}
                    </span>
                    <button
                      className="text-button"
                      aria-label={`Remover ${p.name}`}
                      onClick={() => setPlates(plates.filter((_, index) => i !== index))}
                    >
                      Remover
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <button
            className="primary"
            disabled={busy || !plates.length || !name.trim()}
            onClick={save}
          >
            {busy ? 'Salvando…' : 'Salvar cenário e áreas'}
          </button>
        </>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
