# HeatCity — guia único de entrega ao professor

## Comece aqui

**Repositório da entrega:** https://github.com/FIAP-4SIZ/HeatCity/tree/develop

**Material reunido para baixar:** [pacote de apresentação](HeatCity-pacote-apresentacao.zip).
O pacote contém os slides, roteiro, relatório, notebook e evidências. Para executar
a aplicação, use o checkout completo do repositório, não apenas esse pacote.

O trabalho é um **MVP de localização de placas conhecidas em vídeo**, com exemplo
sintético reproduzível. Ele não demonstra ainda melhoria de orientação humana.

## O que o professor solicita e onde encontrar

A fonte dos requisitos obrigatórios é somente `Cognitive Computing-GS2-2026.pdf`, páginas 1 e 2. Textos enviados posteriormente, incluindo CitizenTech, são contexto opcional e não acrescentam condições para o push ou a entrega.

| Solicitação | Abrir ou mostrar | Situação |
|---|---|---|
| Solução aplicada à Global Solution | [Contexto, método e limites](verificacao-requisitos.md) | Proposta de revisão da sinalização apresentada; o PDF não exige comprovação de impacto em campo |
| PDI e visão computacional, com justificativa técnica | [Método e execução](../README.md), [PDI visual](apresentacao/deteccao-pdi.png) e aplicação | Implementados no MVP |
| Scripts e notebooks produzidos | [Scripts](../scripts/), [código do detector](../backend/heatcity/services/sign_detection.py), [notebook executado](../notebooks/analise-deteccao-placas.ipynb) | Disponíveis |
| PDF com contexto, métodos, análises e considerações finais | [Relatório técnico PDF](reports/HeatCity-deteccao-placas-exemplo.pdf) | Disponível; resultados sintéticos identificados |
| Visualizações e indicadores, com comprovação das métricas | [Gráfico](apresentacao/deteccao-resultados.svg), [medições por quadro](reports/deteccao-placas-benchmark.json), [notebook](../notebooks/analise-deteccao-placas.ipynb) | Disponíveis e conferidos |
| README com explicação e instruções claras | [README](../README.md) e [inicializador Windows](../Iniciar-HeatCity.cmd) | Disponíveis; ensaiar no computador da aula |
| Informar o GitHub na plataforma/Teams | Link da develop no início deste guia | Envio pela equipe; não confirmado aqui |
| Demonstrar a aplicação funcionando em aula | Inicializador e sequência abaixo | Preparado; realização presencial não confirmada |
| Arguição individual | [Roteiro de fala e conceitos](apresentacao/ROTEIRO.md) e relatório técnico | Cada integrante precisa dominar o conteúdo |

Os slides são um apoio: [PPTX editável](apresentacao/slides.pptx), com quatro
campos para nome completo e RM de seis dígitos. O PDF obrigatório é o relatório
técnico; não é necessário transformar os slides em PDF.

## Sequência para mostrar ao professor

1. **Problema proposto:** explicar a dificuldade ilustrativa de encontrar a
   Recepção antes de escolher o corredor. A proposta apoia a revisão da
   sinalização; não mede leitura ou atenção das pessoas.
2. **Método:** mostrar uma foto cadastrada, as ROIs das quatro placas e o PDI
   visual. Explicar cinza, template matching `TM_CCOEFF_NORMED`, sete escalas e
   critérios de aceitação. Não há treinamento de modelo.
3. **Aplicação em execução:** abrir `Iniciar-HeatCity.cmd`, clicar em
   **Ver exemplo funcionando** e aguardar os 24 quadros. Mostrar os retângulos
   encontrados e o relatório final. Não apresentar o MP4 sintético como captura
   de um hospital real.
4. **Resultados e falhas:** mostrar o gráfico por trecho e os números abaixo.
   O desfoque causa as perdas no experimento; a Recepção removida é ausência
   correta. Em uma captura desconhecida, score baixo não identifica sozinho a
   causa de uma falha.
5. **Comprovação:** abrir o notebook com saídas executadas e as medições JSON.
   Explicar que as contagens são recalculadas a partir das caixas e da referência
   conhecida. Baixar PDF, JSON ou CSV da aplicação para demonstrar a exportação.
6. **Conclusão crítica:** explicar as limitações e propor uma nova captura real
   anotada, seguida de teste de benefício com usuários. Sugestões de local são
   hipóteses para comparar, não um local ideal comprovado.

### Números que precisam ser explicados

| Indicador do exemplo | Resultado |
|---|---:|
| Quadros / anotações de presença ou ausência | 24 / 96 |
| Acertos / falsos positivos | 66 / 0 |
| Perdas com placa presente / ausências corretas | 24 / 6 |
| Precisão | 100% |
| Recall | 73,3% |
| Tempo detectado estimado: Recepção | 5,5 s |
| Tempo estimado: cada uma das demais placas | 8 s |

Precisão alta não significa que todas as placas foram recuperadas. Acerto exige
nome correto, detecção aceita e IoU de pelo menos 0,5. Tempo detectado é uma soma
de intervalos entre amostras; não é tempo de leitura humana.

## Preparação da equipe e arguição

- Preencher os quatro nomes completos e RMs no PPTX e conferir a abertura no
  PowerPoint da máquina da aula.
- Ensaiar a aplicação no mesmo computador, com as dependências já instaladas.
- Cada integrante deve saber explicar: por que escolhemos o problema; como um
  recorte é procurado; por que usamos cinza; como o programa rejeita dúvidas;
  como contamos tempo; diferença entre precisão e recall; e por que o exemplo
  não comprova desempenho em campo.
- Guardar o PPTX, o relatório e o MP4 como apoio offline. Se a aplicação falhar,
  declarar que o material é uma evidência gravada: isso não substitui a
  demonstração prática exigida.

## Situação da entrega e próximos passos

**Os arquivos exigidos pelo professor estão completos no repositório:** scripts,
notebook executado, relatório técnico PDF, visualizações, indicadores com
comprovação e README de execução. A organização está apta para push na develop.

Após o push, cabe à equipe preencher os nomes/RMs, conferir a abertura do PPTX,
enviar o link na plataforma/Teams, demonstrar a aplicação em aula e responder à
arguição individual. Essas ações não são condições anteriores ao push.

CitizenTech, entrevistas, comprovação de benefício humano, teste A/B e novas
capturas reais podem enriquecer o trabalho, mas não são exigências explícitas
adicionais desse PDF nem pendências bloqueadoras da entrega dos arquivos.
Os resultados sintéticos continuam identificados como tais; isso é uma limitação
experimental, não uma ausência dos arquivos solicitados.

A [conferência detalhada](verificacao-requisitos.md) separa requisitos do documento,
limitações técnicas e ações da apresentação. Não atribui nota nem garante aprovação.
