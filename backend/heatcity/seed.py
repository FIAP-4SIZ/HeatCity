"""Instala a base versionada como estudo normal, sem tocar em sessões existentes."""

import base64
import hashlib
import json
from pathlib import Path

from . import storage
from .schemas import HospitalExampleInput
from .workflow import create_hospital_study

HOSPITAL_ID = "hospital-orientacao-base-v1"
HOSPITAL_FILE = Path(__file__).parent / "fixtures" / "hospital-study.json"


def seed_hospital(path=None):
    path = Path(path) if path else HOSPITAL_FILE
    if not path.is_file():
        return None  # No placeholder or substitute image when original assets are absent.
    existing = storage.read("studies", HOSPITAL_ID)
    if existing:
        return existing
    fixture = json.loads(path.read_text(encoding="utf-8"))
    scenarios = fixture["scenarios"]
    for scene in scenarios:
        filename = scene["image"]
        if filename.startswith("data:image/"):
            continue
        if Path(filename).name != filename:
            raise ValueError("A imagem da base deve estar no mesmo diretório do manifesto.")
        raw = (path.parent / filename).read_bytes()
        expected_hash = fixture.get("source_sha256", {}).get(filename)
        if expected_hash and hashlib.sha256(raw).hexdigest() != expected_hash:
            raise ValueError("A imagem da base diverge do arquivo original.")
        mime = {".jpg": "jpeg", ".jpeg": "jpeg", ".png": "png", ".webp": "webp"}[
            Path(filename).suffix.lower()
        ]
        scene["image"] = f"data:image/{mime};base64," + base64.b64encode(raw).decode()
    body = HospitalExampleInput.model_validate({"scenarios": scenarios})
    return create_hospital_study(body, study_id=HOSPITAL_ID)
