import React, { useState } from 'react';
import { post } from '../api.js';
import Scene from '../components/Scene.jsx';

const names = ['Recepção', 'Pronto Socorro', 'Ambulatório', 'Triagem'];
// Approximate rectangles from the supplied A/B images, normalized to their full frame.
const boxes = [
  [
    [120, 407, 290, 110],
    [421, 409, 273, 108],
    [705, 409, 295, 108],
    [1012, 409, 276, 108],
  ],
  [
    [991, 408, 315, 109],
    [124, 407, 277, 109],
    [413, 408, 297, 109],
    [722, 409, 259, 108],
  ],
];
const initialAreas = (index) =>
  boxes[index].map(([x, y, width, height], i) => ({
    name: names[i],
    x: x / 1371,
    y: y / 1536,
    width: width / 1371,
    height: height / 1536,
  }));

export default function HospitalExample({ onSaved, onCancel }) {
  const [scenes, setScenes] = useState([null, null]);
  const [plates, setPlates] = useState([initialAreas(0), initialAreas(1)]);
  const [selected, setSelected] = useState([0, 0]);
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [confirmed, setConfirmed] = useState(false);
  const replace = (setter, index, value) =>
    setter((current) => current.map((v, i) => (i === index ? value : v)));
  async function upload(event, index) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setError('');
    setConfirmed(false);
    try {
      if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 4000000)
        throw new Error('Use PNG, JPEG ou WebP de até 4 MB.');
      const bitmap = await createImageBitmap(file);
      const width = bitmap.width,
        height = bitmap.height;
      bitmap.close();
      if (width * height > 8000000 || Math.min(width, height) < 200)
        throw new Error('Use ao menos 200 px por lado e no máximo 8 megapixels.');
      const image = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('Falha ao ler arquivo.'));
        reader.readAsDataURL(file);
      });
      replace(setScenes, index, {
        image,
        width,
        height,
        name: `Cenário simulado ${index === 0 ? 'A' : 'B'} · IA`,
      });
      replace(setPlates, index, initialAreas(index));
    } catch (e) {
      setError(e.message);
    }
  }
  async function save() {
    setBusy(true);
    setError('');
    try {
      const result = await post('/study-examples/hospital', {
        scenarios: scenes.map((s, i) => ({ name: s.name, image: s.image, plates: plates[i] })),
      });
      onSaved(result);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel hospital-example">
      <div className="section-heading">
        <h2>Exemplo hospitalar · imagens geradas por IA</h2>
        <button className="text-button" disabled={busy} onClick={onCancel}>
          Cancelar
        </button>
      </div>
      <p>
        <strong>Orientação na entrada de um hospital.</strong> Investigar a localização da placa
        Recepção em dois posicionamentos.
      </p>
      <div className="notice">
        <strong>Comparação ilustrativa com múltiplas diferenças.</strong>
        <p>
          As imagens fornecidas também mudam outras placas, a seta da Recepção e pessoas. Não isolam
          o efeito da posição. Os cabeçalhos A/B também fazem parte da imagem exibida. Nenhuma
          sessão ou resultado de participante será criado.
        </p>
      </div>
      <div className="content-grid">
        {['A', 'B'].map((label, index) => (
          <article key={label}>
            <label>
              Imagem do cenário {label}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                disabled={busy}
                onChange={(e) => upload(e, index)}
              />
            </label>
            {scenes[index] && (
              <>
                <p className="small">
                  {scenes[index].width} × {scenes[index].height} px. AOIs iniciais aproximadas:
                  confira cada caixa. Para ajustar, escolha a placa e desenhe novamente sobre a
                  imagem. Só as caixas mudam; a imagem é preservada.
                </p>
                <label>
                  Placa a ajustar no cenário {label}
                  <select
                    disabled={busy}
                    value={selected[index]}
                    onChange={(e) => replace(setSelected, index, Number(e.target.value))}
                  >
                    {names.map((name, i) => (
                      <option key={name} value={i}>
                        {name}
                      </option>
                    ))}
                  </select>
                </label>
                <Scene
                  scenario={scenes[index]}
                  plates={plates[index]}
                  edit={!busy}
                  onArea={(area) => {
                    replace(
                      setPlates,
                      index,
                      plates[index].map((p, i) => (i === selected[index] ? { ...p, ...area } : p)),
                    );
                    setConfirmed(false);
                  }}
                />
              </>
            )}
          </article>
        ))}
      </div>
      <label className="checkbox">
        <input
          type="checkbox"
          checked={confirmed}
          disabled={busy || scenes.some((s) => !s)}
          onChange={(e) => setConfirmed(e.target.checked)}
        />
        Conferi as imagens A/B e as quatro AOIs em cada uma; reconheço o caráter ilustrativo do
        exemplo.
      </label>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <button
        className="primary"
        disabled={busy || !confirmed || scenes.some((s) => !s)}
        onClick={save}
      >
        {busy ? 'Criando estudo…' : 'Criar estudo com os dois cenários'}
      </button>
      <p className="small">
        Depois de salvo, use PDI visual ou prepare a tarefa “Localize a placa Recepção”. Sessões
        oficiais exigem código, consentimento e calibração aprovada; o ensaio exploratório permanece
        separado.
      </p>
    </section>
  );
}
