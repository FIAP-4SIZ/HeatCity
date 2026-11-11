"""Confere diagnósticos geométricos locais; não ajusta modelos de aprendizado."""

import argparse
import json
import sys
from dataclasses import asdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))
from heatcity.calibration import fit_calibration


def evaluate(path):
    data = json.loads(Path(path).read_text(encoding="utf-8"))
    if data.get("mode") != "sweep":
        raise ValueError(
            "Diagnóstico histórico: os ajustes anteriores foram removidos. Use uma nova varredura."
        )
    names = ("features", "targets", "validation_features", "validation_targets")
    return {
        "file": Path(path).name,
        **asdict(
            fit_calibration(
                *(data[n] for n in names),
                validation_samples=data.get("validation_samples"),
            )
        ),
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("files", nargs="+")
    print(
        json.dumps(
            [evaluate(p) for p in parser.parse_args().files],
            ensure_ascii=False,
            indent=2,
        )
    )
