# HeatCity

**Transformando olhares em cidades mais inteligentes.**

MVP acadêmico da Global Solution FIAP — Cognitive Computing, Computer Vision And
IoT Systems. O produto investiga como participantes localizam placas em imagens
de espaços públicos, **exclusivamente por estimativas de olhar**. Não há modo por
clique e o sistema não trata estimativa de gaze como certeza de atenção ou leitura.

## O que esta versão entrega

- Estudos persistidos, cenários A/B e cadastro visual de áreas de interesse (AOIs).
- Participantes por código, consentimento, calibração individual e sessão de 15 s.
- Câmera processada localmente com MediaPipe, sem salvar ou enviar frames faciais.
- Qualidade vinculada ao participante, cenário, tela e dimensão da placa.
- Sessões elegíveis/inconclusivas, histórico e exclusão de registros.
- Heatmaps individuais e consolidados, indicadores por tarefa/cenário, CSV e JSON.
- Processamento OpenCV de cenas/AOIs e geração de relatório PDF a partir dos dados.
- Interface responsiva com temas claro/escuro; claro como padrão sem preferência salva.
- Launcher Windows, testes automatizados, notebook e protocolo de coleta.

**Limitação atual:** os RMSE 0.146–0.206 relatados pelo usuário não atendem ao
limite experimental de 0.100. A reestruturação oferece o fluxo completo de
software e seleção de ajuste afim/quadrático por validação cruzada de treinamento,
mas **não demonstra melhora de precisão humana**. Uma calibração reprovada
continua bloqueando a sessão. A viabilidade com webcam real depende da coleta
experimental; não é correto afirmar que a precisão foi resolvida pelos testes.

## Iniciar no Windows

Atualize a branch de desenvolvimento desta entrega:

```cmd
git fetch origin
git switch feature/mvp-study-workflow
Iniciar-HeatCity.cmd
```

Feche as janelas da execução anterior. O `.cmd`:

1. Verifica Python 3.12; usa winget para instalar quando necessário.
2. Testa Node/npm existentes. Se necessário, baixa o ZIP oficial de Node.js 24
   LTS, verifica SHA-256 e usa uma cópia em `.heatcity-tools`, sem MSI do Node,
   privilégio de administrador para esse ZIP ou alteração permanente do PATH.
3. Prepara `.venv`, dependências Python fixadas e dependências web por `npm ci`.
4. Inicia API/interface em **127.0.0.1**, verifica respostas e abre o navegador padrão.

Mantenha a janela principal aberta; ENTER encerra os processos criados por ela.
A primeira instalação exige Internet. Winget ausente exige App Installer da
Microsoft Store; instaladores de Python podem solicitar permissões do Windows.
Portas 8000 e 5173 devem estar livres. O launcher não encerra processos desconhecidos.
A parte anterior de inicialização foi confirmada pelo usuário no Windows; as novas
dependências OpenCV/ReportLab foram validadas neste ambiente Linux e ainda precisam
ser confirmadas no Windows. Em erro `DLL load failed` do OpenCV, verifique o
Microsoft Visual C++ Redistributable oficial compatível com a arquitetura do Python.

## Execução manual

Python 3.12 e Node.js 22.12+ (recomendado LTS 24):

```bash
python3 -m venv .venv
.venv/bin/python -m pip install -r backend/requirements.lock
cd backend
../.venv/bin/python -m uvicorn heatcity.api:app --host 127.0.0.1 --port 8000
```

Em outro terminal, na raiz:

```bash
cd frontend
npm ci
npm run dev
```

No Windows, substitua `.venv/bin/python` por `.venv\Scripts\python.exe`.
O proxy `/api` do Vite encaminha para a API. `HEATCITY_API_URL` permite outro
endereço durante testes. Build: `npm run build`. Servir o build fora do Vite exige
configurar encaminhamento de `/api`; esta entrega é **local, de operador único,
sem autenticação**, e não deve ser exposta como serviço compartilhado.

## Fluxo de uso

1. Crie um estudo com objetivo concreto, por exemplo localizar recepção e saída.
2. Cadastre um cenário. Envie PNG/JPEG/WebP (até 4 MB e 8 MP, mínimo 200 px por
   lado) ou use a cena didática. A cena didática não cria participantes ou resultados.
