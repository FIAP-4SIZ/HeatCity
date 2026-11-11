"""A evidência deve preservar falhas e recusar divergências da fonte."""

import json
import sys
import tempfile
import unittest
from dataclasses import asdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "scripts"))
from analyze_calibration import analyze

from heatcity.calibration import fit_calibration


class EvidenceTests(unittest.TestCase):
    def diagnostic(self):
        targets = [[x, y] for y in (0.05, 0.5, 0.95) for x in (0.05, 0.5, 0.95)]
        held = [[0.2, 0.2], [0.8, 0.2], [0.5, 0.5], [0.2, 0.8], [0.8, 0.8]]
        attempt = dict(
            features=targets,
            targets=targets,
            validation_features=held,
            validation_targets=held,
            validation_samples=[[p] * 6 for p in held],
        )
        attempt["quality"] = asdict(fit_calibration(**attempt))
        return {
            "page_diagnostic": {
                "calibrations": [attempt, {"error": "Failed to fetch", "features": []}]
            }
        }

    def run_analysis(self, data):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "source.json"
            path.write_text(json.dumps(data))
            return analyze(path)

    def test_recomputation_and_failures_are_preserved_without_eye_vectors(self):
        result = self.run_analysis(self.diagnostic())
        self.assertEqual(len(result["attempts"]), 2)
        self.assertTrue(result["attempts"][0]["approved"])
        self.assertEqual(result["attempts"][0]["predicted"], 30)
        self.assertEqual(result["attempts"][1]["reason"], "communication")
        self.assertNotIn("rmse", result["attempts"][1])
        self.assertNotIn("features", json.dumps(result))

    def test_changed_recorded_result_is_rejected(self):
        data = self.diagnostic()
        data["page_diagnostic"]["calibrations"][0]["quality"]["validation_rmse"] = 0.9
        with self.assertRaisesRegex(ValueError, "diverge"):
            self.run_analysis(data)
