import os
import joblib
import numpy as np
import pandas as pd
import rasterio

from PIL import Image


# ============================================================
# CHROMASAT AI
# LAND COVER + CONFIDENCE + WATER INTELLIGENCE
# ============================================================

BASE_DIR = os.path.abspath(
    os.path.join(
        os.path.dirname(__file__),
        "..",
        "..",
    )
)

MODEL_PATH = os.path.join(
    BASE_DIR,
    "models",
    "nandyal_landcover_rf.joblib",
)


# ============================================================
# LAND COVER CLASSES
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


# ============================================================
# MODEL FEATURES
# ============================================================

FEATURES = [
    "B2",
    "B3",
    "B4",
    "B8",
    "B11",
    "B12",
    "NDVI",
    "NDWI",
    "NDBI",
]


# ============================================================
# WATER SETTINGS
# ============================================================

# NDWI:
# (Green - NIR) / (Green + NIR)
#
# Positive NDWI is generally associated with open water.
# We deliberately expose the threshold instead of pretending
# that one universal threshold works for every scene.

WATER_POSSIBLE_THRESHOLD = 0.00
WATER_HIGH_CONFIDENCE_THRESHOLD = 0.10


# ============================================================
# MODEL LOADER
# ============================================================

def _find_predictor(obj, depth=0):
    """
    Recursively locate the actual sklearn estimator.

    Supports:
        - direct sklearn model
        - {"model": model}
        - nested dictionaries
        - lists / tuples containing a model
    """

    if depth > 6:
        return None

    # Actual estimator
    if hasattr(obj, "predict"):

        return obj

    # Dictionary wrapper
    if isinstance(obj, dict):

        # Most common structure
        if "model" in obj:

            found = _find_predictor(
                obj["model"],
                depth + 1,
            )

            if found is not None:
                return found

        # Search remaining values
        for value in obj.values():

            found = _find_predictor(
                value,
                depth + 1,
            )

            if found is not None:
                return found

    # List / tuple wrapper
    elif isinstance(obj, (list, tuple)):

        for value in obj:

            found = _find_predictor(
                value,
                depth + 1,
            )

            if found is not None:
                return found

    return None


def load_model():

    print("=" * 60)
    print("CHROMASAT AI - LOADING LAND COVER MODEL")
    print("=" * 60)

    print("Looking for model at:")
    print(MODEL_PATH)

    if not os.path.exists(MODEL_PATH):

        raise FileNotFoundError(
            f"Land-cover model not found: {MODEL_PATH}"
        )

    try:

        package = joblib.load(
            MODEL_PATH
        )

    except Exception as error:

        raise RuntimeError(
            f"Unable to load land-cover model: {error}"
        )

    print(
        "Loaded object type:",
        type(package).__name__,
    )

    model = _find_predictor(package)

    if model is None:

        raise TypeError(
            "The joblib file does not contain "
            "a valid sklearn predictor."
        )

    print(
        "Actual predictor type:",
        type(model).__name__,
    )

    print("✅ Land-cover model loaded")

    return model


# ============================================================
# SPECTRAL FEATURES
# ============================================================

def calculate_features(image):

    # Sentinel-2 band order:
    #
    # 0 -> B2 Blue
    # 1 -> B3 Green
    # 2 -> B4 Red
    # 3 -> B8 NIR
    # 4 -> B11 SWIR1
    # 5 -> B12 SWIR2

    b2 = image[0]
    b3 = image[1]
    b4 = image[2]
    b8 = image[3]
    b11 = image[4]
    b12 = image[5]

    # --------------------------------------------------------
    # NDVI
    # --------------------------------------------------------

    ndvi = (
        (b8 - b4)
        /
        (b8 + b4 + 1e-8)
    )

    # --------------------------------------------------------
    # NDWI
    # --------------------------------------------------------

    ndwi = (
        (b3 - b8)
        /
        (b3 + b8 + 1e-8)
    )

    # --------------------------------------------------------
    # NDBI
    # --------------------------------------------------------

    ndbi = (
        (b11 - b8)
        /
        (b11 + b8 + 1e-8)
    )

    features = np.stack(
        [
            b2,
            b3,
            b4,
            b8,
            b11,
            b12,
            ndvi,
            ndwi,
            ndbi,
        ],
        axis=-1,
    )

    return features


