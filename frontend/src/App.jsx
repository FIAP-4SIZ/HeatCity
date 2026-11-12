import React, { useEffect, useState } from 'react';
import { api } from './api.js';
import SignDetection from './views/SignDetection.jsx';
import ReferenceLibrary from './views/ReferenceLibrary.jsx';
import PdiView from './views/PdiView.jsx';

function useRoute() {
  const read = () => location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  const [path, setPath] = useState(read);
  useEffect(() => {
    const update = () => setPath(read());
    addEventListener('hashchange', update);
    return () => removeEventListener('hashchange', update);
  }, []);
  return path;
}
function Method() {
  return (
    <section>
      <div className="page-title">
        <p className="eyebrow">MÉTODO E LIMITES</p>
        <h1>Da imagem à evidência.</h1>
        <p>Como o HeatCity localiza referências de placas e interpreta as dificuldades.</p>
      </div>
      <div className="method-grid">
        {[
          [
            '01',
            'Cadastre uma referência',
            'Envie uma imagem nítida do ambiente e marque o recorte de cada placa. Use nomes únicos. As referências salvas são imutáveis para permitir comparações reproduzíveis.',
          ],
          [
            '02',
            'Localize nos quadros',
            'O OpenCV converte para cinza e procura os recortes por correlação normalizada em sete escalas. Similaridade mínima 0,72 e margem espacial 0,06; conflitos de identidade usam margem 0,08. São critérios fixos e heurísticos, sem treinamento.',
          ],
          [
            '03',
            'Acompanhe sem preencher falhas',
            'A análise amostra até dois quadros por segundo. Soma intervalos entre detecções consecutivas na mesma fonte, até 1,5 s. Incerteza e falhas interrompem o trecho. Uma amostra isolada soma zero; não se comprova presença contínua.',
          ],
          [
            '04',
            'Meça o acerto',
            'Anote as posições verdadeiras ou a ausência da placa. Acerto exige nome correto e IoU ≥ 0,5. Precisão = TP/(TP+FP); recall = TP/(TP+FN). Sem anotações, não há medida de acerto. Correlação não é probabilidade.',
          ],
          [
            '05',
            'Investigue a dificuldade',
            'Margens pequenas e conflitos revelam correspondências parecidas. Contraste, Laplaciano e tamanho aparente indicam condições da região candidata. Baixo score não identifica uma causa única.',
          ],
          [
            '06',
            'Teste uma mudança de posição',
            'Compare uma posição mais frontal, visível antes do ponto de decisão, com maior tamanho aparente e sem obstruções. Mantenha o mesmo trajeto, distância, câmera e iluminação. As sugestões são hipóteses; não certificam orientação ou acessibilidade.',
          ],
        ].map(([step, title, body]) => (
          <article className="panel" key={step}>
            <span className="step-number">{step}</span>
            <h2>{title}</h2>
            <p>{body}</p>
          </article>
        ))}
      </div>
      <article className="panel">
        <h2>Dados e privacidade</h2>
        <p>
          Imagens de referência e seus recortes ficam no banco local. Quadros do vídeo são enviados
          à API local para análise e não são persistidos. O histórico temporário contém até 300
          resultados; exporte antes de trocar de fonte ou fechar a página. A webcam exige permissão;
          áudio não é solicitado. Use somente vídeos que possa analisar. Esta edição local não
          possui autenticação.
        </p>
      </article>
      <article className="panel">
        <h2>Fontes identificadas</h2>
        <ul>
          <li>
            <a href="https://docs.opencv.org/4.x/d4/dc6/tutorial_py_template_matching.html">
              OpenCV — Template Matching
            </a>
          </li>
          <li>
            <a href="https://docs.opencv.org/4.x/d5/db5/tutorial_laplace_operator.html">
              OpenCV — Laplacian Operator
            </a>
          </li>
          <li>
            <a href="https://arnaldojr.github.io/cognitivecomputing/aulas/PDI/lab12/Template_matching.html">
              Laboratório de aula — Template matching
            </a>
          </li>
          <li>
            <a href="https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia">
              MDN — getUserMedia
            </a>
          </li>
        </ul>
        <p>
          Enunciado: Cognitive Computing-GS2-2026.pdf, fornecido pela disciplina. A demonstração
          hospitalar é sintética, derivada das imagens de IA fornecidas pelo usuário. O benchmark
          versionado mede o detector no MP4 decodificado e não estima desempenho em vídeos reais.
        </p>
      </article>
    </section>
  );
}
function PdiWorkspace() {
  const [projects, setProjects] = useState([]),
    [selected, setSelected] = useState(''),
    [project, setProject] = useState(null),
    [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    api('/projects')
      .then((values) => {
        if (active) {
          setProjects(values);
          setSelected(values[0]?.id || '');
        }
      })
      .catch((e) => active && setError(e.message));
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    let active = true;
    setProject(null);
    if (selected)
      api(`/projects/${selected}`)
        .then((p) => active && setProject(p))
        .catch((e) => active && setError(e.message));
    return () => {
      active = false;
    };
  }, [selected]);
  return (
    <section>
      <div className="page-title">
        <p className="eyebrow">PROCESSAMENTO DIGITAL DE IMAGENS</p>
        <h1>Veja o que compõe a placa.</h1>
        <p>Recortes, tons de cinza, histograma e nitidez calculados sobre suas referências.</p>
      </div>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <label className="workspace-select">
        Projeto
        <select value={selected} onChange={(e) => setSelected(e.target.value)}>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}
            </option>
          ))}
        </select>
      </label>
      {project ? (
        <PdiView key={project.id} project={project} />
      ) : (
        !selected && (
          <div className="empty panel">
            <h2>Seu catálogo ainda está vazio.</h2>
            <a className="text-link" href="#/references">
              Cadastrar referências →
            </a>
          </div>
        )
      )}
    </section>
  );
}
export default function App() {
  const path = useRoute();
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem('heatcity-theme') === 'dark' ? 'dark' : 'light';
    } catch {
      return 'light';
    }
  });
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem('heatcity-theme', theme);
    } catch {}
  }, [theme]);
  const section = ['references', 'pdi', 'method'].includes(path[0]) ? path[0] : 'analysis';
  const items = [
    ['analysis', 'Análise de vídeo', '▷'],
    ['references', 'Referências de placas', '▣'],
    ['pdi', 'PDI visual', '◫'],
    ['method', 'Método e limites', '↗'],
  ];
  return (
    <div className="app-shell">
      <header className="app-header">
        <a className="app-brand" href="#/analysis" aria-label="HeatCity início">
          <span className="brand-symbol">H</span>
          <span>
            HeatCity<small>PLACAS EM VÍDEO</small>
          </span>
        </a>
        <nav aria-label="Navegação principal">
          {items.map(([value, label, index]) => (
            <a
              key={value}
              className={section === value ? 'active' : ''}
              aria-current={section === value ? 'page' : undefined}
              href={`#/${value}`}
            >
              <span>{index}</span>
              {label}
            </a>
          ))}
        </nav>
        <button
          className="theme-switch secondary"
          onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
        >
          {theme === 'light' ? '◐ Tema escuro' : '☀ Tema claro'}
        </button>
      </header>
      <div className="workspace-bar">
        <span>
          <i className="local-dot" /> Ambiente local
        </span>
        <span>OpenCV · Referências conhecidas · Sem treinamento</span>
      </div>
      <main className="app-main">
        {section === 'analysis' ? (
          <SignDetection key={path[1] || 'analysis'} referenceId={path[1]} />
        ) : section === 'references' ? (
          <ReferenceLibrary projectId={path[1]} />
        ) : section === 'pdi' ? (
          <PdiWorkspace />
        ) : (
          <Method />
        )}
      </main>
      <footer className="app-footer">
        <span>HeatCity · Localização e acompanhamento de placas em vídeo.</span>
        <span>Global Solution · FIAP · MVP acadêmico</span>
      </footer>
    </div>
  );
}
