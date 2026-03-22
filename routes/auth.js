const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../db/database');

// GET /register
router.get('/register', (req, res) => {
  res.render('register', { title: 'Register' });
});

// POST /register
router.post('/register', async (req, res) => {
  const { username, email, password, confirm_password } = req.body;

  if (!username || !email || !password || !confirm_password) {
    req.session.flash = { type: 'danger', message: 'All fields are required.' };
    return res.redirect('/register');
  }

  if (password !== confirm_password) {
    req.session.flash = { type: 'danger', message: 'Passwords do not match.' };
    return res.redirect('/register');
  }

  if (password.length < 6) {
    req.session.flash = { type: 'danger', message: 'Password must be at least 6 characters.' };
    return res.redirect('/register');
  }

  try {
    const existingUser = db.prepare('SELECT id FROM users WHERE username = ? OR email = ?').get(username, email);
    if (existingUser) {
      req.session.flash = { type: 'danger', message: 'Username or email already exists.' };
      return res.redirect('/register');
    }

    const hash = await bcrypt.hash(password, 10);
    const result = db.prepare(
      'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)'
    ).run(username, email.toLowerCase(), hash);

    req.session.userId = result.lastInsertRowid;
    req.session.username = username;
    req.session.isAdmin = 0;
    req.session.flash = { type: 'success', message: `Welcome, ${username}! Your account has been created.` };
    res.redirect('/dashboard');
  } catch (err) {
    console.error(err);
    req.session.flash = { type: 'danger', message: 'Registration failed. Please try again.' };
    res.redirect('/register');
  }
});

// GET /login
router.get('/login', (req, res) => {
  res.render('login', { title: 'Login' });
});

// POST /login
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    req.session.flash = { type: 'danger', message: 'Username and password are required.' };
    return res.redirect('/login');
  }

  try {
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    if (!user) {
      req.session.flash = { type: 'danger', message: 'Invalid username or password.' };
      return res.redirect('/login');
    }

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      req.session.flash = { type: 'danger', message: 'Invalid username or password.' };
      return res.redirect('/login');
    }

    req.session.userId = user.id;
    req.session.username = user.username;
    req.session.isAdmin = user.is_admin;
    req.session.flash = { type: 'success', message: `Welcome back, ${user.username}!` };
    res.redirect('/dashboard');
  } catch (err) {
    console.error(err);
    req.session.flash = { type: 'danger', message: 'Login failed. Please try again.' };
    res.redirect('/login');
  }
});

// GET /logout
router.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/login');
  });
});

module.exports = router;