3. Nomeie cada placa e arraste na imagem para delimitar sua AOI. Áreas não podem
   se sobrepor. Cenários salvos são imutáveis; crie outro para uma posição alternativa.
4. Abra **Nova sessão**, informe código, cenário e placa-alvo. Explique o experimento
   e registre consentimento. Não use nomes, documentos ou dados pessoais no código.
5. Calibre individualmente. A câmera aparece na preparação; ao iniciar, tela cheia
   e contagem 3–2–1. Campo branco ocupa a tela inteira durante coleta. ESC cancela.
6. O ajuste padrão usa nove pontos e cinco alvos posteriores de validação. Afim e
   quadrático são comparados por leave-one-out nos pontos de ajuste; o quadrático
   só é escolhido com redução de erro de pelo menos 20%. A validação posterior
   não escolhe o modelo. O modo móvel experimental também está disponível.
   Se reprovar, **Baixar diagnóstico da calibração** exporta features e erros por alvo,
   sem frames faciais ou identificador de autorização. Isso permite investigar os
   dados reais em vez de ajustar limites às cegas. Compartilhe somente se desejar.
7. Somente uma calibração aprovada pode ser usada no estudo. A autorização expira
   em dez minutos e é válida para o mesmo código, cenário e tamanho de tela.
8. Inicie a sessão de 15 s. Procure a placa com os olhos, **sem clicar na imagem**.
   Câmera continua ativa sem prévia sobreposta; o frame não é transmitido ou salvo.
9. Consulte resultados, cobertura, heatmaps e histórico. Adicione outro participante
   com nova calibração ou gere PDF/CSV/JSON. Apague sessões ou estudos quando necessário.

## Indicadores e critérios

- RMSE euclidiano em coordenadas normalizadas ≤ 0.100; não significa porcentagem
  de precisão. É um critério experimental, ainda sem validação clínica.
- Erro menor que metade da menor dimensão da placa escolhida. Pontos junto à borda,
  numa margem igual ao RMSE, ficam ambíguos e não contam para a placa. Essa margem
  é heurística, não intervalo de confiança.
- Sessão elegível: ao menos 30 amostras válidas e cobertura temporal da cena ≥ 60%.
  Pontos fora da imagem, piscadas e perdas de detecção não viram observações artificiais.
- A taxa de observação estimada usa participantes elegíveis da mesma tarefa/cenário.
  Para repetições, seleciona-se a última sessão elegível do código naquele grupo.
- Tempo até observar é resumido **somente entre sucessos**; falhas permanecem no
  denominador da taxa. Falta de observação e insuficiência de rastreamento são distintas.
- Tempo de atenção estimada soma intervalos até a próxima amostra, limitados a
  200 ms. Entradas em AOI não são fixações oculares medidas.
- Heatmap representa densidade de amostras válidas, não tempo de fixação, leitura
  ou compreensão. Cores são normalizadas por imagem e não são diretamente comparáveis.
- OpenCV descreve área da placa, luminância, contraste local por percentis 1/99
  e variância do Laplaciano. Isso não certifica acessibilidade nem legibilidade.

## Dados e arquitetura

- `frontend/src/views`: estudos, edição de cenas, preparação, calibração, sessão e resultados.
- `frontend/src/camera.js`: carregamento local do detector, captura e inferência.
- `backend/heatcity/schemas.py`: contratos e invariantes.
- `backend/heatcity/storage.py`: SQLite transacional, schema v1 e exclusão em cascata.
- `backend/heatcity/services`: métricas, visão e relatório PDF.
- `data/heatcity.sqlite3`: registros locais; ignorado pelo Git. Faça backup com a
  aplicação parada. `HEATCITY_DATA_DIR` muda o diretório, inclusive para testes.

SQLite substitui PostgreSQL neste MVP para permitir execução local sem Docker ou
serviço adicional. Não há promessa de migração automática, multioperador ou gestão
de usuários. Calibrações/autorização ficam em memória e devem ser refeitas ao
reiniciar a API. Sessões e resultados já salvos sobrevivem ao reinício.
As imagens persistidas são **cenas enviadas pelo operador**, não capturas faciais.

