"""Métricas por tarefa; cliques nunca são tratados como atenção ocular."""

from statistics import mean

from ..analysis import Area, Sample, analyze


def contains(plate, point):
    return (
        plate["x"] <= point["x"] < plate["x"] + plate["width"]
        and plate["y"] <= point["y"] < plate["y"] + plate["height"]
    )


def legacy_evaluate(session, scenario, duration, points):
    target = next(p for p in scenario["plates"] if p["name"] == session["target"])
    radius = session["calibration"]["validation_rmse"]
    safe = {
        **target,
        "x": target["x"] + radius,
        "y": target["y"] + radius,
        "width": target["width"] - 2 * radius,
        "height": target["height"] - 2 * radius,
    }
    observed = [p for p in points if p["valid"] and contains(safe, p)]
    analysis = analyze([Sample(**p) for p in points], [Area(**safe)], duration)
    result = {
        "success": bool(observed),
        "first_seconds": observed[0]["time"] if observed else None,
        "attention_seconds": analysis["areas"][target["name"]]["attention_seconds"],
        "coverage": analysis["valid_fraction"],
        "eligible": True,
        "reason": None,
        "uncertain_samples": sum(
            p["valid"] and contains(target, p) and not contains(safe, p) for p in points
        ),
    }
    if analysis["valid_fraction"] < 0.6 or sum(p["valid"] for p in points) < 30:
        result.update(
            eligible=False,
            reason="Cobertura de olhar inferior a 60% ou menos de 30 amostras válidas.",
        )
    return result


def sustained(points, mask, minimum=0.2, maximum_gap=0.2):
    confirmed = set()
    run = []
    for index, (p, inside) in enumerate(zip(points, mask)):
        if not inside:
            run = []
            continue
        if run and p["time"] - points[run[-1]]["time"] > maximum_gap + 1e-9:
            run = []
        run.append(index)
        if len(run) >= 3 and p["time"] - points[run[0]]["time"] >= minimum - 1e-9:
            confirmed.update(run)
    return confirmed


