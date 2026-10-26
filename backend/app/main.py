import os
import shutil
import uuid

import numpy as np
import rasterio
from PIL import Image

from fastapi import (
    FastAPI,
    UploadFile,
    File,
    HTTPException,
    Query,
)

from fastapi.middleware.cors import CORSMiddleware

from fastapi.staticfiles import StaticFiles


# ============================================================
# CHROMASAT AI SERVICES
# ============================================================

from app.services.raster_service import analyze_raster

from app.services.landcover_service import (
    predict_landcover,
    inspect_pixel,
)

from app.services.disaster.flood_service import analyze_flood

from app.services.fire.fire_service import analyze_fire


# ============================================================
# CHROMASAT AI API
# ============================================================

BASE_DIR = os.path.abspath(
    os.path.join(
        os.path.dirname(__file__),
        "..",
    )
)


# ============================================================
# DIRECTORIES
# ============================================================

UPLOAD_DIR = os.path.join(
    BASE_DIR,
    "uploads",
)

OUTPUT_DIR = os.path.join(
    BASE_DIR,
    "outputs",
)


os.makedirs(
    UPLOAD_DIR,
    exist_ok=True,
)

os.makedirs(
    OUTPUT_DIR,
    exist_ok=True,
)


# ============================================================
# SATELLITE RGB PREVIEW
# ============================================================

def _normalize_band(band):
    """
    Convert a satellite band into browser-friendly
    8-bit display values.
    """

    band = np.asarray(
        band,
        dtype=np.float32,
    )

    finite = np.isfinite(band)

    if not np.any(finite):
        return np.zeros(
            band.shape,
            dtype=np.uint8,
        )

    values = band[finite]

    low = float(
        np.percentile(
            values,
            2,
        )
    )

    high = float(
        np.percentile(
            values,
            98,
        )
    )

    if high <= low:
        return np.zeros(
            band.shape,
            dtype=np.uint8,
        )

    normalized = (
        band - low
    ) / (
        high - low
    )

    normalized = np.clip(
        normalized,
        0,
        1,
    )

    normalized = np.power(
        normalized,
        0.85,
    )

    return (
        normalized * 255
    ).astype(
        np.uint8
    )


def create_satellite_rgb_preview(
    input_path,
    output_path,
):
    """
    Create a browser-friendly RGB satellite preview.

    Expected Sentinel-2 band order:

        Band 1 -> B2 Blue
        Band 2 -> B3 Green
        Band 3 -> B4 Red
        Band 4 -> B8 NIR
        Band 5 -> B11 SWIR1
        Band 6 -> B12 SWIR2

    RGB visualization:

        Red   = B4
        Green = B3
        Blue  = B2
    """

    with rasterio.open(
        input_path
    ) as src:

        if src.count < 3:
            raise ValueError(
                "Satellite preview requires "
                "at least 3 bands."
            )

        blue = src.read(1)
        green = src.read(2)
        red = src.read(3)

    red_8 = _normalize_band(red)
    green_8 = _normalize_band(green)
    blue_8 = _normalize_band(blue)

    rgb = np.dstack(
        [
            red_8,
            green_8,
            blue_8,
        ]
    )

    image = Image.fromarray(
        rgb,
        mode="RGB",
    )

    image.save(
        output_path,
        format="PNG",
        optimize=True,
    )


# ============================================================
# FASTAPI APPLICATION
# ============================================================

app = FastAPI(
    title="CHROMASAT AI API",

    description=(
        "Satellite Intelligence, Land Cover, "
        "Flood and Fire Intelligence API"
    ),

    version="2.2.0",
)


# ============================================================
# STATIC OUTPUTS
# ============================================================

app.mount(
    "/outputs",
    StaticFiles(
        directory=OUTPUT_DIR,
    ),
    name="outputs",
)


# ============================================================
# CORS
# ============================================================

