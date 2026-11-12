# HeatCity — placas em vídeo

**Entrega e apresentação:** [guia único para o professor](https://github.com/FIAP-4SIZ/HeatCity/blob/develop/docs/ENTREGA-PROFESSOR.md)
— arquivos exigidos, sequência da demonstração, resultados e pendências.

**Onde a placa aparece e por quanto tempo é detectada?**

Contexto opcional CitizenTech: uma câmera e a análise local ajudam responsáveis por espaços
coletivos a revisar placas e levantar melhorias para testar. Beneficiários
propostos: pacientes, acompanhantes e visitantes que precisam localizar serviços.

O estado atual é um **MVP técnico funcional com evidência sintética**. Necessidade
de campo e benefício concreto para cidadãos ainda não estão demonstrados.
Veja a [conferência dos requisitos](https://github.com/FIAP-4SIZ/HeatCity/blob/develop/docs/verificacao-requisitos.md), que diferencia
as exigências do PDF da disciplina do contexto opcional CitizenTech. Os arquivos
solicitados estão presentes; a evidência sintética é uma limitação declarada,
não um requisito adicional de pesquisa de campo.

## Começar no Windows

Execute **Iniciar-HeatCity.cmd**. Ele verifica/instala Python 3.12 e Node.js,
prepara as dependências e abre o navegador padrão. Encerre pelo terminal.

Na página inicial há duas escolhas:

- **Ver exemplo funcionando:** um clique inicia um vídeo sintético de 12 s e
  abre o relatório ao terminar. Foto e quatro recortes já estão incluídos.
- **Começar com meu vídeo:** cadastre uma foto nítida do ambiente, marque as
  placas e selecione o vídeo. A análise começa automaticamente. Para medir
  acerto, pause e confira a posição verdadeira de placas em quadros.

**Minhas fotos** permite cadastrar, usar e excluir fotos. O PDI visual e a
explicação técnica ficam nos links do rodapé. Não é necessário criar projetos
manualmente. Webcam é uma opção dentro do fluxo de vídeo próprio; áudio não é usado.

## O que o relatório informa

- Detecções, incertezas, trechos e tempo detectado estimado por placa.
- Precisão/recall somente quando houver posições/presenças verdadeiras anotadas.
  Sem conferência, aparece **Precisão ainda não medida**.
- Indícios de dificuldade: margens pequenas, confusão entre placas, desfoque,
  contraste, tamanho aparente e proximidade da borda. Não provam uma causa única.
- Sugestões de posição e captura a testar. Não calculam altura ideal nem comprovam
  melhor orientação, leitura ou acessibilidade humana.
- Exportações PDF, JSON e CSV. Os resultados ficam em memória até 300 quadros;
  exporte antes de trocar de fonte ou fechar a página.

O exemplo tem 24 quadros correlacionados, 96 anotações, 66 TP, 0 FP, 24 FN e 6 TN:
precisão 1,000, recall 0,733. As falhas sob desfoque permanecem no resultado.
O [notebook executado](notebooks/analise-deteccao-placas.ipynb) recalcula esses valores
independentemente a partir das caixas e das posições conhecidas.

## Método e limites

OpenCV: cinza, recortes e template matching normalizado em sete escalas fixas,
com picos alternativos e conflitos entre identidades. Sem treinamento de modelos.
O PDI mostra recortes, cinza, Laplaciano, histograma e contraste.

Captura solicitada: até 1920 × 1080 / 30 FPS, negociados com o navegador.
Vídeo próprio/webcam: largura até 800 px, até 2 amostras/s, sem fila; o instante vem do quadro decodificado. O exemplo usa outra aquisição: 24 quadros fixos do MP4, decodificados na API e processados novamente. Sua duração de processamento não é tempo real e não depende do relógio do navegador. Tempo detectado soma
intervalos entre detecções consecutivas da mesma placa, na mesma fonte, com
`0 < Δt ≤ 1,5 s`. Falhas e ambiguidades interrompem a contagem; uma amostra isolada
soma zero. Não se comprova presença contínua entre amostras.

Acerto exige identidade correta e IoU ≥ 0,5. Precisão = TP/(TP+FP);
recall = TP/(TP+FN). Uma posição positiva incorreta gera FP e FN.
Placa presente com abstenção gera FN. Correlação não é probabilidade de acerto.
Perspectiva, oclusão, escala e placas semelhantes limitam o método.

## Dados e infraestrutura

SQLite local guarda fotos e recortes. Quadros são enviados à API local e não são
persistidos; exports não contêm vídeo. Use referências sem pessoas identificáveis.
Não há autenticação nem preparação para serviço público compartilhado.

Após instalar dependências, a análise funciona localmente, sem inferência externa.
Instalação inicial exige internet, Python e Node, o que limita acesso. A limpeza
na atualização remove apenas ativos distribuídos que foram descontinuados,
preservando fotos personalizadas. Migrações existentes continuam para atualizar
bancos antigos de forma transacional.

## Executar manualmente

Python 3.12 e Node.js ≥ 22.12:

```sh
python3.12 -m venv .venv
.venv/bin/python -m pip install -r backend/requirements.lock
npm --prefix frontend ci
# Terminal 1
PYTHONPATH=backend .venv/bin/python -m uvicorn heatcity.api:app --host 127.0.0.1 --port 8000
# Terminal 2
npm --prefix frontend run dev -- --port 5173 --strictPort
```

Abra http://127.0.0.1:5173. MP4/H.264 e WebM dependem de suporte do navegador.
Chrome e Edge aceitam câmera em localhost. No Windows, use `.venv\Scripts\python.exe`.

## Evidência e apresentação

Os materiais desta seção ficam na `develop`. Para reproduzir a análise ou
regenerar apresentações e medições, execute primeiro `git switch develop`.
A `main` contém a aplicação sem a pasta `docs/`, conforme solicitado.

[Apresentação editável PPTX](https://github.com/FIAP-4SIZ/HeatCity/blob/develop/docs/apresentacao/slides.pptx) ·
[Roteiro de fala e conceitos (MD)](https://github.com/FIAP-4SIZ/HeatCity/blob/develop/docs/apresentacao/ROTEIRO.md) · [Pacote offline](https://github.com/FIAP-4SIZ/HeatCity/blob/develop/docs/HeatCity-pacote-apresentacao.zip) ·
[Relatório](https://github.com/FIAP-4SIZ/HeatCity/blob/develop/docs/reports/HeatCity-deteccao-placas-exemplo.pdf) ·
[Medições](https://github.com/FIAP-4SIZ/HeatCity/blob/develop/docs/reports/deteccao-placas-benchmark.json) ·
[Exemplo](https://github.com/FIAP-4SIZ/HeatCity/blob/develop/docs/exemplo-hospital.md).

Regenerar vídeo/medições (requer ffmpeg somente para recriar o MP4 já incluído):

```sh
PYTHONPATH=backend .venv/bin/python scripts/build_sign_video_demo.py
.venv/bin/python -m pip install -r scripts/requirements-presentation.txt
.venv/bin/python scripts/build_sign_presentation.py
```

Reexecutar notebook, com dependências opcionais isoladas:

```sh
python3.12 -m venv .analysis-venv
.analysis-venv/bin/python -m pip install -r notebooks/requirements.txt
.analysis-venv/bin/python scripts/build_analysis_notebook.py
```

Os arquivos de entrada estão no checkout. Execute o notebook depois de regenerar
as medições. No PowerShell, defina `$env:PYTHONPATH="backend"` para o primeiro script.

## Testes

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

A validação automatizada usa vídeo sintético e webcam simulada. Não comprova
performance em captura real nem substitui apresentação e arguição individuais.
[Fontes](https://github.com/FIAP-4SIZ/HeatCity/blob/develop/docs/referencias.md) · [Fluxo de branches](https://github.com/FIAP-4SIZ/HeatCity/blob/develop/docs/fluxo-desenvolvimento.md).
A aplicação está na main. A develop mantém os materiais em docs/ e é a base para novas tarefas.

## Conferência do relatório do exemplo

[Verificação e valores esperados](https://github.com/FIAP-4SIZ/HeatCity/blob/develop/docs/verificacao-exemplo-sintetico.md). Ausência
conhecida é separada de falha com placa presente. Indícios geométricos de nitidez,
contraste e borda não são atribuídos à placa quando o candidato foi rejeitado.
