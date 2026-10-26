import os
import uuid

import numpy as np
import rasterio

from PIL import Image


# ============================================================
# CHROMASAT AI
# FIRE / BURN SPECTRAL INTELLIGENCE
# ============================================================

NBR_LOW_THRESHOLD = 0.10
NBR_MODERATE_THRESHOLD = 0.25

NDVI_LOW_THRESHOLD = 0.25


# ============================================================
# FEATURE CALCULATION
# ============================================================

def calculate_fire_indices(
    image,
):

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
            "Fire analysis requires at least 6 bands: "
            "B2, B3, B4, B8, B11, B12."
        )

    b3 = image[1].astype(
        np.float32
    )

    b4 = image[2].astype(
        np.float32
    )

    b8 = image[3].astype(
        np.float32
    )

    b11 = image[4].astype(
        np.float32
    )

    b12 = image[5].astype(
        np.float32
    )

    ndvi = (
        b8 - b4
    ) / (
        b8 + b4 + 1e-8
    )

    ndwi = (
        b3 - b8
    ) / (
        b3 + b8 + 1e-8
    )

    nbr = (
        b8 - b12
    ) / (
        b8 + b12 + 1e-8
    )

    ndbi = (
        b11 - b8
    ) / (
        b11 + b8 + 1e-8
    )

    return (
        ndvi,
        ndwi,
        nbr,
        ndbi,
    )


# ============================================================
# FIRE EVIDENCE SCORE
# ============================================================

def calculate_fire_score(
    ndvi,
    nbr,
):

    low_ndvi_score = np.clip(
        (
            NDVI_LOW_THRESHOLD
            - ndvi
        )
        /
        (
            NDVI_LOW_THRESHOLD
            + 0.15
        ),
        0,
        1,
    )

    low_nbr_score = np.clip(
        (
            NBR_MODERATE_THRESHOLD
            - nbr
        )
        /
        (
            NBR_MODERATE_THRESHOLD
            - NBR_LOW_THRESHOLD
            + 1e-8
        ),
        0,
        1,
    )

    fire_score = (
        0.45 * low_ndvi_score
        +
        0.55 * low_nbr_score
    )

    return np.clip(
        fire_score,
        0,
        1,
    ).astype(
        np.float32
    )


# ============================================================
# FIRE MASKS
# ============================================================

def create_fire_masks(
    ndvi,
    nbr,
    fire_score,
):

    potential_fire = (
        (fire_score >= 0.35)
        &
        (ndvi < 0.35)
    )

    high_evidence = (
        (fire_score >= 0.65)
        &
        (nbr < NBR_LOW_THRESHOLD)
        &
        (ndvi < NDVI_LOW_THRESHOLD)
    )

    moderate_evidence = (
        potential_fire
        &
        ~high_evidence
    )

    return (
        potential_fire,
        high_evidence,
        moderate_evidence,
    )


# ============================================================
# CONFIDENCE
# ============================================================

def calculate_confidence(
    fire_score,
    ndvi,
    nbr,
):

    ndvi_component = np.clip(
        (
            NDVI_LOW_THRESHOLD
            - ndvi
        )
        /
        (
            NDVI_LOW_THRESHOLD
            + 0.15
        ),
        0,
        1,
    )

    nbr_component = np.clip(
        (
            NBR_MODERATE_THRESHOLD
            - nbr
        )
        /
        (
            NBR_MODERATE_THRESHOLD
            + 1e-8
        ),
        0,
        1,
    )

    confidence = (
        0.5 * fire_score
        +
        0.25 * ndvi_component
        +
        0.25 * nbr_component
    )

    return np.clip(
        confidence,
        0,
        1,
    ).astype(
        np.float32
    )


# ============================================================
# FIRE PREVIEW
# ============================================================