# ============================================================
# NORMALIZE ARRAY FOR PREVIEW
# ============================================================

def normalize_to_uint8(array):

    array = np.asarray(
        array,
        dtype=np.float32,
    )

    finite = np.isfinite(array)

    if not np.any(finite):

        return np.zeros(
            array.shape,
            dtype=np.uint8,
        )

    values = array[finite]

    low = np.percentile(
        values,
        2,
    )

    high = np.percentile(
        values,
        98,
    )

    if high <= low:

        return np.zeros(
            array.shape,
            dtype=np.uint8,
        )

    normalized = (
        (array - low)
        /
        (high - low)
    )

    normalized = np.clip(
        normalized,
        0,
        1,
    )

    return (
        normalized * 255
    ).astype(
        np.uint8
    )


# ============================================================
# CREATE CONFIDENCE PREVIEW
# ============================================================

def create_confidence_preview(
    confidence_map,
    output_path,
):

    normalized = (
        np.clip(
            confidence_map,
            0,
            1,
        )
        * 255
    ).astype(
        np.uint8
    )

    image = Image.fromarray(
        normalized,
        mode="L",
    )

    image.save(
        output_path,
        optimize=True,
    )


# ============================================================
# CREATE WATER PREVIEW
# ============================================================

def create_water_preview(
    ndwi,
    water_possible,
    water_high,
    output_path,
):

    height, width = ndwi.shape

    rgba = np.zeros(
        (
            height,
            width,
            4,
        ),
        dtype=np.uint8,
    )

    # --------------------------------------------------------
    # Possible water
    # --------------------------------------------------------

    possible_only = (
        water_possible
        &
        ~water_high
    )

    # Possible water:
    # cyan with moderate transparency
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
    ] = 120

    # --------------------------------------------------------
    # High confidence water
    # --------------------------------------------------------

    rgba[
        water_high,
        0
    ] = 0

    rgba[
        water_high,
        1
    ] = 120

    rgba[
        water_high,
        2
    ] = 255

    rgba[
        water_high,
        3
    ] = 210

    image = Image.fromarray(
        rgba,
        mode="RGBA",
    )

    image.save(
        output_path,
        optimize=True,
    )


# ============================================================
# CREATE LAND-COVER PREVIEW
# ============================================================

def create_landcover_preview(
    prediction_map,
    output_path,
):

    # Earth-observation visualization palette
    #
    # 0 Tree
    # 1 Shrub
    # 2 Grass
    # 3 Cropland
    # 4 Built-up
    # 5 Bare
    # 6 Water
    # 7 Wetland

    palette = {
        0: (34, 197, 94),
        1: (132, 204, 22),
        2: (74, 222, 128),
        3: (250, 204, 21),
        4: (239, 68, 68),
        5: (217, 119, 6),
        6: (14, 165, 233),
        7: (168, 85, 247),
    }

    height, width = prediction_map.shape

    rgba = np.zeros(
        (
            height,
            width,
            4,
        ),
        dtype=np.uint8,
    )

    for class_id, rgb in palette.items():

        mask = (
            prediction_map
            == class_id
        )

        rgba[
            mask,
            0
        ] = rgb[0]

        rgba[
            mask,
            1
        ] = rgb[1]

        rgba[
            mask,
            2
        ] = rgb[2]

        rgba[
            mask,
            3
        ] = 205

    image = Image.fromarray(
        rgba,
        mode="RGBA",
    )

    image.save(
        output_path,
        optimize=True,
    )


# ============================================================
# MAIN PREDICTION
# ============================================================

