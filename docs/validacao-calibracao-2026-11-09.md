# Validação dos diagnósticos e plano de precisão — 09/11/2026

Análise de cinco tentativas fornecidas pelo usuário em condições que ele considera
as melhores disponíveis. Apenas agregados abaixo; arquivos brutos, códigos e
features biométricas não foram adicionados ao repositório.

| Tentativa | Método | RMSE | Erro X | Erro Y | CV do ajuste |
| --- | --- | ---: | ---: | ---: | ---: |
| Fixo 1 | Afim | 0.1631 | 0.0453 | 0.1567 | 0.2451 |
| Fixo 2 | Afim | 0.1291 | 0.0809 | 0.1005 | 0.1733 |
| Fixo 3 | Afim | 0.1561 | 0.0369 | 0.1517 | 0.2195 |
| Móvel 1 | Ridge | 0.1357 | 0.0527 | 0.1250 | não disponível |
| Móvel 2 | Ridge | 0.1309 | 0.0415 | 0.1242 | não disponível |

## O que esses dados permitem concluir

- Nenhuma tentativa atende ao limite declarado de 0.100. A melhor foi 0.1291,
  melhor que o melhor valor anteriormente relatado de 0.146, mas ainda reprovada.
- O eixo vertical domina o erro. O viés vertical muda de sinal entre tentativas;
  um deslocamento fixo na saída não constitui correção geral.
- A correlação horizontal entre feature e alvo nos fixos é aproximadamente
  -0.97 a -0.98. O sinal negativo é aprendido pelo ajuste; não justifica inverter
  arbitrariamente o espelhamento ou as coordenadas.
- Nos móveis, a posição vertical do centro dos olhos/cabeça correlaciona com o
  alvo em cerca de 0.97–0.99. Isso é um indício de confundimento, não prova de
  rastreamento ocular correto. Movimento ordenado pode ensinar a sequência ou
  a postura em vez de aprender uma relação robusta entre olhos e tela.
- Os fixos só preservavam duas features agregadas por ponto. Não permitem
  reconstruir jitter, assimetria entre olhos ou pose descartada. Mais informação
  não pode ser recuperada retroativamente desses JSONs.

## Experimentos retrospectivos

Foram examinados afim, eixos separados, termos de curvatura e quadrático.
A seleção por CV de treinamento não fez as três tentativas fixas passarem:
RMSE de validação aproximadamente 0.154, 0.124 e 0.188. Esses experimentos são
exploratórios; não se escolheu um modelo pelo melhor resultado nos cinco alvos
posteriores, nem se ajustou o viés usando esses alvos para declarar aprovação.
Aumentar confiança de face ou suavizar o marcador não resolve esse erro científico.

## Protocolo novo, opcional e prospectivo

`Precisão · pontos aleatórios + deriva` está disponível no seletor:

1. 25 posições distribuídas numa grade 5×5 em ordem aleatória.
2. Quatro repetições extras do centro para observar deriva (29 coletas de ajuste).
3. Dois olhos separados e seis descritores de cabeça preservados, sem reduzir
   tudo à média bidimensional. Exportação inclui a nuvem de amostras por ponto.
4. Seleção de regularização por CV agrupada por alvo. Todas as repetições do
   mesmo alvo ficam fora do ajuste daquele fold; evita vazamento por frames.
5. Nove posições espaciais posteriores, distintas da grade, exclusivamente para
   medir aprovação. Não corrigem pesos, viés ou regularização.
6. Erros por eixo, viés, percentil 90 e CV são retornados. O limite continua 0.100.

A tentativa leva cerca de 90 segundos, ou mais se a câmera estiver lenta. É mais
longa para obter uma medição informativa, não uma promessa de ganho. Os modos
anteriores permanecem disponíveis para comparação. O protocolo não deve passar
apenas por existir; precisa de nova coleta e validação humana independente.

## Pesquisa consultada

- [MediaPipe Iris — documentação oficial](https://github.com/google-ai-edge/mediapipe/blob/master/docs/solutions/iris.md):
  o próprio projeto afirma que rastrear íris não determina para onde alguém olha.
  A precisão citada para distância até a câmera não é precisão de gaze na tela.
- [WebGazer — projeto oficial](https://github.com/brownhci/WebGazer): regressão
  de gaze a partir de webcam, com limitações de manutenção e licença descritas
  pelo projeto. Não há evidência de superioridade neste usuário sem comparação.
- [WebGazer util — código oficial](https://github.com/brownhci/WebGazer/blob/master/src/util.mjs):
  usa aparência de recortes dos olhos, reduzidos e em escala de cinza, uma fonte
  de sinal diferente de médias de landmarks. Esse código não foi copiado nem
  incorporado ao HeatCity; adoção exige estudo de licença, privacidade e acurácia.

## Critério de conclusão

Testes sintéticos verificam cálculo e fluxo, não precisão com pessoas. Se o novo
protocolo ainda não atender à qualidade necessária, a conclusão honesta é que
este estimador por landmarks é insuficiente nessas condições. O próximo passo
é comparar um estimador específico de gaze por aparência ou equipamento dedicado,
com protocolo e dados independentes. Não declarar a calibração precisa ou
"passável" apenas para liberar o MVP.

Reprodução dos cálculos existentes:

```bash
.venv/bin/python scripts/validate_diagnostics.py caminho/diagnostico1.json caminho/diagnostico2.json
```
