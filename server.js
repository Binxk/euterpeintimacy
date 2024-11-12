require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const multer = require("multer");
const { User, Post } = require("./models/User"); 
const path = require("path");
const fs = require('fs');
const app = express();

// Multer configuration
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        // Create directory if it doesn't exist
        if (!fs.existsSync('public/uploads/')) {
            fs.mkdirSync('public/uploads/', { recursive: true });
        }
        cb(null, 'public/uploads/');
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const upload = multer({ 
    storage: storage,
    fileFilter: function (req, file, cb) {
        // Accept images only
        if (!file.originalname.match(/\.(jpg|jpeg|png|gif)$/)) {
            return cb(new Error('Only image files are allowed!'), false);
        }
        cb(null, true);
    }
});

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
    // New Debug Database Route
    app.get("/debug-db", async (req, res) => {
        try {
            console.log("Entering /debug-db route");

            // 1. Database connection info
            const connectionState = mongoose.connection.readyState;
            const states = ['disconnected', 'connected', 'connecting', 'disconnecting'];
            console.log("MongoDB connection state:", states[connectionState]);
            
            // 2. List all collections
            const collections = await mongoose.connection.db.listCollections().toArray();
            console.log("MongoDB collections:", collections.map(c => c.name));
            
            // 3. Get counts from both collections
            const userCount = await User.countDocuments();
            const postCount = await Post.countDocuments();
            console.log("User count:", userCount, "Post count:", postCount);

            // 4. Try to create a test user if none exist
            let testUserResult = null;
            if (userCount === 0) {
                console.log("No users found, creating a test user");
                const testUser = new User({
                    username: `test_${Date.now()}`,
                    password: "test123"
                });
                testUserResult = await testUser.save();
                console.log("Test user created:", testUserResult);
            }

            // 5. Get one user sample if any exist
            const sampleUser = await User.findOne({});
            console.log("Sample user:", sampleUser);

            res.json({
                connection: {
                    state: states[connectionState],
                    host: mongoose.connection.host,
                    name: mongoose.connection.name,
                    port: mongoose.connection.port
                },
                collections: collections.map(c => c.name),
                counts: {
                    users: userCount,
                    posts: postCount
                },
                testUser: testUserResult,
                sampleUser: sampleUser ? {
                    id: sampleUser._id,
                    username: sampleUser.username,
                    created: sampleUser.createdAt
                } : null
            });
        } catch (error) {
            console.error("Error in /debug-db route:", error);
            res.status(500).json({
                error: error.message,
                stack: error.stack
            });
        }
    });

    // Test DB route
    app.get("/test-db", async (req, res) => {
        try {
            console.log("Entering /test-db route");

            // Basic connection test
            const isConnected = mongoose.connection.readyState === 1;
            console.log("MongoDB connection state:", isConnected ? "connected" : "not connected");
            
            // Get count of users to verify database access
            const userCount = await User.countDocuments();
            console.log("User count:", userCount);
            
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

    // Check User model route
    app.get("/check-user", async (req, res) => {
        try {
            console.log("Checking User model...");
            
            // Fetch all users
            const users = await User.find({});
            console.log("Users found:", users.length);

            res.json({
                users: users.map(user => ({
                    id: user._id,
                    username: user.username
                }))
            });
        } catch (error) {
            console.error("Error checking User model:", error);
            res.status(500).json({
                error: error.message
            });
        }
    });

    // Add test users route
    app.post("/test-db/add-users", async (req, res) => {
        // Route implementation
    });


// Debug Schema Route
app.get("/debug-schema", async (req, res) => {  // Note: added async
    try {
        const postSchema = mongoose.model('Post').schema.obj;
        const userSchema = mongoose.model('User').schema.obj;
        
        // Remove the problematic collectionStats section and replace with simpler collection info
        res.json({
            postSchema,
            userSchema,
            
            // Model information
            models: {
                postModelName: Post.modelName,
                userModelName: User.modelName,
                postCollection: Post.collection.name,
                userCollection: User.collection.name
            },
            
            // Database connection info
            database: {
                name: mongoose.connection.name,
                host: mongoose.connection.host,
                port: mongoose.connection.port,
                connected: mongoose.connection.readyState === 1
            },
            
            // Collection info
            collections: {
                posts: {
                    name: Post.collection.name,
                    count: await Post.countDocuments()
                },
                users: {
                    name: User.collection.name,
                    count: await User.countDocuments()
                }
            }
        });
    } catch (error) {
        console.error('Debug Schema Error:', error);
        res.status(500).json({
            error: error.message,
            stack: error.stack,
            type: 'Schema Debug Error'
        });
    }
});




    // Login routes
    app.get("/login", (req, res) => {
        res.sendFile(path.join(__dirname, 'public', 'login.html'));
    });

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

    // Post routes
    app.post("/post", upload.single('image'), async (req, res) => {
        try {
            console.log("Request body:", req.body);
            console.log("Session:", req.session);
            console.log("Uploaded file:", req.file);

            if (!req.session.userId) {
                console.log("No user session found");
                return res.status(401).json({ error: "Not authenticated" });
            }

            const { title, content } = req.body;
            console.log("Creating post with title:", title, "content:", content);

            const post = new Post({
                title,
                content,
                author: req.session.userId,
                image: req.file ? '/uploads/' + req.file.filename : undefined
            });

            console.log("Post object before save:", post);

            await post.save();
            console.log("Post saved successfully");

            res.json({ success: true, post });
        } catch (error) {
            console.error("Detailed post creation error:", error);
            res.status(500).json({ error: "Failed to create post: " + error.message });
        }
    });

    // Get posts route
    app.get("/posts", async (req, res) => {
        try {
            const posts = await Post.find()
                .populate('author', 'username')
                .sort({ createdAt: -1 });
            res.json(posts);
        } catch (error) {
            res.status(500).json({ error: "Failed to fetch posts" });
        }
    });

    // Add reply to post
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
                author: req.session.userId
            });

            await post.save();
            res.json({ success: true, post });
        } catch (error) {
            res.status(500).json({ error: "Failed to add reply" });
        }
    });
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT} in ${process.env.NODE_ENV || "development"} mode`);
});