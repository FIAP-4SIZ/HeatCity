# Conferência da proposta e dos requisitos

## Revisão de 12/11/2026

Conferência refeita diretamente nas duas páginas de `Cognitive Computing-GS2-2026.pdf`, fornecido pela equipe. Foram revistos código, README, relatório técnico, notebook executado, medições, gráficos, apresentação e testes. A capa tem quatro campos não numerados de nome completo e RM de seis dígitos. A apresentação é apenas PPTX e o roteiro apenas Markdown; o PDF técnico permanece porque é exigido pelo professor.

**Escopo obrigatório:** somente o PDF da disciplina. Conforme esclarecimento da equipe, textos posteriores como CitizenTech são contexto opcional. Os arquivos exigidos para o repositório estão presentes e conferidos; a entrega dos arquivos foi autorizada para integração na main. Submissão na plataforma, demonstração em aula e arguição são etapas posteriores da equipe, não condições prévias para enviar o código.

**Links após a integração autorizada:** aplicação na main: https://github.com/FIAP-4SIZ/HeatCity ; entrega completa com documentação, PDF e apresentação na develop: https://github.com/FIAP-4SIZ/HeatCity/tree/develop . Por solicitação do usuário, `docs/` existe apenas na develop. As demais branches são removidas; o histórico integrado é preservado.

## Veredito

O HeatCity atende aos requisitos de arquivos da disciplina como **MVP de PDI e visão computacional para apoiar a revisão de sinalização**: código, notebook executado, PDF técnico, gráficos, métricas comprovadas e README. O problema, as escolhas técnicas e as limitações são documentados. A avaliação do professor permanece necessária; presença dos arquivos não garante nota.

A evidência é sintética e não comprova desempenho em campo. Essa limitação deve ser explicada na análise crítica. O documento não exige uma demonstração adicional de impacto humano para autorizar a entrega dos arquivos.

## O PDF da matéria exige relato real na apresentação?

**Não como item explícito.** Em `Cognitive Computing-GS2-2026.pdf`, página 2, os itens da apresentação são:

- “Demonstração prática: exibição da aplicação criada em execução.”
- “Arguição individual”, baseada no relatório: problema, metodologia, técnicas, implementação e resultados.

Na página 1, o PDF exige uma solução aplicada à Global Solution, justificativa técnica e avaliação crítica dos resultados. O texto de CitizenTech foi fornecido separadamente e não é critério obrigatório desta conferência. Não há no PDF da disciplina exigência de entrevista gravada, quantidade mínima de participantes ou experimento comparativo de posicionamentos.

## Conferência item a item da disciplina

| Exigência | Situação | Evidência ou limite |
|---|---|---|
| Solução aplicada à Global Solution | Proposta apresentada | Revisão de sinalização em espaços coletivos; contexto e justificativa documentados. Impacto humano não é declarado como comprovado nem exigido como entrega adicional |
| Aplicar PDI e visão computacional do semestre | Atende no protótipo | Cinza, recortes, histograma, Laplaciano e template matching multiescala em vídeo |
| Justificar técnicas e avaliar criticamente | Atende no ensaio apresentado | README, método, relatório, notebook; falhas e limites permanecem visíveis |
| Scripts e notebooks produzidos | Atende | `scripts/build_sign_video_demo.py`, `scripts/build_analysis_notebook.py`, notebook executado em `notebooks/analise-deteccao-placas.ipynb` |
| PDF com contexto, métodos, análises e considerações finais | Atende para o protótipo | `docs/reports/HeatCity-deteccao-placas-exemplo.pdf`; resultados identificados como sintéticos |
| Gráficos, desempenho e comprovação das métricas | Atende no ensaio sintético | MP4, referência conhecida, hash, JSON por quadro, notebook recalculando caixas/IoU/contagens e gráfico |
| README e execução clara | Implementado e testado por software | Exemplo em um clique; foto → vídeo próprio; launcher Windows e comandos manuais. O último ensaio físico no computador da apresentação é responsabilidade da equipe |
| Informar endereço do GitHub no Teams/plataforma | Pendente da equipe | Ter código enviado ao GitHub não comprova a submissão na plataforma |
| Demonstrar a aplicação em execução na aula | Preparado; apresentação ainda pendente | Testes de navegador com vídeo versionado e webcam simulada não substituem a demonstração presencial |
| Arguição individual | Pendente da equipe | Roteiro explica fala, método e termos; cada integrante deve compreender código e resultados |

Pesos do PDF: relevância do problema 1,5; rigor técnico 2,5; análise dos resultados 2,0; clareza/código 1,0; demonstração em sala 1,5; arguição 1,5. Esta conferência não atribui pontuação nem garante avaliação do professor.

## O que o enunciado não torna obrigatório

O professor permite escolher problema, técnicas e ferramentas. Não determina MediaPipe, rastreamento ocular, treinamento de modelos, IoT físico, uso de todos os Labs, taxa mínima de acerto, teste A/B, quantidade de participantes ou formato PDF para os slides. O PDF obrigatório é o documento técnico. A proposta deve aplicar PDI e visão computacional, justificar escolhas e analisar resultados; o HeatCity implementa esses pontos no protótipo. Textos separados sobre CitizenTech não ampliam os requisitos obrigatórios da entrega.

