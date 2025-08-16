require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const multer = require("multer");
const { User, Post } = require("./models/User");
const path = require("path");
const fs = require("fs");
const cloudinary = require("cloudinary").v2;

const app = express();

// --- Cloudinary configuration ---
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// --- Multer configuration for image uploads ---
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadPath = path.join(__dirname, "public", "uploads");
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + "-" + file.originalname);
    }
});
const upload = multer({
    storage: storage,
    fileFilter: function (req, file, cb) {
        if (!file.originalname.match(/\.(jpg|jpeg|png|gif)$/i)) {
            return cb(new Error("Only image files are allowed!"), false);
        }
        cb(null, true);
    }
});

// --- Middleware ---
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(path.join(__dirname, "public/uploads")));
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

// --- MongoDB connection ---
mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => {
        console.log("MongoDB connected.");
        setupSession();
        setupRoutes();
    })
    .catch(err => {
        console.error("MongoDB connection error:", err);
        process.exit(1);
    });

// --- Session configuration ---
function setupSession() {
    app.use(session({
        secret: process.env.SESSION_SECRET || "default_session_secret",
        resave: false,
        saveUninitialized: false,
        store: MongoStore.create({
            mongoUrl: process.env.MONGODB_URI,
            ttl: 24 * 60 * 60,
            autoRemove: "native"
        }),
        cookie: {
            secure: false,
            httpOnly: true,
            maxAge: 24 * 60 * 60 * 1000
        }
    }));
}

// --- Routes ---
function setupRoutes() {
    // Home page
    app.get("/", (req, res) => {
        res.sendFile(path.join(__dirname, "public", "index.html"));
    });

    // Serve login page
    app.get("/login", (req, res) => {
        res.sendFile(path.join(__dirname, "public", "login.html"));
    });

    // Check session
    app.get("/check-session", (req, res) => {
        if (req.session && req.session.userId) {
            res.json({
                authenticated: true,
                user: req.session.user
            });
        } else {
            res.json({ authenticated: false });
        }
    });

    // Signup
    app.post("/signup", async (req, res) => {
        try {
            const { username, password } = req.body;
            if (!username || !password) {
                return res.status(400).json({ error: "Username and password required" });
            }
            const existingUser = await User.findOne({ username });
            if (existingUser) {
                return res.status(400).json({ error: "Username already exists" });
            }
            const user = new User({ username, password });
            await user.save();
            req.session.userId = user._id;
            req.session.user = { id: user._id, username: user.username };
            res.json({ success: true, user: { username: user.username, id: user._id } });
        } catch (error) {
            console.error("Signup error:", error);
            res.status(500).json({ error: error.message });
        }
    });

    // Login
    app.post("/login", async (req, res) => {
        try {
            const { username, password } = req.body;
            const user = await User.findOne({ username });
            if (!user || !(await bcrypt.compare(password, user.password))) {
                return res.status(401).json({ error: "Invalid credentials" });
            }
            req.session.userId = user._id;
            req.session.user = { id: user._id, username: user.username };
            res.json({ success: true, user: { username: user.username } });
        } catch (error) {
            console.error("Login error:", error);
            res.status(500).json({ error: "Login failed" });
        }
    });

    // Logout
    app.post("/logout", (req, res) => {
        req.session.destroy(err => {
            if (err) {
                console.error("Logout error:", err);
                return res.status(500).json({ error: "Logout failed" });
            }
            res.json({ success: true });
        });
    });

    // Create a post (with optional image)
  app.post("/post", upload.single("image"), async (req, res) => {
    try {
        if (!req.session.userId) {
            console.error("Not authenticated");
            return res.status(401).json({ error: "Not authenticated" });
        }

        console.log("POST /post body:", req.body);
        console.log("POST /post file:", req.file);

        let imageUrl = undefined;
        if (req.file) {
            try {
                const result = await cloudinary.uploader.upload(req.file.path);
                imageUrl = result.secure_url;
                fs.unlinkSync(req.file.path); // Remove local file
                console.log("Cloudinary upload result:", result);
            } catch (err) {
                console.error("Cloudinary upload failed:", err);
                return res.status(500).json({ error: "Image upload failed." });
            }
        }

        const postData = {
            title: req.body.title,
            content: req.body.content,
            author: req.session.userId,
            image: imageUrl
        };
        console.log("New Post data:", postData);

        const post = new Post(postData);
        await post.save();
        const savedPost = await Post.findById(post._id).populate("author", "username");
        res.json({ success: true, post: savedPost });
    } catch (error) {
        console.error("Post creation error:", error);
        res.status(500).json({ error: error.message || error.toString() || "Failed to create post" });
    }
});
    // Get all posts
    app.get("/posts", async (req, res) => {
        try {
            const posts = await Post.find()
                .populate("author", "username")
                .populate("replies.author", "username")
                .sort({ createdAt: -1 });
            res.json(posts);
        } catch (error) {
            console.error("Fetch posts error:", error);
            res.status(500).json({ error: "Failed to fetch posts" });
        }
    });

    // Delete a post
    app.delete("/posts/:postId", async (req, res) => {
        try {
            if (!req.session.userId) {
                return res.status(401).json({ error: "Not authenticated" });
            }
            const post = await Post.findById(req.params.postId);
            if (!post) {
                return res.status(404).json({ error: "Post not found" });
            }
            if (post.author.toString() !== req.session.userId) {
                return res.status(403).json({ error: "Not authorized to delete this post" });
            }
            // Delete image from Cloudinary if exists
            if (post.image && post.image.includes("cloudinary")) {
                // Attempt to extract public_id from URL for deletion
                const publicId = post.image.split("/").pop().split(".")[0];
                await cloudinary.uploader.destroy(publicId);
            }
            await Post.findByIdAndDelete(req.params.postId);
            res.json({ success: true });
        } catch (error) {
            console.error("Delete post error:", error);
            res.status(500).json({ error: "Failed to delete post" });
        }
    });

    // Reply to a post
    app.post("/post/:postId/reply", async (req, res) => {
        try {
            if (!req.session.userId) {
                return res.status(401).json({ error: "Not authenticated" });
            }
            const post = await Post.findById(req.params.postId);
            if (!post) {
                return res.status(404).json({ error: "Post not found" });
            }
            post.replies.push({
                content: req.body.content,
                author: req.session.userId,
                createdAt: new Date()
            });
            await post.save();
            const updatedPost = await Post.findById(post._id)
                .populate("author", "username")
                .populate("replies.author", "username");
            res.json({ success: true, post: updatedPost });
        } catch (error) {
            console.error("Reply error:", error);
            res.status(500).json({ error: "Failed to add reply" });
        }
    });

    // Catch-all error handling
    app.use((err, req, res, next) => {
        console.error("Server error:", err);
        res.status(500).json({ error: "Internal server error" });
    });
}

// --- Start server ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT} in ${process.env.NODE_ENV || "development"} mode`);
});
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT} in ${process.env.NODE_ENV || "development"} mode`);
});
