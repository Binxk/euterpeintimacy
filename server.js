const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

// Store messages and users in memory
let messages = [];
let users = new Map();

// Middleware setup
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
    secret: 'your-secret-key',
    resave: false,
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

// Get current user
app.get('/current-user', requireLogin, (req, res) => {
    if (req.session && req.session.user) {
        res.json({ username: req.session.user.username });
    } else {
        res.status(401).json({ error: 'Not logged in' });
    }
});

app.get('/messages', requireLogin, (req, res) => {
    res.json(messages);
});

app.post('/post', requireLogin, (req, res) => {
    const { content } = req.body;
    if (!content) {
        return res.status(400).json({ error: 'Content is required' });
    }

    const newPost = {
        id: Date.now(),
        content,
        author: req.session.user.username,
        timestamp: new Date().toLocaleString(),
        replies: []
    };
    messages.unshift(newPost);
    res.json(newPost);
});

app.post('/reply/:postId', requireLogin, (req, res) => {
    const { content } = req.body;
    if (!content) {
        return res.status(400).json({ error: 'Content is required' });
    }

    const postId = parseInt(req.params.postId);
    const post = messages.find(m => m.id === postId);
    
    if (post) {
        const reply = {
            id: Date.now(),
            content,
            author: req.session.user.username,
            timestamp: new Date().toLocaleString()
        };
        post.replies.push(reply);
        res.json(reply);
    } else {
        res.status(404).json({ error: 'Post not found' });
    }
});

app.post('/signup', (req, res) => {
    const { username, password, confirmPassword } = req.body;
    
    if (!username || !password || password !== confirmPassword) {
        return res.redirect('/login.html?error=invalid');
    }

    if (users.has(username)) {
        return res.redirect('/login.html?error=exists');
    }

    // Store user
    users.set(username, password);
    
    // Auto login after signup
    req.session.user = { username };
    res.redirect('/');
});

app.post('/login', (req, res) => {
    const { username, password } = req.body;
    if (username && password) {
        // Store the username in the session
        req.session.user = { 
            username: username // Ensures we store the actual username
        };
        res.redirect('/');
    } else {
        res.redirect('/login.html');
    }
});

app.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Error destroying session:', err);
        }
        res.redirect('/login.html');
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});