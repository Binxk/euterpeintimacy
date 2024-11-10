const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const bcrypt = require('bcrypt');
const session = require('express-session');
const app = express();
const port = 3000;

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static('public'));
app.use(session({
    secret: 'your_super_secret_key',
    resave: false,
    saveUninitialized: true
}));

// Database (replace with your actual database integration)
let users = [
    { username: 'testuser', password: '$2b$10$0v/OVls4XQ0EFGFEw2DUIedNUmMnL92Xw5C6GGm.Cg9bqq.MlK9O2' } // bcrypt hash of 'password123'
];

let responses = [];

// Utility function to hash passwords
async function hashPassword(password) {
    const saltRounds = 10;
    return await bcrypt.hash(password, saltRounds);
}

// Login route
app.post('/login', async (req, res) => {
    const { username, password } = req.body;

    const user = users.find(u => u.username === username);
    if (user && await bcrypt.compare(password, user.password)) {
        req.session.loggedIn = true;
        req.session.username = username;
        res.json({ success: true });
    } else {
        res.status(401).json({ success: false, error: 'Invalid username or password' });
    }
});

// Route to handle form submission
app.post('/submit', (req, res) => {
    const response = req.body.response;
    responses.push(response);
    res.json({ success: true });
});

// Route to get responses
app.get('/responses', (req, res) => {
    res.json(responses);
});

// Start the server
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});