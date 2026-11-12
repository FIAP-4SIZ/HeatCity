# Roteiro curto: mapa de calor e estimativas por placa

O objetivo do MVP é investigar regiões e placas, não precisão milimétrica. Essa
versão facilita mostrar a cadeia funcionando e reconhecer quando o estimador não
separa placas. A existência do mapa não comprova que a pessoa olhou corretamente.

## Demonstração em aproximadamente 90 segundos

1. Atualize `develop`, inicie pelo CMD e abra **Diagnósticos / DEV**.
2. Em **Prática por placa**, selecione o estudo hospitalar normal e um cenário.
3. Importe seu diagnóstico e use a última malha na prévia DEV. A câmera deve usar
   o detector compatível com o arquivo; a postura atual não foi reconferida.
4. Ative a câmera e a referência pelo mouse. Abra o tracking experimental.
5. Indique com o mouse a placa para a qual está olhando e mantenha a referência
   parada. Compare o ponto verde, a placa geométrica estimada e a lista de AOIs
   alcançadas pela margem. Havendo mais de uma candidata, mostre como ambíguo.
6. **Checar centro por 2 s** fixa uma referência central e registra a média das
   estimativas. Olhe para ela; ao terminar, use **Liberar mouse**. Repita ao fim
   da prática para investigar deslocamento entre leituras. Nenhuma correção é aplicada.
7. Saia da prévia e clique **Gerar mapa exploratório desta prática**. Baixe o PNG
   e o diagnóstico completo para documentar resultados e falhas.

Fala sugerida: “Este mapa mostra a concentração de coordenadas estimadas. As AOIs
identificam placas geometricamente. Quando a incerteza abrange mais de uma placa,
o resultado permanece ambíguo. O protótipo ainda exige melhorar repetibilidade.”

## Como ler os novos indicadores

- **Erro bruto** usa `raw_prediction`; **ponto verde** usa `filtered_prediction`.
  Ambos são distâncias à referência declarada, não erro medido por um eye tracker externo.
  O campo histórico `mean_distance` continua representando a estimativa bruta.
- **Oscilação recente** é a dispersão das previsões verdes ao redor da própria
  média numa janela de até dois segundos. Não é precisão nem correção do viés.
- Movimento lento acumulado do cursor agora reinicia a espera de 0,6 s ao sair
  da tolerância em relação à âncora, em vez de comparar apenas eventos consecutivos.
- **Sem previsão** não conta como erro zero ou ausência de olhar.
- Checagens centrais precisam de ao menos seis previsões válidas; caso contrário,
  ficam como insuficientes. A diferença entre leituras não identifica sua causa.
- O mapa usa as últimas 5.000 estimativas verdes válidas dentro da imagem, sem
  coordenadas do mouse. Há suavização visual de 8% da largura; isso não melhora a
  precisão dos dados nem constitui intervalo de confiança. Não extrapola pontos
  fora da imagem para suas bordas.
- Trocar de cenário limpa a prática para evitar misturar imagens. Baixe antes
  de trocar, recarregar a página ou sair. **Reiniciar medidas da prática** limpa
  também o mapa acumulado.

## Separação do estudo oficial

A prática não persiste sessões, não emite aprovação, não treina modelos e não
altera a malha. O teste oficial mantém critérios e margens. Uma placa pontualmente
estimada não é uma observação oficial confirmada. Se o rastreamento não permitir
separar as placas na máquina real, apresente a limitação e os resultados exploratórios.

Os arquivos numéricos podem conter características oculares; não são adicionados
como dados públicos. Os testes de software usam detector sintético e não substituem
uma tentativa humana na máquina da apresentação.
