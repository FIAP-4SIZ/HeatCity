"""Reavalia diagnósticos locais sem retreinar com a validação nem alterar o limite."""

import argparse
import json
import sys
from dataclasses import asdict
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))
from heatcity.calibration import (
    fit_calibration,
    fit_motion_calibration,
    fit_precision_calibration,
)


def evaluate(path):
    data = json.loads(Path(path).read_text(encoding="utf-8"))
    fitter = {
        "fixed": fit_calibration,
        "motion": fit_motion_calibration,
        "precision": fit_precision_calibration,
    }[data["mode"]]
    result = asdict(
        fitter(
            *(
                data[name]
                for name in (
                    "features",
                    "targets",
                    "validation_features",
                    "validation_targets",
                )
            )
        )
    )
    values = np.asarray(data["validation_features"], dtype=float)
    if result.get("basis") == "quadratic":
        a, b = values.T
        values = np.column_stack((a, b, a * a, a * b, b * b))
    predicted = np.column_stack((values, np.ones(len(values)))) @ np.asarray(
        result["coefficients"]
    )
    residual = predicted - np.asarray(data["validation_targets"])
    return {
        "file": Path(path).name,
        "mode": data["mode"],
        "declared_rmse": data["quality"]["validation_rmse"],
        "recomputed_rmse": result["validation_rmse"],
        "approved": result["approved"],
        "axis_rmse": np.sqrt(np.mean(residual**2, axis=0)).tolist(),
        "validation_bias": residual.mean(axis=0).tolist(),
        "training_cv_rmse": result.get("training_cv_rmse"),
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("files", nargs="+")
    arguments = parser.parse_args()
    print(
        json.dumps(
            [evaluate(path) for path in arguments.files], ensure_ascii=False, indent=2
        )
    )
