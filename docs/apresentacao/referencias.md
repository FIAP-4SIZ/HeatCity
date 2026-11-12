# Fontes identificadas

- [OpenCV — Template Matching](https://docs.opencv.org/4.x/d4/dc6/tutorial_py_template_matching.html) — Correlação normalizada e busca por referência.
- [OpenCV — Laplacian Operator](https://docs.opencv.org/4.x/d5/db5/tutorial_laplace_operator.html) — Descritor de variação espacial, sem inferência de legibilidade.
- [Aula — Template matching](https://arnaldojr.github.io/cognitivecomputing/aulas/PDI/lab12/Template_matching.html) — Relação com o laboratório da disciplina.
- [Aula — Histograma e equalização](https://arnaldojr.github.io/cognitivecomputing/aulas/PDI/lab03/atividade3.html) — Distribuição de intensidades; o HeatCity mostra o histograma, mas não aplica equalização no detector.
- [Aula — Filtros de convolução](https://arnaldojr.github.io/cognitivecomputing/aulas/PDI/lab04/Filtros_de_Convolu%C3%A7%C3%A3o.html) — Base conceitual do Laplaciano usado como descritor de detalhes.
- [MDN — getUserMedia](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia) — Permissão de câmera e negociação de recursos.
- [ONU — ODS 3, meta 3.8](https://sdgs.un.org/goals/goal3) — Contribuição indireta pretendida ao acesso a serviços de saúde; impacto não comprovado.
- [ONU — ODS 11, meta 11.7](https://sdgs.un.org/goals/goal11) — Afinidade com espaços de uso coletivo acessíveis; o projeto não demonstra cumprimento integral da meta.

Enunciado da disciplina: Cognitive Computing-GS2-2026.pdf, fornecido pelo usuário. Tema e texto do desafio CitizenTech fornecidos separadamente na conversa. Os requisitos e as limitações são confrontados em docs/verificacao-requisitos.md. O runtime exato do OpenCV consta no JSON do benchmark; as operações referenciam a documentação 4.x.

Evidência desta apresentação: relatório do exemplo enviado pelo usuário e confrontado com `docs/reports/deteccao-placas-benchmark.json`. Foram confirmadas 24/24 amostras, 66 TP, 0 FP, 24 FN e 6 TN; precisão 100%, recall 73,3%; tempos estimados de 5,5 s para Recepção e 8 s para as outras placas. O texto recebido não contém caixas por quadro: o IoU médio de 0,714 é identificado como resultado do benchmark versionado, não como recálculo desse texto.
