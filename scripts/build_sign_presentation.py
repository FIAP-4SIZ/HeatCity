"""Gera apresentação e pacote reproduzível a partir das medições versionadas."""

import html
import json
import shutil
import textwrap
import zipfile
from pathlib import Path

import cv2
import numpy as np
from reportlab.lib.colors import HexColor
from reportlab.pdfgen import canvas

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "docs/apresentacao"
REPORTS = ROOT / "docs/reports"


def main():
    data = json.loads((REPORTS / "deteccao-placas-benchmark.json").read_text())
    s = data["summary"]
    metric = lambda v: "indisponível" if v is None else f"{v:.3f}"
    condition_rows = []
    for condition in dict.fromkeys(f["condition"] for f in data["frames"]):
        frames = [f for f in data["frames"] if f["condition"] == condition]
        tp = sum(f["metrics"]["tp"] for f in frames)
        fn = sum(f["metrics"]["fn"] for f in frames)
        condition_rows.append((condition, tp, fn, tp / (tp + fn) if tp + fn else 0))
    graph = [
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 270" role="img" aria-label="Recall por condição do vídeo sintético">',
        '<rect width="900" height="270" fill="#f5f7f3"/>',
    ]
    for i, (name, tp, fn, recall) in enumerate(condition_rows):
        y = 35 + i * 55
        graph += [
            f'<text x="15" y="{y + 18}" font-family="sans-serif" font-size="17" fill="#173b31">{html.escape(name)}</text>',
            f'<rect x="270" y="{y}" width="{recall * 420}" height="28" fill="#28775c"/>',
            f'<text x="{285 + recall * 420}" y="{y + 20}" font-family="sans-serif" font-size="17">{recall:.1%} · TP {tp} / FN {fn}</text>',
        ]
    graph.append("</svg>")
    (OUT / "deteccao-resultados.svg").write_text("".join(graph))
    capture = cv2.VideoCapture(str(ROOT / "frontend/public/detection-demo.mp4"))
    ok, picture = capture.read()
    capture.release()
    if ok:
        for sign in data["frames"][0]["signs"]:
            if not sign["box"]:
                continue
            x, y, w, h = sign["box"]
            height, width = picture.shape[:2]
            cv2.rectangle(
                picture,
                (int(x * width), int(y * height)),
                (int((x + w) * width), int((y + h) * height)),
                (50, 240, 130),
                2,
            )
        cv2.imwrite(str(OUT / "deteccao-quadro.jpg"), picture)
    original = cv2.imread(str(ROOT / "backend/heatcity/fixtures/hospital-a.jpg"))
    fixture = json.loads(
        (ROOT / "backend/heatcity/fixtures/hospital-study.json").read_text()
    )
    plate = fixture["scenarios"][0]["plates"][0]
    ih, iw = original.shape[:2]
    crop = original[
        int(plate["y"] * ih) : int((plate["y"] + plate["height"]) * ih),
        int(plate["x"] * iw) : int((plate["x"] + plate["width"]) * iw),
    ]
    gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
    lap = cv2.Laplacian(gray, cv2.CV_64F)
    magnitude = np.abs(lap)
    display = (magnitude / max(1, magnitude.max()) * 255).astype(np.uint8)
    chart = np.full((210, 900, 3), (243, 247, 245), np.uint8)
    for i, (label, patch) in enumerate(
        [
            ("Original", crop),
            ("Cinza", cv2.cvtColor(gray, cv2.COLOR_GRAY2BGR)),
            ("|Laplaciano|", cv2.cvtColor(display, cv2.COLOR_GRAY2BGR)),
        ]
    ):
        x = 15 + i * 220
        chart[45:125, x : x + 205] = cv2.resize(patch, (205, 80))
        cv2.putText(
            chart, label, (x, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (49, 59, 23), 1
        )
    hist = np.bincount(gray.ravel(), minlength=256)
    pts = np.array(
        [
            [690 + i * 190 / 255, 125 - float(v) / max(hist.max(), 1) * 85]
            for i, v in enumerate(hist)
        ],
        np.int32,
    )
    cv2.polylines(chart, [pts], False, (65, 105, 35), 1)
    cv2.putText(
        chart, "Histograma", (690, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (49, 59, 23), 1
    )
    cv2.putText(
        chart,
        "0",
        (690, 150),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.35,
        (49, 59, 23),
        1,
    )
    cv2.putText(
        chart, "255", (860, 150), cv2.FONT_HERSHEY_SIMPLEX, 0.35, (49, 59, 23), 1
    )
    cv2.putText(
        chart,
        f"Recepcao: media cinza {gray.mean():.1f}; variancia Laplaciano {lap.var():.1f}",
        (15, 180),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.55,
        (49, 59, 23),
        1,
    )
    cv2.imwrite(str(OUT / "deteccao-pdi.png"), chart)
    details = s["details"]
    plate_lines = [
        f"{d['name']}: {d['detection_fraction']:.0%} dos quadros detectados; {d['detected_seconds']:.1f} s estimados; precisão {metric(d['precision'])}; recall {metric(d['recall'])}."
        for d in details
    ]
    slides = [
        (
            "HeatCity — placas em vídeo",
            [
                "Onde a placa cadastrada aparece e por quanto tempo é detectada?",
                "Localização por template matching multiescala e acompanhamento temporal por quadros.",
                "MVP acadêmico · Global Solution · FIAP. Demonstração sintética identificada.",
            ],
        ),
        (
            "Problema: encontrar a Recepção",
            [
                "Na entrada de um hospital, a placa pode ficar pequena no enquadramento, desfocada, obstruída ou semelhante às demais.",
                "Investigar a visibilidade da sinalização apoia hipóteses para espaços coletivos mais acessíveis, relacionadas à Global Solution.",
                "A câmera localiza a placa. Compreensão e orientação humana exigem estudo específico.",
            ],
        ),
        (
            "Mudança de rumo e escopo",
            [
                "O experimento ocular anterior apresentou instabilidade e não sustenta localização confiável do olhar.",
                "O MVP atual analisa vídeo ou webcam, sem participante e sem calibração ocular.",
                "Placas são cadastradas por imagem e recorte. Não há OCR, detecção de placas desconhecidas nem treinamento de um modelo.",
                "Histórico ocular preservado em seção separada; nenhum resultado ocular é usado como resultado do detector.",
            ],
        ),
        (
            "PDI e visão computacional",
            [
                "1. Captura negociada e amostragem de até 2 quadros/s; largura reduzida a 800 px.",
                "2. Cinza → recortes de referência → TM_CCOEFF_NORMED em 7 escalas fixas.",
                "3. Similaridade ≥ 0,72 e margem espacial ≥ 0,06. Conflito entre identidades: margem 0,08.",
                "4. Laplaciano, contraste e tamanho aparente descrevem indícios de dificuldade. Os limites são heurísticos, sem treino.",
            ],
            "deteccao-pdi.png",
        ),
        (
            "Cenário, recortes e posição",
            [
                "A imagem original do hospital enviada pelo usuário é preservada como estudo normal.",
                "As AOIs delimitam Recepção, Pronto Socorro, Ambulatório e Triagem. Os retângulos encontrados são coordenadas normalizadas no quadro.",
                "A/B originais também mudam pessoas, setas e outras placas: não isolam o efeito da posição da Recepção.",
            ],
            "deteccao-quadro.jpg",
        ),
        (
            "Por quanto tempo foi detectada?",
            [
                "Somar Δt apenas quando a mesma placa é detectada em dois quadros consecutivos da mesma fonte, com 0 < Δt ≤ 1,5 s.",
                "Falha, ambiguidade ou intervalo maior interrompe o trecho. Um quadro isolado representa 0 s.",
                "Tempo do arquivo vem da mídia, não da duração de processamento. Não se prova presença contínua entre amostras.",
                "Centros acumulados mostram a trajetória na imagem; não são mapa de calor do olhar.",
            ],
        ),
        (
            "Experimento reproduzível, sem pessoas",
            [
                "MP4 de 12 s / 12 FPS construído com imagem de IA: nitidez, deslocamento, desfoque e remoção da Recepção.",
                f"24 quadros decodificados; {s['annotations']} anotações geométricas conhecidas. TP {s['tp']}, FP {s['fp']}, FN {s['fn']}, TN {s['tn']}.",
                f"Precisão {metric(s['precision'])}; recall {metric(s['recall'])}; IoU médio {metric(s['mean_iou'])}. A precisão alta convive com falhas de detecção.",
                "Mesma foto de origem e quadros correlacionados: ensaio controlado e otimista, sem generalização para vídeo real.",
            ],
        ),
        (
            "Resultado real calculado no exemplo",
            [
                f"{name}: TP {tp}, FN {fn}, recall {recall:.1%}."
                for name, tp, fn, recall in condition_rows
            ]
            + [
                "A ausência de detecção sob desfoque permanece no resultado. Não se alteraram os critérios para aprovar o exemplo."
            ],
            "deteccao-resultados.svg",
        ),
        (
            "Análise final por placa",
            plate_lines
            + [
                "Desfoque/desaparecimento reduzem a disponibilidade. Precisão considera só anotações e não é o score de correlação.",
                "A aplicação e o relatório consolidam causas possíveis, margens, trechos detectados, falhas e sugestões por placa.",
            ],
        ),
        (
            "Dúvidas e sugestões de local",
            [
                "Indícios observáveis: baixa margem entre regiões, conflito entre placas, perda de nitidez, baixo contraste, tamanho aparente pequeno e borda do quadro.",
                "Hipóteses: posição frontal ao trajeto, antes do ponto de decisão, maior tamanho aparente, sem obstruções/reflexos; títulos e pictogramas distinguíveis.",
                "Baixa correlação não identifica uma causa única nem determina altura ideal de instalação.",
                "Comparar antes/depois no mesmo trajeto, câmera e iluminação, com posições reais anotadas. Não afirmar ganho de orientação humana sem testá-lo.",
            ],
        ),
        (
            "Demonstração e próxima evidência",
            [
                "1. Iniciar-HeatCity.cmd → Placas em vídeo → referência Cenário A.",
                "2. Abrir vídeo demonstrativo → Iniciar análise → observar caixas e tempos.",
                "3. Pausar → conferir anotação → exportar JSON, CSV e PDF com a análise final.",
                "4. Próxima etapa: vídeo real das placas cadastradas; anotar posições/ausências e medir precisão, recall, IoU e falhas.",
                "Conclusão: MVP funcional para localizar referências em quadros; acompanhamento amostrado e generalização ainda limitada.",
            ],
        ),
        (
            "Fontes e reprodução",
            [
                "OpenCV — Template Matching: https://docs.opencv.org/4.x/d4/dc6/tutorial_py_template_matching.html",
                "Aula — Template matching: https://arnaldojr.github.io/cognitivecomputing/aulas/PDI/lab12/Template_matching.html",
                "Enunciado: Cognitive Computing-GS2-2026.pdf, fornecido pela disciplina. Aderência e limites detalhados no roteiro.",
                "scripts/build_sign_video_demo.py; scripts/build_sign_presentation.py; docs/reports/deteccao-placas-benchmark.json. Dependências congeladas no repositório.",
            ],
        ),
    ]
    for name in ["slides.html", "slides.pdf", "ROTEIRO.md"]:
        source = OUT / name
        archive = OUT / ("historico-ocular-" + name)
        if source.exists() and not archive.exists():
            shutil.copyfile(source, archive)
    style = """*{box-sizing:border-box}body{margin:0;background:#102820;color:#173b31;font:22px/1.45 system-ui,sans-serif}.slide{background:#f5f7f3;margin:32px auto;padding:50px 65px;max-width:1200px;min-height:675px;position:relative}h1{font-size:44px;line-height:1.12;letter-spacing:-1px;margin:0 0 30px}li{margin:15px 0}img{display:block;max-height:295px;max-width:90%;margin:20px auto}small{position:absolute;bottom:20px;right:35px;font-size:13px}.visual{font-size:18px}.visual li{margin:8px 0}nav{text-align:center;color:white;font-size:16px;padding:15px}nav a{color:#aff2ca}@page{size:landscape;margin:0}@media print{body{background:white}.slide{width:100vw;height:100vh;max-width:none;min-height:0;margin:0;break-after:page;padding:35px 55px}h1{font-size:36px}body{font-size:18px}nav{display:none}img{max-height:240px}}"""
    blocks = []
    pdf = canvas.Canvas(str(OUT / "slides.pdf"), pagesize=(960, 540))
    pdf.setTitle("HeatCity — localização e acompanhamento de placas em vídeo")
    pdf.setAuthor("Equipe HeatCity")
    for i, (title, lines, *visual) in enumerate(slides, 1):
        blocks.append(
            f'<section id="s{i}" class="slide {"visual" if visual else ""}"><h1>{html.escape(title)}</h1><ul>'
            + "".join(f"<li>{html.escape(line)}</li>" for line in lines)
            + "</ul>"
            + (
                f'<img src="{visual[0]}" alt="Evidência visual do experimento">'
                if visual
                else ""
            )
            + f"<small>HeatCity · {i}/{len(slides)} · exemplo sintético</small></section>"
        )
        pdf.setFillColor(HexColor("#f5f7f3"))
        pdf.rect(0, 0, 960, 540, fill=1, stroke=0)
        pdf.setFillColor(HexColor("#173b31"))
        pdf.setFont("Helvetica-Bold", 27)
        pdf.drawString(45, 492, title.replace("—", "-"))
        y = 450
        for line in lines:
            pdf.setFont("Helvetica", 14)
            for part in textwrap.wrap(
                line.replace("≥", ">=").replace("≤", "<=").replace("Δ", "delta "),
                width=112,
            ):
                pdf.drawString(50, y, part)
                y -= 21
            y -= 12
        if visual and visual[0].endswith(".jpg"):
            pdf.drawImage(
                str(OUT / visual[0]),
                330,
                18,
                width=300,
                height=225,
                preserveAspectRatio=True,
                anchor="c",
            )
        if visual and visual[0].endswith(".png"):
            pdf.drawImage(
                str(OUT / visual[0]),
                65,
                30,
                width=830,
                height=193,
                preserveAspectRatio=True,
            )
        if visual and visual[0].endswith(".svg"):
            for k, (name, tp, fn, recall) in enumerate(condition_rows):
                row_y = 125 - k * 25
                pdf.setFillColor(HexColor("#173b31"))
                pdf.setFont("Helvetica", 12)
                pdf.drawString(50, row_y, name)
                pdf.drawString(730, row_y, f"Recall {recall:.1%}")
                pdf.setFillColor(HexColor("#28775c"))
                pdf.rect(270, row_y - 2, recall * 420, 13, fill=1, stroke=0)
        pdf.setFillColor(HexColor("#173b31"))
        pdf.setFont("Helvetica", 10)
        pdf.drawRightString(
            925, 15, f"HeatCity | {i}/{len(slides)} | exemplo sintetico"
        )
        pdf.showPage()
    pdf.save()
    (OUT / "slides.html").write_text(
        '<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>HeatCity — placas em vídeo</title><style>'
        + style
        + '</style><nav>HeatCity · Localização e acompanhamento de placas em vídeo · <a href="../../frontend/public/detection-demo.mp4">Vídeo sintético</a> · <a href="../reports/HeatCity-deteccao-placas-exemplo.pdf">Relatório detalhado</a></nav>'
        + "".join(blocks)
        + '<script>let i=1;addEventListener("keydown",e=>{if(e.key==="ArrowRight"||e.key==="PageDown")i=Math.min(12,i+1);else if(e.key==="ArrowLeft"||e.key==="PageUp")i=Math.max(1,i-1);else return;document.getElementById("s"+i).scrollIntoView();e.preventDefault()})</script></html>'
    )
    (
        OUT / "ROTEIRO.md"
    ).write_text("""# HeatCity — localização e acompanhamento de placas em vídeo

A pergunta é: **onde a placa cadastrada aparece e por quanto tempo é detectada?**
Esta é a apresentação vigente. Os arquivos `historico-ocular-*` documentam a proposta anterior e não são evidências do detector.

## Fala e demonstração (5–7 minutos)

1. Slides 1–3: problema concreto na entrada do hospital, relação com espaços coletivos/Global Solution e motivo do recorte. Não afirmar que o detector mede atenção humana.
2. Slides 4–6: mostrar imagem, AOIs, cinza, correlação por escalas e tempo acumulado com interrupções. Não há treinamento, calibração ocular ou identificação de participantes.
3. Slides 7–9: mostrar números efetivamente calculados, gráfico e falhas. São quadros sintéticos correlacionados, sem resultados humanos. Score de correlação não é precisão.
4. Slide 10: distinguir indícios medidos de causas e sugestões de local ainda não confirmadas.
5. Slide 11: abrir a aplicação pela raiz, selecionar Cenário A, abrir vídeo demonstrativo e iniciar análise. Observar perda de detecção sob desfoque e ausência da Recepção no final. Pausar, marcar uma posição real se desejar e baixar PDF/JSON/CSV.
6. Slide 12: apresentar links de documentação, scripts e limites.

## Plano B offline

Abrir `slides.html` ou `slides.pdf`, `deteccao-quadro.jpg`, o MP4 versionado e `../reports/HeatCity-deteccao-placas-exemplo.pdf`. Não representar o plano B como webcam ao vivo. A webcam depende de permissão e iluminação; o exemplo MP4 é determinístico.

## Reprodução

Da raiz (Windows: usar `.venv\\Scripts\\python.exe` no lugar de `.venv/bin/python`):

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
- Ainda faltam: medições confiáveis em vídeo real e comparação controlada de posicionamentos. As imagens A/B originais mudam múltiplos elementos e não isolam uma variável.
- O notebook e os relatórios oculares anteriores são históricos; não substituem o experimento atual nem comprovam resultado humano.

## Conferência tripla desta apresentação

1. Narrativa: título, pergunta, demonstração e conclusão descrevem placas em vídeo, sem calibragem ocular como requisito.
2. Evidência: números e gráficos vêm do mesmo JSON gerado pelo detector sobre MP4 decodificado; falhas e origem sintética são explicitadas.
3. Entrega: links, slides HTML/PDF, roteiro, MP4, relatório e scripts integram o pacote; a interface é verificada separadamente em navegador.
""")
    package = ROOT / "docs/HeatCity-pacote-apresentacao.zip"
    with zipfile.ZipFile(package, "w", zipfile.ZIP_DEFLATED) as z:
        paths = [
            OUT / "slides.html",
            OUT / "slides.pdf",
            OUT / "ROTEIRO.md",
            OUT / "Abrir-apresentacao.cmd",
            OUT / "deteccao-quadro.jpg",
            OUT / "deteccao-pdi.png",
            OUT / "referencias.md",
            OUT / "deteccao-resultados.svg",
            REPORTS / "deteccao-placas-benchmark.json",
            REPORTS / "HeatCity-deteccao-placas-exemplo.pdf",
            ROOT / "frontend/public/detection-demo.mp4",
            ROOT / "frontend/public/detection-demo.json",
            Path(__file__).resolve(),
            ROOT / "scripts/build_sign_video_demo.py",
        ]
        for path in paths:
            z.write(path, path.relative_to(ROOT))
    print(
        f"{len(slides)} slides; números medidos, gráfico, roteiro e pacote atualizados."
    )


if __name__ == "__main__":
    main()
