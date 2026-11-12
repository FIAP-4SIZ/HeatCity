"""Instala uma foto e seus recortes; reconcilia apenas ativos distribuídos pelo app."""

import base64
import hashlib
import json
from pathlib import Path

from . import storage
from .catalog import now, reference_value
from .schemas import ReferenceInput

HOSPITAL_ID = "hospital-orientacao-base-v1"
HOSPITAL_FILE = Path(__file__).parent / "fixtures" / "hospital-reference.json"
# Content-addressed cleanup for installations made before the current fixture.
# No user-provided images outside the application-owned project are touched.
RETIRED_FIXTURE_HASHES = {"c0026aa231b66fdfca6ccf036c8958e941e3f35ae752afb6b1d73d63fa708125"}


def seed_hospital(path=None):
    path = Path(path) if path else HOSPITAL_FILE
    fixture = json.loads(path.read_text(encoding="utf-8"))
    reference = fixture["reference"]
    filename = reference["image"]
    if Path(filename).name != filename:
        raise ValueError("A foto deve estar no mesmo diretório do manifesto.")
    raw = (path.parent / filename).read_bytes()
    expected_hash = fixture["source_sha256"]
    if hashlib.sha256(raw).hexdigest() != expected_hash:
        raise ValueError("A foto da base diverge do arquivo original.")
    reference["image"] = "data:image/jpeg;base64," + base64.b64encode(raw).decode()
    body = ReferenceInput.model_validate(reference)
    value = dict(
        id=HOSPITAL_ID,
        title="Hospital — exemplo pronto",
        objective="Localizar e acompanhar quatro placas em um vídeo sintético de 12 segundos.",
        created_at=now(),
    )
    canonical = reference_value(HOSPITAL_ID, body)
    canonical.update(id="hospital-placas-base-v1", fixture_key="hospital-signs")
    with storage.database() as db:
        existing = db.execute("SELECT payload FROM projects WHERE id=?", (HOSPITAL_ID,)).fetchone()
        if existing:
            value["created_at"] = json.loads(existing["payload"]).get(
                "created_at", value["created_at"]
            )
            db.execute("UPDATE projects SET payload=? WHERE id=?", (json.dumps(value), HOSPITAL_ID))
        else:
            db.execute(
                "INSERT INTO projects(id,payload) VALUES(?,?)", (HOSPITAL_ID, json.dumps(value))
            )
        installed = None
        for row in db.execute(
            "SELECT id,payload FROM reference_images WHERE project_id=?", (HOSPITAL_ID,)
        ).fetchall():
            saved = json.loads(row["payload"])
            try:
                digest = hashlib.sha256(
                    base64.b64decode(saved["image"].split(",", 1)[1], validate=True)
                ).hexdigest()
            except (ValueError, IndexError, KeyError):
                continue
            if digest in RETIRED_FIXTURE_HASHES:
                db.execute("DELETE FROM reference_images WHERE id=?", (row["id"],))
            elif (
                digest == expected_hash
                and saved.get("plates") == canonical["plates"]
                and installed is None
            ):
                installed = row["id"]
                canonical.update(
                    id=installed, created_at=saved.get("created_at", canonical["created_at"])
                )
                db.execute(
                    "UPDATE reference_images SET payload=? WHERE id=?",
                    (json.dumps(canonical), installed),
                )
        if installed is None:
            db.execute(
                "INSERT INTO reference_images(id,project_id,payload) VALUES(?,?,?)",
                (canonical["id"], HOSPITAL_ID, json.dumps(canonical)),
            )
    return value
