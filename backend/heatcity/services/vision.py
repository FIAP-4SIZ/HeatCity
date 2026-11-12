"""Operações OpenCV sobre cenas/AOIs; não processa nem persiste faces."""

import base64
import io
import warnings

import cv2
import numpy as np
from PIL import Image


def decode_scene(data_url):
    if not data_url.startswith(
        ("data:image/png;base64,", "data:image/jpeg;base64,", "data:image/webp;base64,")
    ):
        raise ValueError("Envie PNG, JPEG ou WebP. SVG não é aceito.")
    try:
        raw = base64.b64decode(data_url.split(",", 1)[1], validate=True)
        if len(raw) > 4_000_000:
            raise ValueError("A imagem deve ter no máximo 4 MB.")
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(io.BytesIO(raw)) as picture:
                if picture.width * picture.height > 8_000_000 or min(picture.size) < 200:
                    raise ValueError(
                        "Use imagem com pelo menos 200 px por lado e até 8 megapixels."
                    )
                if picture.format not in ("PNG", "JPEG", "WEBP"):
                    raise ValueError("Formato de imagem inválido.")
                picture.verify()
        image = cv2.imdecode(np.frombuffer(raw, np.uint8), cv2.IMREAD_COLOR)
        if image is None:
            raise ValueError("Não foi possível ler a imagem.")
        return image
    except (
        ValueError,
        OSError,
        Image.DecompressionBombError,
        Image.DecompressionBombWarning,
    ) as error:
        raise ValueError(str(error)) from error


def aoi_crop(image, plate):
    height, width = image.shape[:2]
    x0, y0 = int(plate["x"] * width), int(plate["y"] * height)
    x1 = max(int((plate["x"] + plate["width"]) * width), x0 + 1)
    y1 = max(int((plate["y"] + plate["height"]) * height), y0 + 1)
    return image[y0:y1, x0:x1]


def png_url(image):
    return "data:image/png;base64," + base64.b64encode(cv2.imencode(".png", image)[1]).decode()


def pdi_preview(image, plates):
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    regions = []
    for plate, metrics in zip(plates, image_metrics(image, plates)):
        roi = aoi_crop(gray, plate)
        laplacian = cv2.Laplacian(roi, cv2.CV_64F)
        magnitude = np.abs(laplacian)
        peak = float(magnitude.max())
        visual = (magnitude / peak * 255).astype(np.uint8) if peak else np.zeros_like(roi)
        low, high = np.percentile(roi, [1, 99])
        regions.append(
            {
                **metrics,
                "p1": float(low),
                "p99": float(high),
                "pixel_count": int(roi.size),
                "histogram": np.bincount(roi.ravel(), minlength=256).tolist(),
                "original": png_url(aoi_crop(image, plate)),
                "gray": png_url(roi),
                "laplacian": png_url(visual),
            }
        )
    return {"gray_scene": png_url(gray), "regions": regions}


def image_metrics(image, plates):
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    metrics = []
    for plate in plates:
        roi = aoi_crop(gray, plate)
        low, high = np.percentile(roi, [1, 99])
        metrics.append(
            {
                "name": plate["name"],
                "area_percent": round(100 * plate["width"] * plate["height"], 2),
                "luminance": round(float(roi.mean()), 1),
                "local_contrast": round(float((high - low) / (high + low + 1e-6)), 3),
                "sharpness": round(float(cv2.Laplacian(roi, cv2.CV_64F).var()), 1),
            }
        )
    return metrics


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


def heatmap(image, points, blur_fraction=0.025):
    height, width = image.shape[:2]
    scale = min(1, 1200 / width)
    image = cv2.resize(image, (int(width * scale), int(height * scale)))
    height, width = image.shape[:2]
    density = np.zeros((height, width), np.float32)
    for point in points:
        if point["valid"]:
            density[
                min(height - 1, int(point["y"] * height)), min(width - 1, int(point["x"] * width))
            ] += 1
    if density.max() > 0:
        density = cv2.GaussianBlur(density, (0, 0), max(5, width * blur_fraction))
        normalized = density / density.max()
        colors = cv2.applyColorMap((normalized * 255).astype(np.uint8), cv2.COLORMAP_TURBO)
        alpha = (normalized * 0.7)[..., None]
        image = (image * (1 - alpha) + colors * alpha).astype(np.uint8)
    return cv2.imencode(".png", image)[1].tobytes()
