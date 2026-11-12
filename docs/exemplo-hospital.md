# Exemplo pronto

Uma única foto original de IA fornecida pelo usuário, quatro recortes de placas
e um vídeo sintético de 12 segundos. Na tela inicial, clique em **Ver exemplo
funcionando**: a análise começa e o relatório abre ao terminar.

A foto está em `backend/heatcity/fixtures/hospital.jpg`; seu manifesto e SHA-256
ficam em `hospital-reference.json`. A instalação é idempotente e limpa somente
ativos descontinuados do projeto distribuído pelo aplicativo, preservando fotos
personalizadas do operador.

O MP4 contém nitidez, deslocamento, desfoque e remoção da Recepção. As caixas
verdadeiras são conhecidas. Vídeos próprios não recebem essas anotações: precisam
de conferência manual para medir acerto.

CitizenTech: exemplo técnico de apoio à revisão de sinalização. Não representa
observação de campo, participantes nem melhoria humana comprovada. Veja
[conferência dos requisitos](verificacao-requisitos.md).

A demonstração decodifica na API os quadros 0, 6, 12, …, 138 (24 instantes,
de 0 a 11,5 s). As previsões são recalculadas pelo detector, sem copiar o
benchmark. O processamento pode durar mais ou menos que os 12 s do arquivo.
Vídeo próprio e webcam continuam amostrados ao vivo. Veja os
[valores esperados](verificacao-exemplo-sintetico.md).
