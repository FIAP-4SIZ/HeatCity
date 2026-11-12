# HeatCity — roteiro de apresentação

Abra `slides.pptx` no PowerPoint e preencha os quatro campos de nome completo e RM (seis dígitos) da capa. Apresentação de aproximadamente 5–7 minutos, incluindo demonstração.

## Slide 1 — HeatCity — placas em vídeo

O HeatCity procura placas previamente cadastradas em vídeo ou webcam. Ele mostra onde aparecem, por quanto tempo são detectadas e quais dificuldades merecem investigação.

## Slide 2 — Problema: encontrar a Recepção

Imagine chegar a um hospital e não encontrar a Recepção antes de escolher o corredor. Queremos apoiar a revisão dessa sinalização. A relação com CitizenTech é a orientação do cidadão; o benefício ainda precisa ser testado.

## Slide 3 — Escopo: referências conhecidas

Cadastramos uma foto e delimitamos cada placa. O programa procura essas referências, sem reconhecer texto ou treinar um modelo. As anotações de posição são usadas depois, apenas para conferir o acerto.

## Slide 4 — PDI e visão computacional

Aqui vemos o processamento digital de imagens: recorte, cinza, Laplaciano e histograma. A busca compara cada recorte em sete tamanhos. Similaridade e margens mínimas evitam aceitar qualquer região parecida.

## Slide 5 — Cenário, recortes e posição

São quatro placas da mesma foto. Os retângulos mostram as posições encontradas no primeiro quadro. A imagem foi gerada por IA e o vídeo é sintético; não é uma gravação de um hospital real.

## Slide 6 — Por quanto tempo foi detectada?

O tempo acumula apenas entre detecções consecutivas. Uma falha interrompe a contagem. Recepção teve 5,5 segundos e as demais, 8 segundos. É uma estimativa amostrada, não tempo de leitura.

## Slide 7 — Resultado conferido do exemplo

O relatório reproduziu o esperado: 66 acertos, 0 falsos positivos, 24 perdas e 6 ausências corretas. Precisão foi 100,0%, mas recall foi 73,3%: o sistema deixou passar placas presentes.

## Slide 8 — Onde o detector acertou e falhou

O gráfico separa os quatro trechos. Nitidez e deslocamento tiveram todas as placas recuperadas. O desfoque provocou as 24 perdas. No final, não encontrar a Recepção removida foi a resposta correta.

## Slide 9 — Análise final por placa

Recepção apareceu em 12 dos 24 quadros; as outras, em 18. Isso inclui seis ausências reais da Recepção. Acerto exige identidade correta e sobreposição suficiente entre a caixa encontrada e a anotada.

## Slide 10 — Dúvidas e sugestões de local

O desfoque é conhecido porque o aplicamos no vídeo. Em uma captura real, similaridade baixa não revela sozinha a causa. Posição frontal, tamanho e iluminação são melhorias a testar, não conclusões comprovadas.

## Slide 11 — Demonstração e próxima evidência

Vou abrir o exemplo, aguardar o relatório e mostrar as exportações. Para outro ambiente, cadastramos uma foto e usamos um vídeo das mesmas placas. A próxima evidência é testar uma captura real anotada.

## Slide 12 — Fontes e referências

Usamos OpenCV e conteúdos das aulas de PDI e template matching. Código, fontes, vídeo e notebook estão no material. O exemplo funciona de forma reproduzível; ainda faltam avaliação em campo e benefício demonstrado aos cidadãos.

## Plano B

Se a demonstração não abrir, mostrar o PPTX e o relatório técnico incluído no pacote. Informar que são resultados do exemplo sintético.

## Explicação do programa e dos termos

O QUE O HEATCITY FAZ

O programa procura placas conhecidas em um vídeo ou na webcam.
Por exemplo: procura a placa Recepção e registra onde ela aparece.
No final, mostra as detecções, as falhas e o tempo estimado de detecção.

COMO FUNCIONA, PASSO A PASSO

1. Mostramos ao programa qual placa procurar.
Cadastramos uma foto e desenhamos um retângulo em volta da placa.
Esse retângulo é uma ROI (região de interesse).
O recorte da placa é o template (imagem usada como referência na busca).
Não há treinamento de um modelo: o recorte é comparado diretamente com o vídeo.

2. O programa examina imagens do vídeo.
Cada imagem é um frame (quadro do vídeo).
O programa reduz seu tamanho e transforma as cores em tons de cinza.
Isso faz parte do PDI (processamento digital de imagens).
Usamos OpenCV (biblioteca que fornece funções para trabalhar com imagens).

