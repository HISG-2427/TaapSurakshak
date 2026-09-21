const express = require("express");
const path = require("path");
const mongoose = require("mongoose");
const User = require("./models/user");
const ejsMate = require("ejs-mate");
const methodOverride = require("method-override");
const bcrypt = require("bcrypt");
const session = require("express-session");
const { MongoStore } = require("connect-mongo");

require("dotenv").config({
    path: path.resolve(__dirname, ".env")
});

// ============================================================
// GEMINI AI
// ============================================================

const { GoogleGenAI } = require("@google/genai");

const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY
});

// ============================================================
// ENVIRONMENT VARIABLES
// ============================================================

const MONGODB_URI =
    process.env.MONGODB_URI ||
    "mongodb://localhost:27017/TaapSurakshak";

const FASTAPI_URL =
    process.env.FASTAPI_URL ||
    "http://127.0.0.1:8000";

// ============================================================
// EXPRESS APP
// ============================================================

const app = express();

// ============================================================
// WHATSAPP HELPER
// ============================================================

const {
    sendWhatsAppFeedback,
    isWhatsAppReady,
    getWhatsAppStatus
} = require("./backend/app/whatsappHelper");

// ============================================================
// DATABASE CONNECTION
// ============================================================

mongoose
    .connect(MONGODB_URI)
    .then(() => {
        console.log("Database connected successfully");
    })
    .catch((error) => {
        console.error("Database connection error:", error);
    });

const db = mongoose.connection;

db.on("error", console.error.bind(
    console,
    "Database connection error:"
));

// ============================================================
// VIEW ENGINE
// ============================================================

app.engine("ejs", ejsMate);

app.set("view engine", "ejs");

app.set(
    "views",
    path.join(__dirname, "views")
);

// ============================================================
// MIDDLEWARE
// ============================================================

app.use(
    express.urlencoded({
        extended: true
    })
);

app.use(express.json());

app.use(methodOverride("_method"));

app.use(
    express.static(
        path.join(__dirname, "public")
    )
);

app.use(
    "/images",
    express.static(
        path.join(__dirname, "images")
    )
);

// ============================================================
// TRUST PROXY
// Required for Render secure cookies
// ============================================================

if (process.env.NODE_ENV === "production") {
    app.set("trust proxy", 1);
}

// ============================================================
// SESSION
// ============================================================

app.use(
    session({
        secret:
            process.env.SESSION_SECRET ||
            "taapsurakshak-session-secret-2026",

        store: MongoStore.create({
            mongoUrl: MONGODB_URI,
            collectionName: "sessions"
        }),

        resave: false,

        saveUninitialized: false,

        cookie: {
            httpOnly: true,

            secure:
                process.env.NODE_ENV === "production",

            maxAge:
                1000 *
                60 *
                60 *
                24
        }
    })
);

// ============================================================
// GLOBAL SESSION LOCALS
// ============================================================

app.use((req, res, next) => {
    res.locals.currentUser =
        req.session.userName || null;

    res.locals.wardID =
        req.session.wardID || null;

    next();
});

// ============================================================
// LOGIN CHECK
// ============================================================

function isLoggedIn(req, res, next) {
    if (!req.session.userId) {
        return res.redirect("/login");
    }

    next();
}

// ============================================================
// HOME PAGE
// ============================================================

app.get("/", (req, res) => {
    res.render("home");
});

// ============================================================
// RISK PAGE
// ============================================================

app.get(
    "/risk",
    isLoggedIn,
    (req, res) => {
        res.render(
            "TaapSurakshak/risk",
            {
                userName: req.session.userName
            }
        );
    }
);

// ============================================================
// PREDICT PAGE
// ============================================================

app.get(
    "/predict",
    isLoggedIn,
    (req, res) => {
        res.render(
            "TaapSurakshak/predict",
            {
                userName: req.session.userName,
                wardID: req.session.wardID
            }
        );
    }
);

// ============================================================
// INTERVENE PAGE
// ============================================================

