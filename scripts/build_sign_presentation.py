"""Gera apresentação e pacote reproduzível a partir das medições versionadas."""

import html
import json
import zipfile
from pathlib import Path

import cv2
import numpy as np
import reportlab
from reportlab.lib.colors import HexColor
from reportlab.lib.utils import simpleSplit
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "docs/apresentacao"
REPORTS = ROOT / "docs/reports"
SOURCES = [
    (
        "OpenCV — Template Matching",
        "https://docs.opencv.org/4.x/d4/dc6/tutorial_py_template_matching.html",
    ),
    (
        "OpenCV — Laplacian Operator",
        "https://docs.opencv.org/4.x/d5/db5/tutorial_laplace_operator.html",
    ),
    (
        "Aula — Template matching",
        "https://arnaldojr.github.io/cognitivecomputing/aulas/PDI/lab12/Template_matching.html",
    ),
    (
        "Aula — Histograma e equalização",
        "https://arnaldojr.github.io/cognitivecomputing/aulas/PDI/lab03/atividade3.html",
    ),
    ("ONU — ODS 3", "https://sdgs.un.org/goals/goal3"),
    ("ONU — ODS 11", "https://sdgs.un.org/goals/goal11"),
]


def main():
    fonts = Path(reportlab.__file__).parent / "fonts"
    pdfmetrics.registerFont(TTFont("HeatCitySans", str(fonts / "Vera.ttf")))
    pdfmetrics.registerFont(TTFont("HeatCitySans-Bold", str(fonts / "VeraBd.ttf")))
    data = json.loads(
        (REPORTS / "deteccao-placas-benchmark.json").read_text(encoding="utf-8")
    )
    s = data["summary"]
    metric = lambda v: "indisponível" if v is None else f"{v:.3f}".replace(".", ",")
    percent = lambda v: "indisponível" if v is None else f"{v:.1%}".replace(".", ",")
    condition_names = {
        "referencia_nitida": "Imagem nítida",
        "deslocamento": "Deslocamento",
        "desfoque": "Desfoque",
        "recepcao_ausente": "Recepção ausente",
    }
    condition_rows = []
    for condition in dict.fromkeys(f["condition"] for f in data["frames"]):
        frames = [f for f in data["frames"] if f["condition"] == condition]
        tp = sum(f["metrics"]["tp"] for f in frames)
        fn = sum(f["metrics"]["fn"] for f in frames)
        condition_rows.append(
            (condition_names[condition], tp, fn, tp / (tp + fn) if tp + fn else 0)
        )
    graph = [
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 270" role="img" aria-label="Recall por condição do vídeo sintético">',
        '<rect width="900" height="270" fill="#f5f7f3"/>',
    ]
    for i, (name, tp, fn, recall) in enumerate(condition_rows):
        y = 35 + i * 55
        graph += [
            f'<text x="15" y="{y + 18}" font-family="sans-serif" font-size="17" fill="#173b31">{html.escape(name)}</text>',
            f'<rect x="270" y="{y}" width="{recall * 420}" height="28" fill="#28775c"/>',
            f'<text x="{285 + recall * 420}" y="{y + 20}" font-family="sans-serif" font-size="17">{percent(recall)} · TP {tp} / FN {fn}</text>',
        ]
    graph.append("</svg>")
    (OUT / "deteccao-resultados.svg").write_text("".join(graph), encoding="utf-8")
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
    original = cv2.imread(str(ROOT / "backend/heatcity/fixtures/hospital.jpg"))
    fixture = json.loads(
        (ROOT / "backend/heatcity/fixtures/hospital-reference.json").read_text(
            encoding="utf-8"
        )
    )
    plate = fixture["reference"]["plates"][0]
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
        f"{d['name']}: {s['counts'][d['name']]['detected']}/{s['frames']} quadros; {str(d['detected_seconds']).replace('.', ',')} s estimados; recall {percent(d['recall'])}."
        for d in details
    ]
    slides = [
        (
            "HeatCity — placas em vídeo",
            [
                "Onde a placa cadastrada aparece e por quanto tempo é detectada?",
                "Foto com placas cadastradas + vídeo ou webcam → posição, tempo estimado e relatório por placa.",
                "MVP de PDI e visão computacional · CitizenTech · FIAP. Exemplo sintético reproduzido pelo usuário.",
            ],
        ),
        (
            "Problema: encontrar a Recepção",
            [
                "Um visitante chega ao hospital e precisa encontrar a Recepção antes de escolher o corredor. Uma placa pouco visível pode exigir retorno ou pedido de ajuda.",
                "CitizenTech: apoiar equipes que revisam a sinalização para pacientes, acompanhantes e visitantes. O caso é ilustrativo; falta escuta e teste em campo.",
                "Contribuição pretendida: ODS 3.8, acesso a serviços de saúde; ODS 11.7, espaços coletivos acessíveis. Benefício humano ainda não medido.",
            ],
        ),
        (
            "Escopo: referências conhecidas",
            [
                "Entrada: vídeo de arquivo ou webcam. Saída: posição da placa, estado da detecção e tempo estimado por identidade.",
                "Uso proposto: cidadãos relatam barreiras; a equipe registra o percurso; manutenção testa mudanças e verifica o benefício com os usuários.",
                "Placas são cadastradas por imagem e recorte. Não há OCR, detecção de placas desconhecidas nem treinamento de um modelo.",
                "As anotações servem para medir acerto, após a detecção; não ensinam nem corrigem as respostas do algoritmo.",
            ],
        ),
        (
            "PDI e visão computacional",
            [
                "Quadros até 800 px de largura → tons de cinza → busca dos recortes em 7 escalas por TM_CCOEFF_NORMED.",
                "Aceitação: similaridade ≥ 0,72; margem espacial ≥ 0,06; margem entre identidades em conflito ≥ 0,08. Regras fixas, sem treino.",
                "PDI visual: recorte original, cinza, Laplaciano e histograma. Contraste, nitidez e tamanho são indícios; não comprovam legibilidade.",
            ],
            "deteccao-pdi.png",
        ),
        (
            "Cenário, recortes e posição",
            [
                "Uma foto de referência, quatro AOIs: Recepção, Pronto Socorro, Ambulatório e Triagem. Cada recorte é um template.",
                "Na imagem abaixo, os retângulos são localizações calculadas pelo detector no primeiro quadro do vídeo.",
                "A foto foi gerada por IA; o vídeo aplica transformações controladas. As caixas são normalizadas entre 0 e 1.",
            ],
            "deteccao-quadro.jpg",
        ),
        (
            "Por quanto tempo foi detectada?",
            [
                "Somar Δt apenas quando a mesma placa é detectada em dois quadros consecutivos da mesma fonte, com 0 < Δt ≤ 1,5 s.",
                "Falha, ambiguidade ou intervalo maior interrompe o trecho. Um quadro isolado representa 0 s.",
                "Recepção: 5,5 s; demais placas: 8 s. São intervalos amostrados, não duração física exata de visibilidade ou tempo de leitura.",
                "Exemplo: 24 quadros fixos reprocessados na API. Vídeo próprio/webcam: até 2 amostras/s, podendo perder detalhes entre capturas.",
            ],
        ),
        (
            "Resultado conferido do exemplo",
            [
                "MP4 de 12 s / 12 FPS construído com imagem de IA: nitidez, deslocamento, desfoque e remoção da Recepção.",
                f"24 quadros decodificados; {s['annotations']} anotações geométricas conhecidas. TP {s['tp']}, FP {s['fp']}, FN {s['fn']}, TN {s['tn']}.",
                f"Precisão = {s['tp']}/({s['tp']}+{s['fp']}) = {percent(s['precision'])}; recall = {s['tp']}/({s['tp']}+{s['fn']}) = {percent(s['recall'])}.",
                "O relatório enviado pelo usuário reproduziu contagens e tempos esperados. Isso confirma o exemplo controlado; não comprova desempenho em campo.",
            ],
        ),
        (
            "Onde o detector acertou e falhou",
            [
                f"{name}: TP {tp}, FN {fn}, recall {percent(recall)}."
                for name, tp, fn, recall in condition_rows
            ]
            + [
                "No último trecho, 6 ausências da Recepção foram reconhecidas corretamente. As 24 perdas do desfoque continuam contabilizadas."
            ],
            "deteccao-resultados.svg",
        ),
        (
            "Análise final por placa",
            plate_lines
            + [
                "Precisão por placa: 100% entre detecções anotadas. Acerto exige nome correto e IoU ≥ 0,5; IoU é a sobreposição entre caixas.",
                f"IoU médio dos positivos anotados no benchmark: {metric(s['mean_iou'])}. Não significa {percent(s['mean_iou'])} de probabilidade de acerto.",
            ],
        ),
        (
            "Dúvidas e sugestões de local",
            [
                "Neste exemplo: 0 correspondências ambíguas; as perdas coincidem com o desfoque aplicado. Não houve confusão entre identidades nas detecções aceitas.",
                "Em vídeo real, baixa correlação pode ter várias causas. Contraste, nitidez e borda só fundamentam alertas geométricos em detecções confirmadas.",
                "Testar placa frontal ao percurso, antes da bifurcação, sem obstruções e com tamanho aparente suficiente. São hipóteses de melhoria.",
                "Comparar antes/depois com trajeto, distância e iluminação equivalentes; anotar as caixas e medir acerto. Não há local ideal comprovado.",
            ],
        ),
        (
            "Demonstração e próxima evidência",
            [
                "1. Iniciar-HeatCity.cmd → Ver exemplo funcionando.",
                "2. Aguardar 24/24 quadros e o relatório. Mostrar 100% de precisão, 73,3% de recall e as ausências separadas das falhas.",
                "3. Para outro ambiente: Começar com meu vídeo → cadastrar foto e placas → selecionar vídeo e analisar.",
                "4. Baixar PDF, JSON e CSV. Próxima evidência: vídeo real anotado; depois, verificar com pessoas se a sinalização ajuda.",
                "MVP funcional no ensaio controlado; perspectiva, desfoque e generalização para outros ambientes permanecem limites.",
            ],
        ),
        (
            "Fontes e reprodução",
            [
                "OpenCV: Template Matching e Laplacian Operator. Aulas: histograma, filtros de convolução e template matching. Links no material anexo.",
                "Requisitos: Cognitive Computing-GS2-2026.pdf. Tema CitizenTech fornecido pela equipe; metas ODS 3.8 e 11.7 na documentação da ONU.",
                "Código: github.com/FIAP-4SIZ/HeatCity, branch develop. Benchmark, vídeo e notebook executado estão versionados.",
                "Reprodução: scripts/build_sign_video_demo.py e scripts/build_sign_presentation.py. Fontes completas: referencias.md; fala e conceitos: ROTEIRO.txt.",
            ],
        ),
    ]
    talks = [
        "O HeatCity procura placas previamente cadastradas em vídeo ou webcam. Ele mostra onde aparecem, por quanto tempo são detectadas e quais dificuldades merecem investigação.",
        "Imagine chegar a um hospital e não encontrar a Recepção antes de escolher o corredor. Queremos apoiar a revisão dessa sinalização. A relação com CitizenTech é a orientação do cidadão; o benefício ainda precisa ser testado.",
        "Cadastramos uma foto e delimitamos cada placa. O programa procura essas referências, sem reconhecer texto ou treinar um modelo. As anotações de posição são usadas depois, apenas para conferir o acerto.",
        "Aqui vemos o processamento digital de imagens: recorte, cinza, Laplaciano e histograma. A busca compara cada recorte em sete tamanhos. Similaridade e margens mínimas evitam aceitar qualquer região parecida.",
        "São quatro placas da mesma foto. Os retângulos mostram as posições encontradas no primeiro quadro. A imagem foi gerada por IA e o vídeo é sintético; não é uma gravação de um hospital real.",
        "O tempo acumula apenas entre detecções consecutivas. Uma falha interrompe a contagem. Recepção teve 5,5 segundos e as demais, 8 segundos. É uma estimativa amostrada, não tempo de leitura.",
        f"O relatório reproduziu o esperado: {s['tp']} acertos, {s['fp']} falsos positivos, {s['fn']} perdas e {s['tn']} ausências corretas. Precisão foi {percent(s['precision'])}, mas recall foi {percent(s['recall'])}: o sistema deixou passar placas presentes.",
        "O gráfico separa os quatro trechos. Nitidez e deslocamento tiveram todas as placas recuperadas. O desfoque provocou as 24 perdas. No final, não encontrar a Recepção removida foi a resposta correta.",
        "Recepção apareceu em 12 dos 24 quadros; as outras, em 18. Isso inclui seis ausências reais da Recepção. Acerto exige identidade correta e sobreposição suficiente entre a caixa encontrada e a anotada.",
        "O desfoque é conhecido porque o aplicamos no vídeo. Em uma captura real, similaridade baixa não revela sozinha a causa. Posição frontal, tamanho e iluminação são melhorias a testar, não conclusões comprovadas.",
        "Vou abrir o exemplo, aguardar o relatório e mostrar as exportações. Para outro ambiente, cadastramos uma foto e usamos um vídeo das mesmas placas. A próxima evidência é testar uma captura real anotada.",
        "Usamos OpenCV e conteúdos das aulas de PDI e template matching. Código, fontes, vídeo e notebook estão no material. O exemplo funciona de forma reproduzível; ainda faltam avaliação em campo e benefício demonstrado aos cidadãos.",
    ]
    assert len(talks) == len(slides)
    explanation = """EXPLICAÇÃO DO PROGRAMA E DOS TERMOS

O HeatCity usa visão computacional (extração de informações de imagens ou vídeos), com OpenCV (biblioteca de processamento de imagens), para localizar placas conhecidas. A equipe cadastra uma foto e marca AOIs (áreas de interesse que delimitam as placas). Cada recorte vira um template (imagem de referência usada na busca).

O vídeo é dividido em frames (quadros individuais). O PDI (processamento digital de imagens) redimensiona os quadros e converte para escala de cinza (intensidade de 0 a 255). O template matching multiescala (comparação do recorte em diferentes tamanhos) usa correlação normalizada (medida de semelhança dos padrões de intensidade). O maior score (valor de similaridade) e a margem (diferença para outra hipótese) precisam superar limiares (limites fixos de aceitação). Score não é probabilidade nem precisão medida. Não há treinamento de modelo.

O sistema registra bounding boxes (retângulos que localizam as placas) e faz acompanhamento temporal (associação das detecções da mesma placa ao longo dos quadros). Soma intervalos de até 1,5 segundo entre detecções consecutivas; falhas interrompem o trecho. Não usa fluxo óptico nem prevê posições entre amostras.

O painel de PDI mostra histograma (distribuição das intensidades dos pixels), contraste local (separação entre intensidades claras e escuras) e Laplaciano (filtro que destaca variações espaciais). Ele usa convolução (aplicação de uma máscara sobre pixels vizinhos). A variância do Laplaciano (dispersão da resposta do filtro) ajuda a descrever perda de detalhes; não prova legibilidade. O contraste usa percentis (pontos de corte na distribuição das intensidades), e não apenas o histograma ilustrado.

Com ground truth (posição e presença de referência conhecidas), calculamos IoU (área de interseção dividida pela união das caixas). Um acerto exige nome correto, detecção aceita e IoU de pelo menos 0,5. TP (detecção correta), FP (detecção incorreta), FN (placa presente não recuperada) e TN (ausência corretamente reconhecida) alimentam precisão (TP dividido por TP+FP) e recall (TP dividido por TP+FN). Uma localização incorreta aceita pode gerar FP e FN. Sem anotações, essas taxas não são medidas.

O exemplo tem 24 quadros fixos e 96 anotações, não 96 pessoas. As respostas são recalculadas a partir do MP4, não copiadas de resultados prontos. As sugestões de posição orientam novas capturas comparáveis. O sistema não mede atenção, leitura ou acessibilidade humana; esses benefícios precisam de testes com pessoas.
"""
    speech = "HEATCITY — ROTEIRO DE FALA\nExemplo sintético conferido · apresentação de aproximadamente 5–7 minutos, incluindo demonstração.\n\n"
    speech += "\n\n".join(
        f"SLIDE {i} — {slide[0]}\n{talk}"
        for i, (slide, talk) in enumerate(zip(slides, talks), 1)
    )
    speech += (
        "\n\nPLANO B\nSe a demonstração não abrir, mostrar slides.pdf e o relatório incluído no pacote. Informar que são resultados gravados do exemplo sintético.\n\n"
        + explanation
    )
    # BOM makes accents reliable in Windows Notepad as well as UTF-8 editors.
    (OUT / "ROTEIRO.txt").write_text(speech, encoding="utf-8-sig")
    style = """*{box-sizing:border-box}body{margin:0;background:#102820;color:#173b31;font:22px/1.45 system-ui,sans-serif}.slide{background:#f5f7f3;margin:32px auto;padding:50px 65px;max-width:1200px;min-height:675px;position:relative}h1{font-size:44px;line-height:1.12;letter-spacing:-1px;margin:0 0 30px}li{margin:15px 0}img{display:block;max-height:295px;max-width:90%;margin:20px auto}small{position:absolute;bottom:20px;right:35px;font-size:13px}.visual{font-size:18px}.visual li{margin:8px 0}nav{text-align:center;color:white;font-size:16px;padding:15px}nav a{color:#aff2ca}@page{size:landscape;margin:0}@media print{body{background:white}.slide{width:100vw;height:100vh;max-width:none;min-height:0;margin:0;break-after:page;padding:35px 55px}h1{font-size:36px}body{font-size:18px}nav{display:none}img{max-height:240px}}"""
    blocks = []
    pdf = canvas.Canvas(str(OUT / "slides.pdf"), pagesize=(960, 540))
    pdf.setTitle("HeatCity — localização e acompanhamento de placas em vídeo")
    pdf.setAuthor("Equipe HeatCity")
    for i, (title, lines, *visual) in enumerate(slides, 1):
        links = (
            '<p style="font-size:15px">'
            + " · ".join(
                f'<a href="{url}">{html.escape(label)}</a>' for label, url in SOURCES
            )
            + "</p>"
            if i == len(slides)
            else ""
        )
        blocks.append(
            f'<section id="s{i}" class="slide {"visual" if visual else ""}"><h1>{html.escape(title)}</h1><ul>'
            + "".join(f"<li>{html.escape(line)}</li>" for line in lines)
            + "</ul>"
            + (
                f'<img src="{visual[0]}" alt="Evidência visual do experimento">'
                if visual
                else ""
            )
            + links
            + f"<small>HeatCity · {i}/{len(slides)} · exemplo sintético</small></section>"
        )
        pdf.setFillColor(HexColor("#f5f7f3"))
        pdf.rect(0, 0, 960, 540, fill=1, stroke=0)
        pdf.setFillColor(HexColor("#173b31"))
        pdf.setFont("HeatCitySans-Bold", 27)
        pdf.drawString(45, 492, title.replace("—", "-"))
        y = 450
        for line in lines:
            pdf.setFont("HeatCitySans", 16)
            for part in simpleSplit(
                line.replace("≥", ">=")
                .replace("≤", "<=")
                .replace("Δ", "delta ")
                .replace("→", "->"),
                "HeatCitySans",
                16,
                860,
            ):
                pdf.drawString(50, y, part)
                y -= 24
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
                pdf.setFont("HeatCitySans", 12)
                pdf.drawString(50, row_y, name)
                pdf.drawString(730, row_y, f"Recall {percent(recall)}")
                pdf.setFillColor(HexColor("#28775c"))
                pdf.rect(270, row_y - 2, recall * 420, 13, fill=1, stroke=0)
        if i == len(slides):
            pdf.setFillColor(HexColor("#173b31"))
            pdf.setFont("HeatCitySans", 12)
            for k, (label, url) in enumerate(SOURCES):
                x, link_y = 50 + (k % 2) * 440, 130 - (k // 2) * 28
                pdf.drawString(x, link_y, label.replace("—", "-"))
                pdf.linkURL(url, (x, link_y - 3, x + 400, link_y + 14))
        pdf.setFillColor(HexColor("#173b31"))
        pdf.setFont("HeatCitySans", 10)
        pdf.drawRightString(
            925, 15, f"HeatCity | {i}/{len(slides)} | exemplo sintetico"
        )
        pdf.showPage()
    pdf.save()
    (OUT / "slides.html").write_text(
        '<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>HeatCity — placas em vídeo</title><style>'
        + style
        + '</style><nav>HeatCity · Localização e acompanhamento de placas em vídeo · <a href="../../frontend/public/detection-demo.mp4">Vídeo sintético</a> · <a href="../reports/HeatCity-deteccao-placas-exemplo.pdf">Relatório detalhado</a> · <a href="ROTEIRO.txt">Roteiro de fala TXT</a> · <a href="referencias.md">Fontes completas</a></nav>'
        + "".join(blocks)
        + '<script>let i=1;const n=document.querySelectorAll(".slide").length;addEventListener("keydown",e=>{if(e.key==="ArrowRight"||e.key==="PageDown")i=Math.min(n,i+1);else if(e.key==="ArrowLeft"||e.key==="PageUp")i=Math.max(1,i-1);else return;document.getElementById("s"+i).scrollIntoView();e.preventDefault()})</script></html>',
        encoding="utf-8",
    )
    (OUT / "ROTEIRO.md").write_text(
        """# HeatCity — localização e acompanhamento de placas em vídeo

A pergunta é: **onde a placa cadastrada aparece e por quanto tempo é detectada?**
Esta é a apresentação do detector de placas em vídeo.

**Fala curta por slide e explicação dos termos:** [ROTEIRO.txt](ROTEIRO.txt).
O relatório enviado pelo usuário reproduziu os resultados esperados: 24 quadros,
66 TP, 0 FP, 24 FN e 6 TN; precisão 100%, recall 73,3%; Recepção 5,5 s e demais 8 s.
Conferência aprovada para este exemplo controlado, sem generalização para vídeo real.

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
- Ainda faltam: medições em captura real e evidências de benefício para cidadãos. O PDF da disciplina não exige relato ou entrevista formal na apresentação. Não há ganho de orientação humana comprovado.
- O projeto fornece scripts reproduzíveis e resultados sintéticos identificados; não apresenta resultados humanos.

## Conferência tripla desta apresentação

1. Narrativa: título, pergunta, demonstração e conclusão descrevem placas em vídeo, com catálogo de referências e sem treinamento.
2. Evidência: números e gráficos vêm do mesmo JSON gerado pelo detector sobre MP4 decodificado; falhas e origem sintética são explicitadas.
3. Entrega: links, slides HTML/PDF, roteiro, MP4, relatório, scripts e notebook executado integram a entrega; a interface é verificada separadamente em navegador.
""",
        encoding="utf-8",
    )
    package = ROOT / "docs/HeatCity-pacote-apresentacao.zip"
    with zipfile.ZipFile(package, "w", zipfile.ZIP_DEFLATED) as z:
        paths = [
            OUT / "slides.html",
            OUT / "slides.pdf",
            OUT / "ROTEIRO.md",
            OUT / "ROTEIRO.txt",
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
            ROOT / "notebooks/analise-deteccao-placas.ipynb",
            ROOT / "notebooks/requirements.txt",
            ROOT / "scripts/build_analysis_notebook.py",
            ROOT / "docs/verificacao-requisitos.md",
            ROOT / "docs/verificacao-exemplo-sintetico.md",
        ]
        for path in paths:
            z.write(path, path.relative_to(ROOT))
    print(
        f"{len(slides)} slides; números medidos, gráfico, roteiro e pacote atualizados."
    )


if __name__ == "__main__":
    main()
