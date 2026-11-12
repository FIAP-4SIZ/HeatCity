"""Catálogo, migração, contratos HTTP e operações PDI do domínio de placas."""

import base64
import json
import os
import sqlite3
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import numpy as np
from fastapi.testclient import TestClient
from helpers import demo_scene

from heatcity import storage
from heatcity.api import app
from heatcity.seed import HOSPITAL_ID, seed_hospital
from heatcity.services.vision import png_url


class CatalogTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.environment = patch.dict(os.environ, {"HEATCITY_DATA_DIR": self.directory.name})
        self.environment.start()
        self.client = TestClient(app)
        self.project = self.client.post(
            "/projects",
            json={
                "title": "Entrada do terminal",
                "objective": "Localizar as placas no percurso de chegada.",
            },
        ).json()
        self.reference = self.client.post(
            f"/projects/{self.project['id']}/references", json=demo_scene()
        ).json()

    def tearDown(self):
        self.environment.stop()
        self.directory.cleanup()

    def test_seed_keeps_original_images_and_never_duplicates(self):
        seed_hospital()
        seed_hospital()
        hospital = self.client.get(f"/projects/{HOSPITAL_ID}").json()
        self.assertEqual(len(hospital["references"]), 1)
        fixtures = Path(__file__).resolve().parents[1] / "heatcity/fixtures"
        self.assertEqual(
            base64.b64decode(hospital["references"][0]["image"].split(",")[1]),
            (fixtures / "hospital.jpg").read_bytes(),
        )
        self.assertEqual(len(self.client.get("/projects").json()), 2)
        self.assertNotIn("example_protocol", hospital)

    def test_seed_reconciles_owned_assets_without_deleting_custom_photos(self):
        import hashlib

        seed_hospital()
        retired = self.client.post(f"/projects/{HOSPITAL_ID}/references", json=demo_scene()).json()
        custom_body = {
            **demo_scene(),
            "name": "Minha foto",
            "image": png_url(np.full((200, 200, 3), 90, np.uint8)),
        }
        custom = self.client.post(f"/projects/{HOSPITAL_ID}/references", json=custom_body).json()
        digest = hashlib.sha256(base64.b64decode(retired["image"].split(",")[1])).hexdigest()
        with patch("heatcity.seed.RETIRED_FIXTURE_HASHES", {digest}):
            seed_hospital()
        ids = {r["id"] for r in self.client.get(f"/projects/{HOSPITAL_ID}").json()["references"]}
        self.assertNotIn(retired["id"], ids)
        self.assertIn(custom["id"], ids)
        self.assertEqual(len(ids), 2)

    def test_create_and_delete_reference_and_project_cascade(self):
        url = f"/references/{self.reference['id']}"
        self.assertEqual(self.client.delete(url).status_code, 204)
        self.assertEqual(self.client.get(url + "/pdi").status_code, 404)
        self.client.post(f"/projects/{self.project['id']}/references", json=demo_scene())
        self.assertEqual(self.client.delete(f"/projects/{self.project['id']}").status_code, 204)
        self.assertEqual(storage.list_rows("reference_images"), [])

    def test_invalid_project_and_unregistered_parent_are_rejected(self):
        self.assertEqual(
            self.client.post("/projects", json={"title": "x", "objective": "y"}).status_code, 422
        )
        self.assertEqual(
            self.client.post("/projects/missing/references", json=demo_scene()).status_code, 404
        )

    def test_invalid_overlapping_and_duplicate_boxes_are_rejected(self):
        scene = demo_scene()
        for plates in [
            [dict(scene["plates"][0], width=-1)],
            [scene["plates"][0], scene["plates"][0]],
            [scene["plates"][0], dict(scene["plates"][0], name="Outra")],
        ]:
            response = self.client.post(
                f"/projects/{self.project['id']}/references", json={**scene, "plates": plates}
            )
            self.assertEqual(response.status_code, 422)

    def test_bad_image_does_not_persist_partial_reference(self):
        scene = {**demo_scene(), "image": "data:image/png;base64,invalid"}
        self.assertEqual(
            self.client.post(f"/projects/{self.project['id']}/references", json=scene).status_code,
            422,
        )
        self.assertEqual(len(storage.list_rows("reference_images")), 1)

    def test_pdi_is_pure_and_histogram_covers_the_crop(self):
        result = self.client.get(f"/references/{self.reference['id']}/pdi").json()
        self.assertEqual(len(result["regions"]), 3)
        for region in result["regions"]:
            self.assertEqual(sum(region["histogram"]), region["pixel_count"])
        self.assertEqual(len(storage.list_rows("reference_images")), 1)

    def test_uniform_region_has_zero_contrast_and_sharpness(self):
        body = dict(
            name="Uniforme",
            image=png_url(np.full((200, 200, 3), 90, np.uint8)),
            plates=[dict(name="Placa", x=0, y=0, width=1, height=1)],
        )
        saved = self.client.post(f"/projects/{self.project['id']}/references", json=body).json()
        region = self.client.get(f"/references/{saved['id']}/pdi").json()["regions"][0]
        self.assertEqual(region["sharpness"], 0)
        self.assertEqual(region["local_contrast"], 0)
        self.assertEqual(region["histogram"][90], 40000)

    def test_detection_annotations_and_pdf_do_not_persist_frames(self):
        plate = self.reference["plates"][0]
        annotation = dict(
            name=plate["name"], present=True, box=[plate[k] for k in ("x", "y", "width", "height")]
        )
        url = f"/references/{self.reference['id']}/detect-plates"
        response = self.client.post(
            url, json=dict(image=self.reference["image"], annotations=[annotation])
        )
        self.assertEqual(response.status_code, 200, response.text)
        result = response.json()
        self.assertEqual(result["metrics"]["tp"], 1)
        self.assertEqual(
            self.client.post(
                url, json=dict(image=self.reference["image"], annotations=[annotation, annotation])
            ).status_code,
            422,
        )
        self.assertEqual(
            self.client.post(
                url,
                json=dict(
                    image=self.reference["image"],
                    annotations=[dict(annotation, name="Desconhecida")],
                ),
            ).status_code,
            422,
        )
        report = self.client.post(
            "/sign-detection/report.pdf", json=[dict(result, time=0, source="teste")]
        )
        self.assertEqual(report.status_code, 200)
        self.assertTrue(report.content.startswith(b"%PDF-"))
        self.assertEqual(len(storage.list_rows("reference_images")), 1)
        self.assertEqual(self.client.post("/sign-detection/report.pdf", json=[]).status_code, 422)

    def test_retired_endpoints_are_not_available(self):
        for url in [
            "/calibrations",
            "/geometry/check",
            "/tracking/preview",
            "/analysis",
            "/sessions",
            "/studies",
        ]:
            self.assertEqual(self.client.post(url, json={}).status_code, 404, url)

    def test_lifespan_starts_and_loads_the_catalog(self):
        with TestClient(app) as client:
            self.assertEqual(client.get("/health").status_code, 200)
            self.assertEqual(len(client.get(f"/projects/{HOSPITAL_ID}").json()["references"]), 1)

    def test_example_decodes_real_file_and_rejects_unmatched_reference(self):
        seed_hospital()
        ref = self.client.get(f"/projects/{HOSPITAL_ID}").json()["references"][0]
        url = f"/references/{ref['id']}/detect-demo-frame"
        start = self.client.post(url, json={"frame_index": 0})
        self.assertEqual(start.status_code, 200, start.text)
        self.assertEqual(start.json()["time"], 0)
        self.assertEqual(start.json()["result"]["metrics"]["tp"], 4)
        self.assertTrue(start.json()["preview"].startswith("data:image/png;base64,"))
        absent = self.client.post(url, json={"frame_index": 108}).json()
        self.assertEqual(absent["result"]["metrics"]["tn"], 1)
        self.assertEqual(absent["result"]["metrics"]["tp"], 3)
        self.assertEqual(self.client.post(url, json={"frame_index": 1}).status_code, 422)
        self.assertEqual(
            self.client.post(
                f"/references/{self.reference['id']}/detect-demo-frame", json={"frame_index": 0}
            ).status_code,
            422,
        )

    def test_health_identifies_the_new_domain(self):
        self.assertEqual(self.client.get("/health").json()["version"], "2.0.0")
        paths = self.client.get("/openapi.json").json()["paths"]
        self.assertIn("/references/{reference_id}/detect-plates", paths)
        self.assertNotIn("/calibrations", paths)


