import React, { useMemo, useRef, useState } from "react";

const API_BASE = "http://127.0.0.1:8000";

/*
|--------------------------------------------------------------------------
| IMPORTANT BACKEND CONFIGURATION
|--------------------------------------------------------------------------
| Your FastAPI Swagger currently exposes:
|
| POST /api/analyze
| POST /api/landcover
|
| It does NOT expose:
| POST /api/disaster/flood
| POST /api/fire
|
| Therefore this component uses /api/analyze for the uploaded GeoTIFF.
|--------------------------------------------------------------------------
*/

const ANALYZE_ENDPOINT = `${API_BASE}/api/analyze`;

const DISASTERS = [
  {
    id: "all",
    icon: "🌐",
    title: "All Intelligence",
    description: "Run satellite analysis for available intelligence layers.",
    available: true,
  },
  {
    id: "flood",
    icon: "🌊",
    title: "Flood / Water",
    description: "Water extent, confidence and risk evidence.",
    available: true,
  },
  {
    id: "fire",
    icon: "🔥",
    title: "Fire Intelligence",
    description: "Potential burn/fire spectral evidence.",
    available: true,
  },
  {
    id: "storm",
    icon: "🌪️",
    title: "Storm Intelligence",
    description: "Region-level severe weather assessment.",
    available: false,
  },
  {
    id: "ground",
    icon: "🌍",
    title: "Ground Risk",
    description: "Ground and terrain-related disaster assessment.",
    available: false,
  },
];

const formatNumber = (value) => {
  if (value === undefined || value === null || value === "") {
    return "--";
  }

  const number = Number(value);

  if (Number.isNaN(number)) {
    return String(value);
  }

  return number.toLocaleString("en-IN");
};

const formatPercent = (value) => {
  if (value === undefined || value === null || value === "") {
    return "--";
  }

  const number = Number(value);

  if (Number.isNaN(number)) {
    return String(value);
  }

  return `${number.toFixed(2)}%`;
};

const formatDecimal = (value, digits = 4) => {
  if (value === undefined || value === null || value === "") {
    return "--";
  }

  const number = Number(value);

  if (Number.isNaN(number)) {
    return String(value);
  }

  return number.toFixed(digits);
};

function MetricCard({
  label,
  value,
  sub,
  danger = false,
}) {
  return (
    <div
      className={`disaster-metric ${
        danger ? "danger" : ""
      }`}
    >
      <div className="metric-label">{label}</div>

      <div className="metric-value">
        {value}
      </div>

      {sub && (
        <div className="metric-sub">
          {sub}
        </div>
      )}
    </div>
  );
}

/*
|--------------------------------------------------------------------------
| Helper functions
|--------------------------------------------------------------------------
*/

function getNestedObject(data) {
  if (!data || typeof data !== "object") {
    return {};
  }

  if (
    data.result &&
    typeof data.result === "object"
  ) {
    return data.result;
  }

  if (
    data.data &&
    typeof data.data === "object"
  ) {
    return data.data;
  }

  return data;
}

function findValue(object, keys, fallback = null) {
  if (
    !object ||
    typeof object !== "object"
  ) {
    return fallback;
  }

  for (const key of keys) {
    if (
      object[key] !== undefined &&
      object[key] !== null
    ) {
      return object[key];
    }
  }

  return fallback;
}

function findObject(object, keys) {
  if (
    !object ||
    typeof object !== "object"
  ) {
    return {};
  }

  for (const key of keys) {
    if (
      object[key] &&
      typeof object[key] === "object"
    ) {
      return object[key];
    }
  }

  return {};
}

/*
|--------------------------------------------------------------------------
| Dashboard
|--------------------------------------------------------------------------
*/

