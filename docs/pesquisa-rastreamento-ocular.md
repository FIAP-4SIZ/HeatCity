# Detecção dos olhos e alternativas

Consulta em 06/11/2026. Documentação e código oficiais, não benchmarks próprios.

## O que o MediaPipe oferece

- [MediaPipe Iris](https://github.com/google-ai-edge/mediapipe/blob/master/docs/solutions/iris.md)
  afirma explicitamente que rastrear a íris **não determina para onde a pessoa olha**.
  O HeatCity ainda depende de um modelo calibrado para mapear features em tela.
- [Face Mesh](https://github.com/google-ai-edge/mediapipe/blob/master/docs/solutions/face_mesh.md)
  documenta `refineLandmarks` para maior detalhamento de olhos e íris, com mais
  custo computacional. Já está habilitado. Aumentar `minTrackingConfidence`
  pode aumentar robustez e latência; não é uma opção de precisão do olhar.
- A documentação legada direciona para Face Landmarker. A
  [API oficial Tasks Web](https://github.com/google-ai-edge/mediapipe/blob/master/mediapipe/tasks/web/vision/face_landmarker/face_landmarker.ts)
  oferece landmarks, blendshapes opcionais e matrizes de transformação facial.
  São recursos úteis para experimentar fechamento ocular e pose, mas não
  substituem calibração de gaze. A página ai.google.dev retornou HTTP 403 neste
  ambiente; a pesquisa usou documentação e código oficiais no GitHub.

## Alterações nesta revisão

O limiar fixo de abertura 0.14 era uma regra do HeatCity, não uma exigência do
MediaPipe. Ele rejeitava olhos com menor abertura natural. Agora cada olho tem
referência individual baseada no percentil 80 de até 120 observações durante
preparação/contagem, congelada durante coleta e teste. O fechamento usa uma
fração da referência com histerese para evitar alternância perto do limite.
Um piso mínimo impede usar fechamentos completos como referência aberta.
A geometria ocular agora considera a proporção altura/largura do frame.

Esses limites são heurísticos: oclusões e landmarks incorretos continuam
possíveis. Olhos estreitos não são sinônimo de piscada, mas pálpebras cobrindo
completamente a íris deixam informação insuficiente. Não inventar coordenadas
nesses intervalos. Testar em participantes com aberturas palpebrais variadas,
com/sem óculos e diferentes iluminações, registrando erro e cobertura válida.
Não há evidência humana de ganho de precisão desta revisão ainda.

Durante calibração e prévia, a captura continua sem exibir câmera ou controles.
O campo branco ocupa a tela inteira. A câmera aparece na preparação e no
resultado, fora do campo; ESC encerra o modo de medição. A geometria usada na
calibração deve coincidir com a da prévia, independentemente da tela de resultado.

## Alternativas

| Opção | O que oferece | Limites e decisão |
| --- | --- | --- |
| Face Landmarker Tasks | Landmarks faciais, blendshapes e transformação facial | Melhor candidato a próxima migração de API; medir antes de afirmar ganho de gaze. Troca de modelo/runtime não foi feita nesta revisão. |
| [WebGazer](https://github.com/brownhci/WebGazer) | Predição de olhar na tela, calibração e execução no navegador | Alternativa para comparar RMSE/cobertura no mesmo protocolo. README informa fim da manutenção oficial em fevereiro de 2026 e licença GPLv3 com condições alternativas. Não assumir precisão superior. |
| [OpenFace](https://github.com/TadasBaltrusaitis/OpenFace) | Estimativa de gaze e pose com webcam, ferramenta nativa | Requer integração fora do browser e revisão das licenças do código, modelos e datasets. Não é substituição direta da biblioteca JS. |

Recomendação: manter a correção individual atual e preparar comparação controlada
com Face Landmarker Tasks. Comparar erro de validação, percentil 90, fração de
rastreamento válido, perdas durante piscadas, latência e tolerância a movimentos
naturais da cabeça. Usar as mesmas pessoas, câmera, alvos e cenários; não trocar
biblioteca nem aumentar o limite de aprovação apenas para obter um resultado verde.
