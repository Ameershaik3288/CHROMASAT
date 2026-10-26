import os
import shutil
import uuid

from fastapi import (
    FastAPI,
    UploadFile,
    File,
    HTTPException,
    Query,
)

from fastapi.middleware.cors import (
    CORSMiddleware,
)

from fastapi.staticfiles import (
    StaticFiles,
)

from app.services.raster_service import (
    analyze_raster,
)

from app.services.landcover_service import (
    predict_landcover,
    inspect_pixel,
)

from app.services.disaster.flood_service import (
    analyze_flood,
)

from app.services.disaster_service import analyze_disaster


# ============================================================
# CHROMASAT AI API
# ============================================================

BASE_DIR = os.path.abspath(
    os.path.join(
        os.path.dirname(__file__),
        "..",
    )
)

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
# FASTAPI
# ============================================================

app = FastAPI(
    title="CHROMASAT AI API",
    description=(
        "Satellite Intelligence, Land Cover "
        "and Water Intelligence API"
    ),
    version="2.0.0",
)


# ============================================================
# STATIC OUTPUTS
# ============================================================

app.mount(
    "/outputs",
    StaticFiles(
        directory=OUTPUT_DIR
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
        "*"
    ],

    allow_headers=[
        "*"
    ],
)


# ============================================================
# ROOT
# ============================================================

@app.get("/")
def root():

    return {

        "project":
            "CHROMASAT AI",

        "message":
            "Satellite Intelligence API is running",

        "status":
            "online",

        "version":
            "2.0.0",
    }


# ============================================================
# HEALTH
# ============================================================

@app.get("/api/health")
def health():

    return {

        "status":
            "healthy",

        "service":
            "CHROMASAT AI Backend",

        "version":
            "2.0.0",
    }


# ============================================================
# SATELLITE ANALYSIS
# ============================================================

@app.post("/api/analyze")
async def analyze_satellite_image(
    file: UploadFile = File(...)
):

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

    file_path = os.path.join(
        UPLOAD_DIR,
        f"{analysis_id}_{safe_filename}",
    )

    try:

        with open(
            file_path,
            "wb",
        ) as buffer:

            shutil.copyfileobj(
                file.file,
                buffer,
            )

        result = analyze_raster(
            file_path
        )

        # ----------------------------------------------------
        # Convert RGB preview into browser URL
        # ----------------------------------------------------

        if result.get(
            "rgb_preview"
        ):

            filename = os.path.basename(
                result[
                    "rgb_preview"
                ]
            )

            result[
                "rgb_preview"
            ] = (
                f"/outputs/{filename}"
            )

        result[
            "analysis_id"
        ] = analysis_id

        return {

            "success":
                True,

            "message":
                "Satellite image analyzed successfully.",

            "result":
                result,
        }

    except Exception as error:

        raise HTTPException(
            status_code=500,
            detail=str(error),
        )

    finally:

        await file.close()


# ============================================================
# LAND COVER ANALYSIS
# ============================================================

@app.post("/api/landcover")
async def landcover_analysis(
    file: UploadFile = File(...)
):

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

    output_filename = (
        f"{analysis_id}_landcover.tif"
    )

    output_path = os.path.join(
        OUTPUT_DIR,
        output_filename,
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

        result = predict_landcover(
            input_path,
            output_path,
            analysis_id,
            OUTPUT_DIR,
        )

        # ----------------------------------------------------
        # Convert filesystem paths into API URLs
        # ----------------------------------------------------

        path_fields = [
            "prediction_file",
            "confidence_file",
            "water_file",
            "prediction_preview",
            "confidence_preview",
            "water_preview",
        ]

        for field in path_fields:

            if result.get(field):

                filename = os.path.basename(
                    result[field]
                )

                result[field] = (
                    f"/outputs/{filename}"
                )

        return {

            "success":
                True,

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

    finally:

        await file.close()


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

            "success":
                True,

            "result":
                result,
        }

    except FileNotFoundError as error:

        raise HTTPException(
            status_code=404,
            detail=str(error),
        )

    except Exception as error:

        raise HTTPException(
            status_code=500,
            detail=str(error),
        )

# ============================================================
# DISASTER INTELLIGENCE - FLOOD ANALYSIS
# ============================================================

@app.post("/api/disaster/flood")
async def flood_disaster_analysis(
    file: UploadFile = File(...)
):

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

        print(
            "Starting flood intelligence analysis..."
        )

        result = analyze_flood(
            input_path,
            OUTPUT_DIR,
            analysis_id,
        )

        # ----------------------------------------------------
        # Convert output paths into API URLs
        # ----------------------------------------------------

        if result.get("outputs"):

            for field in result["outputs"]:

                value = result["outputs"][field]

                if value:

                    filename = os.path.basename(
                        value
                    )

                    result["outputs"][field] = (
                        f"/outputs/{filename}"
                    )

        print(
            "Flood intelligence analysis completed."
        )

        return {

            "success":
                True,

            "message":
                (
                    "Flood and water intelligence "
                    "analysis completed successfully."
                ),

            "result":
                result,
        }

    except Exception as error:

        print(
            "DISASTER ANALYSIS ERROR:",
            repr(error),
        )

        raise HTTPException(
            status_code=500,
            detail=str(error),
        )

    finally:

        await file.close()