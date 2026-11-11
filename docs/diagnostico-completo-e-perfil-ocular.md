# Perfil ocular e diagnóstico completo — 11/11/2026

O filtro de abertura anterior usava 0,12/0,14 como limite comum. Esse requisito
pode rejeitar aberturas naturais menores. Não temos dados suficientes para
quantificar desempenho por população e não inferimos etnia pelas imagens.

O modo padrão agora observa ambos os olhos por pelo menos 1,5 s e 30 quadros.
Use cerca de dois segundos olhando à frente, com abertura confortável e piscadas
naturais. Cada olho recebe uma referência do percentil 90 das aberturas observadas;
o limiar é 35% dessa referência (piso 0,008). Não aprende durante o teste, evitando
adaptar a referência às piscadas. Uma referência abaixo de 0,025 não estabelece
perfil, pois landmarks quase coincidentes não distinguem olhos abertos de fechados.
Isso é uma heurística inicial, não uma garantia de equidade ou precisão humana.
O tratamento temporal de piscadas e movimentos rápidos continua ativo.

Calibração e sessão usam o mesmo perfil. Nos diagnósticos, o desenvolvedor pode
desligar o ajuste automático e comparar com o limite manual. A saída registra a
configuração, as duas aberturas e os respectivos limiares. Nenhuma classificação
demográfica é calculada ou solicitada.

Em Diagnósticos / DEV, o botão **Baixar diagnóstico completo da página** funciona
sem cadastro e antes ou depois de uma aprovação. Baixe depois de encerrar a prévia
com ESC. Inclui até cinco tentativas de calibração (incluindo amostras por alvo),
comparações importadas, detector, perfil ocular, contadores, configurações DEV,
eventos de tela cheia/redimensionamento e os últimos 5.000 registros de câmera,
no máximo dez por segundo. Registra rejeições, motivos, características numéricas,
previsões brutas e suavizadas do tracking experimental. Registros descartados pelo
limite são contabilizados. O histórico é temporário, da página aberta; sair da
página ou recarregar perde o histórico. Não salva vídeos ou imagens faciais.

O JSON mantém o último diagnóstico de calibração na raiz para compatibilidade e
adiciona page_diagnostic com o histórico completo. O importador aceita até 10 MB.
Sem alvo de referência no tracking livre, suas previsões não medem erro real nem
comprovam precisão humana. Não chamar uma aprovação numérica de validação de uso.

## Modelo recebido

O ZIP Tasks Vision corresponde ao bundle npm 1.2.2 já instalado, mas não contém
modelo. O arquivo .task enviado depois contém os quatro componentes esperados,
passou na verificação de integridade ZIP e foi incluído em frontend/models.
A cópia local é conferida por SHA-256 no postinstall; npm ci prepara todos os
assets, sem download externo do modelo. Seu nome foi corrigido de face_landmaker
para face_landmarker. Proveniência e hash estão em frontend/models/README.md.

O teste tasks-smoke inicializou o modelo real em Chromium com CPU/WASM e retornou
zero rostos para uma imagem uniforme. Esse teste comprova carregamento e inferência,
não precisão do olhar. Os testes de aprovação, rejeição e exportação usam landmarks
sintéticos explicitamente separados do teste do detector real.
