# Calibração por alvo móvel e geometria — 11/11/2026

## Escopo autorizado

O MediaPipe pronto continua detectando as íris. O projeto não treina nem ajusta
classificadores, regressores ou modelos não supervisionados. Foram removidos os
ajustes afim, quadrático e ridge, a seleção de hiperparâmetros e a validação cruzada.
A conferência instrumental de erro não é validação de um modelo de aprendizado.

O detector MediaPipe é previamente treinado por seus autores, conforme exceção
expressamente permitida pelo usuário. Não treinamos nem adaptamos esse detector.
O perfil de abertura dos olhos continua sendo uma referência individual por
percentil com regras fixas para piscadas; não classifica etnia.

## Alvo e cálculo

1. A entrada em tela cheia inicia a contagem de três segundos em fundo branco.
2. O alvo move-se suavemente por cinco linhas da tela (5%, 27,5%, 50%, 72,5% e
   95%), em zigue-zague. Há 25 referências, incluindo pontos intermediários entre
   o centro superior e os cantos. Cada movimento leva no mínimo um segundo; os
   trajetos longos levam aproximadamente 3 segundos por unidade de tela normalizada.
3. Ao chegar, o alvo aguarda o sistema obter uma janela recente estável. Não há
   confirmação por botão ou teclado. ESC ou Cancelar interrompe a coleta.
4. São necessários ao menos dez quadros válidos dos últimos 1,2 s, cobrindo ao
   menos 0,6 s (sem reaproveitamento, após 0,9 s da chegada), com o último quadro a no máximo 0,25 s.
   A dispersão P90 das duas posições oculares deve ser <= 0,035 e a diferença
   entre as medianas das duas metades <= 0,020, em coordenadas relativas dos olhos.
   O deslocamento da posição da cabeça entre as metades deve ser <= 0,005 nas
   coordenadas normalizadas da câmera. São regras fixas de coleta, não treinamento.
   Se faltarem dados ou houver instabilidade, permanece no alvo e tenta novamente
   com a janela móvel. O tempo decorrido não força avanço nem aceita dados antigos.
   Ao passar nos critérios, congela a referência e avança automaticamente. O
   diagnóstico registra accepted_by=automatic_stability, horário e medidas de
   estabilidade de cada referência.
5. As medianas das posições relativas médias das íris formam 32 triângulos. A
   interpolação baricêntrica continua geométrica, sem regressão, treino ou seleção
   de modelos. Cada aceite automático acrescenta uma referência medida; não há correção
   automática por assumir onde a pessoa olhou durante o tracking livre.
6. Treze alvos posteriores, também registrados automaticamente, conferem centro, quadrantes, meios
   das bordas e proximidade dos quatro cantos. Os dados só medem erro, sem alterar a
   malha. O limite 0,100 é exigido globalmente e em cada alvo. Assim, um canto ruim
   não é compensado por uma boa média no restante da tela. Quadros fora da malha
   reprovam a cobertura. RMSE considera somente previsões existentes.
7. Não há extrapolação fora da malha ocular. Regiões dobradas, cruzadas ou
   indistinguíveis são rejeitadas, em vez de devolver coordenadas arbitrárias.

A duração depende da qualidade e estabilidade da coleta. O avanço é automático,
mas não é uma corrida por temporizador. Não há tempo máximo de espera em um alvo;
é possível cancelar. Estabilidade não comprova que a pessoa olhou para o alvo:
a conferência de erro ao final continua necessária. Os pontos cegos ainda precisam
ser avaliados com webcam real. A cabeça deve permanecer confortável e estável.
O filtro de abertura e a recuperação temporal continuam funcionando.

A câmera permanece fora do campo durante coleta/tracking. ESC interrompe a coleta
ou volta da prévia para o diagnóstico. O diagnóstico completo sem cadastro continua
registrando coordenadas, configurações, rejeições e tracking, sem imagens.

## Aproveitamento em movimento e checagem antecipada

