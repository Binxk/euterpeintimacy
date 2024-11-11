const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const path = require('path');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3000;

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI, {
    dbName: 'euterpeintimacy'
})
.then(() => console.log('Connected to MongoDB'))
.catch(err => console.error('MongoDB connection error:', err));

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
    secret: process.env.SESSION_SECRET || 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
        mongoUrl: process.env.MONGODB_URI,
        dbName: 'euterpeintimacy'
    }),
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// Serve static files only after auth check
app.use((req, res, next) => {
    const publicPaths = ['/login.html', '/signup.html', '/styles.css', '/script.js'];
    if (publicPaths.includes(req.path) || req.path.startsWith('/uploads/')) {
        return next();
    }
    if (!req.session.user && req.path !== '/login' && req.path !== '/signup') {
        return res.redirect('/login.html');
    }
    next();
});

app.use(express.static(path.join(__dirname, 'public')));

// Models
const MessageSchema = new mongoose.Schema({
    content: String,
    author: String,
    timestamp: String
}, { timestamps: true });

const Message = mongoose.model('Message', MessageSchema);

const UserSchema = new mongoose.Schema({
    username: { type: String, unique: true },
    password: String
}, { timestamps: true });

const User = mongoose.model('User', UserSchema);

// Routes
app.get('/', (req, res) => {
    if (!req.session.user) {
        res.redirect('/login.html');
    } else {
        res.sendFile(path.join(__dirname, 'public', 'index.html'));
    }
});

app.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await User.findOne({ username });
        
        if (!user) {
            return res.status(401).json({ error: 'Invalid username or password' });
        }

        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid username or password' });
        }

        req.session.user = { username };
        res.json({ success: true });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

app.post('/signup', async (req, res) => {
    try {
        const { username, password } = req.body;
        const hashedPassword = await bcrypt.hash(password, 10);
        
        const user = new User({
            username,
            password: hashedPassword
        });
        
        await user.save();
        res.json({ success: true });
    } catch (error) {
        console.error('Signup error:', error);
        res.status(500).json({ error: 'Username already exists' });
    }
});

app.post('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            console.error('Logout error:', err);
            return res.status(500).json({ error: 'Logout failed' });
        }
        res.json({ success: true });
    });
});

app.get('/messages', async (req, res) => {
    try {
        const messages = await Message.find().sort({ createdAt: -1 });
        res.json(messages);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch messages' });
    }
});

app.post('/messages', async (req, res) => {
    try {
        if (!req.session.user) {
            return res.status(401).json({ error: 'Not authenticated' });
        }

        const message = new Message({
            content: req.body.content,
            author: req.session.user.username,
            timestamp: new Date().toISOString()
        });

        await message.save();
        res.json(message);
    } catch (error) {
        res.status(500).json({ error: 'Failed to save message' });
    }
});

app.get('/current-user', (req, res) => {
    if (req.session.user) {
        res.json({ username: req.session.user.username });
    } else {
        res.status(401).json({ error: 'Not logged in' });
    }
});

// Start server
app.listen(port, '0.0.0.0', () => {
    console.log(`Server running on port ${port}`);
});
