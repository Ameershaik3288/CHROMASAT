import os
import joblib
import numpy as np
import pandas as pd
import rasterio

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


def load_model():

    print("Looking for model at:")
    print(MODEL_PATH)

    if not os.path.exists(MODEL_PATH):
        raise FileNotFoundError(
            f"Land-cover model not found: {MODEL_PATH}"
        )

    package = joblib.load(MODEL_PATH)

    print("✅ Land-cover model loaded")

    return package["model"]


def calculate_features(image):

    b2 = image[0]
    b3 = image[1]
    b4 = image[2]
    b8 = image[3]
    b11 = image[4]
    b12 = image[5]

    ndvi = (b8 - b4) / (b8 + b4 + 1e-8)
    ndwi = (b3 - b8) / (b3 + b8 + 1e-8)
    ndbi = (b11 - b8) / (b11 + b8 + 1e-8)

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


def predict_landcover(input_path, output_path):

    model = load_model()

    with rasterio.open(input_path) as src:

        if src.count != 6:
            raise ValueError(
                "Land-cover classification requires exactly "
                "6 bands in this order: "
                "B2, B3, B4, B8, B11, B12."
            )

        image = src.read().astype(np.float32)

        profile = src.profile.copy()

        height = src.height
        width = src.width

        features = calculate_features(image)

        flat_features = features.reshape(
            -1,
            len(FEATURES),
        )

        print(
            f"Predicting {flat_features.shape[0]:,} pixels..."
        )

        # Convert NumPy array to DataFrame so the
        # feature names match model training.
        feature_df = pd.DataFrame(
            flat_features,
            columns=FEATURES,
        )

        predictions = model.predict(feature_df)

        prediction_map = predictions.reshape(
            height,
            width,
        ).astype(np.uint8)

        profile.update(
            count=1,
            dtype="uint8",
            compress="lzw",
            nodata=255,
        )

        with rasterio.open(
            output_path,
            "w",
            **profile,
        ) as dst:

            dst.write(
                prediction_map,
                1,
            )

            for class_id, class_name in CLASS_NAMES.items():

                dst.update_tags(
                    **{
                        f"class_{class_id}": class_name
                    }
                )

    unique, counts = np.unique(
        prediction_map,
        return_counts=True,
    )

    total_pixels = prediction_map.size

    classes = []

    for class_id, count in zip(unique, counts):

        class_id = int(class_id)
        count = int(count)

        if class_id not in CLASS_NAMES:
            continue

        percentage = (
            count / total_pixels
        ) * 100

        classes.append(
            {
                "class_id": class_id,
                "class_name": CLASS_NAMES[class_id],
                "pixel_count": count,
                "percentage": round(
                    percentage,
                    2,
                ),
            }
        )

    return {
        "prediction_file": output_path,
        "width": width,
        "height": height,
        "classes": classes,
    }