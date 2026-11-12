"""Reproduz vídeo sintético e medições reais do detector, sem observações humanas.

Executar da raiz: PYTHONPATH=backend .venv/bin/python scripts/build_sign_video_demo.py
Requer ffmpeg no PATH para codificar MP4/H.264. Não é necessário para usar o app.
"""

import hashlib
import json
import platform
import subprocess
import tempfile
from pathlib import Path

import cv2
import numpy as np
from heatcity.services.sign_detection import detect, report_pdf, summarize

ROOT = Path(__file__).resolve().parents[1]
FIXTURES = ROOT / "backend/heatcity/fixtures"
PUBLIC = ROOT / "frontend/public"
REPORTS = ROOT / "docs/reports"


def main():
    manifest = json.loads((FIXTURES / "hospital-study.json").read_text())
    scene = manifest["scenarios"][0]
    raw = (FIXTURES / scene["image"]).read_bytes()
    reference = cv2.imdecode(np.frombuffer(raw, np.uint8), cv2.IMREAD_COLOR)
    picture = cv2.resize(reference, (400, 448))
    segments, results = [], []
    with tempfile.TemporaryDirectory() as directory:
        path = Path(directory)
        for phase, condition in enumerate(
            ["referencia_nitida", "deslocamento", "desfoque", "recepcao_ausente"]
        ):
            x, y = (240, 95) if phase == 1 else (200, 60)
            frame = np.full((600, 800, 3), 35, np.uint8)
            frame[y : y + 448, x : x + 400] = picture
            annotations = []
            for plate in scene["plates"]:
                box = [
                    (x + plate["x"] * 400) / 800,
                    (y + plate["y"] * 448) / 600,
                    plate["width"] * 400 / 800,
                    plate["height"] * 448 / 600,
                ]
                absent = phase == 3 and plate["name"] == "Recepção"
                annotations.append(
                    dict(
                        name=plate["name"],
                        present=not absent,
                        **({} if absent else {"box": box}),
                    )
                )
                if absent:
                    a, b, c, d = box
                    frame[
                        int(b * 600) - 2 : int((b + d) * 600) + 2,
                        int(a * 800) - 2 : int((a + c) * 800) + 2,
                    ] = (100, 100, 100)
            if phase == 2:
                frame = cv2.GaussianBlur(frame, (21, 21), 6)
            cv2.putText(
                frame,
                f"SIMULACAO {phase + 1}/4 - {condition}",
                (20, 28),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.55,
                (255, 255, 255),
                1,
            )
            segments.append(
                {
                    "start": phase * 3,
                    "end": (phase + 1) * 3,
                    "condition": condition,
                    "annotations": annotations,
                }
            )
            for n in range(36):
                cv2.imwrite(str(path / f"{phase * 36 + n:04}.png"), frame)
        video = PUBLIC / "detection-demo.mp4"
        subprocess.run(
            [
                "ffmpeg",
                "-y",
                "-loglevel",
                "error",
                "-framerate",
                "12",
                "-i",
                str(path / "%04d.png"),
                "-c:v",
                "libx264",
                "-pix_fmt",
                "yuv420p",
                "-crf",
                "18",
                "-movflags",
                "+faststart",
                str(video),
            ],
            check=True,
        )
        # Measure decoded compressed video, not pristine source PNGs.
        capture = cv2.VideoCapture(str(video))
        for index in range(144):
            ok, frame = capture.read()
            if not ok:
                raise RuntimeError("Vídeo incompleto")
            if index % 6:
                continue
            segment = segments[index // 36]
            result = detect(frame, reference, scene["plates"], segment["annotations"])
            results.append(
                dict(
                    **result,
                    source="synthetic-demo",
                    time=index / 12,
                    condition=segment["condition"],
                    annotationSource="synthetic_geometry",
                )
            )
        capture.release()
    metadata = {
        "version": 1,
        "source": "synthetic_from_ai_image_not_human_study",
        "reference_sha256": hashlib.sha256(raw).hexdigest(),
        "plates": scene["plates"],
        "fps": 12,
        "duration": 12,
        "segments": segments,
    }
    (PUBLIC / "detection-demo.json").write_text(
        json.dumps(metadata, ensure_ascii=False, indent=2) + "\n"
    )
    REPORTS.mkdir(exist_ok=True)
    benchmark = {
        "runtime": {
            "python": platform.python_version(),
            "opencv": cv2.__version__,
            "numpy": np.__version__,
        },
        "method": "template_multiscale_v1",
        "video_sha256": hashlib.sha256(video.read_bytes()).hexdigest(),
        "note": "Resultados de 24 quadros correlacionados de um vídeo sintético, sem pessoas; não estimam desempenho real.",
        "summary": summarize(results),
        "frames": results,
    }
    (REPORTS / "deteccao-placas-benchmark.json").write_text(
        json.dumps(benchmark, ensure_ascii=False, indent=2) + "\n"
    )
    (REPORTS / "HeatCity-deteccao-placas-exemplo.pdf").write_bytes(
        report_pdf(results, title="HeatCity — experimento sintético reproduzível")
    )
    print(json.dumps(benchmark["summary"], ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
