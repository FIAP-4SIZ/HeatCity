import unittest

from heatcity.analysis import Area, Sample, analyze
from heatcity.calibration import fit_calibration


class CalibrationTests(unittest.TestCase):
    def setUp(self):
        self.grid = [[x, y] for x in (0.1, 0.5, 0.9) for y in (0.1, 0.5, 0.9)]
        self.validation = [[0.2, 0.2], [0.8, 0.2], [0.5, 0.5], [0.2, 0.8], [0.8, 0.8]]

    def test_interpolates_measured_references(self):
        features = [[2 * x + 3, 4 * y - 1] for x, y in self.grid]
        validation = [[2 * x + 3, 4 * y - 1] for x, y in self.validation]
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
        samples = [
            Sample(0, 0.2, 0.2),
            Sample(0.1, 0.2, 0.2),
            Sample(0.2, 0.2, 0.2, False),
            Sample(0.3, 0.2, 0.2),
            Sample(0.4, 0.8, 0.8),
        ]
        result = analyze(samples, [self.area], 0.5)
        metric = result["areas"]["recepcao"]
        self.assertAlmostEqual(metric["attention_seconds"], 0.3)
        self.assertEqual(metric["observation_events"], 2)
        self.assertEqual(metric["first_observation_seconds"], 0)
        self.assertAlmostEqual(result["valid_fraction"], 0.8)

    def test_caps_tracking_gaps(self):
        result = analyze([Sample(0, 0.2, 0.2), Sample(1, 0.2, 0.2)], [self.area], 1.1)
        self.assertAlmostEqual(result["areas"]["recepcao"]["attention_seconds"], 0.3)
        self.assertEqual(result["areas"]["recepcao"]["observation_events"], 2)

    def test_empty_session_has_no_observations(self):
        result = analyze([], [self.area], 1)
        self.assertEqual(result["valid_fraction"], 0)
        self.assertIsNone(result["areas"]["recepcao"]["first_observation_seconds"])

    def test_rejects_unordered_timestamps(self):
        with self.assertRaises(ValueError):
            analyze([Sample(0.2, 0.2, 0.2), Sample(0.1, 0.2, 0.2)], [self.area], 1)


class PdiTests(unittest.TestCase):
    def test_uniform_patch_has_zero_contrast_and_laplacian(self):
        import numpy as np

        from heatcity.services.vision import pdi_preview

        roi = {"name": "Uniforme", "x": 0, "y": 0, "width": 1, "height": 1}
        r = pdi_preview(np.full((200, 200, 3), 90, np.uint8), [roi])["regions"][0]
        self.assertEqual(r["luminance"], 90)
        self.assertEqual(r["sharpness"], 0)
        self.assertEqual(r["local_contrast"], 0)
        self.assertEqual(sum(r["histogram"]), 40000)
        self.assertEqual(r["histogram"][90], 40000)

    def test_blurring_same_pattern_reduces_laplacian_variance(self):
        import cv2
        import numpy as np

        from heatcity.services.vision import pdi_preview

        gray = ((np.indices((200, 200)).sum(axis=0) // 8 % 2) * 255).astype(np.uint8)
        image = cv2.cvtColor(gray, cv2.COLOR_GRAY2BGR)
        roi = {"name": "Padrão", "x": 0, "y": 0, "width": 1, "height": 1}
        a = pdi_preview(image, [roi])["regions"][0]
        b = pdi_preview(cv2.GaussianBlur(image, (9, 9), 2), [roi])["regions"][0]
        self.assertGreater(a["sharpness"], b["sharpness"])


if __name__ == "__main__":
    unittest.main()
