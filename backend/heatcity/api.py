"""API inicial; não armazena frames nem dados de participantes."""

from dataclasses import asdict
from time import monotonic
from uuid import uuid4
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from .analysis import Area, Sample, analyze
from .calibration import fit_calibration

app = FastAPI(title="HeatCity", version="0.1.0")
# Somente autorização temporária para prévia local; sem persistência de sessões.
approvals: dict[str, float] = {}


class PreviewRequest(BaseModel):
    calibration_id: str
    consent: bool


@app.post("/tracking/preview")
def preview(body: PreviewRequest):
    if not body.consent or approvals.get(body.calibration_id, 0) <= monotonic():
        raise HTTPException(status_code=403, detail="Consentimento e calibração válida são necessários.")
    return {"authorized": True}


@app.delete("/calibrations/{calibration_id}", status_code=204)
def revoke(calibration_id: str):
    approvals.pop(calibration_id, None)


class CalibrationRequest(BaseModel):
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


@app.post("/calibrations/evaluate")
def calibrate(body: CalibrationRequest):
    try:
        result = asdict(fit_calibration(**body.model_dump()))
        now = monotonic()
        for key, expires in list(approvals.items()):
            if expires <= now:
                approvals.pop(key, None)
        if result["approved"]:
            if len(approvals) >= 1000:
                raise HTTPException(status_code=503, detail="Limite de calibrações ativas atingido.")
            identifier = uuid4().hex
            approvals[identifier] = now + 600
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