app.add_middleware(
    CORSMiddleware,

    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],

    allow_credentials=True,

    allow_methods=[
        "*",
    ],

    allow_headers=[
        "*",
    ],
)


# ============================================================
# ROOT
# ============================================================

@app.get("/")
def root():

    return {
        "project": "CHROMASAT AI",

        "message":
            "Satellite Intelligence API is running",

        "status":
            "online",

        "version":
            "2.2.0",

        "modules": [
            "Satellite Analysis",
            "Land Cover",
            "Flood Intelligence",
            "Fire Intelligence",
        ],
    }


# ============================================================
# HEALTH
# ============================================================

@app.get("/api/health")
def health():

    return {
        "status": "healthy",

        "service":
            "CHROMASAT AI Backend",

        "version":
            "2.2.0",

        "modules": {
            "satellite": True,
            "landcover": True,
            "flood": True,
            "fire": True,
        },
    }


# ============================================================
# HELPER — SAVE UPLOADED GEOTIFF
# ============================================================

async def save_uploaded_geotiff(
    file: UploadFile,
):
    """
    Validate and save an uploaded GeoTIFF.

    Returns:

        analysis_id
        input_path
        original_filename
    """

    if not file.filename:
        raise HTTPException(
            status_code=400,
            detail="No file provided.",
        )

    allowed_extensions = (
        ".tif",
        ".tiff",
    )

    if not file.filename.lower().endswith(
        allowed_extensions
    ):
        raise HTTPException(
            status_code=400,
            detail=(
                "Please upload a GeoTIFF "
                "(.tif or .tiff) file."
            ),
        )

    analysis_id = str(
        uuid.uuid4()
    )

    safe_filename = os.path.basename(
        file.filename
    )

    input_path = os.path.join(
        UPLOAD_DIR,
        f"{analysis_id}_{safe_filename}",
    )

    try:

        with open(
            input_path,
            "wb",
        ) as buffer:

            shutil.copyfileobj(
                file.file,
                buffer,
            )

    except Exception as error:

        raise HTTPException(
            status_code=500,
            detail=(
                f"Unable to save uploaded file: {error}"
            ),
        )

    finally:

        await file.close()

    return (
        analysis_id,
        input_path,
        safe_filename,
    )


# ============================================================
# HELPER — CONVERT OUTPUT PATHS
# ============================================================

def convert_output_paths(
    result,
):
    """
    Convert filesystem output paths into
    frontend-accessible /outputs/... URLs.
    """

    if not isinstance(
        result,
        dict,
    ):
        return result

    path_fields = [
        "rgb_preview",

        "prediction_file",
        "confidence_file",
        "water_file",

        "prediction_preview",
        "confidence_preview",
        "water_preview",

        "fire_preview",

        "risk_preview",

        "confidence_preview",
    ]

    # --------------------------------------------------------
    # Top-level paths
    # --------------------------------------------------------

    for field in path_fields:

        value = result.get(
            field
        )

        if value:

            filename = os.path.basename(
                str(value)
            )

            result[field] = (
                f"/outputs/{filename}"
            )

    # --------------------------------------------------------
    # Nested output paths
    # --------------------------------------------------------

    outputs = result.get(
        "outputs"
    )

    if isinstance(
        outputs,
        dict,
    ):

        for key, value in list(
            outputs.items()
        ):

            if value:

                filename = os.path.basename(
                    str(value)
                )

                outputs[key] = (
                    f"/outputs/{filename}"
                )

    return result


# ============================================================
# SATELLITE ANALYSIS
# ============================================================

