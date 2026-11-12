# Roteiro de apresentação — HeatCity

Abra slides.html no Chrome/Edge. Setas avançam; use Tela cheia. slides.pdf é a cópia
para compartilhar/contingência. Não depende da API nem da internet.

## Fala sugerida (6–8 minutos)

1. **Objetivo (40 s):** “O HeatCity investiga uma cadeia de visão computacional
   aplicada à sinalização, desde a descrição da imagem até estimativas experimentais
   de olhar. Esta é uma entrega de MVP exploratório.”
2. **Problema e arquitetura (1–2 min):** abrir o slide de PDI e a aba **PDI visual**; mostrar cena/AOIs, PDI, detector pronto,
   geometria, armazenamento e exportação. Explicar o que cada membro implementou;
   não atribuir funções pessoais sem combinar com a equipe.
3. **Evidência (1 min):** “As duas coletas concluídas deram RMSE 0,107 e 0,122
   somente nos quadros com previsão. Houve 72/147 e 38/162 sem previsão. Não
   atingimos a qualidade exigida para conclusões oficiais de localização.”
4. **Decisão de escopo (40 s):** “Preservamos o bloqueio oficial e separamos um
   ensaio técnico que registra estimativas, sem calcular sucesso ou atenção validada.”
5. **Demonstração (2 min):** seguir o guia abaixo. Antes da gravação: “Esta malha
   foi importada de outra coleta; a postura atual não foi reconferida.” Depois:
   “O mapa mostra a densidade das coordenadas estimadas, não uma prova de leitura.”
6. **Conclusão (1 min):** mostrar limitações e próximos experimentos. O avanço é a
   integração e a rastreabilidade; ainda falta precisão humana repetível.

## Exemplo concreto e relação com a Global Solution (40–60 s)

“Imagine alguém entrando pela primeira vez num hospital para encontrar a recepção.
A entrada conduz a busca para o corredor à frente, mas a placa fica sobre uma porta
lateral. A pessoa pode parar, procurar outra indicação ou pedir ajuda. Este é um
exemplo ilustrativo, não um caso observado em hospital pelo nosso projeto.

A pergunta seria se uma placa no ponto de decisão facilita a localização. Podemos
preparar duas imagens mantendo texto, tamanho e tarefa, alterando a posição e
alternando a ordem A/B. Hoje conseguimos descrever a imagem e demonstrar a cadeia
experimental; ainda não comprovamos qual posição é melhor.

Essa aplicação aproxima visão computacional de uma necessidade de orientação das
pessoas em espaços coletivos, como contribuição proposta à Global Solution e ao
ODS 11. Não afirmamos melhoria de acessibilidade já demonstrada.”

## Referências para consulta e arguição

Os dois slides finais têm instituições, títulos e links clicáveis. A bibliografia
completa está em **referencias.md**, incluída no pacote offline. Links externos
exigem internet; o PDF, as cenas e a demonstração offline continuam independentes.
As páginas externas não puderam ser consultadas nesta revisão por bloqueio de
rede; não afirmar que seus conteúdos atuais ou a edição da GS foram confirmados.
O enunciado PDF fornecido é a fonte efetivamente conferida das exigências da aula.

## Demonstração visual de PDI (antes da webcam)

1. No estudo, abra **PDI visual**, selecione o cenário e a placa.
2. Mostre as AOIs e alterne para cinza: elas foram delimitadas pelo operador.
3. Mostre o recorte original, cinza e Laplaciano; não é detecção automática de placa.
4. Explique o histograma, P1/P99 e o contraste. Não é contraste WCAG.
5. Mostre intensidade média (0–255), área relativa e variância do Laplaciano.
   Ruído, textura e resolução também alteram o Laplaciano; não é prova de leitura.
6. Sem API, abra **pdi-visual.html** ou **HeatCity-PDI-visual.pdf** no pacote.
   Identifique a cena como sintética; os números são calculados sobre seus pixels.

## Demonstração ao vivo

Prepare antes do horário: execute Iniciar-HeatCity.cmd, crie/abra um estudo e salve
um cenário com suas AOIs. A cena de exemplo serve como cenário didático e deve ser
identificada dessa forma. Mantenha o diagnóstico completo original nos Downloads;
seus vetores oculares não estão neste pacote/repositório.

1. No estudo, clique **Ensaio exploratório**.
2. Informe código como **DEMO01**, cenário/tarefa e consentimento. Nenhum nome ou
   documento é necessário.
3. Em **Importar diagnóstico para demonstração**, selecione seu JSON completo com
   malha concluída. A autorização é temporária (10 min); importe próximo do ensaio.
4. Confirme que a tela informa calibração reprovada/importada e uso exploratório.
5. Clique **Continuar para o teste de 15 s** e **Iniciar sessão em tela cheia**.
6. Olhe para a cena. No resultado, mostre o bloco exploratório, cobertura, mapa
   de estimativas e downloads. A tabela oficial continua com N=0 para esse ensaio.
7. Exporte JSON e PDF para anexar ao trabalho, identificados como exploratórios.

Se não houver estimativas válidas, mostrar esse resultado e o diagnóstico; não
interpretar um mapa vazio como atenção. Não repetir longas calibrações durante a fala.

## Plano B (API, câmera ou rede falhou)

Abra **slides.pdf** e **evidencias-agregadas.json**. Explique as quatro tentativas
registradas: duas concluídas reprovadas, uma interrupção geométrica e uma falha de
comunicação. Mostre a arquitetura, o método e os limites. O PDF técnico
em docs/reports analisa as quatro tentativas reais com gráficos; resultados
oficiais de localização não foram obtidos com esses diagnósticos.

## Respostas curtas para a arguição

- **É eye tracking preciso?** “Ainda não. É uma estimativa experimental por webcam;
  medimos e expomos as falhas de cobertura e erro.”
- **Por que um modo exploratório?** “Para demonstrar a cadeia sem converter dados
  reprovados em resultados oficiais.”
- **Onde há PDI?** “Intensidade de cinza, contraste por percentis, variância do Laplaciano,
  suavização e visualização de densidade; as métricas descrevem a imagem.”
- **Criaram machine learning?** “Não treinamos modelos. Usamos MediaPipe pronto
  e interpolação geométrica; sem regressão ou classificador próprios.”
- **Por que não elevar o limite?** “Isso não recuperaria quadros sem previsão e
  não demonstraria que as placas foram localizadas.”
- **O que falta?** “Repetibilidade com referências conhecidas, pessoas/câmeras
  diferentes e estabilidade de postura e iluminação.”

## Antes de apresentar

- Abrir e conferir slides PDF/HTML offline.
- Atualizar a branch e verificar o CMD com antecedência.
- Deixar cenário e diagnóstico preparados; importar a malha perto da demonstração.
- Fechar aplicativos que usam a webcam; ligar o computador à energia.
- Separar responsabilidades de fala e arquivos que a instituição exige entregar.
