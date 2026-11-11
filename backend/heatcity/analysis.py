"""Métricas temporais sem converter quantidade de frames em duração."""

import math
from dataclasses import dataclass


@dataclass(frozen=True)
class Area:
    name: str
    x: float
    y: float
    width: float
    height: float

    def __post_init__(self):
        if not self.name.strip() or not all(
            math.isfinite(v) for v in (self.x, self.y, self.width, self.height)
        ):
            raise ValueError("Área inválida.")
        if not (
            0 <= self.x < 1
            and 0 <= self.y < 1
            and self.width > 0
            and self.height > 0
            and self.x + self.width <= 1
            and self.y + self.height <= 1
        ):
            raise ValueError("A área deve estar contida na imagem normalizada.")

    def contains(self, x: float, y: float) -> bool:
        return self.x <= x < self.x + self.width and self.y <= y < self.y + self.height


@dataclass(frozen=True)
class Sample:
    time: float
    x: float
    y: float
    valid: bool = True


def analyze(
    samples: list[Sample], areas: list[Area], duration: float, max_gap: float = 0.2
) -> dict:
    """Cada amostra vale até a próxima, limitada por max_gap e fim da sessão.

    Eventos são entradas consecutivas na AOI, não fixações oculares. Lacunas e
    amostras inválidas interrompem eventos. Áreas sobrepostas contam separadamente.
    """
    if not math.isfinite(duration) or duration <= 0 or not math.isfinite(max_gap) or max_gap <= 0:
        raise ValueError("Duração e intervalo máximo devem ser positivos.")
    if len({area.name for area in areas}) != len(areas):
        raise ValueError("Os identificadores das áreas devem ser únicos.")
    previous = -1.0
    for sample in samples:
        if (
            not math.isfinite(sample.time)
            or not 0 <= sample.time <= duration
            or sample.time <= previous
        ):
            raise ValueError("Tempos devem ser crescentes e estar dentro da sessão.")
        if sample.valid and not (
            math.isfinite(sample.x)
            and math.isfinite(sample.y)
            and 0 <= sample.x <= 1
            and 0 <= sample.y <= 1
        ):
            raise ValueError("Coordenadas válidas devem estar entre zero e um.")
        previous = sample.time
    metrics = {
        area.name: {
            "first_observation_seconds": None,
            "attention_seconds": 0.0,
            "observation_events": 0,
        }
        for area in areas
    }
    active: set[str] = set()
    valid_seconds = 0.0
    for index, sample in enumerate(samples):
        end = samples[index + 1].time if index + 1 < len(samples) else duration
        interval = min(end - sample.time, max_gap)
        current = {
            a.name
            for a in areas
            if sample.valid and interval > 0 and a.contains(sample.x, sample.y)
        }
        if sample.valid:
            valid_seconds += interval
        for name in current:
            metric = metrics[name]
            if metric["first_observation_seconds"] is None:
                metric["first_observation_seconds"] = sample.time
            metric["attention_seconds"] += interval
            if name not in active:
                metric["observation_events"] += 1
        active = current if end - sample.time <= max_gap else set()
    return {
        "areas": metrics,
        "valid_seconds": valid_seconds,
        "valid_fraction": valid_seconds / duration,
        "sample_count": len(samples),
    }