@app.post("/api/analyze")
async def analyze_satellite_image(
    file: UploadFile = File(...),
):

    (
        analysis_id,
        file_path,
        safe_filename,
    ) = await save_uploaded_geotiff(
        file
    )

    satellite_preview_filename = (
        f"{analysis_id}_satellite_rgb.png"
    )

    satellite_preview_path = os.path.join(
        OUTPUT_DIR,
        satellite_preview_filename,
    )

    try:

        create_satellite_rgb_preview(
            file_path,
            satellite_preview_path,
        )

        result = analyze_raster(
            file_path
        )

        result["rgb_preview"] = (
            f"/outputs/{satellite_preview_filename}"
        )

        result = convert_output_paths(
            result
        )

        result["analysis_id"] = (
            analysis_id
        )

        return {
            "success": True,

            "message":
                "Satellite image analyzed successfully.",

            "result":
                result,
        }

    except Exception as error:

        print(
            "SATELLITE ANALYSIS ERROR:",
            repr(error),
        )

        raise HTTPException(
            status_code=500,
            detail=str(error),
        )


# ============================================================
# LAND COVER ANALYSIS
# ============================================================

@app.post("/api/landcover")
async def landcover_analysis(
    file: UploadFile = File(...),
):

    (
        analysis_id,
        input_path,
        safe_filename,
    ) = await save_uploaded_geotiff(
        file
    )

    output_filename = (
        f"{analysis_id}_landcover.tif"
    )

    output_path = os.path.join(
        OUTPUT_DIR,
        output_filename,
    )

    try:

        result = predict_landcover(
            input_path,
            output_path,
            analysis_id,
            OUTPUT_DIR,
        )

        result = convert_output_paths(
            result
        )

        if isinstance(
            result,
            dict,
        ):

            result.setdefault(
                "analysis_id",
                analysis_id,
            )

        return {
            "success": True,

            "message":
                (
                    "Land-cover classification "
                    "completed successfully."
                ),

            "result":
                result,
        }

    except Exception as error:

        print(
            "LAND COVER ERROR:",
            repr(error),
        )

        raise HTTPException(
            status_code=500,
            detail=str(error),
        )


# ============================================================
# FLOOD / WATER INTELLIGENCE
# ============================================================

@app.post("/api/disaster/flood")
async def flood_disaster_analysis(
    file: UploadFile = File(...),
):

    (
        analysis_id,
        input_path,
        safe_filename,
    ) = await save_uploaded_geotiff(
        file
    )

    try:

        # ----------------------------------------------------
        # Your flood_service.py currently expects:
        #
        # analyze_flood(input_path, output_dir)
        #
        # ----------------------------------------------------

        result = analyze_flood(
            input_path,
            OUTPUT_DIR,
        )

        result = convert_output_paths(
            result
        )

        if isinstance(
            result,
            dict,
        ):

            # Keep the ID created by main.py
            # as the canonical upload/session ID.
            result["analysis_id"] = (
                analysis_id
            )

        return {
            "success": True,

            "message":
                (
                    "Flood and water intelligence "
                    "analysis completed successfully."
                ),

            "disaster_type":
                "flood",

            "result":
                result,
        }

    except Exception as error:

        print(
            "FLOOD ANALYSIS ERROR:",
            repr(error),
        )

        raise HTTPException(
            status_code=500,
            detail=str(error),
        )


# ============================================================
# FIRE INTELLIGENCE
# ============================================================

@app.post("/api/disaster/fire")
async def fire_disaster_analysis(
    file: UploadFile = File(...),
):

    (
        analysis_id,
        input_path,
        safe_filename,
    ) = await save_uploaded_geotiff(
        file
    )

    try:

        # ----------------------------------------------------
        # Your fire_service.py currently expects:
        #
        # analyze_fire(input_path, output_dir)
        #
        # ----------------------------------------------------

        result = analyze_fire(
            input_path,
            OUTPUT_DIR,
        )

        result = convert_output_paths(
            result
        )

        if isinstance(
            result,
            dict,
        ):

            result["analysis_id"] = (
                analysis_id
            )

        return {
            "success": True,

            "message":
                (
                    "Fire and burn spectral "
                    "intelligence analysis "
                    "completed successfully."
                ),

            "disaster_type":
                "fire",

            "result":
                result,
        }

    except Exception as error:

        print(
            "FIRE ANALYSIS ERROR:",
            repr(error),
        )

        raise HTTPException(
            status_code=500,
            detail=str(error),
        )


