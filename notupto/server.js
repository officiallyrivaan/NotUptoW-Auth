// server.js
// Entry point. Connects to MongoDB, mounts routes, serves the frontend.
// Run with:  node server.js
// Dev mode:  npm run dev  (uses nodemon for auto-reload)

require('dotenv').config(); // Load .env before anything else

const express      = require('express');
const cookieParser = require('cookie-parser');
const path         = require('path');
const connectDB    = require('./config/db');
const authRoutes   = require('./routes/auth');

const app  = express();
const PORT = process.env.PORT || 3000;

// ─── DATABASE ────────────────────────────────────────────────────────────────
connectDB();

// ─── MIDDLEWARE ──────────────────────────────────────────────────────────────
app.use(express.json());                        // Parse JSON request bodies
app.use(express.urlencoded({ extended: true }));// Parse form submissions
app.use(cookieParser());                        // Parse cookies (for JWT HttpOnly cookie)

// Security headers — basic hardening without a full helmet.js dependency
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// ─── API ROUTES ──────────────────────────────────────────────────────────────
// All auth endpoints: /api/signup, /api/login, /api/logout, /api/me
app.use('/api', authRoutes);

// ─── STATIC FILES (the NotUpto frontend) ─────────────────────────────────────
// Serves index.html and any other files in /public
app.use(express.static(path.join(__dirname, 'public')));

// ─── SPA FALLBACK ────────────────────────────────────────────────────────────
// For any non-API route, serve the single HTML file.
// This lets the frontend handle its own client-side routing.
app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ error: 'API endpoint not found.' });
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ─── START ───────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀 NotUpto running at http://localhost:${PORT}`);
  console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`   MongoDB:     ${process.env.MONGO_URI}\n`);
});

module.exports = app; // Export for testing
