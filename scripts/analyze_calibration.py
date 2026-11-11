"""Recalcula diagnósticos reais e publica somente agregados e gráficos descritivos."""

import argparse
import csv
import hashlib
import json
import math
import sys
from dataclasses import asdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))
from heatcity.calibration import fit_calibration
from reportlab.graphics import renderPDF, renderSVG
from reportlab.graphics.shapes import Drawing, Line, Rect, String
from reportlab.lib import colors


def analyze(path):
    raw = Path(path).read_bytes()
    data = json.loads(raw)
    attempts = data.get("page_diagnostic", {}).get("calibrations", [data])
    rows = []
    for index, attempt in enumerate(attempts, 1):
        row = {"attempt": index, "references": len(attempt.get("features", []))}
        quality = attempt.get("quality") or {}
        if quality.get("basis") != "mesh":
            error = attempt.get("error", "")
            row.update(
                status="interrupted",
                reason="communication"
                if error == "Failed to fetch"
                else "incomplete_geometry",
            )
        else:
            result = asdict(
                fit_calibration(
                    **{
                        k: attempt[k]
                        for k in (
                            "features",
                            "targets",
                            "validation_features",
                            "validation_targets",
                            "validation_samples",
                        )
                        if k in attempt
                    }
                )
            )
            for key in (
                "validation_rmse",
                "unsupported_validation_samples",
                "approved",
            ):
                old, new = quality[key], result[key]
                if isinstance(old, bool):
                    matches = old == new
                else:
                    matches = math.isclose(old, new, rel_tol=1e-7, abs_tol=1e-9)
                if not matches:
                    raise ValueError(
                        f"Tentativa {index}: {key} diverge do diagnóstico original."
                    )
            total = sum(t["count"] for t in result["target_errors"])
            missing = result["unsupported_validation_samples"]
            row.update(
                status="completed",
                approved=result["approved"],
                rmse=result["validation_rmse"],
                median_rmse=result["validation_median_rmse"],
                p90=result["validation_p90"],
                axis_rmse=result["validation_axis_rmse"],
                total=total,
                unsupported=missing,
                predicted=total - missing,
                unsupported_percent=100 * missing / total,
                targets=[
                    {k: t[k] for k in ("expected", "count", "unsupported", "rmse")}
                    for t in result["target_errors"]
                ],
            )
        rows.append(row)
    return {
        "schema": 1,
        "source_sha256": hashlib.sha256(raw).hexdigest(),
        "source_label": "Diagnóstico completo fornecido pelo usuário em 11/11/2026",
        "method": "Recomputado com fit_calibration; RMSE euclidiano em coordenadas normalizadas, somente quadros com previsão; limite 0,100.",
        "unit": "tentativas, não participantes distintos",
        "attempts": rows,
    }


def charts(data):
    complete = [r for r in data["attempts"] if r["status"] == "completed"]
    ink = colors.HexColor("#163d32")
    red = colors.HexColor("#ac402e")
    drawings = []
    for kind in ("erro", "cobertura"):
        d = Drawing(500, 240)
        title = (
            "RMSE: somente quadros com previsão"
            if kind == "erro"
            else "Quadros de conferência: com e sem previsão"
        )
        d.add(String(12, 220, title, fontSize=14, fillColor=ink))
        for i, r in enumerate(complete):
            y = 160 - i * 65
            d.add(String(12, y + 15, f"Tentativa {r['attempt']}", fontSize=10))
            if kind == "erro":
                scale = 1200
                d.add(
                    Rect(110, y, r["rmse"] * scale, 30, fillColor=ink, strokeColor=None)
                )
                d.add(
                    String(
                        120 + r["rmse"] * scale, y + 10, f"{r['rmse']:.3f}", fontSize=11
                    )
                )
            else:
                good = 280 * r["predicted"] / r["total"]
                d.add(Rect(110, y, good, 30, fillColor=ink, strokeColor=None))
                d.add(
                    Rect(110 + good, y, 280 - good, 30, fillColor=red, strokeColor=None)
                )
                d.add(
                    String(
                        110,
                        y - 14,
                        f"{r['predicted']} com / {r['unsupported']} sem; total {r['total']}",
                        fontSize=10,
                    )
                )
        if kind == "erro":
            d.add(Line(230, 70, 230, 205, strokeColor=red, strokeDashArray=[4, 3]))
            d.add(
                String(240, 192, "Limite declarado: 0,100", fontSize=10, fillColor=red)
            )
        d.add(
            String(
                12,
                25,
                "Tentativas da mesma fonte; sem inferência populacional ou comparação causal.",
                fontSize=9,
            )
        )
        drawings.append((kind, d))
    for r in complete:
        d = Drawing(500, 360)
        d.add(
            String(
                12,
                340,
                f"Tentativa {r['attempt']}: erro por alvo de conferência",
                fontSize=14,
                fillColor=ink,
            )
        )
        for t in r["targets"]:
            x, y = t["expected"]
            px = 45 + x * 400
            py = 75 + (1 - y) * 230
            error = "sem previsão" if t["rmse"] is None else f"RMSE {t['rmse']:.3f}"
            d.add(
                Rect(
                    px - 34,
                    py - 15,
                    78,
                    32,
                    fillColor=colors.HexColor("#edf2ee"),
                    strokeColor=ink,
                )
            )
            d.add(String(px - 30, py + 4, error, fontSize=7))
            d.add(
                String(
                    px - 30, py - 7, f"sem: {t['unsupported']}/{t['count']}", fontSize=7
                )
            )
        d.add(
            String(
                12,
                28,
                "Posição = alvo conhecido. RMSE usa somente quadros previstos nesse alvo.",
                fontSize=9,
            )
        )
        d.add(
            String(
                12,
                14,
                "Origem no canto superior esquerdo. Não é mapa de atenção ou fixações.",
                fontSize=9,
            )
        )
        drawings.append((f"alvos-tentativa-{r['attempt']}", d))
    return drawings


def export(data, output):
    output = Path(output)
    output.mkdir(parents=True, exist_ok=True)
    (output / "analise-calibracao.json").write_text(
        json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    fields = [
        "attempt",
        "status",
        "reason",
        "references",
        "approved",
        "rmse",
        "median_rmse",
        "p90",
        "total",
        "predicted",
        "unsupported",
        "unsupported_percent",
    ]
    with (output / "tentativas.csv").open("w", newline="", encoding="utf-8") as file:
        writer = csv.DictWriter(file, fieldnames=fields, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(data["attempts"])
    for name, drawing in charts(data):
        renderSVG.drawToFile(drawing, str(output / f"{name}.svg"))
        renderPDF.drawToFile(drawing, str(output / f"{name}.pdf"))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    source = parser.add_mutually_exclusive_group(required=True)
    source.add_argument(
        "--diagnostic", help="JSON original privado; recalcula e confere os valores"
    )
    source.add_argument(
        "--aggregate",
        help="JSON agregado versionado; regenera visualizações sem dados oculares",
    )
    parser.add_argument("--output", default="docs/reports/evidencias")
    args = parser.parse_args()
    data = (
        analyze(args.diagnostic)
        if args.diagnostic
        else json.loads(Path(args.aggregate).read_text(encoding="utf-8"))
    )
    export(data, args.output)
    print("Análise exportada; nenhum vetor ocular ou frame facial foi publicado.")
