"""Rotas do MVP local: estudos, cenários imutáveis, sessões e evidências."""

import csv
import io
from datetime import datetime, timezone
from uuid import uuid4

from fastapi import APIRouter, HTTPException, Response

from . import storage
from .schemas import FinishInput, ScenarioInput, SessionInput, StudyInput
from .services.evaluation import evaluate, summarize
from .services.vision import decode_scene, demo_scene, heatmap, image_metrics

router = APIRouter()
# Injected from calibration API; never trust client-supplied approval.
calibration_models = {}


def require(table, identifier):
    value = storage.read(table, identifier)
    if not value:
        raise HTTPException(404, "Registro não encontrado.")
    return value


def now():
    return datetime.now(timezone.utc).isoformat()


def identifier():
    return uuid4().hex


@router.get("/studies")
def studies():
    return storage.list_rows("studies")


@router.post("/studies", status_code=201)
def create_study(body: StudyInput):
    return storage.insert("studies", dict(id=identifier(), created_at=now(), **body.model_dump()))


@router.get("/studies/{study_id}")
def study(study_id: str):
    value = require("studies", study_id)
    value["scenarios"] = storage.list_rows("scenarios", study_id)
    return value


@router.delete("/studies/{study_id}", status_code=204)
def delete_study(study_id: str):
    require("studies", study_id)
    with storage.database() as db:
        db.execute("DELETE FROM studies WHERE id=?", (study_id,))


@router.get("/scene-example")
def example():
    return demo_scene()


@router.post("/studies/{study_id}/scenarios", status_code=201)
def create_scenario(study_id: str, body: ScenarioInput):
    require("studies", study_id)
    try:
        image = decode_scene(body.image)
        plates = [p.model_dump() for p in body.plates]
        return storage.insert(
            "scenarios",
            dict(
                id=identifier(),
                study_id=study_id,
                created_at=now(),
                **body.model_dump(),
                width=image.shape[1],
                height=image.shape[0],
                image_metrics=image_metrics(image, plates),
            ),
            study_id,
        )
    except ValueError as error:
        raise HTTPException(422, str(error)) from error


@router.post("/sessions", status_code=201)
def start_session(body: SessionInput):
    scenario = require("scenarios", body.scenario_id)
    if not body.consent:
        raise HTTPException(422, "O consentimento é obrigatório.")
    plate = next((p for p in scenario["plates"] if p["name"] == body.target), None)
    if not plate:
        raise HTTPException(422, "Selecione uma placa do cenário.")
    calibration = None
    if body.mode == "gaze":
        from time import monotonic

        calibration = calibration_models.get(body.calibration_id)
        if not calibration or calibration["expires"] <= monotonic() or not calibration["approved"]:
            raise HTTPException(
                403, "Calibração aprovada e vigente é obrigatória para olhar experimental."
            )
        if (
            calibration.get("participant") != body.participant
            or calibration.get("scenario_id") != body.scenario_id
        ):
            raise HTTPException(403, "A calibração pertence a outro participante ou cenário.")
        if calibration.get("viewport_width") and (
            body.viewport_width != calibration["viewport_width"]
            or body.viewport_height != calibration["viewport_height"]
        ):
            raise HTTPException(
                403, "O tamanho da tela mudou. Refaça a calibração na mesma tela da sessão."
            )
        if 2 * calibration["validation_rmse"] >= min(plate["width"], plate["height"]):
            raise HTTPException(
                422,
                "Erro espacial incompatível com esta placa. Use uma região maior ou refaça a calibração.",
            )
    snapshot = (
        {
            k: calibration.get(k)
            for k in (
                "validation_rmse",
                "anchors",
                "cells",
                "feature_mode",
                "basis",
                "validation_median_rmse",
                "viewport_width",
                "viewport_height",
                "head_min",
                "head_max",
            )
        }
        if calibration
        else None
    )
    return storage.insert(
        "sessions",
        dict(
            id=identifier(),
            created_at=now(),
            status="running",
            calibration=snapshot,
            study_id=scenario["study_id"],
            **body.model_dump(),
        ),
        body.scenario_id,
    )


