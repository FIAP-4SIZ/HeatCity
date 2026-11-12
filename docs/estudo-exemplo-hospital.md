# Base hospitalar compartilhada

O projeto “Orientação na entrada de um hospital” aparece normalmente em
Referências de placas após iniciar a aplicação. Duas imagens originais de IA
fornecidas pelo usuário e oito recortes estão em `backend/heatcity/fixtures`.
O manifesto contém coordenadas normalizadas e hashes SHA-256 conferidos na carga.
Nenhum resultado de captura é inserido no catálogo. A carga é idempotente.

No projeto, selecione “Analisar vídeo” da referência A para usar o MP4 demonstrativo.
A geometria sintética só é aplicada automaticamente se o hash da imagem e os
recortes corresponderem ao manifesto. Outro vídeo exige anotação manual para medir
acerto; uma referência diferente não recebe resultados conhecidos do exemplo.

As duas imagens também alteram pessoas, setas e outras placas; não são experimento
causal de posicionamento. A demonstração em vídeo aplica transformações controladas
à imagem A e permanece identificada como sintética.

## Papel das duas imagens

A é a referência inicial única da demonstração. B fica recolhida como material alternativo; não participa do vídeo de exemplo. O fluxo começa exibindo recortes das placas, não duas fotografias concorrentes. O relatório abre após concluir a análise e distingue acerto conhecido de precisão não medida.
