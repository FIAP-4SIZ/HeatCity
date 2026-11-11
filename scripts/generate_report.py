"""Gera relatório provisório ou relatório de um estudo local, sem inventar resultados."""

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))
from heatcity.services.report import build_report
from heatcity.workflow import results

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument(
    "--analysis", help="JSON agregado de scripts/analyze_calibration.py"
)
parser.add_argument("--study-id", help="ID de estudo já persistido")
parser.add_argument("--output", default="docs/reports/HeatCity-relatorio-tecnico.pdf")
args = parser.parse_args()
if args.study_id:
    data = results(args.study_id)
else:
    data = {
        "study": {
            "title": "HeatCity — estrutura técnica do MVP",
            "objective": "Investigar a localização de sinalizações por estimativas de olhar, com validação individual e limites de qualidade explícitos.",
            "scenarios": [],
        },
        "sessions": [],
        "summary": {
            "rows": [],
            "sessions_total": 0,
            "completed": 0,
            "excluded": 0,
            "selected_session_ids": [],
        },
    }
if args.analysis:
    from analyze_calibration import charts

    evidence = json.loads(Path(args.analysis).read_text(encoding="utf-8"))
    if not args.study_id:
        data["study"]["title"] = (
            "HeatCity — análise experimental de calibração e estrutura do MVP"
        )
    data["calibration_analysis"] = evidence
    data["calibration_figures"] = [drawing for _, drawing in charts(evidence)]
target = Path(args.output)
target.parent.mkdir(parents=True, exist_ok=True)
target.write_bytes(build_report(data))
print(
    f"Relatório gerado: {target}. Dados reais de participantes: {data['summary']['completed']} sessões concluídas."
)
