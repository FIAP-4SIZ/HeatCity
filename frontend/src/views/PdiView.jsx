import React, { useEffect, useState } from 'react';
import { api, number } from '../api.js';
import Scene from '../components/Scene.jsx';

export default function PdiView({ project }) {
  const [scenarioId, setScenarioId] = useState(project.references[0]?.id || '');
  const [data, setData] = useState(null),
    [error, setError] = useState('');
  const [selected, setSelected] = useState(0),
    [gray, setGray] = useState(false);
  const scenario = project.references.find((s) => s.id === scenarioId);
  useEffect(() => {
    let active = true;
    setData(null);
    setError('');
    setSelected(0);
    if (scenarioId)
      api(`/references/${scenarioId}/pdi`)
        .then((value) => {
          if (active) setData(value);
        })
        .catch((e) => {
          if (active) setError(e.message);
        });
    return () => {
      active = false;
    };
  }, [scenarioId]);
  if (!scenario)
    return (
      <div className="empty panel">
        <h2>Adicione uma referência para explorar o PDI.</h2>
        <p>Em Referências, envie uma imagem e delimite os recortes das placas.</p>
      </div>
    );
  const region = data?.regions[selected];
  const bins = region
    ? Array.from({ length: 32 }, (_, i) =>
        region.histogram.slice(i * 8, i * 8 + 8).reduce((a, b) => a + b, 0),
      )
    : [];
  const peak = Math.max(1, ...bins);
  return (
    <section className="pdi-view">
      <div className="section-heading">
        <div>
          <p className="eyebrow">PDI · DO PIXEL AO INDICADOR</p>
          <h2>O que existe dentro de cada placa?</h2>
          <p>Explore descritores calculados sobre a imagem, diretamente na imagem cadastrada.</p>
        </div>
      </div>
      <label>
        Imagem de referência
        <select value={scenarioId} onChange={(e) => setScenarioId(e.target.value)}>
          {project.references.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </label>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {!data && !error && <p role="status">Processando imagem com OpenCV…</p>}
      {data && (
        <>
          <article className="panel">
            <div className="section-heading">
              <div>
                <p className="eyebrow">01 · CENA E RECORTE</p>
                <h3>{scenario.name}</h3>
              </div>
              <label className="checkbox">
                <input type="checkbox" checked={gray} onChange={(e) => setGray(e.target.checked)} />
                Ver cena em cinza
              </label>
            </div>
            <Scene scenario={{ ...scenario, image: gray ? data.gray_scene : scenario.image }} />
            <p className="small">
              As caixas são AOIs definidas pelo operador, não placas reconhecidas automaticamente.
              Coordenadas normalizadas mantêm a referência ao redimensionar a imagem.
            </p>
            <div className="button-row" role="group" aria-label="Selecionar placa">
              {data.regions.map((r, i) => (
                <button
                  key={r.name}
                  className={selected === i ? 'primary' : 'secondary'}
                  aria-pressed={selected === i}
                  onClick={() => setSelected(i)}
                >
                  {r.name}
                </button>
              ))}
            </div>
          </article>
          {region && (
            <>
              <article className="panel">
                <p className="eyebrow">02 · TRANSFORMAÇÕES DA AOI</p>
                <h3>
                  {region.name} · {number(region.pixel_count, 0)} pixels analisados
                </h3>
                <div className="pdi-images">
                  {[
                    ['original', 'Recorte original'],
                    ['gray', 'Conversão em cinza'],
                    ['laplacian', 'Variações pelo Laplaciano'],
                  ].map(([key, title]) => (
                    <figure key={key}>
                      <img src={region[key]} alt={`${title}: ${region.name}`} />
                      <figcaption>{title}</figcaption>
                    </figure>
                  ))}
                </div>
                <p>
                  A conversão usa aproximadamente 0,299R + 0,587G + 0,114B. É intensidade de cinza
                  de 0 a 255, sem linearização fotométrica.
                </p>
                <p className="small">
                  O Laplaciano destaca variações locais. Para exibi-lo, usamos seu valor absoluto e
                  ajustamos o máximo de cada recorte para 255. O brilho desta prévia não permite
                  comparar nitidez entre placas; o indicador usa a variância do Laplaciano original.
                </p>
              </article>
              <article className="panel">
                <p className="eyebrow">03 · DISTRIBUIÇÃO DE INTENSIDADES</p>
                <h3>Histograma · {region.name}</h3>
                <svg
                  className="pdi-histogram"
                  viewBox="0 0 640 190"
                  role="img"
                  aria-label={`Histograma de intensidades de ${region.name}; 32 grupos de oito níveis`}
                >
                  <title>
                    Contagem de pixels em 32 grupos de oito níveis; altura relativa ao maior grupo
                  </title>
                  {bins.map((n, i) => (
                    <rect
                      key={i}
                      x={30 + i * 18}
                      y={150 - (120 * n) / peak}
                      width="16"
                      height={(120 * n) / peak}
                      fill="currentColor"
                    >
                      <title>
                        {i * 8}–{i * 8 + 7}: {n} pixels
                      </title>
                    </rect>
                  ))}
                  <line x1="30" y1="150" x2="606" y2="150" stroke="currentColor" />
                  <text x="30" y="175" fill="currentColor">
                    0 · escuro
                  </text>
                  <text x="510" y="175" fill="currentColor">
                    255 · claro
                  </text>
                </svg>
                <p>
                  P1 = <strong>{number(region.p1, 2)}</strong> · P99 ={' '}
                  <strong>{number(region.p99, 2)}</strong>. São os percentis calculados nos pixels
                  da AOI. O gráfico agrupa oito níveis por barra; a altura é relativa ao maior grupo
                  desta placa.
                </p>
              </article>
              <article className="panel">
                <p className="eyebrow">04 · MÉTRICAS E INTERPRETAÇÃO</p>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Métrica</th>
                        <th>Valor</th>
                        <th>Cálculo e limite</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <th>Área relativa</th>
                        <td>{number(region.area_percent, 2)}%</td>
                        <td>
                          100 × largura × altura normalizadas da AOI. Descreve seu tamanho na cena.
                        </td>
                      </tr>
                      <tr>
                        <th>Intensidade média</th>
                        <td>{number(region.luminance)} / 255</td>
                        <td>
                          Média dos pixels em cinza. Campo luminance da API; não é luminância física
                          nem legibilidade.
                        </td>
                      </tr>
                      <tr>
                        <th>Contraste local</th>
                        <td>{number(region.local_contrast, 3)}</td>
                        <td>
                          (P99 − P1) / (P99 + P1 + 10⁻⁶). Descreve a dispersão entre intensidades;
                          não é a razão de contraste WCAG entre texto e fundo.
                        </td>
                      </tr>
                      <tr>
                        <th>Variação pelo Laplaciano</th>
                        <td>{number(region.sharpness, 1)}</td>
                        <td>
                          Variância de ∇² da AOI em cinza. Também cresce com ruído, textura e
                          resolução; não há um limite universal de nitidez.
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </article>
            </>
          )}
          <div className="notice">
            <strong>Descritores de imagem, sem inferência de atenção.</strong>
            <p>
              Estes valores não demonstram que a placa foi vista, lida ou compreendida e não
              certificam acessibilidade. A cena didática é sintética; o mesmo processamento funciona
              com imagens enviadas pelo operador.
            </p>
          </div>
        </>
      )}
    </section>
  );
}
