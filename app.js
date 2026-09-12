const express = require('express');
const path = require("path");
const mongoose = require("mongoose");
const User = require("./models/user");
const ejsMate = require("ejs-mate");
const methodOverride = require("method-override");
const bcrypt = require("bcrypt");
const session = require("express-session");
const MongoStore = require("connect-mongo");
require("dotenv").config({
    path: path.resolve(__dirname, ".env")
});

// Import Google GenAI SDK
const { GoogleGenAI } = require("@google/genai");
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });


// Database Connection
mongoose.connect("mongodb://localhost:27017/TaapSurakshak");

const db = mongoose.connection;
db.on("error", console.error.bind(console, "Database connection error:"));
db.once("open", () => {
    console.log("Database connected successfully");
});

const app = express();

const {
    sendWhatsAppFeedback,
    isWhatsAppReady
} = require("./backend/app/whatsappHelper");

// View Engine & Static Middleware Configuration
app.engine("ejs", ejsMate);
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(express.urlencoded({ extended: true }));
app.use(methodOverride("_method"));
app.use(express.static("public"));
app.use(express.json());
app.use("/images", express.static(path.join(__dirname, "images")));

// Express Session & MongoStore Setup
app.use(session({
    secret: process.env.SESSION_SECRET || "taapsurakshak-session-secret-2026",
    store: MongoStore.create({
        mongoUrl: "mongodb://localhost:27017/TaapSurakshak",
        collectionName: "sessions"
    }),
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        maxAge: 1000 * 60 * 60 * 24 // 1 Day
    }
}));

// Global Middleware for Session Views
app.use((req, res, next) => {
    res.locals.currentUser = req.session.userName || null;
    next();
});

// Authentication Guard Middleware
function isLoggedIn(req, res, next) {
    if (!req.session.userId) {
        return res.redirect("/login");
    }
    next();
}

// Page Routes
app.get("/", (req, res) => {
    res.render("home");
});

app.get("/risk", isLoggedIn, (req, res) => {
    res.render("TaapSurakshak/risk", {
        userName: req.session.userName
    });
});

app.get("/predict", isLoggedIn, (req, res) => {
    res.render("TaapSurakshak/predict", {
        userName: req.session.userName
    });
});

app.get("/intervene", isLoggedIn, (req, res) => {
    res.render("TaapSurakshak/intervene", {
        userName: req.session.userName
    });
});

app.get("/alerts", isLoggedIn, (req, res) => {
    res.render("TaapSurakshak/alerts", {
        userName: req.session.userName
    });
});

app.get("/login", async (req, res) => {
    try {
        const response = await fetch("http://127.0.0.1:8000/wards");

        if (!response.ok) {
            throw new Error(`FastAPI returned ${response.status}`);
        }

        const wards = await response.json();

        console.log("Wards:", wards);

        res.render("login", {
            wards
        });

    } catch (error) {
        console.error("Error loading wards:", error);

        res.render("login", {
            wards: []
        });
    }
});

// Auth API Endpoints
app.post("/signup", async (req, res) => {
    try {
        const { name, location, password } = req.body;

        const existingUser = await User.findOne({ name });

        if (existingUser) {
            req.session.userId = existingUser._id;
            req.session.userName = existingUser.name;
            return res.redirect("/");
        }

        const hashedPassword = await bcrypt.hash(password, 12);

        const newUser = new User({
            name,
            location,
            password: hashedPassword
        });

        await newUser.save();

        req.session.userId = newUser._id;
        req.session.userName = newUser.name;

        res.redirect("/");

    } catch (err) {
        console.error("Signup error:", err);
        res.status(500).send("Error creating user account");
    }
});

app.get("/logout", (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).send("Unable to log out");
        }
        res.redirect("/login");
    });
});

// Gemini AI & Feedback API Endpoint
app.post("/api/generate-feedback", async (req, res) => {
    try {
        const { userPrompt, phoneNumber } = req.body;

        if (!userPrompt) {
            return res.status(400).json({
                success: false,
                message: "userPrompt is required"
            });
        }

        // Generate response using @google/genai SDK
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: userPrompt,
        });

        const modelResponse = response.text;

        res.json({
            success: true,
            feedback: modelResponse
        });
    } catch (error) {
        console.error("Feedback generation error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to generate feedback via Gemini API"
        });
    }
});

app.get("/api/latest-heat-data", async (req, res) => {
    try {
        const response = await fetch("http://127.0.0.1:8000/predict", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                temp_mean_c: 35,
                temp_max_c: 40,
                temp_min_c: 30,
                humidity_pct: 60,
                wind_speed_ms: 2,
                solar_radiation_kwh_m2: 5
            })
        });

        if (!response.ok) {
            throw new Error(
                `FastAPI returned status ${response.status}`
            );
        }

        const result = await response.json();

        console.log("🔥 FASTAPI /predict RESPONSE:");
        console.log(result);

        // Use 3-day prediction
        const prediction = result["3d"];

        if (!prediction) {
            throw new Error("3d prediction not found in FastAPI response.");
        }

        res.json({
            success: true,

            // These are for internal/dashboard use
            heatStress: Number(prediction.wbgt_c),
            mortalityRisk: Number(prediction.hmri),
            riskLevel: prediction.risk_level
        });

    } catch (error) {
        console.error("Latest heat data error:", error);

        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});
app.post("/api/generate-personalized-whatsapp", async (req, res) => {
    try {
        const {
            name,
            age,
            phoneNumber,
            temperature
        } = req.body;

        if (!name || !phoneNumber) {
            return res.status(400).json({
                success: false,
                message: "Name and WhatsApp number are required."
            });
        }

        if (!isWhatsAppReady()) {
            return res.status(503).json({
                success: false,
                message: "WhatsApp is not ready. Scan QR code first."
            });
        }

        // Get WBGT + mortality + risk level
        const heatResponse = await fetch(
            "http://127.0.0.1:3000/api/latest-heat-data"
        );

        if (!heatResponse.ok) {
            throw new Error("Could not get heat-risk data.");
        }

        const heatData = await heatResponse.json();

        const wbgt = heatData.heatStress;
        const mortalityRisk = heatData.mortalityRisk;
        const riskLevel = heatData.riskLevel;

        let suggestion = "";

        if (riskLevel === "LEVEL 5") {
            suggestion =
                "Extreme heat risk. Stay indoors, remain hydrated, avoid direct sunlight and strenuous activity, and check on vulnerable people.";
        } else if (riskLevel === "LEVEL 4") {
            suggestion =
                "Very high heat risk. Avoid unnecessary outdoor exposure, stay hydrated, and take frequent breaks in cool areas.";
        } else if (riskLevel === "LEVEL 3") {
            suggestion =
                "Moderate to high heat risk. Stay hydrated and limit prolonged outdoor activity.";
        } else {
            suggestion =
                "Continue normal hydration and basic heat-safety precautions.";
        }

        const result = await sendWhatsAppFeedback(
            phoneNumber,
            name,
            temperature,
            riskLevel,
            suggestion
        );

        res.json({
            success: true,
            message: "WhatsApp alert sent successfully.",
            data: {
                temperature,
                wbgt,
                mortalityRisk,
                riskLevel,
                suggestion
            },
            result
        });

    } catch (error) {
        console.error("WhatsApp alert error:", error);

        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});