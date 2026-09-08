document.addEventListener("DOMContentLoaded", async function () {
  const mapElement = document.getElementById("mumbaiHeatmap");

  // Do nothing if this page does not contain the map
  if (!mapElement) {
    return;
  }

  // Check Leaflet
  if (typeof L === "undefined") {
    console.error("Leaflet failed to load.");
    return;
  }

  // Check Leaflet heat plugin
  if (typeof L.heatLayer === "undefined") {
    console.error(
      "Leaflet.heat failed to load. Make sure the Leaflet heat plugin is included."
    );
    return;
  }

  /*
   * ----------------------------------------------------
   * 1. CREATE THE MUMBAI MAP
   * ----------------------------------------------------
   */

  const map = L.map("mumbaiHeatmap").setView(
    [19.0760, 72.8777],
    11
  );

  L.tileLayer(
    "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    {
      attribution: "&copy; OpenStreetMap contributors",
      maxZoom: 19
    }
  ).addTo(map);

  /*
   * ----------------------------------------------------
   * 2. LOAD WARDS AND BACKEND PREDICTIONS
   * ----------------------------------------------------
   */

  const wards = await loadWards();
  const wardPredictions = await loadWardPredictions();

  console.log("Wards received from backend:", wards);
  console.log(
    "Ward predictions received from backend:",
    wardPredictions
  );

  /*
   * ----------------------------------------------------
   * 3. DRAW THE BACKEND-BASED HEATMAP
   * ----------------------------------------------------
   */

  drawBackendHeatmap(
    map,
    wards,
    wardPredictions
  );

  /*
   * Fix map sizing when inside Bootstrap cards
   */
  setTimeout(function () {
    map.invalidateSize();
  }, 300);
});


/*
 * ----------------------------------------------------
 * GET WARDS FROM FASTAPI
 * ----------------------------------------------------
 */

async function loadWards() {
  try {
    const response = await fetch(
      "http://127.0.0.1:8000/wards"
    );

    if (!response.ok) {
      throw new Error(
        `Ward API returned ${response.status}`
      );
    }

    const wards = await response.json();

    return wards;

  } catch (error) {
    console.error(
      "Error loading wards:",
      error
    );

    return [];
  }
}


/*
 * ----------------------------------------------------
 * GET WARD PREDICTIONS FROM FASTAPI
 * ----------------------------------------------------
 */

async function loadWardPredictions() {
  const inputData = {
    temp_mean_c: 35,
    temp_max_c: 40,
    temp_min_c: 30,
    humidity_pct: 60,
    wind_speed_ms: 2,
    solar_radiation_kwh_m2: 5
  };

  try {
    const response = await fetch(
      "http://127.0.0.1:8000/predict/wards",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(inputData)
      }
    );

    if (!response.ok) {
      throw new Error(
        `Ward prediction API returned ${response.status}`
      );
    }

    const predictions = await response.json();

    return predictions;

  } catch (error) {
    console.error(
      "Ward prediction error:",
      error
    );

    return [];
  }
}


/*
 * ----------------------------------------------------
 * DRAW HEATMAP AND CIRCLES USING BACKEND DATA
 * ----------------------------------------------------
 */

