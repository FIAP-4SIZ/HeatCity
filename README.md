# HeatCity

Transformando olhares em cidades mais inteligentes.

Projeto acadêmico da Global Solution FIAP: avaliar a visibilidade de placas em
imagens de espaços públicos por estimativas de olhar, mapas de calor e indicadores.

## Estado atual

Etapas 1–2 do MVP: API FastAPI, interface React com webcam e MediaPipe,
calibração afim de nove pontos com validação independente e cálculo de métricas
temporais por área de interesse (AOI). Há prévia experimental do olhar;
ainda não há estudos persistidos, sessões de pesquisa, banco ou heatmaps.
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

### Interface e webcam

Requer Node.js 22.12+ (validado com 24.22.1). Com a API na porta 8000, abra outro terminal:

```bash
cd frontend
npm ci
npm run dev
```

Use o endereço local exibido pelo Vite ao executar no seu computador. Para câmera
em acesso remoto é necessário HTTPS e permissão do navegador; o ambiente de
onboarding não fornece preview web. `npm run build` valida a compilação; para
servir esse build em produção será necessário configurar o encaminhamento de
`/api` à API (o proxy do Vite funciona somente em desenvolvimento).

1. Leia e marque o consentimento; ative a câmera e enquadre um único rosto.
2. Inicie a calibração. Olhe para cada ponto sem mover a cabeça: nove pontos de
   ajuste e cinco de validação, em torno de 2.2 segundos cada. Amostras sem olhos
   detectados são descartadas. Poucas amostras interrompem a tentativa.
3. A API aprova pelo erro independente. Se reprovada, repita. Se aprovada, inicie
   a prévia do olhar. Ela não registra uma sessão nem salva dados de pesquisa.
4. Redimensionar a janela, trocar de aba, desligar a câmera ou retirar o
   consentimento invalida a calibração. A autorização também expira em dez minutos.

O MediaPipe Face Mesh (`refineLandmarks`) executa em WebAssembly no navegador.
O instalador copia modelos e WASM do pacote npm fixado, cuja integridade é
verificada pelo lockfile; não há CDN em runtime. Os frames ficam no dispositivo.
Somente pares de features oculares e alvos são enviados na calibração. A posição
da íris é normalizada pelos cantos de cada olho, com rejeição de olhos fechados;
não é um rastreador ocular certificado. O espelhamento da prévia é apenas visual.
OpenCV no backend não é necessário nesta arquitetura de captura web.

`POST /tracking/preview` exige consentimento e identificador temporário emitido
pela API após aprovação. A autorização fica em memória (um único worker), é
revogável com `DELETE /calibrations/{id}` e desaparece ao reiniciar a API. Não
substitui autenticação nem o futuro vínculo de sessão/participante/estudo.

### Testes da interface

```bash
cd frontend
npm test
npm run build
# Com API e Vite em execução, e Chromium instalado:
CHROMIUM_PATH=/usr/bin/chromium node scripts/browser-smoke.mjs
```

O smoke test usa o MediaPipe real com vídeo sintético sem rosto para verificar
carregamento e bloqueio; depois substitui o detector por landmarks sintéticos
para testar os 14 pontos, aprovação pela API, prévia e invalidação por resize.
São verificações de software; validar precisão e usabilidade exige uma pessoa
real e uma webcam, com iluminação e postura documentadas.

## Desenvolvimento e entregas

Veja [o plano do MVP](docs/plano-mvp.md). Use Git Flow: `main` para versões,
`develop` para integração e `feature/*` para etapas. Não incluir assinatura
ChatGPT/Codex nem trailer de coautoria automática nos commits.

## Referências

- Enunciado fornecido: Cognitive Computing, Computer Vision And IOT Systems,
  Global Solution 2026, professor Arnaldo Jr.
- [Laboratório MediaPipe](https://arnaldojr.github.io/cognitivecomputing/aulas/PDI/lab17/mediapipe.html)
- [Tema Citizen Tech](https://experience.fiap.com.br/global-solution-citizen-tech)

As tentativas de consultar esses links retornaram HTTP 403 na rede do ambiente;
seu conteúdo ainda precisa ser conferido. O relatório final deverá separar método, resultados
experimentais, limitações e evidências reproduzíveis.
