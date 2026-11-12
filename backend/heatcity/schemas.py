"""Contratos do catálogo de placas: imagens e coordenadas normalizadas finitas."""

from pydantic import BaseModel, ConfigDict, Field, model_validator


class Contract(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False, str_strip_whitespace=True)


class Plate(Contract):
    name: str = Field(min_length=1, max_length=60)
    x: float = Field(ge=0, lt=1)
    y: float = Field(ge=0, lt=1)
    width: float = Field(gt=0, le=1)
    height: float = Field(gt=0, le=1)

    @model_validator(mode="after")
    def inside(self):
        if self.x + self.width > 1.000001 or self.y + self.height > 1.000001:
            raise ValueError("Delimite a placa dentro da imagem.")
        self.width = min(self.width, 1 - self.x)
        self.height = min(self.height, 1 - self.y)
        return self


class ProjectInput(Contract):
    title: str = Field(min_length=3, max_length=100)
    objective: str = Field(min_length=10, max_length=1000)


class ReferenceInput(Contract):
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
                    raise ValueError("Os recortes das placas não podem se sobrepor.")
        return self
