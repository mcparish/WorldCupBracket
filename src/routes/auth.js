'use strict';

const express = require('express');
const bcrypt  = require('bcrypt');
const { getDb } = require('../db/schema');

const router = express.Router();
const SALT_ROUNDS = 12;

// GET /auth/register
router.get('/register', (req, res) => {
  if (req.session.userId) return res.redirect('/dashboard');
  res.render('auth/register', { error: null });
});

// POST /auth/register
router.post('/register', async (req, res) => {
  const { username, email, password, confirm_password } = req.body;

  if (!username || !email || !password) {
    return res.render('auth/register', { error: 'All fields are required.' });
  }
  if (password !== confirm_password) {
    return res.render('auth/register', { error: 'Passwords do not match.' });
  }
  if (password.length < 6) {
    return res.render('auth/register', { error: 'Password must be at least 6 characters.' });
  }

  const db = getDb();
  const existing = db.prepare('SELECT id FROM users WHERE username = ? OR email = ?').get(username, email);
  if (existing) {
    return res.render('auth/register', { error: 'Username or email already taken.' });
  }

  try {
    const hash = await bcrypt.hash(password, SALT_ROUNDS);
    const result = db.prepare(
      'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)'
    ).run(username, email, hash);
    req.session.userId   = result.lastInsertRowid;
    req.session.username = username;
    req.session.isAdmin  = false;
    res.redirect('/dashboard');
  } catch (err) {
    console.error('Register error:', err);
    res.render('auth/register', { error: 'Registration failed. Please try again.' });
  }
});

// GET /auth/login
router.get('/login', (req, res) => {
  if (req.session.userId) return res.redirect('/dashboard');
  res.render('auth/login', { error: null });
});

// POST /auth/login
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.render('auth/login', { error: 'Username and password are required.' });
  }

  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user) {
    return res.render('auth/login', { error: 'Invalid username or password.' });
  }

  try {
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.render('auth/login', { error: 'Invalid username or password.' });
    }
    req.session.userId   = user.id;
    req.session.username = user.username;
    req.session.isAdmin  = user.is_admin === 1;
    res.redirect('/dashboard');
  } catch (err) {
    console.error('Login error:', err);
    res.render('auth/login', { error: 'Login failed. Please try again.' });
  }
});

// POST /auth/logout
router.post('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/auth/login'));
});

module.exports = router;
