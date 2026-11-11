# Protocolo de validação humana

## Antes de convidar participantes

1. Definir ambiente, tarefa, placas e hipótese A/B antes de olhar os resultados.
2. Usar cenas equivalentes em resolução, tamanho, conteúdo e tarefa; alterar
   somente o posicionamento que se deseja comparar. Registrar essas escolhas.
3. Testar primeiro a qualidade da webcam com voluntários. Registrar tentativas
   reprovadas e RMSE; não elevar o limite apenas para aprovar.
4. Delimitar áreas sem sobreposição. A dimensão deve comportar o erro observado.
5. Congelar os cenários. Se algo mudar, cadastrar novo cenário e explicar a mudança.

## Coleta

- Obter consentimento informado. Explicar finalidade, coordenadas armazenadas,
  ausência de vídeo/fotos faciais e possibilidade de excluir registros.
- Códigos como P01, P02; a tabela que relaciona pessoas a códigos, se existir,
  deve ficar sob responsabilidade da equipe, fora do repositório e da aplicação.
- Mesmo computador/câmera, zoom do navegador, resolução, distância confortável e
  iluminação frontal. Registrar óculos, reflexos e fatores de falha sem inferir
  características sensíveis por aparência.
- Calibrar individualmente em tela cheia. Ajuste e validação separados. Uma nova
  calibração é exigida ao alterar participante, cenário ou tamanho de tela.
- Executar tarefa de 15 segundos sem clique. ESC interrompe; não concluir uma
  sessão se o participante pedir para parar.
- Para comparação A/B, metade faz A→B e metade B→A. Use códigos iguais para
  pareamento e registre a ordem no protocolo externo da equipe.
- Piloto recomendado: 10–15 participantes voluntários. Esse tamanho não garante
  poder estatístico nem generalização; declarar o caráter exploratório.

## Análise e interpretação

1. Exportar JSON e PDF e guardar a versão do código/configuração utilizada.
2. Informar tentativas, exclusões e motivos, RMSE, cobertura e denominadores.
3. Comparar a mesma tarefa por cenário. Tempo até observar considera sucessos;
   reportar a taxa e não somente o tempo dos casos que deram certo.
4. A aplicação usa a última sessão elegível por código/grupo. Se outro plano de
   análise for necessário, declará-lo antes e usar o JSON completo para reprodução.
5. Heatmaps usam amostras válidas, não fixações. Mapas normalizados por imagem não
   sustentam comparação de intensidade absoluta.
6. Valores de contraste e Laplaciano descrevem a imagem; não são notas de
   legibilidade nem prova de atendimento a normas de acessibilidade.
7. Se todos falharem na calibração, esse é um resultado de inviabilidade do
   estimador nas condições usadas. Não inventar dados, não remover limites e não
   chamar o protótipo de validado. Comparar outro estimador/equipamento em estudo
   separado, com o mesmo protocolo, ou relatar a limitação no trabalho.

## Relatório e apresentação

Incluir contexto, objetivos, arquitetura, técnicas de PDI/visão, calibração,
critérios declarados, método de coleta, métricas reproduzíveis, resultados reais,
falhas, limitações, conclusões e referências. Anexar gráficos/heatmaps com n,
tarefa, cenário, escala e exclusões. Cada integrante deve conseguir explicar o
caminho do frame local até a métrica e por que um dado pode ser inconclusivo.
