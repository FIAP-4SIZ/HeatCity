"""API local do detector clássico; quadros são processados sem persistência."""

import json
from typing import Annotated

from fastapi import APIRouter, HTTPException, Response
from pydantic import Field, model_validator

from .schemas import Contract, Plate
from .services.sign_detection import detect, report_pdf
from .services.vision import decode_scene
from .workflow import require

router = APIRouter()


class Annotation(Contract):
    name: str = Field(min_length=1, max_length=60)
    present: bool
    box: list[float] | None = Field(default=None, min_length=4, max_length=4)

    @model_validator(mode="after")
    def check(self):
        if self.present:
            if self.box is None:
                raise ValueError("Marque a posição da placa presente.")
            Plate(
                name=self.name, x=self.box[0], y=self.box[1], width=self.box[2], height=self.box[3]
            )
        elif self.box is not None:
            raise ValueError("Placa ausente não tem caixa de referência.")
        return self


class FrameInput(Contract):
    image: str = Field(max_length=6000000)
    annotations: list[Annotation] = Field(default_factory=list, max_length=30)


@router.post("/scenarios/{scenario_id}/detect-plates")
def frame_detection(scenario_id: str, body: FrameInput):
    scenario = require("scenarios", scenario_id)
    names = [a.name for a in body.annotations]
    if len(set(names)) != len(names) or not set(names) <= set(
        p["name"] for p in scenario["plates"]
    ):
        raise HTTPException(422, "Anote cada placa cadastrada no máximo uma vez.")
    try:
        return detect(
            decode_scene(body.image),
            decode_scene(scenario["image"]),
            scenario["plates"],
            [a.model_dump() for a in body.annotations],
        )
    except ValueError as e:
        raise HTTPException(422, str(e)) from e


@router.post("/sign-detection/report.pdf")
def detection_report(frames: Annotated[list[dict], Field(min_length=1, max_length=300)]):
    # Input is an exported local experiment, not verified human observations.
    if len(json.dumps(frames)) > 5000000:
        raise HTTPException(413, "Relatório muito grande.")
    try:
        data = report_pdf(frames)
    except (ValueError, TypeError, KeyError, OverflowError) as e:
        raise HTTPException(422, "Registros de detecção inválidos.") from e
    return Response(
        data,
        media_type="application/pdf",
        headers={"Content-Disposition": 'attachment; filename="HeatCity-deteccao-placas.pdf"'},
    )
