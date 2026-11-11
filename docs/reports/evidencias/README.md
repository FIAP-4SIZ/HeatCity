# Evidências reais e reprodução

Fonte: diagnóstico completo enviado pelo usuário em 11/11/2026. Seu SHA-256 está
no JSON agregado. O original contém características oculares e não é versionado.
Não há nomes, vetores oculares ou frames faciais neste diretório.

## Regenerar sem o arquivo privado

Na raiz, com as dependências do projeto instaladas (Windows: use
`.venv\Scripts\python.exe` em lugar de `.venv/bin/python`):

```sh
.venv/bin/python scripts/analyze_calibration.py --aggregate docs/reports/evidencias/analise-calibracao.json
.venv/bin/python scripts/generate_report.py --analysis docs/reports/evidencias/analise-calibracao.json
```

Os gráficos são SVG e PDF vetoriais, produzidos com ReportLab já incluído nas
dependências. Não precisam de servidor, câmera, internet ou biblioteca adicional.
O notebook `notebooks/calibracao-real.ipynb` foi executado com Python; verifica as
contagens e reconstitui o RMSE por ponderação dos erros quadráticos dos alvos.

## Recalcular a partir da fonte privada

```sh
.venv/bin/python scripts/analyze_calibration.py --diagnostic "CAMINHO/heatcity-diagnostico-completo.json"
```

O script executa novamente a interpolação geométrica e confere RMSE, aprovação e
quadros sem previsão com os valores gravados. Divergências interrompem a execução.
Não é um cálculo independente da implementação original: verifica sua reprodução.
O notebook fornece uma segunda conferência aritmética do RMSE agregado por alvo.
As datas internas dos PDFs podem mudar ao regenerar; compare valores do JSON/CSV.

## Leitura dos resultados

- Quatro tentativas: 1 e 4 concluídas reprovadas; 2 interrompida por geometria;
  3 interrompida por comunicação. Não são quatro pessoas.
- RMSE euclidiano em coordenadas normalizadas por largura/altura, sem conversão
  para graus visuais. Apenas quadros previstos entram no denominador do RMSE.
- Tentativa 1: 75 previstos e 72 sem previsão de 147; RMSE 0,107122.
- Tentativa 4: 124 previstos e 38 sem previsão de 162; RMSE 0,121876.
- Menor ausência de previsão junto de maior RMSE não prova melhora geral.
- Alvos sem previsão não recebem erro zero. Quadros são temporalmente correlacionados.
- Os mapas por alvo mostram erro na conferência, não atenção, fixações ou leitura.
- Não há conclusão A/B, precisão comprovada de tracking livre ou dados oficiais
  de localização de placas. Não é possível quantificar FPS nesta fonte.

O relatório continua exigindo identificação/contribuições da equipe e eventuais
novas coletas antes de ser considerado entrega acadêmica final.
