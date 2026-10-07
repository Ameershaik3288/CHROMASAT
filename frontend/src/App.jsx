import { useState } from "react";
import axios from "axios";

import {
  Activity,
  AlertCircle,
  CheckCircle2,
  CloudUpload,
  Droplets,
  Flame,
  Loader2,
  Map,
  Satellite,
  ShieldCheck,
  Upload,
  Waves,
  Zap,
} from "lucide-react";

const API_BASE_URL = "http://127.0.0.1:8000";

function App() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    const isGeoTiff =
      file.name.toLowerCase().endsWith(".tif") ||
      file.name.toLowerCase().endsWith(".tiff");

    if (!isGeoTiff) {
      setSelectedFile(null);
      setAnalysis(null);
      setError("Please select a GeoTIFF (.tif or .tiff) file.");
      return;
    }

    setSelectedFile(file);
    setAnalysis(null);
    setError("");
  };

  const handleAnalyze = async () => {
    if (!selectedFile) {
      setError("Please select a satellite image first.");
      return;
    }

    setLoading(true);
    setError("");
    setAnalysis(null);

    try {
      const formData = new FormData();

      formData.append("file", selectedFile);

      const response = await axios.post(
        `${API_BASE_URL}/api/analyze`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );

      setAnalysis(response.data.result);
    } catch (err) {
      console.error("CHROMASAT analysis error:", err);

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
    setError("");

    const input = document.getElementById("satellite-file");

    if (input) {
      input.value = "";
    }
  };

  return (
    <div className="min-h-screen bg-[#05080d] text-white">
      {/* ------------------------------------------------ */}
      {/* HEADER */}
      {/* ------------------------------------------------ */}

      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#05080d]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">

          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-400/10 ring-1 ring-cyan-400/20">
              <Satellite className="h-6 w-6 text-cyan-400" />
            </div>

            <div>
              <h1 className="text-lg font-bold tracking-wide">
                CHROMASAT <span className="text-cyan-400">AI</span>
              </h1>

              <p className="text-xs text-slate-500">
                Satellite Intelligence & Quick Disaster Management
              </p>
            </div>
          </div>

          <div className="hidden items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/5 px-4 py-2 text-xs text-emerald-400 sm:flex">
            <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.8)]" />
            SYSTEM ONLINE
          </div>

        </div>
      </header>


      {/* ------------------------------------------------ */}
      {/* MAIN */}
      {/* ------------------------------------------------ */}

      <main className="mx-auto max-w-7xl px-6 py-8">

        {/* HERO */}

        <section className="mb-8">

          <div className="max-w-3xl">

            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-cyan-400/10 bg-cyan-400/5 px-3 py-1 text-xs text-cyan-300">
              <Activity className="h-3.5 w-3.5" />
              Earth Observation Intelligence
            </div>

            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Turn satellite imagery into
              <span className="text-cyan-400"> actionable intelligence.</span>
            </h2>

            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
              Upload compatible satellite imagery to generate spectral
              intelligence, vegetation indicators, water indicators and
              decision-support insights.
            </p>

          </div>

        </section>


        {/* ------------------------------------------------ */}
        {/* LIVE STATS */}
        {/* ------------------------------------------------ */}

        <section className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">

          <StatCard
            icon={<Map className="h-5 w-5" />}
            label="Study Coverage"
            value={analysis ? "10 km test zone" : "309.31 km²"}
            description={
              analysis
                ? `${analysis.image.width} × ${analysis.image.height} pixels`
                : "Nandyal study region"
            }
          />

          <StatCard
            icon={<Droplets className="h-5 w-5" />}
            label="NDWI Mean"
            value={
              analysis
                ? analysis.water.ndwi_mean.toFixed(3)
                : "—"
            }
            description={
              analysis
                ? "Current uploaded scene"
                : "Upload imagery to calculate"
            }
          />

          <StatCard
            icon={<Activity className="h-5 w-5" />}
            label="NDVI Mean"
            value={
              analysis
                ? analysis.vegetation.ndvi_mean.toFixed(3)
                : "—"
            }
            description={
              analysis
                ? "Current uploaded scene"
                : "Upload imagery to calculate"
            }
          />

          <StatCard
            icon={<ShieldCheck className="h-5 w-5" />}
            label="Model Accuracy"
            value="70.54%"
            description="Nandyal spatial test"
          />

        </section>


        {/* ------------------------------------------------ */}
        {/* SATELLITE ANALYSIS */}
        {/* ------------------------------------------------ */}

        <section className="mb-8">

          <div className="mb-4 flex items-end justify-between">

            <div>
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-cyan-400">
                Core Intelligence
              </p>

              <h2 className="mt-1 text-xl font-semibold">
                Satellite Analysis
              </h2>
            </div>

            {analysis && (
              <button
                onClick={resetAnalysis}
                className="text-xs text-slate-500 transition hover:text-white"
              >
                New analysis
              </button>
            )}

          </div>


          <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">

            {/* UPLOAD CARD */}

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">

              <div className="mb-6 flex items-center gap-3">

                <div className="rounded-xl bg-cyan-400/10 p-3">
                  <CloudUpload className="h-6 w-6 text-cyan-400" />
                </div>

                <div>
                  <h3 className="font-semibold">
                    Upload Satellite Image
                  </h3>

                  <p className="text-xs text-slate-500">
                    Sentinel-2 compatible GeoTIFF
                  </p>
                </div>

              </div>


              <label
                htmlFor="satellite-file"
                className="group flex min-h-64 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-white/15 bg-black/20 p-6 text-center transition hover:border-cyan-400/40 hover:bg-cyan-400/[0.03]"
              >

                <div className="mb-4 rounded-2xl bg-cyan-400/10 p-4 transition group-hover:scale-105">
                  <Upload className="h-8 w-8 text-cyan-400" />
                </div>

                {selectedFile ? (
                  <>
                    <p className="max-w-full truncate font-medium text-white">
                      {selectedFile.name}
                    </p>

                    <p className="mt-2 text-xs text-emerald-400">
                      Image selected successfully
                    </p>
                  </>
                ) : (
                  <>
                    <p className="font-medium text-white">
                      Choose satellite image
                    </p>

                    <p className="mt-2 text-xs text-slate-500">
                      Drag & drop or click to browse
                    </p>
                  </>
                )}

                <p className="mt-4 rounded-full border border-white/10 px-3 py-1 text-[10px] uppercase tracking-wider text-slate-500">
                  .TIF / .TIFF
                </p>

                <input
                  id="satellite-file"
                  type="file"
                  accept=".tif,.tiff"
                  className="hidden"
                  onChange={handleFileChange}
                />

              </label>


              {/* SELECTED FILE */}

              {selectedFile && (
                <div className="mt-4 flex items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">

                  <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" />

                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-white">
                      {selectedFile.name}
                    </p>

                    <p className="text-xs text-slate-500">
                      {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>

                </div>
              )}


              {/* ERROR */}

              {error && (
                <div className="mt-4 flex gap-3 rounded-xl border border-red-500/20 bg-red-500/5 p-3 text-sm text-red-300">

                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />

                  <p>{error}</p>

                </div>
              )}


              {/* ANALYZE */}

              <button
                onClick={handleAnalyze}
                disabled={!selectedFile || loading}
                className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-400 px-5 py-3 font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-40"
              >

                {loading ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Analyzing satellite data...
                  </>
                ) : (
                  <>
                    <Activity className="h-5 w-5" />
                    Analyze Satellite Image
                  </>
                )}

              </button>


              <div className="mt-4 text-center text-[11px] text-slate-600">
                B2 · B3 · B4 · B8 · B11 · B12
              </div>

            </div>


            {/* RESULTS CARD */}

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">

              {!analysis ? (
                <EmptyAnalysisState />
              ) : (
                <AnalysisResults analysis={analysis} />
              )}

            </div>

          </div>

        </section>


        {/* ------------------------------------------------ */}
        {/* DISASTER CENTER */}
        {/* ------------------------------------------------ */}

        <section className="mb-8">

          <div className="mb-4">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-orange-400">
              Decision Support
            </p>

            <h2 className="mt-1 text-xl font-semibold">
              Quick Disaster Management
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Disaster workflows will activate when compatible satellite
              evidence is available.
            </p>
          </div>


          <div className="grid gap-4 md:grid-cols-3">

            <DisasterCard
              icon={<Waves className="h-6 w-6" />}
              title="Flood"
              description="Water extent and potential inundation assessment."
              status="Ready for optical NDWI"
            />

            <DisasterCard
              icon={<Flame className="h-6 w-6" />}
              title="Fire"
              description="Fire assessment using suitable spectral evidence."
              status="Requires suitable thermal data"
            />

            <DisasterCard
              icon={<Zap className="h-6 w-6" />}
              title="Earthquake"
              description="Before/after change detection for affected areas."
              status="Requires before/after imagery"
            />

          </div>

        </section>


        {/* ------------------------------------------------ */}
        {/* SAFETY NOTICE */}
        {/* ------------------------------------------------ */}

        <section className="rounded-2xl border border-amber-500/15 bg-amber-500/[0.03] p-5">

          <div className="flex gap-3">

            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />

            <div>

              <h3 className="text-sm font-semibold text-amber-300">
                Decision-support notice
              </h3>

              <p className="mt-1 text-xs leading-5 text-slate-500">
                CHROMASAT provides preliminary satellite-derived analysis.
                Results should support, not replace, field verification,
                official alerts and expert decision-making.
              </p>

            </div>

          </div>

        </section>

      </main>

    </div>
  );
}


