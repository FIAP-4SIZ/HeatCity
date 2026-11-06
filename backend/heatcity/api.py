"""API inicial; não armazena frames nem dados de participantes."""

from dataclasses import asdict
from time import monotonic
from typing import Literal
from uuid import uuid4

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from .analysis import Area, Sample, analyze
from .calibration import fit_calibration, fit_motion_calibration
from .workflow import calibration_models, router

app = FastAPI(title="HeatCity", version="1.0.0")
app.include_router(router)
# Somente autorização temporária para prévia local; sem persistência de sessões.
approvals: dict[str, float] = {}


class PreviewRequest(BaseModel):
    calibration_id: str
    consent: bool


@app.post("/tracking/preview")
def preview(body: PreviewRequest):
    if not body.consent or approvals.get(body.calibration_id, 0) <= monotonic():
        raise HTTPException(
            status_code=403, detail="Consentimento e calibração válida são necessários."
        )
    return {"authorized": True}


@app.delete("/calibrations/{calibration_id}", status_code=204)
def revoke(calibration_id: str):
    approvals.pop(calibration_id, None)
    calibration_models.pop(calibration_id, None)


class CalibrationRequest(BaseModel):
    mode: Literal["fixed", "motion"] = "fixed"
    participant_code: str | None = Field(default=None, pattern=r"^[A-Z0-9][A-Z0-9_-]{1,23}$")
    scenario_id: str | None = None
    viewport_width: int | None = Field(default=None, ge=200, le=16000)
    viewport_height: int | None = Field(default=None, ge=200, le=16000)
    features: list[list[float]] = Field(max_length=5000)
    targets: list[list[float]] = Field(max_length=5000)
    validation_features: list[list[float]] = Field(max_length=5000)
    validation_targets: list[list[float]] = Field(max_length=5000)


class AnalysisRequest(BaseModel):
    samples: list[Sample] = Field(max_length=100000)
    areas: list[Area] = Field(max_length=100)
    duration: float


@app.get("/health")
def health():
    return {"status": "ok", "service": "HeatCity"}


@app.post("/diagnostics/calibration")
def diagnostic_calibration(body: CalibrationRequest):
    # A pure evaluation: no authorization ID, model registration or persistence.
    try:
        values = body.model_dump(
            exclude={"mode", "participant_code", "scenario_id", "viewport_width", "viewport_height"}
        )
        fit = fit_motion_calibration if body.mode == "motion" else fit_calibration
        return {**asdict(fit(**values)), "diagnostic_only": True}
    except ValueError as error:
        raise HTTPException(422, str(error)) from error


@app.post("/calibrations/evaluate")
def calibrate(body: CalibrationRequest):
    try:
        values = body.model_dump(
            exclude={"mode", "participant_code", "scenario_id", "viewport_width", "viewport_height"}
        )
        fit = fit_motion_calibration if body.mode == "motion" else fit_calibration
        result = asdict(fit(**values))
        now = monotonic()
        for key, expires in list(approvals.items()):
            if expires <= now:
                approvals.pop(key, None)
                calibration_models.pop(key, None)
        if result["approved"]:
            if len(approvals) >= 1000:
                raise HTTPException(
                    status_code=503, detail="Limite de calibrações ativas atingido."
                )
            identifier = uuid4().hex
            approvals[identifier] = now + 600
            calibration_models[identifier] = {
                **result,
                "expires": now + 600,
                "participant": body.participant_code,
                "scenario_id": body.scenario_id,
                "feature_mode": body.mode,
                "viewport_width": body.viewport_width,
                "viewport_height": body.viewport_height,
            }
            result["calibration_id"] = identifier
            result["expires_in_seconds"] = 600
        return result
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error


@app.post("/analysis")
def analysis(body: AnalysisRequest):
    try:
        return analyze(body.samples, body.areas, body.duration)
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error


@app.middleware("http")
async def request_limit(request, call_next):
    from fastapi.responses import JSONResponse

    if request.method in ("POST", "PUT", "PATCH"):
        body = await request.body()
        if len(body) > 8_000_000:
            return JSONResponse(
                {"detail": "Requisição muito grande (máximo 8 MB)."}, status_code=413
            )
    return await call_next(request)