function drawBackendHeatmap(
  map,
  wards,
  wardPredictions
) {
  if (!Array.isArray(wards) || wards.length === 0) {
    console.error(
      "No ward data available from backend."
    );
    return;
  }

  if (
    !wardPredictions ||
    (
      !Array.isArray(wardPredictions) &&
      typeof wardPredictions !== "object"
    )
  ) {
    console.error(
      "No valid ward prediction data available."
    );
    return;
  }

  const heatData = [
    // [latitude, longitude, intensity]
    [19.0760, 72.8777, 0.95], // Mumbai Central
    [19.0178, 72.8478, 0.80], // Dadar
    [19.0607, 72.8362, 0.65], // Worli
    [19.1136, 72.8697, 0.90], // Kurla
    [19.1197, 72.8468, 0.75], // Bandra East
    [19.2183, 72.9781, 0.95], // Thane
    [19.0330, 73.0297, 0.55], // Navi Mumbai
    [19.1864, 72.8488, 0.70], // Borivali
    [19.1551, 72.8498, 0.85], // Goregaon
    [19.2307, 72.8567, 0.60]  // Mira Road area
  ];
  const circleData = [];

  wards.forEach(function (ward, index) {
    /*
     * ------------------------------------------------
     * Extract ward coordinates
     * ------------------------------------------------
     *
     * Supports multiple possible backend field names.
     */

    const latitude = getLatitude(ward);
    const longitude = getLongitude(ward);

    if (
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude)
    ) {
      console.warn(
        "Skipping ward because coordinates are missing:",
        ward
      );

      return;
    }

    /*
     * ------------------------------------------------
     * Match ward with its prediction
     * ------------------------------------------------
     */

    const prediction = findWardPrediction(
      ward,
      wardPredictions,
      index
    );

    if (!prediction) {
      console.warn(
        "No prediction found for ward:",
        ward
      );

      return;
    }

    /*
     * ------------------------------------------------
     * Extract actual backend prediction values
     * ------------------------------------------------
     */

    const predictionData = getPredictionData(
      prediction
    );

    const wbgt = Number(
      predictionData.wbgt_c ??
      predictionData.wbgt ??
      predictionData.wbgtC
    );

    const hmri = Number(
      predictionData.hmri ??
      predictionData.hmri_value ??
      predictionData.hmriValue
    );

    const riskLevel = String(
      predictionData.risk_level ??
      predictionData.riskLevel ??
      "Low"
    );

    if (!Number.isFinite(wbgt)) {
      console.warn(
        "Invalid WBGT value for ward:",
        ward,
        prediction
      );

      return;
    }

    /*
     * Convert backend risk into a 0–1 intensity value
     */
    const riskIntensity = getRiskIntensity(
      riskLevel,
      wbgt,
      hmri
    );

    /*
     * Leaflet.heat format:
     *
     * [latitude, longitude, intensity]
     */

    heatData.push([
      latitude,
      longitude,
      riskIntensity
    ]);

    circleData.push({
      latitude: latitude,
      longitude: longitude,
      wbgt: wbgt,
      hmri: hmri,
      riskLevel: riskLevel,
      riskIntensity: riskIntensity,
      wardName: getWardName(ward, index)
    });
  });

  /*
   * ----------------------------------------------------
   * ADD HEATMAP LAYER
   * ----------------------------------------------------
   */

  if (heatData.length > 0) {
    L.heatLayer(
      heatData,
      {
        radius: 45,
        blur: 30,
        maxZoom: 13,
        max: 1.0,
        minOpacity: 0.45,

        gradient: {
          0.2: "green",
          0.4: "yellow",
          0.6: "orange",
          0.8: "red",
          1.0: "darkred"
        }
      }
    ).addTo(map);
  }

  /*
   * ----------------------------------------------------
   * ADD INDIVIDUAL COLORED CIRCLES
   * ----------------------------------------------------
   */

  circleData.forEach(function (item) {
    const color = getRiskColor(
      item.riskIntensity
    );

    const circle = L.circle(
      [
        item.latitude,
        item.longitude
      ],
      {
        radius:
          500 +
          item.riskIntensity * 1200,

        color: color,
        fillColor: color,
        fillOpacity: 0.35,
        weight: 2
      }
    ).addTo(map);

    circle.bindPopup(`
            <div style="min-width: 180px;">
                <h6 style="margin-bottom: 8px;">
                    ${item.wardName}
                </h6>

                <p style="margin: 4px 0;">
                    <strong>WBGT:</strong>
                    ${item.wbgt.toFixed(2)}°C
                </p>

                <p style="margin: 4px 0;">
                    <strong>HMRI:</strong>
                    ${Number.isFinite(item.hmri)
        ? item.hmri.toFixed(2)
        : "Unavailable"
      }
                </p>

                <p style="margin: 4px 0;">
                    <strong>Backend Risk:</strong>
                    ${item.riskLevel}
                </p>

                <p style="margin: 4px 0;">
                    <strong>Mortality Risk:</strong>
                    ${convertRiskToFiveLevel(
        item.riskLevel
      )}/5
                </p>
            </div>
        `);
  });

  console.log(
    "Backend heatmap points:",
    heatData
  );

  console.log(
    "Backend circles created:",
    circleData.length
  );
}


/*
 * ----------------------------------------------------
 * GET LATITUDE FROM A WARD OBJECT
 * ----------------------------------------------------
 */

function getLatitude(ward) {
  return Number(
    ward.latitude ??
    ward.lat ??
    ward.center_lat ??
    ward.centerLat ??
    ward.coordinates?.[1] ??
    ward.geometry?.coordinates?.[1]
  );
}


/*
 * ----------------------------------------------------
 * GET LONGITUDE FROM A WARD OBJECT
 * ----------------------------------------------------
 */

function getLongitude(ward) {
  return Number(
    ward.longitude ??
    ward.lng ??
    ward.lon ??
    ward.center_lng ??
    ward.centerLng ??
    ward.coordinates?.[0] ??
    ward.geometry?.coordinates?.[0]
  );
}


/*
 * ----------------------------------------------------
 * GET WARD NAME
 * ----------------------------------------------------
 */

function getWardName(ward, index) {
  return (
    ward.name ??
    ward.ward_name ??
    ward.wardName ??
    ward.ward_id ??
    ward.wardId ??
    `Ward ${index + 1}`
  );
}


/*
 * ----------------------------------------------------
 * MATCH A WARD TO ITS PREDICTION
 * ----------------------------------------------------
 */