/* ====================================================== */
/* STAT CARD */
/* ====================================================== */

function StatCard({ icon, label, value, description }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">

      <div className="mb-4 flex items-center justify-between">

        <div className="rounded-xl bg-white/5 p-2.5 text-cyan-400">
          {icon}
        </div>

      </div>

      <p className="text-xs uppercase tracking-wider text-slate-500">
        {label}
      </p>

      <p className="mt-2 text-2xl font-bold text-white">
        {value}
      </p>

      <p className="mt-1 text-xs text-slate-600">
        {description}
      </p>

    </div>
  );
}


/* ====================================================== */
/* EMPTY ANALYSIS */
/* ====================================================== */

function EmptyAnalysisState() {
  return (
    <div className="flex min-h-64 flex-col items-center justify-center text-center">

      <div className="mb-5 rounded-2xl bg-white/5 p-5">
        <Satellite className="h-10 w-10 text-slate-600" />
      </div>

      <h3 className="font-semibold text-slate-300">
        Awaiting satellite imagery
      </h3>

      <p className="mt-2 max-w-sm text-xs leading-5 text-slate-600">
        Upload a compatible Sentinel-2 GeoTIFF to generate RGB,
        vegetation and water intelligence.
      </p>

    </div>
  );
}


/* ====================================================== */
/* ANALYSIS RESULTS */
/* ====================================================== */

