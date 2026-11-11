import unittest

import numpy as np

from heatcity.calibration import fit_calibration, project


class GeometryTests(unittest.TestCase):
    def setUp(self):
        self.grid = [[x, y] for y in (0.05, 0.5, 0.95) for x in (0.05, 0.5, 0.95)]
        self.held = [[0.2, 0.2], [0.8, 0.2], [0.5, 0.5], [0.2, 0.8], [0.8, 0.8]]

    def test_references_are_preserved_and_holdout_cannot_change_geometry(self):
        good = fit_calibration(self.grid, self.grid, self.held, self.held)
        bad = fit_calibration(self.grid, self.grid, [[x + 0.4, y] for x, y in self.held], self.held)
        self.assertTrue(good.approved)
        self.assertFalse(bad.approved)
        self.assertEqual(good.anchors, bad.anchors)
        self.assertEqual(good.cells, bad.cells)
        self.assertIsNone(project([2, 2], good.anchors, good.cells))

    def test_rejects_folded_references(self):
        folded = np.array(self.grid)
        folded[[0, 4]] = folded[[4, 0]]
        with self.assertRaises(ValueError):
            fit_calibration(folded, self.grid, self.held, self.held)

    def test_per_frame_error_is_checked_even_if_medians_are_good(self):
        groups = [
            [[t[0] + d, t[1]] for d in [-0.15, -0.15, -0.15, 0.15, 0.15, 0.15]] for t in self.held
        ]
        result = fit_calibration(
            self.grid, self.grid, self.held, self.held, validation_samples=groups
        )
        self.assertFalse(result.approved)
        self.assertAlmostEqual(result.validation_rmse, 0.15)
        self.assertAlmostEqual(result.validation_median_rmse, 0)

    def test_requires_full_grid_and_independent_center_quadrants(self):
        with self.assertRaises(ValueError):
            fit_calibration(self.grid[:-1], self.grid[:-1], self.held, self.held)
        with self.assertRaises(ValueError):
            fit_calibration(self.grid, self.grid, self.held, [[0.5, 0.5]] * 5)

    def test_a_bad_corner_cannot_hide_behind_low_overall_rmse(self):
        shifted = [p[:] for p in self.held]
        shifted[0][0] += 0.15
        result = fit_calibration(self.grid, self.grid, shifted, self.held)
        self.assertLess(result.validation_rmse, 0.1)
        self.assertAlmostEqual(result.max_target_rmse, 0.15)
        self.assertFalse(result.approved)
        self.assertEqual(result.target_errors[0]["expected"], [0.2, 0.2])

    def test_dense_grid_keeps_upper_corners_separate_from_top_center(self):
        levels = [0.05, 0.275, 0.5, 0.725, 0.95]
        grid = [[x, y] for y in levels for x in levels]
        # A mirrored eye coordinate system remains geometric, not learned.
        eyes = [[1 - x, y] for x, y in grid]
        held_eyes = [[1 - x, y] for x, y in self.held]
        result = fit_calibration(eyes, grid, held_eyes, self.held)
        self.assertTrue(result.approved)
        for point in [[0.05, 0.05], [0.5, 0.05], [0.95, 0.05]]:
            np.testing.assert_allclose(
                project([1 - point[0], point[1]], result.anchors, result.cells), point
            )
