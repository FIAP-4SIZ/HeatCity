# Fontes da apresentação atual — placas em vídeo

- OpenCV, **Template Matching**: https://docs.opencv.org/4.x/d4/dc6/tutorial_py_template_matching.html — correlação normalizada e busca por referência. O runtime exato consta no JSON do benchmark; a API consultada é a documentação 4.x.
- Arnaldo Jr., **Lab8 — Template matching**: https://arnaldojr.github.io/cognitivecomputing/aulas/PDI/lab12/Template_matching.html — relação com o conteúdo de aula.
- OpenCV, **Laplacian Operator**: https://docs.opencv.org/4.x/d5/db5/tutorial_laplace_operator.html — descritor de nitidez, sem inferir legibilidade.
- Enunciado **Cognitive Computing-GS2-2026.pdf**, fornecido pelo usuário: problema, PDI/visão computacional, demonstração e análise crítica. Não exige MediaPipe como biblioteca específica.
- Evidência local: `docs/reports/deteccao-placas-benchmark.json`, `frontend/public/detection-demo.json`, scripts `build_sign_video_demo.py` e `build_sign_presentation.py`. As imagens hospitalares originais são de IA e o vídeo demonstrativo é uma transformação controlada dessas imagens.

As fontes abaixo pertencem à investigação ocular e aos materiais anteriores; não fundamentam uma afirmação de acerto do detector atual.

# Referências identificadas e relação com o projeto

Verificação de disponibilidade tentada em 11/11/2026: os sites institucionais e de
documentação retornaram bloqueio de acesso pela rede deste ambiente. Os links
abaixo identificam as fontes; não são declarados como lidos integralmente nessa
data. Conferir os links no computador da apresentação. Um endereço antigo do
MediaPipe Iris retornou 404 e não é utilizado na bibliografia atual.

## Enunciado primário

Arnaldo Jr / FIAP. **Cognitive Computing, Computer Vision And IOT Systems —
Global Solution, segunda etapa, 2026**. Arquivo fornecido pelo usuário:
`Cognitive Computing-GS2-2026.pdf`, duas páginas. Especifica entregas e pesos de
avaliação; não estabelece precisão mínima de gaze. Sem URL pública fornecida.
A proposta complementar do HeatCity foi fornecida como texto; seus objetivos
não devem ser confundidos com exigências explícitas desse enunciado.

## Fontes institucionais e técnicas

- **[FIAP-GS] FIAP. Global Solution — Citizen Tech.**
  <https://experience.fiap.com.br/global-solution-citizen-tech>
  Uso: Endereço institucional indicado na proposta do usuário; contextualiza o desafio. O conteúdo e a edição atual não foram confirmados neste ambiente.

- **[AULA] Arnaldo Jr. Cognitive Computing — PDI, laboratório 17: MediaPipe.**
  <https://arnaldojr.github.io/cognitivecomputing/aulas/PDI/lab17/mediapipe.html>
  Uso: Material de aula indicado pelo usuário como base para a detecção com MediaPipe.

- **[MP] Google AI Edge. MediaPipe Face Landmarker — Web / JavaScript.**
  <https://ai.google.dev/edge/mediapipe/solutions/vision/face_landmarker/web_js>
  Uso: API de detecção facial no navegador. Landmarks não são uma coordenada de olhar pronta; o projeto acrescenta sua interpolação geométrica.

- **[CV-GRAY] OpenCV. Color Space Conversions — cvtColor, COLOR_BGR2GRAY.**
  <https://docs.opencv.org/4.x/d8/d01/group__imgproc__color__conversions.html>
  Uso: Conversão BGR para cinza utilizada no processamento das cenas.

- **[CV-LAP] OpenCV. Laplace Operator.**
  <https://docs.opencv.org/4.x/d5/db5/tutorial_laplace_operator.html>
  Uso: Operador Laplaciano; o HeatCity calcula a variância do resultado, sem limiar universal de nitidez.

- **[CV-HIST] OpenCV. Histograms — 1: Find, Plot, Analyze !!!.**
  <https://docs.opencv.org/4.x/d1/db7/tutorial_py_histogram_begins.html>
  Uso: Referência conceitual de histograma. A contagem implementada usa numpy.bincount, não cv2.calcHist.

- **[NP] NumPy. numpy.percentile.**
  <https://numpy.org/doc/stable/reference/generated/numpy.percentile.html>
  Uso: Percentis P1 e P99 usados no contraste local descritivo.

- **[ODS11] Nações Unidas — UN DESA. Goal 11: Sustainable cities and communities.**
  <https://sdgs.un.org/goals/goal11>
  Uso: Relação proposta com espaços urbanos inclusivos e acessíveis. Não comprova cumprimento de metas ou impacto pelo protótipo.

## Implementação e evidência próprias

- [Código HeatCity](https://github.com/FIAP-4SIZ/HeatCity/tree/develop), branch de
  integração `develop`. A versão exata usada em cada experimento deve ser registrada;
  os diagnósticos disponíveis não estabelecem por si só o commit da coleta.
- `backend/heatcity/services/vision.py`: cinza, recortes, histogramas, contraste,
  Laplaciano e mapas de densidade. `numpy.bincount` conta intensidades.
- `backend/heatcity/calibration.py`: correspondências e interpolação geométrica;
  não treina regressão ou classificador. As conferências medem erro do mapeamento.
- Dependências congeladas: `backend/requirements.lock` (OpenCV 5.0.0.93, NumPy
  2.3.5), `frontend/package-lock.json` / package.json (Tasks Vision 1.2.2).
  Documentação OpenCV 4.x é referência conceitual da API; o runtime instalado é
  5.0.0.93. Documentação web atual não é um snapshot dessa versão instalada.
- `docs/reports/evidencias/analise-calibracao.json`: agregados do diagnóstico real
  de 11/11/2026 e hash da fonte privada. Tentativas não são participantes distintos.
- `docs/reports/evidencias/pdi-cena-didatica.json`: métricas calculadas de uma cena
  sintética; não são evidências coletadas em hospital real.

## Limites das atribuições

O contraste (P99−P1)/(P99+P1+ε) é uma escolha descritiva do projeto, não uma fórmula
WCAG ou uma garantia da documentação do OpenCV. O limiar de calibração 0,100 é
heurístico do projeto, não um limite recomendado pelo MediaPipe. Não foi medida
redução de tempo de orientação, atendimentos perdidos ou melhora de acessibilidade.
