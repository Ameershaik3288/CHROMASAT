import os
import uuid

import numpy as np
import rasterio
from rasterio.enums import Resampling
import matplotlib

matplotlib.use("Agg")

import matplotlib.pyplot as plt


# ============================================================
# CHROMASAT AI - DISASTER INTELLIGENCE SERVICE
# ============================================================

CLASS_NAMES = {
    0: "Tree",
    1: "Shrub",
    2: "Grass",
    3: "Cropland",
    4: "Built-up",
    5: "Bare",
    6: "Water",
    7: "Wetland",
}


def normalize_band(band):
    """
    Normalize satellite band values safely to 0-1.
    """

    band = band.astype(np.float32)

    valid = np.isfinite(band)

    if not np.any(valid):
        return np.zeros_like(band, dtype=np.float32)

    low = np.percentile(
        band[valid],
        2,
    )

    high = np.percentile(
        band[valid],
        98,
    )

    if high <= low:
        return np.zeros_like(
            band,
            dtype=np.float32,
        )

    result = (
        band - low
    ) / (
        high - low
    )

    return np.clip(
        result,
        0,
        1,
    )


def calculate_index(numerator, denominator):
    """
    Safe normalized difference index.
    """

    denominator = np.where(
        np.abs(denominator) < 1e-6,
        1e-6,
        denominator,
    )

    index = (
        numerator / denominator
    )

    return np.nan_to_num(
        index,
        nan=0.0,
        posinf=0.0,
        neginf=0.0,
    )


def create_preview(
    array,
    output_path,
    title,
    cmap,
    vmin=None,
    vmax=None,
):
    """
    Create a PNG preview for dashboard display.
    """

    plt.figure(
        figsize=(10, 8)
    )

    plt.imshow(
        array,
        cmap=cmap,
        vmin=vmin,
        vmax=vmax,
    )

    plt.title(
        title,
        fontsize=16,
        fontweight="bold",
    )

    plt.axis("off")

    plt.tight_layout()

    plt.savefig(
        output_path,
        dpi=150,
        bbox_inches="tight",
    )

    plt.close()


