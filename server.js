const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const path = require('path');
const multer = require('multer');
const app = express();

// File upload configuration
const storage = multer.diskStorage({
    destination: 'public/uploads/',
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        if (extname && mimetype) {
            return cb(null, true);
        }
        cb(new Error('Only image files are allowed!'));
    }
});

// Session monitoring values
const ALERT_THRESHOLD = {
    sessions: 10000,
    memoryUsage: 80, // percentage
    responseTime: 1000 // milliseconds
};

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/your-database', {
    serverSelectionTimeoutMS: 5000,
})
.then(() => {
    console.log('MongoDB connected successfully');
    initializeSessionMonitoring();
})
.catch(err => console.error('MongoDB connection error:', err));

// Create MongoDB session store
const sessionStore = MongoStore.create({
    mongoUrl: process.env.MONGODB_URI || 'mongodb://localhost:27017/your-database',
    collectionName: 'sessions',
    ttl: 24 * 60 * 60,
    autoRemove: 'native',
    crypto: {
        secret: process.env.SESSION_ENCRYPT_SECRET || 'encryption-secret'
    },
    touchAfter: 24 * 3600
});

// Session store monitoring
sessionStore.on('create', (sessionId) => {
    console.log('New session created:', sessionId);
    incrementSessionMetrics();
});

sessionStore.on('destroy', (sessionId) => {
    console.log('Session destroyed:', sessionId);
    decrementSessionMetrics();
});

// Middleware setup
app.use(express.json());
app.use(express.static('public')); // Serving static files
app.use(session({
    secret: process.env.SESSION_SECRET || 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    store: sessionStore,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000,
        sameSite: 'strict'
    },
    name: 'sessionId'
}));

// Session metrics
let sessionMetrics = {
    activeSessions: 0,
    totalCreated: 0,
    totalDestroyed: 0,
    averageResponseTime: 0,
    responseTimeSamples: []
};

// Monitoring functions
function incrementSessionMetrics() {
    sessionMetrics.activeSessions++;
    sessionMetrics.totalCreated++;
    checkSessionThresholds();
}

function decrementSessionMetrics() {
    sessionMetrics.activeSessions--;
    sessionMetrics.totalDestroyed++;
}

function updateResponseTimeMetrics(duration) {
    sessionMetrics.responseTimeSamples.push(duration);
    if (sessionMetrics.responseTimeSamples.length > 100) {
        sessionMetrics.responseTimeSamples.shift();
    }
    sessionMetrics.averageResponseTime = 
        sessionMetrics.responseTimeSamples.reduce((a, b) => a + b, 0) / 
        sessionMetrics.responseTimeSamples.length;
}

// Response time monitoring middleware
app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - start;
        updateResponseTimeMetrics(duration);
        if (duration > ALERT_THRESHOLD.responseTime) {
            console.warn(`High response time (${duration}ms) for ${req.method} ${req.url}`);
        }
    });
    next();
});

// Request logging middleware
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
});

// Session debugging middleware
app.use((req, res, next) => {
    console.log('Session debug:', {
        sessionID: req.sessionID,
        hasSession: !!req.session,
        user: req.session?.user
    });
    next();
});

// Auth middleware
const auth = (req, res, next) => {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'Not authenticated' });
    }
    next();
};

// ROUTES

// Auth routes
app.post('/signup', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        const existingUser = await User.findOne({ username });
        if (existingUser) {
            return res.status(400).json({ error: 'Username already exists' });
        }

        const user = new User({ username, password });
        await user.save();

        req.session.userId = user._id;
        res.json({ success: true, user: { username: user.username } });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await User.findOne({ username });
        
        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        user.lastLogin = new Date();
        await user.save();

        req.session.userId = user._id;
        res.json({ success: true, user: { username: user.username } });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.status(500).json({ error: 'Could not log out' });
        }
        res.json({ success: true });
    });
});

