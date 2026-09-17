document.addEventListener("DOMContentLoaded", () => {

  // =========================================================
  // FASTAPI
  // =========================================================

  const FASTAPI_URL =
    "https://taapsurakshak.onrender.com";


  // =========================================================
  // RISK PAGE
  // WBGT + TEMPERATURE
  // =========================================================

  async function loadHeatRiskData() {

    try {

      console.log(
        "🌡️ Loading WBGT and temperature..."
      );

      const response =
        await fetch(
          "/api/latest-heat-data",
          {
            method: "GET",

            headers: {
              "Accept":
                "application/json"
            },

            cache: "no-store"
          }
        );


      if (!response.ok) {

        throw new Error(
          `/api/latest-heat-data returned ${response.status}`
        );

      }


      const data =
        await response.json();


      console.log(
        "🌡️ Heat data received:",
        data
      );


      // =====================================================
      // TEMPERATURE
      // =====================================================

      const ambientTemp =
        document.getElementById(
          "ambientTemp"
        );


      if (ambientTemp) {

        const temperature =
          Number(
            data.temperature
          );


        if (
          Number.isFinite(
            temperature
          )
        ) {

          ambientTemp.textContent =
            `${temperature.toFixed(1)}°C`;

        } else {

          ambientTemp.textContent =
            "Unavailable";

        }

      }


      // =====================================================
      // WBGT
      // =====================================================

      const wbgtElement =
        document.getElementById(
          "wbgtValue"
        );


      if (wbgtElement) {

        const wbgt =
          Number(
            data.heatStress
          );


        if (
          Number.isFinite(
            wbgt
          )
        ) {

          wbgtElement.textContent =
            `${wbgt.toFixed(1)}°C`;

        } else {

          wbgtElement.textContent =
            "Unavailable";

        }

      }


    } catch (error) {

      console.error(
        "❌ Failed to load WBGT/temperature:",
        error
      );


      const ambientTemp =
        document.getElementById(
          "ambientTemp"
        );


      if (ambientTemp) {

        ambientTemp.textContent =
          "Unavailable";

      }


      const wbgtElement =
        document.getElementById(
          "wbgtValue"
        );


      if (wbgtElement) {

        wbgtElement.textContent =
          "Unavailable";

      }

    }

  }


  // =========================================================
  // LOAD RISK DATA ON EVERY PAGE WHERE THE ELEMENT EXISTS
  // =========================================================

  loadHeatRiskData();


  // =========================================================
  // MAP
  // =========================================================

  const mapElement =
    document.getElementById(
      "mumbaiHeatmap"
    );


  // ---------------------------------------------------------
  // IMPORTANT:
  // If this is the Risk page and there is no map,
  // DO NOT stop the entire JavaScript.
  // ---------------------------------------------------------

  if (!mapElement) {

    console.log(
      "ℹ️ No heatmap on this page. Skipping map initialization."
    );

    return;

  }


  // =========================================================
  // CREATE MAP
  // =========================================================

  const map =
    L.map(
      "mumbaiHeatmap",
      {
        zoomControl: true
      }
    ).setView(
      [
        19.0760,
        72.8777
      ],
      11
    );


  // =========================================================
  // OPENSTREETMAP
  // =========================================================

  L.tileLayer(
    "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    {
      maxZoom: 19,

      attribution:
        "&copy; OpenStreetMap contributors"
    }
  ).addTo(
    map
  );


  // =========================================================
  // LAYERS
  // =========================================================

  let heatLayer =
    null;


  const wardMarkerLayer =
    L.layerGroup().addTo(
      map
    );


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

  function getRiskValue(
    prediction
  ) {

    if (!prediction) {

      return null;

    }


    // -------------------------------------------------------
    // Actual ML field
    // -------------------------------------------------------

    if (
      prediction.hmri !==
      undefined
    ) {

      const value =
        Number(
          prediction.hmri
        );


      if (
        Number.isFinite(
          value
        )
      ) {

        return value;

      }

    }


    // -------------------------------------------------------
    // Alternative field
    // -------------------------------------------------------

    if (
      prediction.mortalityRisk !==
      undefined
    ) {

      const value =
        Number(
          prediction.mortalityRisk
        );


      if (
        Number.isFinite(
          value
        )
      ) {

        return value;

      }

    }


    // -------------------------------------------------------
    // Alternative field
    // -------------------------------------------------------

    if (
      prediction.mortality_risk !==
      undefined
    ) {

      const value =
        Number(
          prediction.mortality_risk
        );


      if (
        Number.isFinite(
          value
        )
      ) {

        return value;

      }

    }


    // -------------------------------------------------------
    // Alternative field
    // -------------------------------------------------------

    if (
      prediction.risk !==
      undefined
    ) {

      const value =
        Number(
          prediction.risk
        );


      if (
        Number.isFinite(
          value
        )
      ) {

        return value;

      }

    }


    return null;

  }


  // =========================================================
  // HELPER: GET WBGT
  // =========================================================

  function getWBGT(
    prediction
  ) {

    if (!prediction) {

      return null;

    }


    if (
      prediction.wbgt_c !==
      undefined
    ) {

      const value =
        Number(
          prediction.wbgt_c
        );


      if (
        Number.isFinite(
          value
        )
      ) {

        return value;

      }

    }


    if (
      prediction.wbgt !==
      undefined
    ) {

      const value =
        Number(
          prediction.wbgt
        );


      if (
        Number.isFinite(
          value
        )
      ) {

        return value;

      }

    }


    return null;

  }


  // =========================================================
  // HELPER: GET RISK LEVEL
  // =========================================================

  function getRiskLevel(
    prediction
  ) {

    if (!prediction) {

      return "UNKNOWN";

    }


    if (
      prediction.risk_level
    ) {

      return prediction.risk_level;

    }


    if (
      prediction.riskLevel
    ) {

      return prediction.riskLevel;

    }


    return "UNKNOWN";

  }


  // =========================================================
  // HELPER: RISK COLOR
  // =========================================================

  function getRiskColor(
    risk,
    riskLevel
  ) {

    // -------------------------------------------------------
    // Prefer actual ML risk level
    // -------------------------------------------------------

    if (riskLevel) {

      const level =
        String(
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


    // -------------------------------------------------------
    // Fallback using HMRI
    // -------------------------------------------------------

    if (
      risk === null ||
      !Number.isFinite(
        risk
      )
    ) {

      return "#808080";

    }


    if (
      risk >= 18
    ) {

      return "#d7191c";

    }


    if (
      risk >= 16
    ) {

      return "#fdae61";

    }


    if (
      risk >= 14
    ) {

      return "#fee08b";

    }


    return "#1a9641";

  }


  // =========================================================
  // HELPER: CALCULATE HMRI RANGE
  // =========================================================

  function getRiskRange(
    predictions
  ) {

    const riskValues =
      [];


    predictions.forEach(
      prediction => {

        if (!prediction) {

          return;

        }


        let predictionData =
          prediction.prediction;


        if (
          !predictionData ||
          typeof predictionData !==
          "object"
        ) {

          predictionData =
            prediction;

        }


        // ---------------------------------------------------
        // Use 3-day prediction
        // ---------------------------------------------------

        if (
          predictionData["3d"] &&
          typeof predictionData["3d"] ===
          "object"
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
          Number.isFinite(
            risk
          )
        ) {

          riskValues.push(
            risk
          );

        }

      }
    );


    if (
      riskValues.length ===
      0
    ) {

      return {

        min: 0,

        max: 1

      };

    }


    return {

      min:
        Math.min(
          ...riskValues
        ),

      max:
        Math.max(
          ...riskValues
        )

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
      !Number.isFinite(
        risk
      )
    ) {

      return 0.3;

    }


    const min =
      riskRange.min;


    const max =
      riskRange.max;


    // -------------------------------------------------------
    // If all values are same
    // -------------------------------------------------------

    if (
      max === min
    ) {

      return 0.7;

    }


    // -------------------------------------------------------
    // Normalize HMRI to 0-1
    // -------------------------------------------------------

    const normalized =
      (
        risk - min
      ) /
      (
        max - min
      );


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


    if (
      !response.ok
    ) {

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


    if (
      !Array.isArray(
        wards
      )
    ) {

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

            "Content-Type":
              "application/json"

          },

          body:
            JSON.stringify(
              weatherData
            )

        }
      );


    if (
      !response.ok
    ) {

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

  function normalizePredictions(
    data
  ) {

    if (
      Array.isArray(
        data
      )
    ) {

      return data;

    }


    if (
      data &&
      Array.isArray(
        data.wards
      )
    ) {

      return data.wards;

    }


    if (
      data &&
      Array.isArray(
        data.predictions
      )
    ) {

      return data.predictions;

    }


    if (
      data &&
      typeof data ===
      "object"
    ) {

      const result =
        [];


      for (
        const key of
        Object.keys(
          data
        )
      ) {

        const value =
          data[key];


        if (
          value &&
          typeof value ===
          "object" &&
          !Array.isArray(
            value
          )
        ) {

          result.push({

            ward_id:
              Number(
                key
              ),

            ...value

          });

        }

      }


      if (
        result.length >
        0
      ) {

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


    const match =
      predictions.find(
        prediction => {

          return (
            Number(
              prediction.ward_id ??
              prediction.wardID ??
              prediction.id
            ) ===
            wardId
          );

        }
      );


    return match ||
      null;

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


    const heatData =
      [];


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
        // Skip invalid coordinates
        // -------------------------------------------------

        if (
          !Number.isFinite(
            latitude
          ) ||
          !Number.isFinite(
            longitude
          )
        ) {

          console.warn(
            `⚠️ Missing coordinates for ward ${ward.ward_id}`
          );

          return;

        }


        // -------------------------------------------------
        // Find prediction
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
        // Get prediction data
        // -------------------------------------------------

        let predictionData =
          prediction.prediction;


        if (
          !predictionData ||
          typeof predictionData !==
          "object"
        ) {

          predictionData =
            prediction;

        }


        // -------------------------------------------------
        // Use 3-day prediction
        // -------------------------------------------------

        if (
          predictionData["3d"] &&
          typeof predictionData["3d"] ===
          "object"
        ) {

          predictionData =
            predictionData["3d"];

        }


        // -------------------------------------------------
        // HMRI
        // -------------------------------------------------

        const risk =
          getRiskValue(
            predictionData
          );


        // -------------------------------------------------
        // WBGT
        // -------------------------------------------------

        const wbgt =
          getWBGT(
            predictionData
          );


        // -------------------------------------------------
        // Risk level
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
          !Number.isFinite(
            risk
          )
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
        // Add heat data
        // -------------------------------------------------

        heatData.push(
          [
            latitude,
            longitude,
            intensity
          ]
        );


        // -------------------------------------------------
        // Ward color
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

              color:
                "#ffffff",

              weight: 2,

              fillColor:
                color,

              fillOpacity:
                0.9

            }
          );


        // -------------------------------------------------
        // Popup
        // -------------------------------------------------

        marker.bindPopup(`

          <div
            style="
              min-width:210px
            "
          >

            <strong>
              Ward ${ward.ward_id}
              -
              ${ward.ward_name}
            </strong>

            <hr
              style="
                margin:6px 0
              "
            >

            <div>

              <strong>
                WBGT:
              </strong>

              ${wbgt !== null
            ? `${wbgt.toFixed(2)} °C`
            : "Unavailable"
          }

            </div>

            <div>

              <strong>
                HMRI:
              </strong>

              ${risk.toFixed(2)}

            </div>

            <div>

              <strong>
                Risk Level:
              </strong>

              ${riskLevel}

            </div>

            <div>

              <strong>
                Vulnerability:
              </strong>

              ${Number(
            ward.vulnerability
          ).toFixed(3)}

            </div>

            <div>

              <strong>
                Exposure:
              </strong>

              ${Number(
            ward.exposure
          ).toFixed(3)}

            </div>

            <div>

              <strong>
                Population:
              </strong>

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

    if (
      heatLayer
    ) {

      map.removeLayer(
        heatLayer
      );

      heatLayer =
        null;

    }


    // =====================================================
    // CHECK HEAT DATA
    // =====================================================

    if (
      heatData.length ===
      0
    ) {

      console.error(
        "❌ No valid heat data available."
      );

      return false;

    }


    // =====================================================
    // CREATE NEW HEATMAP
    // =====================================================

    heatLayer =
      L.heatLayer(
        heatData,
        {

          radius: 45,

          blur: 35,

          maxZoom: 13,

          max: 1.0,

          minOpacity:
            0.35,

          gradient: {

            0.0:
              "green",

            0.5:
              "yellow",

            0.8:
              "orange",

            1.0:
              "red"

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
  // LOAD EVERYTHING FOR MAP PAGE
  // =========================================================

  async function initializeDashboard() {

    try {

      console.log(
        "🚀 Initializing TaapSurakshak dashboard..."
      );


      // ---------------------------------------------------
      // Get ward data
      // ---------------------------------------------------

      const wards =
        await loadWards();


      // ---------------------------------------------------
      // Get ML predictions
      // ---------------------------------------------------

      const predictionResponse =
        await loadWardPredictions();


      // ---------------------------------------------------
      // Normalize predictions
      // ---------------------------------------------------

      const predictions =
        normalizePredictions(
          predictionResponse
        );


      console.log(
        "📊 Normalized predictions:",
        predictions
      );


      // ---------------------------------------------------
      // Build heatmap
      // ---------------------------------------------------

      const heatmapCreated =
        createHeatmap(
          wards,
          predictions
        );


      // ---------------------------------------------------
      // Fix Leaflet rendering
      // ---------------------------------------------------

      setTimeout(
        () => {

          map.invalidateSize();

        },
        300
      );


      // ---------------------------------------------------
      // Success
      // ---------------------------------------------------

      if (
        heatmapCreated
      ) {

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
  // START MAP
  // =========================================================

  initializeDashboard();

});