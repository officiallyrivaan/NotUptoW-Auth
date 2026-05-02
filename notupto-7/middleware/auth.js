// middleware/auth.js

const jwt = require('jsonwebtoken');

function getToken(req) {
  if (req.cookies && req.cookies.notupto_token) return req.cookies.notupto_token;
  const h = req.headers['authorization'];
  if (h && h.startsWith('Bearer ')) return h.slice(7);
  return null;
}

// Decodes token and enforces the owner-by-username rule
function decode(token) {
  const d = jwt.verify(token, process.env.JWT_SECRET);
  // Critical: username 'owner' is always role 'owner' regardless of token contents
  const role = d.username === 'owner' ? 'owner' : (d.role || 'user');
  return { id: d.id, username: d.username, role };
}

// requireAuth — sets req.user or returns 401
function requireAuth(req, res, next) {
  const token = getToken(req);
  if (!token) return res.status(401).json({ error: 'Not authenticated. Please log in.' });
  try {
    req.user = decode(token);
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') return res.status(401).json({ error: 'Session expired. Please log in again.' });
    return res.status(401).json({ error: 'Invalid token. Please log in again.' });
  }
}

// requireOwner — owner role only. Stack after requireAuth.
function requireOwner(req, res, next) {
  if (!req.user || req.user.role !== 'owner') {
    return res.status(403).json({ error: 'Access denied. Owner only.' });
  }
  next();
}

// requireEditor — owner | moderator | editor. Stack after requireAuth.
function requireEditor(req, res, next) {
  const allowed = ['owner', 'moderator', 'editor'];
  if (!req.user || !allowed.includes(req.user.role)) {
    return res.status(403).json({ error: 'Access denied. Editors only.' });
  }
  next();
}

// optionalAuth — attaches req.user if valid token, null otherwise
function optionalAuth(req, res, next) {
  const token = getToken(req);
  if (!token) { req.user = null; return next(); }
  try { req.user = decode(token); } catch { req.user = null; }
  next();
}

module.exports = { requireAuth, requireOwner, requireEditor, optionalAuth };
