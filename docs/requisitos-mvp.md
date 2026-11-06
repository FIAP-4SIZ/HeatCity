# Requisitos e critérios de aceite — HeatCity MVP

O PDF acadêmico exige aplicação de PDI/visão computacional à Global Solution,
justificativa das escolhas, avaliação crítica, código/scripts/notebooks produzidos,
relatório PDF, visualizações/indicadores/evidências, README executável e demonstração
presencial com arguição individual. Ele não determina tecnologia, arquitetura ou
precisão de gaze. A proposta complementar define estudos, placas/AOIs, calibração,
participantes, sessões, heatmaps e dashboard. O usuário confirmou **somente olhar**.

| Requisito | Implementação/aceite | Evidência ou limite |
| --- | --- | --- |
| Gerenciar estudos | Criar, consultar, excluir com cascata | API/SQLite e testes de persistência/exclusão |
| Cenas e placas | Upload validado, desenho de AOIs sem sobreposição, cenário imutável | Testes de imagem e contrato; interface de edição |
| Participantes | Código, tarefa e consentimento obrigatório | Contrato e teste de rejeição |
| Captura | Webcam local via navegador; MediaPipe com íris refinadas | E2E com detector real/sem rosto; câmera real pendente |
| Calibração | Nove pontos ou trajetória; validação posterior separada | Testes afim/quadrático, degeneração e reprovação |
| Bloqueio de qualidade | Aprovação da API, vínculo a código/cenário/tela, erro compatível com placa | Testes de autorização, vínculo e geometria |
| Sessão ocular | 15 s, coordenadas normalizadas na imagem, intervalos inválidos e interrupção | E2E sintético completo; não há modo por clique |
| Avaliação | Métricas por tarefa/cenário, exclusão por qualidade, deduplicação de participantes | Testes de sucesso/falha/repetição/cobertura/bordas |
| Heatmaps | Individual e consolidado de sessões elegíveis | OpenCV e testes PNG; rótulo de densidade, sem alegar fixação |
| PDI | Grayscale/luminância, percentis de contraste, Laplaciano e Gaussian blur | API e métricas de cenas/AOIs; sem certificação de acessibilidade |
| Relatório/evidências | PDF, CSV, JSON, notebook e script de recálculo independente | PDF gerado e validado; dados humanos ainda necessários |
| UI | Temas, estados vazios/erro, consentimento, etapas claras, visual responsivo | E2E e inspeção visual desktop/mobile |
| Privacidade | Sem frames faciais persistidos, exclusão de registros | Código de captura; cenário é imagem fornecida pelo operador |
| Execução | Launcher Windows e instruções congeladas | Histórico de teste Windows do launcher; novas libs testadas em Linux |

## Qualidade experimental

- Não confundir funcionamento do software com precisão do rastreamento.
- RMSE ≤ 0.100 e cobertura ≥ 60% são critérios heurísticos declarados antes da coleta.
- Comparação afim/quadrático usa leave-one-out no ajuste; os cinco alvos posteriores
  não escolhem o modelo. O modelo/basis viaja com os coeficientes até a sessão.
- Borda da AOI recuada pelo RMSE reduz atribuições ambíguas; não é probabilidade de
  confiança e não prova que todos os pontos internos estejam corretos.
- Taxas e tempos são agrupados pela tarefa. Falhas não desaparecem do denominador.
- O usuário relatou 0.146–0.206 em versões anteriores. Não há comprovação humana
  de melhora nesta reconstrução. Se a calibração falha, não há sessão elegível.

## Escopo da versão

Aplicação local, de operador único, com SQLite. PostgreSQL, autenticação,
colaboração multiusuário, rastreamento em espaços 3D, certificação de acessibilidade,
OCR, inferência de leitura/compreensão e produção pública ficam fora do MVP.
Nada disso deve ser inferido pela existência de um dashboard.

## Estado da entrega acadêmica

O software e o relatório técnico provisório podem ser demonstrados com dados de
teste explicitamente identificados. A entrega acadêmica final exige coleta real,
análise crítica dos resultados, relatório regenerado, autoria/equipe e arguição.
Essas partes não são substituídas por testes sintéticos nem preenchidas com dados
inventados. A viabilidade empírica da webcam permanece sujeita ao experimento.
