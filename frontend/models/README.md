# Face Landmarker

Arquivo fornecido pelo usuário em 11/11/2026 como `face_landmaker.task`,
normalizado para o nome esperado `face_landmarker.task`. Não foi possível comparar
com o download oficial (bloqueado pela rede); o hash fixa o arquivo fornecido.

SHA-256: `64184e229b263107bc2b804c6625db1341ff2bb731874b0bcc2fe6544e0bc9ff`

Contém face_detector.tflite, face_landmarks_detector.tflite,
geometry_pipeline_metadata_landmarks.binarypb e face_blendshapes.tflite.
Integridade do contêiner ZIP conferida. O postinstall copia o arquivo verificado
para public/mediapipe. A inicialização no navegador verifica a compatibilidade real.
O ZIP Tasks Vision enviado separadamente corresponde ao pacote npm 1.2.2 já fixado;
não contém este modelo e não é necessário versionar node_modules.