def predict_landcover(
    input_path,
    output_path,
    analysis_id,
    output_dir,
):

    model = load_model()

    # --------------------------------------------------------
    # Read image
    # --------------------------------------------------------

    with rasterio.open(
        input_path
    ) as src:

        if src.count != 6:

            raise ValueError(
                "Land-cover classification requires "
                "exactly 6 bands in this order: "
                "B2, B3, B4, B8, B11, B12."
            )

        image = src.read().astype(
            np.float32
        )

        profile = src.profile.copy()

        height = src.height
        width = src.width

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

    # --------------------------------------------------------
    # Calculate spectral features
    # --------------------------------------------------------

    features = calculate_features(
        image
    )

    flat_features = features.reshape(
        -1,
        len(FEATURES),
    )

    print(
        f"Predicting "
        f"{flat_features.shape[0]:,} pixels..."
    )

    feature_df = pd.DataFrame(
        flat_features,
        columns=FEATURES,
    )

    # --------------------------------------------------------
    # Prediction
    # --------------------------------------------------------

    predictions = model.predict(
        feature_df
    )

    # --------------------------------------------------------
    # Probability / confidence
    # --------------------------------------------------------

    if hasattr(
        model,
        "predict_proba",
    ):

        probabilities = model.predict_proba(
            feature_df
        )

        confidence = np.max(
            probabilities,
            axis=1,
        ).astype(
            np.float32
        )

    else:

        # Fallback for estimators without
        # predict_proba.
        confidence = np.ones(
            len(predictions),
            dtype=np.float32,
        )

    prediction_map = predictions.reshape(
        height,
        width,
    ).astype(
        np.uint8
    )

    confidence_map = confidence.reshape(
        height,
        width,
    )

    # --------------------------------------------------------
    # Spectral maps
    # --------------------------------------------------------

    ndvi = features[:, :, 6]

    ndwi = features[:, :, 7]

    ndbi = features[:, :, 8]

    # --------------------------------------------------------
    # Water intelligence
    # --------------------------------------------------------

    water_possible = (
        ndwi >= WATER_POSSIBLE_THRESHOLD
    )

    water_high = (
        ndwi >= WATER_HIGH_CONFIDENCE_THRESHOLD
    )

    total_pixels = (
        height * width
    )

    possible_water_pixels = int(
        np.count_nonzero(
            water_possible
        )
    )

    high_water_pixels = int(
        np.count_nonzero(
            water_high
        )
    )

    possible_water_percentage = (
        possible_water_pixels
        /
        total_pixels
    ) * 100

    high_water_percentage = (
        high_water_pixels
        /
        total_pixels
    ) * 100

    # --------------------------------------------------------
    # ML water agreement
    # --------------------------------------------------------

    ml_water_mask = (
        prediction_map == 6
    )

    ml_water_pixels = int(
        np.count_nonzero(
            ml_water_mask
        )
    )

    ml_water_percentage = (
        ml_water_pixels
        /
        total_pixels
    ) * 100

    spectral_ml_agreement = np.logical_and(
        ml_water_mask,
        water_high,
    )

    agreement_pixels = int(
        np.count_nonzero(
            spectral_ml_agreement
        )
    )

    water_agreement_percentage = (
        agreement_pixels
        /
        max(
            ml_water_pixels,
            1,
        )
    ) * 100

    # --------------------------------------------------------
    # Confidence statistics
    # --------------------------------------------------------

    mean_confidence = float(
        np.mean(
            confidence_map
        )
    )

    median_confidence = float(
        np.median(
            confidence_map
        )
    )

    low_confidence_percentage = float(
        np.mean(
            confidence_map < 0.60
        )
        * 100
    )

    high_confidence_percentage = float(
        np.mean(
            confidence_map >= 0.80
        )
        * 100
    )

    # --------------------------------------------------------
    # Save prediction GeoTIFF
    # --------------------------------------------------------

    prediction_profile = profile.copy()

    prediction_profile.update(
        count=1,
        dtype="uint8",
        compress="lzw",
        nodata=255,
    )

    with rasterio.open(
        output_path,
        "w",
        **prediction_profile,
    ) as dst:

        dst.write(
            prediction_map,
            1,
        )

        for (
            class_id,
            class_name,
        ) in CLASS_NAMES.items():

            dst.update_tags(
                **{
                    f"class_{class_id}":
                    class_name
                }
            )

    # --------------------------------------------------------
    # Confidence GeoTIFF
    # --------------------------------------------------------

    confidence_filename = (
        f"{analysis_id}_confidence.tif"
    )

    confidence_path = os.path.join(
        output_dir,
        confidence_filename,
    )

    confidence_profile = profile.copy()

    confidence_profile.update(
        count=1,
        dtype="float32",
        compress="lzw",
        nodata=-9999,
    )

    with rasterio.open(
        confidence_path,
        "w",
        **confidence_profile,
    ) as dst:

        dst.write(
            confidence_map.astype(
                np.float32
            ),
            1,
        )

    # --------------------------------------------------------
    # Water GeoTIFF
    #
    # 0 = non-water
    # 1 = possible water
    # 2 = high-confidence water
    # --------------------------------------------------------

    water_filename = (
        f"{analysis_id}_water.tif"
    )

    water_path = os.path.join(
        output_dir,
        water_filename,
    )

    water_map = np.zeros(
        (
            height,
            width,
        ),
        dtype=np.uint8,
    )

    water_map[
        water_possible
    ] = 1

    water_map[
        water_high
    ] = 2

    water_profile = profile.copy()

    water_profile.update(
        count=1,
        dtype="uint8",
        compress="lzw",
        nodata=255,
    )

    with rasterio.open(
        water_path,
        "w",
        **water_profile,
    ) as dst:

        dst.write(
            water_map,
            1,
        )

        dst.update_tags(
            water_possible_threshold=(
                WATER_POSSIBLE_THRESHOLD
            ),
            water_high_confidence_threshold=(
                WATER_HIGH_CONFIDENCE_THRESHOLD
            ),
        )

    # --------------------------------------------------------
    # Preview files
    # --------------------------------------------------------

    prediction_preview_filename = (
        f"{analysis_id}_landcover.png"
    )

    confidence_preview_filename = (
        f"{analysis_id}_confidence.png"
    )

    water_preview_filename = (
        f"{analysis_id}_water.png"
    )

    prediction_preview_path = os.path.join(
        output_dir,
        prediction_preview_filename,
    )

    confidence_preview_path = os.path.join(
        output_dir,
        confidence_preview_filename,
    )

    water_preview_path = os.path.join(
        output_dir,
        water_preview_filename,
    )

    create_landcover_preview(
        prediction_map,
        prediction_preview_path,
    )

    create_confidence_preview(
        confidence_map,
        confidence_preview_path,
    )

    create_water_preview(
        ndwi,
        water_possible,
        water_high,
        water_preview_path,
    )

    # --------------------------------------------------------
    # Save interactive pixel data
    # --------------------------------------------------------

    inspect_filename = (
        f"{analysis_id}_inspect.npz"
    )

    inspect_path = os.path.join(
        output_dir,
        inspect_filename,
    )

    np.savez_compressed(
        inspect_path,
        prediction=prediction_map,
        confidence=confidence_map,
        ndvi=ndvi.astype(np.float32),
        ndwi=ndwi.astype(np.float32),
        ndbi=ndbi.astype(np.float32),
    )

    # --------------------------------------------------------
    # Class statistics
    # --------------------------------------------------------

    unique, counts = np.unique(
        prediction_map,
        return_counts=True,
    )

    classes = []

    for (
        class_id,
        count,
    ) in zip(
        unique,
        counts,
    ):

        class_id = int(
            class_id
        )

        count = int(
            count
        )

        if class_id not in CLASS_NAMES:
            continue

        percentage = (
            count
            /
            total_pixels
        ) * 100

        class_confidence = float(
            np.mean(
                confidence_map[
                    prediction_map
                    == class_id
                ]
            )
        )

        classes.append(
            {
                "class_id": class_id,
                "class_name": CLASS_NAMES[
                    class_id
                ],
                "pixel_count": count,
                "percentage": round(
                    percentage,
                    2,
                ),
                "mean_confidence": round(
                    class_confidence,
                    4,
                ),
            }
        )

    # --------------------------------------------------------
    # Result
    # --------------------------------------------------------

    return {

        "analysis_id":
            analysis_id,

        "prediction_file":
            output_path,

        "confidence_file":
            confidence_path,

        "water_file":
            water_path,

        "prediction_preview":
            prediction_preview_path,

        "confidence_preview":
            confidence_preview_path,

        "water_preview":
            water_preview_path,

        "inspect_file":
            inspect_path,

        "width":
            width,

        "height":
            height,

        "bounds":
            bounds,

        "mean_confidence":
            round(
                mean_confidence,
                4,
            ),

        "median_confidence":
            round(
                median_confidence,
                4,
            ),

        "high_confidence_percentage":
            round(
                high_confidence_percentage,
                2,
            ),

        "low_confidence_percentage":
            round(
                low_confidence_percentage,
                2,
            ),

        "water_intelligence": {

            "ndwi_possible_threshold":
                WATER_POSSIBLE_THRESHOLD,

            "ndwi_high_confidence_threshold":
                WATER_HIGH_CONFIDENCE_THRESHOLD,

            "possible_water_pixels":
                possible_water_pixels,

            "possible_water_percentage":
                round(
                    possible_water_percentage,
                    2,
                ),

            "high_confidence_water_pixels":
                high_water_pixels,

            "high_confidence_water_percentage":
                round(
                    high_water_percentage,
                    2,
                ),

            "ml_water_pixels":
                ml_water_pixels,

            "ml_water_percentage":
                round(
                    ml_water_percentage,
                    2,
                ),

            "ml_water_spectral_agreement":
                round(
                    water_agreement_percentage,
                    2,
                ),
        },

        "classes":
            classes,
    }


