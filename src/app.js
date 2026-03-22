'use strict';

const express      = require('express');
const session      = require('express-session');
const MemoryStore  = require('memorystore')(session);
const rateLimit    = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const csrf         = require('./middleware/csrf');
const path         = require('path');
const { initDb }   = require('./db/schema');
const { seed }     = require('./db/seed');

const app  = express();
const PORT = process.env.PORT || 3000;
const isProd = process.env.NODE_ENV === 'production';

// ─── View engine ────────────────────────────────────────────────────────────
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ─── Middleware ──────────────────────────────────────────────────────────────
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
  secret: process.env.SESSION_SECRET || (() => {
    if (isProd) {
      throw new Error('SESSION_SECRET environment variable must be set in production');
    }
    return 'wc2026-dev-secret-change-in-production';
  })(),
  resave: false,
  saveUninitialized: true,
  store: new MemoryStore({ checkPeriod: 86400000 }), // prune expired entries every 24h
  cookie: {
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    httpOnly: true,
    sameSite: 'lax',
    secure: isProd,   // HTTPS-only in production
  },
}));

// ─── Rate limiting ───────────────────────────────────────────────────────────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many requests, please try again later.',
});

const globalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(globalLimiter);
app.use('/auth', authLimiter);

// ─── CSRF protection ─────────────────────────────────────────────────────────
// Expose session and CSRF token to all views; validate on POST/PUT/DELETE
app.use(csrf);

// Expose session to all views
app.use((req, res, next) => {
  res.locals.session = req.session;
  next();
});

// ─── Database ────────────────────────────────────────────────────────────────
initDb();
seed();

// ─── Routes ──────────────────────────────────────────────────────────────────
app.use('/auth',      require('./routes/auth'));
app.use('/dashboard', require('./routes/dashboard'));
app.use('/bracket',   require('./routes/bracket'));
app.use('/standings', require('./routes/standings'));
app.use('/admin',     require('./routes/admin'));

// Home
app.get('/', (req, res) => {
  if (req.session.userId) return res.redirect('/dashboard');
  res.render('home');
});

// 404
app.use((req, res) => {
  res.status(404).render('error', { message: 'Page not found.' });
});

// Error handler
app.use((err, req, res, _next) => {
  console.error(err);
  res.status(500).render('error', { message: 'Internal server error.' });
});

// ─── Start ───────────────────────────────────────────────────────────────────
if (require.main === module) {
  app.listen(PORT, () => console.log(`WorldCupBracket listening on http://localhost:${PORT}`));
}

module.exports = app;