function DisasterDashboard({
  onBack = () => {},
}) {
  const inputRef = useRef(null);

  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  const [selectedDisaster, setSelectedDisaster] =
    useState("all");

  const [activeMap, setActiveMap] =
    useState("risk");

  const selected = useMemo(
    () =>
      DISASTERS.find(
        (item) =>
          item.id === selectedDisaster
      ) || DISASTERS[0],
    [selectedDisaster]
  );

  /*
  |--------------------------------------------------------------------------
  | File selection
  |--------------------------------------------------------------------------
  */

  const chooseFile = (event) => {
    const selectedFile =
      event.target.files?.[0];

    if (!selectedFile) {
      return;
    }

    const lower =
      selectedFile.name.toLowerCase();

    if (
      !lower.endsWith(".tif") &&
      !lower.endsWith(".tiff")
    ) {
      setError(
        "Please upload a GeoTIFF file (.tif or .tiff)."
      );

      setFile(null);
      setResult(null);

      return;
    }

    setFile(selectedFile);
    setResult(null);
    setError("");
    setActiveMap("risk");
  };

  /*
  |--------------------------------------------------------------------------
  | API response normalization
  |--------------------------------------------------------------------------
  */

  const normalizeResult = (apiResponse) => {
    const raw =
      getNestedObject(apiResponse);

    const outputs = findObject(raw, [
      "outputs",
      "output",
      "files",
      "results",
    ]);

    const image = findObject(raw, [
      "image",
      "metadata",
      "image_info",
      "scene",
    ]);

    const water = findObject(raw, [
      "water_intelligence",
      "water",
      "water_analysis",
      "water_result",
    ]);

    const disasterRisk = findObject(raw, [
      "disaster_risk",
      "risk",
      "flood_risk",
      "risk_analysis",
    ]);

    const fire = findObject(raw, [
      "fire_intelligence",
      "fire",
      "fire_analysis",
      "fire_result",
    ]);

    const indices = findObject(raw, [
      "indices",
      "spectral_indices",
      "spectral",
    ]);

    const interpretation =
      findObject(raw, [
        "interpretation",
        "analysis",
        "summary",
      ]);

    return {
      ...raw,

      image: {
        ...image,

        crs: findValue(
          image,
          [
            "crs",
            "coordinate_reference_system",
            "projection",
          ],
          findValue(
            raw,
            ["crs"],
            null
          )
        ),

        width: findValue(
          image,
          ["width", "image_width"],
          null
        ),

        height: findValue(
          image,
          ["height", "image_height"],
          null
        ),

        bands: findValue(
          image,
          [
            "bands",
            "band_count",
            "num_bands",
          ],
          null
        ),
      },

      outputs: {
        ...outputs,

        rgb_preview: findValue(
          outputs,
          [
            "rgb_preview",
            "satellite_rgb",
            "rgb",
            "rgb_image",
            "preview",
          ],
          findValue(
            raw,
            [
              "rgb_preview",
              "satellite_rgb",
            ],
            null
          )
        ),

        water_preview: findValue(
          outputs,
          [
            "water_preview",
            "water",
            "water_map",
            "water_image",
          ],
          findValue(
            raw,
            [
              "water_preview",
              "water_map",
            ],
            null
          )
        ),

        risk_preview: findValue(
          outputs,
          [
            "risk_preview",
            "risk_map",
            "disaster_risk_preview",
            "flood_risk_preview",
          ],
          findValue(
            raw,
            [
              "risk_preview",
              "risk_map",
            ],
            null
          )
        ),

        confidence_preview:
          findValue(
            outputs,
            [
              "confidence_preview",
              "confidence_map",
              "confidence",
            ],
            findValue(
              raw,
              [
                "confidence_preview",
                "confidence_map",
              ],
              null
            )
          ),

        fire_preview: findValue(
          outputs,
          [
            "fire_preview",
            "fire_map",
            "burn_preview",
            "fire_image",
          ],
          findValue(
            raw,
            [
              "fire_preview",
              "fire_map",
            ],
            null
          )
        ),
      },

      water_intelligence: {
        ...water,

        water_percentage:
          findValue(
            water,
            [
              "water_percentage",
              "water_percent",
              "percentage",
            ],
            findValue(
              raw,
              ["water_percentage"],
              null
            )
          ),

        water_pixels:
          findValue(
            water,
            [
              "water_pixels",
              "pixels",
            ],
            findValue(
              raw,
              ["water_pixels"],
              null
            )
          ),

        water_confidence_mean:
          findValue(
            water,
            [
              "water_confidence_mean",
              "mean_confidence",
              "confidence",
            ],
            null
          ),

        ndwi_mean:
          findValue(
            water,
            [
              "ndwi_mean",
              "mean_ndwi",
              "ndwi",
            ],
            null
          ),

        mndwi_mean:
          findValue(
            water,
            [
              "mndwi_mean",
              "mean_mndwi",
              "mndwi",
            ],
            null
          ),
      },

      disaster_risk: {
        ...disasterRisk,

        high_risk_percentage:
          findValue(
            disasterRisk,
            [
              "high_risk_percentage",
              "high_percentage",
            ],
            null
          ),

        high_risk_pixels:
          findValue(
            disasterRisk,
            [
              "high_risk_pixels",
              "high_pixels",
            ],
            null
          ),

        moderate_risk_percentage:
          findValue(
            disasterRisk,
            [
              "moderate_risk_percentage",
              "medium_risk_percentage",
              "moderate_percentage",
            ],
            null
          ),

        moderate_risk_pixels:
          findValue(
            disasterRisk,
            [
              "moderate_risk_pixels",
              "medium_risk_pixels",
              "moderate_pixels",
            ],
            null
          ),

        safe_percentage:
          findValue(
            disasterRisk,
            [
              "safe_percentage",
              "low_risk_percentage",
              "safe_percent",
            ],
            null
          ),

        safe_pixels:
          findValue(
            disasterRisk,
            [
              "safe_pixels",
              "low_risk_pixels",
              "safe_area_pixels",
            ],
            null
          ),

        low_risk_percentage:
          findValue(
            disasterRisk,
            [
              "low_risk_percentage",
              "safe_percentage",
            ],
            null
          ),
      },

      fire_intelligence: {
        ...fire,

        potential_fire_percentage:
          findValue(
            fire,
            [
              "potential_fire_percentage",
              "fire_percentage",
              "burned_percentage",
            ],
            null
          ),

        potential_fire_pixels:
          findValue(
            fire,
            [
              "potential_fire_pixels",
              "fire_pixels",
              "burned_pixels",
            ],
            null
          ),

        mean_fire_score:
          findValue(
            fire,
            [
              "mean_fire_score",
              "fire_score",
              "score",
            ],
            null
          ),

        mean_confidence:
          findValue(
            fire,
            [
              "mean_confidence",
              "confidence",
            ],
            null
          ),
      },

      indices: {
        ...indices,

        nbr_mean:
          findValue(
            indices,
            [
              "nbr_mean",
              "mean_nbr",
              "nbr",
            ],
            null
          ),

        ndvi_mean:
          findValue(
            indices,
            [
              "ndvi_mean",
              "mean_ndvi",
              "ndvi",
            ],
            null
          ),

        ndwi_mean:
          findValue(
            indices,
            [
              "ndwi_mean",
              "mean_ndwi",
              "ndwi",
            ],
            null
          ),
      },

      interpretation: {
        ...interpretation,

        warning:
          findValue(
            interpretation,
            [
              "warning",
              "message",
              "note",
            ],
            null
          ),

        thermal_band_available:
          findValue(
            interpretation,
            [
              "thermal_band_available",
              "thermal_available",
            ],
            false
          ),
      },
    };
  };

  /*
  |--------------------------------------------------------------------------
  | Run analysis
  |--------------------------------------------------------------------------
  */

  const runAnalysis = async () => {
    if (!file) {
      setError(
        "Upload a GeoTIFF satellite image first."
      );
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);
    setActiveMap("risk");

    try {
      const formData = new FormData();

      formData.append(
        "file",
        file
      );

      /*
       * IMPORTANT:
       *
       * Do NOT call:
       * /api/disaster/flood
       * /api/fire
       *
       * Those routes are not present in your FastAPI Swagger.
       *
       * Your backend exposes /api/analyze.
       */

      const response =
        await fetch(
          ANALYZE_ENDPOINT,
          {
            method: "POST",
            body: formData,
          }
        );

      let data = null;

      try {
        data =
          await response.json();
      } catch {
        throw new Error(
          `Backend returned an invalid JSON response. HTTP ${response.status}`
        );
      }

      if (!response.ok) {
        throw new Error(
          data?.detail ||
            data?.message ||
            `Analysis failed with HTTP ${response.status}`
        );
      }

      /*
       * Some FastAPI APIs return:
       *
       * {
       *   success: true,
       *   result: {...}
       * }
       *
       * Others return the result directly.
       *
       * This code supports both.
       */

      const normalized =
        normalizeResult(data);

      setResult(normalized);
      setActiveMap("risk");

    } catch (err) {
      console.error(
        "DISASTER ANALYSIS ERROR:",
        err
      );

      setError(
        err?.message ||
          "Unable to connect to the CHROMASAT analysis engine."
      );

    } finally {
      setLoading(false);
    }
  };

  /*
  |--------------------------------------------------------------------------
  | Output URL
  |--------------------------------------------------------------------------
  */

  const getOutputUrl = (path) => {
    if (!path) {
      return "";
    }

    if (
      typeof path !== "string"
    ) {
      return "";
    }

    if (
      path.startsWith(
        "http://"
      ) ||
      path.startsWith(
        "https://"
      )
    ) {
      return path;
    }

    if (
      path.startsWith("/")
    ) {
      return `${API_BASE}${path}`;
    }

    return `${API_BASE}/${path}`;
  };

  /*
  |--------------------------------------------------------------------------
  | Map selection
  |--------------------------------------------------------------------------
  */

  const getMapUrl = () => {
    if (!result) {
      return "";
    }

    const outputs =
      result.outputs || {};

    if (
      selectedDisaster ===
        "fire" &&
      activeMap === "fire"
    ) {
      return getOutputUrl(
        outputs.fire_preview
      );
    }

    if (
      selectedDisaster !==
        "fire" &&
      activeMap === "water"
    ) {
      return getOutputUrl(
        outputs.water_preview
      );
    }

    if (
      activeMap ===
      "confidence"
    ) {
      return getOutputUrl(
        outputs.confidence_preview
      );
    }

    if (
      activeMap === "risk"
    ) {
      return getOutputUrl(
        outputs.risk_preview
      );
    }

    return getOutputUrl(
      outputs.rgb_preview
    );
  };

  /*
  |--------------------------------------------------------------------------
  | Render Flood / Water Results
  |--------------------------------------------------------------------------
  */

  const renderFloodResults =
    () => {
      const water =
        result?.water_intelligence ||
        {};

      const risk =
        result?.disaster_risk ||
        {};

      return (
        <>
          <div className="section-heading">
            <div>
              <span className="eyebrow">
                03 / AI INTELLIGENCE
              </span>

              <h2>
                Flood & Water Intelligence
              </h2>

              <p>
                Satellite-based water
                detection and regional
                flood-risk evidence.
              </p>
            </div>

            <div className="analysis-status">
              <span className="status-dot" />
              ANALYSIS COMPLETE
            </div>
          </div>

          <div className="metrics-grid">
            <MetricCard
              label="Water detected"
              value={formatPercent(
                water.water_percentage
              )}
              sub={`${formatNumber(
                water.water_pixels
              )} pixels`}
            />

            <MetricCard
              label="Water confidence"
              value={formatDecimal(
                water.water_confidence_mean,
                2
              )}
              sub="model confidence indicator"
            />

            <MetricCard
              label="High risk"
              value={formatPercent(
                risk.high_risk_percentage
              )}
              sub={`${formatNumber(
                risk.high_risk_pixels
              )} pixels`}
              danger
            />

            <MetricCard
              label="Moderate risk"
              value={formatPercent(
                risk.moderate_risk_percentage
              )}
              sub={`${formatNumber(
                risk.moderate_risk_pixels
              )} pixels`}
            />

            <MetricCard
              label="Safe area"
              value={formatPercent(
                risk.safe_percentage
              )}
              sub={`${formatNumber(
                risk.safe_pixels
              )} pixels`}
            />
          </div>

          <div className="map-card">
            <div className="map-toolbar">
              <div>
                <span className="eyebrow">
                  04 / DISASTER MAP
                </span>

                <h3>
                  Flood Intelligence Map
                </h3>
              </div>

              <div className="map-buttons">
                <button
                  className={
                    activeMap === "risk"
                      ? "active"
                      : ""
                  }
                  onClick={() =>
                    setActiveMap("risk")
                  }
                >
                  Risk Map
                </button>

                <button
                  className={
                    activeMap === "water"
                      ? "active"
                      : ""
                  }
                  onClick={() =>
                    setActiveMap("water")
                  }
                >
                  Water Map
                </button>

                <button
                  className={
                    activeMap ===
                    "confidence"
                      ? "active"
                      : ""
                  }
                  onClick={() =>
                    setActiveMap(
                      "confidence"
                    )
                  }
                >
                  Confidence
                </button>
              </div>
            </div>

            <div className="map-view">
              {getMapUrl() ? (
                <img
                  key={getMapUrl()}
                  src={getMapUrl()}
                  alt="Flood intelligence map"
                  onError={(event) => {
                    event.currentTarget.style.display =
                      "none";
                  }}
                />
              ) : (
                <div className="map-placeholder">
                  <span>
                    🌊
                  </span>

                  <p>
                    Map preview unavailable
                  </p>
                </div>
              )}

              <div className="map-overlay">
                <strong>
                  {file?.name}
                </strong>

                <span>
                  {result?.image
                    ?.crs ||
                    "Sentinel-2 multispectral scene"}
                </span>
              </div>
            </div>
          </div>

          <div className="risk-grid">
            <div className="risk-card high">
              <span>
                HIGH RISK
              </span>

              <strong>
                {formatPercent(
                  risk.high_risk_percentage
                )}
              </strong>

              <p>
                Areas requiring
                immediate attention.
              </p>
            </div>

            <div className="risk-card moderate">
              <span>
                MODERATE RISK
              </span>

              <strong>
                {formatPercent(
                  risk.moderate_risk_percentage
                )}
              </strong>

              <p>
                Areas that should
                be monitored.
              </p>
            </div>

            <div className="risk-card safe">
              <span>
                SAFE / LOW RISK
              </span>

              <strong>
                {formatPercent(
                  risk.safe_percentage
                )}
              </strong>

              <p>
                Lower-risk areas
                identified by the
                analysis.
              </p>
            </div>
          </div>

          <div className="evidence-card">
            <span className="eyebrow">
              05 / SCIENTIFIC EVIDENCE
            </span>

            <h3>
              Water Indicators
            </h3>

            <div className="indicator-row">
              <div>
                <span>
                  NDWI
                </span>

                <strong>
                  {formatDecimal(
                    water.ndwi_mean,
                    4
                  )}
                </strong>
              </div>

              <div>
                <span>
                  MNDWI
                </span>

                <strong>
                  {formatDecimal(
                    water.mndwi_mean,
                    4
                  )}
                </strong>
              </div>

              <div>
                <span>
                  Water Pixels
                </span>

                <strong>
                  {formatNumber(
                    water.water_pixels
                  )}
                </strong>
              </div>

              <div>
                <span>
                  Safe Pixels
                </span>

                <strong>
                  {formatNumber(
                    risk.safe_pixels
                  )}
                </strong>
              </div>
            </div>

            <p className="simple-note">
              NDWI and MNDWI provide
              supporting spectral evidence
              for distinguishing water from
              surrounding land.
            </p>
          </div>
        </>
      );
    };

  /*
  |--------------------------------------------------------------------------
  | Render Fire Results
  |--------------------------------------------------------------------------
  */

  const renderFireResults =
    () => {
      const fire =
        result?.fire_intelligence ||
        {};

      const risk =
        result?.disaster_risk ||
        {};

      const interpretation =
        result?.interpretation ||
        {};

      return (
        <>
          <div className="section-heading">
            <div>
              <span className="eyebrow">
                03 / AI INTELLIGENCE
              </span>

              <h2>
                Fire & Burn Intelligence
              </h2>

              <p>
                Spectral assessment of
                potential fire or
                burned-area evidence.
              </p>
            </div>

            <div className="analysis-status">
              <span className="status-dot" />
              ANALYSIS COMPLETE
            </div>
          </div>

          <div className="metrics-grid">
            <MetricCard
              label="Potential fire area"
              value={formatPercent(
                fire.potential_fire_percentage
              )}
              sub={`${formatNumber(
                fire.potential_fire_pixels
              )} pixels`}
            />

            <MetricCard
              label="Fire score"
              value={formatDecimal(
                fire.mean_fire_score,
                2
              )}
              sub="spectral evidence score"
            />

            <MetricCard
              label="Confidence"
              value={formatDecimal(
                fire.mean_confidence,
                2
              )}
              sub="model confidence indicator"
            />

            <MetricCard
              label="High risk"
              value={formatPercent(
                risk.high_risk_percentage
              )}
              sub={`${formatNumber(
                risk.high_risk_pixels
              )} pixels`}
              danger
            />

            <MetricCard
              label="Moderate risk"
              value={formatPercent(
                risk.moderate_risk_percentage
              )}
              sub={`${formatNumber(
                risk.moderate_risk_pixels
              )} pixels`}
            />
          </div>

          <div className="map-card">
            <div className="map-toolbar">
              <div>
                <span className="eyebrow">
                  04 / DISASTER MAP
                </span>

                <h3>
                  Fire Intelligence Map
                </h3>
              </div>

              <div className="map-buttons">
                <button
                  className={
                    activeMap === "risk"
                      ? "active"
                      : ""
                  }
                  onClick={() =>
                    setActiveMap("risk")
                  }
                >
                  Risk Map
                </button>

                <button
                  className={
                    activeMap === "fire"
                      ? "active"
                      : ""
                  }
                  onClick={() =>
                    setActiveMap("fire")
                  }
                >
                  Fire Evidence
                </button>

                <button
                  className={
                    activeMap ===
                    "confidence"
                      ? "active"
                      : ""
                  }
                  onClick={() =>
                    setActiveMap(
                      "confidence"
                    )
                  }
                >
                  Confidence
                </button>
              </div>
            </div>

            <div className="map-view">
              {getMapUrl() ? (
                <img
                  key={getMapUrl()}
                  src={getMapUrl()}
                  alt="Fire intelligence map"
                  onError={(event) => {
                    event.currentTarget.style.display =
                      "none";
                  }}
                />
              ) : (
                <div className="map-placeholder">
                  <span>
                    🔥
                  </span>

                  <p>
                    Fire evidence map
                    unavailable
                  </p>
                </div>
              )}

              <div className="map-overlay">
                <strong>
                  {file?.name}
                </strong>

                <span>
                  {result?.image
                    ?.crs ||
                    "Sentinel-2 multispectral scene"}
                </span>
              </div>
            </div>
          </div>

          <div className="risk-grid">
            <div className="risk-card high">
              <span>
                HIGH RISK
              </span>

              <strong>
                {formatPercent(
                  risk.high_risk_percentage
                )}
              </strong>

              <p>
                Potential areas
                requiring attention.
              </p>
            </div>

            <div className="risk-card moderate">
              <span>
                MODERATE RISK
              </span>

              <strong>
                {formatPercent(
                  risk.moderate_risk_percentage
                )}
              </strong>

              <p>
                Areas showing
                moderate spectral
                evidence.
              </p>
            </div>

            <div className="risk-card safe">
              <span>
                LOW RISK
              </span>

              <strong>
                {formatPercent(
                  risk.low_risk_percentage
                )}
              </strong>

              <p>
                Lower-risk areas
                in this analysis.
              </p>
            </div>
          </div>

          <div className="evidence-card">
            <span className="eyebrow">
              05 / SCIENTIFIC EVIDENCE
            </span>

            <h3>
              Satellite Indicators
            </h3>

            <div className="indicator-row">
              <div>
                <span>
                  NBR
                </span>

                <strong>
                  {formatDecimal(
                    result?.indices
                      ?.nbr_mean,
                    4
                  )}
                </strong>
              </div>

              <div>
                <span>
                  NDVI
                </span>

                <strong>
                  {formatDecimal(
                    result?.indices
                      ?.ndvi_mean,
                    4
                  )}
                </strong>
              </div>

              <div>
                <span>
                  NDWI
                </span>

                <strong>
                  {formatDecimal(
                    result?.indices
                      ?.ndwi_mean,
                    4
                  )}
                </strong>
              </div>

              <div>
                <span>
                  Thermal Band
                </span>

                <strong>
                  {interpretation
                    .thermal_band_available
                    ? "Available"
                    : "Not available"}
                </strong>
              </div>
            </div>

            <div className="warning-box">
              ⚠️{" "}
              {interpretation.warning ||
                "Results indicate potential fire/burn-related spectral evidence and should not be treated as confirmed active-fire temperature detection."}
            </div>
          </div>
        </>
      );
    };

  /*
  |--------------------------------------------------------------------------
  | Generic / All Intelligence Results
  |--------------------------------------------------------------------------
  */

  const renderGenericResults =
    () => {
      const outputs =
        result?.outputs || {};

      return (
        <>
          <div className="section-heading">
            <div>
              <span className="eyebrow">
                03 / AI INTELLIGENCE
              </span>

              <h2>
                Satellite Intelligence
              </h2>

              <p>
                Analysis successfully
                completed using the
                CHROMASAT satellite
                intelligence engine.
              </p>
            </div>

            <div className="analysis-status">
              <span className="status-dot" />
              ANALYSIS COMPLETE
            </div>
          </div>

          <div className="metrics-grid">
            <MetricCard
              label="Analysis"
              value="READY"
              sub="Backend analysis completed"
            />

            <MetricCard
              label="CRS"
              value={
                result?.image?.crs ||
                "--"
              }
            />

            <MetricCard
              label="Width"
              value={formatNumber(
                result?.image?.width
              )}
            />

            <MetricCard
              label="Height"
              value={formatNumber(
                result?.image?.height
              )}
            />

            <MetricCard
              label="Bands"
              value={formatNumber(
                result?.image?.bands
              )}
            />
          </div>

          <div className="map-card">
            <div className="map-toolbar">
              <div>
                <span className="eyebrow">
                  04 / SATELLITE OUTPUT
                </span>

                <h3>
                  Satellite Analysis Map
                </h3>
              </div>

              <div className="map-buttons">
                <button
                  className={
                    activeMap === "risk"
                      ? "active"
                      : ""
                  }
                  onClick={() =>
                    setActiveMap("risk")
                  }
                >
                  Analysis
                </button>

                <button
                  className={
                    activeMap === "water"
                      ? "active"
                      : ""
                  }
                  onClick={() =>
                    setActiveMap("water")
                  }
                >
                  Water
                </button>

                <button
                  className={
                    activeMap ===
                    "confidence"
                      ? "active"
                      : ""
                  }
                  onClick={() =>
                    setActiveMap(
                      "confidence"
                    )
                  }
                >
                  Confidence
                </button>
              </div>
            </div>

            <div className="map-view">
              {getMapUrl() ? (
                <img
                  key={getMapUrl()}
                  src={getMapUrl()}
                  alt="Satellite analysis output"
                  onError={(event) => {
                    event.currentTarget.style.display =
                      "none";
                  }}
                />
              ) : (
                <div className="map-placeholder">
                  <span>
                    🛰️
                  </span>

                  <p>
                    Analysis preview
                    unavailable
                  </p>
                </div>
              )}

              <div className="map-overlay">
                <strong>
                  {file?.name}
                </strong>

                <span>
                  {result?.image
                    ?.crs ||
                    "Satellite scene"}
                </span>
              </div>
            </div>
          </div>

          <div className="evidence-card">
            <span className="eyebrow">
              05 / ENGINE OUTPUT
            </span>

            <h3>
              Available Output Layers
            </h3>

            <div className="indicator-row">
              <div>
                <span>
                  RGB PREVIEW
                </span>

                <strong>
                  {outputs.rgb_preview
                    ? "Available"
                    : "Not available"}
                </strong>
              </div>

              <div>
                <span>
                  WATER MAP
                </span>

                <strong>
                  {outputs.water_preview
                    ? "Available"
                    : "Not available"}
                </strong>
              </div>

              <div>
                <span>
                  RISK MAP
                </span>

                <strong>
                  {outputs.risk_preview
                    ? "Available"
                    : "Not available"}
                </strong>
              </div>

              <div>
                <span>
                  CONFIDENCE
                </span>

                <strong>
                  {outputs.confidence_preview
                    ? "Available"
                    : "Not available"}
                </strong>
              </div>
            </div>

            <p className="simple-note">
              The dashboard displays only
              output layers actually returned
              by the connected FastAPI
              analysis service.
            </p>
          </div>
        </>
      );
    };

  /*
  |--------------------------------------------------------------------------
  | Main UI
  |--------------------------------------------------------------------------
  */

  return (
    <div className="disaster-page">
      <style>{`
        * {
          box-sizing: border-box;
        }

        .disaster-page {
          min-height: 100vh;
          background:
            radial-gradient(
              circle at 80% 10%,
              rgba(0,210,255,.08),
              transparent 30%
            ),
            radial-gradient(
              circle at 10% 80%,
              rgba(0,255,190,.04),
              transparent 25%
            ),
            #02090d;

          color: #eefcff;
          font-family:
            Inter,
            Arial,
            sans-serif;

          padding-bottom: 80px;
        }

        .disaster-nav {
          height: 82px;

          border-bottom:
            1px solid
            rgba(89,237,255,.12);

          display: flex;
          align-items: center;
          justify-content: space-between;

          padding: 0 6%;

          position: sticky;
          top: 0;
          z-index: 20;

          background:
            rgba(2,9,13,.92);

          backdrop-filter:
            blur(18px);
        }

        .brand {
          display: flex;
          align-items: center;
          gap: 14px;
        }

        .brand-icon {
          width: 46px;
          height: 46px;

          border:
            1px solid
            rgba(63,235,255,.45);

          border-radius: 50%;

          display: grid;
          place-items: center;

          font-size: 21px;
        }

        .brand-name {
          font-weight: 900;
          letter-spacing: 3px;
          font-size: 22px;
        }

        .brand-sub {
          color: #77919b;
          font-size: 10px;
          letter-spacing: 1.5px;
          margin-top: 3px;
        }

        .nav-actions {
          display: flex;
          gap: 10px;
        }

        .nav-button {
          border:
            1px solid
            rgba(66,232,255,.28);

          background:
            rgba(10,33,40,.7);

          color: #9eb7bf;

          border-radius: 12px;

          padding:
            13px 20px;

          cursor: pointer;
        }

        .nav-button:hover,
        .nav-button.active {
          color: #4eeaff;

          border-color:
            rgba(78,234,255,.6);
        }

        .container {
          width: min(1380px,92%);
          margin: auto;
        }

        .hero {
          padding:
            70px 0 45px;

          display: grid;

          grid-template-columns:
            1.25fr .75fr;

          gap: 40px;

          align-items: center;
        }

        .eyebrow {
          color: #43e8ff;

          font-size: 10px;

          font-weight: 800;

          letter-spacing: 2px;

          text-transform: uppercase;
        }

        .hero h1 {
          margin: 15px 0;

          font-size:
            clamp(38px,5vw,70px);

          line-height: .98;

          letter-spacing: -3px;
        }

        .hero h1 span {
          color: #41e7ff;
        }

        .hero p {
          color: #91aab3;

          max-width: 720px;

          line-height: 1.7;

          font-size: 15px;
        }

        .hero-orbit {
          height: 260px;

          display: grid;

          place-items: center;
        }

        .orbit {
          width: 190px;
          height: 190px;

          border:
            1px solid
            rgba(58,225,255,.32);

          border-radius: 50%;

          position: relative;

          animation:
            float 5s
            ease-in-out
            infinite;
        }

        .orbit:before,
        .orbit:after {
          content: "";

          position: absolute;

          inset: 22px;

          border:
            1px solid
            rgba(58,225,255,.16);

          border-radius: 50%;
        }

        .orbit:after {
          transform:
            rotateX(70deg);
        }

        .planet {
          width: 112px;
          height: 112px;

          position: absolute;

          top: 38px;
          left: 38px;

          border-radius: 50%;

          background:
            radial-gradient(
              circle at 35% 30%,
              #4eeaff,
              #087a89 28%,
              #03242b 70%
            );

          box-shadow:
            0 0 35px
            rgba(0,220,255,.38),

            inset
            -18px -15px 35px
            rgba(0,0,0,.55);
        }

        .planet-dot {
          position: absolute;

          width: 30px;
          height: 17px;

          border-radius: 50%;

          background:
            rgba(89,255,191,.5);

          filter: blur(2px);
        }

        .planet-dot.one {
          left: 30px;
          top: 26px;
        }

        .planet-dot.two {
          left: 52px;
          top: 58px;
          width: 40px;
        }

        @keyframes float {
          0%,100% {
            transform:
              translateY(0)
              rotate(0);
          }

          50% {
            transform:
              translateY(-8px)
              rotate(2deg);
          }
        }

        .back-button {
          margin-bottom: 15px;

          background: transparent;

          border: 0;

          color: #6f929b;

          cursor: pointer;

          font-size: 11px;
        }

        .back-button:hover {
          color: #4be8ff;
        }

        .input-grid {
          display: grid;

          grid-template-columns:
            .75fr 1.25fr;

          gap: 20px;
        }

        .panel {
          background:
            rgba(8,24,30,.84);

          border:
            1px solid
            rgba(117,225,239,.12);

          border-radius: 20px;

          padding: 28px;

          box-shadow:
            0 20px 60px
            rgba(0,0,0,.22);
        }

        .panel h2 {
          margin:
            8px 0 5px;

          font-size: 25px;
        }

        .panel-description {
          color: #77929b;

          font-size: 12px;

          line-height: 1.6;
        }

        .upload-box {
          margin-top: 22px;

          min-height: 185px;

          border:
            1px dashed
            rgba(70,230,255,.4);

          border-radius: 15px;

          background:
            rgba(2,15,20,.8);

          display: flex;

          flex-direction: column;

          align-items: center;

          justify-content: center;

          text-align: center;

          cursor: pointer;
        }

        .upload-box:hover {
          border-color: #46eaff;

          background:
            rgba(8,35,43,.85);
        }

        .upload-icon {
          font-size: 34px;
          margin-bottom: 12px;
        }

        .file-name {
          font-weight: 800;

          color: #e9fcff;

          max-width: 90%;

          overflow: hidden;

          text-overflow: ellipsis;

          white-space: nowrap;
        }

        .file-meta {
          color: #637f88;

          font-size: 11px;

          margin-top: 7px;
        }

        input[type=file] {
          display: none;
        }

        .primary-button {
          width: 100%;

          margin-top: 16px;

          padding: 17px;

          border: 0;

          border-radius: 12px;

          background:
            linear-gradient(
              90deg,
              #32dfcf,
              #42eaff
            );

          color: #021014;

          font-weight: 900;

          letter-spacing: .6px;

          cursor: pointer;
        }

        .primary-button:disabled {
          opacity: .45;
          cursor: not-allowed;
        }

        .scene {
          min-height: 270px;

          margin-top: 22px;

          border-radius: 15px;

          overflow: hidden;

          background: #010607;

          position: relative;

          display: grid;

          place-items: center;

          border:
            1px solid
            rgba(100,230,255,.12);
        }

        .scene-grid {
          position: absolute;

          inset: 0;

          background-image:
            linear-gradient(
              rgba(60,220,255,.04)
              1px,
              transparent 1px
            ),
            linear-gradient(
              90deg,
              rgba(60,220,255,.04)
              1px,
              transparent 1px
            );

          background-size: 35px 35px;
        }

        .scene-placeholder {
          position: relative;

          z-index: 1;

          text-align: center;

          color: #607983;
        }

        .scene-placeholder strong {
          display: block;

          color: #a8c3cb;

          margin-bottom: 8px;
        }

        .scene-placeholder span {
          font-size: 42px;

          display: block;

          margin-bottom: 10px;
        }

        .scene-placeholder small {
          display: block;

          color: #58737c;
        }

        .scene-image {
          position: relative;

          z-index: 2;

          width: 100%;

          height: 100%;

          max-height: 360px;

          object-fit: contain;
        }

        .scene-badge {
          position: absolute;

          left: 15px;
          bottom: 15px;

          z-index: 4;

          background:
            rgba(1,10,14,.86);

          border:
            1px solid
            rgba(68,232,255,.25);

          padding:
            8px 12px;

          border-radius: 8px;

          font-size: 10px;

          color: #81a5ae;

          max-width: 90%;

          overflow: hidden;

          text-overflow: ellipsis;

          white-space: nowrap;
        }

        .scene-badge strong {
          color: #4be8ff;

          margin-right: 8px;
        }

        .disaster-selector {
          margin-top: 35px;
        }

        .disaster-selector h2 {
          font-size: 25px;

          margin:
            8px 0;
        }

        .disaster-grid {
          display: grid;

          grid-template-columns:
            repeat(4,1fr);

          gap: 15px;

          margin-top: 20px;
        }

        .disaster-card {
          text-align: left;

          padding: 21px;

          min-height: 150px;

          border-radius: 16px;

          background:
            rgba(7,23,29,.85);

          border:
            1px solid
            rgba(118,225,240,.12);

          color: #cfe1e6;

          cursor: pointer;

          transition:
            .25s ease;

          position: relative;
        }

        .disaster-card:hover {
          transform:
            translateY(-5px);

          border-color:
            rgba(69,234,255,.45);
        }

        .disaster-card.active {
          border-color:
            #42e9ff;

          background:
            linear-gradient(
              145deg,
              rgba(5,54,62,.95),
              rgba(5,25,32,.95)
            );
        }

        .disaster-card.disabled {
          opacity: .48;
        }

        .disaster-icon {
          font-size: 29px;
        }

        .disaster-card h3 {
          margin:
            15px 0 6px;

          font-size: 15px;
        }

        .disaster-card p {
          margin: 0;

          color: #66828b;

          font-size: 10px;

          line-height: 1.5;
        }

        .available,
        .planned {
          position: absolute;

          right: 14px;
          top: 14px;

          font-size: 8px;

          border-radius: 20px;

          padding:
            4px 7px;
        }

        .available {
          color: #42e9d1;

          border:
            1px solid
            rgba(66,233,209,.25);
        }

        .planned {
          color: #87969c;

          border:
            1px solid
            rgba(135,150,156,.2);
        }

        .results {
          margin-top: 50px;
        }

        .section-heading {
          display: flex;

          justify-content:
            space-between;

          align-items:
            flex-end;

          gap: 20px;

          margin-bottom: 22px;
        }

        .section-heading h2 {
          margin:
            8px 0;

          font-size: 28px;
        }

        .section-heading p {
          margin: 0;

          color: #78939c;

          font-size: 12px;
        }

        .analysis-status {
          color: #4cead5;

          font-size: 9px;

          letter-spacing: 1px;

          border:
            1px solid
            rgba(76,234,213,.22);

          padding:
            9px 12px;

          border-radius: 20px;

          white-space: nowrap;
        }

        .status-dot {
          display: inline-block;

          width: 7px;
          height: 7px;

          border-radius: 50%;

          background: #4cead5;

          margin-right: 7px;
        }

        .metrics-grid {
          display: grid;

          grid-template-columns:
            repeat(5,1fr);

          gap: 12px;
        }

        .disaster-metric {
          padding: 20px;

          min-height: 125px;

          background:
            rgba(8,25,31,.9);

          border:
            1px solid
            rgba(115,220,235,.12);

          border-radius: 14px;
        }

        .disaster-metric.danger {
          border-color:
            rgba(255,80,90,.2);
        }

        .metric-label {
          color: #66818a;

          font-size: 9px;

          text-transform:
            uppercase;

          letter-spacing: 1px;
        }

        .metric-value {
          font-size: 27px;

          font-weight: 900;

          color: #47e8ff;

          margin-top: 12px;

          word-break: break-word;
        }

        .danger .metric-value {
          color: #ff6470;
        }

        .metric-sub {
          color: #536d75;

          font-size: 9px;

          margin-top: 6px;
        }

        .map-card {
          margin-top: 20px;

          background:
            rgba(5,19,24,.95);

          border:
            1px solid
            rgba(115,220,235,.13);

          border-radius: 18px;

          overflow: hidden;
        }

        .map-toolbar {
          padding:
            20px 22px;

          display: flex;

          justify-content:
            space-between;

          align-items: center;

          gap: 20px;

          border-bottom:
            1px solid
            rgba(115,220,235,.1);
        }

        .map-toolbar h3 {
          margin:
            7px 0 0;

          font-size: 18px;
        }

        .map-buttons {
          display: flex;

          gap: 7px;

          flex-wrap: wrap;
        }

        .map-buttons button {
          padding:
            8px 11px;

          background:
            #07171c;

          border:
            1px solid
            rgba(90,220,235,.14);

          color: #708a92;

          border-radius: 7px;

          font-size: 9px;

          cursor: pointer;
        }

        .map-buttons button.active {
          color: #43eaff;

          border-color:
            rgba(67,234,255,.55);

          background:
            rgba(10,55,63,.8);
        }

        .map-view {
          min-height: 570px;

          background:
            #020708;

          position: relative;

          display: grid;

          place-items: center;

          overflow: hidden;
        }

        .map-view:before {
          content: "";

          position: absolute;

          inset: 0;

          background-image:
            linear-gradient(
              rgba(74,230,255,.035)
              1px,
              transparent 1px
            ),
            linear-gradient(
              90deg,
              rgba(74,230,255,.035)
              1px,
              transparent 1px
            );

          background-size: 40px 40px;
        }

        .map-view img {
          position: relative;

          z-index: 2;

          width: 100%;

          height: 570px;

          object-fit: contain;
        }

        .map-overlay {
          position: absolute;

          z-index: 5;

          left: 18px;
          bottom: 18px;

          padding:
            10px 13px;

          border-radius: 9px;

          background:
            rgba(1,8,11,.9);

          border:
            1px solid
            rgba(73,230,255,.2);

          display: flex;

          flex-direction: column;

          gap: 4px;

          font-size: 9px;

          max-width: calc(100% - 36px);
        }

        .map-overlay strong {
          overflow: hidden;

          text-overflow: ellipsis;

          white-space: nowrap;
        }

        .map-overlay span {
          color: #65818a;
        }

        .map-placeholder {
          position: relative;

          z-index: 3;

          text-align: center;

          color: #5e7b84;
        }

        .map-placeholder span {
          font-size: 45px;
        }

        .map-placeholder p {
          margin-top: 10px;
        }

        .risk-grid {
          display: grid;

          grid-template-columns:
            repeat(3,1fr);

          gap: 14px;

          margin-top: 18px;
        }

        .risk-card {
          padding: 23px;

          border-radius: 15px;

          background:
            rgba(7,22,27,.9);

          border:
            1px solid
            rgba(120,220,235,.1);
        }

        .risk-card span {
          font-size: 9px;

          letter-spacing: 1.4px;

          font-weight: 900;
        }

        .risk-card strong {
          display: block;

          font-size: 34px;

          margin:
            10px 0 5px;
        }

        .risk-card p {
          margin: 0;

          color: #627c84;

          font-size: 10px;
        }

        .risk-card.high span,
        .risk-card.high strong {
          color: #ff5d68;
        }

        .risk-card.moderate span,
        .risk-card.moderate strong {
          color: #ffca52;
        }

        .risk-card.safe span,
        .risk-card.safe strong {
          color: #45e7b8;
        }

        .evidence-card {
          margin-top: 18px;

          padding: 25px;

          border-radius: 17px;

          background:
            rgba(7,22,27,.9);

          border:
            1px solid
            rgba(120,220,235,.1);
        }

        .evidence-card h3 {
          margin:
            8px 0 20px;
        }

        .indicator-row {
          display: grid;

          grid-template-columns:
            repeat(4,1fr);

          gap: 12px;
        }

        .indicator-row > div {
          padding: 16px;

          background:
            #06151a;

          border-radius: 10px;

          border:
            1px solid
            rgba(120,220,235,.08);
        }

        .indicator-row span {
          display: block;

          color: #607b84;

          font-size: 9px;

          margin-bottom: 8px;
        }

        .indicator-row strong {
          font-size: 18px;

          color: #ccecf2;

          word-break: break-word;
        }

        .simple-note {
          margin:
            17px 0 0;

          color: #68838b;

          font-size: 10px;

          line-height: 1.7;
        }

        .warning-box,
        .error-box,
        .loading-box {
          margin-top: 18px;

          padding: 15px;

          border-radius: 10px;

          font-size: 10px;

          line-height: 1.6;
        }

        .warning-box {
          border:
            1px solid
            rgba(255,191,64,.2);

          background:
            rgba(255,180,30,.04);

          color: #c9a85d;
        }

        .error-box {
          border:
            1px solid
            rgba(255,70,80,.2);

          background:
            rgba(255,70,80,.07);

          color: #ff7b83;
        }

        .loading-box {
          border:
            1px solid
            rgba(68,232,255,.18);

          background:
            rgba(10,50,57,.25);

          color: #57eaff;

          text-align: center;
        }

        .spinner {
          width: 22px;
          height: 22px;

          border:
            2px solid
            rgba(70,230,255,.2);

          border-top-color:
            #46eaff;

          border-radius: 50%;

          animation:
            spin .8s linear infinite;

          margin:
            0 auto 10px;
        }

        @keyframes spin {
          to {
            transform:
              rotate(360deg);
          }
        }

        .backend-note {
          margin-top: 15px;

          padding: 12px;

          border-radius: 9px;

          border:
            1px solid
            rgba(68,232,255,.12);

          background:
            rgba(10,40,47,.3);

          color: #66838d;

          font-size: 9px;

          line-height: 1.6;
        }

        @media(max-width:1000px) {
          .hero,
          .input-grid {
            grid-template-columns: 1fr;
          }

          .disaster-grid {
            grid-template-columns:
              repeat(2,1fr);
          }

          .metrics-grid {
            grid-template-columns:
              repeat(2,1fr);
          }

          .indicator-row {
            grid-template-columns:
              repeat(2,1fr);
          }
        }

        @media(max-width:650px) {
          .disaster-nav {
            padding: 0 4%;
          }

          .brand-sub {
            display: none;
          }

          .nav-button {
            padding: 10px;

            font-size: 10px;
          }

          .container {
            width: 94%;
          }

          .hero h1 {
            font-size: 42px;
          }

          .disaster-grid,
          .risk-grid,
          .metrics-grid,
          .indicator-row {
            grid-template-columns: 1fr;
          }

          .map-toolbar,
          .section-heading {
            align-items: flex-start;

            flex-direction: column;
          }

          .map-view,
          .map-view img {
            min-height: 350px;

            height: 350px;
          }
        }
      `}</style>

      {/* NAVIGATION */}

      <nav className="disaster-nav">
        <div className="brand">
          <div className="brand-icon">
            🛰️
          </div>

          <div>
            <div className="brand-name">
              CHROMASAT
            </div>

            <div className="brand-sub">
              Satellite Intelligence
              Platform
            </div>
          </div>
        </div>

        <div className="nav-actions">
          <button
            className="nav-button"
            onClick={onBack}
          >
            🛰️ Satellite Intelligence
          </button>

          <button
            className="nav-button active"
          >
            🚨 Natural Disasters
          </button>
        </div>
      </nav>

      <main className="container">

        {/* HERO */}

        <section className="hero">
          <div>
            <span className="eyebrow">
              AI-POWERED NATURAL
              DISASTER MANAGEMENT
            </span>

            <h1>
              From satellite
              observation
              <br />
              to{" "}
              <span>
                disaster intelligence.
              </span>
            </h1>

            <p>
              Upload the latest satellite
              GeoTIFF. CHROMASAT converts
              the scene into water,
              flood-risk and
              fire-related evidence
              that can support
              preliminary disaster
              assessment.
            </p>
          </div>

          <div className="hero-orbit">
            <div className="orbit">
              <div className="planet">
                <div className="planet-dot one" />
                <div className="planet-dot two" />
              </div>
            </div>
          </div>
        </section>

        {/* BACK */}

        <button
          className="back-button"
          onClick={onBack}
        >
          ← Back to Satellite
          Intelligence
        </button>

        {/* INPUT */}

        <section className="input-grid">

          {/* UPLOAD PANEL */}

          <div className="panel">
            <span className="eyebrow">
              01 / EMERGENCY IMAGE
            </span>

            <h2>
              Upload Latest GeoTIFF
            </h2>

            <p className="panel-description">
              Upload a Sentinel-2 or
              compatible GeoTIFF
              containing multispectral
              satellite information.
            </p>

            <label className="upload-box">
              <input
                ref={inputRef}
                type="file"
                accept=".tif,.tiff,image/tiff"
                onChange={chooseFile}
              />

              <div className="upload-icon">
                {file
                  ? "📡"
                  : "⬆️"}
              </div>

              <div className="file-name">
                {file
                  ? file.name
                  : "Drop your GeoTIFF here"}
              </div>

              <div className="file-meta">
                {file
                  ? `${(
                      file.size /
                      1024 /
                      1024
                    ).toFixed(2)} MB • GeoTIFF`
                  : ".TIF / .TIFF satellite imagery"}
              </div>
            </label>

            <button
              className="primary-button"
              disabled={
                !file ||
                loading
              }
              onClick={
                runAnalysis
              }
            >
              {loading
                ? "ANALYSING SATELLITE SCENE..."
                : "RUN DISASTER INTELLIGENCE →"}
            </button>

            {error && (
              <div className="error-box">
                ⚠️ {error}
              </div>
            )}

            {loading && (
              <div className="loading-box">
                <div className="spinner" />

                CHROMASAT AI ENGINE
                IS PROCESSING THE
                SATELLITE REGION
              </div>
            )}

            <div className="backend-note">
              Connected analysis service:
              <br />
              <strong>
                POST /api/analyze
              </strong>
            </div>
          </div>

          {/* SOURCE SCENE */}

          <div className="panel">
            <span className="eyebrow">
              02 / SOURCE SCENE
            </span>

            <h2>
              Uploaded Satellite Image
            </h2>

            <p className="panel-description">
              The satellite output returned
              by the CHROMASAT backend
              appears here after analysis.
            </p>

            <div className="scene">
              <div className="scene-grid" />

              {result?.outputs
                ?.rgb_preview ? (
                <img
                  className="scene-image"
                  src={getOutputUrl(
                    result.outputs
                      .rgb_preview
                  )}
                  alt="Uploaded satellite scene"
                />
              ) : result?.outputs
                  ?.water_preview ? (
                <img
                  className="scene-image"
                  src={getOutputUrl(
                    result.outputs
                      .water_preview
                  )}
                  alt="Water analysis"
                />
              ) : (
                <div className="scene-placeholder">
                  <span>
                    🛰️
                  </span>

                  <strong>
                    {file
                      ? "Satellite scene ready for analysis"
                      : "Waiting for satellite image"}
                  </strong>

                  <small>
                    {file
                      ? "Run analysis to generate the regional intelligence view."
                      : "Upload a GeoTIFF to begin."}
                  </small>
                </div>
              )}

              {file && (
                <div className="scene-badge">
                  <strong>
                    LIVE INPUT
                  </strong>

                  {file.name}
                </div>
              )}
            </div>

            <div
              className="metrics-grid"
              style={{
                marginTop: 12,
              }}
            >
              <MetricCard
                label="CRS"
                value={
                  result?.image?.crs ||
                  "--"
                }
              />

              <MetricCard
                label="Width"
                value={formatNumber(
                  result?.image?.width
                )}
              />

              <MetricCard
                label="Height"
                value={formatNumber(
                  result?.image?.height
                )}
              />

              <MetricCard
                label="Bands"
                value={formatNumber(
                  result?.image?.bands
                )}
              />

              <MetricCard
                label="Analysis"
                value={
                  result
                    ? "Ready"
                    : "Pending"
                }
              />
            </div>
          </div>
        </section>

        {/* DISASTER SELECTOR */}

        <section className="disaster-selector">
          <span className="eyebrow">
            SELECT DISASTER TYPE
          </span>

          <h2>
            Natural Disaster
            Intelligence
          </h2>

          <div className="disaster-grid">

            {DISASTERS.map(
              (disaster) => (
                <button
                  key={
                    disaster.id
                  }
                  className={`
                    disaster-card
                    ${
                      selectedDisaster ===
                      disaster.id
                        ? "active"
                        : ""
                    }
                    ${
                      !disaster.available
                        ? "disabled"
                        : ""
                    }
                  `}
                  onClick={() => {

                    if (
                      !disaster.available
                    ) {
                      setError(
                        `${disaster.title} is not connected to the current backend yet.`
                      );

                      return;
                    }

                    setSelectedDisaster(
                      disaster.id
                    );

                    setResult(null);
                    setError("");
                    setActiveMap(
                      "risk"
                    );
                  }}
                >
                  {disaster.available ? (
                    <span className="available">
                      AVAILABLE
                    </span>
                  ) : (
                    <span className="planned">
                      NEXT
                    </span>
                  )}

                  <div className="disaster-icon">
                    {disaster.icon}
                  </div>

                  <h3>
                    {disaster.title}
                  </h3>

                  <p>
                    {disaster.description}
                  </p>
                </button>
              )
            )}

          </div>
        </section>

        {/* RESULTS */}

        {result &&
          !loading && (
            <section className="results">

              {selectedDisaster ===
                "flood" &&
                renderFloodResults()}

              {selectedDisaster ===
                "fire" &&
                renderFireResults()}

              {selectedDisaster ===
                "all" &&
                renderGenericResults()}

            </section>
          )}

      </main>
    </div>
  );
}

export default DisasterDashboard;