import os
import uuid
import numpy as np
import rasterio
from PIL import Image


# ============================================================
# CHROMASAT AI
# FLOOD / WATER INTELLIGENCE SERVICE
# ============================================================

FLOOD_NDWI_POSSIBLE = 0.05
FLOOD_NDWI_HIGH = 0.15

MNDWI_POSSIBLE = 0.05
MNDWI_HIGH = 0.15


# ============================================================
# SAFE NORMALIZATION
# ============================================================

def _safe_normalize(array, low=2, high=98):
    array = np.asarray(array, dtype=np.float32)

    finite = np.isfinite(array)

    if not np.any(finite):
        return np.zeros_like(array, dtype=np.float32)

    values = array[finite]

    p_low = np.percentile(values, low)
    p_high = np.percentile(values, high)

    if p_high <= p_low:
        return np.zeros_like(array, dtype=np.float32)

    normalized = (
        (array - p_low)
        / (p_high - p_low + 1e-8)
    )

    return np.clip(
        normalized,
        0.0,
        1.0,
    )


# ============================================================
# FEATURE CALCULATION
# ============================================================

def calculate_water_indices(image):
    """
    Expected Sentinel-2 band order:

        0 -> B2 Blue
        1 -> B3 Green
        2 -> B4 Red
        3 -> B8 NIR
        4 -> B11 SWIR1
        5 -> B12 SWIR2
    """

    if image.shape[0] < 6:
        raise ValueError(
            "Flood analysis requires 6 Sentinel-2 bands "
            "in the order B2, B3, B4, B8, B11, B12."
        )

    b3 = image[1].astype(np.float32)
    b8 = image[3].astype(np.float32)
    b11 = image[4].astype(np.float32)

    # NDWI
    ndwi = (
        (b3 - b8)
        /
        (b3 + b8 + 1e-8)
    )

    # MNDWI
    mndwi = (
        (b3 - b11)
        /
        (b3 + b11 + 1e-8)
    )

    return ndwi, mndwi


# ============================================================
# WATER CONFIDENCE
# ============================================================

def calculate_water_confidence(
    ndwi,
    mndwi,
):
    """
    Combines NDWI and MNDWI evidence.

    This is an evidence score, not a calibrated probability.
    """

    ndwi_score = np.clip(
        (ndwi - FLOOD_NDWI_POSSIBLE)
        /
        (
            FLOOD_NDWI_HIGH
            - FLOOD_NDWI_POSSIBLE
            + 1e-8
        ),
        0,
        1,
    )

    mndwi_score = np.clip(
        (mndwi - MNDWI_POSSIBLE)
        /
        (
            MNDWI_HIGH
            - MNDWI_POSSIBLE
            + 1e-8
        ),
        0,
        1,
    )

    confidence = (
        0.55 * ndwi_score
        +
        0.45 * mndwi_score
    )

    return np.clip(
        confidence,
        0,
        1,
    ).astype(np.float32)


# ============================================================
# WATER MASK
# ============================================================

def create_water_masks(
    ndwi,
    mndwi,
):
    possible_water = (
        (ndwi >= FLOOD_NDWI_POSSIBLE)
        |
        (mndwi >= MNDWI_POSSIBLE)
    )

    high_water = (
        (ndwi >= FLOOD_NDWI_HIGH)
        &
        (mndwi >= MNDWI_HIGH)
    )

    return possible_water, high_water


# ============================================================
# RISK MODEL
# ============================================================

def calculate_flood_risk(
    ndwi,
    mndwi,
    water_confidence,
):
    """
    Preliminary flood-risk evidence.

    High:
        Strong NDWI + MNDWI agreement.

    Moderate:
        Moderate water evidence.

    Lower:
        Weak water evidence.

    This is not a hydrological flood forecast.
    """

    evidence = (
        0.55 * np.clip(
            ndwi,
            0,
            1,
        )
        +
        0.45 * np.clip(
            mndwi,
            0,
            1,
        )
    )

    evidence = np.clip(
        evidence,
        0,
        1,
    )

    # Combine spectral evidence and confidence.
    risk_score = (
        0.60 * evidence
        +
        0.40 * water_confidence
    )

    risk_score = np.clip(
        risk_score,
        0,
        1,
    )

    high_risk = (
        risk_score >= 0.65
    )

    moderate_risk = (
        (risk_score >= 0.35)
        &
        (risk_score < 0.65)
    )

    lower_risk = (
        risk_score < 0.35
    )

    return (
        risk_score.astype(np.float32),
        high_risk,
        moderate_risk,
        lower_risk,
    )


