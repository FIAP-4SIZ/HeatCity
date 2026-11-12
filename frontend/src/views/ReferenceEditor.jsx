import React, { useState } from 'react';
import { post } from '../api.js';
import Scene from '../components/Scene.jsx';

export default function ReferenceEditor({ project, onSaved, onCancel }) {
  const [scene, setScene] = useState(null),
    [name, setName] = useState('Entrada principal'),
    [label, setLabel] = useState(''),
    [plates, setPlates] = useState([]),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
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
      const saved = await post(`/projects/${project.id}/references`, {
        name,
        image: scene.image,
        plates,
      });
      await onSaved(saved);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel reference-editor">
      <div className="section-heading">
        <div>
          <p className="eyebrow">CADASTRAR FOTO</p>
          <h2>Envie a foto e marque suas placas.</h2>
        </div>
        <button className="secondary" onClick={onCancel}>
          Cancelar
        </button>
      </div>
      <p className="muted">
        Use uma imagem do ambiente, nomeie cada placa e arraste para delimitar sua área. Depois de
        salvar, você poderá escolher o vídeo a analisar.
      </p>
      <div className="form-row">
        <label>
          Nome da foto
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
        </label>
        <label>
          Foto do ambiente
          <input type="file" accept="image/png,image/jpeg,image/webp" onChange={upload} />
        </label>
      </div>
      {scene && (
        <>
          <div className="editor-grid">
            <Scene scenario={scene} plates={plates} edit onArea={addArea} />
            <div>
              <label>
                Nome da placa
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
            {busy ? 'Salvando…' : 'Salvar foto e placas'}
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
