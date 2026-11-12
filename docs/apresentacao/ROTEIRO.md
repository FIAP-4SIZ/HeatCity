# HeatCity — localização e acompanhamento de placas em vídeo

A pergunta é: **onde a placa cadastrada aparece e por quanto tempo é detectada?**
Esta é a apresentação do detector de placas em vídeo.

## Fala e demonstração (5–7 minutos)

1. Slides 1–3: problema concreto na entrada do hospital, relação com espaços coletivos/Global Solution e motivo do recorte. Não afirmar que o detector mede atenção humana.
2. Slides 4–6: mostrar imagem, AOIs, cinza, correlação por escalas e tempo acumulado com interrupções. O processamento usa referências conhecidas e critérios fixos, sem treinamento.
3. Slides 7–9: mostrar números efetivamente calculados, gráfico e falhas. São quadros sintéticos correlacionados, sem resultados humanos. Score de correlação não é precisão.
4. Slide 10: distinguir indícios medidos de causas e sugestões de local ainda não confirmadas.
5. Slide 11: abrir a aplicação pela raiz, clicar em Ver exemplo funcionando; a análise inicia automaticamente. Observar perda de detecção sob desfoque e ausência da Recepção no final. Ao terminar, ver o relatório e baixar PDF/JSON/CSV. Para conferir outro quadro, voltar ao vídeo.
6. Slide 12: apresentar links de documentação, scripts e limites.

## Plano B offline

Abrir `slides.html` ou `slides.pdf`, `deteccao-quadro.jpg`, o MP4 versionado e `../reports/HeatCity-deteccao-placas-exemplo.pdf`. Não representar o plano B como webcam ao vivo. A webcam depende de permissão e iluminação; o exemplo MP4 é determinístico.

## Reprodução

Da raiz (Windows: usar `.venv\Scripts\python.exe` no lugar de `.venv/bin/python`):

```sh
PYTHONPATH=backend .venv/bin/python scripts/build_sign_video_demo.py
.venv/bin/python scripts/build_sign_presentation.py
```

No PowerShell: `$env:PYTHONPATH="backend"` antes de executar os dois scripts. ffmpeg é necessário somente para regenerar o MP4, já incluído no checkout. JSON de medições e hash do vídeo em `docs/reports/deteccao-placas-benchmark.json`. Tempo de processamento varia com o computador.

## Aderência e pendências

- PDI: cinza, contraste local, Laplaciano e recortes visíveis no PDI já existente.
- Visão computacional: localização de referências nos quadros de vídeo/webcam por template matching; conteúdo alinhado ao laboratório de aula.
- Evidência reproduzível: vídeo, geometria conhecida, medições por quadro, gráfico, PDF e código versionados.
- Análise crítica: dúvida, falhas, tempo estimado e sugestões de posição por placa, sem inferência de atenção/leitura.
- Ainda faltam: medições em captura real e evidências de benefício para cidadãos. O PDF da disciplina não exige relato ou entrevista formal na apresentação. Não há ganho de orientação humana comprovado.
- O projeto fornece scripts reproduzíveis e resultados sintéticos identificados; não apresenta resultados humanos.

## Conferência tripla desta apresentação

1. Narrativa: título, pergunta, demonstração e conclusão descrevem placas em vídeo, com catálogo de referências e sem treinamento.
2. Evidência: números e gráficos vêm do mesmo JSON gerado pelo detector sobre MP4 decodificado; falhas e origem sintética são explicitadas.
3. Entrega: links, slides HTML/PDF, roteiro, MP4, relatório, scripts e notebook executado integram a entrega; a interface é verificada separadamente em navegador.
