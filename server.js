const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const path = require('path');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3000;

// Add debug logging middleware
app.use((req, res, next) => {
    console.log('Request URL:', req.url);
    console.log('Request Method:', req.method);
    next();
});

// MongoDB connection with enhanced error handling
mongoose.connect(process.env.MONGODB_URI, {
    dbName: 'euterpeintimacy'
})
.then(() => {
    console.log('Connected to MongoDB successfully');
    console.log('Database name:', mongoose.connection.name);
})
.catch(err => {
    console.error('MongoDB connection error details:', {
        name: err.name,
        message: err.message,
        code: err.code
    });
    const safeUri = process.env.MONGODB_URI.replace(
        /(mongodb\+srv:\/\/)([^:]+):([^@]+)@/,
        '$1[USERNAME]:[PASSWORD]@'
    );
    console.log('Attempted connection string:', safeUri);
});

// Schema definitions
const MessageSchema = new mongoose.Schema({
    content: String,
    author: String,
    timestamp: String,
    replies: [{
        content: String,
        author: String,
        timestamp: String
    }]
}, { timestamps: true });

const Message = mongoose.model('Message', MessageSchema);

const UserSchema = new mongoose.Schema({
    username: { type: String, unique: true },
    password: String
}, { timestamps: true });

const User = mongoose.model('User', UserSchema);

// Middleware setup
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Session configuration with MongoDB store
app.use(session({
    secret: process.env.SESSION_SECRET || 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
        mongoUrl: process.env.MONGODB_URI,
        dbName: 'euterpeintimacy',
        ttl: 24 * 60 * 60
    }),
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        maxAge: 24 * 60 * 60 * 1000,
        sameSite: 'lax'
    }
}));

// Authentication middleware with logging
const requireLogin = (req, res, next) => {
    console.log('Session in requireLogin:', req.session);
    if (!req.session.user) {
        console.log('No user in session, redirecting to login');
        return res.redirect('/login.html');
    }
    next();
};

// Routes with enhanced logging
app.get('/', requireLogin, (req, res) => {
    console.log('Serving index.html');
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/current-user', requireLogin, (req, res) => {
    console.log('Current user session:', req.session);
    if (req.session && req.session.user && req.session.user.username) {
        res.json({ username: req.session.user.username });
    } else {
        console.log('No user found in session');
        res.status(401).json({ error: 'Not logged in' });
    }
});

app.post('/login', async (req, res) => {
    console.log('Login attempt received:', {
        body: req.body,
        headers: req.headers['content-type']
    });
    
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            console.log('Missing credentials:', { username: !!username, password: !!password });
            return res.status(400).json({ error: 'Username and password are required' });
        }

        const user = await User.findOne({ username });
        if (!user) {
            console.log('User not found:', username);
            return res.status(401).json({ error: 'Invalid username or password' });
        }

        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            console.log('Invalid password for user:', username);
            return res.status(401).json({ error: 'Invalid username or password' });
        }

        req.session.user = { username };
        req.session.save((err) => {
            if (err) {
                console.error('Session save error:', err);
                return res.status(500).json({ error: 'Login failed' });
            }
            console.log('Login successful:', username);
            res.json({ success: true, username: username });
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({ 
        status: 'healthy',
        mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Global error:', err);
    res.status(500).json({ error: 'Something went wrong!' });
});

// Updated server startup
app.listen(port, '0.0.0.0', () => {
    console.log(`Server running on port ${port}`);
});
