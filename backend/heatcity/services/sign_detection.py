"""Localização clássica de placas por correlação multiescala, sem treinamento."""

import io
import math
from time import perf_counter
from xml.sax.saxutils import escape

import cv2
import numpy as np
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from .vision import aoi_crop

SCALES = (0.5, 0.6, 2 / 3, 0.8, 1.0, 1.2, 1.5)
SCORE_MIN = 0.72
GAP_MIN = 0.06


def iou(a, b):
    left, top = max(a[0], b[0]), max(a[1], b[1])
    right, bottom = min(a[0] + a[2], b[0] + b[2]), min(a[1] + a[3], b[1] + b[3])
    intersection = max(0, right - left) * max(0, bottom - top)
    return intersection / max(1e-12, a[2] * a[3] + b[2] * b[3] - intersection)


def _quality(gray):
    low, high = np.percentile(gray, [1, 99])
    return dict(
        mean=float(gray.mean()),
        contrast=float((high - low) / (high + low + 1e-6)),
        sharpness=float(cv2.Laplacian(gray, cv2.CV_64F).var()),
    )


def detect(frame, reference, plates, annotations=None):
    start = perf_counter()
    h, w = frame.shape[:2]
    factor = min(1, 800 / w)
    work = cv2.resize(frame, (max(1, int(w * factor)), max(1, int(h * factor))))
    gray = cv2.cvtColor(work, cv2.COLOR_BGR2GRAY)
    rh, rw = reference.shape[:2]
    ref = cv2.resize(reference, (gray.shape[1], max(1, round(rh * gray.shape[1] / rw))))
    refgray = cv2.cvtColor(ref, cv2.COLOR_BGR2GRAY)
    results = []
    for plate in plates:
        patch = aoi_crop(refgray, plate)
        candidates = []
        if min(patch.shape) >= 8 and float(patch.std()) >= 3:
            for scale in SCALES:
                tw, th = round(patch.shape[1] * scale), round(patch.shape[0] * scale)
                if tw < 20 or th < 12 or tw > gray.shape[1] or th > gray.shape[0]:
                    continue
                template = cv2.resize(patch, (tw, th))
                response = cv2.matchTemplate(gray, template, cv2.TM_CCOEFF_NORMED)
                for _ in range(2):
                    _, score, _, loc = cv2.minMaxLoc(response)
                    if not math.isfinite(score):
                        break
                    x, y = loc
                    candidates.append(
                        dict(
                            score=float(score),
                            box=[
                                x / gray.shape[1],
                                y / gray.shape[0],
                                tw / gray.shape[1],
                                th / gray.shape[0],
                            ],
                            scale=scale,
                        )
                    )
                    response[
                        max(0, y - th // 2) : min(response.shape[0], y + th // 2 + 1),
                        max(0, x - tw // 2) : min(response.shape[1], x + tw // 2 + 1),
                    ] = -2
        candidates.sort(key=lambda x: x["score"], reverse=True)
        best = candidates[0] if candidates else None
        second = (
            next((c for c in candidates[1:] if iou(c["box"], best["box"]) < 0.3), None)
            if best
            else None
        )
        score = best["score"] if best else 0
        gap = score - second["score"] if second else None
        status = (
            "detected"
            if score >= SCORE_MIN and (gap is None or gap >= GAP_MIN)
            else "ambiguous"
            if score >= 0.55
            else "not_found"
        )
        reasons = []
        suggestions = []
        quality = None
        if not best:
            reasons.append("Recorte com pouca variação ou escala não pesquisável neste quadro.")
            suggestions.append(
                "Revisar o recorte de referência e aumentar o tamanho aparente da placa."
            )
        elif status == "not_found":
            reasons.append("Similaridade abaixo do limite; não identifica a causa isoladamente.")
            suggestions.append(
                "Testar câmera mais frontal, referência compatível e placa maior no enquadramento."
            )
        if best and gap is not None and gap < GAP_MIN:
            reasons.append("Mais de uma posição tem correlação semelhante.")
            suggestions.append(
                "Verificar placas visualmente parecidas e usar títulos/pictogramas mais distinguíveis."
            )
        if best:
            x, y, bw, bh = best["box"]
            roi = aoi_crop(gray, dict(x=x, y=y, width=bw, height=bh))
            q = _quality(roi)
            base = _quality(cv2.resize(patch, (roi.shape[1], roi.shape[0])))
            quality = {
                **q,
                "reference_sharpness": base["sharpness"],
                "reference_contrast": base["contrast"],
                "height_pixels": bh * h,
            }
            if base["sharpness"] > 10 and q["sharpness"] < base["sharpness"] * 0.5:
                reasons.append(
                    "Menor variação pelo Laplaciano que a referência redimensionada; compatível com desfoque ou perda de detalhes."
                )
                suggestions.append(
                    "Melhorar foco, reduzir movimento e posicionar a placa onde tenha maior tamanho aparente."
                )
            if base["contrast"] > 0.05 and q["contrast"] < base["contrast"] * 0.65:
                reasons.append("Menor contraste local que a referência.")
                suggestions.append(
                    "Evitar sombras/reflexos e aumentar a separação visual entre texto e fundo."
                )
            if bh * h < 28:
                reasons.append("Altura aparente menor que 28 pixels nesta captura.")
                suggestions.append(
                    "Aumentar a placa ou aproximá-la do percurso observado pela câmera."
                )
            if min(x, y, 1 - x - bw, 1 - y - bh) < 0.01:
                reasons.append("Candidato próximo da borda do quadro; pode ser recortado.")
                suggestions.append(
                    "Testar posição mais central no campo de visão e sem obstruções."
                )
        results.append(
            dict(
                name=plate["name"],
                status=status,
                score=score,
                second_score=second["score"] if second else None,
                gap=gap,
                box=best["box"] if best else None,
                scale=best["scale"] if best else None,
                reasons=reasons,
                suggestions=suggestions,
                quality=quality,
            )
        )
    # Different identities cannot be confidently assigned to the same rectangle.
    for i, a in enumerate(results):
        for b in results[i + 1 :]:
            if (
                a["box"]
                and b["box"]
                and min(a["score"], b["score"]) >= 0.55
                and iou(a["box"], b["box"]) > 0.35
            ):
                if abs(a["score"] - b["score"]) < 0.08:
                    a["status"] = b["status"] = "ambiguous"
                    for item, other in [(a, b), (b, a)]:
                        item["reasons"].append(
                            f"A mesma região também se parece com {other['name']}."
                        )
                        item["suggestions"].append(
                            "Diferenciar títulos/pictogramas e ampliar o espaçamento entre placas; testar antes de reposicionar."
                        )
                else:
                    weaker = min((a, b), key=lambda r: r["score"])
                    weaker["status"] = "conflict"
                    weaker["reasons"].append(
                        "Outro template tem correspondência mais forte na mesma região."
                    )
    metrics = dict(tp=0, fp=0, fn=0, tn=0, abstentions=0, annotations=0, ious=[])
    for annotation in annotations or []:
        result = next(r for r in results if r["name"] == annotation["name"])
        metrics["annotations"] += 1
        positive = result["status"] == "detected"
        if annotation["present"]:
            overlap = iou(result["box"], annotation["box"]) if result["box"] else 0
            metrics["ious"].append(overlap)
            result["ground_truth_iou"] = overlap
            if positive and overlap >= 0.5:
                metrics["tp"] += 1
            else:
                metrics["fn"] += 1
                if positive:
                    metrics["fp"] += 1
        elif positive:
            metrics["fp"] += 1
        elif result["status"] == "not_found":
            metrics["tn"] += 1
        if result["status"] in ("ambiguous", "conflict"):
            metrics["abstentions"] += 1
    elapsed = (perf_counter() - start) * 1000
    return dict(
        version="template_multiscale_v1",
        width=w,
        height=h,
        processing_ms=elapsed,
        signs=results,
        metrics=metrics if annotations else None,
        policy=dict(
            score_min=SCORE_MIN,
            spatial_gap_min=GAP_MIN,
            identity_gap_min=0.08,
            scales=list(SCALES),
            iou_min=0.5,
        ),
        note="Correlação não é probabilidade de acerto. Sugestões são hipóteses de captura/posicionamento, não avaliação de atenção humana.",
    )


def summarize(frames):
    totals = {k: 0 for k in ("tp", "fp", "fn", "tn", "abstentions", "annotations")}
    times = []
    ious = []
    counts = {}
    for frame in frames:
        t = frame.get("processing_ms")
        if isinstance(t, (int, float)) and math.isfinite(t) and t >= 0:
            times.append(t)
        m = frame.get("metrics") or {}
        for k in totals:
            totals[k] += int(m.get(k, 0))
        ious.extend(
            float(v) for v in m.get("ious", []) if isinstance(v, (int, float)) and 0 <= v <= 1
        )
        for result in frame.get("signs", []):
            name = result["name"]
            c = counts.setdefault(name, dict(detected=0, ambiguous=0, not_found=0, conflict=0))
            if result["status"] in c:
                c[result["status"]] += 1
    return dict(
        frames=len(frames),
        **totals,
        precision=totals["tp"] / (totals["tp"] + totals["fp"])
        if totals["tp"] + totals["fp"]
        else None,
        recall=totals["tp"] / (totals["tp"] + totals["fn"])
        if totals["tp"] + totals["fn"]
        else None,
        mean_iou=float(np.mean(ious)) if ious else None,
        mean_processing_ms=float(np.mean(times)) if times else None,
        counts=counts,
    )


def report_pdf(frames, title="HeatCity — detecção de placas em vídeo"):
    output = io.BytesIO()
    styles = getSampleStyleSheet()
    story = []

    def text(value, style="BodyText"):
        story.extend([Paragraph(escape(str(value)), styles[style]), Spacer(1, 8)])

    text(title, "Title")
    text(
        "Problema: investigar a localização automática de placas cadastradas em imagens de ambientes coletivos. Detectar uma placa na câmera não comprova que uma pessoa a viu ou leu."
    )
    text("Método", "Heading2")
    text(
        "OpenCV: conversão para cinza, template matching TM_CCOEFF_NORMED em sete escalas fixas, comparação com picos espaciais alternativos e conflitos entre identidades. Sem treino de modelos. Entrada de vídeo amostrada; não se afirma rastreamento contínuo ou identificação sem referência. Correlação mínima 0,72, margem espacial 0,06 e conflito de identidade 0,08 são heurísticos publicados, não probabilidades."
    )
    s = summarize(frames)
    text("Resultados e referência", "Heading2")
    text(
        f"Quadros analisados: {s['frames']}; anotações conhecidas: {s['annotations']}; TP={s['tp']}, FP={s['fp']}, FN={s['fn']}, TN={s['tn']}; abstenções={s['abstentions']}."
    )

    def fmt(value):
        return "indisponível" if value is None else f"{value:.3f}"

    text(
        f"Precisão: {fmt(s['precision'])}; recall: {fmt(s['recall'])}; IoU médio dos positivos anotados: {fmt(s['mean_iou'])}; processamento médio: {fmt(s['mean_processing_ms'])} ms."
    )
    text(
        "TP exige nome correspondente, decisão detectada e IoU >= 0,5. Placas não anotadas não são tratadas como ausentes. Erro de localização de uma detecção positiva gera FP e FN. Abstenções permanecem visíveis; se a placa estiver presente, contam como FN. Sem anotações não há precisão de acerto mensurada. Quadros correlacionados não são participantes independentes."
    )
    rows = [["Placa", "Detectada", "Ambígua", "Ausente", "Conflito"]]
    for name, c in s["counts"].items():
        rows.append(
            [
                Paragraph(escape(name), styles["BodyText"]),
                *[str(c[k]) for k in ("detected", "ambiguous", "not_found", "conflict")],
            ]
        )
    table = Table(rows, colWidths=[180, 65, 65, 65, 65], repeatRows=1)
    table.setStyle(
        TableStyle(
            [
                ("GRID", (0, 0), (-1, -1), 0.4, colors.grey),
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#dfebe2")),
            ]
        )
    )
    story.append(table)
    text("Dificuldade, dúvidas e melhorias", "Heading2")
    for result in frames[-1].get("signs", []) if frames else []:
        text(result["name"], "Heading3")
        for reason in result.get("reasons", []):
            text(reason)
        for suggestion in dict.fromkeys(result.get("suggestions", [])):
            text("Hipótese a testar: " + suggestion)
    text("Limitações e conclusões", "Heading2")
    text(
        "Template matching é sensível a escala, inclinação, oclusão e mudanças de conteúdo. Baixo score não identifica sozinho qual fator causou a falha. Nitidez e contraste descrevem a região candidata e podem pertencer a uma correspondência incorreta. Sugestões de local significam hipóteses sobre visibilidade pela câmera; não demonstram melhor orientação ou acessibilidade humana. Precisam de nova captura/controlada para comparação."
    )
    text(
        "Referências: OpenCV Template Matching — https://docs.opencv.org/4.x/d4/dc6/tutorial_py_template_matching.html ; laboratório de aula — https://arnaldojr.github.io/cognitivecomputing/aulas/PDI/lab12/Template_matching.html ; código HeatCity, requisitos congelados e roteiro do repositório. Enunciado Cognitive Computing-GS2-2026, fornecido pela disciplina."
    )
    SimpleDocTemplate(output, leftMargin=42, rightMargin=42, topMargin=42, bottomMargin=42).build(
        story
    )
    return output.getvalue()
