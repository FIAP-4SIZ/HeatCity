# Máquina da apresentação: prática DEV, geometria e limites

## Como aproveitar o arquivo enviado

1. Atualize `develop` e execute Iniciar-HeatCity.cmd.
2. Abra **Diagnósticos / DEV**, a seção existente; não é necessário cadastrar estudo.
3. Importe `heatcity-calibracoes-teste-oficial.json`.
4. Clique **Usar última malha do arquivo na prévia DEV**. A API recalcula a geometria,
   mesmo reprovada, sem emitir autorização oficial. A postura atual não é reconferida.
5. Ative a câmera após consentir e marque **Referência com mouse para prática e diagnóstico**.
6. Abra **Mostrar tracking experimental**. Azul = ponto indicado com mouse;
   verde = estimativa calculada pelos olhos. Se a malha não der previsão, não há ponto verde.
7. Acompanhe o cursor com os olhos e mantenha-o parado por pelo menos 0,6 s para
   registrar comparações. O mouse é referência autodeclarada, não medição independente
   de onde a pessoa realmente olhou. A distância é em eixos normalizados da tela.
8. Use **Sair da prévia** ou ESC e baixe o diagnóstico completo da página. O arquivo
   separa `mouse_reference`, `reference_source`, distância à referência e previsão ocular.
   Não são criadas observações oficiais ou correspondências para ajustar a malha.

Também é possível abrir a prévia **antes de calibrar**. Nesse caso, são mostrados
landmarks na câmera e sinais dos olhos, sem inventar posição na tela. Para estimar
posição, é necessária uma malha. A prática exercita o usuário; não treina modelos,
não altera os pontos calibrados nem transforma coordenadas do mouse em gaze.

## Melhorias técnicas desta revisão

- **Geometria em pixels (`pixel_v2`)**: antes de calcular distâncias e projeções,
  converte Y para a mesma unidade de X usando a proporção largura/altura da câmera.
  A abertura das pálpebras utiliza a mesma geometria, na calibração e na sessão.
  Corrige distorção matemática de imagens retangulares, especialmente com olhos
  inclinados. Não comprova, por si só, ganho de precisão humana.
- **Compatibilidade explícita**: malhas antigas importadas usam `legacy_v1`;
  seus vetores não são reinterpretados como `pixel_v2`. Uma nova calibração usa
  o novo modo e o grava no diagnóstico e na sessão.
- **Mais evidência com o alvo parado**: cada referência exige pelo menos oito
  quadros parados ao longo de 400 ms e 600 ms após a chegada, além dos critérios
  anteriores de frescor/estabilidade. Dados próximos durante o movimento continuam
  registrados e aproveitados, mas não podem substituir essa confirmação estacionária.
- **Cantos externos sem limite individual**: os quatro alvos com ambos os eixos
  extremos (≤0,1 ou ≥0,9) permanecem medidos, mas não precisam individualmente de
  RMSE ≤0,100. Seus erros previstos continuam no RMSE global e na margem de erro.
  Centro, quadrantes, meios das bordas, RMSE global/medianas ≤0,100 e cobertura da
  malha continuam exigidos. Dados sem previsão ainda bloqueiam aprovação; não há
  extrapolação. A política `global_and_noncorner_v2` fica no resultado.

Para tentar uma nova calibração, mantenha resolução/zoom e tela cheia, sente-se com
apoio confortável e evite acompanhar o alvo com toda a cabeça. Pisque naturalmente.
Uma postura reproduzível ajuda; não é compensação aprendida de cabeça.

## O que os cinco registros enviados mostram

| Tentativa | Situação | RMSE por quadro previsto | Sem previsão |
| --- | --- | --- | --- |
| 1 | Interrompida com 10 referências | Indisponível | Conferência não iniciada |
| 2 | Reprovada | 0,1736 | 40/135 |
| 3 | Reprovada | 0,2335 | 36/138 |
| 4 | Reprovada | 0,1577 | 29/140 |
| 5 | Reprovada | 0,1181 | 43/148 |

Na última, RMSE das referências medianas foi 0,0751, mas isso não substitui o erro
por quadro, a cobertura ou a conferência regional. A câmera negociou 1280×720 a
30 FPS; as médias registradas do processamento ficaram em aproximadamente 21–24
FPS. A telemetria é acumulada desde o início da captura, não taxa isolada por tentativa.

Retirar retrospectivamente os quadros em movimento não melhorou consistentemente
o arquivo. Aplicar mediana temporal de três quadros também não recuperou aprovação
e chegou a invalidar uma malha; esses procedimentos não foram adotados como correção.
A nova aquisição deve ser testada na máquina real. Não há garantia de aprovação na
primeira tentativa, nem evidência de que o arquivo antigo passou pelos novos ajustes.
A retirada do limite individual dos cantos não elimina as demais falhas desse arquivo.

## Atualização: prática por placas

A seção DEV permite selecionar um cenário cadastrado, visualizar as AOIs e gerar
um mapa exploratório após sair da prévia. O indicador agora separa erro bruto e
erro do ponto verde. Há checagens centrais de dois segundos e oscilação recente,
sem ajustar a malha. Consulte [o roteiro curto](roteiro-curto-mapa-placas.md).
