# HeatCity — localização e acompanhamento de placas em vídeo

**Onde a placa cadastrada aparece e por quanto tempo é detectada?**

MVP de visão computacional clássica: vídeo/webcam → cinza → template matching
multiescala → localização, incerteza e acompanhamento temporal por placa.
Sem treino de modelos, sem participante e sem calibração ocular no novo fluxo.

## Novo fluxo principal

1. Execute `Iniciar-HeatCity.cmd`. A página inicial abre **Placas em vídeo**.
2. Selecione a referência **Cenário simulado A · IA** do hospital já cadastrado.
3. Abra o vídeo demonstrativo incluído no checkout e clique em **Iniciar análise**.
   Para vídeo próprio, cadastre antes uma imagem de referência e seus recortes em
   **Estudos → Cenários e placas**. Também há entrada pela webcam.
4. Veja caixas, estados incertos, centros detectados e tempo estimado por placa.
5. Pause para anotar a posição verdadeira de placas ou sua ausência. A anotação
   mede acerto; não treina nem altera o detector.
6. Confira a **Análise final: dificuldade e melhorias** e exporte JSON, CSV e PDF.

A análise envia quadros para a API local sem persistir imagens. Solicita até
1920 × 1080 / 30 FPS na câmera, mas processa quadros reduzidos a 800 px de largura
em até 2 amostras/s, sem fila. Vídeos devem ser compatíveis com Chrome/Edge,
por exemplo MP4/H.264 ou WebM. Uso local, sem autenticação.

Tempo detectado é a soma de intervalos entre quadros consecutivos detectados,
na mesma fonte, com intervalo máximo de 1,5 s. Falhas e ambiguidades interrompem
o trecho; quadro isolado soma zero. Não comprova continuidade entre amostras.
Precisão/recall/IoU exigem referências conhecidas; similaridade não é chance de acerto.
Sugestões de posição são hipóteses para nova captura, sem medir atenção humana.

O exemplo é sintético, derivado da imagem de IA original do usuário: nitidez,
deslocamento, desfoque e desaparecimento da Recepção. As medições do MP4 decodificado,
as falhas, os gráficos e o relatório estão em [docs/reports](docs/reports/deteccao-placas-benchmark.json).
Reproduzir: `PYTHONPATH=backend .venv/bin/python scripts/build_sign_video_demo.py`
(requer ffmpeg só para regenerar o MP4) e
`.venv/bin/python scripts/build_sign_presentation.py`.
No PowerShell, defina `$env:PYTHONPATH="backend"` e use `.venv\Scripts\python.exe`.

## Apresentação atual

[Slides HTML](docs/apresentacao/slides.html), [PDF](docs/apresentacao/slides.pdf),
[roteiro e limites](docs/apresentacao/ROTEIRO.md),
[relatório do exemplo](docs/reports/HeatCity-deteccao-placas-exemplo.pdf) e
[pacote offline](docs/HeatCity-pacote-apresentacao.zip) descrevem o novo foco.
O atalho `docs/apresentacao/Abrir-apresentacao.cmd` abre a apresentação atual.
O pacote inclui resultados sintéticos reais calculados, sem participantes fictícios.
Ainda faltam medições em vídeo real e comparação controlada de posições.

## Histórico: experimento ocular anterior

As seções abaixo documentam a investigação anterior e continuam acessíveis em
**Diagnósticos / DEV** e nos estudos. Seus resultados e limitações são separados
do detector de placas. Não são requisitos de uso do novo fluxo.
Slides anteriores foram arquivados como `docs/apresentacao/historico-ocular-*`.

## Executar no Windows

Execute **Iniciar-HeatCity.cmd** na pasta do projeto. O launcher verifica Python,
Node e npm, prepara as dependências e abre o navegador padrão. O modelo pronto
MediaPipe está incluído no projeto e é copiado localmente, sem download adicional.
Chrome e Edge permitem câmera em localhost. Finalize pelo terminal do launcher.

## Apresentação: ensaio exploratório

No estudo, abra **Ensaio exploratório**, informe código e consentimento e importe
um diagnóstico com malha concluída. Uma malha reprovada pode ser usada apenas para
esta demonstração de 15 s, com identificação **não validado**. Os mapas são densidade
de estimativas; não há taxas de sucesso, tempo de localização ou atenção oficial.
As autorizações são separadas no servidor: esse ensaio não libera o estudo oficial.

O pacote offline está em [docs/apresentacao](docs/apresentacao/historico-ocular-ROTEIRO.md):
[slides HTML](docs/apresentacao/historico-ocular-slides.html), [slides PDF](docs/apresentacao/historico-ocular-slides.pdf),
roteiro de fala, demonstração e plano B do experimento anterior. O atalho CMD agora abre a apresentação de placas em vídeo. Não inclui vetores oculares do usuário;
as estatísticas dos diagnósticos são agregadas e identificadas como tentativas.

## Estudo-base hospitalar

O hospital usa a listagem e as telas normais de estudos, sem botão de exemplos.
A base versionada contém somente as duas imagens originais, AOIs e protocolo;
participantes, calibrações e sessões são realizados normalmente.
As duas imagens JPEG originais já estão incluídas no repositório. Ao iniciar o
programa após o pull, o estudo é criado automaticamente, sem duplicar ou substituir
sessões existentes e sem adicionar participantes fictícios.
Veja o [estado e preparo da base compartilhada](docs/estudo-exemplo-hospital.md).

## PDI visual

