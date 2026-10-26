# CHROMASAT AI

**Satellite Intelligence + Quick Disaster Management System**

> **See the Earth. Understand the Evidence. Respond Faster.**

CHROMASAT AI is a research-oriented Earth-observation platform that converts multispectral satellite GeoTIFF imagery into understandable land-cover, confidence, water and preliminary disaster-intelligence layers.

The project is designed around a modular pipeline so the original satellite-analysis workflow remains intact while new emergency-analysis capabilities can be added independently.

## Current capabilities

### Satellite Intelligence
- GeoTIFF upload and validation
- Sentinel-2 compatible six-band workflow: B2, B3, B4, B8, B11, B12
- Browser-friendly RGB preview generated from B4/B3/B2
- Spectral indices: NDVI, NDWI and NDBI

### AI Land-Cover Classification
- Random Forest inference using 9 spectral features
- Classes: Tree, Shrub, Grass, Cropland, Built-up, Bare, Water and Wetland
- Pixel-level confidence surface
- Land-cover GeoTIFF and visual preview
- Interactive map inspection with pixel-level evidence

### Water Intelligence
- NDWI-based optical water evidence
- ML water-class comparison
- Water confidence and agreement statistics
- Water evidence preview layer

### Quick Disaster Management
The emergency dashboard is an additional intelligence layer; it does **not** replace the original satellite-analysis workflow.

- **Flood / Water:** NDWI + MNDWI optical water evidence and preliminary risk zoning
- **Fire / Burn:** NBR + NDVI + SWIR spectral evidence
- **Risk layers:** high-attention, moderate-attention and lower-risk evidence
- **Evidence maps:** water, flood-risk, confidence, fire and fire-risk layers
- Clear decision-support warnings and limitations

Earthquake, cyclone and landslide workflows are intentionally presented as future modules because they require additional inputs such as before/after imagery, weather/time-series data or terrain-specific evidence.

## Research methodology

The land-cover model uses the feature vector:

`B2, B3, B4, B8, B11, B12, NDVI, NDWI, NDBI`

The disaster layer is deliberately separated from the land-cover classifier. Flood/water analysis uses optical water indices, while fire analysis uses burn-related spectral evidence. The current six-band Sentinel-2 input does **not** contain a thermal band, so the fire module must not be interpreted as active-fire temperature detection.

All disaster outputs are preliminary satellite-derived evidence. They should be compared with temporal imagery, field observations, official alerts and domain-specific measurements before operational decisions.

## Architecture

```text
Satellite GeoTIFF
       |
       v
+---------------------+
| FastAPI Backend     |
| /api/analyze        |
| /api/landcover      |
| /api/disaster/flood |
| /api/disaster/fire  |
+----------+----------+
           |
           +-------------------+
           |                   |
           v                   v
   Spectral Analysis     ML / Risk Analysis
           |                   |
           +---------+---------+
                     |
                     v
             Evidence PNG/TIFF
                     |
                     v
              React + Leaflet UI
```

## Project structure

```text
CHROMASAT/
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   └── services/
│   │       ├── raster_service.py
│   │       ├── landcover_service.py
│   │       └── disaster_service.py
│   ├── ml/
│   ├── models/
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   └── ...
│   └── package.json
├── ml-data/
├── outputs/
└── README.md
```

## Run locally

### Backend

From `backend/`:

```bash
pip install -r requirements.txt
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

### Frontend

From `frontend/`:

```bash
npm install
npm run dev
```

The frontend expects the FastAPI service at `http://127.0.0.1:8000`.

## API endpoints

| Endpoint | Purpose |
|---|---|
| `POST /api/analyze` | Satellite metadata, indices and RGB preview |
| `POST /api/landcover` | Random Forest land-cover classification |
| `GET /api/landcover/{analysis_id}/inspect` | Pixel-level inspection |
| `POST /api/disaster/flood` | Flood/water evidence and preliminary risk |
| `POST /api/disaster/fire` | Fire/burn spectral evidence and preliminary risk |
| `GET /api/health` | Backend health check |

## IEEE / research positioning

CHROMASAT is best presented as a **research prototype for satellite-derived Earth observation intelligence and preliminary disaster decision support**. The system separates measurable spectral indicators, supervised land-cover inference and heuristic emergency evidence instead of presenting all outputs as ground truth.

For publication, report the dataset source, preprocessing, feature engineering, model configuration, train/validation/test protocol, class imbalance, accuracy metrics, limitations and reproducibility details explicitly.

## Safety and scientific limitations

- A single satellite scene cannot establish that a flood event occurred; temporal comparison is preferable.
- Optical water indices identify water-like spectral evidence, not guaranteed inundation.
- The current six-band Sentinel-2 workflow has no thermal channel; fire output is spectral burn evidence, not temperature-based active-fire detection.
- A lower-risk pixel class is **not** a guaranteed safe zone.
- Operational emergency decisions must defer to official authorities and field verification.

## Technology stack

**Frontend:** React, Vite, Tailwind CSS, Axios, React Leaflet, Leaflet, Lucide React  
**Backend:** FastAPI, Python, Rasterio, NumPy, Pillow, scikit-learn, Joblib  
**ML:** Random Forest + engineered spectral indices  
**GIS:** GeoTIFF, Leaflet, georeferenced image overlays

## License

Add the license required by the intended IEEE publication, institution or project distribution policy before public release.