def create_fire_preview(
    potential_fire,
    high_evidence,
    moderate_evidence,
    output_path,
):

    height, width = (
        potential_fire.shape
    )

    rgba = np.zeros(
        (
            height,
            width,
            4,
        ),
        dtype=np.uint8,
    )

    # Moderate evidence
    rgba[
        moderate_evidence,
        0
    ] = 255

    rgba[
        moderate_evidence,
        1
    ] = 145

    rgba[
        moderate_evidence,
        2
    ] = 20

    rgba[
        moderate_evidence,
        3
    ] = 180

    # High evidence
    rgba[
        high_evidence,
        0
    ] = 255

    rgba[
        high_evidence,
        1
    ] = 35

    rgba[
        high_evidence,
        2
    ] = 20

    rgba[
        high_evidence,
        3
    ] = 230

    image = Image.fromarray(
        rgba,
        mode="RGBA",
    )

    image.save(
        output_path,
        optimize=True,
    )


# ============================================================
# CONFIDENCE PREVIEW
# ============================================================

def create_confidence_preview(
    confidence,
    output_path,
):

    image_array = (
        np.clip(
            confidence,
            0,
            1,
        )
        * 255
    ).astype(
        np.uint8
    )

    image = Image.fromarray(
        image_array,
        mode="L",
    )

    image.save(
        output_path,
        optimize=True,
    )


# ============================================================
# FIRE RISK PREVIEW
# ============================================================

