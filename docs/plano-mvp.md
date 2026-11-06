# Plano do MVP

O plano atual e os critérios estão em [requisitos-mvp.md](requisitos-mvp.md).
A coleta humana segue [protocolo-experimental.md](protocolo-experimental.md).

A reconstrução é exclusivamente ocular, conforme decisão do usuário. Ela inclui
estudos, cenas/AOIs, consentimento, calibração, sessões persistidas, critérios de
qualidade, heatmaps, relatório PDF e exportações reproduzíveis. SQLite foi escolhido
para execução local no Windows. O software não oferece modo por clique nem
aprovação automática de calibrações reprovadas.

Ainda é necessário validar precisão e usabilidade com pessoas e webcam real.
O relatório PDF versionado é provisório e identifica a ausência de validação
humana desta reconstrução. Consulte README para instalação, testes e reprodução.

Git Flow: a implementação está em `feature/mvp-study-workflow`; não altera `main`
automaticamente. Commits não incluem assinatura automática de ferramentas.
