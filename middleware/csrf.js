const crypto = require('crypto');

/**
 * Synchronizer Token Pattern CSRF protection.
 * Generates a per-session token and validates it on state-changing requests.
 */

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Middleware: ensures every session has a CSRF token and exposes it to templates.
 * Also validates the token on non-safe HTTP methods.
 */
function csrfMiddleware(req, res, next) {
  // Generate token for session if not already present
  if (!req.session.csrfToken) {
    req.session.csrfToken = generateToken();
  }

  // Expose token to all views
  res.locals.csrfToken = req.session.csrfToken;

  // Validate on state-changing methods
  const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
  if (!safeMethods.includes(req.method)) {
    const tokenFromBody = req.body && req.body._csrf;
    const tokenFromHeader = req.headers['x-csrf-token'];
    const submittedToken = tokenFromBody || tokenFromHeader;

    if (!submittedToken || !req.session.csrfToken) {
      return res.status(403).send('Forbidden: missing CSRF token');
    }

    // Use timing-safe comparison to prevent timing attacks
    const expected = Buffer.from(req.session.csrfToken, 'hex');
    const submitted = Buffer.from(submittedToken, 'hex');
    if (expected.length !== submitted.length ||
        !crypto.timingSafeEqual(expected, submitted)) {
      return res.status(403).send('Forbidden: invalid CSRF token');
    }
  }

  next();
}

module.exports = { csrfMiddleware };
