// middleware/auth.js
// Verifies the JWT from either:
//   1. HttpOnly cookie  (browser clients — primary)
//   2. Authorization: Bearer <token> header (API clients / future mobile app)
//
// Usage in routes:
//   router.get('/protected', requireAuth, handler)
//
// On success:  sets req.user = { id, username } and calls next()
// On failure:  returns 401 JSON — does NOT redirect (keeps auth logic in one place)

const jwt = require('jsonwebtoken');

function requireAuth(req, res, next) {
  // 1. Try cookie first (browser flow)
  let token = req.cookies && req.cookies.notupto_token;

  // 2. Fall back to Authorization header (API / mobile flow)
  if (!token) {
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.slice(7);
    }
  }

  if (!token) {
    return res.status(401).json({ error: 'Not authenticated. Please log in.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // Attach minimal user info — never attach the full DB document here
    req.user = { id: decoded.id, username: decoded.username };
    next();
  } catch (err) {
    // Distinguish expired tokens so the client can show the right message
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Session expired. Please log in again.' });
    }
    return res.status(401).json({ error: 'Invalid token. Please log in again.' });
  }
}

// Optional middleware: attaches user to req if logged in, but doesn't block if not
// Useful for routes that behave differently for logged-in users
function optionalAuth(req, res, next) {
  const token = (req.cookies && req.cookies.notupto_token)
    || (req.headers['authorization'] && req.headers['authorization'].startsWith('Bearer ')
        ? req.headers['authorization'].slice(7) : null);

  if (!token) { req.user = null; return next(); }

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    req.user = null;
    next();
  }
}

module.exports = { requireAuth, optionalAuth };