app.get(
    "/intervene",
    isLoggedIn,
    (req, res) => {
        res.render(
            "TaapSurakshak/intervene",
            {
                userName: req.session.userName
            }
        );
    }
);

// ============================================================
// ALERTS PAGE
// ============================================================

app.get(
    "/alerts",
    isLoggedIn,
    (req, res) => {
        res.render(
            "TaapSurakshak/alerts",
            {
                userName: req.session.userName
            }
        );
    }
);

// ============================================================
// LOGIN PAGE
// Loads wards from FastAPI
// ============================================================

app.get("/login", async (req, res) => {

    try {

        console.log("🔵 Loading wards from FastAPI...");

        let response;
        let lastError;

        // Try up to 3 times
        for (let attempt = 1; attempt <= 3; attempt++) {

            try {

                console.log(
                    `🔵 Wards request attempt ${attempt}`
                );

                response = await fetch(
                    `${FASTAPI_URL}/wards`
                );

                if (response.ok) {
                    break;
                }

                throw new Error(
                    `FastAPI returned ${response.status}`
                );

            } catch (error) {

                lastError = error;

                console.error(
                    `❌ Wards attempt ${attempt} failed:`,
                    error.message
                );

                // Wait before retry
                if (attempt < 3) {
                    await new Promise(
                        resolve => setTimeout(resolve, 3000)
                    );
                }
            }
        }

        if (!response || !response.ok) {
            throw lastError ||
            new Error("Unable to load wards");
        }

        const wards = await response.json();

        console.log(
            "🟢 Wards successfully loaded:",
            wards
        );

        res.render(
            "TaapSurakshak/login",
            {
                wards: Array.isArray(wards)
                    ? wards
                    : []
            }
        );

    } catch (error) {

        console.error(
            "🔴 Final wards loading error:",
            error
        );

        res.render(
            "TaapSurakshak/login",
            {
                wards: []
            }
        );
    }
});
// ============================================================
// SIGNUP
// ============================================================

app.post(
    "/signup",
    async (req, res) => {
        try {
            const {
                name,
                location,
                password,
                wardID,
                phoneNumber,
                age
            } = req.body;

            console.log(
                "SIGNUP REQUEST:",
                req.body
            );

            // --------------------------------------------
            // Validate required fields
            // --------------------------------------------

            if (
                !name ||
                !location ||
                !password ||
                !wardID ||
                !phoneNumber ||
                !age
            ) {
                return res
                    .status(400)
                    .send(
                        "Missing required signup fields."
                    );
            }

            // --------------------------------------------
            // Validate age
            // --------------------------------------------

            const numericAge = Number(age);

            if (
                !Number.isFinite(numericAge) ||
                numericAge < 1 ||
                numericAge > 120
            ) {
                return res
                    .status(400)
                    .send(
                        "Please enter a valid age."
                    );
            }

            // --------------------------------------------
            // Check existing user
            // --------------------------------------------

            const existingUser =
                await User.findOne({
                    name
                });

            if (existingUser) {
                req.session.userId =
                    existingUser._id;

                req.session.userName =
                    existingUser.name;

                req.session.wardID =
                    Number(wardID);

                existingUser.wardID =
                    Number(wardID);

                await existingUser.save();

                return res.redirect("/");
            }

            // --------------------------------------------
            // Hash password
            // --------------------------------------------

            const hashedPassword =
                await bcrypt.hash(
                    password,
                    12
                );

            // --------------------------------------------
            // Create user
            // --------------------------------------------

            const newUser =
                new User({
                    name: String(name).trim(),

                    location: String(location).trim(),

                    password: hashedPassword,

                    wardID: Number(wardID),

                    age: numericAge,

                    phoneNumber: String(phoneNumber).trim()
                });

            await newUser.save();

            // --------------------------------------------
            // Create session
            // --------------------------------------------

            req.session.userId =
                newUser._id;

            req.session.userName =
                newUser.name;

            req.session.wardID =
                Number(wardID);

            console.log(
                "USER CREATED:",
                newUser._id
            );

            res.redirect("/");
        } catch (error) {
            console.error(
                "Signup error:",
                error
            );

            res
                .status(500)
                .send(
                    "Error creating user account."
                );
        }
    }
);