# ============================================================
# GENERIC DISASTER ROUTER
# ============================================================

@app.post("/api/disaster/{disaster_type}")
async def disaster_router(
    disaster_type: str,
    file: UploadFile = File(...),
):

    disaster_type = (
        disaster_type
        .strip()
        .lower()
    )

    if disaster_type == "flood":

        return await flood_disaster_analysis(
            file
        )

    if disaster_type == "fire":

        return await fire_disaster_analysis(
            file
        )

    raise HTTPException(
        status_code=400,
        detail=(
            f"Unsupported disaster type: "
            f"{disaster_type}. "
            f"Supported types are: flood, fire."
        ),
    )


# ============================================================
# DISASTER COMPATIBILITY ENDPOINT
# ============================================================

@app.post("/api/disaster")
async def disaster_compatibility(
    file: UploadFile = File(...),

    disaster_type: str = Query(
        ...,
        description="Disaster type: flood or fire",
    ),
):

    disaster_type = (
        disaster_type
        .strip()
        .lower()
    )

    if disaster_type == "flood":

        return await flood_disaster_analysis(
            file
        )

    if disaster_type == "fire":

        return await fire_disaster_analysis(
            file
        )

    raise HTTPException(
        status_code=400,
        detail=(
            "Invalid disaster_type. "
            "Use 'flood' or 'fire'."
        ),
    )


# ============================================================
# FLOOD COMPATIBILITY ENDPOINT
# ============================================================

@app.post("/api/flood")
async def flood_compatibility(
    file: UploadFile = File(...),
):

    return await flood_disaster_analysis(
        file
    )


# ============================================================
# FIRE COMPATIBILITY ENDPOINT
# ============================================================

@app.post("/api/fire")
async def fire_compatibility(
    file: UploadFile = File(...),
):

    return await fire_disaster_analysis(
        file
    )


# ============================================================
# INTERACTIVE PIXEL INSPECTION
# ============================================================

@app.get(
    "/api/landcover/{analysis_id}/inspect"
)
def landcover_pixel_inspection(
    analysis_id: str,

    x: int = Query(
        ...,
        description="Pixel X coordinate",
    ),

    y: int = Query(
        ...,
        description="Pixel Y coordinate",
    ),
):

    try:

        result = inspect_pixel(
            analysis_id,
            OUTPUT_DIR,
            x,
            y,
        )

        return {
            "success": True,

            "result":
                result,
        }

    except FileNotFoundError as error:

        raise HTTPException(
            status_code=404,
            detail=str(error),
        )

    except Exception as error:

        print(
            "PIXEL INSPECTION ERROR:",
            repr(error),
        )

        raise HTTPException(
            status_code=500,
            detail=str(error),
        )


# ============================================================
# STARTUP INFORMATION
# ============================================================

@app.on_event("startup")
async def startup_event():

    print()

    print("=" * 70)
    print("CHROMASAT AI BACKEND")
    print("=" * 70)

    print("Status       : ONLINE")
    print("Version      : 2.2.0")
    print(
        "API Docs     : "
        "http://127.0.0.1:8000/docs"
    )

    print()

    print("Available APIs:")

    print("  GET  /")
    print("  GET  /api/health")
    print("  POST /api/analyze")
    print("  POST /api/landcover")

    print(
        "  POST /api/disaster/flood"
    )

    print(
        "  POST /api/disaster/fire"
    )

    print(
        "  POST /api/disaster/{disaster_type}"
    )

    print(
        "  POST /api/disaster"
    )

    print(
        "  POST /api/flood"
    )

    print(
        "  POST /api/fire"
    )

    print(
        "  GET  /api/landcover/"
        "{analysis_id}/inspect"
    )

    print("=" * 70)
    print()