"""Calibração afim com validação independente em coordenadas normalizadas."""

from dataclasses import dataclass

import numpy as np


@dataclass(frozen=True)
class Calibration:
    coefficients: list[list[float]]
    validation_rmse: float
    approved: bool


def _pairs(values: list[list[float]], minimum: int) -> np.ndarray:
    result = np.asarray(values, dtype=float)
    if result.ndim != 2 or result.shape[1] != 2 or len(result) < minimum:
        raise ValueError(f"São necessários pelo menos {minimum} pares de coordenadas.")
    if not np.isfinite(result).all():
        raise ValueError("As coordenadas devem ser finitas.")
    return result


def fit_calibration(
    features: list[list[float]],
    targets: list[list[float]],
    validation_features: list[list[float]],
    validation_targets: list[list[float]],
    max_rmse: float = 0.1,
) -> Calibration:
    """Ajusta nove alvos; aprova pelo erro em amostras coletadas separadamente.

    Features representam posições oculares relativas, ainda sem unidade física.
    RMSE é a distância euclidiana na tela normalizada, não precisão clínica.
    """
    x, y = _pairs(features, 9), _pairs(targets, 9)
    vx, vy = _pairs(validation_features, 5), _pairs(validation_targets, 5)
    if len(x) != len(y) or len(vx) != len(vy):
        raise ValueError("Cada amostra precisa de um alvo correspondente.")
    if not np.isfinite(max_rmse) or not 0 < max_rmse <= 1:
        raise ValueError("O limite de erro deve estar entre zero e um.")
    if (y < 0).any() or (y > 1).any() or (vy < 0).any() or (vy > 1).any():
        raise ValueError("Os alvos devem estar no intervalo [0, 1].")
    # Não basta repetir um ponto nove vezes: exige a grade completa de nove alvos.
    expected = {(a, b) for a in (0.1, 0.5, 0.9) for b in (0.1, 0.5, 0.9)}
    if not expected.issubset({tuple(np.round(row, 6)) for row in y}):
        raise ValueError("A calibração precisa cobrir a grade de nove pontos (0.1, 0.5, 0.9).")
    design = np.column_stack((x, np.ones(len(x))))
    if np.linalg.matrix_rank(design) < 3:
        raise ValueError("Amostras degeneradas: repita a calibração.")
    coefficients, *_ = np.linalg.lstsq(design, y, rcond=None)
    predicted = np.column_stack((vx, np.ones(len(vx)))) @ coefficients
    error = float(np.sqrt(np.mean(np.sum((predicted - vy) ** 2, axis=1))))
    return Calibration(coefficients.tolist(), error, error <= max_rmse)
