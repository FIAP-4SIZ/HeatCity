import os
import tempfile
import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient

from heatcity import storage
from heatcity.api import app
from heatcity.workflow import calibration_models


class WorkflowTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.environment = patch.dict(os.environ, {"HEATCITY_DATA_DIR": self.directory.name})
        self.environment.start()
        self.client = TestClient(app)
        self.study = self.client.post(
            "/studies",
            json={
                "title": "Hospital A/B",
                "objective": "Avaliar tarefas equivalentes de localização.",
            },
        ).json()
        self.scene_input = self.client.get("/scene-example").json()
        response = self.client.post(f"/studies/{self.study['id']}/scenarios", json=self.scene_input)
        self.assertEqual(response.status_code, 201, response.text)
        self.scene = response.json()

    def tearDown(self):
        calibration_models.clear()
        self.environment.stop()
        self.directory.cleanup()

    def session(self, code="P01", mode="gaze", calibration_id=None):
        if calibration_id is None:
            import time

            calibration_id = "fixture-" + code
            calibration_models[calibration_id] = {
                "expires": time.monotonic() + 100,
                "approved": True,
                "validation_rmse": 0.01,
                "coefficients": [[1, 0], [0, 1], [0, 0]],
                "feature_mode": "fixed",
                "participant": code,
                "scenario_id": self.scene["id"],
            }
        return self.client.post(
            "/sessions",
            json={
                "participant": code,
                "scenario_id": self.scene["id"],
                "mode": mode,
                "target": "Recepção",
                "consent": True,
                "calibration_id": calibration_id,
            },
        )

    def complete(self, code="P01", success=True):
        session = self.session(code).json()
        points = [
            {
                "time": i / 20,
                "x": 0.2 if success and i >= 20 else 0.98,
                "y": 0.3 if success and i >= 20 else 0.98,
                "valid": True,
            }
            for i in range(40)
        ]
        response = self.client.post(
            f"/sessions/{session['id']}/finish", json={"duration": 2, "points": points}
        )
        self.assertEqual(response.status_code, 200, response.text)
        return response.json()

    def test_persistence_success_failure_and_group_denominators(self):
        self.complete()
        self.complete("P02", False)
        # New clients/connections read the same file, not an in-memory list.
        data = TestClient(app).get(f"/studies/{self.study['id']}/results").json()
        row = next(
            r for r in data["summary"]["rows"] if r["target"] == "Recepção" and r["mode"] == "gaze"
        )
        self.assertEqual(row["participants"], 2)
        self.assertEqual(row["success_rate"], 50)
        self.assertEqual(row["mean_first_seconds"], 1)
        self.assertGreater(row["mean_attention_seconds"], 0)

    def test_repeated_participant_uses_latest_eligible_session(self):
        self.complete()
        self.complete(success=False)
        data = self.client.get(f"/studies/{self.study['id']}/results").json()
        row = next(
            r for r in data["summary"]["rows"] if r["target"] == "Recepção" and r["mode"] == "gaze"
        )
        self.assertEqual(row["participants"], 1)
        self.assertEqual(row["success_rate"], 0)

    def test_consent_and_calibration_cannot_be_forged(self):
        self.assertEqual(self.session(mode="gaze", calibration_id="fake").status_code, 403)
        response = self.client.post(
            "/sessions",
            json={
                "participant": "P01",
                "scenario_id": self.scene["id"],
                "mode": "gaze",
                "target": "Recepção",
                "consent": False,
            },
        )
        self.assertEqual(response.status_code, 422)

    def test_gaze_binds_participant_and_rejects_insufficient_coverage(self):
        import time

        calibration_models["good"] = {
            "expires": time.monotonic() + 100,
            "approved": True,
            "validation_rmse": 0.01,
            "coefficients": [[1, 0], [0, 1], [0, 0]],
            "feature_mode": "fixed",
            "participant": "P01",
            "scenario_id": self.scene["id"],
        }
        self.assertEqual(self.session("P02", "gaze", "good").status_code, 403)
        session = self.session(mode="gaze", calibration_id="good").json()
        response = self.client.post(
            f"/sessions/{session['id']}/finish",
            json={"duration": 10, "points": [{"time": 1, "x": 0.2, "y": 0.3}]},
        )
        self.assertFalse(response.json()["metrics"]["eligible"])
        data = self.client.get(f"/studies/{self.study['id']}/results").json()
        self.assertEqual(data["summary"]["selected_session_ids"], [])

    def test_nonfinite_reversed_and_outside_points_are_rejected(self):
        session = self.session().json()
        url = f"/sessions/{session['id']}/finish"
        for points in (
            [{"time": 1, "x": 1.2, "y": 0.3}],
            [{"time": 3, "x": 0.2, "y": 0.3}],
            [{"time": 1, "x": 0.2, "y": 0.3}, {"time": 0.5, "x": 0.2, "y": 0.3}],
        ):
            self.assertEqual(
                self.client.post(url, json={"duration": 2, "points": points}).status_code, 422
            )

    def test_finalization_is_not_repeatable_and_abort_is_excluded(self):
        session = self.complete()
        repeated = self.client.post(
            f"/sessions/{session['id']}/finish",
            json={"duration": session["duration"], "points": session["points"]},
        )
        self.assertEqual(repeated.status_code, 200)

        self.assertEqual(
            self.client.post(
                f"/sessions/{session['id']}/finish", json={"duration": 2, "points": []}
            ).status_code,
            409,
        )
        second = self.session("P02").json()
        self.assertEqual(self.client.post(f"/sessions/{second['id']}/abort").status_code, 200)
        self.assertEqual(
            self.client.get(f"/studies/{self.study['id']}/results").json()["summary"]["excluded"], 1
        )

    def test_overlapping_aoi_and_invalid_image_are_rejected(self):
        body = {
            **self.scene_input,
            "plates": [
                self.scene_input["plates"][0],
                {**self.scene_input["plates"][0], "name": "Outra"},
            ],
        }
        self.assertEqual(
            self.client.post(f"/studies/{self.study['id']}/scenarios", json=body).status_code, 422
        )
        body = {**self.scene_input, "image": "data:image/svg+xml;base64,abcd"}
        self.assertEqual(
            self.client.post(f"/studies/{self.study['id']}/scenarios", json=body).status_code, 422
        )

    def test_heatmap_cv_metrics_pdf_and_exports(self):
        self.complete()
        self.assertGreater(self.scene["image_metrics"][0]["local_contrast"], 0)
        image = self.client.get(f"/scenarios/{self.scene['id']}/heatmap?mode=gaze")
        self.assertTrue(image.content.startswith(b"\x89PNG"))
        pdf = self.client.get(f"/studies/{self.study['id']}/report.pdf")
        self.assertTrue(
            pdf.content.startswith(b"%PDF-"), pdf.text[:200] if pdf.status_code != 200 else ""
        )
        self.assertIn("Recepção", self.client.get(f"/studies/{self.study['id']}/export.csv").text)

    def test_cascade_deletion_removes_sessions_and_scenarios(self):
        session = self.complete()
        self.assertEqual(self.client.delete(f"/studies/{self.study['id']}").status_code, 204)
        self.assertIsNone(storage.read("sessions", session["id"]))
        self.assertIsNone(storage.read("scenarios", self.scene["id"]))

    def test_only_gaze_is_supported_and_ambiguous_edges_do_not_count(self):
        self.assertEqual(self.session(mode="click").status_code, 422)
        session = self.session().json()
        points = [{"time": i / 20, "x": 0.1001, "y": 0.3} for i in range(40)]
        response = self.client.post(
            f"/sessions/{session['id']}/finish", json={"duration": 2, "points": points}
        )
        self.assertEqual(response.status_code, 200)
        metrics = response.json()["metrics"]
        self.assertFalse(metrics["success"])
        self.assertEqual(metrics["uncertain_samples"], 40)
        self.assertEqual(metrics["attention_seconds"], 0)

    def test_viewport_and_spatial_quality_are_enforced(self):
        self.session()
        model = calibration_models["fixture-P01"]
        model["viewport_width"] = 1280
        model["viewport_height"] = 900
        self.assertEqual(self.session(calibration_id="fixture-P01").status_code, 403)
        model["viewport_width"] = None
        model["validation_rmse"] = 0.1
        self.assertEqual(self.session(calibration_id="fixture-P01").status_code, 422)
