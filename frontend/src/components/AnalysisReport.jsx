import React from 'react';
import { number } from '../api.js';
export default function AnalysisReport({
  summary,
  records,
  source,
  onReview,
  onRestart,
  onJson,
  onCsv,
  onPdf,
  busy,
}) {
  const known = summary.annotations > 0;
  const percent = (value) => (value == null ? 'indisponível' : `${number(value * 100, 1)}%`);
  return (
    <section className="analysis-report">
      <div className="section-heading">
        <div>
          <p className="eyebrow">ETAPA 3 · RESULTADO</p>
          <h2>Relatório da análise</h2>
          <p>
            {records.length} quadros analisados · {summary.signs.length} placas cadastradas ·{' '}
            {source.label}
          </p>
        </div>
        <button className="secondary" onClick={onReview}>
          Voltar ao vídeo
        </button>
      </div>
      <div className="notice">
        <strong>
          {known
            ? source.kind === 'demo'
              ? 'Acerto medido em um exemplo sintético.'
              : 'Acerto medido apenas nos quadros conferidos.'
            : 'Precisão ainda não medida.'}
        </strong>
        <p>
          {known
            ? `${summary.annotations} anotações de posição/presença ao longo dos quadros. Precisão ${percent(summary.precision)} entre as detecções anotadas; recall ${percent(summary.recall)} das placas presentes. Precisão alta não significa que todas as placas foram detectadas.`
            : 'O sistema consegue relatar detecções e dificuldades, mas precisa da posição verdadeira para saber se acertou. Volte ao vídeo, pause e confira um quadro. Similaridade não substitui essa conferência.'}
        </p>
      </div>
      <article className="panel detector-final">
        <h2>Análise final: dificuldade e melhorias</h2>
        <p>
          O relatório reúne todos os quadros analisados. “Não localizada” pode significar que a
          placa saiu da imagem ou que o detector falhou; sem uma referência verdadeira, não é
          possível distinguir os dois casos.
        </p>
        {summary.signs.map((s, index) => (
          <details className="report-plate" key={s.name} open={index === 0}>
            <summary>
              <strong>{s.name}</strong>
              <span>
                {number(s.detectedSeconds, 2)} s detectados ·{' '}
                {number((s.detectedFrames / records.length) * 100)}% dos quadros
              </span>
            </summary>
            <dl className="report-facts">
              <div>
                <dt>Tempo detectado estimado</dt>
                <dd>{number(s.detectedSeconds, 2)} s</dd>
              </div>
              <div>
                <dt>Detecções nos quadros</dt>
                <dd>
                  {s.detectedFrames}/{records.length} (
                  {number((s.detectedFrames / records.length) * 100)}%)
                </dd>
              </div>
              <div>
                <dt>Quadros incertos</dt>
                <dd>{s.uncertainFrames}</dd>
              </div>
              <div>
                <dt>Não localizada</dt>
                <dd>{records.length - s.detectedFrames - s.uncertainFrames}</dd>
              </div>
              <div>
                <dt>Precisão por placa</dt>
                <dd>
                  {s.precision == null ? 'Sem detecções positivas anotadas' : percent(s.precision)}
                </dd>
              </div>
              <div>
                <dt>Recall por placa</dt>
                <dd>
                  {s.recall == null
                    ? 'Sem placas presentes anotadas para calcular'
                    : percent(s.recall)}
                </dd>
              </div>
            </dl>
            <h4>Quão difícil foi detectar?</h4>
            <p>
              Houve {s.events} trecho(s) de detecção.{' '}
              {s.detectedFrames === records.length
                ? 'A placa foi detectada em todos os quadros analisados.'
                : 'A localização não permaneceu disponível em todos os quadros.'}{' '}
              A proporção de detecções descreve o comportamento do sistema; não mede dificuldade de
              leitura humana.
            </p>
            <h4>O que pode explicar a dúvida?</h4>
            {Object.keys(s.reasons).length ? (
              <ul>
                {Object.entries(s.reasons)
                  .sort((a, b) => b[1] - a[1])
                  .map(([text, count]) => (
                    <li key={text}>
                      {text} — {count}/{records.length} quadros.
                    </li>
                  ))}
              </ul>
            ) : (
              <p>Nenhum indício heurístico foi registrado. Isso não comprova ausência de erros.</p>
            )}
            <h4>Sugestões de posição e captura para testar</h4>
            <ul>
              {Object.keys(s.suggestions).map((text) => (
                <li key={text}>{text}</li>
              ))}
              <li>
                Testar uma posição frontal ao trajeto da câmera, antes do ponto de decisão, sem
                obstruções e com tamanho aparente suficiente. Comparar antes/depois com o mesmo
                trajeto, distância e iluminação.
              </li>
            </ul>
            <details>
              <summary>Números técnicos desta placa</summary>
              <p>
                Similaridade média {number(s.meanScore, 3)}; margem para outra posição{' '}
                {number(s.meanGap, 3)}. TP {s.tp}, FP {s.fp}, FN {s.fn}; {s.annotations} anotações.
                Correlação não é probabilidade de acerto.
              </p>
            </details>
          </details>
        ))}
        <p className="small">
          Tempo é estimado entre detecções consecutivas com intervalo de até 1,5 s. Falhas e
          ambiguidades interrompem a contagem. Os indícios não comprovam uma causa única, e as
          sugestões não determinam um local ideal de instalação. É preciso testar em nova captura.
        </p>
      </article>
      <article className="panel">
        <h2>Guardar o resultado</h2>
        <div className="button-row">
          <button className="primary" onClick={onPdf} disabled={busy}>
            Baixar relatório PDF
          </button>
          <button className="secondary" onClick={onJson}>
            Baixar diagnóstico JSON
          </button>
          <button className="secondary" onClick={onCsv}>
            Baixar CSV
          </button>
        </div>
        <p className="small">
          A análise fica em memória e será apagada ao trocar de vídeo ou fechar a página. O PDF
          inclui dificuldade, acerto, indícios e sugestões por placa.
        </p>
        <button className="text-button" onClick={onRestart}>
          Começar outra análise (limpa o resultado atual)
        </button>
      </article>
    </section>
  );
}