# ============================================================
# PIXEL INSPECTION
# ============================================================

def inspect_pixel(
    analysis_id,
    output_dir,
    x,
    y,
):

    inspect_path = os.path.join(
        output_dir,
        f"{analysis_id}_inspect.npz",
    )

    if not os.path.exists(
        inspect_path
    ):

        raise FileNotFoundError(
            "Analysis data not found."
        )

    data = np.load(
        inspect_path
    )

    prediction = data[
        "prediction"
    ]

    confidence = data[
        "confidence"
    ]

    ndvi = data[
        "ndvi"
    ]

    ndwi = data[
        "ndwi"
    ]

    ndbi = data[
        "ndbi"
    ]

    height, width = prediction.shape

    x = int(
        max(
            0,
            min(
                width - 1,
                x,
            ),
        )
    )

    y = int(
        max(
            0,
            min(
                height - 1,
                y,
            ),
        )
    )

    class_id = int(
        prediction[y, x]
    )

    pixel_confidence = float(
        confidence[y, x]
    )

    pixel_ndvi = float(
        ndvi[y, x]
    )

    pixel_ndwi = float(
        ndwi[y, x]
    )

    pixel_ndbi = float(
        ndbi[y, x]
    )

    if pixel_ndwi >= WATER_HIGH_CONFIDENCE_THRESHOLD:

        water_status = (
            "High-confidence water evidence"
        )

    elif pixel_ndwi >= WATER_POSSIBLE_THRESHOLD:

        water_status = (
            "Possible water evidence"
        )

    else:

        water_status = (
            "No strong water evidence"
        )

    return {

        "pixel": {
            "x": x,
            "y": y,
        },

        "class": {
            "class_id": class_id,
            "class_name":
                CLASS_NAMES.get(
                    class_id,
                    "Unknown",
                ),
        },

        "confidence": round(
            pixel_confidence,
            4,
        ),

        "indices": {

            "NDVI": round(
                pixel_ndvi,
                4,
            ),

            "NDWI": round(
                pixel_ndwi,
                4,
            ),

            "NDBI": round(
                pixel_ndbi,
                4,
            ),
        },

        "water_status":
            water_status,
    }