# ============================================================
# CREATE WATER PREVIEW
# ============================================================

def create_water_preview(
    possible_water,
    high_water,
    output_path,
):
    height, width = possible_water.shape

    rgba = np.zeros(
        (
            height,
            width,
            4,
        ),
        dtype=np.uint8,
    )

    # Possible water
    possible_only = (
        possible_water
        &
        ~high_water
    )

    rgba[
        possible_only,
        0
    ] = 0

    rgba[
        possible_only,
        1
    ] = 190

    rgba[
        possible_only,
        2
    ] = 255

    rgba[
        possible_only,
        3
    ] = 130

    # High-confidence water
    rgba[
        high_water,
        0
    ] = 0

    rgba[
        high_water,
        1
    ] = 100

    rgba[
        high_water,
        2
    ] = 255

    rgba[
        high_water,
        3
    ] = 220

    image = Image.fromarray(
        rgba,
        mode="RGBA",
    )

    image.save(
        output_path,
        optimize=True,
    )


# ============================================================
# CREATE CONFIDENCE PREVIEW
# ============================================================

def create_confidence_preview(
    confidence,
    output_path,
):
    normalized = (
        np.clip(
            confidence,
            0,
            1,
        )
        * 255
    ).astype(np.uint8)

    image = Image.fromarray(
        normalized,
        mode="L",
    )

    image.save(
        output_path,
        optimize=True,
    )


# ============================================================
# CREATE FLOOD RISK PREVIEW
# ============================================================

def create_risk_preview(
    risk_score,
    high_risk,
    moderate_risk,
    lower_risk,
    output_path,
):
    height, width = risk_score.shape

    rgba = np.zeros(
        (
            height,
            width,
            4,
        ),
        dtype=np.uint8,
    )

    # Lower risk
    rgba[
        lower_risk,
        0
    ] = 55

    rgba[
        lower_risk,
        1
    ] = 210

    rgba[
        lower_risk,
        2
    ] = 130

    rgba[
        lower_risk,
        3
    ] = 170

    # Moderate
    rgba[
        moderate_risk,
        0
    ] = 255

    rgba[
        moderate_risk,
        1
    ] = 180

    rgba[
        moderate_risk,
        2
    ] = 30

    rgba[
        moderate_risk,
        3
    ] = 200

    # High
    rgba[
        high_risk,
        0
    ] = 255

    rgba[
        high_risk,
        1
    ] = 55

    rgba[
        high_risk,
        2
    ] = 70

    rgba[
        high_risk,
        3
    ] = 225

    image = Image.fromarray(
        rgba,
        mode="RGBA",
    )

    image.save(
        output_path,
        optimize=True,
    )


# ============================================================
# MAIN FLOOD ANALYSIS
# ============================================================

