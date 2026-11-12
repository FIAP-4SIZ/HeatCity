"""API local do detector clássico; quadros são processados sem persistência."""

import base64
import hashlib
import json
from pathlib import Path
from typing import Annotated

import cv2
from fastapi import APIRouter, HTTPException, Response
from pydantic import Field, model_validator

from .catalog import require
from .schemas import Contract, Plate
from .services.sign_detection import detect, report_pdf
from .services.vision import decode_scene, png_url

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


@router.post("/references/{reference_id}/detect-plates")
def frame_detection(reference_id: str, body: FrameInput):
    scenario = require("reference_images", reference_id)
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


class DemoFrameInput(Contract):
    frame_index: int = Field(ge=0, le=143)


@router.post("/references/{reference_id}/detect-demo-frame")
def demo_frame(reference_id: str, body: DemoFrameInput):
    """Decode the actual bundled MP4; never return precomputed predictions."""
    scenario = require("reference_images", reference_id)
    root = Path(__file__).resolve().parents[2] / "frontend/public"
    metadata = json.loads((root / "detection-demo.json").read_text())
    digest = hashlib.sha256(base64.b64decode(scenario["image"].split(",", 1)[1])).hexdigest()
    if digest != metadata["reference_sha256"] or scenario["plates"] != metadata["plates"]:
        raise HTTPException(422, "A referência não corresponde ao vídeo de exemplo.")
    if body.frame_index not in metadata["sample_frame_indices"]:
        raise HTTPException(422, "Quadro fora da grade amostral do exemplo.")
    if (
        hashlib.sha256((root / "detection-demo.mp4").read_bytes()).hexdigest()
        != metadata["video_sha256"]
    ):
        raise HTTPException(
            422, "O vídeo diverge dos dados do exemplo. Regenere os arquivos juntos."
        )
    capture = cv2.VideoCapture(str(root / "detection-demo.mp4"))
    try:
        capture.set(cv2.CAP_PROP_POS_FRAMES, body.frame_index)
        ok, frame = capture.read()
        if not ok or abs(capture.get(cv2.CAP_PROP_POS_FRAMES) - (body.frame_index + 1)) > 0.5:
            raise HTTPException(503, "Não foi possível decodificar o quadro solicitado.")
    finally:
        capture.release()
    time = body.frame_index / metadata["fps"]
    segment = next(s for s in metadata["segments"] if s["start"] <= time < s["end"])
    result = detect(
        frame, decode_scene(scenario["image"]), scenario["plates"], segment["annotations"]
    )
    return {
        "result": result,
        "preview": png_url(frame),
        "time": time,
        "frame_index": body.frame_index,
        "condition": segment["condition"],
    }


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
