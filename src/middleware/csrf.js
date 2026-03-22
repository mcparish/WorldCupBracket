'use strict';

/**
 * Simple synchronizer-token CSRF middleware.
 *
 * - Stores a random token in the session on first use.
 * - Injects `res.locals.csrfToken` for use in views.
 * - On every non-safe (POST/PUT/PATCH/DELETE) request, validates
 *   that `req.body._csrf` or the `x-csrf-token` header matches the
 *   token stored in the session.
 */

const { randomBytes } = require('crypto');

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function csrfMiddleware(req, res, next) {
  // Ensure a token exists in the session
  if (!req.session.csrfToken) {
    req.session.csrfToken = randomBytes(32).toString('hex');
  }

  res.locals.csrfToken = req.session.csrfToken;

  if (SAFE_METHODS.has(req.method)) {
    return next();
  }

  // Validate token on mutating requests
  const submitted = req.body._csrf || req.headers['x-csrf-token'];
  if (!submitted || submitted !== req.session.csrfToken) {
    return res.status(403).render('error', {
      message: 'Invalid or missing CSRF token. Please go back and try again.',
    });
  }

  next();
}

module.exports = csrfMiddleware;
