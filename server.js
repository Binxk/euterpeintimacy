
const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const path = require('path');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors'); // Added CORS middleware

const app = express();
const port = process.env.PORT || 3000;

// MongoDB connection with error handling
mongoose.connect(process.env.MONGODB_URI, {
    dbName: 'euterpeintimacy' // Replace with your actual database name if different
})
.then(() => console.log('Connected to MongoDB'))
.catch(err => {
    console.error('MongoDB connection error:', err);
    // Safely log the connection string without exposing credentials
    const safeUri = process.env.MONGODB_URI.replace(
        /(mongodb\+srv:\/\/)([^:]+):([^@]+)@/,
        '$1[USERNAME]:[PASSWORD]@'
    );
    console.log('Attempted connection string:', safeUri);
});

// Message Schema
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

// User Schema
const UserSchema = new mongoose.Schema({
    username: { type: String, unique: true },
    password: String
}, { timestamps: true });

const User = mongoose.model('User', UserSchema);

// Middleware setup
app.use(cors()); // Enable CORS
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
    secret: 'your-secret-key',
    resave: true,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// Authentication middleware
const requireLogin = (req, res, next) => {
    if (!req.session.user) {
        return res.redirect('/login.html');
    }
    next();
};

// Routes
app.get('/', requireLogin, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/current-user', requireLogin, (req, res) => {
    console.log('Session:', req.session); // Debug log
    if (req.session && req.session.user && req.session.user.username) {
        res.json({ username: req.session.user.username });
    } else {
        res.status(401).json({ error: 'Not logged in' });
    }
});

app.get('/messages', requireLogin, async (req, res) => {
    try {
        const messages = await Message.find().sort('-timestamp');
        res.json(messages);
    } catch (error) {
        console.error('Error fetching messages:', error);
        res.status(500).json({ error: 'Error fetching messages' });
    }
});

app.post('/post', requireLogin, async (req, res) => {
    try {
        const { content } = req.body;
        console.log('Received content:', content); // Debug log
        if (!content) {
            return res.status(400).json({ error: 'Content is required' });
        }
        const newMessage = new Message({
            content,
            author: req.session.user.username,
            timestamp: new Date().toLocaleString(),
            replies: []
        });
        await newMessage.save();
        res.json(newMessage);
    } catch (error) {
        console.error('Error creating post:', error);
        res.status(500).json({ error: 'Error creating post' });
    }
});

app.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password are required' });
        }
        const user = await User.findOne({ username });
        if (!user) {
            return res.status(401).json({ error: 'Invalid username or password' });
        }
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid username or password' });
        }
        // For development, allow any login
        req.session.user = { username };

        // Save session explicitly
        req.session.save((err) => {
            if (err) {
                console.error('Session save error:', err);
                return res.status(500).json({ error: 'Login failed' });
            }
            console.log('Session after login:', req.session); // Debug log
            res.json({ success: true, username: username });
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

app.post('/signup', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password are required' });
        }
        const existingUser = await User.findOne({ username });
        if (existingUser) {
            return res.status(400).json({ error: 'Username already exists' });
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        const user = new User({
            username,
            password: hashedPassword
        });
        await user.save();
        req.session.user = { username };

        // Save session explicitly
        req.session.save((err) => {
            if (err) {
                console.error('Session save error:', err);
                return res.status(500).json({ error: 'Signup failed' });
            }
            console.log('Session after signup:', req.session); // Debug log
            res.json({ success: true, username: username });
        });
    } catch (error) {
        console.error('Signup error:', error);
        res.status(500).json({ error: 'Signup failed' });
    }
});

app.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Error destroying session:', err);
            return res.status(500).json({ error: 'Logout failed' });
        }
        res.redirect('/login.html');
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Global error:', err);
    res.status(500).json({ error: 'Something went wrong!' });
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});

