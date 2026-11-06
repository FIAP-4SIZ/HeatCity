import unittest

import numpy as np

from heatcity.calibration import fit_motion_calibration


class MotionTests(unittest.TestCase):
    def data(self):
        rng = np.random.default_rng(23)
        x = rng.uniform(-0.5, 0.5, (600, 10))
        # The eye features mix real target and independent head translation.
        y = rng.uniform(0.1, 0.9, (600, 2))
        x[:, 0] = y[:, 0] + 0.3 * x[:, 4]
        x[:, 1] = y[:, 1] - 0.2 * x[:, 5]
        return x, y

    def test_head_compensation_on_unseen_samples(self):
        x, y = self.data()
        result = fit_motion_calibration(x[:450], y[:450], x[450:], y[450:])
        self.assertTrue(result.approved)
        self.assertLess(result.validation_rmse, 0.02)
        self.assertEqual(len(result.coefficients), 11)
        self.assertEqual(len(result.head_min), 6)

    def test_rejects_bad_independent_validation(self):
        x, y = self.data()
        self.assertFalse(fit_motion_calibration(x[:450], y[:450], x[450:], 1 - y[450:]).approved)

    def test_rejects_incomplete_screen_coverage(self):
        x, y = self.data()
        y[:, 1] = 0.5
        with self.assertRaisesRegex(ValueError, "Cobertura"):
            fit_motion_calibration(x[:450], y[:450], x[450:], y[450:])

    def test_rejects_nonfinite_and_missing_features(self):
        x, y = self.data()
        for invalid in (x[:450, :4], x[:450] * np.nan):
            with self.assertRaises(ValueError):
                fit_motion_calibration(invalid, y[:450], x[450:], y[450:])
