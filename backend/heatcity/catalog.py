"""Projetos e imagens de referência para localização de placas em vídeo."""

import json
from datetime import datetime, timezone
from uuid import uuid4

from fastapi import APIRouter, HTTPException

from . import storage
from .schemas import HospitalInput, ProjectInput, ReferenceInput
from .services.vision import decode_scene, image_metrics, pdi_preview

router = APIRouter()


def require(table, identifier):
    value = storage.read(table, identifier)
    if not value:
        raise HTTPException(404, "Registro não encontrado.")
    return value


def now():
    return datetime.now(timezone.utc).isoformat()


def reference_value(project_id, body):
    try:
        image = decode_scene(body.image)
    except ValueError as error:
        raise HTTPException(422, str(error)) from error
    return dict(
        **body.model_dump(),
        id=uuid4().hex,
        project_id=project_id,
        created_at=now(),
        width=image.shape[1],
        height=image.shape[0],
        image_metrics=image_metrics(image, [p.model_dump() for p in body.plates]),
    )


@router.get("/projects")
def projects():
    return storage.list_rows("projects")


@router.post("/projects", status_code=201)
def create_project(body: ProjectInput):
    return storage.insert("projects", dict(id=uuid4().hex, created_at=now(), **body.model_dump()))


@router.get("/projects/{project_id}")
def project(project_id: str):
    return {
        **require("projects", project_id),
        "references": storage.list_rows("reference_images", project_id),
    }


@router.delete("/projects/{project_id}", status_code=204)
def delete_project(project_id: str):
    require("projects", project_id)
    with storage.database() as db:
        db.execute("DELETE FROM projects WHERE id=?", (project_id,))


@router.post("/projects/{project_id}/references", status_code=201)
def create_reference(project_id: str, body: ReferenceInput):
    require("projects", project_id)
    return storage.insert("reference_images", reference_value(project_id, body), project_id)


@router.get("/references/{reference_id}/pdi")
def reference_pdi(reference_id: str):
    scene = require("reference_images", reference_id)
    return pdi_preview(decode_scene(scene["image"]), scene["plates"])


@router.delete("/references/{reference_id}", status_code=204)
def delete_reference(reference_id: str):
    require("reference_images", reference_id)
    with storage.database() as db:
        db.execute("DELETE FROM reference_images WHERE id=?", (reference_id,))


def create_hospital_project(body: HospitalInput, project_id):
    value = dict(
        id=project_id,
        title="Orientação na entrada de um hospital",
        objective="Localizar e acompanhar as placas cadastradas em vídeo. Imagens de IA fornecidas pelo usuário; a comparação A/B altera múltiplos elementos e não isola o efeito da posição.",
        created_at=now(),
    )
    scenes = [reference_value(project_id, scene) for scene in body.scenarios]
    if (scenes[0]["width"], scenes[0]["height"]) != (scenes[1]["width"], scenes[1]["height"]):
        raise ValueError("As imagens da base devem ter a mesma resolução.")
    with storage.database() as db:
        inserted = db.execute(
            "INSERT OR IGNORE INTO projects(id,payload) VALUES(?,?)",
            (project_id, json.dumps(value)),
        )
        if inserted.rowcount:
            for scene in scenes:
                db.execute(
                    "INSERT INTO reference_images(id,project_id,payload) VALUES(?,?,?)",
                    (scene["id"], project_id, json.dumps(scene)),
                )
    return project(project_id)