// ============================================================
// LOGOUT
// ============================================================

app.get(
    "/logout",
    (req, res) => {
        req.session.destroy(
            (error) => {
                if (error) {
                    console.error(
                        "Logout error:",
                        error
                    );

                    return res
                        .status(500)
                        .send(
                            "Unable to log out."
                        );
                }

                res.redirect("/login");
            }
        );
    }
);

// ============================================================
// GEMINI AI FEEDBACK
// ============================================================

app.post(
    "/api/generate-feedback",
    async (req, res) => {
        try {
            const {
                userPrompt,
                phoneNumber
            } = req.body;

            if (!userPrompt) {
                return res
                    .status(400)
                    .json({
                        success: false,
                        message:
                            "userPrompt is required."
                    });
            }

            const response =
                await ai.models.generateContent({
                    model: "gemini-2.5-flash",
                    contents: userPrompt
                });

            const modelResponse =
                response.text;

            res.json({
                success: true,
                feedback: modelResponse
            });
        } catch (error) {
            console.error(
                "Feedback generation error:",
                error
            );

            res
                .status(500)
                .json({
                    success: false,
                    message:
                        "Failed to generate feedback via Gemini API."
                });
        }
    }
);

// ============================================================
// WHATSAPP STATUS + REAL QR
// ============================================================

app.get("/api/whatsapp-status", (req, res) => {
    try {
        const status = getWhatsAppStatus();

        console.log("📡 WhatsApp status request:", {
            enabled: status?.enabled,
            ready: status?.ready,
            state: status?.state,
            hasQR: Boolean(status?.qr),
            error: status?.error || null
        });

        return res.status(200).json({
            success: true,
            enabled: Boolean(status?.enabled),
            ready: Boolean(status?.ready),
            state: status?.state || "UNKNOWN",
            qr: status?.qr || null,
            error: status?.error || null
        });

    } catch (error) {

        console.error("❌ WhatsApp status route error:", error);

        return res.status(200).json({
            success: false,
            enabled: false,
            ready: false,
            state: "ERROR",
            qr: null,
            error: error?.message || String(error)
        });
    }
});

// ============================================================
// LATEST HEAT DATA
// Express → FastAPI
// ============================================================

app.get(
    "/api/latest-heat-data",
    async (req, res) => {
        try {

            // ==========================================
            // 1. GET REAL WEATHER DATA FROM OPEN-METEO
            // ==========================================

            const weatherResponse = await fetch(
                "https://api.open-meteo.com/v1/forecast" +
                "?latitude=19.0760" +
                "&longitude=72.8777" +
                "&daily=temperature_2m_max" +
                "&current=temperature_2m" +
                "&timezone=Asia%2FKolkata"
            );

            if (!weatherResponse.ok) {
                const errorBody =
                    await weatherResponse.text();

                console.error(
                    "WEATHER API ERROR:",
                    weatherResponse.status,
                    errorBody
                );

                throw new Error(
                    `Weather API returned ${weatherResponse.status}`
                );
            }

            const weatherData =
                await weatherResponse.json();

            console.log(
                "🌡️ WEATHER API RESPONSE:",
                weatherData
            );


            // Today's peak temperature
            const peakTemperature =
                Number(
                    weatherData.daily
                        ?.temperature_2m_max?.[0]
                );

            if (!Number.isFinite(peakTemperature)) {
                throw new Error(
                    "Peak temperature not found from Weather API."
                );
            }


            // ==========================================
            // 2. SEND DATA TO FASTAPI ML MODEL
            // ==========================================

            const response =
                await fetch(
                    `${FASTAPI_URL}/predict`,
                    {
                        method: "POST",

                        headers: {
                            "Content-Type":
                                "application/json",

                            "Accept":
                                "application/json"
                        },

                        body:
                            JSON.stringify({
                                temp_mean_c: 35,

                                // REAL WEATHER API TEMPERATURE
                                temp_max_c:
                                    peakTemperature,

                                temp_min_c: 30,

                                humidity_pct: 60,

                                wind_speed_ms: 2,

                                solar_radiation_kwh_m2: 5


                            })
                    }
                );


            if (!response.ok) {

                const errorBody =
                    await response.text();

                console.error(
                    "FASTAPI ERROR STATUS:",
                    response.status
                );

                console.error(
                    "FASTAPI ERROR BODY:",
                    errorBody
                );

                throw new Error(
                    `FastAPI returned status ${response.status}: ${errorBody}`
                );
            }


            const result =
                await response.json();


            console.log(
                "FASTAPI /predict RESPONSE:",
                result
            );


            // ==========================================
            // 3. GET 3-DAY PREDICTION
            // ==========================================

            const prediction =
                result["3d"];


            if (!prediction) {
                throw new Error(
                    "3d prediction not found in FastAPI response."
                );
            }


            // ==========================================
            // 4. SEND EVERYTHING TO FRONTEND
            // ==========================================

            res.json({

                success: true,

                heatStress:
                    Number(
                        prediction.wbgt_c
                    ),

                mortalityRisk:
                    Number(
                        prediction.hmri
                    ),

                riskLevel:
                    prediction.risk_level,

                // REAL WEATHER API TEMPERATURE
                temperature:
                    peakTemperature,

                forecast:
                    result
            });


        } catch (error) {

            console.error(
                "Latest heat data error:",
                error
            );

            res
                .status(500)
                .json({
                    success: false,
                    message:
                        error.message
                });
        }
    }
);

