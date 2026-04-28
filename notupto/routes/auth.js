// routes/auth.js
// All authentication API endpoints live here.
// Mounted at /api in server.js, so full paths are:
//   POST /api/signup
//   POST /api/login
//   POST /api/logout
//   GET  /api/me

const express     = require('express');
const jwt         = require('jsonwebtoken');
const rateLimit   = require('express-rate-limit');
const User        = require('../models/User');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// ─── RATE LIMITERS ───────────────────────────────────────────────────────────
// Prevent brute-force attacks on login and signup

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,                   // max 10 attempts per IP per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts. Please wait 15 minutes and try again.' }
});

// ─── HELPERS ────────────────────────────────────────────────────────────────

function issueToken(user) {
  return jwt.sign(
    { id: user._id, username: user.username },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

function setCookieAndRespond(res, token, user) {
  // HttpOnly cookie — JS cannot read this, preventing XSS token theft
  res.cookie('notupto_token', token, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production', // HTTPS only in prod
    sameSite: 'lax',   // Protects against CSRF while allowing normal navigation
    maxAge:   7 * 24 * 60 * 60 * 1000  // 7 days in ms
  });

  return res.status(200).json({
    success: true,
    user: {
      id:       user._id,
      username: user.username,
      // Never include passwordHash or other sensitive fields
    },
    // Also send the token in the body so API clients (mobile, etc.) can use it
    token
  });
}

function validateUsername(username) {
  if (!username || typeof username !== 'string') return 'Username is required.';
  const trimmed = username.trim().toLowerCase();
  if (trimmed.length < 3)  return 'Username must be at least 3 characters.';
  if (trimmed.length > 30) return 'Username must be at most 30 characters.';
  if (!/^[a-zA-Z0-9_-]+$/.test(trimmed)) return 'Username can only contain letters, numbers, underscores, and hyphens.';
  return null; // null = valid
}

function validatePassword(password) {
  if (!password || typeof password !== 'string') return 'Password is required.';
  if (password.length < 8)   return 'Password must be at least 8 characters.';
  if (password.length > 128) return 'Password is too long.';
  return null; // null = valid
}

// ─── POST /api/signup ────────────────────────────────────────────────────────
router.post('/signup', authLimiter, async (req, res) => {
  try {
    const { username, password } = req.body;

    // 1. Validate inputs
    const usernameError = validateUsername(username);
    if (usernameError) return res.status(400).json({ error: usernameError });

    const passwordError = validatePassword(password);
    if (passwordError) return res.status(400).json({ error: passwordError });

    const cleanUsername = username.trim().toLowerCase();

    // 2. Check if username already taken
    // Case-insensitive because we store all usernames lowercase
    const existing = await User.findOne({ username: cleanUsername });
    if (existing) {
      return res.status(409).json({ error: 'Username is already taken. Please choose another.' });
    }

    // 3. Hash the password
    const passwordHash = await User.hashPassword(password);

    // 4. Create the user
    const user = await User.create({
      username:     cleanUsername,
      passwordHash: passwordHash
    });

    // 5. Issue JWT and set cookie
    const token = issueToken(user);
    return setCookieAndRespond(res, token, user);

  } catch (err) {
    // Handle MongoDB duplicate key error (race condition safety net)
    if (err.code === 11000) {
      return res.status(409).json({ error: 'Username is already taken. Please choose another.' });
    }
    console.error('[POST /api/signup]', err);
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

// ─── POST /api/login ─────────────────────────────────────────────────────────
router.post('/login', authLimiter, async (req, res) => {
  try {
    const { username, password } = req.body;

    // 1. Validate inputs exist (no detailed validation — just existence check)
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required.' });
    }

    const cleanUsername = username.trim().toLowerCase();

    // 2. Find user — must explicitly select passwordHash (select:false in schema)
    const user = await User.findOne({ username: cleanUsername }).select('+passwordHash');

    // 3. Deliberately vague error — don't reveal whether the username exists
    if (!user) {
      return res.status(401).json({ error: 'Incorrect username or password.' });
    }

    // 4. Compare password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Incorrect username or password.' });
    }

    // 5. Issue JWT and set cookie
    const token = issueToken(user);
    return setCookieAndRespond(res, token, user);

  } catch (err) {
    console.error('[POST /api/login]', err);
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

// ─── POST /api/logout ────────────────────────────────────────────────────────
router.post('/logout', (req, res) => {
  // Clear the cookie by setting maxAge to 0
  res.clearCookie('notupto_token', {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'lax'
  });
  return res.status(200).json({ success: true, message: 'Logged out.' });
});

// ─── GET /api/me ──────────────────────────────────────────────────────────────
// Returns the currently logged-in user's profile.
// Used by the frontend to check auth state on page load.
router.get('/me', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }
    return res.status(200).json({ user });
  } catch (err) {
    console.error('[GET /api/me]', err);
    return res.status(500).json({ error: 'Something went wrong.' });
  }
});

module.exports = router;
