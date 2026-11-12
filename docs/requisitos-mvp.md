# Requisitos do MVP de placas em vídeo

Pergunta: onde a placa cadastrada aparece e por quanto tempo é detectada?

- Catálogo local de projetos, imagens e recortes identificados por nomes únicos.
- Vídeo ou webcam, análise amostrada sem fila e posições normalizadas por quadro.
- Estados de detecção, ambiguidade, conflito e não localização explícitos.
- Primeira detecção, trechos e tempo estimado com interrupções e sem preencher falhas.
- Precisão, recall e IoU somente quando houver referência verdadeira anotada.
- PDI visual: cinza, Laplaciano, histograma e descritores do recorte.
- Consolidado por placa com dificuldade, indícios de dúvida e sugestões a testar.
- Exportação JSON/CSV/PDF e apresentação reproduzível com fontes e limitações.
- Nenhum treinamento de modelo. Uso local, sem autenticação, sem áudio e sem persistência de vídeo.

O exemplo hospitalar é de IA; o MP4 sintético apresenta nitidez, deslocamento,
desfoque e remoção da Recepção. Não representa participantes humanos nem uma
captura real. A comparação A/B original muda múltiplos elementos e não isola o
local da placa como causa. Ainda é necessária medição com vídeo real anotado.

Aderência acadêmica: problema de sinalização em ambientes coletivos, relação com
a Global Solution, PDI/visão computacional, scripts reproduzíveis, gráficos,
relatório, demonstração funcional e discussão crítica. Não se afirma que a
localização pela câmera mede leitura ou compreensão humana.
