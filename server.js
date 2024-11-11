require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const multer = require("multer");
const User = require("./models/User");
const path = require("path");
const app = express();

// Debug middleware
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

// Middleware setup
app.use(express.json());
app.use(express.static("public"));

// MongoDB connection
console.log("Attempting MongoDB connection...");
mongoose.connect(process.env.MONGODB_URI)
    .then(() => {
        console.log("MongoDB connected successfully");
        
        // Only set up sessions after MongoDB connects
        setupSessions();
        setupRoutes();
    })
    .catch(err => {
        console.error("MongoDB connection error:", err);
        process.exit(1);
    });

function setupSessions() {
    // Session configuration
    app.use(session({
        secret: process.env.SESSION_SECRET,
        resave: false,
        saveUninitialized: false,
        store: MongoStore.create({ 
            mongoUrl: process.env.MONGODB_URI,
            ttl: 24 * 60 * 60,
            autoRemove: "native"
        }),
        cookie: {
            secure: false, // Set to true only if using HTTPS
            httpOnly: true,
            maxAge: 24 * 60 * 60 * 1000 // 24 hours
        }
    }));
}

function setupRoutes() {
    // Test route
    app.get("/test-env", (req, res) => {
        console.log("Session data:", req.session);
        res.json({
            mongoDBConnected: mongoose.connection.readyState === 1,
            nodeEnv: process.env.NODE_ENV,
            port: process.env.PORT,
            sessionActive: !!req.session,
            sessionID: req.sessionID,
            userId: req.session?.userId
        });
    });

    // Test DB route
    app.get("/test-db", async (req, res) => {
        try {
            // Basic connection test
            const isConnected = mongoose.connection.readyState === 1;
            
            // Optional: Get count of users to verify database access
            const userCount = await User.countDocuments();
            
            res.json({
                connected: isConnected,
                userCount,
                status: "Database connection test successful"
            });
        } catch (error) {
            console.error("Database test error:", error);
            res.status(500).json({
                connected: false,
                error: error.message
            });
        }
    });

    // Add test users route
app.post("/test-db/add-users", async (req, res) => {
    try {
        // Create test users (without pre-hashing passwords)
        const testUsers = [
            { username: "alice", password: "test123" },
            { username: "bob", password: "test123" },
            { username: "charlie", password: "test123" }
        ];

        // Clear existing users
        await User.deleteMany({});

        // Add new users (passwords will be hashed by the pre-save middleware)
        const createdUsers = await Promise.all(
            testUsers.map(user => new User(user).save())
        );

        // Verify we can find and authenticate a user
        const testFind = await User.findOne({ username: "alice" });
        console.log("Test find user alice:", testFind ? "found" : "not found");
        if (testFind) {
            const testPassword = await bcrypt.compare("test123", testFind.password);
            console.log("Password test result:", testPassword);
        }

        res.json({
            success: true,
            message: "Test users created successfully",
            userCount: createdUsers.length,
            users: createdUsers.map(user => ({
                username: user.username,
                id: user._id
            }))
        });
    } catch (error) {
        console.error("Error creating test users:", error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});


// Login route
app.post("/login", async (req, res) => {
    try {
        const { username, password } = req.body;
        console.log("Login attempt for:", username);

        const user = await User.findOne({ username });
        if (!user) {
            console.log("User not found:", username);
            return res.status(401).json({ error: "Invalid credentials" });
        }

        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            console.log("Invalid password for:", username);
            return res.status(401).json({ error: "Invalid credentials" });
        }

        req.session.userId = user._id;
        req.session.user = {
            id: user._id,
            username: user.username
        };

        console.log("Session after login:", req.session);
        
        res.json({ 
            success: true, 
            user: { username: user.username }
        });
    } catch (error) {
        console.error("Login error:", error);
        res.status(500).json({ error: "Login failed" });
    }
});


// Add this before the signup route
    // Session check route
    app.get("/check-session", (req, res) => {
        console.log("Checking session:", req.session);
        if (req.session && req.session.userId) {
            res.json({ 
                authenticated: true,
                user: {
                    username: req.session.user?.username
                }
            });
        } else {
            res.json({ authenticated: false });
        }
    });


    // Signup route
    app.post("/signup", async (req, res) => {
        try {
            const { username, password } = req.body;
            
            if (!username || !password) {
                return res.status(400).json({ error: "Username and password are required" });
            }

            const existingUser = await User.findOne({ username });
            if (existingUser) {
                return res.status(400).json({ error: "Username already exists" });
            }

            const user = new User({ username, password });
            await user.save();

            req.session.userId = user._id;
            req.session.user = {
                id: user._id,
                username: user.username
            };

            res.json({ 
                success: true, 
                user: { 
                    username: user.username,
                    id: user._id 
                }
            });
        } catch (error) {
            console.error("Signup error:", error);
            res.status(500).json({ error: error.message });
        }
    });

    // Logout route
    app.post("/logout", (req, res) => {
        req.session.destroy(err => {
            if (err) {
                console.error("Logout error:", err);
                return res.status(500).json({ error: "Logout failed" });
            }
            res.json({ success: true });
        });
    });
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT} in ${process.env.NODE_ENV || "development"} mode`);
});