## Verificações executadas nesta revisão

- Backend: 25 testes, incluindo detecção, métricas, catálogo, relatório e codificação do exemplo no Windows.
- Frontend: seis testes de contagem temporal e captura, formatação e build de produção.
- Navegador: exemplo completo, relatórios PDF/JSON/CSV, vídeo próprio sem precisão inventada, anotação manual, webcam simulada, cadastro e PDI; também tela estreita.
- Notebook reexecutado: hash do MP4, contagens e IoU conferidos independentemente; entradas e saídas estão versionadas.
- Apresentação: 12 slides, quatro campos de nome completo/RM, notas de fala, fontes externas, pacote sem HTML/TXT de apresentação. Abertura nativa no PowerPoint precisa ser conferida na máquina da equipe.

Esses checks verificam software e artefatos. Não substituem teste de webcam física, observação de campo ou a apresentação em sala.

## Contexto opcional: necessidade humana e CitizenTech

Esta seção descreve possibilidades e limites da proposta, não requisitos adicionais do professor. A ausência dessas evidências não bloqueia o push ou a entrega dos arquivos.

- **Cidadão beneficiado proposto:** paciente, acompanhante ou visitante que precisa encontrar um serviço como a Recepção.
- **Problema proposto:** sinalização pequena no percurso, desfocada na captura, obstruída ou visualmente confundível pode dificultar a localização de informações. O caso do hospital é ilustrativo; não foi apresentado um diagnóstico de campo verificável neste material.
- **Solução:** responsáveis pelo espaço cadastram uma foto e os recortes das placas. O sistema usa vídeo/webcam para localizar as referências e reunir indícios que orientam testes de posicionamento e captura.
- **Tecnologias:** câmera, navegador, API local, OpenCV, dados por quadro e exportações. Não há treinamento de um modelo. A automação é de análise de imagem; não substitui julgamento das pessoas.
- **Ecossistema proposto:** cidadãos relatam barreiras; equipe do espaço registra o percurso; manutenção/sinalização testa melhorias; usuários verificam se a mudança ajuda. A participação desses atores ainda precisa ser realizada e documentada.
- **Uso e sustentabilidade:** ferramenta local de apoio à manutenção; serviço de diagnóstico é uma possibilidade, não um modelo de negócio validado. Não há obrigação de ser solução governamental.
- **Inclusão e dados:** o cidadão não precisa instalar o app; a operação é de uma equipe local. Interface com tema, teclado e contraste verificados por software; usabilidade com idosos ou pessoas com deficiência ainda não foi demonstrada. Vídeo não é persistido; fotos de referência ficam locais. Recomenda-se referência sem pessoas identificáveis. Sem autenticação, a aplicação não deve ser exposta como serviço público compartilhado.
- **Infraestrutura:** após instalar dependências, a análise funciona localmente com ativos incluídos, sem serviços de inferência externos. Instalação inicial exige internet e computador compatível; isso limita acesso e deve entrar no planejamento de implantação.

## ODS e metas

- **ODS 3, meta 3.8:** contribuição indireta pretendida ao acesso à orientação em serviços de saúde. Encontrar a Recepção pode apoiar acesso ao atendimento; o detector não mede resultado clínico nem cobertura de saúde. Fonte: https://sdgs.un.org/goals/goal3 .
- **ODS 11, meta 11.7:** afinidade pretendida com espaços públicos seguros, inclusivos e acessíveis. O exemplo de sinalização não demonstra o cumprimento integral dessa meta, que também abrange áreas verdes e acesso universal. A contribuição deve ser verificada em um contexto concreto de espaço de uso coletivo. Fonte: https://sdgs.un.org/goals/goal11 .

## O que as métricas realmente comprovam

No experimento versionado: 24 quadros correlacionados, 96 anotações de posição/presença, 66 TP, 0 FP, 24 FN e 6 TN. Precisão 1,000 convive com recall 0,733. O notebook recalcula as contagens usando as caixas e a referência geométrica, sem importar a função de métricas do detector.

Isso comprova funcionamento controlado do software sobre o exemplo de IA. Não comprova desempenho em vídeos reais, leitura de placas, redução de pedidos de ajuda ou ganho de acessibilidade. O app separa acerto conhecido de precisão não medida, e registra falhas em vez de convertê-las em acertos.

## Melhorias opcionais após a entrega dos arquivos

1. Documentar uma observação ou relato consentido sobre dificuldade real de sinalização, sem coletar nomes ou dados sensíveis. Isso fundamenta a necessidade CitizenTech; não é uma exigência autônoma de relato na apresentação da matéria.
2. Capturar um vídeo real compatível com uma foto de referência. Conferir posições/ausências em quadros e baixar o relatório.
3. Quando possível, testar uma alteração de posição com pessoas, medindo tempo de localização, enganos e pedidos de ajuda. Manter percurso, iluminação e câmera comparáveis.
4. Preparar a apresentação e respostas individuais. Informar honestamente quais etapas foram executadas e quais continuam propostas.
