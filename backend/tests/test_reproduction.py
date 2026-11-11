"""A reprodução não depende da API nem do cálculo original."""

import importlib.util
import unittest
from pathlib import Path


class ReproductionTests(unittest.TestCase):
    def test_export_recomputation_keeps_failures_in_denominator(self):
        location = Path(__file__).resolve().parents[2] / "scripts" / "recompute_metrics.py"
        spec = importlib.util.spec_from_file_location("recompute_metrics", location)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        sessions = [
            {
                "scenario_id": "A",
                "target": "Recepção",
                "participant": "P01",
                "created_at": "2026-01-01T01:00",
                "status": "completed",
                "metrics": {"eligible": True, "success": True, "first_seconds": 2},
            },
            {
                "scenario_id": "A",
                "target": "Recepção",
                "participant": "P02",
                "created_at": "2026-01-01T02:00",
                "status": "completed",
                "metrics": {"eligible": True, "success": False, "first_seconds": None},
            },
            {
                "scenario_id": "A",
                "target": "Recepção",
                "participant": "P03",
                "created_at": "2026-01-01T03:00",
                "status": "aborted",
                "metrics": {},
            },
        ]
        rows = module.recompute({"sessions": sessions})
        self.assertEqual(rows[0]["participants"], 2)
        self.assertEqual(rows[0]["success_rate"], 50)
        self.assertEqual(rows[0]["mean_first_seconds"], 2)