function AnalysisResults({ analysis }) {
  return (
    <div>

      <div className="mb-5 flex items-center justify-between">

        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-emerald-400">
            Analysis complete
          </p>

          <h3 className="mt-1 font-semibold">
            Satellite Intelligence
          </h3>
        </div>

        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-400/10">
          <CheckCircle2 className="h-5 w-5 text-emerald-400" />
        </div>

      </div>


      {/* IMAGE */}

      <div className="overflow-hidden rounded-xl border border-white/10 bg-black">

        <img
          src={analysis.rgb_preview}
          alt="CHROMASAT satellite RGB preview"
          className="block h-auto max-h-80 w-full object-cover"
        />

      </div>


      {/* METRICS */}

      <div className="mt-5 grid grid-cols-2 gap-3">

        <Metric
          label="NDVI Mean"
          value={analysis.vegetation.ndvi_mean}
          suffix=""
          description="Vegetation signal"
        />

        <Metric
          label="NDWI Mean"
          value={analysis.water.ndwi_mean}
          suffix=""
          description="Water signal"
        />

        <Metric
          label="Resolution"
          value={`${analysis.image.width} × ${analysis.image.height}`}
          description="Raster dimensions"
        />

        <Metric
          label="Bands"
          value={analysis.image.bands}
          description="Input spectral bands"
        />

      </div>


      {/* IMAGE INFO */}

      <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-4">

        <div className="flex items-center justify-between text-xs">

          <span className="text-slate-500">
            Coordinate reference
          </span>

          <span className="font-medium text-slate-300">
            {analysis.image.crs}
          </span>

        </div>

        <div className="mt-3 flex items-center justify-between text-xs">

          <span className="text-slate-500">
            Processing status
          </span>

          <span className="font-medium text-emerald-400">
            {analysis.status}
          </span>

        </div>

      </div>

    </div>
  );
}


/* ====================================================== */
/* METRIC */
/* ====================================================== */

function Metric({ label, value, description }) {
  const displayValue =
    typeof value === "number"
      ? value.toFixed(3)
      : value;

  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-4">

      <p className="text-[10px] uppercase tracking-wider text-slate-600">
        {label}
      </p>

      <p className="mt-2 text-lg font-bold text-white">
        {displayValue}
      </p>

      <p className="mt-1 text-[10px] text-slate-600">
        {description}
      </p>

    </div>
  );
}


/* ====================================================== */
/* DISASTER CARD */
/* ====================================================== */

function DisasterCard({
  icon,
  title,
  description,
  status,
}) {
  return (
    <div className="group rounded-2xl border border-white/10 bg-white/[0.03] p-5 transition hover:border-white/20 hover:bg-white/[0.05]">

      <div className="mb-5 flex items-center justify-between">

        <div className="rounded-xl bg-orange-400/10 p-3 text-orange-400">
          {icon}
        </div>

        <span className="rounded-full border border-white/10 px-2.5 py-1 text-[10px] text-slate-500">
          {status}
        </span>

      </div>

      <h3 className="font-semibold">
        {title}
      </h3>

      <p className="mt-2 text-xs leading-5 text-slate-500">
        {description}
      </p>

    </div>
  );
}


export default App;