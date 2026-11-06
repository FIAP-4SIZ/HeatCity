import unittest
from unittest.mock import patch

from fastapi import HTTPException
from heatcity.api import CalibrationRequest, PreviewRequest, approvals, calibrate, preview, revoke


class AuthorizationTests(unittest.TestCase):
    def tearDown(self):
        approvals.clear()

    def approved_calibration(self):
        grid = [[x, y] for x in (.1, .5, .9) for y in (.1, .5, .9)]
        validation = [[.2, .2], [.8, .2], [.5, .5], [.2, .8], [.8, .8]]
        return calibrate(CalibrationRequest(features=grid, targets=grid,
                         validation_features=validation, validation_targets=validation))

    def test_requires_server_approval_and_consent(self):
        with self.assertRaises(HTTPException) as error:
            preview(PreviewRequest(calibration_id='invented', consent=True))
        self.assertEqual(error.exception.status_code, 403)
        result = self.approved_calibration()
        key = result['calibration_id']
        with self.assertRaises(HTTPException):
            preview(PreviewRequest(calibration_id=key, consent=False))
        self.assertTrue(preview(PreviewRequest(calibration_id=key, consent=True))['authorized'])
        revoke(key)
        with self.assertRaises(HTTPException):
            preview(PreviewRequest(calibration_id=key, consent=True))

    def test_approval_expires(self):
        with patch('heatcity.api.monotonic', return_value=10):
            result = self.approved_calibration()
        with patch('heatcity.api.monotonic', return_value=611):
            with self.assertRaises(HTTPException):
                preview(PreviewRequest(calibration_id=result['calibration_id'], consent=True))
