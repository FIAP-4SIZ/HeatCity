# Roteiro de apresentação — HeatCity

Abra slides.html no Chrome/Edge. Setas avançam; use Tela cheia. slides.pdf é a cópia
para compartilhar/contingência. Não depende da API nem da internet.

## Fala sugerida (6–8 minutos)

1. **Objetivo (40 s):** “O HeatCity investiga uma cadeia de visão computacional
   aplicada à sinalização, desde a descrição da imagem até estimativas experimentais
   de olhar. Esta é uma entrega de MVP exploratório.”
2. **Problema e arquitetura (1 min):** mostrar cena/AOIs, PDI, detector pronto,
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
comunicação. Mostre a arquitetura, o método e os limites. O PDF técnico provisório
em docs/reports descreve o software; resultados humanos oficiais não foram obtidos
com esses diagnósticos.

## Respostas curtas para a arguição

- **É eye tracking preciso?** “Ainda não. É uma estimativa experimental por webcam;
  medimos e expomos as falhas de cobertura e erro.”
- **Por que um modo exploratório?** “Para demonstrar a cadeia sem converter dados
  reprovados em resultados oficiais.”
- **Onde há PDI?** “Luminância, contraste por percentis, nitidez pelo Laplaciano,
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