// Post routes
app.post('/post', auth, upload.single('image'), async (req, res) => {
    try {
        const { title, content } = req.body;
        const post = new Post({
            title,
            content,
            author: req.session.userId,
            image: req.file ? `/uploads/${req.file.filename}` : null
        });
        await post.save();
        res.json({ success: true, post });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/posts', async (req, res) => {
    try {
        const posts = await Post.find()
            .sort({ createdAt: -1 })
            .populate('author', 'username')
            .populate('replies.author', 'username');
        res.json(posts);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/post/:postId/reply', auth, async (req, res) => {
    try {
        const { content } = req.body;
        const post = await Post.findById(req.params.postId);
        
        if (!post) {
            return res.status(404).json({ error: 'Post not found' });
        }

        post.replies.push({
            content,
            author: req.session.userId
        });

        await post.save();
        res.json({ success: true, post });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Health check endpoint
app.get('/health', async (req, res) => {
    try {
        const sessionCollection = mongoose.connection.collection('sessions');
        const activeSessions = await sessionCollection.countDocuments();
        
        res.json({
            status: 'healthy',
            timestamp: new Date(),
            environment: process.env.NODE_ENV,
            mongodb: {
                status: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
                activeSessions
            },
            metrics: {
                ...sessionMetrics,
                memoryUsage: {
                    heap: process.memoryUsage().heapUsed,
                    total: process.memoryUsage().heapTotal,
                    percentage: (process.memoryUsage().heapUsed / process.memoryUsage().heapTotal * 100).toFixed(2)
                },
                responseTime: {
                    average: sessionMetrics.averageResponseTime,
                    samples: sessionMetrics.responseTimeSamples.length
                }
            }
        });
    } catch (error) {
        res.status(500).json({
            status: 'unhealthy',
            error: error.message,
            timestamp: new Date()
        });
    }
});

// User routes
app.get('/current-user', auth, async (req, res) => {
    try {
        const user = await User.findById(req.session.userId).select('-password');
        res.json(user);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Session cleanup function
async function cleanupSessions() {
    try {
        const sessionCollection = mongoose.connection.collection('sessions');
        const result = await sessionCollection.deleteMany({
            "expires": { $lt: new Date() }
        });
        console.log(`Cleaned up ${result.deletedCount} expired sessions`);
        sessionMetrics.activeSessions = await sessionCollection.countDocuments();
    } catch (error) {
        console.error('Session cleanup error:', error);
    }
}

// Session monitoring initialization
function initializeSessionMonitoring() {
    // Run cleanup every hour
    setInterval(cleanupSessions, 60 * 60 * 1000);
    
    // Check thresholds every 5 minutes
    setInterval(checkSessionThresholds, 5 * 60 * 1000);
}

async function checkSessionThresholds() {
    const sessionCollection = mongoose.connection.collection('sessions');
    const count = await sessionCollection.countDocuments();
    
    if (count > ALERT_THRESHOLD.sessions) {
        console.warn(`High session count: ${count}`);
    }

    const memoryUsage = process.memoryUsage().heapUsed / 
        process.memoryUsage().heapTotal * 100;
    
    if (memoryUsage > ALERT_THRESHOLD.memoryUsage) {
        console.warn(`High memory usage: ${memoryUsage.toFixed(2)}%`);
    }
}

// Error handling middleware (should be last)
app.use((err, req, res, next) => {
    console.error('Global error handler:', err);
    res.status(500).json({
        error: 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// Graceful shutdown handler
process.on('SIGTERM', async () => {
    console.log('SIGTERM received. Starting graceful shutdown...');
    
    try {
        await mongoose.connection.close();
        console.log('MongoDB connection closed');
        
        await new Promise(resolve => sessionStore.close(resolve));
        console.log('Session store closed');
        
        process.exit(0);
    } catch (error) {
        console.error('Error during shutdown:', error);
        process.exit(1);
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