def analyze_flood(
    input_path,
    output_dir,
):
    analysis_id = str(uuid.uuid4())

    os.makedirs(
        output_dir,
        exist_ok=True,
    )

    with rasterio.open(
        input_path
    ) as src:

        if src.count < 6:
            raise ValueError(
                "Flood analysis requires at least 6 bands: "
                "B2, B3, B4, B8, B11, B12."
            )

        image = src.read().astype(
            np.float32
        )

        width = src.width
        height = src.height

        bounds = {
            "left": float(src.bounds.left),
            "bottom": float(src.bounds.bottom),
            "right": float(src.bounds.right),
            "top": float(src.bounds.top),
        }

        crs = (
            str(src.crs)
            if src.crs
            else None
        )

    # --------------------------------------------------------
    # Indices
    # --------------------------------------------------------

    ndwi, mndwi = calculate_water_indices(
        image
    )

    # --------------------------------------------------------
    # Water evidence
    # --------------------------------------------------------

    water_confidence = calculate_water_confidence(
        ndwi,
        mndwi,
    )

    possible_water, high_water = create_water_masks(
        ndwi,
        mndwi,
    )

    # --------------------------------------------------------
    # Risk
    # --------------------------------------------------------

    (
        risk_score,
        high_risk,
        moderate_risk,
        lower_risk,
    ) = calculate_flood_risk(
        ndwi,
        mndwi,
        water_confidence,
    )

    total_pixels = (
        height * width
    )

    water_pixels = int(
        np.count_nonzero(
            possible_water
        )
    )

    high_water_pixels = int(
        np.count_nonzero(
            high_water
        )
    )

    high_risk_pixels = int(
        np.count_nonzero(
            high_risk
        )
    )

    moderate_risk_pixels = int(
        np.count_nonzero(
            moderate_risk
        )
    )

    lower_risk_pixels = int(
        np.count_nonzero(
            lower_risk
        )
    )

    water_percentage = (
        water_pixels
        /
        total_pixels
    ) * 100

    high_water_percentage = (
        high_water_pixels
        /
        total_pixels
    ) * 100

    high_risk_percentage = (
        high_risk_pixels
        /
        total_pixels
    ) * 100

    moderate_risk_percentage = (
        moderate_risk_pixels
        /
        total_pixels
    ) * 100

    lower_risk_percentage = (
        lower_risk_pixels
        /
        total_pixels
    ) * 100

    # --------------------------------------------------------
    # Preview files
    # --------------------------------------------------------

    water_preview_filename = (
        f"{analysis_id}_water.png"
    )

    confidence_preview_filename = (
        f"{analysis_id}_confidence.png"
    )

    risk_preview_filename = (
        f"{analysis_id}_flood_risk.png"
    )

    water_preview_path = os.path.join(
        output_dir,
        water_preview_filename,
    )

    confidence_preview_path = os.path.join(
        output_dir,
        confidence_preview_filename,
    )

    risk_preview_path = os.path.join(
        output_dir,
        risk_preview_filename,
    )

    create_water_preview(
        possible_water,
        high_water,
        water_preview_path,
    )

    create_confidence_preview(
        water_confidence,
        confidence_preview_path,
    )

    create_risk_preview(
        risk_score,
        high_risk,
        moderate_risk,
        lower_risk,
        risk_preview_path,
    )

    # --------------------------------------------------------
    # Return result
    # --------------------------------------------------------

    return {
        "analysis_id": analysis_id,

        "image": {
            "width": width,
            "height": height,
            "bands": 6,
            "crs": crs,
            "bounds": bounds,
        },

        "water_intelligence": {
            "water_pixels": water_pixels,

            "water_percentage": round(
                water_percentage,
                2,
            ),

            "high_confidence_water_pixels":
                high_water_pixels,

            "high_confidence_water_percentage":
                round(
                    high_water_percentage,
                    2,
                ),

            "water_confidence_mean": round(
                float(
                    np.mean(
                        water_confidence
                    )
                ),
                4,
            ),

            "ndwi_mean": round(
                float(
                    np.nanmean(ndwi)
                ),
                4,
            ),

            "mndwi_mean": round(
                float(
                    np.nanmean(mndwi)
                ),
                4,
            ),

            "method": (
                "NDWI + MNDWI spectral "
                "water evidence"
            ),

            "status": (
                "Potential water-related "
                "evidence detected"
                if water_percentage > 0
                else
                "Low water-related evidence"
            ),
        },

        "disaster_risk": {
            "high_risk_pixels":
                high_risk_pixels,

            "high_risk_percentage":
                round(
                    high_risk_percentage,
                    2,
                ),

            "moderate_risk_pixels":
                moderate_risk_pixels,

            "moderate_risk_percentage":
                round(
                    moderate_risk_percentage,
                    2,
                ),

            "safe_pixels":
                lower_risk_pixels,

            "safe_percentage":
                round(
                    lower_risk_percentage,
                    2,
                ),

            "mean_risk_score":
                round(
                    float(
                        np.mean(
                            risk_score
                        )
                    ),
                    4,
                ),
        },

        "outputs": {
            "water_preview":
                f"/outputs/{water_preview_filename}",

            "confidence_preview":
                f"/outputs/{confidence_preview_filename}",

            "risk_preview":
                f"/outputs/{risk_preview_filename}",
        },

        "interpretation": {
            "summary": (
                "The flood module identifies "
                "water-related spectral evidence "
                "and classifies the scene into "
                "preliminary risk-evidence zones."
            ),

            "warning": (
                "This is preliminary satellite-based "
                "decision support. It does not confirm "
                "a flood event or guarantee safe areas. "
                "Compare with temporal imagery, "
                "hydrological information and official "
                "emergency guidance."
            ),
        },
    }