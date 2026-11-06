# HeatCity

Transformando olhares em cidades mais inteligentes.

Projeto acadêmico da Global Solution FIAP: avaliar a visibilidade de placas em
imagens de espaços públicos por estimativas de olhar, mapas de calor e indicadores.

## Estado atual

Etapas 1–2 do MVP: API FastAPI, interface React com webcam e MediaPipe,
calibração com compensação de postura e validação independente e cálculo de métricas
temporais por área de interesse (AOI). Há prévia experimental do olhar;
ainda não há estudos persistidos, sessões de pesquisa, banco ou heatmaps.
Os testes sintéticos validam cálculos; não demonstram precisão com pessoas.

## Iniciar no Windows com dois cliques

Execute **`Iniciar-HeatCity.cmd`** na raiz do projeto. Não precisa abrir terminal
nem ativar a `.venv` manualmente. O launcher:

- Confere Python 3.12, Node.js 22.12+ (recomendado LTS 24) e npm.
- Cria `.venv` quando necessário e confere as dependências Python.
- Executa `npm ci` se o lockfile mudou e prepara os modelos locais.
- Inicia API e interface, aguarda resposta e abre o navegador padrão.
- Mostra logs em duas janelas; pressione ENTER na janela inicial para encerrar
  os processos criados por ele.

Se faltar Python 3.12, o launcher instala pelo winget. Para Node.js/npm,
primeiro testa a instalação existente e atualiza o PATH do processo; se necessário,
baixa o ZIP oficial do Node.js 24 LTS em `.heatcity-tools`, verifica SHA-256
contra o manifesto HTTPS oficial e usa essa cópia local. Não usa MSI do Node,
não precisa de administrador para essa cópia e não altera o PATH permanente.
O Node local é reutilizado nas próximas execuções e fica fora do Git.
A falha MSI 1603 relatada não permite concluir a causa sem o log do instalador;
a cópia local evita depender desse MSI. Se winget não estiver disponível,
solicita instalar App Installer pela Microsoft Store. A primeira preparação precisa de Internet. Portas
8000 e 5173 devem estar livres; o launcher não encerra instâncias desconhecidas.
Não execute como administrador. O `.cmd` chama `scripts/start-windows.ps1` usando
PowerShell do Windows; a política de execução é ajustada somente para esse
processo. O usuário confirmou o funcionamento do launcher no Windows. Ele foi preservado
com instalação de pré-requisitos adicionada nesta revisão; essa parte ainda precisa
ser validada no Windows.

A interface inicia em tema escuro. O botão Tema claro/Tema escuro salva sua
preferência neste navegador.

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

1. Use Chrome ou Edge. Posicione a câmera à altura dos olhos, a 40–70 cm,
   com luz frontal difusa. Evite contraluz, reflexos nos óculos e olhos muito
   pequenos na imagem. As orientações aparecem em tempo real sobre a prévia da câmera, inclusive
   durante a calibração e a prévia em tela cheia.
2. Marque o consentimento, ative a câmera e inicie a calibração. A aplicação
   solicita **tela cheia real**; permita-a. Ela é obrigatória também na prévia.
3. Acompanhe um único alvo contínuo por **12 segundos**, na sua posição
   confortável. Não há etapas para mudar a cabeça ou a postura. Movimentos
   naturais durante o acompanhamento entram nas características coletadas.
4. Cinco alvos parados são apresentados depois para validação independente.
   Mantenha o olhar no alvo por 1.5 segundo, sem mudar de postura por instrução.
   A tentativa completa leva aproximadamente **20 segundos**. A coleta insuficiente é rejeitada, não completada
   com coordenadas artificiais.
5. Pisque naturalmente. Piscadas, recuperação após piscada (180 ms) e mudanças
   oculares rápidas são descartadas; não são contabilizadas como olhar parado.
   Movimento ocular lento de acompanhamento permanece válido.
6. O erro RMSE deve ser no máximo 0.100. A prévia só é liberada após aprovação.
   Sair da tela cheia (ESC), alterar o tamanho da área ou desligar a câmera exige
   nova calibração. Se a cabeça sair da faixa coletada, a estimativa é suspensa
   e a interface pede retorno à faixa ou nova calibração.

O MediaPipe Face Mesh (`refineLandmarks`) executa em WASM no navegador, com captura
preferencial em 1280×720. Ambos os olhos são usados separadamente, junto de seis
características de posição, escala e orientação do rosto. Um ajuste ridge
padronizado aprende a relação com o alvo; as cinco posições posteriores medem
RMSE e percentil 90 do erro sem reajustar o modelo. Os coeficientes voltam à escala
original para a inferência no navegador.

Durante as trajetórias, a posição-alvo usada no ajuste recua 150 ms para compensar
aproximadamente o atraso de acompanhamento visual. Esse valor, os limiares de
piscada/movimento e a margem de postura são heurísticos e precisam ser avaliados
com participantes. O sistema não estima pose 3D métrica nem garante precisão em
qualquer posição. A mudança não demonstra por si só uma melhora sobre o melhor
RMSE 0.150 relatado pelo usuário na versão anterior; é preciso repetir o teste.

O instalador copia modelos e WASM do pacote npm fixado, verificado pelo lockfile;
sem CDN em runtime. Frames ficam no dispositivo. Somente features e alvos são
enviados na calibração. A versão anterior da API (`mode: "fixed"`, padrão) continua
aceitando a grade de nove pontos; a interface agora envia `mode: "motion"`, com
pelo menos 120 amostras de ajuste, 30 de validação e dez features por amostra.

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
para testar trajetórias em tela cheia, aprovação pela API, piscada, recuperação e invalidação ao sair da tela cheia.
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