function findWardPrediction(
  ward,
  wardPredictions,
  index
) {
  /*
   * If predictions are returned as an array,
   * match by index first.
   */

  if (Array.isArray(wardPredictions)) {
    return (
      wardPredictions[index] ??
      wardPredictions.find(function (prediction) {
        return sameWardId(
          ward,
          prediction
        );
      })
    );
  }

  /*
   * If predictions are returned as an object,
   * try common ward identifiers.
   */

  const wardId =
    ward.id ??
    ward.ward_id ??
    ward.wardId ??
    ward.name ??
    ward.ward_name;

  if (
    wardId !== undefined &&
    wardPredictions[wardId] !== undefined
  ) {
    return wardPredictions[wardId];
  }

  return wardPredictions[index];
}


/*
 * ----------------------------------------------------
 * CHECK WHETHER TWO WARD IDS MATCH
 * ----------------------------------------------------
 */

function sameWardId(ward, prediction) {
  const wardId =
    ward.id ??
    ward.ward_id ??
    ward.wardId ??
    ward.name ??
    ward.ward_name;

  const predictionId =
    prediction.id ??
    prediction.ward_id ??
    prediction.wardId ??
    prediction.name ??
    prediction.ward_name;

  return (
    wardId !== undefined &&
    predictionId !== undefined &&
    String(wardId) === String(predictionId)
  );
}


/*
 * ----------------------------------------------------
 * EXTRACT PREDICTION DATA
 * ----------------------------------------------------
 *
 * Supports responses like:
 *
 * {
 *   wbgt_c: 31,
 *   hmri: 14,
 *   risk_level: "High"
 * }
 *
 * Or:
 *
 * {
 *   "3d": {
 *     wbgt_c: 31,
 *     hmri: 14,
 *     risk_level: "High"
 *   }
 * }
 */

function getPredictionData(prediction) {
  if (!prediction) {
    return {};
  }

  if (
    prediction["3d"] &&
    typeof prediction["3d"] === "object"
  ) {
    return prediction["3d"];
  }

  return prediction;
}


/*
 * ----------------------------------------------------
 * CONVERT BACKEND RISK TO 0–1 HEATMAP INTENSITY
 * ----------------------------------------------------
 */

function getRiskIntensity(
  riskLevel,
  wbgt,
  hmri
) {
  const normalizedRisk = String(
    riskLevel
  ).trim().toLowerCase();

  const riskMap = {
    low: 0.20,
    moderate: 0.40,
    medium: 0.60,
    high: 0.80,
    "very high": 0.90,
    extreme: 1.00,
    critical: 1.00
  };

  if (
    riskMap[normalizedRisk] !== undefined
  ) {
    return riskMap[normalizedRisk];
  }

  /*
   * Fallback based on WBGT
   */
  if (Number.isFinite(wbgt)) {
    return Math.min(
      Math.max(
        (wbgt - 20) / 20,
        0.10
      ),
      1.00
    );
  }

  /*
   * Fallback based on HMRI
   */
  if (Number.isFinite(hmri)) {
    return Math.min(
      Math.max(
        hmri / 20,
        0.10
      ),
      1.00
    );
  }

  return 0.20;
}


/*
 * ----------------------------------------------------
 * CONVERT RISK TO 1–5 SCALE
 * ----------------------------------------------------
 */

function convertRiskToFiveLevel(riskLevel) {
  const normalizedRisk = String(
    riskLevel
  ).trim().toLowerCase();

  const riskMap = {
    low: 1,
    moderate: 2,
    medium: 3,
    high: 4,
    "very high": 4,
    extreme: 5,
    critical: 5
  };

  return riskMap[normalizedRisk] ?? 1;
}


/*
 * ----------------------------------------------------
 * GET CIRCLE COLOR
 * ----------------------------------------------------
 */

function getRiskColor(risk) {

  if (risk >= 0.60) {
    return "red";
  }

  if (risk >= 0.40) {
    return "orange";
  }

  if (risk >= 0.20) {
    return "yellow";
  }

  return "green";
}


/*
 * ----------------------------------------------------
 * OPENWEATHER AMBIENT TEMPERATURE
 * ----------------------------------------------------
 */

const weatherApiKey =
  "4a3859186dbabdd652e466a270aab3ec";

const ambientTemp =
  document.getElementById("ambientTemp");

if (ambientTemp) {
  fetch(
    `https://api.openweathermap.org/data/2.5/weather?q=mumbai&units=metric&appid=${weatherApiKey}`
  )
    .then(function (response) {
      if (!response.ok) {
        throw new Error(
          `Weather API returned ${response.status}`
        );
      }

      return response.json();
    })
    .then(function (json) {
      ambientTemp.innerHTML =
        `${parseInt(json.main.temp)} <span>°C</span>`;

      ambientTemp.classList.add(
        "text-warning"
      );
    })
    .catch(function (error) {
      console.error(
        "Unable to load weather data:",
        error
      );

      ambientTemp.textContent =
        "Unavailable";
    });
}
