"""Gera demonstração offline de PDI usando a mesma implementação da aplicação."""

import base64
import io
import json
import sys
from pathlib import Path
from xml.sax.saxutils import escape

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))
import cv2
from heatcity.services.vision import decode_scene, demo_scene, pdi_preview, png_url
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import Image, PageBreak, Paragraph, SimpleDocTemplate, Spacer

ROOT = Path(__file__).resolve().parents[1]


def build():
    scene = demo_scene()
    image = decode_scene(scene["image"])
    preview = pdi_preview(image, scene["plates"])
    annotated = image.copy()
    for i, p in enumerate(scene["plates"], 1):
        x, y, w, h = [
            int(p[k] * scale)
            for k, scale in [("x", 1000), ("y", 600), ("width", 1000), ("height", 600)]
        ]
        cv2.rectangle(annotated, (x, y), (x + w, y + h), (0, 140, 255), 3)
        cv2.putText(
            annotated,
            f"AOI {i}",
            (x, y - 8),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.6,
            (0, 70, 150),
            2,
        )
    annotated = png_url(annotated)
    styles = getSampleStyleSheet()
    story = []

    def text(value, style="BodyText"):
        story.extend([Paragraph(escape(value), styles[style]), Spacer(1, 10)])

    def picture(url, width, height):
        story.append(
            Image(
                io.BytesIO(base64.b64decode(url.split(",")[1])),
                width=width,
                height=height,
            )
        )

    text("HeatCity · PDI visual", "Title")
    text(
        "Cena didática sintética, não fotografia de um espaço real. As caixas são áreas definidas pelo operador, não reconhecimento automático de placas."
    )
    picture(annotated, 480, 288)
    text(
        "Fluxo: imagem BGR → cinza → recorte de AOI → histograma/percentis e Laplaciano → descritores. Os descritores são calculados diretamente na imagem de referência."
    )
    text(
        "Métricas descrevem pixels; não comprovam leitura, atenção ou acessibilidade. Arquivo gerado por scripts/build_pdi_demo.py com a mesma função pdi_preview da API."
    )
    cards = []
    for i, r in enumerate(preview["regions"], 1):
        story.append(PageBreak())
        text(f"AOI {i} · {r['name']}", "Heading1")
        for key, label in [
            ("original", "Recorte original"),
            ("gray", "Conversão em cinza"),
            (
                "laplacian",
                "Magnitude do Laplaciano (máximo local normalizado para exibição)",
            ),
        ]:
            text(label, "Heading3")
            picture(r[key], 360, 144)
        explanations = [
            f"Área: {r['area_percent']:.2f}% da cena (100 × largura × altura normalizadas); recorte com {r['pixel_count']} pixels.",
            f"Intensidade média: {r['luminance']:.1f}/255. Cinza ≈ 0,299R + 0,587G + 0,114B; não é luminância física.",
            f"Contraste local: {r['local_contrast']:.3f}; P1={r['p1']:.2f}, P99={r['p99']:.2f}; (P99−P1)/(P99+P1+10^-6). Não é razão WCAG texto/fundo.",
            f"Variância do Laplaciano: {r['sharpness']:.1f}. Também depende de ruído, textura e resolução; sem limite universal. A visualização normalizada não permite comparar brilho entre AOIs.",
        ]
        for value in explanations:
            text(value)
        cards.append(
            f'<article><h2>AOI {i} · {escape(r["name"])}</h2><div class="images">'
            + "".join(
                f'<figure><img src="{r[k]}" alt="{label}"/><figcaption>{label}</figcaption></figure>'
                for k, label in [
                    ("original", "Original"),
                    ("gray", "Cinza"),
                    ("laplacian", "Laplaciano visual"),
                ]
            )
            + "</div>"
            + "".join(f"<p>{escape(t)}</p>" for t in explanations)
            + "</article>"
        )
    target = ROOT / "docs/reports/HeatCity-PDI-visual.pdf"
    SimpleDocTemplate(
        str(target),
        title="HeatCity · PDI visual",
        author="HeatCity",
        leftMargin=42,
        rightMargin=42,
        topMargin=35,
        bottomMargin=35,
    ).build(story)
    html = (
        """<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>HeatCity · PDI visual</title><style>body{margin:0;background:#f4f5f1;color:#163d32;font:18px/1.5 'Segoe UI',sans-serif}main{max-width:1100px;margin:auto;padding:30px}article{background:white;border:1px solid #ccd8ce;border-radius:14px;padding:25px;margin:25px 0}img{max-width:100%}.scene{width:100%}.images{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}figure{margin:0}figure img{width:100%;height:140px;object-fit:contain;background:#18241e}figcaption{font-size:15px}a{color:#215b43}small{display:block}@media(max-width:650px){.images{grid-template-columns:1fr}}</style><main><a href="slides.html">← Slides</a><h1>Do cenário ao indicador de imagem</h1><p>Cena didática sintética. AOIs definidas pelo operador; sem reconhecimento automático de placas ou inferência de atenção.</p>"""
        + f'<img class="scene" src="{annotated}" alt="Cena didática com três áreas de interesse numeradas"/>'
        + "".join(cards)
        + """<p>Reproduzir: python scripts/build_pdi_demo.py. Na aplicação, abra PDI visual para selecionar placas e explorar o histograma de cada uma.</p></main></html>"""
    )
    (ROOT / "docs/apresentacao/pdi-visual.html").write_text(html, encoding="utf-8")
    metrics = [
        {
            k: v
            for k, v in r.items()
            if k not in ("original", "gray", "laplacian", "histogram")
        }
        for r in preview["regions"]
    ]
    (ROOT / "docs/reports/evidencias/pdi-cena-didatica.json").write_text(
        json.dumps(
            {
                "source": "demo_scene: cena sintética, não participantes reais",
                "regions": metrics,
            },
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    print("PDF, HTML offline e métricas da cena didática gerados.")


if __name__ == "__main__":
    build()
