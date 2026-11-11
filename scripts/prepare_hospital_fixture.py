"""Empacota os dois arquivos originais sem editar pixels, para carga como estudo normal."""

import argparse
import base64
import hashlib
import io
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))
from heatcity.schemas import HospitalExampleInput
from heatcity.services.vision import decode_scene
from PIL import Image

BOXES = [
    [
        (120, 407, 290, 110),
        (421, 409, 273, 108),
        (705, 409, 295, 108),
        (1012, 409, 276, 108),
    ],
    [
        (991, 408, 315, 109),
        (124, 407, 277, 109),
        (413, 408, 297, 109),
        (722, 409, 259, 108),
    ],
]
NAMES = ["Recepção", "Pronto Socorro", "Ambulatório", "Triagem"]


def prepare(paths):
    scenes = []
    shape = None
    for index, path in enumerate(paths):
        path = Path(path)
        with Image.open(io.BytesIO(path.read_bytes())) as picture:
            mime = {"PNG": "png", "JPEG": "jpeg", "WEBP": "webp"}.get(picture.format)
        if not mime:
            raise ValueError("Conteúdo deve ser PNG, JPEG ou WebP.")
        url = (
            f"data:image/{mime};base64," + base64.b64encode(path.read_bytes()).decode()
        )
        image = decode_scene(url)
        if shape is not None and image.shape != shape:
            raise ValueError("As imagens A e B devem ter a mesma resolução.")
        shape = image.shape
        if abs(shape[1] / shape[0] - 1371 / 1536) > 0.01:
            raise ValueError(
                "Proporção diferente das imagens fornecidas. Confira as AOIs antes de versionar."
            )
        scenes.append(
            {
                "name": f"Cenário simulado {'AB'[index]} · IA",
                "image": url,
                "plates": [
                    {
                        "name": name,
                        "x": x / 1371,
                        "y": y / 1536,
                        "width": width / 1371,
                        "height": height / 1536,
                    }
                    for name, (x, y, width, height) in zip(NAMES, BOXES[index])
                ],
            }
        )
    return HospitalExampleInput(scenarios=tuple(scenes)).model_dump()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("image_a")
    parser.add_argument("image_b")
    parser.add_argument(
        "--output",
        default=str(
            Path(__file__).resolve().parents[1]
            / "backend/heatcity/fixtures/hospital-study.json"
        ),
    )
    args = parser.parse_args()
    data = prepare([args.image_a, args.image_b])
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    hashes = {}
    for index, scene in enumerate(data["scenarios"]):
        header, encoded = scene["image"].split(",", 1)
        suffix = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}[
            header[5:].split(";")[0]
        ]
        filename = f"hospital-{'ab'[index]}.{suffix}"
        raw = base64.b64decode(encoded)
        (output.parent / filename).write_bytes(raw)
        hashes[filename] = hashlib.sha256(raw).hexdigest()
        scene["image"] = filename
    data["source"] = (
        "Imagens fornecidas pelo usuário como geradas por IA; originais preservados sem edição."
    )
    data["source_sha256"] = hashes
    output.write_text(
        json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(
        f"Base preparada em {output}; bytes originais preservados. Confira as AOIs antes do commit."
    )
