document.addEventListener("DOMContentLoaded", () => {

  // =========================================================
  // FASTAPI
  // =========================================================

  const FASTAPI_URL = "https://taapsurakshak.onrender.com";


  // =========================================================
  // MAP
  // =========================================================

  const mapElement = document.getElementById("mumbaiHeatmap");

  if (!mapElement) {
    console.error("❌ #mumbaiHeatmap element not found.");
    return;
  }

  const map = L.map("mumbaiHeatmap", {
    zoomControl: true
  }).setView([19.0760, 72.8777], 11);


  // =========================================================
  // OPENSTREETMAP
  // =========================================================

  L.tileLayer(
    "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap contributors"
    }
  ).addTo(map);


  // =========================================================
  // LAYERS
  // =========================================================

  let heatLayer = null;

  const wardMarkerLayer = L.layerGroup().addTo(map);


  // =========================================================
  // WEATHER INPUT
  // =========================================================
  //
  // These values are sent to the ML backend.
  // The actual risk values come from FastAPI.
  //

  const weatherData = {
    temp_mean_c: 35,
    temp_max_c: 40,
    temp_min_c: 30,
    humidity_pct: 60,
    wind_speed_ms: 2,
    solar_radiation_kwh_m2: 5
  };


  // =========================================================
  // HELPER: GET RISK VALUE
  // =========================================================
  //
  // Actual backend response:
  //
  // prediction: {
  //   "3d": {
  //      wbgt_c: ...,
  //      hmri: ...,
  //      risk_level: ...
  //   },
  //   "4d": {...},
  //   "5d": {...}
  // }
  //
  // This function receives the selected prediction data,
  // e.g. prediction.prediction["3d"].
  //

  function getRiskValue(prediction) {

    if (!prediction) {
      return null;
    }


    // -----------------------------------------------------
    // Actual ML field
    // -----------------------------------------------------

    if (prediction.hmri !== undefined) {

      const value = Number(
        prediction.hmri
      );

      if (Number.isFinite(value)) {
        return value;
      }
    }


    // -----------------------------------------------------
    // Possible alternative field names
    // -----------------------------------------------------

    if (prediction.mortalityRisk !== undefined) {

      const value = Number(
        prediction.mortalityRisk
      );

      if (Number.isFinite(value)) {
        return value;
      }
    }


    if (prediction.mortality_risk !== undefined) {

      const value = Number(
        prediction.mortality_risk
      );

      if (Number.isFinite(value)) {
        return value;
      }
    }


    if (prediction.risk !== undefined) {

      const value = Number(
        prediction.risk
      );

      if (Number.isFinite(value)) {
        return value;
      }
    }


    return null;
  }


  // =========================================================
  // HELPER: GET WBGT
  // =========================================================

  function getWBGT(prediction) {

    if (!prediction) {
      return null;
    }


    if (prediction.wbgt_c !== undefined) {

      const value = Number(
        prediction.wbgt_c
      );

      if (Number.isFinite(value)) {
        return value;
      }
    }


    if (prediction.wbgt !== undefined) {

      const value = Number(
        prediction.wbgt
      );

      if (Number.isFinite(value)) {
        return value;
      }
    }


    return null;
  }


  // =========================================================
  // HELPER: GET RISK LEVEL
  // =========================================================

  function getRiskLevel(prediction) {

    if (!prediction) {
      return "UNKNOWN";
    }


    if (prediction.risk_level) {
      return prediction.risk_level;
    }


    if (prediction.riskLevel) {
      return prediction.riskLevel;
    }


    return "UNKNOWN";
  }


  // =========================================================
  // HELPER: RISK COLOR
  // =========================================================
  //
  // HMRI from backend is NOT a 0-1 value.
  //
  // Current backend values are approximately:
  //
  // 12 - 20
  //
  // Therefore risk color is based on the actual risk level
  // returned by the ML backend where possible.
  //

  function getRiskColor(risk, riskLevel) {

    // -----------------------------------------------------
    // Prefer actual ML risk level
    // -----------------------------------------------------

    if (riskLevel) {

      const level = String(
        riskLevel
      ).toLowerCase();


      if (
        level === "very high" ||
        level === "critical"
      ) {
        return "#d7191c";
      }


      if (
        level === "high"
      ) {
        return "#fdae61";
      }


      if (
        level === "moderate" ||
        level === "medium"
      ) {
        return "#fee08b";
      }


      if (
        level === "low"
      ) {
        return "#1a9641";
      }
    }


    // -----------------------------------------------------
    // Fallback using HMRI
    // -----------------------------------------------------

    if (
      risk === null ||
      !Number.isFinite(risk)
    ) {
      return "#808080";
    }


    if (risk >= 18) {
      return "#d7191c";
    }


    if (risk >= 16) {
      return "#fdae61";
    }


    if (risk >= 14) {
      return "#fee08b";
    }


    return "#1a9641";
  }


  // =========================================================
  // HELPER: CALCULATE HMRI RANGE
  // =========================================================
  //
  // The backend returns HMRI values around 12-20.
  // Leaflet heatmap requires intensity between 0 and 1.
  //
  // We calculate the range from the actual backend data
  // instead of hardcoding heat values.
  //

  function getRiskRange(predictions) {

    const riskValues = [];


    predictions.forEach(prediction => {

      if (!prediction) {
        return;
      }


      let predictionData =
        prediction.prediction;


      if (
        !predictionData ||
        typeof predictionData !== "object"
      ) {

        predictionData = prediction;
      }


      // Use 3-day prediction for current heatmap

      if (
        predictionData["3d"] &&
        typeof predictionData["3d"] === "object"
      ) {

        predictionData =
          predictionData["3d"];
      }


      const risk =
        getRiskValue(
          predictionData
        );


      if (
        risk !== null &&
        Number.isFinite(risk)
      ) {

        riskValues.push(risk);
      }
    });


    if (riskValues.length === 0) {

      return {
        min: 0,
        max: 1
      };
    }


    return {
      min: Math.min(...riskValues),
      max: Math.max(...riskValues)
    };
  }


  // =========================================================
  // HELPER: RISK INTENSITY
  // =========================================================

  function getRiskIntensity(
    risk,
    riskRange
  ) {

    if (
      risk === null ||
      !Number.isFinite(risk)
    ) {

      return 0.3;
    }


    const min =
      riskRange.min;


    const max =
      riskRange.max;


    // -----------------------------------------------------
    // If all values are the same
    // -----------------------------------------------------

    if (max === min) {
      return 0.7;
    }


    // -----------------------------------------------------
    // Normalize actual HMRI to 0-1
    // -----------------------------------------------------

    const normalized =
      (risk - min) /
      (max - min);


    return Math.max(
      0,
      Math.min(
        1,
        normalized
      )
    );
  }


  // =========================================================
  // LOAD WARDS
  // =========================================================

  async function loadWards() {

    console.log(
      "📍 Loading wards from FastAPI..."
    );


    const response =
      await fetch(
        `${FASTAPI_URL}/wards`
      );


    if (!response.ok) {

      throw new Error(
        `FastAPI /wards returned ${response.status}`
      );
    }


    const wards =
      await response.json();


    console.log(
      "📍 Wards received:",
      wards
    );


    if (!Array.isArray(wards)) {

      throw new Error(
        "FastAPI /wards response is not an array."
      );
    }


    return wards;
  }


  // =========================================================
  // LOAD ML PREDICTIONS
  // =========================================================

  async function loadWardPredictions() {

    console.log(
      "🤖 Requesting ward ML predictions..."
    );


    const response =
      await fetch(
        `${FASTAPI_URL}/predict/wards`,
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json"
          },

          body: JSON.stringify(
            weatherData
          )
        }
      );


    if (!response.ok) {

      throw new Error(
        `FastAPI /predict/wards returned ${response.status}`
      );
    }


    const predictions =
      await response.json();


    console.log(
      "🤖 Ward predictions received:",
      predictions
    );


    return predictions;
  }


  // =========================================================
  // NORMALIZE PREDICTION RESPONSE
  // =========================================================

  function normalizePredictions(data) {

    /*
     * Depending on the backend implementation,
     * /predict/wards may return:
     *
     * [
     *   {...},
     *   {...}
     * ]
     *
     * OR
     *
     * {
     *   "wards": [...]
     * }
     *
     * OR
     *
     * {
     *   "predictions": [...]
     * }
     *
     * OR
     *
     * {
     *   "1": {...},
     *   "2": {...}
     * }
     */


    if (Array.isArray(data)) {

      return data;
    }


    if (
      data &&
      Array.isArray(data.wards)
    ) {

      return data.wards;
    }


    if (
      data &&
      Array.isArray(data.predictions)
    ) {

      return data.predictions;
    }


    if (
      data &&
      typeof data === "object"
    ) {

      const result = [];


      for (
        const key of Object.keys(data)
      ) {

        const value =
          data[key];


        if (
          value &&
          typeof value === "object" &&
          !Array.isArray(value)
        ) {

          result.push({
            ward_id: Number(key),
            ...value
          });
        }
      }


      if (result.length > 0) {

        return result;
      }
    }


    throw new Error(
      "Could not understand /predict/wards response format."
    );
  }


  // =========================================================
  // GET PREDICTION FOR WARD
  // =========================================================

  function findPredictionForWard(
    ward,
    predictions
  ) {

    const wardId =
      Number(
        ward.ward_id
      );


    // -----------------------------------------------------
    // Direct ward_id match
    // -----------------------------------------------------

    const match =
      predictions.find(
        prediction => {

          return Number(
            prediction.ward_id ??
            prediction.wardID ??
            prediction.id
          ) === wardId;

        }
      );


    return match || null;
  }


  // =========================================================
  // CREATE HEATMAP
  // =========================================================

  function createHeatmap(
    wards,
    predictions
  ) {

    console.log(
      "🔥 Creating heatmap..."
    );


    const heatData = [];


    wardMarkerLayer.clearLayers();


    // =====================================================
    // GET ACTUAL HMRI RANGE
    // =====================================================

    const riskRange =
      getRiskRange(
        predictions
      );


    console.log(
      "📊 HMRI range:",
      riskRange
    );


    // =====================================================
    // LOOP THROUGH EVERY WARD
    // =====================================================

    wards.forEach(
      ward => {

        const latitude =
          Number(
            ward.latitude
          );


        const longitude =
          Number(
            ward.longitude
          );


        // -------------------------------------------------
        // Skip wards without coordinates
        // -------------------------------------------------

        if (
          !Number.isFinite(latitude) ||
          !Number.isFinite(longitude)
        ) {

          console.warn(
            `⚠️ Missing coordinates for ward ${ward.ward_id}`
          );

          return;
        }


        // -------------------------------------------------
        // Find ML prediction
        // -------------------------------------------------

        const prediction =
          findPredictionForWard(
            ward,
            predictions
          );


        if (!prediction) {

          console.warn(
            `⚠️ No ML prediction found for ward ${ward.ward_id}`
          );

          return;
        }


        // -------------------------------------------------
        // ACTUAL BACKEND STRUCTURE
        //
        // prediction.prediction["3d"]
        // -------------------------------------------------

        let predictionData =
          prediction.prediction;


        if (
          !predictionData ||
          typeof predictionData !== "object"
        ) {

          predictionData =
            prediction;
        }


        // -------------------------------------------------
        // Use 3-day ML prediction
        // -------------------------------------------------

        if (
          predictionData["3d"] &&
          typeof predictionData["3d"] === "object"
        ) {

          predictionData =
            predictionData["3d"];
        }


        // -------------------------------------------------
        // Get HMRI
        // -------------------------------------------------

        const risk =
          getRiskValue(
            predictionData
          );


        // -------------------------------------------------
        // Get WBGT
        // -------------------------------------------------

        const wbgt =
          getWBGT(
            predictionData
          );


        // -------------------------------------------------
        // Get actual ML risk level
        // -------------------------------------------------

        const riskLevel =
          getRiskLevel(
            predictionData
          );


        // -------------------------------------------------
        // Validate HMRI
        // -------------------------------------------------

        if (
          risk === null ||
          !Number.isFinite(risk)
        ) {

          console.warn(
            `⚠️ Invalid HMRI value for ward ${ward.ward_id}`,
            prediction
          );

          return;
        }


        // -------------------------------------------------
        // Heat intensity
        // -------------------------------------------------

        const intensity =
          getRiskIntensity(
            risk,
            riskRange
          );


        // -------------------------------------------------
        // Add to Leaflet heat layer
        //
        // [latitude, longitude, intensity]
        // -------------------------------------------------

        heatData.push([
          latitude,
          longitude,
          intensity
        ]);


        // -------------------------------------------------
        // Ward marker color
        // -------------------------------------------------

        const color =
          getRiskColor(
            risk,
            riskLevel
          );


        // -------------------------------------------------
        // Ward circle
        // -------------------------------------------------

        const marker =
          L.circleMarker(
            [
              latitude,
              longitude
            ],
            {
              radius: 9,
              color: "#ffffff",
              weight: 2,
              fillColor: color,
              fillOpacity: 0.9
            }
          );


        // -------------------------------------------------
        // Popup
        // -------------------------------------------------

        marker.bindPopup(`

          <div style="min-width:210px">

            <strong>
              Ward ${ward.ward_id} - ${ward.ward_name}
            </strong>

            <hr style="margin:6px 0">

            <div>
              <strong>WBGT:</strong>
              ${
                wbgt !== null
                  ? `${wbgt.toFixed(2)} °C`
                  : "Unavailable"
              }
            </div>

            <div>
              <strong>HMRI:</strong>
              ${risk.toFixed(2)}
            </div>

            <div>
              <strong>Risk Level:</strong>
              ${riskLevel}
            </div>

            <div>
              <strong>Vulnerability:</strong>
              ${Number(
                ward.vulnerability
              ).toFixed(3)}
            </div>

            <div>
              <strong>Exposure:</strong>
              ${Number(
                ward.exposure
              ).toFixed(3)}
            </div>

            <div>
              <strong>Population:</strong>
              ${Number(
                ward.population_2025
              ).toLocaleString()}
            </div>

          </div>

        `);


        marker.addTo(
          wardMarkerLayer
        );

      }
    );


    // =====================================================
    // REMOVE OLD HEATMAP
    // =====================================================

    if (heatLayer) {

      map.removeLayer(
        heatLayer
      );

      heatLayer = null;
    }


    // =====================================================
    // CREATE NEW HEATMAP
    // =====================================================

    if (
      heatData.length === 0
    ) {

      console.error(
        "❌ No valid heat data available."
      );

      return false;
    }


    heatLayer =
      L.heatLayer(
        heatData,
        {
          radius: 45,
          blur: 35,
          maxZoom: 13,
          max: 1.0,
          minOpacity: 0.35,

          gradient: {
            0.0: "green",
            0.5: "yellow",
            0.8: "orange",
            1.0: "red"
          }
        }
      );


    heatLayer.addTo(
      map
    );


    console.log(
      `🔥 Heat signatures created: ${heatData.length}`
    );


    console.log(
      `⭕ Ward circles created: ${wardMarkerLayer.getLayers().length}`
    );


    // =====================================================
    // FIT MAP TO WARDS
    // =====================================================

    const bounds =
      L.latLngBounds(
        heatData.map(
          point => [
            point[0],
            point[1]
          ]
        )
      );


    if (
      bounds.isValid()
    ) {

      map.fitBounds(
        bounds,
        {
          padding: [
            30,
            30
          ]
        }
      );
    }


    return true;
  }


  // =========================================================
  // LOAD EVERYTHING
  // =========================================================

  async function initializeDashboard() {

    try {

      console.log(
        "🚀 Initializing TaapSurakshak dashboard..."
      );


      // -------------------------------------------------
      // Get ward coordinates/data
      // -------------------------------------------------

      const wards =
        await loadWards();


      // -------------------------------------------------
      // Get ML predictions
      // -------------------------------------------------

      const predictionResponse =
        await loadWardPredictions();


      // -------------------------------------------------
      // Normalize prediction response
      // -------------------------------------------------

      const predictions =
        normalizePredictions(
          predictionResponse
        );


      console.log(
        "📊 Normalized predictions:",
        predictions
      );


      // -------------------------------------------------
      // Build heatmap
      // -------------------------------------------------

      const heatmapCreated =
        createHeatmap(
          wards,
          predictions
        );


      // -------------------------------------------------
      // Fix Leaflet rendering after layout
      // -------------------------------------------------

      setTimeout(
        () => {

          map.invalidateSize();

        },
        300
      );


      // -------------------------------------------------
      // Success message only if heatmap actually exists
      // -------------------------------------------------

      if (heatmapCreated) {

        console.log(
          "✅ Dashboard heatmap loaded successfully."
        );

      }

    } catch (error) {

      console.error(
        "❌ Dashboard initialization failed:",
        error
      );


      console.error(
        "❌ Error message:",
        error.message
      );
    }
  }


  // =========================================================
  // RESPONSIVE MAP FIX
  // =========================================================

  window.addEventListener(
    "resize",
    () => {

      setTimeout(
        () => {

          map.invalidateSize();

        },
        150
      );

    }
  );


  // =========================================================
  // START
  // =========================================================

  initializeDashboard();

});