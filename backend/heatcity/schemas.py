"""Contratos de domínio: coordenadas normalizadas, dados finitos e consentimento."""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


class Contract(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False, str_strip_whitespace=True)


class CameraSettings(Contract):
    width: int = Field(ge=1, le=16000)
    height: int = Field(ge=1, le=16000)
    frame_rate: float | None = Field(default=None, ge=0, le=1000)
    focus_mode: str | None = Field(default=None, max_length=40)
    exposure_mode: str | None = Field(default=None, max_length=40)
    white_balance_mode: str | None = Field(default=None, max_length=40)


class ProcessingStats(Contract):
    processed_frames: int = Field(ge=0, le=1000000)
    processed_fps: float = Field(ge=0, le=2000)
    average_fps: float = Field(ge=0, le=2000)
    latency_p90_ms: float = Field(ge=0, le=60000)
    interval_p90_ms: float = Field(ge=0, le=60000)


class Plate(Contract):
    name: str = Field(min_length=1, max_length=60)
    x: float = Field(ge=0, lt=1)
    y: float = Field(ge=0, lt=1)
    width: float = Field(gt=0, le=1)
    height: float = Field(gt=0, le=1)

    @model_validator(mode="after")
    def inside(self):
        self.name = self.name.strip()
        if not self.name or self.x + self.width > 1.000001 or self.y + self.height > 1.000001:
            raise ValueError("Delimite a placa dentro da imagem e informe seu nome.")
        self.width = min(self.width, 1 - self.x)
        self.height = min(self.height, 1 - self.y)
        return self


class StudyInput(Contract):
    title: str = Field(min_length=3, max_length=100)
    objective: str = Field(min_length=10, max_length=1000)


class ScenarioInput(Contract):
    name: str = Field(min_length=1, max_length=80)
    image: str = Field(max_length=6000000)
    plates: list[Plate] = Field(min_length=1, max_length=30)

    @model_validator(mode="after")
    def distinct(self):
        if len({p.name for p in self.plates}) != len(self.plates):
            raise ValueError("Cada placa precisa de um nome único.")
        for i, a in enumerate(self.plates):
            for b in self.plates[i + 1 :]:
                if min(a.x + a.width, b.x + b.width) > max(a.x, b.x) and min(
                    a.y + a.height, b.y + b.height
                ) > max(a.y, b.y):
                    raise ValueError("As áreas das placas não podem se sobrepor.")
        return self


class HospitalExampleInput(Contract):
    scenarios: tuple[ScenarioInput, ScenarioInput]

    @model_validator(mode="after")
    def reception_task(self):
        expected = {"Recepção", "Pronto Socorro", "Ambulatório", "Triagem"}
        if any({p.name for p in scene.plates} != expected for scene in self.scenarios):
            raise ValueError("Cada cenário deve conter as quatro placas do exemplo hospitalar.")
        return self


class SessionInput(Contract):
    participant: str = Field(pattern=r"^[A-Z0-9][A-Z0-9_-]{1,23}$")
    scenario_id: str
    mode: Literal["gaze", "exploratory"] = "gaze"
    target: str
    consent: bool
    calibration_id: str | None = None
    viewport_width: int | None = Field(default=None, ge=200, le=16000)
    viewport_height: int | None = Field(default=None, ge=200, le=16000)

    stimulus_width: float | None = Field(default=None, ge=1, le=16000)
    stimulus_height: float | None = Field(default=None, ge=1, le=16000)
    capture_settings: CameraSettings | None = None


class HeatmapPoint(Contract):
    x: float = Field(ge=0, le=1)
    y: float = Field(ge=0, le=1)
    valid: bool = True


class Point(Contract):
    time: float = Field(ge=0, le=300)
    x: float = Field(ge=0, le=1)
    y: float = Field(ge=0, le=1)
    valid: bool = True


class FinishInput(Contract):
    duration: float = Field(ge=0.1, le=300)
    points: list[Point] = Field(max_length=12000)
    processing_stats: ProcessingStats | None = None

    @model_validator(mode="after")
    def timeline(self):
        times = [p.time for p in self.points]
        if any(t > self.duration for t in times) or any(b <= a for a, b in zip(times, times[1:])):
            raise ValueError("As observações devem ser crescentes e estar dentro da sessão.")
        return self
