const express = require('express');
const session = require('express-session');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3000;

// Database
const database = {
    'alice': { 
        password: '5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8',
        role: 'user' 
    }
};

// Disable problematic security headers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Simple rate limit (higher for testing)
const limiter = rateLimit({
    windowMs: 60 * 1000,
    max: 100,
    message: { error: 'Rate limit exceeded' }
});
app.use(limiter);

// Session
app.use(session({
    secret: 'securinets_revenge_secret_key_2024',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false, httpOnly: true }
}));

// Login page
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Securinets Revenge CTF</title>
            <style>
                body {
                    font-family: monospace;
                    background: #0a0a0a;
                    color: #0f0;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    height: 100vh;
                    margin: 0;
                }
                .container {
                    background: #1a1a1a;
                    padding: 40px;
                    border-radius: 10px;
                    border: 1px solid #0f0;
                    width: 300px;
                }
                input, button {
                    width: 100%;
                    padding: 10px;
                    margin: 10px 0;
                    background: #0a0a0a;
                    border: 1px solid #0f0;
                    color: #0f0;
                }
                button { cursor: pointer; }
                button:hover { background: #0f0; color: #0a0a0a; }
            </style>
        </head>
        <body>
            <div class="container">
                <h2>🔐 Securinets CorpPortal</h2>
                <form id="loginForm">
                    <input type="text" id="username" placeholder="Username" required>
                    <input type="password" id="password" placeholder="Password" required>
                    <button type="submit">Authenticate</button>
                </form>
                <div id="message"></div>
                <small>#RevengeCTF</small>
            </div>
            <script>
                document.getElementById('loginForm').onsubmit = async (e) => {
                    e.preventDefault();
                    const username = document.getElementById('username').value;
                    const password = document.getElementById('password').value;
                    
                    const res = await fetch('/api/auth', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ username, password })
                    });
                    const data = await res.json();
                    if (res.ok) {
                        window.location.href = '/dashboard';
                    } else {
                        document.getElementById('message').innerHTML = '<p style="color:red">' + data.error + '</p>';
                    }
                };
            </script>
        </body>
        </html>
    `);
});

// Dashboard
app.get('/dashboard', (req, res) => {
    if (!req.session.loggedIn) {
        return res.redirect('/');
    }
    
    const isAdmin = req.session.isAdmin === true || req.session.role === 'admin';
    
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Dashboard - Securinets</title>
            <style>
                body {
                    font-family: monospace;
                    background: #0a0a0a;
                    color: #0f0;
                    padding: 50px;
                }
                .container {
                    max-width: 800px;
                    margin: 0 auto;
                    background: #1a1a1a;
                    padding: 30px;
                    border-radius: 10px;
                    border: 1px solid #0f0;
                }
                .admin-panel {
                    background: #1a2a1a;
                    border-left: 4px solid #0f0;
                    padding: 20px;
                    margin-top: 20px;
                }
                .flag {
                    color: #ff0;
                    font-size: 20px;
                    font-weight: bold;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>⚡ Securinets Portal</h1>
                <p>Welcome, ${req.session.username || 'Employee'}</p>
                <p>Role: <strong>${req.session.role || 'standard'}</strong></p>
                <hr>
                <div id="content">
                    <p>📁 Internal documents:</p>
                    <ul>
                        <li>task_ideas.txt</li>
                        <li>revenge_plan.pdf</li>
                    </ul>
                </div>
                <div id="adminPanel" class="admin-panel" style="display: none;">
                    <h3>🔧 Admin Access Granted</h3>
                    <p class="flag" id="flag"></p>
                    <p><em>"Revenge achieved!"</em></p>
                </div>
                <p><a href="/logout" style="color:#0f0">Logout</a></p>
            </div>
            <script>
                fetch('/api/status')
                    .then(r => r.json())
                    .then(data => {
                        if (data.isAdmin) {
                            document.getElementById('adminPanel').style.display = 'block';
                            fetch('/api/flag')
                                .then(r => r.json())
                                .then(flagData => {
                                    document.getElementById('flag').innerText = flagData.flag;
                                });
                        }
                    });
            </script>
        </body>
        </html>
    `);
});

// VULNERABLE AUTH ENDPOINT - Handles MULTIPLE pollution vectors
app.post('/api/auth', (req, res) => {
    const { username, password, ...extra } = req.body;
    
    const crypto = require('crypto');
    const hashedInput = crypto.createHash('sha256').update(password).digest('hex');
    const user = database[username];
    
    if (!user || user.password !== hashedInput) {
        return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Start with base session
    const sessionData = {
        loggedIn: true,
        username: username,
        role: user.role
    };
    
    // VULNERABLE: Deep merge that allows prototype pollution via MULTIPLE vectors
    function deepMerge(target, source) {
        for (let key in source) {
            // Handle __proto__ directly
            if (key === '__proto__') {
                for (let prop in source[key]) {
                    target[prop] = source[key][prop];
                }
            }
            // Handle constructor.prototype
            else if (key === 'constructor' && source[key].prototype) {
                for (let prop in source[key].prototype) {
                    target[prop] = source[key].prototype[prop];
                }
            }
            // Handle prototype pollution via nested objects
            else if (typeof source[key] === 'object' && source[key] !== null) {
                if (!target[key]) target[key] = {};
                deepMerge(target[key], source[key]);
            } else {
                target[key] = source[key];
            }
        }
        return target;
    }
    
    // Apply the merge (THIS IS THE VULNERABILITY)
    const finalSession = deepMerge(sessionData, extra);
    
    // Apply to session
    for (let key in finalSession) {
        req.session[key] = finalSession[key];
    }
    
    // Also check for pollution on Object.prototype directly
    if (Object.prototype.isAdmin === true) {
        req.session.isAdmin = true;
    }
    
    res.json({ success: true, redirect: '/dashboard' });
});

// Status check
app.get('/api/status', (req, res) => {
    if (!req.session.loggedIn) {
        return res.status(401).json({ error: 'Not authenticated' });
    }
    
    // Check multiple sources for admin status
    const isAdmin = req.session.isAdmin === true || 
                    req.session.role === 'admin' ||
                    Object.prototype.isAdmin === true;
    
    res.json({
        username: req.session.username,
        role: req.session.role || 'standard',
        isAdmin: isAdmin
    });
});

// Flag endpoint
app.get('/api/flag', (req, res) => {
    if (!req.session.loggedIn) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const isAdmin = req.session.isAdmin === true || 
                    req.session.role === 'admin' ||
                    Object.prototype.isAdmin === true;
    
    if (isAdmin) {
        res.json({ flag: 'SECURINETS{task_makers_become_task_takers_revenge_is_ours}' });
    } else {
        res.status(403).json({ error: 'Admin access required - try prototype pollution' });
    }
});

// Debug endpoint (remove in production, useful for testing)
app.get('/debug/session', (req, res) => {
    if (req.session.loggedIn) {
        res.json({
            session: req.session,
            prototype: Object.prototype.isAdmin || false
        });
    } else {
        res.json({ error: 'Not logged in' });
    }
});

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

app.get('/health', (req, res) => {
    res.send('OK');
});

app.listen(PORT, () => {
    console.log(`🔥 Securinets Revenge CTF running on port ${PORT}`);
    console.log(`💀 Multiple prototype pollution vectors enabled`);
});
