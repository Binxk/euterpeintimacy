const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const path = require('path');
const mongoose = require('mongoose');

const app = express();
const port = process.env.PORT || 3000;

// MongoDB connection (replace with your MongoDB URI from Render)
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost/euterpe-forum', {
    useNewUrlParser: true,
    useUnifiedTopology: true
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
});

const Message = mongoose.model('Message', MessageSchema);

// User Schema
const UserSchema = new mongoose.Schema({
    username: String,
    password: String
});

const User = mongoose.model('User', UserSchema);

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

app.get('/current-user', requireLogin, (req, res) => {
    if (req.session && req.session.user) {
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
        res.status(500).json({ error: 'Error fetching messages' });
    }
});

app.post('/post', requireLogin, async (req, res) => {
    try {
        const { content } = req.body;
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
        res.status(500).json({ error: 'Error creating post' });
    }
});

app.post('/reply/:postId', requireLogin, async (req, res) => {
    try {
        const { content } = req.body;
        if (!content) {
            return res.status(400).json({ error: 'Content is required' });
        }

        const post = await Message.findById(req.params.postId);
        if (!post) {
            return res.status(404).json({ error: 'Post not found' });
        }

        const reply = {
            content,
            author: req.session.user.username,
            timestamp: new Date().toLocaleString()
        };

        post.replies.push(reply);
        await post.save();
        res.json(reply);
    } catch (error) {
        res.status(500).json({ error: 'Error creating reply' });
    }
});

app.post('/signup', async (req, res) => {
    try {
        const { username, password, confirmPassword } = req.body;
        
        if (!username || !password || password !== confirmPassword) {
            return res.redirect('/login.html?error=invalid');
        }

        const existingUser = await User.findOne({ username });
        if (existingUser) {
            return res.redirect('/login.html?error=exists');
        }

        const user = new User({ username, password });
        await user.save();
        
        req.session.user = { username };
        res.redirect('/');
    } catch (error) {
        res.redirect('/login.html?error=server');
    }
});

app.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        const user = await User.findOne({ username });
        if (!user || user.password !== password) {
            return res.redirect('/login.html?error=invalid');
        }

        req.session.user = { username };
        res.redirect('/');
    } catch (error) {
        res.redirect('/login.html?error=server');
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

app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});