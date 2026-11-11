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
2. O alvo move-se suavemente por três linhas da tela, a 5%, 50% e 95% de altura,
   cobrindo nove referências no centro, meios das bordas e cantos. Desacelera e
   permanece brevemente nas referências para coletar ao menos dez quadros válidos.
3. Passagens diagonais atravessam a área central. Os quadros em deslocamento não
   são usados como referências, evitando confundir atraso ocular com posição.
4. A referência ocular é a mediana da posição relativa média das duas íris. As
   nove correspondências medidas formam oito triângulos. A posição entre três
   referências é calculada por coordenadas baricêntricas, sem minimizar uma perda,
   calcular pesos de regressão ou selecionar modelos.
5. Cinco alvos posteriores (centro e quatro quadrantes) medem o erro, por quadro
   e pelas medianas. Esses dados não alteram as referências geométricas. O limite
   0,100 permanece. Um quadro sem previsão na malha reprova a cobertura; RMSE
   considera apenas previsões existentes e fica indisponível se não houver nenhuma.
6. Não há extrapolação fora da malha ocular. Regiões dobradas, cruzadas ou
   indistinguíveis são rejeitadas, em vez de devolver coordenadas arbitrárias.

Duração nominal de cerca de 35 segundos, ampliada somente se faltarem amostras
válidas. Piscadas pausam a coleta; não exigem manter olhos forçadamente abertos.
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
