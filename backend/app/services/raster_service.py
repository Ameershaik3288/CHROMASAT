import os
import uuid
import numpy as np
import rasterio
from PIL import Image


OUTPUT_DIR = "outputs"


def stretch_band(band):
    low = np.percentile(band, 2)
    high = np.percentile(band, 98)

    stretched = (band - low) / (high - low + 1e-8)

    return np.clip(stretched, 0, 1)


def save_rgb_preview(image, output_path):
    """
    Sentinel-2 band order:
    B2, B3, B4, B8, B11, B12

    RGB = B4, B3, B2
    """

    blue = stretch_band(image[0])
    green = stretch_band(image[1])
    red = stretch_band(image[2])

    rgb = np.dstack([red, green, blue])

    rgb_uint8 = (rgb * 255).astype(np.uint8)

    Image.fromarray(rgb_uint8).save(output_path)


def calculate_indices(image):
    """
    Calculates NDVI and NDWI.

    NDVI = (B8 - B4) / (B8 + B4)
    NDWI = (B3 - B8) / (B3 + B8)
    """

    b3 = image[1]
    b4 = image[2]
    b8 = image[3]

    ndvi = (b8 - b4) / (b8 + b4 + 1e-8)

    ndwi = (b3 - b8) / (b3 + b8 + 1e-8)

    return ndvi, ndwi


def analyze_raster(file_path):
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    analysis_id = str(uuid.uuid4())

    with rasterio.open(file_path) as src:

        image = src.read().astype(np.float32)

        width = src.width
        height = src.height
        band_count = src.count
        crs = str(src.crs)

        bounds = {
            "left": src.bounds.left,
            "bottom": src.bounds.bottom,
            "right": src.bounds.right,
            "top": src.bounds.top,
        }

    if band_count < 6:
        raise ValueError(
            "CHROMASAT currently requires a 6-band Sentinel-2 image "
            "(B2, B3, B4, B8, B11, B12)."
        )

    ndvi, ndwi = calculate_indices(image)

    rgb_path = os.path.join(
        OUTPUT_DIR,
        f"{analysis_id}_rgb.png"
    )

    save_rgb_preview(image, rgb_path)

    result = {
        "analysis_id": analysis_id,

        "image": {
            "width": width,
            "height": height,
            "bands": band_count,
            "crs": crs,
            "bounds": bounds,
        },

        "vegetation": {
            "ndvi_min": float(np.nanmin(ndvi)),
            "ndvi_max": float(np.nanmax(ndvi)),
            "ndvi_mean": float(np.nanmean(ndvi)),
        },

        "water": {
            "ndwi_min": float(np.nanmin(ndwi)),
            "ndwi_max": float(np.nanmax(ndwi)),
            "ndwi_mean": float(np.nanmean(ndwi)),
        },

        "rgb_preview": rgb_path,

        "status": "analysis_completed",
    }

    return result