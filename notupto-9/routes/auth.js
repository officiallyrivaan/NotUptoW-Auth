// routes/auth.js
// POST   /api/signup
// POST   /api/login
// POST   /api/logout
// GET    /api/me
// GET    /api/permissions/users          — owner only
// PATCH  /api/permissions/role           — owner only
// DELETE /api/permissions/user/:id       — owner only

const express   = require('express');
const jwt       = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const User      = require('../models/User');
const GuestAcceptance = require('../models/GuestAcceptance');
const { requireAuth, requireOwner } = require('../middleware/auth');

const router = express.Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 10,
  standardHeaders: true, legacyHeaders: false,
  message: { error: 'Too many attempts. Please wait 15 minutes and try again.' }
});

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function issueToken(user) {
  // Always enforce owner-by-username before signing
  const role = user.username === 'owner' ? 'owner' : user.role;
  return jwt.sign(
    { id: user._id, username: user.username, role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

function setCookieAndRespond(res, token, user) {
  res.cookie('notupto_token', token, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge:   7 * 24 * 60 * 60 * 1000
  });
  const role = user.username === 'owner' ? 'owner' : user.role;
  return res.status(200).json({
    success: true,
    user: { id: user._id, username: user.username, role },
    token
  });
}

function validateUsername(u) {
  if (!u || typeof u !== 'string') return 'Username is required.';
  const t = u.trim().toLowerCase();
  if (t.length < 3)  return 'Username must be at least 3 characters.';
  if (t.length > 30) return 'Username must be at most 30 characters.';
  if (!/^[a-zA-Z0-9_-]+$/.test(t)) return 'Username can only contain letters, numbers, underscores, and hyphens.';
  return null;
}

function validatePassword(p) {
  if (!p || typeof p !== 'string') return 'Password is required.';
  if (p.length < 8)   return 'Password must be at least 8 characters.';
  if (p.length > 128) return 'Password is too long.';
  return null;
}

// ─── POST /api/signup ────────────────────────────────────────────────────────
router.post('/signup', authLimiter, async (req, res) => {
  try {
    const { username, password } = req.body;

    const ue = validateUsername(username);
    if (ue) return res.status(400).json({ error: ue });
    const pe = validatePassword(password);
    if (pe) return res.status(400).json({ error: pe });

    const clean = username.trim().toLowerCase();

    const existing = await User.findOne({ username: clean });
    if (existing) return res.status(409).json({ error: 'Username is already taken. Please choose another.' });

    const passwordHash = await User.hashPassword(password);

    // username === 'owner' always gets owner role (enforced again in pre-save hook)
    const role = clean === 'owner' ? 'owner' : 'user';

    const user = await User.create({ username: clean, passwordHash, role });

    return setCookieAndRespond(res, issueToken(user), user);
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: 'Username is already taken. Please choose another.' });
    console.error('[POST /api/signup]', err);
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

// ─── POST /api/login ─────────────────────────────────────────────────────────
router.post('/login', authLimiter, async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password are required.' });

    const clean = username.trim().toLowerCase();
    const user  = await User.findOne({ username: clean }).select('+passwordHash');

    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ error: 'Incorrect username or password.' });
    }

    // Enforce owner rule on login — corrects any DB drift
    if (clean === 'owner' && user.role !== 'owner') {
      user.role = 'owner';
      await user.save();
    }

    return setCookieAndRespond(res, issueToken(user), user);
  } catch (err) {
    console.error('[POST /api/login]', err);
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

// ─── POST /api/logout ────────────────────────────────────────────────────────
router.post('/logout', (req, res) => {
  res.clearCookie('notupto_token', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' });
  return res.status(200).json({ success: true });
});

// ─── GET /api/me ─────────────────────────────────────────────────────────────
router.get('/me', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found.' });
    const role = user.username === 'owner' ? 'owner' : user.role;
    return res.status(200).json({ user: { ...user.toJSON(), role, termsAccepted: user.termsAccepted } });
  } catch (err) {
    console.error('[GET /api/me]', err);
    return res.status(500).json({ error: 'Something went wrong.' });
  }
});

// ─── POST /api/user/accept-terms ─────────────────────────────────────────────
router.post('/user/accept-terms', requireAuth, async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user.id, { termsAccepted: true });
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('[POST /api/user/accept-terms]', err);
    return res.status(500).json({ error: 'Something went wrong.' });
  }
});

// ─── POST /api/guest/accept-terms ─────────────────────────────────────────────
// Stores T&C acceptance for non-logged-in visitors by IP in the GuestAcceptance collection.
router.post('/guest/accept-terms', async (req, res) => {
  try {
    const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket.remoteAddress || 'unknown';
    const ua = req.headers['user-agent'] || '';
    await GuestAcceptance.findOneAndUpdate(
      { ip },
      { ip, userAgent: ua, acceptedAt: new Date() },
      { upsert: true, new: true }
    );
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('[POST /api/guest/accept-terms]', err);
    return res.status(500).json({ error: 'Something went wrong.' });
  }
});

// ═══════════════════════════════════════════════════════════
//  PERMISSIONS ROUTES — owner only
// ═══════════════════════════════════════════════════════════

// GET /api/permissions/users
router.get('/permissions/users', requireAuth, requireOwner, async (req, res) => {
  try {
    const users = await User.find({}, 'username role createdAt').sort({ createdAt: 1 });
    // Correct any owner-username drift in the response
    const corrected = users.map(u => {
      const obj = u.toJSON();
      if (obj.username === 'owner') obj.role = 'owner';
      return obj;
    });
    return res.status(200).json({ users: corrected });
  } catch (err) {
    console.error('[GET /api/permissions/users]', err);
    return res.status(500).json({ error: 'Something went wrong.' });
  }
});

// PATCH /api/permissions/role — { userId, role }
router.patch('/permissions/role', requireAuth, requireOwner, async (req, res) => {
  try {
    const { userId, role } = req.body;

    if (!role || !User.ASSIGNABLE_ROLES.includes(role)) {
      return res.status(400).json({ error: `Role must be one of: ${User.ASSIGNABLE_ROLES.join(', ')}.` });
    }
    if (!userId) return res.status(400).json({ error: 'userId is required.' });

    const target = await User.findById(userId);
    if (!target) return res.status(404).json({ error: 'User not found.' });

    // Cannot touch the owner account
    if (target.username === 'owner' || target.role === 'owner') {
      return res.status(403).json({ error: 'The owner account cannot be modified.' });
    }
    // Owner cannot change their own role
    if (target._id.toString() === req.user.id) {
      return res.status(403).json({ error: 'You cannot change your own role.' });
    }

    target.role = role;
    await target.save();

    return res.status(200).json({ success: true, user: { id: target._id, username: target.username, role: target.role } });
  } catch (err) {
    console.error('[PATCH /api/permissions/role]', err);
    return res.status(500).json({ error: 'Something went wrong.' });
  }
});

// DELETE /api/permissions/user/:id
router.delete('/permissions/user/:id', requireAuth, requireOwner, async (req, res) => {
  try {
    const target = await User.findById(req.params.id);
    if (!target) return res.status(404).json({ error: 'User not found.' });
    if (target.username === 'owner' || target.role === 'owner') {
      return res.status(403).json({ error: 'The owner account cannot be deleted.' });
    }
    if (target._id.toString() === req.user.id) {
      return res.status(403).json({ error: 'You cannot delete your own account.' });
    }
    await User.findByIdAndDelete(req.params.id);
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('[DELETE /api/permissions/user/:id]', err);
    return res.status(500).json({ error: 'Something went wrong.' });
  }
});

module.exports = router;
