# Face Landmarker e precisão do olhar — 11/11/2026

Atualização: o usuário forneceu depois o arquivo .task. Ele está incluído em
frontend/models, com hash e procedência documentados, e inicializou no teste real
CPU/WASM em Chromium. npm ci agora prepara o modelo local sem download externo.
Os parágrafos sobre bloqueio abaixo descrevem a investigação inicial. Veja
diagnostico-completo-e-perfil-ocular.md para o estado atual.

O diagnóstico recebido utiliza o protocolo precision, com RMSE das medianas de
0,0748515. Recalculando as previsões dos quadros brutos de validação com os mesmos
coeficientes, o RMSE é 0,0889228; o último alvo tem RMSE por quadro de 0,1290.
Isso confirma diferença entre agregação e uso contínuo, mas não explica nem
reproduz o deslocamento centro/canto relatado depois da calibração. O arquivo
não contém os quadros desse teste posterior. A aprovação numérica não comprova
usabilidade; o relato dos três pontos reprovados permanece uma falha de validação humana.

## Integração

Calibração e sessão passam a usar um adaptador único. Com o modelo oficial local,
ele usa MediaPipe Tasks Vision 1.2.2 (tag estável latest consultada no npm em
11/11/2026, sem usar nightly). Sem o arquivo, mantém Face Mesh anterior, identificado
na mensagem da câmera e no JSON de diagnóstico. Não há fusão de coordenadas entre
os detectores: modelos calibrados para um detector não são intercambiáveis.
Instale o modelo antes de abrir o app e refaça a calibração depois de qualquer troca.
A seleção é feita ao iniciar a câmera. Não instale nem remova o modelo durante uma sessão.

O Iniciar-HeatCity.cmd tenta instalar o modelo automaticamente se estiver ausente.
Se o download falhar, avisa e mantém o detector anterior. Para tentar manualmente,
com o programa fechado, na pasta frontend:

```cmd
npm ci
npm run model:install
```

Depois execute Iniciar-HeatCity.cmd normalmente. O download é do Google, versionado
float16/1, via HTTPS. WASM e modelo são servidos localmente. Nenhuma imagem dos olhos
é enviada a um serviço de terceiros. Falha de inicialização de um modelo presente
é apresentada como erro; não troca silenciosamente para outro detector.

A rede deste ambiente bloqueou o modelo oficial com HTTP 403. Por isso a integração
Tasks ainda não foi validada com esse modelo nem com webcam humana. Não há evidência
para prometer melhora de precisão somente pela atualização do detector.

## Fontes e escolha

- Código oficial atual: https://github.com/google-ai-edge/mediapipe/blob/master/mediapipe/tasks/web/vision/face_landmarker/face_landmarker.ts
- Versão estável: https://www.npmjs.com/package/@mediapipe/tasks-vision
- Modelo oficial: https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task
- WebGazer: https://github.com/brownhci/WebGazer/blob/master/README.md

O Face Landmarker detecta landmarks; não fornece diretamente o ponto de olhar na
tela. O mapeamento individual ainda é necessário. Seu resultado fornece as mesmas
regiões de íris utilizadas pelo adaptador. A pose pode auxiliar, mas não deve ser
confundida com direção ocular. A configuração de duas faces permite rejeitar
múltiplos rostos (a suavização nativa é limitada a uma face na API).

O README atual de WebGazer registra término da manutenção oficial em 24/02/2026 e
licença GPLv3. Ele estima olhar a partir das imagens dos olhos, porém não existe
comparação controlada com os dados deste participante. Não foi incluído como
suposta melhoria comprovada. Fundir suas previsões sem validação independente
poderia combinar erros em vez de corrigi-los.

Próxima validação humana: mesmo ambiente e posição, novo diagnóstico e teste
pós-calibração no centro e extremos, registrando referência, previsão bruta,
previsão filtrada e pose. A comparação precisa avaliar erro por quadro e erro
após mudanças de postura, além das medianas de calibração.
