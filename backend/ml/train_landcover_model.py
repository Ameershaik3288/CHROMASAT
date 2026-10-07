import os
import pandas as pd
import joblib

from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (
    accuracy_score,
    f1_score,
    classification_report,
    confusion_matrix,
)

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

DATA_DIR = os.path.join(BASE_DIR, "ml-data")
MODEL_DIR = os.path.join(BASE_DIR, "backend", "models")

os.makedirs(MODEL_DIR, exist_ok=True)

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

TARGET = "landcover"

TRAIN_FILE = os.path.join(
    DATA_DIR,
    "nandyal_training_samples.csv"
)

VAL_FILE = os.path.join(
    DATA_DIR,
    "nandyal_validation_samples.csv"
)

TEST_FILE = os.path.join(
    DATA_DIR,
    "nandyal_test_samples.csv"
)


print("=" * 60)
print("CHROMASAT AI - LOCAL LAND COVER MODEL")
print("=" * 60)


# ------------------------------------------------
# Load datasets
# ------------------------------------------------

print("\nLoading datasets...")

train_df = pd.read_csv(TRAIN_FILE)
val_df = pd.read_csv(VAL_FILE)
test_df = pd.read_csv(TEST_FILE)

print(f"Training samples   : {len(train_df):,}")
print(f"Validation samples : {len(val_df):,}")
print(f"Test samples       : {len(test_df):,}")


# ------------------------------------------------
# Validate columns
# ------------------------------------------------

required_columns = FEATURES + [TARGET]

for df_name, df in [
    ("training", train_df),
    ("validation", val_df),
    ("test", test_df),
]:
    missing = [
        column
        for column in required_columns
        if column not in df.columns
    ]

    if missing:
        raise ValueError(
            f"{df_name} dataset is missing columns: {missing}"
        )


print("\n✅ Dataset columns verified")


# ------------------------------------------------
# Prepare X / y
# ------------------------------------------------

X_train = train_df[FEATURES]
y_train = train_df[TARGET]

X_val = val_df[FEATURES]
y_val = val_df[TARGET]

X_test = test_df[FEATURES]
y_test = test_df[TARGET]


# ------------------------------------------------
# Train Random Forest
# ------------------------------------------------

print("\nTraining Random Forest...")

model = RandomForestClassifier(
    n_estimators=50,
    random_state=42,
    n_jobs=-1,
)

model.fit(X_train, y_train)

print("✅ Model training completed")


# ------------------------------------------------
# Validation
# ------------------------------------------------

val_predictions = model.predict(X_val)

val_accuracy = accuracy_score(
    y_val,
    val_predictions
)

val_f1 = f1_score(
    y_val,
    val_predictions,
    average="macro"
)

print("\nVALIDATION PERFORMANCE")
print("-" * 40)
print(f"Accuracy : {val_accuracy:.4f}")
print(f"Macro F1 : {val_f1:.4f}")


# ------------------------------------------------
# Test
# ------------------------------------------------

test_predictions = model.predict(X_test)

test_accuracy = accuracy_score(
    y_test,
    test_predictions
)

test_f1 = f1_score(
    y_test,
    test_predictions,
    average="macro"
)

print("\nTEST PERFORMANCE")
print("-" * 40)
print(f"Accuracy : {test_accuracy:.4f}")
print(f"Macro F1 : {test_f1:.4f}")


# ------------------------------------------------
# Classification report
# ------------------------------------------------

print("\nCLASSIFICATION REPORT")
print("-" * 60)

print(
    classification_report(
        y_test,
        test_predictions,
        digits=4,
        zero_division=0,
    )
)


# ------------------------------------------------
# Confusion matrix
# ------------------------------------------------

print("\nCONFUSION MATRIX")

cm = confusion_matrix(
    y_test,
    test_predictions,
)

print(cm)


# ------------------------------------------------
# Feature importance
# ------------------------------------------------

print("\nFEATURE IMPORTANCE")
print("-" * 40)

importance = pd.Series(
    model.feature_importances_,
    index=FEATURES,
).sort_values(
    ascending=False
)

print(importance)


# ------------------------------------------------
# Save model
# ------------------------------------------------

model_path = os.path.join(
    MODEL_DIR,
    "nandyal_landcover_rf.joblib"
)

joblib.dump(
    {
        "model": model,
        "features": FEATURES,
        "classes": sorted(
            y_train.unique().tolist()
        ),
        "metadata": {
            "study_area": "Nandyal, Andhra Pradesh",
            "reference_year": 2021,
            "model": "Random Forest",
            "n_estimators": 50,
            "random_state": 42,
        },
    },
    model_path,
)

print("\n" + "=" * 60)
print("MODEL SAVED")
print("=" * 60)
print(model_path)
print("=" * 60)