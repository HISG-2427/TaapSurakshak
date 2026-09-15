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

// Local development:
// MONGODB_URI not set -> localhost MongoDB
// FASTAPI_URL not set -> localhost FastAPI
//
// Render:
// MONGODB_URI -> MongoDB Atlas connection string
// FASTAPI_URL -> deployed FastAPI Render URL

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
    getWhatsAppStatus,
    getWhatsAppQRCode
} = require("./backend/app/whatsappHelper");


// ============================================================
// DATABASE CONNECTION
// ============================================================

mongoose.connect(MONGODB_URI);

const db = mongoose.connection;

db.on(
    "error",
    console.error.bind(
        console,
        "Database connection error:"
    )
);

db.once("open", () => {
    console.log("Database connected successfully");
});


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

app.use(methodOverride("_method"));

app.use(express.static("public"));

app.use(express.json());

app.use(
    "/images",
    express.static(
        path.join(__dirname, "images")
    )
);


// ============================================================
// TRUST PROXY
// Needed by Render for secure cookies
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
// HOME
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
                userName:
                    req.session.userName
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
                userName:
                    req.session.userName,

                wardID:
                    req.session.wardID
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
                userName:
                    req.session.userName
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
                userName:
                    req.session.userName
            }
        );

    }
);


// ============================================================
// WHATSAPP STATUS / QR
// Used by Alerts page
// ============================================================

app.get("/api/whatsapp-status", (req, res) => {
    try {
        const status = getWhatsAppStatus();

        console.log("📱 WhatsApp STATUS API:", {
            enabled: status.enabled,
            ready: status.ready,
            hasQR: !!status.qr
        });

        res.json({
            success: true,
            enabled: status.enabled,
            ready: status.ready,
            qr: status.qr || null
        });

    } catch (error) {
        console.error("❌ WhatsApp status error:", error);

        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});


// ============================================================
// OPTIONAL WHATSAPP QR ENDPOINT
// ============================================================

app.get(
    "/api/whatsapp-qr",
    (req, res) => {

        try {

            const qr =
                getWhatsAppQRCode();

            res.json({

                success: true,

                qr:
                    qr || null

            });

        } catch (error) {

            console.error(
                "❌ WhatsApp QR error:",
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
// LOGIN PAGE
// Get wards from FastAPI
// ============================================================

app.get(
    "/login",
    async (req, res) => {

        try {

            const response =
                await fetch(
                    `${FASTAPI_URL}/wards`
                );

            if (!response.ok) {

                throw new Error(
                    `FastAPI returned ${response.status}`
                );

            }

            const wards =
                await response.json();

            console.log(
                "Wards:",
                wards
            );

            res.render(
                "TaapSurakshak/login",
                {
                    wards
                }
            );

        } catch (error) {

            console.error(
                "Error loading wards:",
                error
            );

            res.render(
                "TaapSurakshak/login",
                {
                    wards: []
                }
            );
        }

    }
);


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
                "SIGNUP:",
                req.body
            );


            // --------------------------------------------
            // Required fields
            // --------------------------------------------

            if (
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

                    name: name,

                    location: location,

                    password:
                        hashedPassword,

                    wardID:
                        Number(wardID),

                    age:
                        Number(age),

                    phoneNumber:
                        phoneNumber

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

        } catch (err) {

            console.error(
                "Signup error:",
                err
            );

            res
                .status(500)
                .send(
                    "Error creating user account"
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
            (err) => {

                if (err) {

                    return res
                        .status(500)
                        .send(
                            "Unable to log out"
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
                            "userPrompt is required"

                    });

            }


            const response =
                await ai.models.generateContent({

                    model:
                        "gemini-2.5-flash",

                    contents:
                        userPrompt

                });


            const modelResponse =
                response.text;


            res.json({

                success: true,

                feedback:
                    modelResponse

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
                        "Failed to generate feedback via Gemini API"

                });

        }

    }
);


// ============================================================
// LATEST HEAT DATA
// Express → FastAPI
// ============================================================

app.get(
    "/api/latest-heat-data",
    async (req, res) => {

        try {

            const response =
                await fetch(
                    `${FASTAPI_URL}/predict`,
                    {

                        method: "POST",

                        headers: {
                            "Content-Type":
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


            if (!response.ok) {

                throw new Error(
                    `FastAPI returned status ${response.status}`
                );

            }


            const result =
                await response.json();


            console.log(
                "🔥 FASTAPI /predict RESPONSE:"
            );

            console.log(result);


            // --------------------------------------------
            // 3-day prediction
            // --------------------------------------------

            const prediction =
                result["3d"];


            if (!prediction) {

                throw new Error(
                    "3d prediction not found in FastAPI response."
                );

            }


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
                    prediction.risk_level

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

app.post(
    "/api/generate-personalized-whatsapp",
    async (req, res) => {

        try {

            const {
                phoneNumber,
                name,
                age,
                overall_risk,
                temperature
            } = req.body;


            if (!phoneNumber || !name) {

                return res.status(400).json({
                    success: false,
                    message: "Phone number and name are required."
                });

            }


            // Your existing personalization / WhatsApp logic
            // goes here.


        } catch (error) {

            console.error(
                "❌ WhatsApp generation error:",
                error
            );

            res.status(500).json({
                success: false,
                message: error.message
            });

        }

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

            service:
                "TaapSurakshak",

            fastapi:
                FASTAPI_URL

        });

    }
);


// ============================================================
// START SERVER
// ============================================================

const PORT =
    process.env.PORT || 3000;


app.listen(
    PORT,
    "0.0.0.0",
    () => {

        console.log(
            `Server running on port ${PORT}`
        );

        console.log(
            `FastAPI URL: ${FASTAPI_URL}`
        );

        console.log(
            `WhatsApp enabled: ${process.env.ENABLE_WHATSAPP === "true"}`
        );

    }
);