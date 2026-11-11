"""Recalcula taxas e tempos por grupo a partir de exportação JSON, sem importar a API."""

import argparse
import json
from collections import defaultdict
from statistics import mean


def recompute(data):
    selected = {}
    for session in sorted(data["sessions"], key=lambda item: item["created_at"]):
        if session["status"] == "completed" and session["metrics"]["eligible"]:
            selected[
                (session["scenario_id"], session["target"], session["participant"])
            ] = session
    groups = defaultdict(list)
    for (scenario, target, _), session in selected.items():
        groups[(scenario, target)].append(session)
    rows = []
    for (scenario, target), sessions in groups.items():
        times = [
            s["metrics"]["first_seconds"]
            for s in sessions
            if s["metrics"]["first_seconds"] is not None
        ]
        rows.append(
            {
                "scenario_id": scenario,
                "target": target,
                "participants": len(sessions),
                "success_rate": 100
                * sum(s["metrics"]["success"] for s in sessions)
                / len(sessions),
                "mean_first_seconds": mean(times) if times else None,
            }
        )
    return rows


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("export_json", help="Arquivo obtido no botão JSON completo")
    args = parser.parse_args()
    with open(args.export_json, encoding="utf-8") as file:
        print(json.dumps(recompute(json.load(file)), ensure_ascii=False, indent=2))
