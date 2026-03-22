const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const path = require('path');
const rateLimit = require('express-rate-limit');
const { csrfMiddleware } = require('./middleware/csrf');

// Initialize DB (creates tables, seeds data)
require('./db/database');

const authRoutes = require('./routes/auth');
const bracketRoutes = require('./routes/brackets');
const picksRoutes = require('./routes/picks');
const standingsRoutes = require('./routes/standings');
const adminRoutes = require('./routes/admin');

const app = express();
const PORT = process.env.PORT || 3000;
const IS_PROD = process.env.NODE_ENV === 'production';
const SESSION_SECRET = process.env.SESSION_SECRET || 'worldcup2026-dev-secret-change-in-prod';

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// Body parsing
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Session
app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    secure: IS_PROD,
    httpOnly: true,
    sameSite: 'lax'
  }
}));

// Rate limiting on auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30,
  message: 'Too many requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false
});
app.use('/login', authLimiter);
app.use('/register', authLimiter);

// CSRF protection (synchronizer token pattern via session)
app.use(csrfMiddleware);

// Make session data available to all views; flash handled in csrfMiddleware locals
app.use((req, res, next) => {
  res.locals.session = req.session;
  res.locals.flash = req.session.flash || null;
  delete req.session.flash;
  next();
});

// Routes
app.use('/', authRoutes);
app.use('/', bracketRoutes);
app.use('/', picksRoutes);
app.use('/', standingsRoutes);
app.use('/', adminRoutes);

// Home page
app.get('/', (req, res) => {
  res.render('index', { title: '2026 FIFA World Cup Bracket Picks' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).render('index', { title: 'Page Not Found' });
});

app.listen(PORT, () => {
  console.log(`WorldCup Bracket app running on http://localhost:${PORT}`);
});

module.exports = app;
