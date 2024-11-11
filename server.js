// Add these near your other middleware
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
});

// Add session debugging middleware
app.use((req, res, next) => {
    console.log('Session debug:', {
        sessionID: req.sessionID,
        hasSession: !!req.session,
        user: req.session?.user
    });
    next();
});

// Add a session check endpoint
app.get('/check-session', (req, res) => {
    console.log('Session check requested:', {
        sessionID: req.sessionID,
        session: req.session
    });
    res.json({
        authenticated: !!req.session.user,
        user: req.session.user || null
    });
});

// Update your login endpoint with more debugging
app.post('/login', async (req, res) => {
    console.log('Login attempt received:', {
        body: req.body,
        sessionID: req.sessionID
    });

    try {
        const { username, password } = req.body;

        if (!username || !password) {
            console.log('Missing credentials');
            return res.status(400).json({ error: 'Username and password are required' });
        }

        console.log('Finding user:', username);
        const user = await User.findOne({ username });
        console.log('User found:', user ? 'Yes' : 'No');

        if (!user) {
            console.log('User not found');
            return res.status(401).json({ error: 'Invalid username or password' });
        }

        console.log('Comparing passwords');
        const validPassword = await bcrypt.compare(password, user.password);
        console.log('Password valid:', validPassword);

        if (!validPassword) {
            console.log('Invalid password');
            return res.status(401).json({ error: 'Invalid username or password' });
        }

        console.log('Creating session');
        req.session.user = { username };
        console.log('Session created:', req.session);

        res.json({ 
            success: true, 
            user: { username },
            sessionID: req.sessionID
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ 
            error: 'Internal server error',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Add session verification middleware
const verifySession = (req, res, next) => {
    console.log('Verifying session:', {
        sessionID: req.sessionID,
        user: req.session?.user
    });
    
    if (!req.session || !req.session.user) {
        console.log('No valid session found');
        return res.status(401).json({ error: 'Not authenticated' });
    }
    next();
};

// Add this to protected routes
app.get('/messages', verifySession, async (req, res) => {
    // Your existing messages route code
});

// Add a route to check MongoDB connection
app.get('/health', async (req, res) => {
    try {
        const status = mongoose.connection.readyState;
        const states = ['disconnected', 'connected', 'connecting', 'disconnecting'];
        res.json({
            mongodb: states[status],
            session: !!req.session,
            environment: process.env.NODE_ENV
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});