class MigrationTests(unittest.TestCase):
    def test_version_one_migration_preserves_catalog_and_removes_retired_records(self):
        with (
            tempfile.TemporaryDirectory() as directory,
            patch.dict(os.environ, {"HEATCITY_DATA_DIR": directory}),
        ):
            db = sqlite3.connect(Path(directory) / "heatcity.sqlite3")
            db.executescript(
                "CREATE TABLE studies(id TEXT PRIMARY KEY,payload TEXT); CREATE TABLE scenarios(id TEXT PRIMARY KEY,study_id TEXT REFERENCES studies(id),payload TEXT); CREATE TABLE sessions(id TEXT PRIMARY KEY,scenario_id TEXT REFERENCES scenarios(id),payload TEXT); PRAGMA user_version=1;"
            )
            project = dict(
                id="p",
                title="Terminal",
                objective="Localizar placas",
                example_protocol={"old": True},
            )
            reference = dict(
                id="r", study_id="p", image="original bytes", plates=[], name="Entrada"
            )
            db.execute("INSERT INTO studies VALUES(?,?)", ("p", json.dumps(project)))
            db.execute("INSERT INTO scenarios VALUES(?,?,?)", ("r", "p", json.dumps(reference)))
            db.execute("INSERT INTO sessions VALUES(?,?,?)", ("s", "r", '{"old":true}'))
            db.commit()
            db.close()
            self.assertEqual(storage.read("reference_images", "r")["image"], "original bytes")
            self.assertEqual(storage.read("reference_images", "r")["project_id"], "p")
            self.assertNotIn("example_protocol", storage.read("projects", "p"))
            with storage.database() as connection:
                self.assertEqual(connection.execute("PRAGMA user_version").fetchone()[0], 2)
                tables = {
                    r[0]
                    for r in connection.execute("SELECT name FROM sqlite_master WHERE type='table'")
                }
                self.assertEqual(tables, {"projects", "reference_images"})
            self.assertEqual(storage.list_rows("reference_images", "p")[0]["id"], "r")

    def test_failed_migration_rolls_back_including_removed_table(self):
        with (
            tempfile.TemporaryDirectory() as directory,
            patch.dict(os.environ, {"HEATCITY_DATA_DIR": directory}),
        ):
            db = sqlite3.connect(Path(directory) / "heatcity.sqlite3")
            db.executescript(
                'CREATE TABLE studies(id TEXT PRIMARY KEY,payload TEXT); CREATE TABLE scenarios(id TEXT PRIMARY KEY,study_id TEXT,payload TEXT); CREATE TABLE sessions(id TEXT PRIMARY KEY,payload TEXT); INSERT INTO studies VALUES("p","invalid json"); PRAGMA user_version=1;'
            )
            db.close()
            with self.assertRaises(json.JSONDecodeError):
                storage.list_rows("projects")
            db = sqlite3.connect(Path(directory) / "heatcity.sqlite3")
            self.assertEqual(db.execute("PRAGMA user_version").fetchone()[0], 1)
            self.assertIsNotNone(
                db.execute("SELECT name FROM sqlite_master WHERE name='sessions'").fetchone()
            )
            db.close()
