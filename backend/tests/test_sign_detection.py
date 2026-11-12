"""Experimentos sintéticos controlados; não demonstram precisão em hospitais reais."""

import unittest

import numpy as np

from heatcity.services.sign_detection import detect, report_pdf, summarize


class SignDetectionTests(unittest.TestCase):
    def setUp(self):
        self.reference = np.full((240, 320, 3), 120, dtype=np.uint8)
        self.patch = np.random.default_rng(42).integers(0, 256, (48, 80, 3), dtype=np.uint8)
        self.reference[60:108, 40:120] = self.patch
        self.plate = dict(name="Recepção", x=40 / 320, y=60 / 240, width=0.25, height=0.2)
        self.box = [40 / 320, 60 / 240, 0.25, 0.2]

    def test_known_position_requires_ground_truth_for_measured_accuracy(self):
        result = detect(self.reference, self.reference, [self.plate])
        self.assertEqual(result["signs"][0]["status"], "detected")
        self.assertIsNone(result["metrics"])
        self.assertIsNone(summarize([result])["precision"])
        measured = detect(
            self.reference,
            self.reference,
            [self.plate],
            [dict(name="Recepção", present=True, box=self.box)],
        )
        self.assertEqual(measured["metrics"]["tp"], 1)
        self.assertAlmostEqual(summarize([measured])["mean_iou"], 1)

    def test_missing_sign_counts_as_false_negative_when_expected(self):
        frame = np.full_like(self.reference, 120)
        result = detect(
            frame,
            self.reference,
            [self.plate],
            [dict(name="Recepção", present=True, box=self.box)],
        )
        self.assertEqual(result["signs"][0]["status"], "not_found")
        self.assertEqual(result["metrics"]["fn"], 1)
        self.assertEqual(summarize([result])["recall"], 0)

    def test_duplicate_appearance_abstains_instead_of_claiming_correct_position(self):
        frame = self.reference.copy()
        frame[150:198, 200:280] = self.patch
        result = detect(
            frame,
            self.reference,
            [self.plate],
            [dict(name="Recepção", present=True, box=self.box)],
        )
        self.assertEqual(result["signs"][0]["status"], "ambiguous")
        self.assertEqual(result["metrics"]["abstentions"], 1)
        self.assertEqual(result["metrics"]["fn"], 1)

    def test_positive_detection_with_incorrect_reference_counts_fp_and_fn(self):
        result = detect(
            self.reference,
            self.reference,
            [self.plate],
            [dict(name="Recepção", present=True, box=[0.6, 0.6, 0.25, 0.2])],
        )
        self.assertEqual(result["metrics"]["fp"], 1)
        self.assertEqual(result["metrics"]["fn"], 1)
        self.assertEqual(result["metrics"]["tp"], 0)

    def test_temporal_summary_breaks_on_gaps_uncertainty_and_source_changes(self):
        base = detect(self.reference, self.reference, [self.plate])
        frames = [
            dict(base, time=0, source="one"),
            dict(base, time=0.5, source="one"),
            dict(base, time=5, source="one"),
            dict(base, time=0, source="two"),
        ]
        summary = summarize(frames)["details"][0]
        self.assertEqual(summary["detected_seconds"], 0.5)
        self.assertEqual(summary["events"], 3)
        self.assertIsNone(summary["precision"])

    def test_final_analysis_preserves_reasons_from_earlier_frames(self):
        result = detect(self.reference, self.reference, [self.plate])
        earlier = detect(np.full_like(self.reference, 120), self.reference, [self.plate])
        summary = summarize([earlier, result])["details"][0]
        self.assertTrue(summary["reasons"])
        self.assertEqual(summary["frames"], 2)
        self.assertEqual(summary["detection_fraction"], 0.5)

    def test_pdf_contains_a_valid_document(self):
        result = detect(self.reference, self.reference, [self.plate])
        self.assertTrue(report_pdf([result]).startswith(b"%PDF-"))