O detector registra coordenadas oculares válidas durante os deslocamentos, no
máximo a cada 50 ms. Cada amostra é associada à última posição desenhada do alvo
anterior ao instante de aquisição do frame, evitando usar uma posição posterior
quando a inferência demora. Não se presume um atraso ocular fixo nem se treina
um estimador de atraso.

Amostras dos últimos 1,2 s a até 0,025 de distância euclidiana normalizada da
referência podem iniciar a janela daquele ponto, quando há pelo menos três.
Esse reaproveitamento admite uma aproximação espacial explícita, não uma
correspondência exata entre alvo e olhar. Continua exigindo dez quadros, cobertura
de ao menos 0,6 s e estabilidade. Pode reduzir a parada para até cerca de 0,3 s
após a chegada, dependendo dos dados; não impõe um avanço mais rápido. Se não
houver amostras aproveitáveis, usa a coleta parada anterior. Somente referências
usam essa antecipação: as treze conferências permanecem coletadas separadamente,
sem reaproveitar o movimento, para detectar também o erro introduzido pela aproximação.

Após cada linha, /diagnostics/geometry confere as regiões já completas. O endpoint
é puro e não emite autorização. A triangulação testa ambas as diagonais de uma
região simples e usa uma divisão geometricamente válida, inclusive em casos
côncavos que a divisão anterior rejeitava. Cruzamentos e regiões degeneradas
continuam reprovados. Não há regressão ou aumento do limite de erro.

Quando há inconsistência, o sistema recolhe primeiro os pontos afetados da linha
nova, sem antecipação por movimento. Se necessário, recolhe os demais pontos da
região indicada. São no máximo duas rodadas de reparo por linha. Uma inconsistência
persistente interrompe a coleta antes das conferências finais, mostrando a linha
afetada. Não reinicia as outras referências nem inventa uma malha aprovada.

O diagnóstico v6 contém motion_capture (amostras em movimento e posições do alvo),
motion_samples_used por referência e geometry_checks com os índices dos pontos
afetados e as tentativas. Falhas/cancelamentos preservam registros parciais no
histórico temporário e em page_diagnostic.incomplete_calibration, com status,
mensagem e dados coletados. Registros incompletos não possuem um RMSE final e não
são comparáveis a calibrações concluídas. Recarregar/sair da página ainda apaga o
histórico local; baixe o diagnóstico completo antes disso.

Os testes de software verificam o reaproveitamento, a separação das conferências,
a detecção antecipada e a preservação da coleta parcial. Não comprovam redução
de tempo ou precisão em pessoas; é necessária uma nova medição com webcam real.

## Diagnóstico recebido e limites

O arquivo enviado contém três tentativas, todas reprovadas: RMSE 0,103804 (pontos
fixos), 0,134298 (trajetória anterior) e 0,130860 (protocolo anterior de precisão).
Há 1.193 registros de tracking, sem alvos conhecidos nessa fase. Por isso o arquivo
não permite medir o erro de olhar do centro nem provar uma deriva temporal real.
As médias por trecho também não podem ser comparadas como se o usuário olhasse
sempre para a mesma posição.

Os regressores anteriores tinham coeficientes grandes para geometria da cabeça,
capazes de amplificar variações pequenas. A suavização exponencial da prévia não
integra um deslocamento indefinidamente e não foi identificada como causa do relato.
A troca por geometria elimina esses coeficientes, mas não prova que o MediaPipe
mede movimentos oculares com precisão suficiente.

Uma reprojeção geométrica das referências antigas de pontos fixos também falha
na cobertura. Portanto os dados antigos não foram "corrigidos" nem usados para
aprovar o sistema. É necessária uma nova coleta com a varredura. Fora da região
ocular observada, o sistema passa a ocultar a previsão, não colá-la na borda.
Não há compensação aprendida de postura; mantenha posição confortável e estável.
Não prometer precisão humana a partir dos testes sintéticos.

Diagnósticos históricos continuam importáveis para comparação descritiva. Os
métodos antigos não estão mais disponíveis para executar ou reprocessar ajustes.
O script validate_diagnostics.py aceita somente os novos arquivos mode=sweep.
