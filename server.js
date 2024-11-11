app.post('/signup', async (req, res) => {
    console.log('Signup attempt received:', {
        username: req.body.username,
        hasPassword: !!req.body.password
    });

    try {
        const { username, password } = req.body;
        
        if (!username || !password) {
            console.log('Missing credentials');
            return res.status(400).json({ error: 'Username and password are required' });
        }

        // Check if user already exists
        console.log('Checking if user exists:', username);
        const existingUser = await User.findOne({ username });
        if (existingUser) {
            console.log('Username already exists:', username);
            return res.status(400).json({ error: 'Username already exists' });
        }

        // Create new user
        console.log('Creating new user:', username);
        const user = new User({ username, password });
        await user.save();
        console.log('User created successfully:', username);

        // Set up session
        req.session.userId = user._id;
        req.session.user = {
            id: user._id,
            username: user.username
        };

        // Make sure session is saved before responding
        req.session.save((err) => {
            if (err) {
                console.error('Session save error:', err);
                return res.status(500).json({ error: 'Error creating session' });
            }
            
            console.log('Session created successfully for:', username);
            
            // Send success response
            res.json({ 
                success: true, 
                user: { 
                    username: user.username,
                    id: user._id 
                }
            });
        });

    } catch (error) {
        console.error('Signup error:', error);
        res.status(500).json({ error: error.message || 'Error during signup' });
    }
});
