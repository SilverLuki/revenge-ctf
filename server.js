const express = require("express");
const session = require("express-session");
const rateLimit = require("express-rate-limit");
const helmet = require("helmet");

const app = express();
const PORT = process.env.PORT || 3000;

// Fake "secure" database (no SQL at all - sqlmap finds nothing)
const database = {
  alice: {
    password:
      "5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8", // sha256 of "password"
    role: "user",
  },
  bob: {
    password:
      "3fdba35f04dc8c462986c992bcf875546257113072a909c162f7e470e581e278", // sha256 of "bob123"
    role: "user",
  },
};

// Fake security headers to mislead attackers
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
      },
    },
    xssFilter: true,
    noSniff: true,
    frameguard: { action: "deny" },
  }),
);

// Rate limiting (reasonable)
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: { error: "Rate limit exceeded" },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(limiter);

// Session with "secure" config (but vulnerable via prototype pollution)
app.use(
  session({
    secret: "f8c3f2a8b9d4e6f1a7c2b9d3e5f7a8c1b4d6e8f0a2c4d6e8f0a1b2c3d4e5f6a7",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false,
      httpOnly: true,
      maxAge: 1800000,
      sameSite: "strict",
    },
  }),
);

// Simple login page (no debug info)
app.get("/", (req, res) => {
  res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Securinets CorpPortal - Employee Login</title>
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body {
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
                    height: 100vh;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                }
                .login-container {
                    background: white;
                    padding: 40px;
                    border-radius: 10px;
                    box-shadow: 0 10px 25px rgba(0,0,0,0.1);
                    width: 350px;
                }
                h2 { margin-bottom: 20px; color: #333; }
                input {
                    width: 100%;
                    padding: 12px;
                    margin: 10px 0;
                    border: 1px solid #ddd;
                    border-radius: 5px;
                }
                button {
                    width: 100%;
                    padding: 12px;
                    background: #e94560;
                    color: white;
                    border: none;
                    border-radius: 5px;
                    cursor: pointer;
                }
                .error { color: red; margin-top: 10px; font-size: 14px; }
                .info { color: #666; margin-top: 15px; font-size: 12px; text-align: center; }
                .revenge { font-size: 10px; color: #999; text-align: center; margin-top: 20px; }
            </style>
        </head>
        <body>
            <div class="login-container">
                <h2>🔐 Securinets CorpPortal</h2>
                <form id="loginForm">
                    <input type="text" id="username" placeholder="Employee ID" required>
                    <input type="password" id="password" placeholder="Password" required>
                    <button type="submit">Authenticate</button>
                </form>
                <div id="message"></div>
                <div class="info">⚠️ Authorized personnel only</div>
                <div class="revenge">#RevengeCTF</div>
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
                        document.getElementById('message').innerHTML = 
                            '<div class="error">' + data.error + '</div>';
                    }
                };
            </script>
        </body>
        </html>
    `);
});

// Dashboard (protected area)
app.get("/dashboard", (req, res) => {
  if (!req.session.loggedIn) {
    return res.redirect("/");
  }

  res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Dashboard - Securinets CorpPortal</title>
            <style>
                body {
                    font-family: monospace;
                    background: #0f0f0f;
                    padding: 50px;
                }
                .container {
                    max-width: 800px;
                    margin: 0 auto;
                    background: #1a1a1a;
                    padding: 30px;
                    border-radius: 10px;
                    border: 1px solid #e94560;
                }
                .admin-panel {
                    background: #2a1a1a;
                    border-left: 4px solid #e94560;
                    padding: 20px;
                    border-radius: 5px;
                    margin-top: 20px;
                    display: none;
                }
                h1 { color: #e94560; }
                p, li { color: #ccc; }
                .logout { color: #e94560; text-decoration: none; }
                .revenge-text { color: #666; font-size: 12px; margin-top: 20px; text-align: center; }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>⚡ Securinets Portal</h1>
                <p>Welcome, ${req.session.username || "Employee"}</p>
                <p>Role: <strong>${req.session.role || "standard"}</strong></p>
                <p>Session: ${req.session.id?.substring(0, 8)}...</p>
                <hr>
                <div id="content">
                    <p>📁 Internal documents:</p>
                    <ul>
                        <li>task_ideas.txt</li>
                        <li>revenge_plan.pdf</li>
                        <li>past_ctf_solutions.md</li>
                    </ul>
                </div>
                <div id="adminPanel" class="admin-panel">
                    <h3>🔧 Admin Override</h3>
                    <p>Flag: <strong id="flag" style="color:#e94560"></strong></p>
                    <p><em>"Nice work. The task makers didn't see this coming."</em></p>
                </div>
                <p><a href="/logout" class="logout">Logout</a></p>
                <div class="revenge-text">Securinets Revenge CTF 2024</div>
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

// AUTH ENDPOINT - VULNERABLE TO PROTOTYPE POLLUTION
app.post("/api/auth", (req, res) => {
  const { username, password, ...extra } = req.body;

  // Fake credential check (no SQL)
  const user = database[username];
  const crypto = require("crypto");
  const hashedInput = crypto
    .createHash("sha256")
    .update(password)
    .digest("hex");

  if (!user || user.password !== hashedInput) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  // VULNERABILITY: Object.assign with user-controlled input
  // This allows __proto__ pollution
  Object.assign(req.session, {
    loggedIn: true,
    username: username,
    role: user.role,
    ...extra, // <-- DANGER ZONE: user can inject properties
  });

  res.json({
    success: true,
    redirect: "/dashboard",
    message: "Authentication successful",
  });
});

// Status check (used by dashboard)
app.get("/api/status", (req, res) => {
  if (!req.session.loggedIn) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  // Check for prototype pollution
  const isAdmin =
    req.session.isAdmin === true ||
    req.session.role === "admin" ||
    (req.session.__proto__ && req.session.__proto__.isAdmin === true);

  res.json({
    username: req.session.username,
    role: req.session.role || "standard",
    isAdmin: isAdmin,
  });
});

// Flag endpoint - THE REVENGE FLAG
app.get("/api/flag", (req, res) => {
  if (!req.session.loggedIn) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const isAdmin = req.session.isAdmin === true || req.session.role === "admin";

  if (isAdmin) {
    // THE REVENGE FLAG - CHANGE THIS TO WHATEVER YOU WANT
    res.json({
      flag: "SECURINETS{task_makers_become_task_takers_revenge_is_ours}",
    });
  } else {
    res.status(403).json({ error: "Admin access required" });
  }
});

// Logout
app.get("/logout", (req, res) => {
  req.session.destroy();
  res.redirect("/");
});

// Health check
app.get("/health", (req, res) => {
  res.send("OK");
});

// Easter egg for those who look at response headers
app.use((req, res, next) => {
  res.setHeader("X-Powered-By", "Securinets-Revenge-Engine");
  res.setHeader("X-Revenge-Mode", "Activated");
  next();
});

app.listen(PORT, () => {
  console.log(`🔥 SECURINETS REVENGE CTF running on port ${PORT}`);
  console.log(`💀 Let the revenge begin...`);
});
