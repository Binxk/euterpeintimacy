const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const multer = require('multer');
const User = require('./models/User');
const path = require('path');
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

// Middleware setup
app.use(express.json());
app.use(express.static('public'));

// Session configuration
app.use(session({
    secret: process.env.SESSION_SECRET || 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ 
        mongoUrl: process.env.MONGODB_URI || 'mongodb://localhost:27017/your-database'
    }),
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// Authentication middleware
const requireAuth = (req, res, next) => {
    if (req.session && req.session.userId) {
        next();
    } else {
        res.status(401).json({ error: 'Not authenticated' });
    }
};

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/your-database')
    .then(() => console.log('MongoDB connected successfully'))
    .catch(err => console.error('MongoDB connection error:', err));

// Session check route
app.get('/check-session', (req, res) => {
    if (req.session && req.session.userId) {
        res.json({ authenticated: true });
    } else {
        res.json({ authenticated: false });
    }
});

// Current user route
app.get('/current-user', (req, res) => {
    if (req.session && req.session.userId) {
        res.json({ username: req.session.user?.username });
    } else {
        res.status(401).json({ error: 'Not authenticated' });
    }
});

// Auth Routes
app.post('/signup', async (req, res) => {
    console.log('Signup attempt received:', {
        username: req.body.username,
        hasPassword: !!req.body.password
    });

    try {
        const { username, password } = req.body;
        
        if (!username || !password) {
            console.log('Missing credentials');
            return res.status(400).json({ error: 'Username and password are required' });
        }

        // Check if user already exists
        console.log('Checking if user exists:', username);
        const existingUser = await User.findOne({ username });
        if (existingUser) {
            console.log('Username already exists:', username);
            return res.status(400).json({ error: 'Username already exists' });
        }

        // Create new user
        console.log('Creating new user:', username);
        const user = new User({ username, password });
        await user.save();
        console.log('User created successfully:', username);

        // Set up session
        req.session.userId = user._id;
        req.session.user = {
            id: user._id,
            username: user.username
        };

        req.session.save((err) => {
            if (err) {
                console.error('Session save error:', err);
                return res.status(500).json({ error: 'Error creating session' });
            }
            console.log('Session created successfully for:', username);
            res.json({ 
                success: true, 
                user: { 
                    username: user.username,
                    id: user._id 
                }
            });
        });

    } catch (error) {
        console.error('Signup error:', error);
        res.status(500).json({ error: error.message || 'Error during signup' });
    }
});

app.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await User.findOne({ username });
        
        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        req.session.userId = user._id;
        req.session.user = {
            id: user._id,
            username: user.username
        };
        
        req.session.save((err) => {
            if (err) {
                console.error('Session save error:', err);
                return res.status(500).json({ error: 'Error creating session' });
            }
            res.json({ success: true, user: { username: user.username } });
        });
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

// Protected routes
app.get('/messages', requireAuth, async (req, res) => {
    try {
        // Your messages retrieval logic here
        res.json([]); // Replace with actual messages
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/messages', requireAuth, async (req, res) => {
    try {
        const { content } = req.body;
        // Your message creation logic here
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/post', requireAuth, upload.single('image'), async (req, res) => {
    try {
        // Your post creation logic here
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Health check route
app.get('/health', async (req, res) => {
    try {
        res.json({
            status: 'healthy',
            mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