## Verificação e padrões de código

```bash
cd backend
../.venv/bin/python -m unittest discover -s tests -v
# Ferramentas de desenvolvimento opcionais:
../.venv/bin/python -m pip install -r requirements-dev.txt
../.venv/bin/ruff check .
../.venv/bin/ruff format --check .
```

```bash
cd frontend
npm test
npm run format:check
npm run build
# API e Vite ativos; use Chromium já instalado:
CHROMIUM_PATH=/usr/bin/chromium npm run test:e2e
```

O E2E usa detector MediaPipe real com vídeo sintético sem rosto para verificar
bloqueio. Depois usa **landmarks sintéticos somente no script de teste** para
percorrer o fluxo completo: estudo, cena, calibração, sessão, persistência,
heatmap e PDF. Os registros são removidos ao final. Isso não comprova precisão
humana. `HEATCITY_BASE_URL` seleciona outra instância para testes isolados.
Formatação: Prettier no frontend e Ruff no backend. Git Flow: `feature/*` a partir
de `develop`, integração/release após revisão. Sem assinatura automática Codex.

## Entrega acadêmica e reprodução

- [Requisitos e critérios de aceite](docs/requisitos-mvp.md).
- [Protocolo experimental](docs/protocolo-experimental.md).
- [Relatório técnico provisório em PDF](docs/reports/HeatCity-relatorio-tecnico.pdf).
- [Notebook de análise](notebooks/analise-estudos.ipynb) — abra com Jupyter/VS Code
  se desejar; não é necessário para executar a aplicação.
- `scripts/recompute_metrics.py`: recalcula taxas/tempos de uma exportação JSON
  sem importar a API.
- `scripts/generate_report.py`: gera relatório provisório sem participantes ou,
  com `--study-id ID`, gera relatório dos dados persistidos. A interface também exporta PDF.

```bash
.venv/bin/python scripts/generate_report.py
.venv/bin/python scripts/recompute_metrics.py data/heatcity-evidencias.json
```

O relatório versionado identifica que ainda não há validação humana desta versão.
Antes da entrega final, coletar resultados reais com consentimento, analisar
limitações, regenerar o PDF do estudo e preparar a demonstração/arguição individual.
Não há resultados inventados para preencher essa etapa.

Referência principal: enunciado **Cognitive Computing-GS2-2026.pdf**, Arnaldo Jr.
[Pesquisa de MediaPipe e alternativas](docs/pesquisa-rastreamento-ocular.md).

## Diagnósticos / DEV sem cadastro

Abra **Diagnósticos / DEV** no menu. Não exige estudo, cenário ou participante;
consentimento e permissão da câmera continuam necessários. O laboratório permite:

- Calibrar por pontos ou alvo móvel, com análise detalhada por alvo.
- Ver FPS, tempo de processamento, quantidade de frames, taxa válida e features.
- Mostrar olhos/íris ou landmarks do rosto na câmera.
- Visualizar o tracking mesmo com RMSE reprovado, com identificação experimental.
- Ajustar confiança de detecção/tracking, abertura mínima e filtro temporal antes
  de ligar a câmera; escolher overlay e suavização visual da prévia.
- Importar até 20 diagnósticos JSON por comparação (até 2 MB cada), somente no
  navegador, com RMSE recalculado, resíduos agrupados por alvo e indicação de
  estimativas fora da tela. Nenhum arquivo importado é enviado ou persistido.

`POST /diagnostics/calibration` somente calcula: não emite identificador de
calibração, não registra modelo autorizado e não cria dados de estudo. Um marcador
em movimento nessa área não comprova qualidade nem libera uma sessão acadêmica.
Alterações DEV não mudam os critérios nem o fluxo dos estudos. ESC retorna da
prévia ao resultado para examinar e exportar o diagnóstico.

Teste de navegador específico, com API e Vite ativos:

```bash
CHROMIUM_PATH=/usr/bin/chromium node frontend/scripts/diagnostics-smoke.mjs
```