def create_risk_preview(
    fire_score,
    high_evidence,
    moderate_evidence,
    output_path,
):

    height, width = (
        fire_score.shape
    )

    rgba = np.zeros(
        (
            height,
            width,
            4,
        ),
        dtype=np.uint8,
    )

    low_risk = (
        ~high_evidence
        &
        ~moderate_evidence
    )

    # Lower risk
    rgba[
        low_risk,
        0
    ] = 50

    rgba[
        low_risk,
        1
    ] = 200

    rgba[
        low_risk,
        2
    ] = 120

    rgba[
        low_risk,
        3
    ] = 160

    # Moderate
    rgba[
        moderate_evidence,
        0
    ] = 255

    rgba[
        moderate_evidence,
        1
    ] = 175

    rgba[
        moderate_evidence,
        2
    ] = 25

    rgba[
        moderate_evidence,
        3
    ] = 200

    # High
    rgba[
        high_evidence,
        0
    ] = 255

    rgba[
        high_evidence,
        1
    ] = 35

    rgba[
        high_evidence,
        2
    ] = 40

    rgba[
        high_evidence,
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
# MAIN FIRE ANALYSIS
# ============================================================

def analyze_fire(
    input_path,
    output_dir,
    analysis_id=None,
):

    """
    Standard disaster-service interface.

    analyze_fire(
        input_path,
        output_dir,
        analysis_id
    )
    """

    if analysis_id is None:

        analysis_id = str(
            uuid.uuid4()
        )

    os.makedirs(
        output_dir,
        exist_ok=True,
    )

    # --------------------------------------------------------
    # Read raster
    # --------------------------------------------------------

    with rasterio.open(
        input_path
    ) as src:

        if src.count < 6:

            raise ValueError(
                "Fire analysis requires at least 6 bands: "
                "B2, B3, B4, B8, B11, B12."
            )

        image = src.read().astype(
            np.float32
        )

        width = src.width
        height = src.height

        bounds = {
            "left": float(
                src.bounds.left
            ),
            "bottom": float(
                src.bounds.bottom
            ),
            "right": float(
                src.bounds.right
            ),
            "top": float(
                src.bounds.top
            ),
        }

        crs = (
            str(src.crs)
            if src.crs
            else None
        )

    # --------------------------------------------------------
    # Spectral indices
    # --------------------------------------------------------

    (
        ndvi,
        ndwi,
        nbr,
        ndbi,
    ) = calculate_fire_indices(
        image
    )

    # --------------------------------------------------------
    # Fire evidence
    # --------------------------------------------------------

    fire_score = calculate_fire_score(
        ndvi,
        nbr,
    )

    (
        potential_fire,
        high_evidence,
        moderate_evidence,
    ) = create_fire_masks(
        ndvi,
        nbr,
        fire_score,
    )

    confidence = calculate_confidence(
        fire_score,
        ndvi,
        nbr,
    )

    # --------------------------------------------------------
    # Statistics
    # --------------------------------------------------------

    total_pixels = (
        height * width
    )

    if total_pixels <= 0:

        raise ValueError(
            "Raster contains no pixels."
        )

    potential_fire_pixels = int(
        np.count_nonzero(
            potential_fire
        )
    )

    high_risk_pixels = int(
        np.count_nonzero(
            high_evidence
        )
    )

    moderate_risk_pixels = int(
        np.count_nonzero(
            moderate_evidence
        )
    )

    low_risk_pixels = (
        total_pixels
        -
        high_risk_pixels
        -
        moderate_risk_pixels
    )

    potential_fire_percentage = (
        potential_fire_pixels
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

    low_risk_percentage = (
        low_risk_pixels
        /
        total_pixels
    ) * 100

    # --------------------------------------------------------
    # Output files
    # --------------------------------------------------------

    fire_preview_filename = (
        f"{analysis_id}_fire.png"
    )

    confidence_preview_filename = (
        f"{analysis_id}_fire_confidence.png"
    )

    risk_preview_filename = (
        f"{analysis_id}_fire_risk.png"
    )

    fire_preview_path = os.path.join(
        output_dir,
        fire_preview_filename,
    )

    confidence_preview_path = os.path.join(
        output_dir,
        confidence_preview_filename,
    )

    risk_preview_path = os.path.join(
        output_dir,
        risk_preview_filename,
    )

    # --------------------------------------------------------
    # Generate previews
    # --------------------------------------------------------

    create_fire_preview(
        potential_fire,
        high_evidence,
        moderate_evidence,
        fire_preview_path,
    )

    create_confidence_preview(
        confidence,
        confidence_preview_path,
    )

    create_risk_preview(
        fire_score,
        high_evidence,
        moderate_evidence,
        risk_preview_path,
    )

    # --------------------------------------------------------
    # Result
    # --------------------------------------------------------

    return {

        "analysis_id":
            analysis_id,

        "image": {

            "width":
                width,

            "height":
                height,

            "bands":
                6,

            "crs":
                crs,

            "bounds":
                bounds,
        },

        "fire_intelligence": {

            "potential_fire_pixels":
                potential_fire_pixels,

            "potential_fire_percentage":
                round(
                    potential_fire_percentage,
                    2,
                ),

            "mean_fire_score":
                round(
                    float(
                        np.nanmean(
                            fire_score
                        )
                    ),
                    4,
                ),

            "mean_confidence":
                round(
                    float(
                        np.nanmean(
                            confidence
                        )
                    ),
                    4,
                ),

            "high_evidence_pixels":
                high_risk_pixels,

            "moderate_evidence_pixels":
                moderate_risk_pixels,

            "method":
                (
                    "NBR + NDVI spectral "
                    "burn-evidence assessment"
                ),
        },

        "risk": {

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

            "low_risk_pixels":
                low_risk_pixels,

            "low_risk_percentage":
                round(
                    low_risk_percentage,
                    2,
                ),
        },

        "indices": {

            "nbr_mean":
                round(
                    float(
                        np.nanmean(
                            nbr
                        )
                    ),
                    4,
                ),

            "ndvi_mean":
                round(
                    float(
                        np.nanmean(
                            ndvi
                        )
                    ),
                    4,
                ),

            "ndwi_mean":
                round(
                    float(
                        np.nanmean(
                            ndwi
                        )
                    ),
                    4,
                ),

            "ndbi_mean":
                round(
                    float(
                        np.nanmean(
                            ndbi
                        )
                    ),
                    4,
                ),
        },

        "outputs": {

            "fire_preview":
                f"/outputs/{fire_preview_filename}",

            "confidence_preview":
                f"/outputs/{confidence_preview_filename}",

            "risk_preview":
                f"/outputs/{risk_preview_filename}",
        },

        "interpretation": {

            "thermal_band_available":
                False,

            "summary":
                (
                    "The system detected potential "
                    "burn-related spectral evidence "
                    "using NBR and vegetation indicators."
                ),

            "warning":
                (
                    "This 6-band Sentinel-2 input does "
                    "not contain a thermal band. The result "
                    "is spectral burn-related evidence, "
                    "not confirmed active-fire temperature "
                    "detection. Field verification and "
                    "thermal or temporal data are recommended."
                ),
        },
    }