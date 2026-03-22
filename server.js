const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const path = require('path');

// Initialize DB (creates tables, seeds data)
require('./db/database');

const authRoutes = require('./routes/auth');
const bracketRoutes = require('./routes/brackets');
const picksRoutes = require('./routes/picks');
const standingsRoutes = require('./routes/standings');
const adminRoutes = require('./routes/admin');

const app = express();
const PORT = process.env.PORT || 3000;
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
  cookie: { maxAge: 7 * 24 * 60 * 60 * 1000 } // 7 days
}));

// Make session data available to all views
app.use((req, res, next) => {
  res.locals.session = req.session;
  // Pass and clear flash message
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