No estudo, abra **PDI visual**. Selecione o cenário e a placa para explorar a cena
com AOIs, recortes original/cinza/Laplaciano, histograma e fórmulas das métricas.
Funciona sem webcam ou participante, inclusive com imagens enviadas pelo operador.
As AOIs são definidas manualmente; os descritores não inferem atenção ou legibilidade.

Para apresentação offline, use [PDI visual HTML](docs/apresentacao/pdi-visual.html)
ou o [PDF com cena e três placas](docs/reports/HeatCity-PDI-visual.pdf).
A cena didática é sintética, com métricas calculadas pela mesma implementação da API.
Regenerar: `.venv/bin/python scripts/build_pdi_demo.py` (Windows:
`.venv\Scripts\python.exe scripts\build_pdi_demo.py`). Não instala novas dependências.

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
cenário e, no modo oficial, calibração aprovada vinculada àquele código e área de tela.

**Diagnósticos / DEV** funciona sem cadastro. O botão **Baixar diagnóstico completo
da página** inclui até cinco calibrações, configurações, eventos e os últimos
5.000 registros de câmera/tracking experimental, até dez por segundo. Baixe depois
de sair da prévia com ESC. Recarregar a página apaga o histórico temporário.
Vídeos e imagens faciais não são enviados nem persistidos. Sem referência de onde
a pessoa olhou, o tracking livre não permite calcular precisão real.

## Demonstração por placas e mapa exploratório

Em **Diagnósticos / DEV → Prática por placa**, selecione um cenário já cadastrado.
A prévia exibe AOIs, placa pontualmente estimada e ambiguidade da margem. Após a
prática, gere um mapa apenas das estimativas oculares. Erro bruto, ponto verde,
oscilação e checagens centrais são registrados separadamente; não há treino ou
correção pelo mouse. [Roteiro de 90 segundos](docs/roteiro-curto-mapa-placas.md).

## Prática na seção DEV e regra dos cantos

Em **Diagnósticos / DEV**, a prévia pode ser aberta antes da calibração (somente
landmarks e sinais), ou após importar uma malha concluída, inclusive reprovada.
A opção de referência pelo mouse registra posições autodeclaradas separadamente
da estimativa ocular; não ajusta modelos nem gera observações oficiais.
[Passo a passo para a máquina da apresentação](docs/pratica-dev-e-maquina-apresentacao.md).

Novas calibrações usam geometria corrigida pela proporção da câmera e confirmação
com pelo menos oito quadros parados. Os quatro cantos externos não têm limite
individual de RMSE; continuam no erro global e na margem. RMSE global, demais alvos
e cobertura continuam exigidos. Malhas antigas mantêm seu cálculo original.

## Análise do sinal ocular e histórico oficial

A calibração mostra dispersão por alvo, mudança ao longo da coleta e separação
entre alvos, nos dois olhos e na média. O diagnóstico também aceita tentativas
interrompidas sem RMSE. As medidas são descritivas; não treinam modelos nem mudam
aprovação. Veja [método e reprodução](docs/variacao-sinal-ocular.md).

Após reprovar no teste oficial, use **Baixar todas as calibrações deste teste (N)**.
O histórico preserva todas as tentativas da preparação atual e continua disponível
ao voltar. Baixe antes de sair da etapa ou recarregar a página.

## Margem no estudo e webcam

A margem por eixo é convertida da tela para o tamanho da imagem exibida. Casos de
borda permanecem ambíguos; uma observação conclusiva exige sequência de pelo menos
0,2 s. Permanência só na faixa de incerteza torna a sessão inconclusiva. A calibração
reprovada continua bloqueada para o estudo oficial. A política e margens ficam no JSON/PDF.

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

## Contexto e referências

O exemplo de orientação em hospital é ilustrativo: não houve coleta em hospital
ou comprovação de melhoria de localização. A proposta relaciona sinalização e
experiência em espaços coletivos à Global Solution indicada pelo usuário.
Veja [fontes, links e limites das atribuições](docs/referencias.md).

## Desenvolvimento e entrega

Use branches curtas a partir de `develop`, com PRs para `develop`.
A `main` está reservada à entrega final em aula, após autorização explícita do usuário.
Veja [as regras do fluxo](docs/fluxo-desenvolvimento.md) e [AGENTS.md](AGENTS.md).

## Conferências de software

```bash
.venv/bin/ruff check backend scripts/generate_report.py scripts/recompute_metrics.py scripts/validate_diagnostics.py scripts/build_presentation.py
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

O [relatório técnico](docs/reports/HeatCity-relatorio-tecnico.pdf) inclui a análise
real de quatro tentativas de calibração, gráficos e limites. As duas tentativas
concluídas foram reprovadas; isso não constitui resultado oficial de localização.
Veja [instruções de reprodução](docs/reports/evidencias/README.md) e o
[notebook executado](notebooks/calibracao-real.ipynb).

```bash
.venv/bin/python scripts/analyze_calibration.py --aggregate docs/reports/evidencias/analise-calibracao.json
.venv/bin/python scripts/generate_report.py --analysis docs/reports/evidencias/analise-calibracao.json
```

Para relatórios de sessões persistidas, use scripts/generate_report.py --study-id ID.
scripts/recompute_metrics.py recalcula métricas exportadas.
scripts/validate_diagnostics.py confere arquivos geométricos mode=sweep.

As notas de investigação e relatórios de versões anteriores em docs/ são históricos;
o método corrente é o descrito em calibracao-varredura-geometrica.md.
