"""Apresentação PowerPoint editável do HeatCity."""

from urllib.parse import unquote

from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.text import MSO_AUTO_SIZE
from pptx.util import Inches, Pt

NAVY = "13233E"
TEAL = "007F73"
MINT = "39DBC0"
AMBER = "FFC26A"
PAPER = "F1F5FA"
INK = "263852"
MUTED = "53647C"
WHITE = "FFFFFF"


def build_presentation(out, slides, talks, summary, conditions, sources):
    deck = Presentation()
    deck.slide_width, deck.slide_height = Inches(13.333), Inches(7.5)
    deck.core_properties.title = "HeatCity — placas em vídeo"
    deck.core_properties.author = "Equipe HeatCity"
    pct = lambda v: f"{v:.1%}".replace(".", ",")

    for index, (title, lines, *_) in enumerate(slides, 1):
        slide = deck.slides.add_slide(deck.slide_layouts[6])
        dark = index in (1, 7)
        bg = NAVY if dark else PAPER
        slide.background.fill.solid()
        slide.background.fill.fore_color.rgb = RGBColor.from_string(bg)

        def rectangle(x, y, w, h, color, rounded=True, *, slide=slide):
            shape = slide.shapes.add_shape(
                MSO_SHAPE.ROUNDED_RECTANGLE if rounded else MSO_SHAPE.RECTANGLE,
                Inches(x),
                Inches(y),
                Inches(w),
                Inches(h),
            )
            shape.fill.solid()
            shape.fill.fore_color.rgb = RGBColor.from_string(color)
            shape.line.fill.background()
            if rounded:
                shape.adjustments[0] = 0.12

        def text(
            value,
            x,
            y,
            w,
            h,
            size=22,
            color=INK,
            bold=False,
            url=None,
            *,
            slide=slide,
        ):
            shape = slide.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))
            tf = shape.text_frame
            tf.auto_size = MSO_AUTO_SIZE.NONE
            tf.word_wrap = True
            tf.margin_left = tf.margin_right = tf.margin_top = tf.margin_bottom = 0
            for n, line in enumerate(str(value).split("\n")):
                p = tf.paragraphs[0] if n == 0 else tf.add_paragraph()
                p.space_before = p.space_after = Pt(0)
                p.line_spacing = 1.2
                run = p.add_run()
                run.text = line
                run.font.name = "Arial"
                run.font.size = Pt(size)
                run.font.bold = bold
                run.font.color.rgb = RGBColor.from_string(color)
                if url:
                    run.hyperlink.address = url

        def picture(name, x, y, w, h, *, slide=slide):
            from PIL import Image

            with Image.open(out / name) as im:
                factor = min(w / im.width, h / im.height)
                iw, ih = im.width * factor, im.height * factor
            slide.shapes.add_picture(
                str(out / name),
                Inches(x + (w - iw) / 2),
                Inches(y + (h - ih) / 2),
                width=Inches(iw),
                height=Inches(ih),
            )

        def card(heading, body, x, y, w=3.8, h=2.9, number=None):
            rectangle(x, y, w, h, WHITE)
            rectangle(x + 0.24, y + 0.28, 0.12, 0.45, TEAL)
            text(heading, x + 0.55, y + 0.27, w - 0.85, 0.85, 23, TEAL, True)
            text(body, x + 0.3, y + 1.18, w - 0.6, h - 1.35, 20)
            if number:
                text(number, x + 0.3, y + h - 0.48, w - 0.6, 0.3, 12, MUTED)

        text(
            "HEATCITY  /  CITIZENTECH",
            0.72,
            0.4,
            8,
            0.3,
            11,
            MINT if dark else TEAL,
            True,
        )
        if index != 1:
            text(title, 0.72, 0.95, 11.85, 0.65, 31, WHITE if dark else NAVY, True)
        rectangle(0.72, 6.98, 11.85, 0.015, MINT if dark else "D4DEEB", False)
        text(
            "PDI + VISÃO COMPUTACIONAL  •  EXEMPLO SINTÉTICO",
            0.72,
            7.12,
            10.5,
            0.2,
            9,
            MINT if dark else MUTED,
        )
        text(
            f"{index:02d} / {len(slides):02d}",
            11.75,
            7.09,
            0.85,
            0.25,
            10,
            WHITE if dark else MUTED,
        )

        if index == 1:
            text("Onde a placa\naparece?", 0.8, 1.1, 8.5, 1.65, 46, WHITE, True)
            text(
                "Localização e acompanhamento de placas em vídeo",
                0.8,
                3,
                10.9,
                0.5,
                24,
                MINT,
            )
            text(
                "MVP acadêmico  •  Global Solution  •  FIAP",
                0.8,
                3.68,
                11,
                0.4,
                17,
                "CAD6E8",
            )
            for n in range(4):
                y = 4.15 + n * 0.59
                rectangle(0.8, y, 11.75, 0.52, "213754")
                text(
                    "Nome completo: __________________________________________",
                    1.05,
                    y + 0.1,
                    9.0,
                    0.35,
                    18,
                    WHITE,
                )
                text("RM: ______", 10.45, y + 0.1, 1.8, 0.35, 18, MINT)
        elif index == 2:
            text(
                "Chegar ao hospital. Escolher o corredor. Encontrar a Recepção.",
                0.78,
                1.95,
                11.8,
                0.6,
                25,
                TEAL,
                True,
            )
            card(
                "A dificuldade",
                "Placa pequena, obstruída ou pouco visível antes de uma bifurcação.",
                0.75,
                2.95,
            )
            card(
                "A proposta",
                "Apoiar a equipe que revisa a sinalização a partir de uma captura do percurso.",
                4.76,
                2.95,
            )
            card(
                "O cidadão",
                "Pacientes, acompanhantes e visitantes que precisam se orientar.",
                8.77,
                2.95,
            )
            text(
                "ODS 3.8 e 11.7: contribuição pretendida. Caso ilustrativo; benefício humano ainda não medido.",
                0.85,
                6.22,
                11.6,
                0.5,
                16,
                MUTED,
            )
        elif index == 3:
            for n, (heading, body) in enumerate(
                [
                    (
                        "01  Cadastrar",
                        "Uma foto nítida e um recorte de cada placa: a ROI de referência.",
                    ),
                    (
                        "02  Procurar",
                        "Comparar os recortes com regiões do vídeo ou da webcam.",
                    ),
                    (
                        "03  Analisar",
                        "Registrar posição, falhas e tempo estimado por placa.",
                    ),
                ]
            ):
                card(heading, body, 0.75 + n * 4.01, 2.1, h=3.35)
            text(
                "Referências conhecidas • sem OCR • sem treinamento de modelo",
                0.85,
                5.94,
                11.5,
                0.5,
                22,
                TEAL,
                True,
            )
        elif index == 4:
            text(
                "Quadro → cinza → recortes em 7 escalas → correspondência",
                0.8,
                1.95,
                11.8,
                0.6,
                25,
                TEAL,
                True,
            )
            rectangle(0.75, 2.85, 11.85, 2.8, WHITE)
            picture("deteccao-pdi.png", 0.95, 3.0, 11.45, 2.5)
            text(
                "TM_CCOEFF_NORMED • similaridade ≥ 0,72 • margem espacial ≥ 0,06",
                0.85,
                5.95,
                11.6,
                0.45,
                19,
            )
            text(
                "Sete escalas, margens e variância do Laplaciano são escolhas adicionais do HeatCity.",
                0.85,
                6.47,
                11.6,
                0.3,
                15,
                MUTED,
            )
        elif index == 5:
            rectangle(0.75, 1.9, 7, 4.85, WHITE)
            picture("deteccao-quadro.jpg", 0.95, 2.1, 6.6, 4.45)
            text("4 placas conhecidas", 8.15, 2.15, 4.3, 0.6, 27, TEAL, True)
            text(
                "Recepção\nPronto Socorro\nAmbulatório\nTriagem",
                8.15,
                3.05,
                4.1,
                1.95,
                24,
            )
            text(
                "Foto gerada por IA.\nRetângulos calculados no primeiro quadro do vídeo sintético.",
                8.15,
                5.4,
                4.1,
                1.2,
                18,
                MUTED,
            )
        elif index == 6:
            card(
                "5,5 s",
                "Tempo detectado estimado da Recepção.",
                0.75,
                2.1,
                w=5.8,
                h=2.65,
            )
            card(
                "8 s",
                "Tempo estimado de cada uma das outras três placas.",
                6.8,
                2.1,
                w=5.8,
                h=2.65,
            )
            text(
                "Somamos intervalos de até 1,5 s entre detecções consecutivas.",
                0.85,
                5.15,
                11.6,
                0.65,
                23,
                TEAL,
                True,
            )
            text(
                "Falhas interrompem o trecho. Um quadro isolado soma zero.\nÉ tempo de detecção amostrado, não tempo de leitura humana.",
                0.85,
                6.0,
                11.6,
                0.7,
                19,
            )
        elif index == 7:
            for n, (value, label) in enumerate(
                [
                    (pct(summary["precision"]), "PRECISÃO"),
                    (pct(summary["recall"]), "RECALL"),
                    (str(summary["frames"]), "QUADROS"),
                ]
            ):
                x = 0.78 + n * 4.0
                rectangle(x, 2.1, 3.75, 2.0, "213754")
                text(value, x + 0.28, 2.4, 3.2, 0.85, 43, MINT, True)
                text(label, x + 0.3, 3.48, 3.1, 0.3, 15, WHITE, True)
            text(
                "66 acertos    /    0 falsos positivos    /    24 perdas    /    6 ausências corretas",
                0.85,
                4.65,
                11.6,
                0.85,
                24,
                WHITE,
            )
            text(
                "Resultado reproduzido pelo usuário: 96 anotações de presença/ausência.\nConfirma o exemplo controlado; não comprova desempenho em campo.",
                0.85,
                5.9,
                11.6,
                0.7,
                19,
                "CAD6E8",
            )
        elif index == 8:
            for n, (name, tp, fn, recall) in enumerate(conditions):
                y = 2.03 + n * 0.91
                text(name, 0.85, y, 3.1, 0.45, 20)
                rectangle(4, y + 0.02, 5.45, 0.35, "DCE5EF")
                if recall:
                    rectangle(4, y + 0.02, 5.45 * recall, 0.35, TEAL)
                text(pct(recall), 9.7, y - 0.02, 2, 0.45, 22, TEAL, True)
                text(f"TP {tp}  /  FN {fn}", 4, y + 0.44, 6, 0.26, 12, MUTED)
            rectangle(0.75, 5.95, 11.85, 0.77, "FFF0D7")
            text(
                "24 perdas no desfoque. As 6 ausências corretas da Recepção não são falhas.",
                1,
                6.16,
                11.3,
                0.4,
                18,
                INK,
                True,
            )
        elif index == 9:
            widths = [4.3, 2.4, 2.4, 2.6]
            headers = ["PLACA", "QUADROS", "TEMPO", "RECALL"]
            x = 0.78
            for label, w in zip(headers, widths):
                text(label, x, 2.08, w, 0.4, 14, TEAL, True)
                x += w
            for n, d in enumerate(summary["details"]):
                y = 2.82 + n * 0.67
                rectangle(0.75, y - 0.08, 11.85, 0.58, WHITE)
                values = [
                    d["name"],
                    f"{summary['counts'][d['name']]['detected']}/24",
                    str(d["detected_seconds"]).replace(".", ",") + " s",
                    pct(d["recall"]),
                ]
                x = 0.78
                for value, w in zip(values, widths):
                    text(value, x + 0.08, y, w - 0.16, 0.4, 20)
                    x += w
            text(
                "Acerto = placa correta + detecção aceita + IoU ≥ 0,5.",
                0.85,
                5.85,
                11.6,
                0.5,
                23,
                TEAL,
                True,
            )
            text(
                "IoU: sobreposição entre o retângulo encontrado e a referência conhecida.",
                0.85,
                6.4,
                11.6,
                0.35,
                17,
                MUTED,
            )
        elif index == 10:
            for n, (heading, body) in enumerate(
                [
                    (
                        "O que observamos",
                        "As perdas ocorreram no desfoque aplicado. Não houve correspondências ambíguas.",
                    ),
                    (
                        "O que testar",
                        "Posição frontal, antes da bifurcação, sem obstruções e com tamanho aparente suficiente.",
                    ),
                    (
                        "Como comparar",
                        "Mesmo trajeto, distância e iluminação. Conferir posições e medir acerto antes e depois.",
                    ),
                ]
            ):
                card(heading, body, 0.75 + n * 4.01, 2.1, h=3.6)
            text(
                "Baixa correlação não identifica uma causa única nem comprova um local ideal de instalação.",
                0.85,
                6.1,
                11.6,
                0.55,
                18,
                MUTED,
            )
        elif index == 11:
            for n, (heading, body) in enumerate(
                [
                    ("1  Abrir", "Executar Iniciar-HeatCity.cmd e escolher o exemplo."),
                    ("2  Aguardar", "Concluir os 24 quadros e conferir o relatório."),
                    (
                        "3  Exportar",
                        "Baixar diagnóstico JSON, CSV e relatório técnico.",
                    ),
                ]
            ):
                card(heading, body, 0.75 + n * 4.01, 2.1, h=2.9)
            rectangle(0.75, 5.5, 11.85, 1.2, "D9F3ED")
            text("Próxima evidência", 1, 5.68, 11.3, 0.35, 20, TEAL, True)
            text(
                "Vídeo real anotado; depois, teste com pessoas para verificar o benefício da sinalização.",
                1,
                6.15,
                11.1,
                0.4,
                18,
            )
        elif index == 12:
            for n, (label, url) in enumerate(sources):
                x = 0.75 + (n % 2) * 6.05
                y = 1.93 + (n // 2) * 1.2
                rectangle(x, y, 5.8, 1.06, WHITE)
                text(label, x + 0.22, y + 0.15, 5.35, 0.35, 17, TEAL, True, url)
                text(
                    unquote(url.removeprefix("https://")),
                    x + 0.22,
                    y + 0.57,
                    5.35,
                    0.4,
                    10,
                    MUTED,
                    url=url,
                )

        slide.notes_slide.notes_text_frame.text = talks[index - 1]

    deck.save(out / "slides.pptx")
