const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const path = require('path');

const app = express();
const port = 3000;

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
    cookie: { secure: false }
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

app.get('/messages', requireLogin, (req, res) => {
    res.json(messages);
});

app.post('/post', requireLogin, (req, res) => {
    const { content } = req.body;
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

app.post('/login', (req, res) => {
    const { username, password } = req.body;
    if (username && password) {
        req.session.user = { username };
        res.redirect('/');
    } else {
        res.redirect('/login.html');
    }
});

// Changed to GET request for logout
app.get('/logout', (req, res) => {
    req.session.destroy(() => {
        res.redirect('/login.html');
    });
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});