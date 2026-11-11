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
    max_target_rmse: float | None = None
    target_errors: list[dict] | None = None
    error_margin: dict | None = None
    quality_policy: dict | None = None


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


class GeometryIssue(ValueError):
    def __init__(self, message, indices=()):
        super().__init__(message)
        self.reference_indices = sorted(set(int(i) for i in indices))


def build_mesh(features, targets, partial=False):
    x, y = _pairs(features, 1 if partial else 9), _pairs(targets, 1 if partial else 9)
    if len(x) != len(y) or (y < 0).any() or (y > 1).any():
        raise ValueError("Cada referência ocular precisa de um alvo dentro da tela.")
    if partial:
        levels_x = levels_y = [0.05, 0.275, 0.5, 0.725, 0.95]
        if any(
            not any(abs(t[0] - v) < 1e-8 for v in levels_x)
            or not any(abs(t[1] - v) < 1e-8 for v in levels_y)
            for t in y
        ):
            raise ValueError("Referência fora da grade parcial de cinco linhas.")
    else:
        levels_x, levels_y = sorted(set(np.round(y[:, 0], 6))), sorted(set(np.round(y[:, 1], 6)))
        if (
            len(levels_x) not in (3, 5)
            or len(levels_y) != len(levels_x)
            or len(y) != len(levels_x) ** 2
        ):
            raise ValueError("Complete a malha de 3×3 ou 5×5 referências distintas.")
        if min(levels_x) > 0.1 or max(levels_x) < 0.9 or min(levels_y) > 0.1 or max(levels_y) < 0.9:
            raise ValueError("O alvo precisa cobrir centro, bordas e cantos da tela.")
    lookup = {tuple(np.round(t, 6)): i for i, t in enumerate(y)}
    if len(lookup) != len(y):
        raise ValueError("As referências da malha não podem se repetir.")
    anchors = [{"eye": a.tolist(), "screen": b.tolist()} for a, b in zip(x, y)]

    def area(cell):
        p, q, r = x[cell]
        return (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0])

    quads = []
    for j in range(len(levels_y) - 1):
        for i in range(len(levels_x) - 1):
            keys = [
                (levels_x[i], levels_y[j]),
                (levels_x[i + 1], levels_y[j]),
                (levels_x[i + 1], levels_y[j + 1]),
                (levels_x[i], levels_y[j + 1]),
            ]
            if any(k not in lookup for k in keys):
                if partial:
                    continue
                raise ValueError("Falta uma referência da malha.")
            nodes = [lookup[k] for k in keys]
            signed = area(nodes[:3]) + area([nodes[0], nodes[2], nodes[3]])
            quads.append((nodes, signed))
    if not quads:
        return anchors, []
    signs = [np.sign(a) for _, a in quads if abs(a) > 1e-7]
    orientation = 1 if sum(signs) > 0 else -1
    cells = []
    for (a, b, c, d), _ in quads:
        options = [[[a, b, c], [a, c, d]], [[a, b, d], [b, c, d]]]
        usable = [
            option for option in options if all(area(cell) * orientation > 1e-7 for cell in option)
        ]
        if not usable:
            raise GeometryIssue(
                "Referências inconsistentes nesta região; recolha os pontos indicados.",
                [a, b, c, d],
            )
        # Either diagonal is valid for a simple concave quadrilateral. Prefer
        # triangles with a larger minimum area, without fitting any parameters.
        cells.extend(max(usable, key=lambda option: min(abs(area(cell)) for cell in option)))
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
                raise GeometryIssue("Regiões cruzadas nesta parte da malha.", [a, b, c, d])
    return anchors, cells


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
    expected_held = {(0.2, 0.2), (0.8, 0.2), (0.5, 0.5), (0.2, 0.8), (0.8, 0.8)}
    if not expected_held.issubset(set(map(tuple, np.round(vy, 6)))):
        raise ValueError("Confira centro e quatro quadrantes em uma coleta separada.")
    anchors, cells = build_mesh(x, y)

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
    if validation_samples is not None and len(validation_samples) != len(vy):
        raise ValueError("Grupos de conferência incompletos.")
    values, labels, target_errors = [], [], []
    for index, t in enumerate(vy):
        a = (
            _pairs(validation_samples[index], 6)
            if validation_samples is not None
            else vx[index : index + 1]
        )
        if len(a) > 120:
            raise ValueError("Limite de 120 quadros por alvo.")
        rows, absent = errors(a, [t] * len(a))
        error = float(np.sqrt(np.mean(np.sum(rows**2, axis=1)))) if len(rows) else None
        target_errors.append(
            {
                "expected": t.tolist(),
                "individual_limit_required": not all(v <= 0.1 or v >= 0.9 for v in t),
                "count": len(a),
                "unsupported": absent,
                "rmse": error,
                "axis_p90": np.percentile(np.abs(rows), 90, axis=0).tolist() if len(rows) else None,
            }
        )
        values.extend(a)
        labels.extend([t] * len(a))
    residuals, missing = errors(values, labels)
    max_target_rmse = max((r["rmse"] for r in target_errors if r["rmse"] is not None), default=None)
    target_passed = all(
        r["unsupported"] == 0 and r["rmse"] is not None and r["rmse"] <= max_rmse
        for r in target_errors
        if r["individual_limit_required"]
    )
    distances = np.linalg.norm(residuals, axis=1)
    rmse = float(np.sqrt(np.mean(distances**2))) if len(distances) else None
    return Calibration(
        anchors,
        cells,
        rmse,
        not missing
        and not med_missing
        and target_passed
        and rmse <= max_rmse
        and median_rmse <= max_rmse,
        validation_median_rmse=median_rmse,
        unsupported_validation_samples=missing,
        validation_axis_rmse=np.sqrt(np.mean(residuals**2, axis=0)).tolist()
        if len(residuals)
        else None,
        validation_p90=float(np.percentile(distances, 90)) if len(distances) else 0,
        max_target_rmse=max_target_rmse,
        target_errors=target_errors,
        quality_policy={
            "version": "global_and_noncorner_v2",
            "global_rmse_limit": max_rmse,
            "corner_individual_limit": None,
            "unsupported_policy": "all_targets_required",
        },
        error_margin={
            "method": "worst_target_axis_p90_v1",
            "axes": [
                max(r["axis_p90"][axis] for r in target_errors if r.get("axis_p90") is not None)
                for axis in (0, 1)
            ],
            "unsupported_samples": missing,
            "note": "Margem empírica observada, não intervalo de confiança.",
        }
        if len(residuals)
        else None,
    )
