# Margem de erro e captura da webcam — 11/11/2026

## Diagnóstico recebido

A coleta enviada completou a malha de 25 referências, com cinco checagens válidas
sem reparo. A percepção de melhora no tracking livre não pode ser quantificada sem
alvos conhecidos nessa fase. Na conferência posterior foram 165 quadros, dos quais
39 não tiveram previsão na malha. O RMSE dos 126 com previsão foi 0,161139 (medianas:
0,148010); o eixo vertical teve RMSE 0,140189 e o horizontal 0,079452. O maior RMSE
por alvo foi 0,250630. A reprovação continua correta e não foi convertida em uma
autorização para estudo oficial.

O arquivo anterior não registrava a taxa negociada da câmera nem identificava
quadros decodificados. O contador de execuções podia contar novamente a mesma
imagem. Sua variação não permite reconstruir o FPS real da câmera.

## Captura

A inicialização solicita 3840×2160 a 120 FPS como preferência. Depois consulta
getCapabilities e solicita os maiores valores informados de largura, altura e
frameRate, inclusive acima desse perfil inicial. Autofoco, exposição e balanço de
branco contínuos são solicitados quando suportados. Todas essas solicitações são
preferências: limites máximos de capacidades podem não existir simultaneamente
em um mesmo formato, e o navegador/driver pode negociar valores menores.

O diagnóstico distingue initial_request, requested, settings e capabilities.
A resolução e a taxa de settings são as negociadas, não uma garantia de entrega
nem de inferência nessa velocidade. Processed FPS é medido sobre quadros únicos
processados, em janela de dois segundos, com média e percentis de latência e de
intervalo. A linha temporal do diagnóstico registra FPS processado e taxa negociada.
requestVideoFrameCallback é usado quando disponível; no fallback, currentTime
impede reprocessar o mesmo instante do vídeo. A próxima inferência só é agendada
depois da anterior. Contadores ficam congelados quando a captura para.

O estudo reutiliza a câmera e a resolução da calibração. Uma mudança de resolução
exige recalibrar. Device ID fica apenas na memória para reabrir o mesmo dispositivo;
não é enviado à API nem incluído nos metadados exportados. Hardware real pode
entregar menos quadros sob pouca luz, alta resolução ou carga de CPU. A captura
mais alta não comprova maior precisão; use os valores reais para comparar.

## Margem no estudo oficial

A calibração calcula P90 do erro absoluto de cada eixo em cada alvo conhecido.
A margem em X e Y é o maior P90 daquele eixo entre os alvos. Isso é uma margem
empírica observada, sem garantia de conter o olhar verdadeiro e sem representar
um intervalo estatístico de confiança. Quadros sem previsão continuam reprovando
a calibração; não são escondidos por uma margem maior.

A margem era aplicada diretamente às coordenadas normalizadas da imagem, apesar
de ter sido medida na tela. Agora a conversão é:

- margem_imagem_X = margem_tela_X × largura_tela / largura_imagem_exibida;
- margem_imagem_Y = margem_tela_Y × altura_tela / altura_imagem_exibida.

As dimensões são medidas depois da contagem inicial, quando a imagem já está
exibida. O servidor verifica a geometria, guarda os valores e rejeita placas sem
área conclusiva depois do recuo X/Y. A margem, configurações da câmera e política
observed_envelope_v1 ficam gravadas na sessão; as estatísticas de processamento
são salvas ao finalizar. Sessões históricas sem essa política preservam seu método.

A área de incerteza do ponto precisa caber inteiramente na placa para uma observação
conclusiva. Há pelo menos três amostras, duração contínua >= 0,2 s e intervalo entre
elas <= 0,2 s. Um ponto isolado de ruído não confirma localização. A primeira
observação é o começo da sequência posteriormente confirmada; não é tempo de clique.
Atenção estimada é calculada apenas nas sequências confirmadas, sem chamá-las de fixações.

Se houver permanência só na faixa ambígua, sem observação conclusiva, a sessão é
inconclusiva e sai das taxas. Tentativas elegíveis sem observação confirmada e sem
permanência ambígua continuam no denominador. Também permanecem os critérios de
cobertura temporal >= 60% e ao menos 30 pontos válidos. Pelo menos 60% dos
intervalos adjacentes precisam ter ambos os pontos válidos e intervalo <= 0,2 s;
uma aquisição lenta/irregular não vira falsa ausência de observação. Casos inconclusivos,
contagens ambíguas, margem na imagem e FPS ficam disponíveis em resultados, JSON e
PDF. A margem não desloca o cursor nem transforma uma aproximação na placa em acerto.

Não há regressão, classificação aprendida, ajuste supervisionado/não supervisionado
ou validação cruzada. Os cálculos são geometria, percentis descritivos e regras
fixas. O detector MediaPipe pronto continua sendo a exceção autorizada.

## Conferências de software

Os testes cobrem escala tela/imagem, bordas ambíguas, ruído isolado, duração mínima,
câmera vinculada, negociação acima de 1080p/60 e ausência de IDs nos metadados.
O navegador verifica calibração, sessão, exportações e processamento de quadros
únicos. Os testes de fluxo usam vídeo sintético com limites de hardware simulados
em 1280×720/30 para controlar o custo de CPU; o código de produção consulta a câmera
real. Isso não é evidência de precisão ocular em participantes.
