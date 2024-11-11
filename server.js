const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const bcrypt = require('bcrypt');
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
.then(() => console.log('Connected to MongoDB'))
.catch(err => {
    console.error('MongoDB connection error:', err);
});

// User Schema
const UserSchema = new mongoose.Schema({
    username: { type: String, unique: true, required: true },
    password: { type: String, required: true }
});

const User = mongoose.model('User', UserSchema);

// Response Schema
const ResponseSchema = new mongoose.Schema({
    content: String,
    author: String,
    timestamp: { type: Date, default: Date.now },
});

const Response = mongoose.model('Response', ResponseSchema);

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
    secret: process.env.JWT_SECRET || 'your_super_secret_key',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// Authentication middleware
const requireLogin = (req, res, next) => {
    if (!req.session.loggedIn) {
        return res.status(401).json({ error: 'Not authenticated' });
    }
    next();
};

// Routes
app.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await User.findOne({ username });
        
        if (!user) {
            return res.status(401).json({ success: false, error: 'Invalid username or password' });
        }

        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(401).json({ success: false, error: 'Invalid username or password' });
        }

        req.session.loggedIn = true;
        req.session.username = username;
        res.json({ success: true });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

app.post('/signup', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        const existingUser = await User.findOne({ username });
        if (existingUser) {
            return res.status(400).json({ success: false, error: 'Username already exists' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const user = new User({
            username,
            password: hashedPassword
        });

        await user.save();
        
        req.session.loggedIn = true;
        req.session.username = username;
        res.json({ success: true });
    } catch (error) {
        console.error('Signup error:', error);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

app.post('/submit', requireLogin, async (req, res) => {
    try {
        const response = new Response({
            content: req.body.response,
            author: req.session.username
        });
        
        await response.save();
        res.json({ success: true });
    } catch (error) {
        console.error('Submit error:', error);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

app.get('/responses', requireLogin, async (req, res) => {
    try {
        const responses = await Response.find().sort('-timestamp');
        res.json(responses);
    } catch (error) {
        console.error('Fetch responses error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

app.get('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.status(500).json({ error: 'Could not log out' });
        }
        res.redirect('/login.html');
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something broke!' });
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
