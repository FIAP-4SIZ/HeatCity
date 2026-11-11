# Variação por alvo e separação das coordenadas oculares

A análise é descritiva e geométrica. Não treina modelo, não usa classificação ou
regressão, não escolhe automaticamente um olho e não muda o limite 0,100 ou a
aprovação da malha. Pode revelar perda de separação, sem comprovar sua causa.

## Medidas disponíveis

Para cada referência coletada, a aplicação calcula nos canais **olho 0**, **olho 1**
e **média dos dois olhos**:

- Centro descritivo: mediana usual de cada coordenada, com média dos dois valores
  centrais para N par. Não substitui a referência usada pela interpolação atual.
- Raio P90: percentil 90 das distâncias euclidianas ao centro desse alvo.
- Dispersão por eixo: P90 dos desvios absolutos em X e Y.
- Deslocamento: distância entre os centros das metades inicial e final da coleta.
- Separação entre dois alvos: distância de seus centros menos a soma dos raios P90.
  Valor não positivo marca sobreposição descritiva dos discos; não é classificação
  aprendida ou teste de significância.

A comparação inclui todos os pares de alvos diferentes disponíveis. Dois alvos
idênticos não contam como par distinto. São necessárias duas amostras por alvo.
Os eixos do gráfico representam características relativas ao olho, não posições
na tela, graus visuais ou pixels. Ambos usam a mesma escala; Y cresce para baixo.
A linha laranja mostra a mudança entre as duas metades da coleta.

Discos separados não provam acerto de gaze; sobreposição não prova impossibilidade
de rastreamento. P90 é empírico, não intervalo de confiança. Quadros próximos são
correlacionados. Não há compensação de postura ou mudança do cálculo de gaze.

## Movimento do alvo

Cada nova coleta armazena a ordem e o instante relativo dos quadros e informa se
o quadro foi aproveitado do movimento. A análise preserva todos os quadros usados
na calibração e mostra também a dispersão dos quadros marcados sem movimento.
Não são descartados quadros para produzir um resultado melhor. Arquivos antigos
sem marcações temporais não permitem reconstruir essa separação; exibem ausência
de informação em vez de zero. Só os quadros aceitos pelos filtros existentes são
analisados; o painel não descreve quadros rejeitados que não entraram na coleta.

## Usar na aplicação

1. Faça a calibração oficial ou o diagnóstico normalmente.
2. Ao concluir ou falhar, saia da tela cheia quando necessário e consulte
   **Variação e separação do sinal ocular**.
3. Alterne os três canais para investigar se a média dos olhos mantém a separação
   observada em cada olho. O sistema não muda de canal automaticamente.
4. Confira as referências de maior dispersão, deslocamento e os pares com menor
   margem de separação. São sinais para investigação, não diagnóstico clínico.
5. Em **Diagnósticos / DEV → Importar diagnósticos**, também é possível abrir
   arquivos parciais sem RMSE. Até 20 análises importadas aparecem na tela.

Reproduzir localmente, sem API ou câmera:

```sh
node frontend/scripts/analyze-signals.mjs caminho/heatcity-diagnostico-completo.json
```

O script usa a mesma função pura da interface. Sua saída contém estatísticas
oculares; mantenha os diagnósticos numéricos fora do repositório público.

## Arquivo mais recente fornecido em 11/11/2026

As três tentativas foram interrompidas antes da conferência final. Aplicando a
análise às amostras finais de cada referência, obtém-se:

| Tentativa | Referências disponíveis | Pares sobrepostos: média | Olho 0 | Olho 1 |
| --- | --- | --- | --- | --- |
| 1 | 20 | 28/190 | 27/190 | 28/190 |
| 2 | 10 | 4/45 | 5/45 | 4/45 |
| 3 | 10 | 4/45 | 4/45 | 4/45 |

Não comparar essas frações como melhora: as tentativas cobrem conjuntos diferentes
de alvos e condições. A presença de sobreposições em cada olho mostra que a média
binocular não é a única hipótese a investigar neste arquivo. Não há RMSE final
ou prova de precisão do tracking livre. Os vetores oculares originais não são
publicados nesta nota.

## Baixar todas as tentativas oficiais

No teste oficial, o botão **Baixar todas as calibrações deste teste (N)** aparece
após registrar uma tentativa, inclusive reprovada ou interrompida. O JSON contém
todas as tentativas daquela preparação, seus motivos, amostras por alvo, análise
de sinais e telemetria. Diferente do log DEV, esse histórico não descarta as
primeiras tentativas depois da quinta.

O botão permanece disponível ao voltar da calibração para a preparação. O histórico
é temporário e pertence àquela preparação; não é um arquivo global de todos os
estudos. Sair da etapa, concluir a sessão ou recarregar a página pode encerrá-lo.
Baixe antes de sair. Não há persistência desses vetores em localStorage nem banco.
O arquivo pode ser enviado para investigação; não libera a sessão nem contém
chave de aprovação. Nenhum vídeo ou frame de webcam é incluído.