@router.post("/sessions/{session_id}/finish")
def finish(session_id: str, body: FinishInput):
    session = require("sessions", session_id)
    scenario = require("scenarios", session["scenario_id"])
    points = [p.model_dump() for p in body.points]
    if (
        session["status"] == "completed"
        and session.get("duration") == body.duration
        and session.get("points") == points
    ):
        return session
    value = {
        **session,
        "status": "completed",
        "duration": body.duration,
        "points": points,
        "finished_at": now(),
        "metrics": evaluate(session, scenario, body.duration, points),
    }
    try:
        storage.finish_session(session_id, value)
    except ValueError as error:
        raise HTTPException(409, str(error)) from error
    return value


@router.post("/sessions/{session_id}/abort")
def abort(session_id: str):
    session = require("sessions", session_id)
    value = {**session, "status": "aborted", "finished_at": now()}
    try:
        storage.finish_session(session_id, value)
    except ValueError as error:
        raise HTTPException(409, str(error)) from error
    return value


@router.delete("/sessions/{session_id}", status_code=204)
def delete_session(session_id: str):
    require("sessions", session_id)
    with storage.database() as db:
        db.execute("DELETE FROM sessions WHERE id=?", (session_id,))


@router.get("/studies/{study_id}/results")
def results(study_id: str):
    value = study(study_id)
    sessions = [
        session
        for scenario in value["scenarios"]
        for session in storage.list_rows("sessions", scenario["id"])
    ]
    return {
        "study": value,
        "sessions": sessions,
        "summary": summarize(value["scenarios"], sessions),
    }


@router.get("/scenarios/{scenario_id}/heatmap")
def scenario_heatmap(scenario_id: str, mode: str = "gaze", session_id: str | None = None):
    if mode != "gaze":
        raise HTTPException(422, "Modo inválido.")
    scenario = require("scenarios", scenario_id)
    all_results = results(scenario["study_id"])
    selected = set(all_results["summary"]["selected_session_ids"])
    sessions = [
        s
        for s in all_results["sessions"]
        if s["scenario_id"] == scenario_id
        and s["mode"] == mode
        and s["status"] == "completed"
        and s["metrics"]["eligible"]
    ]
    sessions = (
        [s for s in sessions if s["id"] == session_id]
        if session_id
        else [s for s in sessions if s["id"] in selected]
    )
    return Response(
        heatmap(decode_scene(scenario["image"]), [p for s in sessions for p in s["points"]]),
        media_type="image/png",
    )


@router.get("/studies/{study_id}/export.csv")
def export_csv(study_id: str):
    rows = results(study_id)["summary"]["rows"]
    output = io.StringIO(newline="")
    fields = [
        "scenario",
        "mode",
        "target",
        "participants",
        "success_rate",
        "non_observation_rate",
        "mean_first_seconds",
        "mean_attention_seconds",
    ]
    writer = csv.DictWriter(output, fieldnames=fields, extrasaction="ignore")
    writer.writeheader()
    for row in rows:
        writer.writerow(
            {
                k: ("'" + v if isinstance(v, str) and v.startswith(("=", "+", "-", "@")) else v)
                for k, v in row.items()
            }
        )
    return Response(
        "\ufeff" + output.getvalue(),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="heatcity-resultados.csv"'},
    )


@router.get("/studies/{study_id}/export.json")
def export_json(study_id: str):
    import json

    return Response(
        json.dumps(results(study_id), ensure_ascii=False),
        media_type="application/json",
        headers={"Content-Disposition": 'attachment; filename="heatcity-evidencias.json"'},
    )


@router.get("/studies/{study_id}/report.pdf")
def pdf(study_id: str):
    from .services.report import build_report

    return Response(
        build_report(results(study_id)),
        media_type="application/pdf",
        headers={"Content-Disposition": 'attachment; filename="HeatCity-relatorio.pdf"'},
    )
