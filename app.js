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

// Import SMS Helper Function
const { sendSMSFeedback } = require("./backend/app/smsHelper");

// Database Connection
mongoose.connect("mongodb://localhost:27017/TaapSurakshak");

const db = mongoose.connection;
db.on("error", console.error.bind(console, "Database connection error:"));
db.once("open", () => {
    console.log("Database connected successfully");
});

const app = express();

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

app.get("/login", (req, res) => {
    res.render("TaapSurakshak/login");
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

        // Dispatch SMS if phone number exists
        if (phoneNumber) {
            await sendSMSFeedback(phoneNumber, modelResponse);
        }

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

// Heat Stress Machine Learning API Integration
app.get("/api/latest-heat-data", async (req, res) => {
    try {
        const response = await fetch("http://127.0.0.1:8000/predict", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                temp_mean_c: 30,
                temp_max_c: 35,
                temp_min_c: 27,
                humidity_pct: 70,
                wind_speed_ms: 2,
                solar_radiation_kwh_m2: 5
            })
        });

        const prediction = await response.json();

        if (!response.ok) {
            console.error("FastAPI prediction error:", prediction);
            return res.status(response.status).json({
                success: false,
                message: prediction.detail || "FastAPI prediction request failed."
            });
        }

        if (
            !prediction["3d"] ||
            prediction["3d"].wbgt_c === undefined ||
            prediction["3d"].hmri === undefined ||
            prediction["3d"].risk_level === undefined
        ) {
            return res.status(500).json({
                success: false,
                message: "Invalid prediction payload structure from FastAPI."
            });
        }

        res.json({
            success: true,
            heatStress: Number(prediction["3d"].wbgt_c),
            mortalityRisk: Number(prediction["3d"].hmri),
            riskLevel: prediction["3d"].risk_level,
            forecast: prediction
        });

    } catch (error) {
        console.error("Heat data error:", error);
        res.status(500).json({
            success: false,
            message: "Could not connect to FastAPI server. Ensure it is running on port 8000."
        });
    }
});

// Personalized SMS Alert Generation Endpoint
app.post("/api/generate-personalized-sms", async (req, res) => {
    try {
        console.log("SMS request body:", req.body);

        const { name, age, phoneNumber, heat_risk, mortality_index } = req.body;

        if (!name || !age || !phoneNumber) {
            return res.status(400).json({
                success: false,
                message: "Name, age, and phone number are required."
            });
        }

        if (
            heat_risk === undefined || heat_risk === null ||
            mortality_index === undefined || mortality_index === null
        ) {
            return res.status(400).json({
                success: false,
                message: "Heat-risk data is missing."
            });
        }

        const fastApiResponse = await fetch(
            "http://127.0.0.1:8000/personalized-suggestion",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    name: String(name).trim(),
                    age: Number(age),
                    phone_number: String(phoneNumber).trim(),
                    heat_risk: Number(heat_risk),
                    mortality_index: Number(mortality_index)
                })
            }
        );

        const responseText = await fastApiResponse.text();

        let prediction;
        try {
            prediction = JSON.parse(responseText);
        } catch {
            return res.status(500).json({
                success: false,
                message: "FastAPI did not return valid JSON."
            });
        }

        if (!fastApiResponse.ok) {
            return res.status(400).json({
                success: false,
                message: prediction.message || "FastAPI request failed."
            });
        }

        const personalizedMessage = `Hi ${name}, ${prediction.message}`;

        // Send SMS via your SMS helper
        const smsResult = await sendSMSFeedback(
            phoneNumber,
            personalizedMessage
        );

        return res.json({
            success: true,
            feedback: personalizedMessage,
            smsSid: smsResult ? smsResult.sid : null,
            smsStatus: smsResult ? smsResult.status : "sent",
            risk_level: prediction.risk_level,
            priority: prediction.priority
        });

    } catch (error) {
        console.error("Personalized SMS error:", error);
        return res.status(500).json({
            success: false,
            message: error.message || "Server error while generating personalized SMS."
        });
    }
});

// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});