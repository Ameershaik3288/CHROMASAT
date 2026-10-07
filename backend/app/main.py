import os
import shutil

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.services.raster_service import analyze_raster
from app.services.landcover_service import predict_landcover


UPLOAD_DIR = "uploads"
OUTPUT_DIR = "outputs"

os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(OUTPUT_DIR, exist_ok=True)


app = FastAPI(
    title="CHROMASAT AI API",
    description="Satellite Intelligence & Quick Disaster Management API",
    version="1.0.0",
)


# --------------------------------------------------
# Static output files
# --------------------------------------------------

app.mount(
    "/outputs",
    StaticFiles(directory=OUTPUT_DIR),
    name="outputs",
)


# --------------------------------------------------
# CORS
# --------------------------------------------------

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --------------------------------------------------
# Root
# --------------------------------------------------

@app.get("/")
def root():
    return {
        "project": "CHROMASAT AI",
        "message": "Satellite Intelligence API is running",
        "status": "online",
    }


# --------------------------------------------------
# Health Check
# --------------------------------------------------

@app.get("/api/health")
def health():
    return {
        "status": "healthy",
        "service": "CHROMASAT AI Backend",
    }


# --------------------------------------------------
# Satellite Analysis
# --------------------------------------------------

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

    if not file.filename.lower().endswith(allowed_extensions):
        raise HTTPException(
            status_code=400,
            detail="Please upload a GeoTIFF (.tif or .tiff) file.",
        )

    file_path = os.path.join(
        UPLOAD_DIR,
        file.filename,
    )

    try:

        # Save uploaded satellite image
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(
                file.file,
                buffer,
            )

        # Analyze raster
        result = analyze_raster(file_path)

        # Convert Windows filesystem path
        # into a browser-accessible API URL
        filename = os.path.basename(
            result["rgb_preview"]
        )

        result["rgb_preview"] = (
            f"http://127.0.0.1:8000/outputs/{filename}"
        )

        return {
            "success": True,
            "message": "Satellite image analyzed successfully.",
            "result": result,
        }

    except Exception as error:

        raise HTTPException(
            status_code=500,
            detail=str(error),
        )

    finally:

        await file.close()

@app.post("/api/landcover")
async def landcover_analysis(
    file: UploadFile = File(...)
):

    if not file.filename:
        raise HTTPException(
            status_code=400,
            detail="No file provided."
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
            detail="Please upload a GeoTIFF (.tif or .tiff) file."
        )

    analysis_id = str(
        __import__("uuid").uuid4()
    )

    input_path = os.path.join(
        UPLOAD_DIR,
        f"{analysis_id}_{file.filename}"
    )

    output_filename = (
        f"{analysis_id}_landcover.tif"
    )

    output_path = os.path.join(
        OUTPUT_DIR,
        output_filename
    )

    try:

        with open(
            input_path,
            "wb"
        ) as buffer:

            shutil.copyfileobj(
                file.file,
                buffer
            )

        result = predict_landcover(
            input_path,
            output_path
        )

        result["prediction_file"] = (
            f"http://127.0.0.1:8000/"
            f"outputs/{output_filename}"
        )

        return {
            "success": True,
            "message": (
                "Land-cover classification "
                "completed successfully."
            ),
            "result": result,
        }

    except Exception as error:

        raise HTTPException(
            status_code=500,
            detail=str(error)
        )

    finally:

        await file.close()