def analyze_disaster(
    input_path,
    output_dir,
    analysis_id=None,
):
    """
    Main disaster intelligence pipeline.

    Current capabilities:
    - NDWI water indication
    - MNDWI water indication
    - water confidence
    - flood-risk indication
    - safe-zone indication
    - water/risk/confidence GeoTIFF outputs
    - PNG previews

    This is an image-based risk screening system.
    It is not a replacement for official flood forecasts.
    """

    if analysis_id is None:
        analysis_id = str(
            uuid.uuid4()
        )

    os.makedirs(
        output_dir,
        exist_ok=True,
    )

    # ========================================================
    # READ SATELLITE IMAGE
    # ========================================================

    with rasterio.open(
        input_path
    ) as src:

        image = src.read().astype(
            np.float32
        )

        profile = src.profile.copy()

        width = src.width
        height = src.height

        count = src.count

        crs = src.crs

        bounds = src.bounds

    if count < 6:
        raise ValueError(
            "Disaster analysis requires "
            "at least 6 satellite bands."
        )

    # ========================================================
    # SENTINEL-2 BAND MAPPING
    #
    # Expected order:
    # B2, B3, B4, B8, B11, B12
    # ========================================================

    blue = image[0]
    green = image[1]
    red = image[2]
    nir = image[3]
    swir1 = image[4]
    swir2 = image[5]

    # ========================================================
    # INDICES
    # ========================================================

    ndwi = calculate_index(
        green - nir,
        green + nir,
    )

    mndwi = calculate_index(
        green - swir1,
        green + swir1,
    )

    # ========================================================
    # WATER INDICATION
    # ========================================================
    #
    # MNDWI is useful for separating open water
    # from built-up/background surfaces.
    #
    # NDWI provides an additional vegetation/water signal.
    # ========================================================

    water_score = (
        0.65 * mndwi
        +
        0.35 * ndwi
    )

    water_mask = (
        water_score > 0.05
    )

    # ========================================================
    # WATER CONFIDENCE
    # ========================================================

    confidence = np.zeros_like(
        water_score,
        dtype=np.float32,
    )

    positive = (
        water_score > 0
    )

    confidence[positive] = np.clip(
        water_score[positive] / 0.5,
        0,
        1,
    )

    # Strong agreement between NDWI and MNDWI
    # increases confidence.

    agreement = (
        np.clip(
            (
                ndwi + 1
            ) / 2,
            0,
            1,
        )
        *
        np.clip(
            (
                mndwi + 1
            ) / 2,
            0,
            1,
        )
    )

    confidence = (
        confidence * 0.75
        +
        agreement * 0.25
    )

    confidence = np.clip(
        confidence,
        0,
        1,
    )

    # ========================================================
    # WATER RISK
    # ========================================================

    risk = np.zeros_like(
        water_score,
        dtype=np.uint8,
    )

    # High-risk water indication
    high_risk = (
        (water_mask)
        &
        (confidence >= 0.65)
    )

    # Moderate-risk / uncertain water
    moderate_risk = (
        (water_mask)
        &
        (confidence >= 0.35)
        &
        (confidence < 0.65)
    )

    risk[moderate_risk] = 1
    risk[high_risk] = 2

    # ========================================================
    # SAFE-ZONE INDICATION
    # ========================================================

    safe_zone = (
        risk == 0
    )

    # ========================================================
    # STATISTICS
    # ========================================================

    total_pixels = (
        width * height
    )

    water_pixels = int(
        np.sum(water_mask)
    )

    moderate_pixels = int(
        np.sum(
            risk == 1
        )
    )

    high_pixels = int(
        np.sum(
            risk == 2
        )
    )

    safe_pixels = int(
        np.sum(safe_zone)
    )

    water_percentage = (
        water_pixels
        /
        total_pixels
        *
        100
    )

    moderate_percentage = (
        moderate_pixels
        /
        total_pixels
        *
        100
    )

    high_percentage = (
        high_pixels
        /
        total_pixels
        *
        100
    )

    safe_percentage = (
        safe_pixels
        /
        total_pixels
        *
        100
    )

    # ========================================================
    # OUTPUT FILES
    # ========================================================

    water_file = os.path.join(
        output_dir,
        f"{analysis_id}_water_detection.tif",
    )

    risk_file = os.path.join(
        output_dir,
        f"{analysis_id}_flood_risk.tif",
    )

    confidence_file = os.path.join(
        output_dir,
        f"{analysis_id}_water_confidence.tif",
    )

    water_preview = os.path.join(
        output_dir,
        f"{analysis_id}_water_detection.png",
    )

    risk_preview = os.path.join(
        output_dir,
        f"{analysis_id}_flood_risk.png",
    )

    confidence_preview = os.path.join(
        output_dir,
        f"{analysis_id}_water_confidence.png",
    )

    # ========================================================
    # GEO-TIFF PROFILE
    # ========================================================

    output_profile = profile.copy()

    output_profile.update(
        count=1,
        dtype="uint8",
        compress="lzw",
    )

    # ========================================================
    # WATER MAP
    # ========================================================

    with rasterio.open(
        water_file,
        "w",
        **output_profile,
    ) as dst:

        dst.write(
            water_mask.astype(
                np.uint8
            ),
            1,
        )

    # ========================================================
    # RISK MAP
    #
    # 0 = Safe/background
    # 1 = Moderate
    # 2 = High
    # ========================================================

    with rasterio.open(
        risk_file,
        "w",
        **output_profile,
    ) as dst:

        dst.write(
            risk,
            1,
        )

    # ========================================================
    # CONFIDENCE MAP
    # ========================================================

    confidence_profile = profile.copy()

    confidence_profile.update(
        count=1,
        dtype="float32",
        compress="lzw",
    )

    with rasterio.open(
        confidence_file,
        "w",
        **confidence_profile,
    ) as dst:

        dst.write(
            confidence.astype(
                np.float32
            ),
            1,
        )

    # ========================================================
    # PREVIEWS
    # ========================================================

    create_preview(
        water_mask,
        water_preview,
        "CHROMASAT - Water Detection",
        "Blues",
        0,
        1,
    )

    create_preview(
        risk,
        risk_preview,
        "CHROMASAT - Flood Risk Screening",
        "RdYlGn_r",
        0,
        2,
    )

    create_preview(
        confidence,
        confidence_preview,
        "CHROMASAT - Water Confidence",
        "viridis",
        0,
        1,
    )

    # ========================================================
    # RESULT
    # ========================================================

    return {

        "analysis_id":
            analysis_id,

        "image": {

            "width":
                width,

            "height":
                height,

            "bands":
                count,

            "crs":
                str(crs),

            "bounds": {

                "left":
                    bounds.left,

                "bottom":
                    bounds.bottom,

                "right":
                    bounds.right,

                "top":
                    bounds.top,
            },
        },

        "water_intelligence": {

            "water_pixels":
                water_pixels,

            "water_percentage":
                round(
                    water_percentage,
                    2,
                ),

            "water_confidence_mean":
                round(
                    float(
                        np.mean(
                            confidence
                        )
                    ),
                    4,
                ),

            "ndwi_mean":
                round(
                    float(
                        np.mean(
                            ndwi
                        )
                    ),
                    4,
                ),

            "mndwi_mean":
                round(
                    float(
                        np.mean(
                            mndwi
                        )
                    ),
                    4,
                ),
        },

        "disaster_risk": {

            "high_risk_pixels":
                high_pixels,

            "high_risk_percentage":
                round(
                    high_percentage,
                    2,
                ),

            "moderate_risk_pixels":
                moderate_pixels,

            "moderate_risk_percentage":
                round(
                    moderate_percentage,
                    2,
                ),

            "safe_pixels":
                safe_pixels,

            "safe_percentage":
                round(
                    safe_percentage,
                    2,
                ),
        },

        "outputs": {

            "water_map":
                water_file,

            "risk_map":
                risk_file,

            "confidence_map":
                confidence_file,

            "water_preview":
                water_preview,

            "risk_preview":
                risk_preview,

            "confidence_preview":
                confidence_preview,
        },
    }