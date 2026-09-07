const express = require('express');
const path = require("path");
const mongoose = require("mongoose");
const User = require("./models/user");
const ejsMate = require("ejs-mate");
const methodOverride = require("method-override");
const bcrypt = require("bcrypt");
const session = require("express-session");

mongoose.connect("mongodb://localhost:27017/TaapSurakshak");

const db = mongoose.connection;
db.on("error", console.error.bind(console, "connection error:"));
db.once("open", () => {
    console.log("Database connected");
});


const app = express();

app.engine("ejs", ejsMate);
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"))


app.use(express.urlencoded({ extended: true }));
app.use(methodOverride("_method"));
app.use(express.static("public"));

app.use(session({
    secret: "taapsurakshak-session-secret-2026",
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        maxAge: 1000 * 60 * 60 * 24
    }
}));
app.use((req, res, next) => {
    res.locals.currentUser = req.session.userName || null;
    next();
});
function isLoggedIn(req, res, next) {
    if (!req.session.userId) {
        return res.redirect("/login");
    }
    next();
}
app.get("/", (req, res) => {
    res.render("home");
});
app.get("/risk", isLoggedIn, (req, res, next) => {
    res.render("TaapSurakshak/risk", {
        userName: req.session.userName
    });
})
app.get("/predict", isLoggedIn, (req, res, next) => {
    res.render("TaapSurakshak/predict", {
        userName: req.session.userName
    });
})
app.get("/intervene", isLoggedIn, (req, res, next) => {
    res.render("TaapSurakshak/intervene", {
        userName: req.session.userName
    });
})
app.get("/alerts", isLoggedIn, (req, res, next) => {
    res.render("TaapSurakshak/alerts", {
        userName: req.session.userName
    });
})
app.get("/login", (req, res, next) => {
    res.render("TaapSurakshak/login");
});
app.post("/signup", async (req, res) => {
    try {
        const { name, location, password } = req.body;

        const existingUser = await User.findOne({ name });

        if (existingUser) {
            // Store the existing user's details in the session
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

        // Log in the newly created user
        req.session.userId = newUser._id;
        req.session.userName = newUser.name;

        res.redirect("/");

    } catch (err) {
        console.error("Signup error:", err);
        res.status(500).send("Error creating user");
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
app.listen(3000, () => {
    console.log("Listening on port 3000");
})