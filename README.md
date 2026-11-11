# HeatCity

MVP acadêmico para investigar atenção visual à sinalização por webcam, com estudos,
cenários e áreas de interesse, sessões oculares, métricas, heatmaps e relatórios.
A precisão humana ainda é experimental; uma aprovação numérica não comprova usabilidade.

## Executar no Windows

Execute **Iniciar-HeatCity.cmd** na pasta do projeto. O launcher verifica Python,
Node e npm, prepara as dependências e abre o navegador padrão. O modelo pronto
MediaPipe está incluído no projeto e é copiado localmente, sem download adicional.
Chrome e Edge permitem câmera em localhost. Finalize pelo terminal do launcher.

## Calibração atual

O MediaPipe detecta as íris. O projeto **não cria um modelo de aprendizado**:
não usa classificação supervisionada, regressão supervisionada, seleção/validação
cruzada de modelos nem aprendizado não supervisionado. A exceção autorizada é o
uso do detector MediaPipe previamente treinado por seus autores.

Um alvo móvel percorre linhas, bordas, cantos, diagonais e centro em tela cheia
branca, com contagem inicial de três segundos. Os deslocamentos levam pelo menos
um segundo. O sistema registra cada referência e avança automaticamente quando
há amostras recentes e estabilidade dos olhos e da cabeça. Não exige botão,
Espaço ou Enter. Se a detecção ou a estabilidade piorar, o alvo espera e retoma
sozinho quando a coleta melhora. Amostras válidas próximas da próxima referência
são aproveitadas durante o movimento para reduzir a pausa. A malha é conferida
a cada linha; regiões inconsistentes são recolhidas localmente, com tentativas
limitadas, e uma falha preserva os dados parciais no diagnóstico. Vinte e cinco correspondências medidas dos olhos
formam uma malha; coordenadas intermediárias são interpoladas geometricamente.
Treze alvos adicionais conferem centro, bordas e cantos sem alterar a malha. Cada
região deve atender ao limite, além da média geral. Não há regressão,
ajuste de pesos ou extrapolação fora da região de referência.

O perfil de abertura é individual por olho, sem inferir etnia. Pisque naturalmente.
Mantenha a cabeça confortável e estável; não há compensação aprendida de postura.
Malhas inconsistentes e cobertura insuficiente são reprovadas. O limite de erro
0,100 é experimental e permanece inalterado.

[Detalhes, diagnóstico recebido e limitações](docs/calibracao-varredura-geometrica.md).

## Participantes e diagnóstico

Somente o código do participante é obrigatório como identificação, por exemplo
P01, sem solicitar nome, e-mail, documento ou telefone. A sessão exige consentimento,
cenário e calibração aprovada vinculada àquele código e área de tela.

**Diagnósticos / DEV** funciona sem cadastro. O botão **Baixar diagnóstico completo
da página** inclui até cinco calibrações, configurações, eventos e os últimos
5.000 registros de câmera/tracking experimental, até dez por segundo. Baixe depois
de sair da prévia com ESC. Recarregar a página apaga o histórico temporário.
Vídeos e imagens faciais não são enviados nem persistidos. Sem referência de onde
a pessoa olhou, o tracking livre não permite calcular precisão real.

## Margem no estudo e webcam

A margem por eixo é convertida da tela para o tamanho da imagem exibida. Casos de
borda permanecem ambíguos; uma observação conclusiva exige sequência de pelo menos
0,2 s. Permanência só na faixa de incerteza torna a sessão inconclusiva. A calibração
reprovada continua bloqueada para o estudo. A política e margens ficam no JSON/PDF.

A webcam recebe pedido inicial de 4K/120 FPS e depois as maiores capacidades que
informar, com negociação e fallback. O diagnóstico mostra resolução/FPS solicitados,
negociados e FPS efetivamente processado, sem contar novamente o mesmo quadro.
A sessão mantém a câmera e a resolução da calibração. Valores máximos solicitados
não garantem que o hardware ou o processamento alcancem essa taxa.

[Detalhes e análise do diagnóstico recebido](docs/margem-estudo-e-webcam.md).

## API e desenvolvimento

Python 3.12, Node >=22.12, FastAPI, React e Vite. Dependências congeladas em
backend/requirements.lock e frontend/package-lock.json. Instale as dependências
de desenvolvimento de backend/requirements-dev.txt para os checks Python.

```bash
python -m venv .venv
.venv/bin/pip install -r backend/requirements.lock -r backend/requirements-dev.txt
npm --prefix frontend ci
PYTHONPATH=backend .venv/bin/python -m uvicorn heatcity.api:app --host 127.0.0.1 --port 8000
```

Em outro terminal: `npm --prefix frontend run dev`. API em localhost:8000 e página
em localhost:5173. HEATCITY_DATA_DIR configura o diretório SQLite (padrão data/).
HEATCITY_API_URL configura o destino do proxy Vite.

## Conferências de software

```bash
.venv/bin/ruff check backend scripts/generate_report.py scripts/recompute_metrics.py scripts/validate_diagnostics.py
PYTHONPATH=backend .venv/bin/python -m unittest discover -s backend/tests -v
npm --prefix frontend test
npm --prefix frontend run format:check
npm --prefix frontend run build
```

Os scripts frontend/scripts/tasks-smoke.mjs, mvp-smoke.mjs e diagnostics-smoke.mjs
usam Playwright com os serviços locais ativos. Os testes de fluxo usam landmarks
sintéticos; o teste Tasks inicializa o detector real e verifica um quadro sem rosto.
Nenhum desses testes comprova precisão ocular humana. HEATCITY_TEST_APPROVED=1
exercita exportação após conferência geométrica aprovada.

O relatório provisório é gerado por scripts/generate_report.py; dados reais só
entram mediante um estudo persistido. scripts/recompute_metrics.py recalcula métricas
exportadas. scripts/validate_diagnostics.py confere arquivos geométricos mode=sweep.

As notas de investigação e relatórios de versões anteriores em docs/ são históricos;
o método corrente é o descrito em calibracao-varredura-geometrica.md.
