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
3. Ao chegar, o alvo fica parado por tempo indeterminado. Espaço ou Enter confirma
   sem tirar os olhos do alvo; um botão oferece alternativa. Pressionar antes de
   haver amostras suficientes não avança. Segurar uma tecla não confirma os próximos
   pontos. ESC ou Cancelar interrompe a coleta.
4. A referência usa somente quadros válidos dos últimos 1,2 s, pelo menos dez, com
   o último a no máximo 0,5 s. Exige ao menos 0,9 s após chegada; não reutiliza quadros
   do trajeto nem amostras antigas acumuladas durante uma espera longa. A confirmação
   congela esse conjunto e registra seu horário e meio de acionamento no diagnóstico.
5. As medianas das posições relativas médias das íris formam 32 triângulos. A
   interpolação baricêntrica continua geométrica, sem regressão, treino ou seleção
   de modelos. Cada confirmação acrescenta uma referência medida; não há correção
   automática por assumir onde a pessoa olhou durante o tracking livre.
6. Treze alvos posteriores, também confirmados, conferem centro, quadrantes, meios
   das bordas e proximidade dos quatro cantos. Os dados só medem erro, sem alterar a
   malha. O limite 0,100 é exigido globalmente e em cada alvo. Assim, um canto ruim
   não é compensado por uma boa média no restante da tela. Quadros fora da malha
   reprovam a cobertura. RMSE considera somente previsões existentes.
7. Não há extrapolação fora da malha ocular. Regiões dobradas, cruzadas ou
   indistinguíveis são rejeitadas, em vez de devolver coordenadas arbitrárias.

A duração depende das confirmações do participante. Não há avanço por temporizador
nem tempo máximo de espera em um alvo. Isso aumenta o controle e a cobertura, mas
não comprova que os pontos cegos foram resolvidos em pessoas. A nova varredura
precisa ser testada com a webcam real. A cabeça deve permanecer confortável e estável.
O filtro de abertura e a recuperação temporal continuam funcionando.

A câmera permanece fora do campo durante coleta/tracking. ESC interrompe a coleta
ou volta da prévia para o diagnóstico. O diagnóstico completo sem cadastro continua
registrando coordenadas, configurações, rejeições e tracking, sem imagens.

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
