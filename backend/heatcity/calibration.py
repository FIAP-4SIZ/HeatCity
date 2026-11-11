"""Interpolação geométrica de referências oculares; sem regressão ou treinamento."""

from dataclasses import dataclass

import numpy as np


def barycentric(point, triangle):
    a, b, c = np.asarray(triangle, dtype=float)
    u, v, p = b - a, c - a, np.asarray(point) - a
    det = u[0] * v[1] - u[1] * v[0]
    if abs(det) < 1e-8:
        return None
    wb = (p[0] * v[1] - p[1] * v[0]) / det
    wc = (u[0] * p[1] - u[1] * p[0]) / det
    return np.array([1 - wb - wc, wb, wc])


def project(point, anchors, cells):
    for cell in cells:
        weights = barycentric(point, [anchors[i]["eye"] for i in cell])
        if weights is not None and weights.min() >= -1e-7:
            return weights @ np.array([anchors[i]["screen"] for i in cell])
    return None


@dataclass(frozen=True)
class Calibration:
    anchors: list[dict]
    cells: list[list[int]]
    validation_rmse: float | None
    approved: bool
    basis: str = "mesh"
    validation_median_rmse: float | None = None
    unsupported_validation_samples: int = 0
    validation_axis_rmse: list[float] | None = None
    validation_p90: float = 0


def _pairs(values, minimum):
    a = np.asarray(values, dtype=float)
    if (
        a.ndim != 2
        or a.shape[1] != 2
        or len(a) < minimum
        or not np.isfinite(a).all()
        or np.abs(a).max() > 100
    ):
        raise ValueError(f"São necessários ao menos {minimum} pares finitos de coordenadas.")
    return a


def fit_calibration(
    features,
    targets,
    validation_features,
    validation_targets,
    max_rmse=0.1,
    validation_samples=None,
):
    x, y = _pairs(features, 9), _pairs(targets, 9)
    vx, vy = _pairs(validation_features, 5), _pairs(validation_targets, 5)
    if len(x) != len(y) or len(vx) != len(vy):
        raise ValueError("Cada referência ocular precisa de seu alvo correspondente.")
    if (
        not np.isfinite(max_rmse)
        or not 0 < max_rmse <= 1
        or (y < 0).any()
        or (y > 1).any()
        or (vy < 0).any()
        or (vy > 1).any()
    ):
        raise ValueError("Alvos e limite de erro devem estar dentro da tela normalizada.")
    levels_x, levels_y = sorted(set(y[:, 0])), sorted(set(y[:, 1]))
    expected_held = {(0.2, 0.2), (0.8, 0.2), (0.5, 0.5), (0.2, 0.8), (0.8, 0.8)}
    if not expected_held.issubset(set(map(tuple, np.round(vy, 6)))):
        raise ValueError("Valide centro e quatro quadrantes em uma coleta separada.")
    if (
        len(levels_x) not in (3, 5)
        or len(levels_y) != len(levels_x)
        or len(y) != len(levels_x) ** 2
    ):
        raise ValueError("Complete a malha de 3×3 ou 5×5 referências distintas.")
    if min(levels_x) > 0.1 or max(levels_x) < 0.9 or min(levels_y) > 0.1 or max(levels_y) < 0.9:
        raise ValueError("O alvo precisa cobrir centro, bordas e cantos da tela.")
    lookup = {tuple(t): i for i, t in enumerate(y)}
    if len(lookup) != len(y):
        raise ValueError("As referências da malha não podem se repetir.")
    anchors = [{"eye": a.tolist(), "screen": b.tolist()} for a, b in zip(x, y)]
    cells = []
    signs = []
    for j in range(len(levels_y) - 1):
        for i in range(len(levels_x) - 1):
            try:
                a, b, c, d = [
                    lookup[t]
                    for t in [
                        (levels_x[i], levels_y[j]),
                        (levels_x[i + 1], levels_y[j]),
                        (levels_x[i + 1], levels_y[j + 1]),
                        (levels_x[i], levels_y[j + 1]),
                    ]
                ]
            except KeyError as error:
                raise ValueError("Falta uma referência da malha.") from error
            for cell in ([a, b, c], [a, c, d]):
                p, q, r = x[cell]
                area = (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0])
                if abs(area) < 1e-7:
                    raise ValueError(
                        "Referências oculares indistinguíveis. A malha não pode ser interpolada."
                    )
                signs.append(area > 0)
                cells.append(cell)
    if len(set(signs)) != 1:
        raise ValueError(
            "A malha ocular se dobrou: movimento, ruído ou referências inconsistentes. Repita a varredura."
        )
    # Local orientation alone is insufficient: reject crossing nonadjacent mesh edges.
    edges = sorted({tuple(sorted((c[i], c[(i + 1) % 3]))) for c in cells for i in range(3)})

    def side(a, b, c):
        return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])

    for k, (a, b) in enumerate(edges):
        for c, d in edges[k + 1 :]:
            if len({a, b, c, d}) < 4:
                continue
            if (
                side(x[a], x[b], x[c]) * side(x[a], x[b], x[d]) < 0
                and side(x[c], x[d], x[a]) * side(x[c], x[d], x[b]) < 0
            ):
                raise ValueError("A malha contém regiões cruzadas. Refaça as referências.")

    def errors(values, labels):
        residuals = []
        missing = 0
        for f, t in zip(values, labels):
            p = project(f, anchors, cells)
            if p is None:
                missing += 1
            else:
                residuals.append(p - t)
        return np.asarray(residuals).reshape((-1, 2)), missing

    med_errors, med_missing = errors(vx, vy)
    median_rmse = (
        float(np.sqrt(np.mean(np.sum(med_errors**2, axis=1)))) if len(med_errors) else None
    )
    if validation_samples is not None:
        if len(validation_samples) != len(vy):
            raise ValueError("Grupos de validação incompletos.")
        values, labels = [], []
        for group, t in zip(validation_samples, vy):
            a = _pairs(group, 6)
            if len(a) > 120:
                raise ValueError("Limite de 120 quadros por alvo.")
            values.extend(a)
            labels.extend([t] * len(a))
        residuals, missing = errors(values, labels)
    else:
        residuals, missing = med_errors, med_missing
    distances = np.linalg.norm(residuals, axis=1)
    rmse = float(np.sqrt(np.mean(distances**2))) if len(distances) else None
    return Calibration(
        anchors,
        cells,
        rmse,
        not missing and not med_missing and rmse <= max_rmse and median_rmse <= max_rmse,
        validation_median_rmse=median_rmse,
        unsupported_validation_samples=missing,
        validation_axis_rmse=np.sqrt(np.mean(residuals**2, axis=0)).tolist()
        if len(residuals)
        else None,
        validation_p90=float(np.percentile(distances, 90)) if len(distances) else 0,
    )
