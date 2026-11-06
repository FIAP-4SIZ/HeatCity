"""API inicial; não armazena frames nem dados de participantes."""

from dataclasses import asdict
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from .analysis import Area, Sample, analyze
from .calibration import fit_calibration

app = FastAPI(title="HeatCity", version="0.1.0")


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
        return asdict(fit_calibration(**body.model_dump()))
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error


@app.post("/analysis")
def analysis(body: AnalysisRequest):
    try:
        return analyze(body.samples, body.areas, body.duration)
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
