import unittest

import numpy as np

from heatcity.calibration import fit_precision_calibration


class PrecisionTests(unittest.TestCase):
    def dataset(self):
        rng = np.random.default_rng(51)
        targets = np.array(
            [[x, y] for y in (0.1, 0.3, 0.5, 0.7, 0.9) for x in (0.1, 0.3, 0.5, 0.7, 0.9)]
        )
        held = np.array(
            [
                [0.2, 0.2],
                [0.8, 0.2],
                [0.2, 0.8],
                [0.8, 0.8],
                [0.4, 0.4],
                [0.6, 0.4],
                [0.4, 0.6],
                [0.6, 0.6],
                [0.5, 0.2],
            ]
        )

        def features(y):
            head = rng.normal(0, 0.02, (len(y), 6))
            eyes = np.column_stack(
                (
                    0.6 - 0.25 * y[:, 0] + head[:, 0],
                    0.1 * y[:, 1] + head[:, 1],
                    0.55 - 0.2 * y[:, 0] + head[:, 0],
                    0.12 * y[:, 1] + head[:, 1],
                )
            )
            return np.column_stack((eyes, head))

        return targets, held, features(targets), features(held)

    def test_independent_validation_and_training_only_selection(self):
        y, vy, x, vx = self.dataset()
        good = fit_precision_calibration(x, y, vx, vy)
        bad = fit_precision_calibration(
            x, y, vx + np.array([0.3, 0.3, 0.3, 0.3, 0, 0, 0, 0, 0, 0]), vy
        )
        self.assertTrue(good.approved)
        self.assertLess(good.validation_rmse, 0.1)
        self.assertFalse(bad.approved)
        self.assertEqual(good.ridge_alpha, bad.ridge_alpha)
        self.assertEqual(good.coefficients, bad.coefficients)
        self.assertEqual(len(good.validation_axis_rmse), 2)

    def test_incomplete_grid_rejected(self):
        y, vy, x, vx = self.dataset()
        with self.assertRaises(ValueError):
            fit_precision_calibration(x[:-1], y[:-1], vx, vy)

    def test_repeated_anchor_cannot_make_an_incomplete_grid_valid(self):
        y, vy, x, vx = self.dataset()
        with self.assertRaises(ValueError):
            fit_precision_calibration(
                np.vstack((x[:-1], x[:5])), np.vstack((y[:-1], y[:5])), vx, vy
            )

    def test_validation_cannot_repeat_one_easy_point(self):
        y, vy, x, vx = self.dataset()
        with self.assertRaises(ValueError):
            fit_precision_calibration(x, y, vx, np.full_like(vy, 0.5))
