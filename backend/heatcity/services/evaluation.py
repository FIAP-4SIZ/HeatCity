"""Métricas por tarefa; cliques nunca são tratados como atenção ocular."""

from statistics import mean

from ..analysis import Area, Sample, analyze


def contains(plate, point):
    return (
        plate["x"] <= point["x"] < plate["x"] + plate["width"]
        and plate["y"] <= point["y"] < plate["y"] + plate["height"]
    )


def evaluate(session, scenario, duration, points):
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


def summarize(scenarios, sessions):
    groups = {}
    names = {s["id"]: s["name"] for s in scenarios}
    # One latest eligible completed session per participant/scenario/mode/task.
    selected = {}
    for session in sorted(sessions, key=lambda s: s["created_at"]):
        if session["status"] == "completed" and session["metrics"]["eligible"]:
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
        "completed": sum(s["status"] == "completed" for s in sessions),
        "excluded": sum(
            s["status"] != "completed" or not s.get("metrics", {}).get("eligible", False)
            for s in sessions
        ),
        "selected_session_ids": [s["id"] for s in selected.values()],
    }
