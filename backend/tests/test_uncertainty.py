import unittest

from heatcity.services.evaluation import evaluate
from heatcity.services.uncertainty import session_margin


class UncertaintyTests(unittest.TestCase):
    def setUp(self):
        self.calibration = {"validation_rmse": 0.02, "error_margin": {"axes": [0.03, 0.04]}}
        self.policy = session_margin(self.calibration, 1000, 800, 500, 400)
        self.session = {"target": "A", "calibration": {"uncertainty": self.policy}}
        self.scenario = {"plates": [{"name": "A", "x": 0.2, "y": 0.2, "width": 0.4, "height": 0.4}]}

    def points(self, x, y):
        return [{"time": i / 20, "x": x, "y": y, "valid": True} for i in range(40)]

    def test_screen_margin_scales_to_displayed_image(self):
        self.assertEqual(self.policy["image_axes"], [0.06, 0.08])

    def test_only_ambiguous_observation_is_inconclusive(self):
        result = evaluate(self.session, self.scenario, 2, self.points(0.19, 0.4))
        self.assertFalse(result["eligible"])
        self.assertFalse(result["success"])
        self.assertEqual(result["outcome"], "inconclusive")
        self.assertEqual(result["uncertain_samples"], 40)

    def test_single_certain_jitter_does_not_count_as_success(self):
        points = self.points(0.95, 0.95)
        points[20].update(x=0.4, y=0.4)
        result = evaluate(self.session, self.scenario, 2, points)
        self.assertFalse(result["success"])
        self.assertEqual(result["isolated_certain_samples"], 1)
        self.assertTrue(result["eligible"])

    def test_sustained_certain_observation_counts_from_its_beginning(self):
        points = self.points(0.95, 0.95)
        for p in points[20:]:
            p.update(x=0.4, y=0.4)
        result = evaluate(self.session, self.scenario, 2, points)
        self.assertTrue(result["success"])
        self.assertEqual(result["first_seconds"], 1)
        self.assertEqual(result["confirmed_samples"], 20)

    def test_raw_legacy_sessions_keep_their_original_method(self):
        session = {"target": "A", "calibration": {"validation_rmse": 0.02}}
        result = evaluate(session, self.scenario, 2, self.points(0.4, 0.4))
        self.assertTrue(result["success"])
        self.assertNotIn("uncertainty", result)

    def test_slow_sampling_cannot_be_interpreted_as_a_failure_to_observe(self):
        points = [{"time": i / 4, "x": 0.4, "y": 0.4, "valid": True} for i in range(60)]
        result = evaluate(self.session, self.scenario, 15, points)
        self.assertGreater(result["coverage"], 0.6)
        self.assertFalse(result["eligible"])
        self.assertEqual(result["outcome"], "inconclusive")
        self.assertEqual(result["timely_interval_fraction"], 0)