3. O programa procura regiões parecidas com o recorte.
Essa técnica se chama template matching (busca por semelhança com uma imagem de referência).
A busca usa sete tamanhos do recorte. Isso é multiescala (comparação em tamanhos diferentes).
Essa é uma adaptação do HeatCity à busca por template. Ela permite procurar a placa maior ou menor que na referência, dentro dos tamanhos pesquisados.

4. O programa decide se encontrou a placa.
Cada região recebe um score (valor de correspondência).
Usamos o método TM_CCOEFF_NORMED do OpenCV: correlação normalizada (comparação dos padrões de claro e escuro, descontando a média de intensidade).
O resultado precisa passar por limiares (limites mínimos de aceitação).
Também verificamos a margem (diferença entre a melhor opção e outra opção parecida).
Esse é um critério adicional do HeatCity para evitar confirmações duvidosas.
Se houver dúvida, o programa pode deixar de confirmar a detecção.
Importante: score de 0,8 não significa 80% de chance de acerto.

5. O programa registra posição e tempo.
Uma bounding box (retângulo de localização) marca a placa encontrada.
O acompanhamento temporal (registro da mesma placa ao longo dos quadros) permite estimar o tempo detectado.
Aqui repetimos a detecção e reunimos os resultados pelo nome da placa. Não calculamos seu movimento nem prevemos sua posição entre quadros.
Somamos o intervalo entre duas detecções consecutivas, se ele for de até 1,5 segundo.
Uma falha interrompe a contagem. Um quadro isolado soma zero segundo.
Esse tempo não informa quanto tempo uma pessoa leu ou olhou para a placa.

COMO SABEMOS SE ACERTOU?

Precisamos de ground truth (resposta conhecida usada para conferir o resultado).
No exemplo sintético, sabemos onde cada placa deveria estar e quando foi removida.
Essa informação serve para conferir a resposta; não corrige a busca do programa.

A IoU (medida de sobreposição entre dois retângulos) compara a posição encontrada com a posição conhecida.
Ela vale 1 quando os retângulos coincidem e 0 quando não se sobrepõem.
Para contar um acerto, exigimos a placa correta, detecção aceita e IoU de pelo menos 0,5.

As contagens são:
- TP (acerto): encontrou a placa correta no lugar correto.
- FP (falso positivo): confirmou uma detecção incorreta.
- FN (perda): a placa estava presente, mas não foi localizada corretamente.
- TN (ausência correta): a placa não estava presente e não foi detectada.
Uma posição errada aceita pode contar como FP e FN ao mesmo tempo.

Precisão (proporção de acertos entre as detecções confirmadas):
No exemplo, as 66 detecções confirmadas estavam corretas. Por isso, a precisão foi 100%.

Recall (proporção de placas presentes que foram recuperadas):
Havia 90 presenças de placas nos quadros. O programa recuperou 66 e perdeu 24.
Por isso, o recall foi 73,3%. As seis ausências corretas ficam fora dessa conta.
Sem respostas conhecidas para comparação, não podemos medir essas taxas.

O QUE MOSTRAM AS IMAGENS DE PDI?

- Histograma (gráfico da quantidade de pixels claros e escuros): mostra como a iluminação está distribuída na imagem.
- Contraste da região da placa (diferença entre intensidades claras e escuras): ajuda a descrever a separação visual dos detalhes.
- Laplaciano (filtro que destaca mudanças de intensidade): evidencia contornos e detalhes.
- Convolução (cálculo que aplica uma pequena máscara sobre pixels vizinhos): é a base desse tipo de filtro.
- Variância do Laplaciano (quanto a resposta desse filtro varia): medida adicional do HeatCity para indicar perda de detalhes em comparação com a referência.
Essas medidas fornecem indícios. Sozinhas, não provam que uma pessoa consegue ler a placa.

O QUE O EXEMPLO COMPROVA?

O vídeo sintético tem quatro placas em 24 quadros analisados: são 96 anotações de presença ou ausência.
O programa refaz a busca no arquivo de vídeo; não copia respostas prontas.
O resultado confirma o funcionamento nesse exemplo controlado.
Ainda precisamos testar vídeos reais e verificar com pessoas se as mudanças na sinalização ajudam.
As sugestões de posição são possibilidades para testar, não garantias de um local ideal.

## Reprodução dos slides

Instale as dependências do backend e `scripts/requirements-presentation.txt`. Na raiz, execute `.venv/bin/python scripts/build_sign_presentation.py`; no Windows, use `.venv\Scripts\python.exe`. Para regenerar o vídeo, use `scripts/build_sign_video_demo.py`, com PYTHONPATH=backend e ffmpeg disponível. O MP4 já está incluído.