def evaluate(session, scenario, duration, points):
    if session.get("mode") == "exploratory":
        target = next(p for p in scenario["plates"] if p["name"] == session["target"])
        coverage = analyze([Sample(**p) for p in points], [Area(**target)], duration)[
            "valid_fraction"
        ]
        return {
            "success": None,
            "first_seconds": None,
            "attention_seconds": None,
            "coverage": coverage,
            "eligible": False,
            "outcome": "exploratory",
            "uncertain_samples": None,
            "valid_samples": sum(p["valid"] for p in points),
            "reason": "Ensaio exploratório não validado. Excluído das taxas e dos tempos oficiais.",
        }
    policy = session["calibration"].get("uncertainty")
    if not policy:
        return legacy_evaluate(session, scenario, duration, points)
    target = next(p for p in scenario["plates"] if p["name"] == session["target"])
    rx, ry = policy["image_axes"]
    safe = {
        **target,
        "x": target["x"] + rx,
        "y": target["y"] + ry,
        "width": target["width"] - 2 * rx,
        "height": target["height"] - 2 * ry,
    }
    if safe["width"] <= 0 or safe["height"] <= 0:
        return {
            "success": False,
            "first_seconds": None,
            "attention_seconds": 0,
            "coverage": 0,
            "eligible": False,
            "reason": "Placa sem área conclusiva para a margem medida.",
            "uncertain_samples": 0,
            "outcome": "inconclusive",
            "uncertainty": policy,
        }
    certain = [p["valid"] and contains(safe, p) for p in points]
    possible = [
        p["valid"]
        and p["x"] + rx >= target["x"]
        and p["x"] - rx <= target["x"] + target["width"]
        and p["y"] + ry >= target["y"]
        and p["y"] - ry <= target["y"] + target["height"]
        for p in points
    ]
    ambiguous = [a and not b for a, b in zip(possible, certain)]
    observed = sustained(
        points, certain, policy["minimum_observation_seconds"], policy["maximum_gap_seconds"]
    )
    uncertain_runs = sustained(
        points, ambiguous, policy["minimum_observation_seconds"], policy["maximum_gap_seconds"]
    )
    base = analyze([Sample(**p) for p in points], [Area(**safe)], duration)
    confirmed = analyze(
        [Sample(**{**p, "valid": i in observed}) for i, p in enumerate(points)],
        [Area(**safe)],
        duration,
    )
    timely = sum(
        a["valid"] and b["valid"] and b["time"] - a["time"] <= policy["maximum_gap_seconds"] + 1e-9
        for a, b in zip(points, points[1:])
    ) / max(1, len(points) - 1)
    inconclusive = not observed and bool(uncertain_runs)
    result = {
        "success": bool(observed),
        "first_seconds": points[min(observed)]["time"] if observed else None,
        "attention_seconds": confirmed["areas"][target["name"]]["attention_seconds"],
        "coverage": base["valid_fraction"],
        "eligible": not inconclusive,
        "reason": "Observação permaneceu na faixa de incerteza; não é possível confirmar localização nem ausência."
        if inconclusive
        else None,
        "outcome": "observed" if observed else "inconclusive" if inconclusive else "not_observed",
        "uncertain_samples": sum(ambiguous),
        "certain_samples": sum(certain),
        "confirmed_samples": len(observed),
        "isolated_certain_samples": sum(certain) - len(observed),
        "uncertainty": policy,
        "timely_interval_fraction": timely,
    }
    if timely < 0.6:
        result.update(
            eligible=False,
            outcome="inconclusive",
            reason="Aquisição irregular: menos de 60% dos intervalos válidos atendem ao limite de 0,2 s.",
        )
    if base["valid_fraction"] < 0.6 or sum(p["valid"] for p in points) < 30:
        result.update(
            eligible=False,
            outcome="inconclusive",
            reason="Cobertura de olhar inferior a 60% ou menos de 30 amostras válidas.",
        )
    return result


def summarize(scenarios, sessions):
    groups = {}
    names = {s["id"]: s["name"] for s in scenarios}
    # One latest eligible completed session per participant/scenario/mode/task.
    selected = {}
    for session in sorted(sessions, key=lambda s: s["created_at"]):
        if (
            session["status"] == "completed"
            and session["metrics"]["eligible"]
            and session["mode"] == "gaze"
        ):
            selected[
                (session["scenario_id"], session["mode"], session["target"], session["participant"])
            ] = session
    for key, session in selected.items():
        groups.setdefault(key[:3], []).append(session)
    for scenario in scenarios:
        for mode in ("gaze",):
            for plate in scenario["plates"]:
                groups.setdefault((scenario["id"], mode, plate["name"]), [])
    rows = []
    for (scenario_id, mode, target), items in groups.items():
        first = [
            s["metrics"]["first_seconds"]
            for s in items
            if s["metrics"]["first_seconds"] is not None
        ]
        rate = 100 * sum(s["metrics"]["success"] for s in items) / len(items) if items else None
        rows.append(
            {
                "scenario_id": scenario_id,
                "scenario": names[scenario_id],
                "mode": mode,
                "target": target,
                "participants": len(items),
                "success_rate": rate,
                "non_observation_rate": 100 - rate if rate is not None else None,
                "mean_first_seconds": mean(first) if first else None,
                "mean_attention_seconds": mean(s["metrics"]["attention_seconds"] for s in items)
                if items and mode == "gaze"
                else None,
            }
        )
    return {
        "rows": rows,
        "sessions_total": len(sessions),
        "exploratory_sessions": sum(s["mode"] == "exploratory" for s in sessions),
        "completed": sum(s["status"] == "completed" for s in sessions),
        "excluded": sum(
            s["status"] != "completed" or not s.get("metrics", {}).get("eligible", False)
            for s in sessions
        ),
        "selected_session_ids": [s["id"] for s in selected.values()],
    }
