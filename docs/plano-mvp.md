# Plano do MVP

## Escopo e fontes

Nome do produto: HeatCity em todas as entregas. O PDF acadêmico define a entrega
e os critérios de avaliação. O texto de proposta define o escopo inicial do
produto; recomendações e tecnologias nele descritas orientam a implementação.
Requisitos adicionais encontrados em links devem ser confrontados com o escopo
antes de serem incorporados.

O experimento avalia imagens exibidas na tela, não ambientes físicos em 3D.
Participantes devem ser identificados por códigos e consentir antes da câmera.
Não persistir frames ou vídeos faciais por padrão.

## Etapas e critérios de aceite

1. **Fundação matemática e API (implementada):** ajuste de nove pontos,
   avaliação independente, rejeição de entradas inválidas e métricas por AOI.
   Testar transformação conhecida, erro de validação, perda de rastreamento,
   reentrada na AOI e tempos inválidos; executar requisições reais à API.
2. **Captura e calibração (implementada; validação humana pendente):** React
   captura webcam e MediaPipe processa localmente via WASM, sem enviar frames.
   Modelos distribuídos pelo pacote npm fixado e lockfile. Nove pontos de ajuste,
   cinco de validação, feedback, consentimento e repetição. Prévia liberada por
   autorização temporária da API; invalidação por resize, câmera desligada,
   troca de aba ou expiração. Testes sintéticos de interface e detector real sem
   rosto passaram; precisão com webcam real ainda precisa ser medida.
3. **Estudos e sessões:** FastAPI/PostgreSQL, migrações, estudos, imagens,
   AOIs, participantes por código, consentimento e sessão vinculada à calibração.
   Restrição de acesso e exclusão de registros antes de dados reais compartilhados.
   Salvar metadados e coordenadas; nunca aceitar aprovação fornecida pelo cliente.
4. **Análise visual:** heatmaps individuais e consolidados, filtro de sessões
   insuficientes, taxas por participante válido e dashboard React/Recharts.
   Escolher e documentar limite mínimo de cobertura antes da coleta experimental.
   Diferenciar ausência de observação de rastreamento indisponível.
5. **Experimento e entrega:** comparar cenários A/B com tarefas equivalentes,
   contrabalançar ordem e avaliar inicialmente 10–15 participantes voluntários.
   Gerar gráficos e métricas a partir dos dados reais, scripts/notebooks de
   reprodução e relatório PDF com contexto, métodos, análise e limitações.
   Preparar demonstração prática e documentação para arguição individual.

## Decisões técnicas iniciais

- A webcam pertence ao computador do participante. OpenCV no servidor não acessa
  automaticamente esse dispositivo. A captura e detecção ficam no navegador;
  esta decisão substitui o envio de frames e reduz exposição de imagens faciais.
- Olhar estimado por webcam é aproximação. Movimentos da cabeça, iluminação,
  óculos, resolução e distância podem reduzir a qualidade. Falha de detecção
  deve produzir amostra inválida, nunca coordenada fictícia.
- Coordenadas da imagem serão normalizadas em [0, 1]. O frontend deve remover
  margens da imagem e considerar escala/espelhamento antes de registrar amostras.
- Validação separada evita aprovar a calibração pelo próprio erro de treinamento.
  A interface coleta a posição relativa das íris, agregando por mediana em cada
  alvo. A acurácia desse método ainda depende de validação experimental humana.
- O endpoint de análise atual é stateless e serve ao desenvolvimento dos cálculos.
  A rota de prévia exige consentimento e aprovação em memória. A futura rota de
  sessão deverá associar estudo, participante e autorização persistida.
- Dados sintéticos devem ser identificados como tais e excluídos de conclusões
  sobre desempenho com participantes.

## Fluxo Git

O checkout inicial veio na branch local `work`. `develop` foi criada nesse mesmo
commit, seguida de `feature/calibration-analysis-foundation`. Não houve alteração
de `main` remoto, push ou publicação. Integrar features em `develop`, preparar
`release/*` e promover versões para `main` após validação. Não adicionar assinaturas
automáticas de ferramentas aos commits.
