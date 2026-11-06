import unittest
from unittest.mock import patch

from fastapi import HTTPException

from heatcity.api import CalibrationRequest, PreviewRequest, approvals, calibrate, preview, revoke


class AuthorizationTests(unittest.TestCase):
    def tearDown(self):
        approvals.clear()

    def approved_calibration(self):
        grid = [[x, y] for x in (0.1, 0.5, 0.9) for y in (0.1, 0.5, 0.9)]
        validation = [[0.2, 0.2], [0.8, 0.2], [0.5, 0.5], [0.2, 0.8], [0.8, 0.8]]
        return calibrate(
            CalibrationRequest(
                features=grid,
                targets=grid,
                validation_features=validation,
                validation_targets=validation,
            )
        )

    def test_requires_server_approval_and_consent(self):
        with self.assertRaises(HTTPException) as error:
            preview(PreviewRequest(calibration_id="invented", consent=True))
        self.assertEqual(error.exception.status_code, 403)
        result = self.approved_calibration()
        key = result["calibration_id"]
        with self.assertRaises(HTTPException):
            preview(PreviewRequest(calibration_id=key, consent=False))
        self.assertTrue(preview(PreviewRequest(calibration_id=key, consent=True))["authorized"])
        revoke(key)
        with self.assertRaises(HTTPException):
            preview(PreviewRequest(calibration_id=key, consent=True))

    def test_approval_expires(self):
        with patch("heatcity.api.monotonic", return_value=10):
            result = self.approved_calibration()
        with patch("heatcity.api.monotonic", return_value=611):
            with self.assertRaises(HTTPException):
                preview(PreviewRequest(calibration_id=result["calibration_id"], consent=True))

    def test_diagnostic_evaluation_never_issues_study_authorization(self):
        from heatcity.api import diagnostic_calibration
        from heatcity.workflow import calibration_models

        grid = [[x, y] for x in (0.1, 0.5, 0.9) for y in (0.1, 0.5, 0.9)]
        held = [[0.2, 0.2], [0.8, 0.2], [0.5, 0.5], [0.2, 0.8], [0.8, 0.8]]
        before = (set(approvals), set(calibration_models))
        result = diagnostic_calibration(
            CalibrationRequest(
                features=grid, targets=grid, validation_features=held, validation_targets=held
            )
        )
        self.assertTrue(result["approved"])
        self.assertTrue(result["diagnostic_only"])
        self.assertNotIn("calibration_id", result)
        self.assertEqual((set(approvals), set(calibration_models)), before)
