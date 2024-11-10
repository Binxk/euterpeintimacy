const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const session = require('express-session');
const app = express();
const port = 3000;

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static('public'));
app.use(session({
    secret: 'your_secret_key',
    resave: false,
    saveUninitialized: true
}));

// Dummy user data (replace with your database logic)
const users = {
    'testuser': 'password123'
};

// Login route
app.post('/login', (req, res) => {
    const { username, password } = req.body;

    if (users[username] && users[username] === password) {
        req.session.loggedIn = true;
        req.session.username = username;
        res.json({ success: true });
    } else {
        res.json({ success: false });
    }
});

// Route to handle form submission
app.post('/submit', (req, res) => {
    const response = req.body.response;
    fs.readFile('responses.json', (err, data) => {
        if (err) throw err;
        let responses = JSON.parse(data);
        responses.push(response);
        fs.writeFile('responses.json', JSON.stringify(responses), (err) => {
            if (err) throw err;
            res.send('Response saved!');
        });
    });
});

// Route to get responses
app.get('/responses', (req, res) => {
    fs.readFile('responses.json', (err, data) => {
        if (err) throw err;
        let responses = JSON.parse(data);
        res.json(responses);
    });
});

// Start the server
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
