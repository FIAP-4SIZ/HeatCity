"""Imagens sintéticas isoladas para testes de software."""

import base64

import cv2
import numpy as np


def demo_scene():
    image = np.full((600, 1000, 3), 240, np.uint8)
    cv2.rectangle(image, (0, 300), (999, 599), (215, 225, 228), -1)
    cv2.line(image, (500, 300), (500, 599), (190, 205, 210), 3)
    cv2.putText(
        image, "CENTRO DE ATENDIMENTO", (260, 75), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (75, 90, 85), 2
    )
    plates = []
    for name, text, x, y, color in [
        ("Recepção", "RECEPCAO", 0.1, 0.25, (75, 105, 45)),
        ("Saída", "SAIDA", 0.65, 0.25, (65, 110, 40)),
        ("Banheiros", "BANHEIROS", 0.38, 0.65, (135, 100, 45)),
    ]:
        cv2.rectangle(
            image,
            (int(x * 1000), int(y * 600)),
            (int((x + 0.24) * 1000), int((y + 0.16) * 600)),
            color,
            -1,
        )
        cv2.putText(
            image,
            text,
            (int(x * 1000) + 15, int(y * 600) + 60),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.7,
            (255, 255, 255),
            2,
        )
        plates.append({"name": name, "x": x, "y": y, "width": 0.24, "height": 0.16})
    return {
        "name": "Cenário didático A",
        "image": "data:image/png;base64,"
        + base64.b64encode(cv2.imencode(".png", image)[1]).decode(),
        "plates": plates,
    }