// ============================================================
// PERSONALIZED WHATSAPP ALERT
// ============================================================

// ============================================================
// PERSONALIZED WHATSAPP ALERT
// ============================================================

app.post(
    "/api/generate-personalized-whatsapp",
    async (req, res) => {
        try {

            const {
                name,
                age,
                phoneNumber,
                temperature,

                // Risk level coming from Alerts page
                riskLevel: clientRiskLevel

            } = req.body;


            // --------------------------------------------
            // Validate input
            // --------------------------------------------

            const cleanName =
                String(name || "").trim();

            const cleanPhone =
                String(phoneNumber || "").trim();

            const numericAge =
                Number(age);

            const numericTemperature =
                Number(temperature);


            if (
                !cleanName ||
                !cleanPhone
            ) {
                return res
                    .status(400)
                    .json({
                        success: false,
                        message:
                            "Name and WhatsApp number are required."
                    });
            }


            if (
                !Number.isFinite(numericAge) ||
                numericAge < 1 ||
                numericAge > 120
            ) {
                return res
                    .status(400)
                    .json({
                        success: false,
                        message:
                            "Please enter a valid age."
                    });
            }


            if (
                !Number.isFinite(numericTemperature)
            ) {
                return res
                    .status(400)
                    .json({
                        success: false,
                        message:
                            "Temperature must be a valid number."
                    });
            }


            // --------------------------------------------
            // Check WhatsApp connection
            // --------------------------------------------

            if (!isWhatsAppReady()) {
                return res
                    .status(503)
                    .json({
                        success: false,
                        message:
                            "WhatsApp is not ready. Scan the QR code first and wait until WhatsApp successfully connects."
                    });
            }


            // --------------------------------------------
            // Get latest heat data from FastAPI
            // --------------------------------------------

            const heatResponse =
                await fetch(
                    `${FASTAPI_URL}/predict`,
                    {
                        method: "POST",

                        headers: {
                            "Content-Type":
                                "application/json",

                            "Accept":
                                "application/json"
                        },

                        body:
                            JSON.stringify({
                                temp_mean_c: 35,
                                temp_max_c: 40,
                                temp_min_c: 30,
                                humidity_pct: 60,
                                wind_speed_ms: 2,
                                solar_radiation_kwh_m2: 5
                            })
                    }
                );


            if (!heatResponse.ok) {
                throw new Error(
                    "Could not get heat-risk data from FastAPI."
                );
            }


            const heatResult =
                await heatResponse.json();


            console.log(
                "FASTAPI /predict RESPONSE:",
                heatResult
            );


            const prediction =
                heatResult["3d"];


            if (!prediction) {
                throw new Error(
                    "3d prediction not found in FastAPI response."
                );
            }


            // --------------------------------------------
            // Extract FastAPI prediction values
            // --------------------------------------------

            const wbgt =
                Number(
                    prediction.wbgt_c
                );


            const mortalityRisk =
                Number(
                    prediction.hmri
                );


            // --------------------------------------------
            // FINAL RISK LEVEL
            // --------------------------------------------
            //
            // First use the risk level currently shown
            // on the Alerts page.
            //
            // If Alerts page did not send one,
            // use FastAPI's risk_level.
            // --------------------------------------------

            const fastApiRiskLevel =
                prediction.risk_level ||
                "UNKNOWN";


            const riskLevel =
                String(clientRiskLevel || "").trim() ||
                fastApiRiskLevel;


            console.log(
                "FINAL WHATSAPP RISK LEVEL:",
                riskLevel
            );


            // --------------------------------------------
            // Generate safety suggestion
            // --------------------------------------------

            let suggestion = "";


            const normalizedRisk =
                String(
                    riskLevel
                ).toUpperCase();


            if (
                normalizedRisk === "LEVEL 5"
            ) {

                suggestion =
                    "Extreme heat risk. Stay indoors, remain hydrated, avoid direct sunlight and strenuous activity, and check on vulnerable people.";

            } else if (
                normalizedRisk === "LEVEL 4"
            ) {

                suggestion =
                    "Very high heat risk. Avoid unnecessary outdoor exposure, stay hydrated, and take frequent breaks in cool areas.";

            } else if (
                normalizedRisk === "LEVEL 3"
            ) {

                suggestion =
                    "Moderate to high heat risk. Stay hydrated and limit prolonged outdoor activity.";

            } else if (
                normalizedRisk === "LEVEL 2"
            ) {

                suggestion =
                    "Mild heat risk. Stay hydrated, avoid prolonged exposure to extreme heat, and take regular breaks.";

            } else {

                suggestion =
                    "Continue normal hydration and basic heat-safety precautions.";
            }


            // --------------------------------------------
            // Send WhatsApp message
            // --------------------------------------------

            const result =
                await sendWhatsAppFeedback(
                    cleanPhone,
                    cleanName,
                    numericTemperature,

                    // Actual risk level
                    riskLevel,

                    suggestion
                );


            // --------------------------------------------
            // Send response to Alerts page
            // --------------------------------------------

            res.json({

                success: true,

                message:
                    "WhatsApp alert sent successfully.",

                data: {

                    temperature:
                        numericTemperature,

                    wbgt,

                    mortalityRisk,

                    // Final risk level used
                    riskLevel,

                    // Shows where it came from
                    riskLevelSource:
                        String(clientRiskLevel || "").trim()
                            ? "alerts-page"
                            : "fastapi",

                    suggestion
                },

                result
            });


        } catch (error) {

            console.error(
                "WhatsApp alert error:",
                error
            );


            res
                .status(500)
                .json({

                    success: false,

                    message:
                        error.message

                });
        }
    }
);
// ============================================================
// BACKWARD-COMPATIBLE SMS ROUTE
// ============================================================

app.post(
    "/api/generate-personalized-sms",
    (req, res, next) => {
        req.url =
            "/api/generate-personalized-whatsapp";

        next();
    }
);

// ============================================================
// HEALTH CHECK
// Useful for Render
// ============================================================

app.get(
    "/health",
    (req, res) => {
        res.json({
            status: "ok",
            service: "TaapSurakshak",
            fastapi: FASTAPI_URL
        });
    }
);

// ============================================================
// START SERVER
// ============================================================

const PORT = process.env.PORT || 3000;

if (require.main === module) {
    app.listen(PORT, "0.0.0.0", () => {
        console.log(`Server running on port ${PORT}`);
        console.log(`FastAPI URL: ${FASTAPI_URL}`);
    });
}

module.exports = app;