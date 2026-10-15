import { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import {
  Activity,
  AlertCircle,
  BarChart3,
  CheckCircle2,
  ChevronRight,
  CloudUpload,
  Droplets,
  Gauge,
  Layers3,
  Loader2,
  Map,
  MousePointer2,
  Satellite,
  ShieldCheck,
  Sparkles,
  Upload,
  Waves,
  Zap,
} from "lucide-react";

import {
  MapContainer,
  ImageOverlay,
  TileLayer,
  useMapEvents,
} from "react-leaflet";

import "leaflet/dist/leaflet.css";


const API_BASE_URL = "http://127.0.0.1:8000";


const CLASS_META = {
  0: {
    name: "Tree",
    icon: "🌳",
    color: "#22c55e",
  },

  1: {
    name: "Shrub",
    icon: "🌿",
    color: "#84cc16",
  },

  2: {
    name: "Grass",
    icon: "🌱",
    color: "#4ade80",
  },

  3: {
    name: "Cropland",
    icon: "🌾",
    color: "#facc15",
  },

  4: {
    name: "Built-up",
    icon: "🏙️",
    color: "#ef4444",
  },

  5: {
    name: "Bare",
    icon: "🏜️",
    color: "#d97706",
  },

  6: {
    name: "Water",
    icon: "💧",
    color: "#0ea5e9",
  },

  7: {
    name: "Wetland",
    icon: "🪻",
    color: "#a855f7",
  },
};


function App() {
  const [selectedFile, setSelectedFile] =
    useState(null);

  const [analysis, setAnalysis] =
    useState(null);

  const [landcover, setLandcover] =
    useState(null);

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  const [activeLayer, setActiveLayer] =
    useState("landcover");

  const [inspectedPixel, setInspectedPixel] =
    useState(null);

  const [hoverInfo, setHoverInfo] =
    useState(null);


  const handleFileChange = (event) => {

    const file =
      event.target.files?.[0];

    if (!file) {
      return;
    }

    const isGeoTiff =
      file.name
        .toLowerCase()
        .endsWith(".tif") ||
      file.name
        .toLowerCase()
        .endsWith(".tiff");

    if (!isGeoTiff) {

      setSelectedFile(null);
      setAnalysis(null);
      setLandcover(null);

      setError(
        "Please select a GeoTIFF (.tif or .tiff) file."
      );

      return;
    }

    setSelectedFile(file);
    setAnalysis(null);
    setLandcover(null);
    setInspectedPixel(null);
    setHoverInfo(null);
    setError("");
  };


  const handleAnalyze = async () => {

    if (!selectedFile) {

      setError(
        "Please select a satellite image first."
      );

      return;
    }

    setLoading(true);
    setError("");
    setAnalysis(null);
    setLandcover(null);
    setInspectedPixel(null);

    try {

      const formData =
        new FormData();

      formData.append(
        "file",
        selectedFile
      );


      // ------------------------------------------------------
      // STEP 1 — spectral analysis
      // ------------------------------------------------------

      const analysisResponse =
        await axios.post(
          `${API_BASE_URL}/api/analyze`,
          formData,
          {
            headers: {
              "Content-Type":
                "multipart/form-data",
            },
          }
        );


      setAnalysis(
        analysisResponse.data.result
      );


      // ------------------------------------------------------
      // STEP 2 — ML land-cover intelligence
      // ------------------------------------------------------

      const landcoverResponse =
        await axios.post(
          `${API_BASE_URL}/api/landcover`,
          formData,
          {
            headers: {
              "Content-Type":
                "multipart/form-data",
            },
          }
        );


      setLandcover(
        landcoverResponse.data.result
      );

      setActiveLayer(
        "landcover"
      );

    } catch (err) {

      console.error(
        "CHROMASAT analysis error:",
        err
      );

      setError(
        err.response?.data?.detail ||
          "Satellite analysis failed. Please check the backend."
      );

    } finally {

      setLoading(false);
    }
  };


  const resetAnalysis = () => {

    setSelectedFile(null);
    setAnalysis(null);
    setLandcover(null);
    setInspectedPixel(null);
    setHoverInfo(null);
    setError("");

    const input =
      document.getElementById(
        "satellite-file"
      );

    if (input) {
      input.value = "";
    }
  };


  const inspectPixel = async (
    x,
    y
  ) => {

    if (!landcover?.analysis_id) {
      return;
    }

    try {

      const response =
        await axios.get(
          `${API_BASE_URL}/api/landcover/${landcover.analysis_id}/inspect`,
          {
            params: {
              x,
              y,
            },
          }
        );

      setInspectedPixel(
        response.data.result
      );

    } catch (err) {

      console.error(
        "Pixel inspection failed:",
        err
      );
    }
  };


  const mapBounds =
    useMemo(() => {

      if (!landcover?.bounds) {
        return null;
      }

      return [
        [
          landcover.bounds.bottom,
          landcover.bounds.left,
        ],

        [
          landcover.bounds.top,
          landcover.bounds.right,
        ],
      ];

    }, [landcover]);


  return (
    <div className="min-h-screen overflow-hidden bg-[#03070d] text-white">

      <style>{`

        @keyframes orbit {

          from {
            transform:
              rotate(0deg)
              translateX(8px)
              rotate(0deg);
          }

          to {
            transform:
              rotate(360deg)
              translateX(8px)
              rotate(-360deg);
          }

        }

        @keyframes pulseCore {

          0%, 100% {
            transform: scale(1);
            opacity: .65;
          }

          50% {
            transform: scale(1.12);
            opacity: 1;
          }

        }

        @keyframes scan {

          0% {
            transform: translateY(-120%);
            opacity: 0;
          }

          20% {
            opacity: .8;
          }

          80% {
            opacity: .8;
          }

          100% {
            transform: translateY(500%);
            opacity: 0;
          }

        }

        @keyframes float {

          0%, 100% {
            transform: translateY(0px);
          }

          50% {
            transform: translateY(-8px);
          }

        }

        @keyframes shimmer {

          0% {
            background-position: -500px 0;
          }

          100% {
            background-position: 500px 0;
          }

        }

        .orbit-ring {
          animation:
            orbit 14s linear infinite;
        }

        .core-pulse {
          animation:
            pulseCore 3s ease-in-out infinite;
        }

        .earth-float {
          animation:
            float 5s ease-in-out infinite;
        }

        .scan-line {
          animation:
            scan 5s ease-in-out infinite;
        }

        .glass-card {
          background:
            linear-gradient(
              145deg,
              rgba(15, 28, 43, .88),
              rgba(3, 10, 18, .88)
            );

          box-shadow:
            0 20px 70px
            rgba(0, 0, 0, .28);

          backdrop-filter:
            blur(18px);
        }

        .hover-lift {
          transition:
            transform .25s ease,
            border-color .25s ease,
            box-shadow .25s ease;
        }

        .hover-lift:hover {
          transform:
            translateY(-4px);

          border-color:
            rgba(34, 211, 238, .35);

          box-shadow:
            0 16px 50px
            rgba(0, 180, 255, .08);
        }

        .leaflet-container {
          background: #02060a;
          font-family: inherit;
        }

        .leaflet-control-zoom a {
          background: #07111d !important;
          color: #67e8f9 !important;
          border-color: rgba(255,255,255,.1) !important;
        }

      `}</style>


      {/* ================================================== */}
      {/* HEADER */}
      {/* ================================================== */}

      <header className="
        sticky top-0 z-50
        border-b border-white/10
        bg-[#03070d]/85
        backdrop-blur-2xl
      ">

        <div className="
          mx-auto flex max-w-7xl
          items-center justify-between
          px-6 py-4
        ">

          <div className="flex items-center gap-3">

            <div className="
              relative flex h-11 w-11
              items-center justify-center
              rounded-xl
              bg-cyan-400/10
              ring-1 ring-cyan-400/20
            ">

              <Satellite
                className="
                  h-6 w-6
                  text-cyan-400
                "
              />

              <span className="
                absolute -right-1
                -top-1 h-2 w-2
                rounded-full
                bg-cyan-300
                shadow-[0_0_12px_rgba(34,211,238,.9)]
              " />

            </div>

            <div>

              <h1 className="
                text-lg font-bold
                tracking-wide
              ">

                CHROMASAT{" "}

                <span className="
                  text-cyan-400
                ">
                  AI
                </span>

              </h1>

              <p className="
                text-[10px]
                text-slate-500
              ">
                Earth Observation Intelligence Platform
              </p>

            </div>

          </div>


          <div className="
            hidden items-center gap-5
            md:flex
          ">

            <span className="
              text-xs text-cyan-300
            ">
              AI Engine
            </span>

            <span className="
              text-xs text-slate-500
            ">
              Land Cover
            </span>

            <span className="
              text-xs text-slate-500
            ">
              Water Intelligence
            </span>

            <div className="
              flex items-center gap-2
              rounded-full
              border border-emerald-500/20
              bg-emerald-500/5
              px-3 py-1.5
              text-[10px]
              text-emerald-400
            ">

              <span className="
                h-1.5 w-1.5
                rounded-full
                bg-emerald-400
                shadow-[0_0_10px_rgba(52,211,153,.8)]
              " />

              SYSTEM ONLINE

            </div>

          </div>

        </div>

      </header>


      <main className="
        mx-auto max-w-7xl
        px-5 py-8
      ">


        {/* ================================================= */}
        {/* HERO */}
        {/* ================================================= */}

        <section className="
          relative mb-8
          overflow-hidden
          rounded-3xl
          border border-cyan-400/10
          bg-gradient-to-br
          from-cyan-400/[0.05]
          via-transparent
          to-blue-500/[0.04]
          p-8
        ">

          <div className="
            pointer-events-none
            absolute inset-0
            opacity-40
          ">

            <div className="
              scan-line
              absolute left-0
              top-0 h-px w-full
              bg-gradient-to-r
              from-transparent
              via-cyan-400
              to-transparent
            " />

          </div>


          <div className="
            grid items-center
            gap-8 lg:grid-cols-[1fr_340px]
          ">

            <div>

              <div className="
                mb-4 inline-flex
                items-center gap-2
                rounded-full
                border border-cyan-400/15
                bg-cyan-400/5
                px-3 py-1.5
                text-[10px]
                uppercase
                tracking-[0.2em]
                text-cyan-300
              ">

                <Sparkles
                  className="h-3.5 w-3.5"
                />

                AI-Powered Earth Observation

              </div>


              <h2 className="
                max-w-3xl
                text-4xl font-bold
                tracking-tight
                sm:text-5xl
              ">

                From orbital imagery

                <br />

                <span className="
                  text-cyan-400
                ">
                  to actionable intelligence.
                </span>

              </h2>


              <p className="
                mt-4 max-w-2xl
                text-sm leading-6
                text-slate-400
              ">

                CHROMASAT transforms
                multispectral satellite imagery
                into land-cover intelligence,
                confidence surfaces and
                water-body evidence.

              </p>


              <div className="
                mt-5 flex flex-wrap gap-2
              ">

                <Pill text="9 spectral features" />

                <Pill text="Random Forest AI" />

                <Pill text="Pixel intelligence" />

                <Pill text="NDWI water evidence" />

              </div>

            </div>


            {/* 3D EARTH CORE */}

            <div className="
              relative mx-auto
              h-64 w-64
            ">

              <div className="
                absolute inset-5
                rounded-full
                border border-cyan-400/10
                bg-cyan-400/[0.02]
              " />

              <div className="
                earth-float
                absolute inset-12
                overflow-hidden
                rounded-full
                border border-cyan-300/20
                bg-gradient-to-br
                from-cyan-500/30
                via-blue-950
                to-black
                shadow-[0_0_70px_rgba(34,211,238,.12)]
              ">

                <div className="
                  core-pulse
                  absolute left-1/2 top-1/2
                  h-24 w-24
                  -translate-x-1/2
                  -translate-y-1/2
                  rounded-full
                  bg-cyan-400/20
                  blur-2xl
                " />

                <div className="
                  absolute left-1/3 top-1/4
                  h-8 w-14
                  rotate-[-25deg]
                  rounded-full
                  bg-emerald-300/50
                  blur-[3px]
                " />

                <div className="
                  absolute right-1/4 top-1/2
                  h-10 w-16
                  rotate-[15deg]
                  rounded-full
                  bg-emerald-400/35
                  blur-[3px]
                " />

                <div className="
                  absolute left-1/4 bottom-1/4
                  h-5 w-12
                  rotate-[35deg]
                  rounded-full
                  bg-emerald-300/30
                  blur-[3px]
                " />

              </div>


              <div className="
                orbit-ring
                absolute inset-2
                rounded-full
                border border-cyan-400/20
              " />

              <div className="
                absolute inset-0
                rounded-full
                border border-dashed
                border-cyan-400/10
              " />


              <div className="
                absolute right-3 top-5
                rounded-lg
                border border-cyan-400/20
                bg-black/40
                px-2 py-1
                text-[9px]
                text-cyan-300
              ">
                SAT-01
              </div>


              <div className="
                absolute bottom-2 left-1/2
                -translate-x-1/2
                rounded-full
                border border-white/10
                bg-black/50
                px-3 py-1
                text-[9px]
                text-slate-400
              ">
                ORBITAL ANALYSIS
              </div>

            </div>

          </div>

        </section>


        {/* ================================================= */}
        {/* TOP STATS */}
        {/* ================================================= */}

        <section className="
          mb-8 grid gap-4
          sm:grid-cols-2
          lg:grid-cols-5
        ">

          <StatCard
            icon={
              <Map className="h-4 w-4" />
            }
            label="Scene"
            value={
              analysis
                ? `${analysis.image?.width || landcover?.width} × ${analysis.image?.height || landcover?.height}`
                : "Awaiting"
            }
            description="Raster dimensions"
          />


          <StatCard
            icon={
              <Activity className="h-4 w-4" />
            }
            label="NDVI"
            value={
              analysis?.vegetation
                ? analysis.vegetation.ndvi_mean.toFixed(3)
                : "—"
            }
            description="Vegetation signal"
          />


          <StatCard
            icon={
              <Droplets className="h-4 w-4" />
            }
            label="NDWI"
            value={
              analysis?.water
                ? analysis.water.ndwi_mean.toFixed(3)
                : "—"
            }
            description="Water signal"
          />


          <StatCard
            icon={
              <Gauge className="h-4 w-4" />
            }
            label="AI confidence"
            value={
              landcover
                ? `${(
                    landcover.mean_confidence *
                    100
                  ).toFixed(1)}%`
                : "—"
            }
            description="Mean pixel confidence"
          />


          <StatCard
            icon={
              <Waves className="h-4 w-4" />
            }
            label="Water evidence"
            value={
              landcover?.water_intelligence
                ? `${landcover.water_intelligence.high_confidence_water_percentage}%`
                : "—"
            }
            description="High-confidence NDWI"
          />

        </section>


        {/* ================================================= */}
        {/* UPLOAD + ENGINE STATUS */}
        {/* ================================================= */}

        <section className="
          mb-8 grid gap-5
          lg:grid-cols-[1fr_1fr]
        ">

          <div className="
            glass-card
            hover-lift
            rounded-2xl
            border border-white/10
            p-6
          ">

            <div className="
              mb-5 flex
              items-center gap-3
            ">

              <div className="
                rounded-xl
                bg-cyan-400/10
                p-3
              ">

                <CloudUpload
                  className="
                    h-5 w-5
                    text-cyan-400
                  "
                />

              </div>

              <div>

                <h3 className="
                  font-semibold
                ">
                  Satellite Scene Input
                </h3>

                <p className="
                  text-xs
                  text-slate-500
                ">
                  Sentinel-2 compatible GeoTIFF
                </p>

              </div>

            </div>


            <label
              htmlFor="satellite-file"
              className="
                group flex
                min-h-44 cursor-pointer
                flex-col items-center
                justify-center
                rounded-2xl
                border border-dashed
                border-cyan-400/20
                bg-black/20
                p-6 text-center
                transition
                hover:border-cyan-400/50
                hover:bg-cyan-400/[0.03]
              "
            >

              <div className="
                mb-3 rounded-2xl
                bg-cyan-400/10
                p-4
                transition
                group-hover:scale-110
              ">

                <Upload
                  className="
                    h-7 w-7
                    text-cyan-400
                  "
                />

              </div>


              {selectedFile ? (

                <>

                  <p className="
                    max-w-full
                    truncate
                    font-medium
                  ">
                    {selectedFile.name}
                  </p>

                  <p className="
                    mt-1 text-xs
                    text-emerald-400
                  ">
                    Scene loaded
                  </p>

                </>

              ) : (

                <>

                  <p className="
                    font-medium
                  ">
                    Drop satellite imagery
                  </p>

                  <p className="
                    mt-1 text-xs
                    text-slate-500
                  ">
                    or click to browse
                  </p>

                </>

              )}


              <span className="
                mt-3 rounded-full
                border border-white/10
                px-3 py-1
                text-[9px]
                tracking-widest
                text-slate-500
              ">
                TIFF / GEOTIFF
              </span>


              <input
                id="satellite-file"
                type="file"
                accept=".tif,.tiff"
                className="hidden"
                onChange={
                  handleFileChange
                }
              />

            </label>


            {selectedFile && (

              <div className="
                mt-3 flex
                items-center gap-3
                rounded-xl
                border border-emerald-500/20
                bg-emerald-500/5
                p-3
              ">

                <CheckCircle2
                  className="
                    h-5 w-5
                    text-emerald-400
                  "
                />

                <div className="min-w-0">

                  <p className="
                    truncate
                    text-sm
                  ">
                    {selectedFile.name}
                  </p>

                  <p className="
                    text-[10px]
                    text-slate-500
                  ">
                    {(
                      selectedFile.size /
                      1024 /
                      1024
                    ).toFixed(2)} MB
                  </p>

                </div>

              </div>

            )}


            {error && (

              <div className="
                mt-4 flex gap-3
                rounded-xl
                border border-red-500/20
                bg-red-500/5
                p-3
                text-xs
                text-red-300
              ">

                <AlertCircle
                  className="
                    h-4 w-4
                    shrink-0
                  "
                />

                {error}

              </div>

            )}


            <button
              onClick={handleAnalyze}
              disabled={
                !selectedFile ||
                loading
              }
              className="
                mt-4 flex w-full
                items-center
                justify-center gap-2
                rounded-xl
                bg-cyan-400
                px-5 py-3
                text-sm font-bold
                text-slate-950
                transition
                hover:bg-cyan-300
                hover:shadow-[0_0_30px_rgba(34,211,238,.2)]
                disabled:cursor-not-allowed
                disabled:opacity-40
              "
            >

              {loading ? (

                <>
                  <Loader2
                    className="
                      h-4 w-4
                      animate-spin
                    "
                  />

                  Running AI pipeline...

                </>

              ) : (

                <>
                  <Sparkles
                    className="h-4 w-4"
                  />

                  Run CHROMASAT Intelligence

                </>

              )}

            </button>

          </div>


          {/* ENGINE STATUS */}

          <div className="
            glass-card
            rounded-2xl
            border border-white/10
            p-6
          ">

            <div className="
              mb-5 flex
              items-center justify-between
            ">

              <div>

                <p className="
                  text-[9px]
                  uppercase
                  tracking-[.2em]
                  text-cyan-400
                ">
                  AI Pipeline
                </p>

                <h3 className="
                  mt-1
                  text-lg
                  font-semibold
                ">
                  Spectral Intelligence Engine
                </h3>

              </div>

              <span className="
                rounded-full
                border border-emerald-500/20
                bg-emerald-500/5
                px-3 py-1
                text-[9px]
                text-emerald-400
              ">
                LIVE
              </span>

            </div>


            <EngineStep
              number="01"
              title="Multispectral input"
              status={
                selectedFile
                  ? "READY"
                  : "WAITING"
              }
              active={
                Boolean(
                  selectedFile
                )
              }
            />


            <EngineStep
              number="02"
              title="Spectral indices"
              status={
                analysis
                  ? "COMPLETE"
                  : "WAITING"
              }
              active={
                Boolean(analysis)
              }
            />


            <EngineStep
              number="03"
              title="Random Forest inference"
              status={
                landcover
                  ? "COMPLETE"
                  : "WAITING"
              }
              active={
                Boolean(landcover)
              }
            />


            <EngineStep
              number="04"
              title="Confidence surface"
              status={
                landcover
                  ? "COMPLETE"
                  : "WAITING"
              }
              active={
                Boolean(landcover)
              }
            />


            <EngineStep
              number="05"
              title="Water / river evidence"
              status={
                landcover
                  ? "COMPLETE"
                  : "WAITING"
              }
              active={
                Boolean(landcover)
              }
            />

          </div>

        </section>


        {/* ================================================= */}
        {/* RESULTS */}
        {/* ================================================= */}

        {landcover && (

          <>

            <section className="
              mb-8
            ">

              <div className="
                mb-4 flex
                items-end justify-between
              ">

                <div>

                  <p className="
                    text-[9px]
                    uppercase
                    tracking-[.2em]
                    text-cyan-400
                  ">
                    Earth Observation Results
                  </p>

                  <h2 className="
                    mt-1
                    text-2xl
                    font-semibold
                  ">
                    Interactive Intelligence Map
                  </h2>

                  <p className="
                    mt-1
                    text-xs
                    text-slate-500
                  ">
                    Click anywhere on the scene
                    to inspect pixel-level AI evidence.
                  </p>

                </div>


                <button
                  onClick={resetAnalysis}
                  className="
                    rounded-lg
                    border border-white/10
                    px-3 py-2
                    text-[10px]
                    text-slate-400
                    transition
                    hover:border-cyan-400/30
                    hover:text-white
                  "
                >
                  New analysis
                </button>

              </div>


              <div className="
                overflow-hidden
                rounded-2xl
                border border-cyan-400/10
                bg-[#02060a]
                shadow-[0_20px_80px_rgba(0,0,0,.3)]
              ">

                <div className="
                  flex flex-wrap
                  items-center
                  justify-between
                  gap-3
                  border-b border-white/10
                  bg-black/20
                  px-4 py-3
                ">

                  <div className="
                    flex items-center gap-2
                  ">

                    <Map
                      className="
                        h-4 w-4
                        text-cyan-400
                      "
                    />

                    <span className="
                      text-xs
                      font-medium
                    ">
                      Nandyal Earth Observation Grid
                    </span>

                  </div>


                  <div className="
                    flex flex-wrap gap-1.5
                  ">

                    <LayerButton
                      active={
                        activeLayer ===
                        "satellite"
                      }
                      onClick={() =>
                        setActiveLayer(
                          "satellite"
                        )
                      }
                      label="Satellite"
                    />

                    <LayerButton
                      active={
                        activeLayer ===
                        "landcover"
                      }
                      onClick={() =>
                        setActiveLayer(
                          "landcover"
                        )
                      }
                      label="Land Cover"
                    />

                    <LayerButton
                      active={
                        activeLayer ===
                        "confidence"
                      }
                      onClick={() =>
                        setActiveLayer(
                          "confidence"
                        )
                      }
                      label="Confidence"
                    />

                    <LayerButton
                      active={
                        activeLayer ===
                        "water"
                      }
                      onClick={() =>
                        setActiveLayer(
                          "water"
                        )
                      }
                      label="Water"
                    />

                  </div>

                </div>


                <div className="
                  relative h-[560px]
                ">

                  {mapBounds && (

                    <MapContainer
                      bounds={mapBounds}
                      className="
                        h-full w-full
                      "
                      scrollWheelZoom
                    >

                      <TileLayer
                        attribution="© OpenStreetMap contributors"
                        url="
                          https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png
                        "
                        opacity={
                          activeLayer ===
                          "satellite"
                            ? 0.65
                            : 0.15
                        }
                      />


                      {activeLayer ===
                        "satellite" &&
                        analysis?.rgb_preview && (

                          <ImageOverlay
                            url={
                              `${API_BASE_URL}${analysis.rgb_preview}`
                            }
                            bounds={
                              mapBounds
                            }
                            opacity={0.95}
                          />

                        )}


                      {activeLayer ===
                        "landcover" &&
                        landcover.prediction_preview && (

                          <ImageOverlay
                            url={
                              `${API_BASE_URL}${landcover.prediction_preview}`
                            }
                            bounds={
                              mapBounds
                            }
                            opacity={0.85}
                          />

                        )}


                      {activeLayer ===
                        "confidence" &&
                        landcover.confidence_preview && (

                          <ImageOverlay
                            url={
                              `${API_BASE_URL}${landcover.confidence_preview}`
                            }
                            bounds={
                              mapBounds
                            }
                            opacity={0.9}
                          />

                        )}


                      {activeLayer ===
                        "water" &&
                        landcover.water_preview && (

                          <ImageOverlay
                            url={
                              `${API_BASE_URL}${landcover.water_preview}`
                            }
                            bounds={
                              mapBounds
                            }
                            opacity={1}
                          />

                        )}


                      <MapInteraction
                        width={
                          landcover.width
                        }
                        height={
                          landcover.height
                        }
                        onInspect={
                          inspectPixel
                        }
                        onHover={
                          setHoverInfo
                        }
                      />

                    </MapContainer>

                  )}


                  {/* MAP HUD */}

                  <div className="
                    pointer-events-none
                    absolute left-4 top-4
                    z-[500]
                    rounded-xl
                    border border-cyan-400/20
                    bg-black/65
                    px-4 py-3
                    backdrop-blur-xl
                  ">

                    <div className="
                      flex items-center gap-2
                    ">

                      <span className="
                        h-2 w-2
                        rounded-full
                        bg-cyan-400
                        shadow-[0_0_12px_rgba(34,211,238,.9)]
                      " />

                      <span className="
                        text-[10px]
                        font-semibold
                        tracking-wider
                        text-cyan-200
                      ">
                        {activeLayer.toUpperCase()}
                        {" "}INTELLIGENCE
                      </span>

                    </div>

                    <p className="
                      mt-1
                      text-[9px]
                      text-slate-400
                    ">
                      Pixel-resolution inspection active
                    </p>

                  </div>


                  {/* HOVER HUD */}

                  {hoverInfo && (

                    <div className="
                      pointer-events-none
                      absolute bottom-4 left-4
                      z-[500]
                      rounded-xl
                      border border-white/10
                      bg-black/70
                      px-3 py-2
                      text-[9px]
                      backdrop-blur-xl
                    ">

                      PIXEL{" "}
                      {hoverInfo.x}
                      {" / "}
                      {hoverInfo.y}

                    </div>

                  )}

                </div>

              </div>

            </section>


            {/* ================================================= */}
            {/* PIXEL INSPECTION */}
            {/* ================================================= */}

            {inspectedPixel && (

              <section className="
                mb-8
                rounded-2xl
                border border-cyan-400/15
                bg-cyan-400/[0.025]
                p-5
              ">

                <div className="
                  mb-4 flex
                  items-center gap-3
                ">

                  <div className="
                    rounded-xl
                    bg-cyan-400/10
                    p-2.5
                  ">

                    <MousePointer2
                      className="
                        h-5 w-5
                        text-cyan-400
                      "
                    />

                  </div>

                  <div>

                    <p className="
                      text-[9px]
                      uppercase
                      tracking-[.2em]
                      text-cyan-400
                    ">
                      Pixel Investigation
                    </p>

                    <h3 className="
                      font-semibold
                    ">
                      AI evidence at pixel
                      {" "}
                      {inspectedPixel.pixel.x},
                      {" "}
                      {inspectedPixel.pixel.y}
                    </h3>

                  </div>

                </div>


                <div className="
                  grid gap-3
                  sm:grid-cols-2
                  lg:grid-cols-5
                ">

                  <InspectionCard
                    label="Classification"
                    value={
                      `${CLASS_META[
                        inspectedPixel.class.class_id
                      ]?.icon || "◈"} ${
                        inspectedPixel.class.class_name
                      }`
                    }
                  />


                  <InspectionCard
                    label="AI confidence"
                    value={
                      `${(
                        inspectedPixel.confidence *
                        100
                      ).toFixed(1)}%`
                    }
                  />


                  <InspectionCard
                    label="NDVI"
                    value={
                      inspectedPixel.indices.NDVI.toFixed(
                        4
                      )
                    }
                  />


                  <InspectionCard
                    label="NDWI"
                    value={
                      inspectedPixel.indices.NDWI.toFixed(
                        4
                      )
                    }
                  />


                  <InspectionCard
                    label="Water evidence"
                    value={
                      inspectedPixel.water_status
                    }
                  />

                </div>

              </section>

            )}


            {/* ================================================= */}
            {/* CONFIDENCE + WATER */}
            {/* ================================================= */}

            <section className="
              mb-8 grid gap-5
              lg:grid-cols-2
            ">

              <InsightPanel
                icon={
                  <Gauge
                    className="
                      h-5 w-5
                    "
                  />
                }
                title="AI Confidence Surface"
                subtitle="Random Forest probability of the winning class"
              >

                <div className="
                  flex items-end
                  justify-between
                  gap-5
                ">

                  <div>

                    <p className="
                      text-4xl
                      font-bold
                      text-cyan-300
                    ">
                      {(
                        landcover.mean_confidence *
                        100
                      ).toFixed(1)}%
                    </p>

                    <p className="
                      mt-1
                      text-[10px]
                      text-slate-500
                    ">
                      Mean confidence
                    </p>

                  </div>


                  <div className="
                    text-right
                  ">

                    <p className="
                      text-lg
                      font-semibold
                    ">
                      {(
                        landcover.high_confidence_percentage
                      ).toFixed(1)}%
                    </p>

                    <p className="
                      text-[10px]
                      text-slate-500
                    ">
                      pixels ≥ 80%
                    </p>

                  </div>

                </div>


                <div className="
                  mt-5 h-2
                  overflow-hidden
                  rounded-full
                  bg-white/5
                ">

                  <div
                    className="
                      h-full
                      rounded-full
                      bg-cyan-400
                      transition-all
                    "
                    style={{
                      width:
                        `${Math.min(
                          100,
                          landcover.mean_confidence *
                            100
                        )}%`,
                    }}
                  />

                </div>


                <p className="
                  mt-3
                  text-[10px]
                  leading-5
                  text-slate-500
                ">
                  Click the confidence layer
                  and inspect individual pixels
                  to see where the model is uncertain.
                </p>

              </InsightPanel>


              <InsightPanel
                icon={
                  <Waves
                    className="
                      h-5 w-5
                    "
                  />
                }
                title="Water / River Intelligence"
                subtitle="NDWI evidence compared with ML water predictions"
              >

                <div className="
                  grid grid-cols-3 gap-3
                ">

                  <MiniMetric
                    label="ML water"
                    value={
                      `${landcover.water_intelligence.ml_water_percentage}%`
                    }
                  />

                  <MiniMetric
                    label="NDWI high"
                    value={
                      `${landcover.water_intelligence.high_confidence_water_percentage}%`
                    }
                  />

                  <MiniMetric
                    label="Agreement"
                    value={
                      `${landcover.water_intelligence.ml_water_spectral_agreement}%`
                    }
                  />

                </div>


                <div className="
                  mt-4 rounded-xl
                  border border-cyan-400/10
                  bg-cyan-400/[0.03]
                  p-3
                ">

                  <div className="
                    flex items-center gap-2
                  ">

                    <Droplets
                      className="
                        h-4 w-4
                        text-cyan-400
                      "
                    />

                    <span className="
                      text-xs
                      font-medium
                    ">
                      NDWI evidence layer
                    </span>

                  </div>

                  <p className="
                    mt-1
                    text-[10px]
                    leading-5
                    text-slate-500
                  ">
                    Blue regions represent
                    spectral water evidence.
                    Brighter regions indicate
                    stronger NDWI evidence.
                  </p>

                </div>

              </InsightPanel>

            </section>


            {/* ================================================= */}
            {/* LAND COVER */}
            {/* ================================================= */}

            <section className="
              mb-8
            ">

              <div className="
                mb-4 flex
                items-center
                justify-between
              ">

                <div>

                  <p className="
                    text-[9px]
                    uppercase
                    tracking-[.2em]
                    text-cyan-400
                  ">
                    Classification Matrix
                  </p>

                  <h2 className="
                    mt-1
                    text-xl
                    font-semibold
                  ">
                    Land-Cover Intelligence
                  </h2>

                </div>

                <BarChart3
                  className="
                    h-5 w-5
                    text-slate-600
                  "
                />

              </div>


              <div className="
                grid gap-3
                sm:grid-cols-2
                lg:grid-cols-4
              ">

                {landcover.classes.map(
                  (item) => {

                    const meta =
                      CLASS_META[
                        item.class_id
                      ];

                    return (

                      <div
                        key={
                          item.class_id
                        }
                        className="
                          hover-lift
                          rounded-2xl
                          border border-white/10
                          bg-white/[0.025]
                          p-4
                        "
                      >

                        <div className="
                          flex
                          items-center
                          justify-between
                        ">

                          <span className="
                            text-xl
                          ">
                            {meta?.icon}
                          </span>

                          <span className="
                            rounded-full
                            border border-white/10
                            px-2 py-1
                            text-[8px]
                            text-slate-500
                          ">
                            CLASS{" "}
                            {item.class_id}
                          </span>

                        </div>


                        <p className="
                          mt-4
                          text-xs
                          text-slate-400
                        ">
                          {item.class_name}
                        </p>


                        <p className="
                          mt-1
                          text-2xl
                          font-bold
                        ">
                          {item.percentage}%
                        </p>


                        <div className="
                          mt-3 h-1.5
                          overflow-hidden
                          rounded-full
                          bg-white/5
                        ">

                          <div
                            className="
                              h-full
                              rounded-full
                            "
                            style={{
                              width:
                                `${Math.min(
                                  100,
                                  item.percentage
                                )}%`,
                              backgroundColor:
                                meta?.color,
                            }}
                          />

                        </div>


                        <div className="
                          mt-3 flex
                          justify-between
                          text-[9px]
                          text-slate-600
                        ">

                          <span>
                            {item.pixel_count.toLocaleString()}
                            {" "}px
                          </span>

                          <span>
                            {(
                              item.mean_confidence *
                              100
                            ).toFixed(1)}%
                            {" "}conf.
                          </span>

                        </div>

                      </div>

                    );

                  }
                )}

              </div>

            </section>


            {/* ================================================= */}
            {/* DATA SUMMARY */}
            {/* ================================================= */}

            <section className="
              mb-8 grid gap-4
              sm:grid-cols-2
              lg:grid-cols-4
            ">

              <DataTile
                label="Raster width"
                value={`${landcover.width} px`}
              />

              <DataTile
                label="Raster height"
                value={`${landcover.height} px`}
              />

              <DataTile
                label="Coordinate system"
                value={
                  analysis?.image?.crs ||
                  "EPSG:4326"
                }
              />

              <DataTile
                label="ML classes"
                value={
                  `${landcover.classes.length} classes`
                }
              />

            </section>


            {/* ================================================= */}
            {/* DISASTER INTELLIGENCE */}
            {/* ================================================= */}

            <section className="
              mb-8
            ">

              <div className="
                mb-4
              ">

                <p className="
                  text-[9px]
                  uppercase
                  tracking-[.2em]
                  text-orange-400
                ">
                  Decision Support
                </p>

                <h2 className="
                  mt-1
                  text-xl
                  font-semibold
                ">
                  Quick Disaster Intelligence
                </h2>

              </div>


              <div className="
                grid gap-4
                md:grid-cols-3
              ">

                <DisasterCard
                  icon={
                    <Waves
                      className="
                        h-5 w-5
                      "
                    />
                  }
                  title="Flood / Water"
                  description={
                    "NDWI-derived water evidence and water extent."
                  }
                  status={
                    "ACTIVE"
                  }
                  active
                />


                <DisasterCard
                  icon={
                    <Zap
                      className="
                        h-5 w-5
                      "
                    />
                  }
                  title="Change Detection"
                  description={
                    "Compare before/after scenes for land disturbance."
                  }
                  status={
                    "NEXT ENGINE"
                  }
                />


                <DisasterCard
                  icon={
                    <ShieldCheck
                      className="
                        h-5 w-5
                      "
                    />
                  }
                  title="Decision Support"
                  description={
                    "Satellite evidence for preliminary assessment."
                  }
                  status={
                    "READY"
                  }
                />

              </div>

            </section>


            {/* ================================================= */}
            {/* FOOTER NOTICE */}
            {/* ================================================= */}

            <section className="
              rounded-2xl
              border border-amber-500/15
              bg-amber-500/[0.025]
              p-5
            ">

              <div className="
                flex gap-3
              ">

                <ShieldCheck
                  className="
                    mt-0.5
                    h-5 w-5
                    shrink-0
                    text-amber-400
                  "
                />

                <div>

                  <h3 className="
                    text-xs
                    font-semibold
                    text-amber-300
                  ">
                    Satellite decision-support notice
                  </h3>

                  <p className="
                    mt-1
                    text-[10px]
                    leading-5
                    text-slate-500
                  ">
                    CHROMASAT produces
                    satellite-derived analytical
                    evidence. Results should support,
                    not replace, field verification,
                    official alerts and expert
                    decision-making.
                  </p>

                </div>

              </div>

            </section>

          </>

        )}

      </main>


      <footer className="
        border-t border-white/10
        px-6 py-5
        text-center
      ">

        <p className="
          text-[9px]
          tracking-wider
          text-slate-600
        ">
          CHROMASAT AI · Earth Observation
          Intelligence · Research Prototype
        </p>

      </footer>

    </div>
  );
}


/* ============================================================
   MAP INTERACTION
   ============================================================ */

function MapInteraction({
  width,
  height,
  onInspect,
  onHover,
}) {

  useMapEvents({

    click(event) {

      const map =
        event.target;

      const bounds =
        map.getBounds();

      const west =
        bounds.getWest();

      const east =
        bounds.getEast();

      const north =
        bounds.getNorth();

      const south =
        bounds.getSouth();

      const lng =
        event.latlng.lng;

      const lat =
        event.latlng.lat;

      const xRatio =
        (lng - west) /
        (east - west);

      const yRatio =
        (north - lat) /
        (north - south);

      const x =
        Math.round(
          Math.max(
            0,
            Math.min(
              width - 1,
              xRatio * width
            )
          )
        );

      const y =
        Math.round(
          Math.max(
            0,
            Math.min(
              height - 1,
              yRatio * height
            )
          )
        );

      onInspect(
        x,
        y
      );
    },

    mousemove(event) {

      const map =
        event.target;

      const bounds =
        map.getBounds();

      const xRatio =
        (
          event.latlng.lng -
          bounds.getWest()
        ) /
        (
          bounds.getEast() -
          bounds.getWest()
        );

      const yRatio =
        (
          bounds.getNorth() -
          event.latlng.lat
        ) /
        (
          bounds.getNorth() -
          bounds.getSouth()
        );

      const x =
        Math.round(
          Math.max(
            0,
            Math.min(
              width - 1,
              xRatio * width
            )
          )
        );

      const y =
        Math.round(
          Math.max(
            0,
            Math.min(
              height - 1,
              yRatio * height
            )
          )
        );

      onHover({
        x,
        y,
      });
    },

  });

  return null;
}


/* ============================================================
   COMPONENTS
   ============================================================ */

function Pill({ text }) {

  return (

    <span className="
      rounded-full
      border border-white/10
      bg-white/[0.025]
      px-3 py-1.5
      text-[9px]
      text-slate-400
    ">

      {text}

    </span>
  );
}


function StatCard({
  icon,
  label,
  value,
  description,
}) {

  return (

    <div className="
      hover-lift
      rounded-2xl
      border border-white/10
      bg-white/[0.025]
      p-4
    ">

      <div className="
        mb-3 flex
        items-center
        justify-between
      ">

        <div className="
          rounded-lg
          bg-cyan-400/10
          p-2
          text-cyan-400
        ">
          {icon}
        </div>

      </div>


      <p className="
        text-[9px]
        uppercase
        tracking-wider
        text-slate-500
      ">
        {label}
      </p>


      <p className="
        mt-1
        text-lg
        font-bold
      ">
        {value}
      </p>


      <p className="
        mt-1
        text-[9px]
        text-slate-600
      ">
        {description}
      </p>

    </div>
  );
}


function EngineStep({
  number,
  title,
  status,
  active,
}) {

  return (

    <div className={`
      mb-2 flex
      items-center gap-3
      rounded-xl
      border
      p-3
      transition

      ${
        active
          ? "border-cyan-400/25 bg-cyan-400/[0.035]"
          : "border-white/5 bg-white/[0.015]"
      }
    `}>

      <div className="
        flex h-7 w-7
        shrink-0
        items-center
        justify-center
        rounded-lg
        border border-white/10
        text-[9px]
        text-cyan-300
      ">
        {number}
      </div>


      <div className="
        min-w-0 flex-1
      ">

        <p className="
          text-[10px]
          font-medium
        ">
          {title}
        </p>

        <p className="
          mt-0.5
          text-[8px]
          text-slate-600
        ">
          {status}
        </p>

      </div>


      <ChevronRight
        className="
          h-3.5 w-3.5
          text-slate-700
        "
      />

    </div>
  );
}


function LayerButton({
  active,
  onClick,
  label,
}) {

  return (

    <button
      onClick={onClick}
      className={`
        rounded-lg
        px-3 py-1.5
        text-[9px]
        transition

        ${
          active
            ? "bg-cyan-400 text-slate-950 font-bold"
            : "border border-white/10 text-slate-500 hover:text-white"
        }
      `}
    >

      {label}

    </button>
  );
}


function InspectionCard({
  label,
  value,
}) {

  return (

    <div className="
      rounded-xl
      border border-white/10
      bg-black/20
      p-3
    ">

      <p className="
        text-[8px]
        uppercase
        tracking-wider
        text-slate-600
      ">
        {label}
      </p>

      <p className="
        mt-2
        text-xs
        font-semibold
        text-slate-200
      ">
        {value}
      </p>

    </div>
  );
}


function InsightPanel({
  icon,
  title,
  subtitle,
  children,
}) {

  return (

    <div className="
      hover-lift
      rounded-2xl
      border border-white/10
      bg-white/[0.025]
      p-5
    ">

      <div className="
        mb-5 flex
        items-center gap-3
      ">

        <div className="
          rounded-xl
          bg-cyan-400/10
          p-2.5
          text-cyan-400
        ">
          {icon}
        </div>

        <div>

          <h3 className="
            text-sm
            font-semibold
          ">
            {title}
          </h3>

          <p className="
            mt-0.5
            text-[9px]
            text-slate-600
          ">
            {subtitle}
          </p>

        </div>

      </div>

      {children}

    </div>
  );
}


function MiniMetric({
  label,
  value,
}) {

  return (

    <div className="
      rounded-xl
      border border-white/10
      bg-black/20
      p-3
    ">

      <p className="
        text-[8px]
        text-slate-600
      ">
        {label}
      </p>

      <p className="
        mt-1
        text-sm
        font-bold
        text-cyan-300
      ">
        {value}
      </p>

    </div>
  );
}


function DataTile({
  label,
  value,
}) {

  return (

    <div className="
      rounded-xl
      border border-white/10
      bg-white/[0.02]
      p-4
    ">

      <p className="
        text-[8px]
        uppercase
        tracking-wider
        text-slate-600
      ">
        {label}
      </p>

      <p className="
        mt-2
        text-sm
        font-semibold
        text-slate-300
      ">
        {value}
      </p>

    </div>
  );
}


function DisasterCard({
  icon,
  title,
  description,
  status,
  active = false,
}) {

  return (

    <div className={`
      hover-lift
      rounded-2xl
      border
      p-5

      ${
        active
          ? "border-cyan-400/20 bg-cyan-400/[0.025]"
          : "border-white/10 bg-white/[0.02]"
      }
    `}>

      <div className="
        flex
        items-start
        justify-between
      ">

        <div className="
          rounded-xl
          bg-white/5
          p-2.5
          text-cyan-400
        ">
          {icon}
        </div>


        <span className="
          rounded-full
          border border-white/10
          px-2 py-1
          text-[8px]
          text-slate-500
        ">
          {status}
        </span>

      </div>


      <h3 className="
        mt-5
        text-sm
        font-semibold
      ">
        {title}
      </h3>


      <p className="
        mt-2
        text-[10px]
        leading-5
        text-slate-600
      ">
        {description}
      </p>

    </div>
  );
}


export default App;