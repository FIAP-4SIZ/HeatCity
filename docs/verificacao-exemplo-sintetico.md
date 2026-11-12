# Conferência do relatório do exemplo

## Resultado atual confirmado

Após as correções, o novo relatório enviado pelo usuário reproduziu a grade de
24/24 quadros e os valores esperados abaixo: 66 TP, 0 FP, 24 FN, 6 TN; precisão
100% e recall 73,3%. Recepção teve 12 detecções, 6 falhas com placa presente e
6 ausências corretas, com 5,5 s estimados. As demais tiveram 18 detecções,
6 falhas e 8 s estimados cada. Não houve correspondências ambíguas.

**Consistente e aprovado como demonstração sintética controlada.** As perdas no
desfoque permanecem no resultado. Isso não aprova desempenho em vídeo real nem
comprova impacto humano. O texto recebido permite conferir contagens e tempos;
não contém as caixas para recalcular o IoU dessa execução. A apresentação usa o
IoU do benchmark identificado como tal.

## Relatório anterior e diagnóstico histórico

O texto enviado informa 24 quadros, 96 anotações, 11 detecções da Recepção e 17 de cada uma das outras três placas. Isso corresponde a 62 TP, 0 FP e 28 FN sobre 90 presenças anotadas, além de 6 ausências. Logo, precisão 100% e recall 68,9% são matematicamente coerentes: `62/(62+0)` e `62/(62+28)`.

Os tempos de 5,04 s e 7,56 s também são compatíveis com a soma dos intervalos entre detecções consecutivas da execução amostrada. Eles não representam a duração física total em que a placa existiu no vídeo.

Esse resultado não coincide com o benchmark fixo: falta uma detecção por placa. O texto não inclui imagens ou registros por quadro, então não permite confirmar a origem exata dessa diferença. O padrão é compatível com um quadro comum sem detecção das quatro placas. A aquisição anterior dependia do relógio e da decodificação do navegador.

## Correções

1. O exemplo agora decodifica **o MP4 real**, na API, em 24 quadros fixos: índices 0, 6, …, 138; tempos 0, 0,5, …, 11,5 s. Usa o mesmo detector, com os mesmos limiares, e não retorna previsões prontas do benchmark. Hashes da foto e do vídeo são conferidos. Processamento lento não altera essa grade.
2. Vídeo próprio/webcam permanecem ao vivo; quando disponível, o instante de captura vem de `requestVideoFrameCallback.mediaTime`, que acompanha o quadro decodificado.
3. A referência conhecida informa presença/ausência apenas para medir acerto e interpretar o relatório. Não corrige as coordenadas nem altera a decisão do detector.
4. Ausências confirmadas não são contadas como indícios de dificuldade. São mostradas separadamente das falhas com placa presente.
5. Um candidato rejeitado não confirma a região da placa. Sua borda, contraste e nitidez deixam de fundamentar sugestões de posição. Picos parecidos com similaridade muito baixa também não justificam afirmar confusão entre placas.

## Valores esperados da execução completa

| Trecho | Quadros | TP | FP | FN | TN |
|---|---:|---:|---:|---:|---:|
| Imagem nítida | 6 | 24 | 0 | 0 | 0 |
| Deslocamento | 6 | 24 | 0 | 0 | 0 |
| Desfoque | 6 | 0 | 0 | 24 | 0 |
| Recepção ausente | 6 | 18 | 0 | 0 | 6 |
| Total | 24 | 66 | 0 | 24 | 6 |

Precisão: **100%**. Recall: **73,3%**. O desfoque foi construído pelo gerador; sua causa é conhecida nesse experimento, não inferida a partir de um score baixo.

| Placa | TP | FN | Ausências corretas | Recall | Tempo detectado estimado |
|---|---:|---:|---:|---:|---:|
| Recepção | 12 | 6 | 6 | 66,7% | 5,5 s |
| Pronto Socorro | 18 | 6 | 0 | 75% | 8 s |
| Ambulatório | 18 | 6 | 0 | 75% | 8 s |
| Triagem | 18 | 6 | 0 | 75% | 8 s |

Precisão por placa é 100% entre as detecções anotadas. Isso convive com falhas: 24 presenças não foram recuperadas. Não se deve elevar artificialmente o recall omitindo quadros difíceis ou contar ausências corretas como perdas.

O tempo é conservador: soma intervalos somente entre detecções consecutivas da mesma placa e fonte, até 1,5 s. Um quadro isolado soma zero. Assim, não se extrapola presença até o quadro seguinte ou o fim do arquivo.

## Evidência e limites

O teste de navegador atrasa deliberadamente uma resposta da API e confere todos os índices, tempos e contagens. Os testes também verificam ausência correta e que um candidato rejeitado não diagnostica a geometria da placa. O notebook reexecutado recalcula IoU e contagens independentemente.

Uma análise interrompida é parcial e pode ter números diferentes. Vídeos próprios e câmera são amostrados ao vivo, portanto não precisam reproduzir o benchmark. Nenhum desses resultados sintéticos demonstra desempenho em campo ou benefício humano.
