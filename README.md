# HeatCity

Transformando olhares em cidades mais inteligentes.

Projeto acadêmico da Global Solution FIAP: avaliar a visibilidade de placas em
imagens de espaços públicos por estimativas de olhar, mapas de calor e indicadores.

## Estado atual

Etapa 1 do MVP: API FastAPI, calibração afim de nove pontos com validação
independente e cálculo de métricas temporais por área de interesse (AOI).
Ainda não há captura de webcam, interface, persistência ou heatmaps.
Os testes sintéticos validam cálculos; não demonstram precisão com pessoas.

## Execução

Requer Python 3.12. A partir da raiz do repositório:

```bash
python3 -m venv .venv
.venv/bin/python -m pip install -r backend/requirements.lock
cd backend
../.venv/bin/python -m unittest discover -s tests -v
../.venv/bin/python -m uvicorn heatcity.api:app --host 0.0.0.0 --port 8000
```

`GET /health` informa a saúde do serviço. `/docs` contém a documentação interativa.
`POST /calibrations/evaluate` recebe `features`, `targets`,
`validation_features` e `validation_targets`, todos listas de pares numéricos.
Os alvos de ajuste devem cobrir a grade formada por 0.1, 0.5 e 0.9 nos dois eixos;
a validação requer pelo menos cinco amostras coletadas em uma etapa separada.
O limite inicial de aprovação é RMSE euclidiano de 0.1 em coordenadas normalizadas.
É um parâmetro experimental a avaliar com dados reais.

`POST /analysis` recebe amostras temporais, AOIs e duração em segundos:

```json
{
  "samples": [
    {"time": 0, "x": 0.2, "y": 0.2, "valid": true},
    {"time": 0.1, "x": 0.2, "y": 0.2, "valid": true}
  ],
  "areas": [{"name": "recepcao", "x": 0, "y": 0, "width": 0.5, "height": 0.5}],
  "duration": 0.2
}
```

O resultado esperado inclui 0.2 segundo de atenção, primeira observação em zero
e um evento para a recepção. Uma amostra representa o intervalo até a próxima,
limitado a 0.2 segundo e ao fim da sessão. Intervalos restantes são desconhecidos.
Eventos são entradas consecutivas em uma AOI, não fixações oculares medidas.
AOIs sobrepostas são analisadas separadamente e podem contar o mesmo intervalo.
A API inicial não possui autenticação; execute somente em ambiente de desenvolvimento.

## Desenvolvimento e entregas

Veja [o plano do MVP](docs/plano-mvp.md). Use Git Flow: `main` para versões,
`develop` para integração e `feature/*` para etapas. Não incluir assinatura
ChatGPT/Codex nem trailer de coautoria automática nos commits.

## Referências

- Enunciado fornecido: Cognitive Computing, Computer Vision And IOT Systems,
  Global Solution 2026, professor Arnaldo Jr.
- [Laboratório MediaPipe](https://arnaldojr.github.io/cognitivecomputing/aulas/PDI/lab17/mediapipe.html)
- [Tema Citizen Tech](https://experience.fiap.com.br/global-solution-citizen-tech)

Os links são referências fornecidas para as próximas etapas; seu conteúdo ainda
precisa ser consultado. O relatório final deverá separar método, resultados
experimentais, limitações e evidências reproduzíveis.
