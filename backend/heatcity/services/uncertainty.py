"""Margem empírica em unidades da tela e conversão para a imagem exibida."""


def session_margin(
    calibration, viewport_width=None, viewport_height=None, image_width=None, image_height=None
):
    axes = (calibration.get("error_margin") or {}).get("axes")
    if axes is None:
        axes = [calibration["validation_rmse"]] * 2
    screen = [max(float(v), 0) for v in axes]
    scaled = (
        [screen[0] * viewport_width / image_width, screen[1] * viewport_height / image_height]
        if all([viewport_width, viewport_height, image_width, image_height])
        else screen
    )
    return {
        "policy": "observed_envelope_v1",
        "screen_axes": screen,
        "image_axes": scaled,
        "minimum_observation_seconds": 0.2,
        "maximum_gap_seconds": 0.2,
        "note": "Margem empírica, sem garantia de contenção do olhar real.",
    }
