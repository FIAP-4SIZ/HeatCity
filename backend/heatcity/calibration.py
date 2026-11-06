"""Calibração afim com validação independente em coordenadas normalizadas."""

from dataclasses import dataclass

import numpy as np


@dataclass(frozen=True)
class Calibration:
    coefficients: list[list[float]]
    validation_rmse: float
    approved: bool
    basis: str = "affine"
    training_cv_rmse: float | None = None


def _pairs(values: list[list[float]], minimum: int) -> np.ndarray:
    result = np.asarray(values, dtype=float)
    if result.ndim != 2 or result.shape[1] != 2 or len(result) < minimum:
        raise ValueError(f"São necessários pelo menos {minimum} pares de coordenadas.")
    if not np.isfinite(result).all() or np.abs(result).max() > 100:
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

    def design(values, basis):
        if basis == "quadratic":
            a, b = values[:, 0], values[:, 1]
            return np.column_stack((a, b, a * a, a * b, b * b, np.ones(len(values))))
        return np.column_stack((values, np.ones(len(values))))

    def cv_error(matrix):
        distances = []
        for index in range(len(matrix)):
            mask = np.arange(len(matrix)) != index
            if np.linalg.matrix_rank(matrix[mask]) < matrix.shape[1]:
                return float("inf")
            weights, *_ = np.linalg.lstsq(matrix[mask], y[mask], rcond=None)
            distances.append(float(np.sum((matrix[index] @ weights - y[index]) ** 2)))
        return float(np.sqrt(np.mean(distances)))

    affine = design(x, "affine")
    if np.linalg.matrix_rank(affine) < 3:
        raise ValueError("Amostras degeneradas: repita a calibração.")
    basis = "affine"
    matrix = affine
    score = cv_error(affine)
    quadratic = design(x, "quadratic")
    quadratic_score = cv_error(quadratic)
    # Select only on training folds. The five later targets never choose the model.
    if score > 1e-8 and quadratic_score < score * 0.8:
        basis = "quadratic"
        matrix = quadratic
        score = quadratic_score
    coefficients, *_ = np.linalg.lstsq(matrix, y, rcond=None)
    predicted = design(vx, basis) @ coefficients
    error = float(np.sqrt(np.mean(np.sum((predicted - vy) ** 2, axis=1))))
    return Calibration(
        coefficients.tolist(),
        error,
        error <= max_rmse,
        basis,
        score if np.isfinite(score) else None,
    )


@dataclass(frozen=True)
class MotionCalibration:
    coefficients: list[list[float]]
    validation_rmse: float
    approved: bool
    head_min: list[float]
    head_max: list[float]
    validation_p90: float


def fit_motion_calibration(features, targets, validation_features, validation_targets):
    """Ridge com ambos os olhos e seis descritores de posição da cabeça.

    O cliente coleta uma trajetória, incluindo movimentos naturais da cabeça. A validação é
    coletada depois do ajuste, sem otimizar hiperparâmetros com essas amostras.
    """
    x, vx = np.asarray(features, dtype=float), np.asarray(validation_features, dtype=float)
    y, vy = _pairs(targets, 120), _pairs(validation_targets, 30)
    if (
        x.ndim != 2
        or vx.ndim != 2
        or x.shape != (len(y), 10)
        or vx.shape != (len(vy), 10)
        or not np.isfinite(x).all()
        or not np.isfinite(vx).all()
        or np.abs(x).max() > 100
        or np.abs(vx).max() > 100
    ):
        raise ValueError("Amostras móveis exigem dez características finitas por alvo.")
    if (y < 0).any() or (y > 1).any() or (vy < 0).any() or (vy > 1).any():
        raise ValueError("Alvos devem estar em [0, 1].")
    for values in (y, vy):
        # Cobertura em ambos os eixos e em cada quadrante, sem exigir grade fixa.
        if (
            np.ptp(values, axis=0).min() < 0.5
            or len(set(map(tuple, (values >= 0.5).astype(int)))) < 4
        ):
            raise ValueError("Cobertura insuficiente: acompanhe toda a trajetória.")
    if np.ptp(x[:, :4], axis=0).max() < 0.01:
        raise ValueError("Movimento ocular insuficiente. Verifique a detecção das íris.")
    mean, scale = x.mean(axis=0), x.std(axis=0)
    scale = np.maximum(scale, 1e-4)
    design = np.column_stack(((x - mean) / scale, np.ones(len(x))))
    penalty = np.eye(11) * (len(x) * 0.01)
    penalty[-1, -1] = 0
    weights = np.linalg.solve(design.T @ design + penalty, design.T @ y)
    coefficients = weights[:-1] / scale[:, None]
    intercept = weights[-1] - mean @ coefficients
    coefficients = np.vstack((coefficients, intercept))
    distances = np.linalg.norm(np.column_stack((vx, np.ones(len(vx)))) @ coefficients - vy, axis=1)
    error = float(np.sqrt(np.mean(distances**2)))
    return MotionCalibration(
        coefficients.tolist(),
        error,
        error <= 0.1,
        x[:, 4:].min(axis=0).tolist(),
        x[:, 4:].max(axis=0).tolist(),
        float(np.percentile(distances, 90)),
    )
