import unittest

from heatcity.analysis import Area, Sample, analyze
from heatcity.calibration import fit_calibration


class CalibrationTests(unittest.TestCase):
    def setUp(self):
        self.grid = [[x, y] for x in (0.1, 0.5, 0.9) for y in (0.1, 0.5, 0.9)]
        self.validation = [[0.2, 0.2], [0.8, 0.2], [0.5, 0.5], [0.2, 0.8], [0.8, 0.8]]

    def test_recovers_affine_transform_with_independent_validation(self):
        features = [[2*x + 3, 4*y - 1] for x, y in self.grid]
        validation = [[2*x + 3, 4*y - 1] for x, y in self.validation]
        result = fit_calibration(features, self.grid, validation, self.validation)
        self.assertTrue(result.approved)
        self.assertLess(result.validation_rmse, 1e-10)

    def test_rejects_validation_error_even_when_training_is_perfect(self):
        shifted = [[x + 1, y] for x, y in self.validation]
        self.assertFalse(fit_calibration(self.grid, self.grid, shifted, self.validation).approved)

    def test_rejects_degenerate_features(self):
        with self.assertRaises(ValueError):
            fit_calibration([[1, 1]] * 9, self.grid, self.validation, self.validation)


class AnalysisTests(unittest.TestCase):
    def setUp(self):
        self.area = Area("recepcao", 0, 0, 0.5, 0.5)

    def test_counts_reentry_and_excludes_invalid_time(self):
        samples = [Sample(0, .2, .2), Sample(.1, .2, .2), Sample(.2, .2, .2, False),
                   Sample(.3, .2, .2), Sample(.4, .8, .8)]
        result = analyze(samples, [self.area], .5)
        metric = result["areas"]["recepcao"]
        self.assertAlmostEqual(metric["attention_seconds"], .3)
        self.assertEqual(metric["observation_events"], 2)
        self.assertEqual(metric["first_observation_seconds"], 0)
        self.assertAlmostEqual(result["valid_fraction"], .8)

    def test_caps_tracking_gaps(self):
        result = analyze([Sample(0, .2, .2), Sample(1, .2, .2)], [self.area], 1.1)
        self.assertAlmostEqual(result["areas"]["recepcao"]["attention_seconds"], .3)
        self.assertEqual(result["areas"]["recepcao"]["observation_events"], 2)

    def test_empty_session_has_no_observations(self):
        result = analyze([], [self.area], 1)
        self.assertEqual(result["valid_fraction"], 0)
        self.assertIsNone(result["areas"]["recepcao"]["first_observation_seconds"])

    def test_rejects_unordered_timestamps(self):
        with self.assertRaises(ValueError):
            analyze([Sample(.2, .2, .2), Sample(.1, .2, .2)], [self.area], 1)


if __name__ == "__main__":
    unittest.main()
