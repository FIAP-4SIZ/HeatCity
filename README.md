# HeatCity — placas em vídeo

**Onde a placa cadastrada aparece e por quanto tempo é detectada?**

O HeatCity localiza referências de placas nos quadros de um vídeo ou webcam e
consolida posições, tempo estimado, dificuldade e acerto mensurado.
Usa OpenCV e template matching multiescala, sem treinamento de modelos.

## Executar

No Windows, execute **Iniciar-HeatCity.cmd**. O launcher verifica/instala Python
3.12 e Node.js, prepara dependências e abre o navegador padrão. Chrome e Edge
permitem webcam em localhost; áudio não é solicitado. Encerre pelo terminal.

Em Linux/macOS, com Python 3.12 e Node.js ≥ 22.12:

```sh
python3.12 -m venv .venv
.venv/bin/python -m pip install -r backend/requirements.lock
npm --prefix frontend ci
# Terminal 1
PYTHONPATH=backend .venv/bin/python -m uvicorn heatcity.api:app --host 127.0.0.1 --port 8000
# Terminal 2
npm --prefix frontend run dev -- --port 5173 --strictPort
```

Abra http://127.0.0.1:5173. Não há serviço externo obrigatório nem modelo a baixar.

## Fluxo da aplicação

1. **Referências de placas:** crie um projeto, envie uma imagem nítida do ambiente
   e marque recortes com nomes únicos. PNG/JPEG/WebP até 4 MB, 8 MP e mínimo de
   200 px por lado. Referências salvas são imutáveis; outra captura é outra referência.
2. **Análise de vídeo:** selecione a referência e abra MP4/H.264, WebM ou webcam.
   As caixas indicam candidatos detectados, ambíguos, em conflito ou não localizados.
3. **Acompanhamento:** consulte primeira detecção, trechos, tempo detectado,
   quadros válidos/incertos e centros acumulados das placas.
4. **Conferência:** pause e marque a posição verdadeira ou a ausência de cada
   placa. Apenas placas anotadas entram no cálculo; a marcação não treina o detector.
5. **Análise final:** veja dificuldade por placa, indícios de falha, acerto e
   hipóteses de melhoria de posição. Exporte JSON, CSV e PDF antes de trocar de fonte.
6. **PDI visual:** explore recortes, cinza, histograma, contraste e Laplaciano.

O hospital A/B com as **imagens originais fornecidas pelo usuário** já integra o
catálogo após qualquer checkout. Não há um botão especial para criar exemplos.
O vídeo demonstrativo de 12 s é sintético e usa a referência A conferida por hash.
Somente nesse exemplo a anotação geométrica conhecida é aplicada automaticamente.
Vídeos próprios exigem marcação manual para medir acerto.

## Métricas e limites

- **Tempo detectado:** soma de intervalos entre detecções consecutivas da mesma
  placa, na mesma fonte, com `0 < Δt ≤ 1,5 s`. Falhas, ambiguidades e intervalos
  maiores interrompem o trecho. Uma amostra isolada soma zero; não se comprova
  presença contínua entre os quadros amostrados.
- **Acerto:** identidade correta e IoU ≥ 0,5. Precisão = TP/(TP+FP);
  recall = TP/(TP+FN). Sem referências conhecidas, ficam indisponíveis.
  Erro de localização gera FP e FN; abstenção com placa presente gera FN.
- **Dificuldade:** proporção de detecções e incertezas, margens de correlação,
  perda de nitidez/contraste, tamanho aparente e proximidade da borda. Baixo score
  não identifica uma causa única. Correlação não é probabilidade de acerto.
- **Posição:** sugestões são hipóteses a comparar em nova captura com mesmo
  percurso, câmera, distância e iluminação; não determinam altura ideal de instalação
  nem comprovam legibilidade, orientação ou acessibilidade humana.

A captura solicita até 1920 × 1080 / 30 FPS, negociados com o navegador. A análise
usa largura até 800 px e até 2 amostras/s, sem fila. Perspectiva, mudanças de escala,
oclusão e placas semelhantes limitam o template matching.

## Dados locais e atualização

O SQLite em `data/heatcity.sqlite3` guarda somente projetos, imagens de referência e
recortes. Quadros de vídeo são enviados à API local e não são persistidos.
Resultados ficam em memória até 300 quadros; trocar de fonte ou recarregar limpa
o histórico. Exportações não contêm imagens de vídeo. Uso local, sem autenticação.

Na atualização do banco v1 para v2, os cadastros de imagens e recortes são preservados;
as tabelas e registros de sessões do domínio retirado são removidos em transação.
Nenhuma captura pessoal é necessária para usar o projeto.

## Evidência e apresentação

[Slides HTML](docs/apresentacao/slides.html) · [Slides PDF](docs/apresentacao/slides.pdf) ·
[Roteiro](docs/apresentacao/ROTEIRO.md) · [Pacote offline](docs/HeatCity-pacote-apresentacao.zip) ·
[Relatório detalhado](docs/reports/HeatCity-deteccao-placas-exemplo.pdf) ·
[Medições por quadro](docs/reports/deteccao-placas-benchmark.json).

O experimento sintético possui 24 quadros analisados e 96 referências conhecidas:
66 TP, 0 FP, 24 FN e 6 TN; precisão 1,000 e recall 0,733. As falhas sob desfoque
permanecem no resultado. Quadros correlacionados da mesma foto não estimam
performance em vídeo real. Ainda faltam captura real anotada e comparação
controlada de posicionamentos.

Reprodução, a partir da raiz:

```sh
PYTHONPATH=backend .venv/bin/python scripts/build_sign_video_demo.py
.venv/bin/python scripts/build_sign_presentation.py
```

O primeiro script requer ffmpeg **somente para regenerar** o MP4 já incluído.
No PowerShell: `$env:PYTHONPATH="backend"`; use `.venv\Scripts\python.exe`.
As versões do runtime e o SHA-256 do vídeo constam no JSON do benchmark.

## Verificar

```sh
.venv/bin/python -m pip install -r backend/requirements-dev.txt
.venv/bin/ruff check backend scripts
.venv/bin/ruff format --check backend scripts
PYTHONPATH=backend .venv/bin/python -m unittest discover -s backend/tests -v
npm --prefix frontend test
npm --prefix frontend run format:check
npm --prefix frontend run build
# Com API e frontend ativos, Chromium instalado:
CHROMIUM_PATH=/usr/bin/chromium npm --prefix frontend run test:e2e
```

Os testes usam imagens e vídeo sintéticos e webcam simulada; não comprovam
acurácia em captura real. Documentação: [método e requisitos](docs/requisitos-mvp.md),
[fontes](docs/referencias.md) e [fluxo de branches](docs/fluxo-desenvolvimento.md).
A integração é na `develop`; `main` permanece reservada à entrega final autorizada.
